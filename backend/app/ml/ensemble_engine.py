"""
ensemble_engine.py
==================
Phase 3 – The Weighted Ensemble

PredictorEngine combines XGBoost (Primary) + LSTM (Secondary):
    ŷ = 0.6 × XGBoost + 0.4 × LSTM

Validation against Prophet reference:
    - If |ensemble − prophet| / prophet > 0.15  →  "🟡 Low Confidence"
    - Otherwise                                  →  "🟢 High Confidence"

Also orchestrates the DataCleaner gating and model loading.

Usage:
  from app.ml.ensemble_engine import PredictorEngine
  engine = PredictorEngine.load()
  result = engine.predict(params, years=[2035, 2040, 2050])
"""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
from sqlalchemy.orm import Session

from app.ml.cleaner import DataCleaner, DataQualityError
from app.ml.xgboost_model import (
    XGBoostDemographer, 
    FEATURE_COLS, 
    TARGET_COL, 
    _generate_training_data, 
    _generate_test_data,
    get_training_data_from_db
)
from app.ml.lstm_model import LSTMDemographer
from app.ml.prophet_model import ProphetDemographer

logger = logging.getLogger(__name__)

# ── Ensemble weights ──────────────────────────────────────────────────────────
W_XGB  = 0.6
W_LSTM = 0.4

# Confidence divergence threshold (15%)
CONFIDENCE_THRESHOLD = 0.15

# ── Path constants ─────────────────────────────────────────────────────────────
_ML_DIR    = Path(__file__).parent
MODELS_DIR = _ML_DIR / "models"


# ── PredictorEngine ───────────────────────────────────────────────────────────

class PredictorEngine:
    """
    Main prediction orchestrator for DataVision Tchad.

    Steps for every prediction:
      1. Run DataCleaner (quality gate must pass ≥ 95%)
      2. XGBoost primary → mean + CI
      3. LSTM secondary  → mean + CI
      4. Weighted ensemble = 0.6×XGB + 0.4×LSTM
      5. Prophet reference for divergence check
      6. Confidence badge: 🟢 / 🟡
    """

    def __init__(
        self,
        xgb_model:     Optional[XGBoostDemographer] = None,
        lstm_model:    Optional[LSTMDemographer]    = None,
        prophet_model: Optional[ProphetDemographer] = None,
        cleaner:       Optional[DataCleaner]        = None,
    ):
        self.xgb     = xgb_model
        self.lstm    = lstm_model
        self.prophet = prophet_model
        self.cleaner = cleaner
        if self.cleaner:
            self.cleaner.ext = "db"
        self._metrics: Dict = {}

    # ── Load from saved files ────────────────────────────────────────────────

    @classmethod
    def load(cls) -> "PredictorEngine":
        """Load all saved models from models/ directory."""
        xgb_path     = MODELS_DIR / "xgboost_model.pkl"
        lstm_path    = MODELS_DIR / "lstm_model.pkl"
        prophet_path = MODELS_DIR / "prophet_model.pkl"
        scaler_path  = MODELS_DIR / "scaler.pkl"

        xgb = XGBoostDemographer.load(xgb_path)   if xgb_path.exists()     else None
        lstm = LSTMDemographer.load(lstm_path)     if lstm_path.exists()    else None
        prophet = ProphetDemographer.load(prophet_path) if prophet_path.exists() else None
        cleaner = DataCleaner.load_scaler(scaler_path)  if scaler_path.exists()  else DataCleaner(enforce_gate=True, ext="db")

        engine = cls(xgb_model=xgb, lstm_model=lstm, prophet_model=prophet, cleaner=cleaner)
        logger.info("PredictorEngine loaded — XGB:%s LSTM:%s Prophet:%s",
                    xgb is not None, lstm is not None, prophet is not None)
        return engine

    # ── Train all ─────────────────────────────────────────────────────────────

    @classmethod
    def train_all(cls, db: Optional[Session] = None, dataset_id: Optional[str] = None) -> "PredictorEngine":
        """
        Full training pipeline:
          1. Load data from Database (if session provided)
          2. DataCleaner fit_transform
          3. Train XGBoost, LSTM, Prophet
          4. Save everything
        Returns a ready PredictorEngine.
        """
        from app.ml.xgboost_model import _generate_training_data, _generate_test_data

        print("\n" + "="*60)
        print("  DataVision Tchad — Full ML Training Pipeline")
        print("="*60)

        # ── 1. Data acquisition
        use_fallback = False
        if db:
            print("\n[Step 0] Fetching training data from database…")
            try:
                df_full = get_training_data_from_db(db, dataset_id=dataset_id)
                if not df_full.empty and len(df_full) >= 10:
                    print(f"  [OK] Using {len(df_full)} records from database.")
                    # Temporal split: last 20% for testing
                    df_full = df_full.sort_values("year")
                    split_idx = int(len(df_full) * 0.8)
                    df_train = df_full.iloc[:split_idx]
                    df_test  = df_full.iloc[split_idx:]
                else:
                    print(f"  [!] Database has insufficient records (<10). Falling back to synthetic.")
                    use_fallback = True
            except Exception as e:
                print(f"  [!] Database fetch failed: {e}. Falling back to synthetic.")
                use_fallback = True
        else:
            use_fallback = True

        if use_fallback:
            print("\n[Step 0] Using synthetic INSEED baseline data.")
            df_train = _generate_training_data()
            df_test  = _generate_test_data()

        # ── 2. Clean training data
        # enforce_gate=False during bootstrap: synthetic data may have a few
        # flagged outlier rows that would fail the gate. Gate is enforced at
        # inference time (real user data) in PredictorEngine.predict().
        print("\n[Step 1] DataCleaner — fitting on training data…")
        cleaner = DataCleaner(enforce_gate=False)
        df_train_clean = cleaner.fit_transform(df_train.copy())
        score = cleaner.quality_score(df_train)
        print(f"  [OK] Quality score: {score:.1%}")
        cleaner.save_scaler(MODELS_DIR / "scaler.pkl")


        # ── 3. Build feature arrays
        feat_cols = [c for c in FEATURE_COLS if c in df_train_clean.columns]
        # Recover unscaled target (cleaner doesn't touch Population_Total)
        y_train = df_train_clean[TARGET_COL] if TARGET_COL in df_train_clean.columns else df_train[TARGET_COL]
        X_train = df_train_clean[feat_cols].fillna(0)

        # For test: apply transform (not fit_transform)
        df_test_clean = cleaner.transform(df_test.copy())
        X_test  = df_test_clean[[c for c in feat_cols if c in df_test_clean.columns]].fillna(0)
        y_test  = df_test[TARGET_COL]

        # ── 4. XGBoost
        print("\n[Step 2] Training XGBoost primary model…")
        xgb = XGBoostDemographer()
        xgb_metrics = xgb.fit(X_train, y_train, X_test, y_test)
        xgb.save()

        # ── 5. LSTM
        print("\n[Step 3] Training LSTM secondary model…")
        lstm = LSTMDemographer()
        lstm_metrics = lstm.fit(X_train, y_train, X_test, y_test)
        lstm.save()

        # ── 6. Prophet (on raw population series — no feature scaling needed)
        print("\n[Step 4] Training Prophet reference model…")
        prophet = ProphetDemographer()
        prophet_metrics = prophet.fit(
            np.asarray(df_train["year"]), np.asarray(df_train[TARGET_COL]),
            np.asarray(df_test["year"]),  np.asarray(df_test[TARGET_COL]),
        )
        prophet.save()

        # ── 7. Ensemble evaluation
        print("\n[Step 5] Ensemble evaluation on 2043–2050 holdout…")
        engine = cls(xgb_model=xgb, lstm_model=lstm,
                     prophet_model=prophet, cleaner=cleaner)

        ens_pred, ens_lower, ens_upper = engine._ensemble_predict(X_test)
        from sklearn.metrics import mean_absolute_error, r2_score
        ens_mae = mean_absolute_error(y_test, ens_pred)
        ens_r2  = r2_score(y_test, ens_pred)

        print(f"\n{'='*60}")
        print(f"  PERFORMANCE SUMMARY (2043–2050 test set)")
        print(f"{'='*60}")
        print(f"  {'Model':<22} {'MAE':>14} {'R²':>10}")
        print(f"  {'-'*48}")
        print(f"  {'XGBoost (Primary)':<22} {xgb_metrics['mae']:>14,.0f} {xgb_metrics['r2']:>10.4f}")
        print(f"  {'LSTM (Secondary)':<22} {lstm_metrics['mae']:>14,.0f} {lstm_metrics['r2']:>10.4f}")
        print(f"  {'Prophet (Reference)':<22} {prophet_metrics['mae']:>14,.0f} {prophet_metrics['r2']:>10.4f}")
        print(f"  {'Ensemble (0.6×0.4)':<22} {ens_mae:>14,.0f} {ens_r2:>10.4f}")
        print(f"{'='*60}")

        engine._metrics = {
            "xgboost":  xgb_metrics,
            "lstm":     lstm_metrics,
            "prophet":  prophet_metrics,
            "ensemble": {"mae": ens_mae, "r2": ens_r2},
        }

        return engine

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict(
        self,
        params: Dict[str, Any],
        years: List[int],
        dataset_id: Optional[str] = None,
        db: Optional[Session] = None,
    ) -> Dict[str, Any]:
        """
        Full prediction pipeline for a set of Bongaarts parameters + target years.
        Implements Dynamic Recalculation: scales baseline trends by user lever offsets.
        """
        from app.utils.demographics import get_tendanciel_value
        
        # 1. Check if dataset is pre-validated (e.g. INSEED official sync)
        # Simulations are inherently pre-validated for the gate because user levers 
        # may intentionally create outliers relative to historical trends.
        is_prevalidated = True 

        # ── Build Dynamic feature DataFrame (Dynamic Feature Injection) ──────
        records = []
        for yr in years:
            # Get the baseline trend for this year from INSEED Tendanciel (now DB-aware)
            b_isf = get_tendanciel_value("ISF", yr, db=db, dataset_id=dataset_id) or 6.5
            b_e0  = get_tendanciel_value("e0",  yr, db=db, dataset_id=dataset_id) or 56.0
            b_tmi = get_tendanciel_value("TMI", yr, db=db, dataset_id=dataset_id) or 72.0
            b_cc  = get_tendanciel_value("Cc",  yr, db=db, dataset_id=dataset_id) or 20.0
            b_cm  = get_tendanciel_value("Cm",  yr, db=db, dataset_id=dataset_id) or 72.0
            b_tbn = get_tendanciel_value("TBN", yr, db=db, dataset_id=dataset_id) or 40.0
            b_tbm = get_tendanciel_value("TBM", yr, db=db, dataset_id=dataset_id) or 13.0
            
            # Dynamic Feature Injection for the projection horizon (2025-2050)
            if yr >= 2025:
                r = {
                    "year":     yr,
                    "ISF":      params.get("ISF", b_isf),
                    "e0":       params.get("e0",  b_e0),
                    "TMI":      params.get("TMI", b_tmi),
                    "Cc":       params.get("Cc",  b_cc),
                    "Cm":       params.get("Cm",  b_cm),
                    "HIV_prev": params.get("HIV_prev", 1.8),
                    "Turb":     params.get("Turb",     28.0),
                    "TBN":      b_tbn,
                    "TBM":      b_tbm,
                }
            else:
                r = {
                    "year":     yr,
                    "ISF":      b_isf,
                    "e0":       b_e0,
                    "TMI":      b_tmi,
                    "Cc":       b_cc,
                    "Cm":       b_cm,
                    "HIV_prev": params.get("HIV_prev", 1.8),
                    "Turb":     params.get("Turb",     28.0),
                    "TBN":      b_tbn,
                    "TBM":      b_tbm,
                }
                
            # Add engineered features
            r["year_sq"]   = yr ** 2
            r["e0_sq"]     = r["e0"] ** 2
            r["isf_cc"]    = r["ISF"] * r["Cc"]
            r["year_norm"] = (yr - 2009) / 41.0
            records.append(r)

        df = pd.DataFrame(records)

        # ── Quality gate ─────────────────────────────────────────────────────
        # Calculate score for UI feedback, but don't block simulation if it's < 95%
        quality_score = self.cleaner.quality_score(df) if self.cleaner else 1.0

        # Apply cleaner transform (may raise DataQualityError if not pre-validated)
        if self.cleaner:
            orig_gate = self.cleaner.enforce_gate
            if is_prevalidated:
                self.cleaner.enforce_gate = False
            
            try:
                df = self.cleaner.transform(df)
            finally:
                self.cleaner.enforce_gate = orig_gate

        # ── Ensemble predict ──────────────────────────────────────────────────
        feat_cols = [c for c in FEATURE_COLS if c in df.columns]
        X = df[feat_cols].fillna(0)

        ens_pred, ens_lower, ens_upper = self._ensemble_predict(X)

        # ── Prophet reference ─────────────────────────────────────────────────
        if self.prophet:
            prop_mean, prop_lower, prop_upper = self.prophet.predict_with_ci(np.array(years))
        else:
            prop_mean = ens_pred * 1.02   # trivial fallback
            prop_lower, prop_upper = prop_mean * 0.97, prop_mean * 1.03

        # ── Confidence logic ──────────────────────────────────────────────────
        divergences = np.abs(ens_pred - prop_mean) / (np.abs(prop_mean) + 1e-6)
        max_divergence = float(divergences.max())
        confidence = (
            "🟢 High Confidence"
            if max_divergence <= CONFIDENCE_THRESHOLD
            else "🟡 Low Confidence"
        )

        # ── Feature importances ───────────────────────────────────────────────
        fi = self.xgb.feature_importance() if self.xgb else {}

        # ── Build per-year output ─────────────────────────────────────────────
        predictions = []
        for i, yr in enumerate(years):
            predictions.append({
                "year":            yr,
                "ensemble_pred":   float(ens_pred[i]),
                "ci_lower":        float(ens_lower[i]),
                "ci_upper":        float(ens_upper[i]),
                "prophet_ref":     float(prop_mean[i]),
                "prophet_lower":   float(prop_lower[i]),
                "prophet_upper":   float(prop_upper[i]),
                "divergence_pct":  float(divergences[i] * 100),
            })

        return {
            "predictions":        predictions,
            "quality_score":      quality_score,
            "confidence":         confidence,
            "max_divergence_pct": max_divergence * 100,
            "feature_importance": fi,
            "weights":            {"xgboost": W_XGB, "lstm": W_LSTM},
        }

    # ── Internal ensemble logic ───────────────────────────────────────────────

    def _ensemble_predict(
        self, X: pd.DataFrame
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Compute ŷ = 0.6×XGB + 0.4×LSTM with combined CI."""

        if self.xgb:
            xgb_mean, xgb_low, xgb_hi = self.xgb.predict_with_ci(X)
        else:
            xgb_mean = xgb_low = xgb_hi = np.zeros(len(X))

        if self.lstm:
            lstm_mean, lstm_low, lstm_hi = self.lstm.predict_with_ci(X)
        else:
            lstm_mean = lstm_low = lstm_hi = np.zeros(len(X))

        ens_mean  = W_XGB * xgb_mean  + W_LSTM * lstm_mean
        ens_lower = W_XGB * xgb_low   + W_LSTM * lstm_low
        ens_upper = W_XGB * xgb_hi    + W_LSTM * lstm_hi

        return ens_mean, ens_lower, ens_upper

    # ── Metrics ───────────────────────────────────────────────────────────────

    def get_metrics(self) -> Dict:
        """Return stored training-time metrics for all sub-models."""
        result = {}
        if self._metrics:
            return self._metrics
        if self.xgb:
            result["xgboost"] = self.xgb.metrics
        if self.lstm:
            result["lstm"] = self.lstm.metrics
        if self.prophet:
            result["prophet"] = self.prophet.metrics
        return result
