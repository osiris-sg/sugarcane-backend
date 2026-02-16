#!/usr/bin/env python3
"""
Train the sales prediction model from local CSV data.
Run this on the RPi to create model files compatible with its numpy version.

Usage:
  python train_model.py
"""

import warnings
warnings.filterwarnings('ignore')

import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
import joblib
from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import OneHotEncoder

# Configuration
SCRIPT_DIR = Path(__file__).parent
DATA_FILE = SCRIPT_DIR / 'training_data.csv'
MODEL_PATH = SCRIPT_DIR / 'sales_model.joblib'
ENCODER_PATH = SCRIPT_DIR / 'encoder.joblib'

# Devices to exclude from prediction (event machines)
MACHINES_TO_DROP = ['852298', '852308', '852309', '852311']

# Feature windows
WINDOWS = [3, 7, 14]
TARGET_COL = 'daily_sales'


def load_training_data():
    """Load and format training data from CSV."""
    print(f"Loading data from {DATA_FILE}...")
    df = pd.read_csv(DATA_FILE)
    print(f"Loaded {len(df)} orders")

    # Rename columns to match expected format
    df = df.rename(columns={
        'TerminalId': 'machine_sn',
        'CreateTime': 'log_datetime',
        'IsSuccess': 'operation_outcome',
        'PayAmount': 'transaction_amount',
        'DeliverCount': 'num_dispensed',
        'RefundAmount': 'refund_amount',
        'Fault': 'error_code'
    })

    # Convert types
    df['log_datetime'] = pd.to_datetime(df['log_datetime'])
    df['machine_sn'] = df['machine_sn'].astype(str)

    # Map IsSuccess values
    success_map = {
        'Success': 'Success',
        '成功': 'Success',
        True: 'Success',
        'true': 'Success',
        1: 'Success'
    }
    df['operation_outcome'] = df['operation_outcome'].map(lambda x: success_map.get(x, 'Failed'))

    # Fill missing values
    df['num_dispensed'] = pd.to_numeric(df['num_dispensed'], errors='coerce').fillna(0).astype(int)
    df['transaction_amount'] = pd.to_numeric(df['transaction_amount'], errors='coerce').fillna(0)
    df['refund_amount'] = pd.to_numeric(df['refund_amount'], errors='coerce').fillna(0)
    df['error_code'] = df['error_code'].fillna(0)

    # Filter out event machines
    df = df[~df['machine_sn'].isin(MACHINES_TO_DROP)]
    print(f"After filtering: {len(df)} orders")

    return df


def aggregate_daily(df):
    """
    Aggregate orders to TOTAL daily level (all machines combined).
    Daily window: 10:30 PM SGT Day X to 10:29 PM SGT Day X+1 -> labeled as Day X+1.
    """
    # Shift time and label by END date of the window
    df['adjusted_datetime'] = df['log_datetime'] - pd.Timedelta(hours=14, minutes=30)
    df['date'] = pd.to_datetime(df['adjusted_datetime'].dt.date) + pd.Timedelta(days=1)

    # Only count successful orders
    df_success = df[df['operation_outcome'] == 'Success']

    # Aggregate ALL machines together per day
    df_agg = df_success.groupby(['date']).agg(
        daily_sales=('num_dispensed', 'sum'),
        transactions=('num_dispensed', 'count'),
        total_amount=('transaction_amount', 'sum'),
        total_refund=('refund_amount', 'sum'),
        active_machines=('machine_sn', 'nunique')
    ).reset_index()

    # Add error count from all orders
    error_counts = df[df['error_code'] != 0].groupby(
        pd.to_datetime(df['adjusted_datetime'].dt.date) + pd.Timedelta(days=1)
    ).size().reset_index(name='error_count')
    error_counts.columns = ['date', 'error_count']

    df_agg = df_agg.merge(error_counts, on='date', how='left')
    df_agg['error_count'] = df_agg['error_count'].fillna(0)

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
    exclude_cols = ['machine_sn', 'date', TARGET_COL, 'devicename']
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
    print("Training model...")

    # Remove rows with NaN target
    df_train = df_features[~df_features[TARGET_COL].isnull()].copy()

    print(f"Training on {len(df_train)} days of data")

    X, encoder, numericals = prepare_features(df_train)
    y = df_train[TARGET_COL].values

    model = RandomForestRegressor(n_estimators=200, random_state=42, n_jobs=-1)
    model.fit(X, y)

    # Save model and encoder
    joblib.dump(model, MODEL_PATH)
    joblib.dump(encoder, ENCODER_PATH)

    print(f"Model saved to {MODEL_PATH}")
    print(f"Encoder saved to {ENCODER_PATH}")

    # Print feature importance
    feature_names = numericals + list(encoder.get_feature_names_out(['weekday', 'month']))
    importances = pd.DataFrame({
        'feature': feature_names,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)

    print("\nTop 10 feature importances:")
    print(importances.head(10).to_string(index=False))

    return model, encoder


def main():
    print(f"=== Sales Prediction Model Training ===")
    print(f"Started at {datetime.now()}")
    print()

    # Check data file exists
    if not DATA_FILE.exists():
        print(f"ERROR: Data file not found: {DATA_FILE}")
        print("Please ensure training_data.csv is in the same directory.")
        return

    # Load data
    df = load_training_data()

    # Aggregate daily
    print("\nAggregating to daily totals...")
    df_agg = aggregate_daily(df)
    print(f"Aggregated to {len(df_agg)} days")
    print(f"Date range: {df_agg['date'].min().date()} to {df_agg['date'].max().date()}")
    print(f"Average daily sales: {df_agg['daily_sales'].mean():.1f}")

    # Create features
    print("\nCreating features...")
    df_features = create_features(df_agg)

    # Train model
    print()
    model, encoder = train_model(df_features)

    print("\n=== Training Complete ===")
    print(f"Model file: {MODEL_PATH} ({MODEL_PATH.stat().st_size / 1024:.1f} KB)")
    print(f"Encoder file: {ENCODER_PATH} ({ENCODER_PATH.stat().st_size / 1024:.1f} KB)")


if __name__ == "__main__":
    main()
