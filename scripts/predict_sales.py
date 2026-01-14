"""
Sales Prediction Script for Vending Machines
Fetches orders from PostgreSQL, generates predictions, stores results back.
Run via GitHub Actions daily.
"""

import os
import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import psycopg2
from psycopg2.extras import RealDictCursor
import joblib

from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder

# Configuration
DATABASE_URL = os.environ.get('DATABASE_URL')
MODEL_PATH = os.path.join(os.path.dirname(__file__), 'sales_model.joblib')
ENCODER_PATH = os.path.join(os.path.dirname(__file__), 'encoder.joblib')

# Devices to exclude from prediction (event machines)
MACHINES_TO_DROP = ['852298', '852308', '852309', '852311']

# Feature windows
WINDOWS = [3, 7, 14]
TARGET_COL = 'daily_sales'
MACHINE_COL = 'machine_sn'


def get_db_connection():
    """Create database connection from DATABASE_URL."""
    return psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)


def fetch_orders(days=30):
    """
    Fetch orders from the last N days.
    Daily window: 10:30 PM SGT to 10:29 PM SGT next day.
    """
    conn = get_db_connection()
    cur = conn.cursor()

    # Fetch orders from last N days
    # Using 10:30 PM SGT (14:30 UTC) as the day boundary
    query = """
        SELECT
            "orderId",
            "deviceId" as machine_sn,
            "deviceName",
            "createdAt" as log_datetime,
            "isSuccess" as operation_outcome,
            "payWay" as payment_mode,
            "payAmount" as transaction_amount,
            "quantity" as order_amt,
            "deliverCount" as num_dispensed,
            "refundAmount" as refund_amount
        FROM "Order"
        WHERE "createdAt" >= (CURRENT_DATE - INTERVAL '%s days' + TIME '14:30:00')
          AND "createdAt" < (CURRENT_DATE + TIME '14:30:00')
        ORDER BY "createdAt" ASC
    """
    cur.execute(query, (days,))
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return pd.DataFrame(rows)


def fetch_devices():
    """Fetch all active devices."""
    conn = get_db_connection()
    cur = conn.cursor()

    query = """
        SELECT "deviceId", "deviceName"
        FROM "Device"
        WHERE "isActive" = true
    """
    cur.execute(query)
    rows = cur.fetchall()
    cur.close()
    conn.close()

    return pd.DataFrame(rows)


def format_orders(df):
    """Format orders from DB to match model's expected input."""
    if df.empty:
        return df

    # Convert types
    df['log_datetime'] = pd.to_datetime(df['log_datetime'])
    df['machine_sn'] = df['machine_sn'].astype(str)

    # Map isSuccess (boolean) to operation_outcome
    df['operation_outcome'] = df['operation_outcome'].map({True: 'Success', False: 'Failed'})

    # Fill missing values
    df['num_dispensed'] = df['num_dispensed'].fillna(0).astype(int)
    df['transaction_amount'] = df['transaction_amount'].fillna(0)
    df['refund_amount'] = df['refund_amount'].fillna(0)

    # Add error_code as 0 (not available in our DB)
    df['error_code'] = 0

    # Filter out event machines
    df = df[~df['machine_sn'].isin(MACHINES_TO_DROP)]

    return df


def aggregate_daily(df):
    """
    Aggregate orders to TOTAL daily level (all machines combined).
    Daily window: 10:30 PM SGT Day X to 10:29 PM SGT Day X+1 → labeled as Day X+1.
    Example: Jan 10 10:30 PM to Jan 11 10:29 PM SGT = "Jan 11 sales"
    """
    # Shift time and label by END date of the window
    df['adjusted_datetime'] = df['log_datetime'] - pd.Timedelta(hours=14, minutes=30)
    df['date'] = pd.to_datetime(df['adjusted_datetime'].dt.date) + pd.Timedelta(days=1)

    # Aggregate ALL machines together per day
    df_agg = df.groupby(['date']).agg(
        daily_sales=('num_dispensed', 'sum'),
        transactions=('num_dispensed', 'count'),
        total_amount=('transaction_amount', 'sum'),
        error_count=('error_code', lambda x: (x != 0).sum()),
        total_refund=('refund_amount', 'sum'),
        active_machines=('machine_sn', 'nunique')
    ).reset_index()

    return df_agg


def create_features(df_agg):
    """Create features for the model (total sales level)."""
    df_features = df_agg.copy()

    df_features['date'] = pd.to_datetime(df_features['date'])
    df_features['day'] = df_features['date'].dt.day
    df_features['weekday'] = df_features['date'].dt.weekday
    df_features['month'] = df_features['date'].dt.month
    df_features['is_weekend'] = (df_features['weekday'] >= 5).astype(int)

    # Rolling statistics (total level, no groupby)
    for w in WINDOWS:
        df_features[f'rolling_mean_{w}'] = df_features[TARGET_COL].rolling(window=w, min_periods=1).mean()
        df_features[f'rolling_std_{w}'] = df_features[TARGET_COL].rolling(window=w, min_periods=1).std().fillna(0)

    # Lag features
    for lag in [1, 7]:
        df_features[f'lag_{lag}'] = df_features[TARGET_COL].shift(lag)

    # Error rate
    df_features['error_rate'] = df_features['error_count'] / df_features['transactions'].replace(0, np.nan)
    df_features['error_rate'] = df_features['error_rate'].fillna(0)

    # Fill NA lags with 0
    lag_cols = [c for c in df_features.columns if c.startswith('lag_')]
    df_features[lag_cols] = df_features[lag_cols].fillna(0)

    df_features = df_features.sort_values('date')

    return df_features


def prepare_features(df, encoder=None):
    """Prepare feature matrix for prediction."""
    CATEGORICALS = ['weekday', 'month']
    exclude_cols = [MACHINE_COL, 'date', TARGET_COL, 'devicename']
    feature_cols = [c for c in df.columns if c not in exclude_cols and c.lower() not in ['devicename']]
    NUMERICALS = [c for c in feature_cols if c not in CATEGORICALS]

    # Fill missing numerics
    df[NUMERICALS] = df[NUMERICALS].fillna(0)

    # One-hot encode categoricals
    if encoder is None:
        encoder = OneHotEncoder(sparse_output=False, handle_unknown='ignore')
        encoder.fit(df[CATEGORICALS])

    num = df[NUMERICALS].values
    cat = encoder.transform(df[CATEGORICALS])
    X = np.hstack([num, cat])

    return X, encoder, NUMERICALS


def train_model(df_features):
    """Train a new model on the available data."""
    print("Training new model...")

    # Remove rows with NaN target
    df_train = df_features[~df_features[TARGET_COL].isnull()].copy()

    if len(df_train) < 50:
        print(f"Warning: Only {len(df_train)} samples available for training")

    X, encoder, _ = prepare_features(df_train)
    y = df_train[TARGET_COL].values

    model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    model.fit(X, y)

    # Save model and encoder
    joblib.dump(model, MODEL_PATH)
    joblib.dump(encoder, ENCODER_PATH)

    print(f"Model saved to {MODEL_PATH}")
    return model, encoder


def load_model():
    """Load existing model or return None."""
    if os.path.exists(MODEL_PATH) and os.path.exists(ENCODER_PATH):
        model = joblib.load(MODEL_PATH)
        encoder = joblib.load(ENCODER_PATH)
        print("Loaded existing model")
        return model, encoder
    return None, None


def generate_predictions(df_features, model, encoder):
    """Generate prediction for the next day (total sales level)."""
    # Get the last row (most recent day's data)
    last_row = df_features.sort_values('date').iloc[[-1]].copy()

    # Use current values as lag placeholders for next day prediction
    for lag in [1, 7]:
        last_row[f'lag_{lag}'] = last_row[TARGET_COL].values[0]

    # Increment date features for next day
    next_date = last_row['date'].iloc[0] + timedelta(days=1)
    last_row['day'] = next_date.day
    last_row['weekday'] = next_date.weekday()
    last_row['month'] = next_date.month
    last_row['is_weekend'] = 1 if next_date.weekday() >= 5 else 0

    # Prepare features and predict
    X, _, _ = prepare_features(last_row, encoder)
    prediction = model.predict(X)[0]

    last_row['predicted_sales'] = prediction
    last_row['prediction_date'] = next_date

    return last_row


def save_predictions(prediction_row):
    """Save total prediction to database."""
    conn = get_db_connection()
    cur = conn.cursor()

    prediction_date = prediction_row['prediction_date'].iloc[0]
    predicted_sales = float(prediction_row['predicted_sales'].iloc[0])
    rolling_mean_7 = float(prediction_row.get('rolling_mean_7', pd.Series([0])).iloc[0])
    rolling_mean_14 = float(prediction_row.get('rolling_mean_14', pd.Series([0])).iloc[0])

    query = """
        INSERT INTO "SalesPrediction" (
            id, "predictionDate", "predictedSales",
            "rollingMean7", "rollingMean14",
            "createdAt", "updatedAt"
        )
        VALUES (
            gen_random_uuid()::text, %s, %s, %s, %s, NOW(), NOW()
        )
        ON CONFLICT ("predictionDate")
        DO UPDATE SET
            "predictedSales" = EXCLUDED."predictedSales",
            "rollingMean7" = EXCLUDED."rollingMean7",
            "rollingMean14" = EXCLUDED."rollingMean14",
            "updatedAt" = NOW()
    """
    cur.execute(query, (prediction_date, predicted_sales, rolling_mean_7, rolling_mean_14))

    conn.commit()
    cur.close()
    conn.close()

    print(f"Saved prediction for {prediction_date.date()}: {predicted_sales:.1f} sales")


def update_actual_sales():
    """Update actual sales for past predictions (for accuracy tracking)."""
    conn = get_db_connection()
    cur = conn.cursor()

    # Update predictions with actual total sales
    # Using 10:30 PM SGT (14:30 UTC) as day boundary
    query = """
        UPDATE "SalesPrediction" sp
        SET "actualSales" = subq.actual_sales
        FROM (
            SELECT
                DATE("createdAt" - INTERVAL '14 hours 30 minutes') as sale_date,
                SUM("deliverCount") as actual_sales
            FROM "Order"
            WHERE "isSuccess" = true
            GROUP BY DATE("createdAt" - INTERVAL '14 hours 30 minutes')
        ) subq
        WHERE DATE(sp."predictionDate") = subq.sale_date
        AND sp."actualSales" IS NULL
    """
    cur.execute(query)
    updated = cur.rowcount

    conn.commit()
    cur.close()
    conn.close()

    print(f"Updated {updated} predictions with actual sales")


def main():
    print(f"Starting sales prediction at {datetime.now()}")
    print("-" * 50)

    # Step 1: Fetch orders
    print("Fetching orders from database...")
    orders_df = fetch_orders(days=30)
    print(f"Fetched {len(orders_df)} orders")

    if orders_df.empty:
        print("No orders found. Exiting.")
        return

    # Step 2: Format orders
    print("Formatting orders...")
    orders_df = format_orders(orders_df)

    # Step 3: Aggregate daily (total level)
    print("Aggregating to daily total...")
    df_agg = aggregate_daily(orders_df)
    print(f"Aggregated to {len(df_agg)} days")

    # Step 4: Create features
    print("Creating features...")
    df_features = create_features(df_agg)

    # Step 5: Load or train model
    model, encoder = load_model()
    if model is None:
        model, encoder = train_model(df_features)

    # Step 6: Generate prediction
    print("Generating prediction...")
    prediction_row = generate_predictions(df_features, model, encoder)

    # Step 7: Save prediction
    print("Saving prediction to database...")
    save_predictions(prediction_row)

    # Step 8: Update actual sales for past predictions
    print("Updating actual sales for past predictions...")
    update_actual_sales()

    print("-" * 50)
    print("Prediction complete!")

    # Print summary
    print("\nPrediction Summary:")
    print(f"  Date: {prediction_row['prediction_date'].iloc[0].date()}")
    print(f"  Predicted Sales: {prediction_row['predicted_sales'].iloc[0]:.1f}")
    print(f"  7-day Rolling Avg: {prediction_row['rolling_mean_7'].iloc[0]:.1f}")
    print(f"  14-day Rolling Avg: {prediction_row['rolling_mean_14'].iloc[0]:.1f}")


if __name__ == "__main__":
    main()
