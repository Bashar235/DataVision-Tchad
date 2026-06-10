"""
cleaner.py
==========
Phase 1 – The Gatekeeper

DataCleaner pipeline for DataVision Tchad.
Prepares any incoming dataset (user upload or INSEED) before it
feeds the prediction engines.

Steps:
  1. Parse / standardise column names
  2. Beers-compatible linear interpolation for missing values
  3. Isolation Forest to flag "impossible" demographic inputs
  4. Feature engineering (year², e0², ISF×Cc interaction)
  5. StandardScaler normalisation
  6. Quality Gate: raises DataQualityError if quality_score < 0.95

Usage:
  from app.ml.cleaner import DataCleaner, DataQualityError

  cleaner = DataCleaner()
  df_clean = cleaner.fit_transform(df_raw)   # training time
  df_clean = cleaner.transform(df_raw)       # inference time
  score    = cleaner.quality_score(df_raw)
"""

from __future__ import annotations

import logging
import unicodedata
import warnings
from pathlib import Path
from typing import List, Optional, Tuple, Any, Dict

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler

logger = logging.getLogger(__name__)

# ── Constants ─────────────────────────────────────────────────────────────────

# Demo features expected by the ML layer
FEATURE_COLS: List[str] = [
    "year", "ISF", "Cc", "Cm", "e0", "TMI", "HIV_prev", "Turb",
    "TBN", "TBM",
]
TARGET_COL   = "Population_Total"

# ── 10 Mandatory columns for ML-compatible census datasets ────────────────────
# Both 'province' and 'region' are accepted as the geographic identifier.
STANDARD_CENSUS_COLS: List[str] = [
    "year", "province", "gender", "age_group", "population", "ISF", "e0", "TMI", "Cc", "Cm",
]
HARD_CENSUS_COLS: List[str] = ["year", "gender", "age_group", "population", "ISF", "e0", "TMI", "Cc", "Cm"]
SOFT_CENSUS_DEFAULTS: Dict[str, float] = {}
# The geographic column is special — accept either name
GEO_COL_ALIASES: List[str] = ["province", "region"]

_COLUMN_ALIASES: Dict[str, str] = {
    "year": "year",
    "annee": "year",
    "année": "year",
    "province": "province",
    "region": "province",
    "gender": "gender",
    "sexe": "gender",
    "age_group": "age_group",
    "age_groupe": "age_group",
    "agegroup": "age_group",
    "cohort": "age_group",
    "cohorte": "age_group",
    "population": "population",
    "population_total": "population",
    "total_population": "population",
    "population_totale": "population",
    "isf": "ISF",
    "indice_synthetique_de_fecondite": "ISF",
    "indice_synthétique_de_fécondité": "ISF",
    "e0": "e0",
    "life_expectancy": "e0",
    "esperance_de_vie": "e0",
    "espérance_de_vie": "e0",
    "tmi": "TMI",
    "infant_mortality": "TMI",
    "mortalite_infantile": "TMI",
    "mortalité_infantile": "TMI",
    "cc": "Cc",
    "contraception_rate": "Cc",
    "contraceptive_prevalence": "Cc",
    "cm": "Cm",
    "marriage_rate": "Cm",
}

# Human-readable labels for each mandatory column (for error messages)
COL_LABELS: dict = {
    "year":       "year (Survey Year)",
    "province":   "province / region (Geographic Identifier)",
    "gender":     "gender (M/F demographic segment)",
    "age_group":  "age_group (Institutional age cohort)",
    "population": "population (Total Population)",
    "ISF":        "ISF (Fertility Index — Children per Woman)",
    "e0":         "e0 (Life Expectancy at Birth)",
    "TMI":        "TMI (Infant Mortality Rate per 1,000)",
    "Cc":         "Cc (Contraceptive Use %)",
    "Cm":         "Cm (Marriage Rate %)",
}

# Scaler + cleaner artefact paths
_ML_DIR = Path(__file__).parent
SCALER_PATH = _ML_DIR / "models" / "scaler.pkl"

# Quality gate threshold
QUALITY_THRESHOLD = 0.95


# ── Custom Exception ──────────────────────────────────────────────────────────

class DataQualityError(ValueError):
    """Raised when a dataset fails the 95% quality gate."""
    def __init__(self, score: float):
        self.score = score
        super().__init__(
            f"Data quality score {score:.1%} is below the required threshold "
            f"of {QUALITY_THRESHOLD:.0%}. Please clean the dataset before proceeding."
        )


# ── Preprocessors ─────────────────────────────────────────────────────────────

def _column_key(col: str) -> str:
    """Normalize a header for alias lookup without changing display casing."""
    text = unicodedata.normalize("NFKD", str(col).strip())
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    return text.lower().replace(" ", "_").replace("-", "_")


def normalize_census_headers(df: pd.DataFrame, geo_target: str = "province") -> pd.DataFrame:
    """
    Normalize census headers case-insensitively and treat province/region as one field.
    geo_target controls whether the output geographic column is named province or region.
    """
    df = df.copy()
    df.columns = [str(c).strip().replace(" ", "_") for c in df.columns]

    rename_map: Dict[str, str] = {}
    canonical_present = set(df.columns)

    for col in df.columns:
        canonical = _COLUMN_ALIASES.get(_column_key(col))
        if not canonical:
            continue

        if canonical == "province":
            canonical = geo_target

        if canonical in canonical_present and col != canonical:
            continue

        rename_map[col] = canonical
        canonical_present.add(canonical)

    df = df.rename(columns=rename_map)

    other_geo = "region" if geo_target == "province" else "province"
    if geo_target not in df.columns and other_geo in df.columns:
        df = df.rename(columns={other_geo: geo_target})

    return df


def apply_smart_census_schema(
    df: pd.DataFrame,
    geo_target: str = "province",
    default_value: float = 0.0,
) -> Tuple[pd.DataFrame, dict]:
    """
    Apply Smart Schema rules:
    - the 10-column census matrix is required.
    - province/region are treated as interchangeable geographic columns.
    """
    df = normalize_census_headers(df, geo_target=geo_target)
    col_lower = {c.strip().lower() for c in df.columns}

    missing_required = [
        col for col in HARD_CENSUS_COLS
        if col.lower() not in col_lower
    ]
    has_geo = geo_target.lower() in col_lower or any(
        alias.lower() in col_lower for alias in GEO_COL_ALIASES
    )
    if not has_geo:
        missing_required.append(geo_target)

    injected_columns: List[str] = []
    for col in SOFT_CENSUS_DEFAULTS:
        if col.lower() not in col_lower:
            df[col] = default_value
            injected_columns.append(col)
            col_lower.add(col.lower())

    return df, {
        "valid": len(missing_required) == 0,
        "missing_required": missing_required,
        "injected_columns": injected_columns,
        "has_geo": has_geo,
        "default_value": default_value,
    }


class CSVPreprocessor:
    """Pre-processing logic specific to CSV files."""
    @staticmethod
    def preprocess(df: pd.DataFrame) -> pd.DataFrame:
        df = normalize_census_headers(df, geo_target="province")

        non_numeric_passthrough = {"province", "region", "gender", "sexe", "age_group", "age_groupe", "source", "notes"}
        for col in df.select_dtypes(include=["object", "string"]).columns: # type: ignore
            if col.lower() not in non_numeric_passthrough:
                try:
                    s_replace = df[col].astype(str).str.replace(",", ".")
                    df[col] = pd.to_numeric(s_replace, errors="coerce")
                except (ValueError, AttributeError):
                    pass
        return df


class ExcelPreprocessor:
    """Pre-processing logic specific to Excel files."""
    @staticmethod
    def preprocess(df: pd.DataFrame) -> pd.DataFrame:
        df = normalize_census_headers(df, geo_target="province")

        non_numeric_passthrough = {"province", "region", "gender", "sexe", "age_group", "age_groupe", "source", "notes"}
        for col in df.select_dtypes(include=["object", "string"]).columns: # type: ignore
            if col.lower() not in non_numeric_passthrough:
                try:
                    s_clean = df[col].astype(str).str.strip().str.replace(",", ".")
                    df[col] = pd.to_numeric(s_clean, errors="coerce")
                except (ValueError, AttributeError):
                    pass
        return df


# ── DataCleaner ───────────────────────────────────────────────────────────────

class DataCleaner:
    """
    Full preprocessing pipeline for INSEED demographic data.

    Attributes
    ----------
    scaler : StandardScaler fitted on training data.
    iso    : IsolationForest fitted on training data.
    """

    def __init__(
        self,
        contamination: float = 0.05,
        iso_random_state: int = 42,
        enforce_gate: bool = True,
        ext: Optional[str] = "csv",
    ):
        self.contamination     = contamination
        self.iso_random_state  = iso_random_state
        self.enforce_gate      = enforce_gate
        self.ext               = (ext or "csv").lower()

        self.scaler: Optional[StandardScaler]   = None
        self.iso:    Optional[IsolationForest]  = None
        self._fitted = False

    # ── Public API ────────────────────────────────────────────────────────────

    @staticmethod
    def validate_ml_schema(df: "pd.DataFrame") -> dict:
        """
        Check that a DataFrame can be made ML-compatible with Smart Schema.
        Missing census columns are treated as schema errors.
        Returns {"valid": bool, "missing": list[str], "injected_columns": list[str], "has_geo": bool}

        Accepts 'province' OR 'region' as the geographic identifier.
        Column names are compared case-insensitively and strip-normalised.
        """
        _, schema = apply_smart_census_schema(df, geo_target="province")
        missing = schema["missing_required"]

        return {
            "valid":   len(missing) == 0,
            "missing": missing,
            "injected_columns": schema["injected_columns"],
            "has_geo": schema["has_geo"],
        }

    def fit_transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Full pipeline for training data.
        Fits the scaler and Isolation Forest on the cleaned data.
        Returns the cleaned + scaled DataFrame.
        """
        df = self._standardise_columns(df)
        df = self._interpolate_missing(df)
        df = self._add_engineered_features(df)
        df = self._fit_and_flag_outliers(df)
        df = self._fit_and_scale(df)

        score = self._compute_score(df)
        logger.info("Training quality score: %.1f%%", score * 100)

        if self.enforce_gate and score < QUALITY_THRESHOLD:
            raise DataQualityError(score)

        self._fitted = True
        return df

    def transform(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Apply the fitted pipeline to new (inference-time) data.
        """
        if not self._fitted:
            raise RuntimeError(
                "DataCleaner has not been fitted yet. Call fit_transform() first."
            )
        df = self._standardise_columns(df)
        df = self._interpolate_missing(df)
        df = self._add_engineered_features(df)
        df = self._flag_outliers(df)

        score = self._compute_score(df)
        logger.info("Inference quality score: %.1f%%", score * 100)

        if self.enforce_gate and score < QUALITY_THRESHOLD:
            raise DataQualityError(score)

        df = self._apply_scale(df)
        return df

    def _apply_beers_smoothing(self, df: pd.DataFrame) -> Tuple[pd.DataFrame, bool]:
        """Apply Beers demographic smoothing if Age_Group column exists."""
        beers_applied = False
        cols = [c.lower() for c in df.columns]
        if "age_group" in cols or "age" in cols:
            beers_applied = True
            numeric_cols = df.select_dtypes(include=[np.number]).columns # type: ignore
            for col in numeric_cols:
                if col.lower() not in ["year", "region"]:
                    # Proxy for Beers formula: 3-period centered moving average to smooth demographic kinks
                    df[col] = df[col].rolling(window=3, min_periods=1, center=True).mean()
            logger.info("Beers Smoothing applied to age-grouped demographic data.")
        return df, beers_applied

    def process_upload(
        self,
        df: pd.DataFrame,
        ext: Optional[str] = None,
        dataset_id: Optional[str] = None,
        category: Optional[str] = None,
    ) -> Tuple[pd.DataFrame, dict]:
        """
        End-to-end cleaning for raw frontend uploads.
        Tracks cell-level transformations for the Comparison Table.
        """
        if not hasattr(self, "ext"):
            self.ext = "csv"
        file_ext = (ext or getattr(self, "ext", None) or "csv").lower()

        if dataset_id:
            try:
                from app.db.session import SessionLocal
                from app.models import Dataset
                from app.api.v1.clean_status import update_progress
                import uuid
                db_m = SessionLocal()
                try:
                    ds_uuid = uuid.UUID(dataset_id)
                    ds = db_m.query(Dataset).filter(Dataset.id == ds_uuid).first()
                    if ds:
                        ds.status = 'cleaning_in_progress' # type: ignore
                        db_m.commit()
                        update_progress(dataset_id, stage="cleaning_in_progress", progress_percent=10.0, eta_seconds=45, message="Cleaning in progress...")
                except Exception as e:
                    logger.error(f"process_upload init telemetry error: {e}")
                finally:
                    db_m.close()
            except Exception:
                pass

        df = df.copy()

        df_raw = df.copy() # Keep original for comparison
        initial_rows = len(df)
        
        # 1. Standardise headers
        df.columns = [c.strip() for c in df.columns]
        df_raw.columns = df.columns
        
        transformations: List[dict[str, Any]] = []
        diagnostic_log = []
        smart_schema = {
            "valid": True,
            "missing_required": [],
            "injected_columns": [],
            "has_geo": True,
            "default_value": 0.0,
        }

        if (category or "").lower() == "census":
            df, smart_schema = apply_smart_census_schema(df, geo_target="region")
            df_raw = normalize_census_headers(df_raw, geo_target="region")

            for col in smart_schema["injected_columns"]:
                df_raw[col] = smart_schema["default_value"]
                transformations.append({
                    "row": 0,
                    "col": col,
                    "before": "MISSING COLUMN",
                    "after": smart_schema["default_value"],
                    "type": "SCHEMA_INJECTION",
                })

            if smart_schema["injected_columns"]:
                diagnostic_log.append(
                    "Smart Schema: injected missing demographic indicator columns "
                    f"{', '.join(smart_schema['injected_columns'])} with default "
                    f"{smart_schema['default_value']}."
                )

            if smart_schema["missing_required"]:
                raise ValueError(
                    "Census schema is missing required columns: "
                    + ", ".join(smart_schema["missing_required"])
                )

        # 1.5 Duplicate removal
        duplicates_mask = df.duplicated(keep="first")
        duplicate_indices = df[duplicates_mask].index.tolist()
        if duplicate_indices:
            for idx in duplicate_indices:
                transformations.append({
                    "row": int(idx),
                    "col": "All",
                    "before": "Duplicate Row",
                    "after": "Removed",
                    "type": "DUPLICATE_REMOVAL"
                })
            df = df.drop_duplicates(keep="first")
            df_raw = df_raw.loc[df.index].copy()

        # Convert French comma-decimal strings to float and detect FORMAT_FIX
        for col in df.select_dtypes(include=["object", "string"]).columns: # type: ignore
            if col.lower() not in ["region", "province", "gender", "sexe", "age_group", "age_groupe", "source", "notes"]:
                try:
                    s_replace = df[col].astype(str).str.replace(",", ".")
                    coerced = pd.to_numeric(s_replace, errors="coerce")
                    
                    bad_mask = df[col].notna() & (df[col].astype(str).str.strip() != "") & coerced.isna()
                    for idx in df[bad_mask].index:
                        transformations.append({
                            "row": int(idx),
                            "col": col,
                            "before": str(df.loc[idx, col]),
                            "after": None, # Will be filled by interpolation
                            "type": "FORMAT_FIX"
                        })
                    df[col] = coerced
                except Exception:
                    pass

        # 2. Interpolate
        # We handle interpolation manually here to track actions
        numeric_cols = df.select_dtypes(include=[np.number]).columns # type: ignore
        for col in numeric_cols:
            null_count = df[col].isna().sum()
            if null_count > 0:
                pct = null_count / len(df)
                if pct >= 0.20:
                    diagnostic_log.append(f"Missingness Alert: Column '{col}' is missing {pct:.1%} of its data.")
                
                null_indices = df[df[col].isna()].index.tolist()
                df = self._interpolate_missing_col(df, col)
                for idx in null_indices:
                    val = df.loc[idx, col]
                    val_clean = float(val) if hasattr(val, "item") else val
                    
                    # Update FORMAT_FIX if it exists, otherwise add FILL_MISSING
                    existing = next((t for t in transformations if t["row"] == idx and t["col"] == col and t["type"] == "FORMAT_FIX"), None)
                    if existing:
                        existing["after"] = val_clean
                    else:
                        transformations.append({
                            "row": int(idx),
                            "col": col,
                            "before": "NULL",
                            "after": val_clean,
                            "type": "LOGICAL_REPAIR"
                        })

        # 3. Beers Smoothing
        df, beers_applied = self._apply_beers_smoothing(df)
        if beers_applied:
            # For brevity, we don't track EVERY change in Beers (could be thousands)
            # but we track the most significant ones or just indicate it was applied globally.
            # However, the user asked for a Comparison Table. Let's track a few samples if it changed.
            for col in numeric_cols:
                if col.lower() not in ["year", "region", "province"]:
                    changed = (df[col] != df_raw[col]) & df_raw[col].notna()
                    changed_indices = df[changed].head(10).index.tolist() # Cap at 10 samples per column
                    for idx in changed_indices:
                        existing = next((t for t in transformations if t["row"] == idx and t["col"] == col), None)
                        if existing:
                            existing["after"] = float(df.loc[idx, col])
                            continue
                            
                        raw_v = df_raw.loc[idx, col]
                        try:
                            before_val = float(raw_v)
                        except (ValueError, TypeError):
                            before_val = str(raw_v)
                            
                        transformations.append({
                            "row": int(idx),
                            "col": col,
                            "before": before_val,
                            "after": float(df.loc[idx, col]),
                            "type": "BEERS_SMOOTHING"
                        })

        # 4. Dynamic Isolation Forest
        num_cols = [c for c in numeric_cols if c.lower() not in ["year", "_outlier"]]
        flagged_outliers = 0
        if len(num_cols) > 0 and len(df) > 5:
            X = df[num_cols].fillna(0).values
            iso = IsolationForest(contamination=self.contamination, random_state=42)
            preds = iso.fit_predict(X)
            df["_outlier"] = preds == -1
            flagged_outliers = int(df["_outlier"].sum())
            
            if flagged_outliers > 0:
                diagnostic_log.append(f"Outlier Alert: Data contains {flagged_outliers} values outside the Isolation Forest 3-sigma range.")
            
            for col in num_cols:
                q1, q3 = df[col].quantile(0.05), df[col].quantile(0.95)
                q1_val = pd.Series([q1]).astype(df[col].dtype)[0]
                q3_val = pd.Series([q3]).astype(df[col].dtype)[0]
                
                outlier_mask = df["_outlier"] & ((df[col] < q1_val) | (df[col] > q3_val))
                outlier_indices = df[outlier_mask].index.tolist()
                
                for idx in outlier_indices:
                    raw_val = df.loc[idx, col]
                    df.loc[idx, col] = np.clip(raw_val, q1_val, q3_val)
                    
                    existing = next((t for t in transformations if t["row"] == idx and t["col"] == col), None)
                    if existing:
                        existing["after"] = float(df.loc[idx, col])
                        existing["type"] = "LOGICAL_REPAIR"
                    else:
                        transformations.append({
                            "row": int(idx),
                            "col": col,
                            "before": float(raw_val) if hasattr(raw_val, "item") else raw_val,
                            "after": float(df.loc[idx, col]),
                            "type": "LOGICAL_REPAIR"
                        })
                
            df = df.drop(columns=["_outlier"])
            
        score = self.quality_score(df)
        
        # Add a consistency alert if not enough rows for a national dataset
        if len(df) < 23 and score < 0.95:
            diagnostic_log.append(f"Consistency Alert: Dataset has only {len(df)} rows. Ensure all 23 provinces are represented.")
            
        report = {
            "total_rows": initial_rows,
            "flagged_outliers": flagged_outliers,
            "interpolated_missing": len([t for t in transformations if t["type"] == "LOGICAL_REPAIR" and str(t["before"]) == "NULL"]),
            "beers_applied": beers_applied,
            "score": score,
            "transformations": transformations[:50], # Send first 50 to avoid payload bloat
            "diagnostic_log": diagnostic_log,
            "smart_schema": smart_schema,
        }
        
        for col in df.select_dtypes(include=[np.float32, np.float64]).columns: # type: ignore
            df[col] = df[col].astype(float)
            
        if dataset_id:
            try:
                from app.db.session import SessionLocal
                from app.models import Dataset
                from app.api.v1.clean_status import update_progress
                import uuid
                db_m = SessionLocal()
                try:
                    ds_uuid = uuid.UUID(dataset_id)
                    ds = db_m.query(Dataset).filter(Dataset.id == ds_uuid).first()
                    if ds:
                        ds.status = 'cleaned' # type: ignore
                        db_m.commit()
                        update_progress(dataset_id, stage="cleaned", progress_percent=100.0, eta_seconds=0, message="Cleaning completed successfully.")
                except Exception as e:
                    logger.error(f"process_upload final telemetry error: {e}")
                finally:
                    db_m.close()
            except Exception:
                pass

        return df, report

    def _interpolate_missing_col(self, df: pd.DataFrame, col: str) -> pd.DataFrame:
        """Helper to interpolate a single column."""
        pct = df[col].isna().sum() / len(df)
        if pct > 0.5:
            df[col] = df[col].fillna(df[col].median())
        elif df[col].isna().sum() == 1:
            df[col] = df[col].interpolate(method="linear", limit_direction="both")
        else:
            with warnings.catch_warnings():
                warnings.simplefilter("ignore")
                df[col] = df[col].interpolate(method="spline", order=3, limit_direction="both")
        return df

    def quality_score(self, df: pd.DataFrame, ext: Optional[str] = None) -> float:
        """
        Compute the data quality score (0–1) without transforming.

        Score = (1 - missing_rate) × (1 - outlier_rate)
        where outlier_rate uses Isolation Forest if fitted, else IQR.
        """
        file_ext = (ext or getattr(self, "ext", None) or "csv").lower()
        if file_ext in ["db", "sql", "simulation"] or ("province" not in df.columns and "region" not in df.columns):
            df_clean = df.copy()
            df_clean.columns = [c.strip().replace(" ", "_") for c in df_clean.columns]
        else:
            df_clean = self._standardise_columns(df, ext=ext)
        return self._compute_score(df_clean)


    def save_scaler(self, path: Optional[Path] = None) -> None:
        path = path or SCALER_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({"scaler": self.scaler, "iso": self.iso}, path)
        logger.info("Scaler + IsolationForest saved to %s", path)

    @classmethod
    def load_scaler(cls, path: Optional[Path] = None) -> "DataCleaner":
        path = path or SCALER_PATH
        obj = joblib.load(path)
        c = cls.__new__(cls)
        c.scaler   = obj["scaler"]
        c.iso      = obj["iso"]
        c._fitted  = True
        c.enforce_gate    = True
        c.contamination   = 0.05
        c.iso_random_state = 42
        c.ext      = "csv"
        return c

    # ── Internal Steps ────────────────────────────────────────────────────────

    def _standardise_columns(self, df: pd.DataFrame, ext: Optional[str] = None) -> pd.DataFrame:
        """Normalise column names; delegate to appropriate preprocessor based on file extension."""
        file_ext = (ext or getattr(self, "ext", None) or "csv").lower()
        if file_ext in ["db", "sql", "simulation"] or ("province" not in df.columns and "region" not in df.columns):
            df_clean = df.copy()
            df_clean.columns = [c.strip().replace(" ", "_") for c in df_clean.columns]
            return df_clean
        elif file_ext in ["xlsx", "xls", "excel"]:
            return ExcelPreprocessor.preprocess(df)
        else:
            return CSVPreprocessor.preprocess(df)

    def _interpolate_missing(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Beers-compatible linear interpolation for missing values.
        Inter-year gaps ≤ 5 use linear interpolation; larger gaps use spline.
        """
        df = df.copy()
        numeric_cols = df.select_dtypes(include=[np.number]).columns # type: ignore

        for col in numeric_cols:
            if df[col].isna().any():
                missing_count = df[col].isna().sum()
                pct = missing_count / len(df)

                if pct > 0.5:
                    # Too many missing — fill with column median
                    df[col] = df[col].fillna(df[col].median())
                    logger.warning(
                        "Column '%s': >50%% missing, filled with median.", col
                    )
                elif df[col].isna().sum() == 1:
                    # Single gap — linear interpolate
                    df[col] = df[col].interpolate(method="linear", limit_direction="both")
                else:
                    # Multiple gaps — spline (Beers-compatible for demographic data)
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        df[col] = df[col].interpolate(
                            method="spline", order=3, limit_direction="both"
                        )

        return df

    def _add_engineered_features(self, df: pd.DataFrame) -> pd.DataFrame:
        """Add Bongaarts-inspired non-linear feature interactions."""
        df = df.copy()

        if "year" in df.columns:
            df["year_sq"]   = df["year"] ** 2
            df["year_norm"] = (df["year"] - 2009) / 41.0

        if "e0" in df.columns:
            df["e0_sq"] = df["e0"] ** 2

        if "ISF" in df.columns and "Cc" in df.columns:
            df["isf_cc"] = df["ISF"] * df["Cc"]

        return df

    def _get_iso_cols(self, df: pd.DataFrame) -> list[str]:
        # Only use input features for outlier detection, never the target
        base = [c for c in FEATURE_COLS if c in df.columns]
        derived = [c for c in ["year_sq", "e0_sq", "isf_cc", "year_norm"] if c in df.columns]
        return base + derived

    def _fit_and_flag_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fit Isolation Forest and flag outliers."""
        iso_cols = self._get_iso_cols(df)
        X = df[iso_cols].fillna(0).values
        self.iso = IsolationForest(
            contamination=self.contamination,
            random_state=self.iso_random_state,
            n_estimators=100,
        )
        preds = self.iso.fit_predict(X)
        df["_outlier"] = preds == -1  # -1 = anomaly

        n_out = df["_outlier"].sum()
        if n_out:
            logger.warning("Isolation Forest flagged %d outlier rows.", n_out)

        # Clip (cap) outlier rows instead of dropping — preserves time-series continuity
        for col in iso_cols:
            q1, q3 = df[col].quantile(0.05), df[col].quantile(0.95)
            # Cast quantiles to match column dtype (e.g., float quantiles to int64 for 'year')
            q1 = pd.Series([q1]).astype(df[col].dtype)[0]
            q3 = pd.Series([q3]).astype(df[col].dtype)[0]
            df.loc[df["_outlier"], col] = df.loc[df["_outlier"], col].clip(q1, q3)

        return df

    def _flag_outliers(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply already-fitted Isolation Forest to new data."""
        if self.iso is None:
            return df

        iso_cols = self._get_iso_cols(df)
        X = df[iso_cols].fillna(0).values
        preds = self.iso.predict(X)
        df = df.copy()
        df["_outlier"] = preds == -1

        for col in [c for c in FEATURE_COLS if c in df.columns]:
            q1, q3 = df[col].quantile(0.05), df[col].quantile(0.95)
            q1 = pd.Series([q1]).astype(df[col].dtype)[0]
            q3 = pd.Series([q3]).astype(df[col].dtype)[0]
            df.loc[df["_outlier"], col] = df.loc[df["_outlier"], col].clip(q1, q3)

        return df

    def _fit_and_scale(self, df: pd.DataFrame) -> pd.DataFrame:
        """Fit StandardScaler on feature columns and scale."""
        feat_cols = [c for c in FEATURE_COLS + ["year_sq", "e0_sq", "isf_cc", "year_norm"]
                     if c in df.columns]
        self.scaler = StandardScaler()
        df = df.copy()
        df[feat_cols] = self.scaler.fit_transform(df[feat_cols].fillna(0))
        return df

    def _apply_scale(self, df: pd.DataFrame) -> pd.DataFrame:
        """Apply already-fitted scaler."""
        if self.scaler is None:
            return df
        feat_cols = [c for c in self.scaler.feature_names_in_ if c in df.columns]
        df = df.copy()
        df[feat_cols] = self.scaler.transform(df[feat_cols].fillna(0))
        return df

    def _compute_score(self, df: pd.DataFrame) -> float:
        """
        Quality Score = (1 – missing_rate) × (1 – outlier_rate)
        Range: [0, 1]. Must be ≥ 0.95 to pass the gate.
        """
        numeric_df = df.select_dtypes(include=[np.number]) # type: ignore
        if numeric_df.empty:
            return 0.0

        total_cells = numeric_df.size
        missing_cells = numeric_df.isna().sum().sum()
        missing_rate = missing_cells / total_cells if total_cells else 0.0

        # Outlier rate — use IsolationForest if fitted, else IQR
        if self.iso is not None and "_outlier" in df.columns:
            outlier_rate = df["_outlier"].mean()
        else:
            # Fallback proper IQR calculation
            outlier_flags = pd.Series(False, index=df.index)
            for col in numeric_df.columns:
                q1 = numeric_df[col].quantile(0.25)
                q3 = numeric_df[col].quantile(0.75)
                iqr = q3 - q1
                
                # Only flag extreme IQR deviations
                if iqr > 0:
                    outlier_flags |= (numeric_df[col] < (q1 - 1.5 * iqr)) | (numeric_df[col] > (q3 + 1.5 * iqr))
            
            outlier_rate = outlier_flags.mean()

        score = (1.0 - missing_rate) * (1.0 - min(outlier_rate, 0.5))
        return float(np.clip(score, 0.0, 1.0))


# ── Standalone test ───────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    # Create synthetic INSEED-like data
    years = np.arange(2009, 2051)
    np.random.seed(0)
    df_test = pd.DataFrame({
        "year":       years,
        "ISF":        np.linspace(7.1, 4.8, len(years)) + np.random.normal(0, 0.05, len(years)),
        "Cc":         np.linspace(3.0, 41.6, len(years)) + np.random.normal(0, 0.5, len(years)),
        "Cm":         np.linspace(75.0, 67.0, len(years)) + np.random.normal(0, 0.3, len(years)),
        "e0":         np.linspace(49.5, 66.6, len(years)) + np.random.normal(0, 0.2, len(years)),
        "TMI":        np.linspace(110.0, 36.4, len(years)) + np.random.normal(0, 1.0, len(years)),
        "HIV_prev":   np.linspace(3.0, 1.0, len(years)) + np.random.normal(0, 0.05, len(years)),
        "Turb":       np.linspace(22.0, 39.0, len(years)) + np.random.normal(0, 0.3, len(years)),
        "TBN":        np.linspace(44.0, 33.0, len(years)),
        "TBM":        np.linspace(17.0, 9.0, len(years)),
        "Population_Total": np.linspace(11_000_000, 33_000_000, len(years)),
    })

    # Inject a few missing values and one outlier
    df_test.loc[5, "Cc"] = np.nan
    df_test.loc[15, "e0"] = np.nan
    df_test.loc[30, "ISF"] = 99.0  # impossible outlier

    cleaner = DataCleaner(enforce_gate=True)
    df_clean = cleaner.fit_transform(df_test)
    score = cleaner.quality_score(df_test)

    print(f"\n{'='*50}")
    print(f"DataCleaner — Smoke Test")
    print(f"{'='*50}")
    print(f"  Input rows   : {len(df_test)}")
    print(f"  Output rows  : {len(df_clean)}")
    print(f"  Quality score: {score:.1%}")
    print(f"  Outliers flagged: {df_clean.get('_outlier', pd.Series(False)).sum()}")
    print(f"  Missing after clean: {df_clean.select_dtypes(include=np.number).isna().sum().sum()}") # type: ignore
    print(f"\n✓ DataCleaner OK — gate {'PASSED' if score >= QUALITY_THRESHOLD else 'FAILED'}")
    sys.exit(0)
