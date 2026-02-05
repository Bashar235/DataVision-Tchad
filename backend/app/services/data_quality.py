import pandas as pd
import numpy as np

def detect_anomalies(df: pd.DataFrame):
    """
    Advanced Anomaly Detection using Pandas.
    - Z-Score calculation grouped by indicator and region.
    - Logical checks for negative values and percentages.
    """
    if df.empty:
        return []

    df = df.copy()
    
    # Ensure value is numeric for calculation
    df['value'] = pd.to_numeric(df['value'], errors='coerce')
    
    anomalies = []

    # 1. Z-Score Calculation Logic
    # Calculate Z-score grouped by indicator_name and region
    if 'indicator_name' in df.columns and 'region' in df.columns:
        groups = df.groupby(['indicator_name', 'region'])['value']
        
        # Calculate mean and std for each group
        df['group_mean'] = groups.transform('mean')
        df['group_std'] = groups.transform('std')
        
        # Calculate Z-score: (x - mu) / sigma
        # Handle division by zero if std is 0
        df['z_score'] = (df['value'] - df['group_mean']) / df['group_std']
        df['z_score'] = df['z_score'].replace([np.inf, -np.inf], np.nan).fillna(0)

        # High Severity (|z| > 3)
        extreme_outliers = df[df['z_score'].abs() > 3]
        for _, row in extreme_outliers.iterrows():
            anomalies.append({
                "row_id": int(row.get('id', 0)),
                "indicator": row.get('indicator_name'),
                "value": float(row.get('value')),
                "reason": "Extreme Outlier",
                "severity": "high",
                "suggested_fix": f"Value {row['value']} deviates significantly (Z={row['z_score']:.2f}) from regional average for {row['indicator_name']}."
            })

        # Medium Severity (|z| > 2)
        suspicious_values = df[(df['z_score'].abs() > 2) & (df['z_score'].abs() <= 3)]
        for _, row in suspicious_values.iterrows():
            anomalies.append({
                "row_id": int(row.get('id', 0)),
                "indicator": row.get('indicator_name'),
                "value": float(row.get('value')),
                "reason": "Suspicious Value",
                "severity": "medium",
                "suggested_fix": f"Value {row['value']} is statistically suspicious (Z={row['z_score']:.2f}). Please verify source data."
            })

    # 2. Logical Checks
    # Population/GDP cannot be negative
    logical_negative = df[
        ((df['indicator_name'].str.contains('Population', case=False, na=False)) | 
         (df['indicator_name'].str.contains('GDP', case=False, na=False))) & 
        (df['value'] < 0)
    ]
    for _, row in logical_negative.iterrows():
        anomalies.append({
            "row_id": int(row.get('id', 0)),
            "indicator": row.get('indicator_name'),
            "value": float(row.get('value')),
            "reason": "Negative Value",
            "severity": "high",
            "suggested_fix": "Verify sign or entry error; population and GDP must be positive."
        })

    # Percentage indicators > 100%
    percentage_indicators = df[
        (df['indicator_name'].str.contains('%', na=False) | 
         df['indicator_name'].str.contains('Rate', case=False, na=False)) & 
        (df['value'] > 100)
    ]
    for _, row in percentage_indicators.iterrows():
        anomalies.append({
            "row_id": int(row.get('id', 0)),
            "indicator": row.get('indicator_name'),
            "value": float(row.get('value')),
            "reason": "Value Exceeds 100%",
            "severity": "medium",
            "suggested_fix": "Percentage/Rate value exceeds 100%. Verify if this is intended or a scale error."
        })

    return anomalies
