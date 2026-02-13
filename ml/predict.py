#!/usr/bin/env python3
"""
Stock Prediction Script - Matches Vendify.ipynb deployment logic
Takes historical sales data and predicts next day sales per machine
"""
import sys
import json
import joblib
import pandas as pd
import numpy as np
from datetime import datetime, timedelta

def prepare_features_and_predict(df_raw, model_path, predict_date=None):
    """
    Prepare features from raw sales data and predict next day sales.

    Args:
        df_raw: DataFrame with columns [device_id, date, sold] - daily sales per machine
        model_path: Path to the trained model
        predict_date: Date to predict for (default: day after last date in data)

    Returns:
        Dictionary with predictions per machine and total
    """
    # Load model
    model_data = joblib.load(model_path)
    model = model_data['model']
    feature_cols = model_data['feature_cols']

    # Ensure date is datetime
    df = df_raw.copy()
    df['date'] = pd.to_datetime(df['date'])
    df = df.sort_values(['device_id', 'date'])

    # Determine prediction date
    last_date = df['date'].max()
    if predict_date is None:
        predict_date = last_date + timedelta(days=1)
    else:
        predict_date = pd.to_datetime(predict_date)

    # Create features per machine
    MACHINE_COL = 'device_id'
    target_col = 'sold'

    df_features = df.copy()
    df_features['day'] = df_features['date'].dt.day
    df_features['weekday'] = df_features['date'].dt.weekday
    df_features['month'] = df_features['date'].dt.month
    df_features['is_weekend'] = (df_features['weekday'] >= 5).astype(int)

    # Rolling features per machine
    WINDOWS = [3, 7, 14]
    for w in WINDOWS:
        df_features[f'rolling_avg_{w}'] = df_features.groupby(MACHINE_COL)[target_col].transform(
            lambda x: x.rolling(window=w, min_periods=1).mean()
        )
        df_features[f'rolling_std_{w}'] = df_features.groupby(MACHINE_COL)[target_col].transform(
            lambda x: x.rolling(window=w, min_periods=1).std().fillna(0)
        )

    # Lag features
    for lag in [1, 7]:
        df_features[f'lag_{lag}'] = df_features.groupby(MACHINE_COL)[target_col].shift(lag)

    # Fill NA lags with 0
    lag_cols = [c for c in df_features.columns if c.startswith('lag_')]
    df_features[lag_cols] = df_features[lag_cols].fillna(0)

    # Get last row per machine (most recent day's data)
    last_rows = df_features.groupby(MACHINE_COL).apply(
        lambda g: g.sort_values('date').iloc[-1]
    ).reset_index(drop=True)

    # Update features for prediction date
    last_rows['weekday'] = predict_date.weekday()
    last_rows['month'] = predict_date.month
    last_rows['day_of_month'] = predict_date.day
    last_rows['is_weekend'] = 1 if predict_date.weekday() >= 5 else 0

    # For lag_1, use the last day's sales (which is in 'sold' column of last_rows)
    last_rows['lag_1'] = last_rows[target_col]

    # Prepare feature matrix
    predictions = []

    for _, row in last_rows.iterrows():
        device_id = row[MACHINE_COL]

        # Build feature dict
        features = {
            'weekday': row['weekday'],
            'month': row['month'],
            'day_of_month': row.get('day_of_month', predict_date.day),
            'is_weekend': row['is_weekend'],
            'lag_1': row['lag_1'],
            'lag_7': row.get('lag_7', 0),
            'rolling_avg_3': row.get('rolling_avg_3', row[target_col]),
            'rolling_avg_7': row.get('rolling_avg_7', row[target_col]),
            'rolling_avg_14': row.get('rolling_avg_14', row[target_col]),
            'rolling_std_7': row.get('rolling_std_7', 0),
        }

        # Create feature vector
        X = pd.DataFrame([features])

        # Add device dummy columns (all 0 except for this device if it exists)
        for col in feature_cols:
            if col not in X.columns:
                if col == f'device_{device_id}':
                    X[col] = 1
                else:
                    X[col] = 0

        # Reorder to match training
        X = X[feature_cols]

        # Predict
        pred = max(0, round(model.predict(X)[0]))

        predictions.append({
            'device_id': str(device_id),
            'last_date': row['date'].strftime('%Y-%m-%d'),
            'last_sold': int(row[target_col]),
            'predicted': pred
        })

    # Calculate total
    total_predicted = sum(p['predicted'] for p in predictions)

    return {
        'success': True,
        'predict_date': predict_date.strftime('%Y-%m-%d'),
        'based_on_date': last_date.strftime('%Y-%m-%d'),
        'total_predicted': total_predicted,
        'machines': len(predictions),
        'predictions_per_machine': predictions
    }


def main():
    try:
        # Read input from stdin
        input_data = json.loads(sys.stdin.read())

        model_path = input_data.get('model_path')
        historical_data = input_data.get('historical_data', [])
        predict_date = input_data.get('predict_date', None)

        if not historical_data:
            print(json.dumps({'error': 'No historical data provided', 'success': False}))
            sys.exit(1)

        # Convert to DataFrame
        df = pd.DataFrame(historical_data)

        # Required columns: device_id, date, sold
        if 'device_id' not in df.columns:
            # If no device_id, assume aggregated data - create dummy device
            df['device_id'] = 'all'

        result = prepare_features_and_predict(df, model_path, predict_date)
        print(json.dumps(result))

    except Exception as e:
        import traceback
        print(json.dumps({
            'error': str(e),
            'traceback': traceback.format_exc(),
            'success': False
        }))
        sys.exit(1)


if __name__ == '__main__':
    main()
