"""
scenario_engine.py
==================
Unifies Researcher Scenario Engine with the Cleaned Database.
Performs "Pivot Transformation" and "Self-Healing" using National Averages.
"""
import pandas as pd
import logging
from typing import Optional, List, Dict
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.models import CleanedData
import uuid

logger = logging.getLogger(__name__)

# --- Technical Requirement 1: Synonym Mapping ---
INDICATOR_MAP = {
    "population totale": "Population_Total",
    "population_total": "Population_Total",
    "population": "Population_Total",
    "indice synthétique de fécondité": "ISF",
    "isf": "ISF",
    "isf_computed": "ISF",
    "contraception_rate": "Cc",
    "cc": "Cc",
    "prévalence contraceptive": "Cc",
    "marriage_rate": "Cm",
    "cm": "Cm",
    "femmes en union (15-49)": "Cm",
    "espérance de vie à la naissance": "e0",
    "e0": "e0",
    "taux de mortalité infantile": "TMI",
    "mortalité infantile": "TMI",
    "tmi": "TMI",
    "hiv_prev": "HIV_prev",
    "prévalence vih/sida": "HIV_prev",
    "turb": "Turb",
    "taux d'urbanisation": "Turb",
    "urbanization_rate": "Turb",
    "tbn": "TBN",
    "taux brut de natalité": "TBN",
    "tbm": "TBM",
    "taux brut de mortalité": "TBM",
    "taux d'accroissement naturel": "TAN",
    "taux brut de reproduction": "TBR",
    "taux de croissance": "Growth_Rate"
}

# The 10 core features expected by XGBoost/LSTM
FEATURE_COLS = ["ISF", "Cc", "Cm", "e0", "TMI", "HIV_prev", "Turb", "TBN", "TBM"]
TARGET_COL = "Population_Total"

def get_pivoted_data(db: Session, dataset_id: Optional[uuid.UUID] = None) -> pd.DataFrame:
    """
    Fetch long-format data from 'cleaned_data' and pivot into wide format.
    Includes Self-Healing logic using National Averages for zero/null values.
    """
    try:
        # 1. Query raw records
        query = db.query(CleanedData).filter(
            (CleanedData.age_group == "Total") | (CleanedData.age_group.is_(None))
        )
        if dataset_id:
            query = query.filter(CleanedData.dataset_id == dataset_id)
        
        records = query.all()
        if not records:
            logger.warning("ScenarioEngine: No records found for dataset_id: %s", dataset_id)
            return pd.DataFrame()

        # 2. Extract into flat list
        data = []
        for r in records:
            data.append({
                "year": r.year,
                "region": r.region,
                "indicator": r.indicator_name,
                "value": float(r.value) if r.value is not None else 0.0
            })
        
        df = pd.DataFrame(data)
        
        # 3. Pivot: turn indicators into columns
        df_wide = df.pivot_table(
            index=["year", "region"],
            columns="indicator",
            values="value",
            aggfunc="max"
        ).reset_index()
        # Flatten any MultiIndex columns to plain strings
        df_wide.columns = [str(c) for c in df_wide.columns]


        # 4. Standardize Column Names (Case-insensitive synonym mapping)
        cols = list(df_wide.columns)
        new_cols = []
        for col in cols:
            if col in ["year", "region"]:
                new_cols.append(col)
                continue
            standard = INDICATOR_MAP.get(str(col).lower().strip(), col)
            new_cols.append(standard)
        df_wide.columns = new_cols

        # 4b. Combine duplicate columns (e.g. if 'Population' and 'Population Totale' both existed)
        df_wide = df_wide.T.groupby(level=0).max().T


        # 5. Technical Requirement 2: Self-Healing with National Averages
        # Calculate national averages per year for all indicators found
        available_indicators = [c for c in (FEATURE_COLS + [TARGET_COL]) if c in df_wide.columns]
        
        # Heuristic to find 'National' records
        is_nat = df_wide["region"].str.lower().isin(["tchad", "national", "total"])
        national_df = df_wide[is_nat].copy()
        
        if national_df.empty:
            # Fallback: Average of all provinces
            national_avg = df_wide.groupby("year")[available_indicators].mean().reset_index()
        else:
            national_avg = national_df.groupby("year")[available_indicators].mean().reset_index()

        # Apply Self-Healing to every core indicator
        for indicator in (FEATURE_COLS + [TARGET_COL]):
            # A. Ensure column exists
            if indicator not in df_wide.columns:
                df_wide[indicator] = 0.0
            
            # B. Join with national average for that year
            if indicator in national_avg.columns:
                df_wide = df_wide.merge(national_avg[["year", indicator]], on="year", how="left", suffixes=("", "_avg"))
                
                # Replace 0 or Null with national average
                import numpy as np
                mask = (df_wide[indicator] == 0) | (df_wide[indicator].isna())
                df_wide[indicator] = np.where(mask, df_wide[indicator + "_avg"], df_wide[indicator])
                
                # Cleanup helper column
                df_wide = df_wide.drop(columns=[indicator + "_avg"])
            else:
                # If even national average is missing, use a safe default
                defaults = {
                    "ISF": 6.0, "Cc": 15.0, "Cm": 70.0, "e0": 55.0, "TMI": 80.0,
                    "HIV_prev": 1.5, "Turb": 25.0, "TBN": 40.0, "TBM": 14.0,
                    "Population_Total": 0.0
                }
                df_wide[indicator] = df_wide[indicator].fillna(defaults.get(indicator, 0.0))

        # 6. Final Clean up and return
        df_wide = df_wide.fillna(0.0)
        return df_wide

    except Exception as e:
        logger.error("ScenarioEngine: Critical failure during pivot: %s", e, exc_info=True)
        return pd.DataFrame()
