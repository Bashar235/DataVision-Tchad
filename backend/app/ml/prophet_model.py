"""
prophet_model.py
================
Phase 2 – Historian Reference

Facebook Prophet for pure time-series "Business as Usual" baseline.
Role: Reference model only — used to validate the XGBoost+LSTM ensemble.
NOT used as part of the primary prediction.

Usage:
  python -m app.ml.prophet_model   # standalone training + evaluation
"""

from __future__ import annotations

import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score

logger = logging.getLogger(__name__)

# ── Optional Prophet import ───────────────────────────────────────────────────
try:
    from prophet import Prophet
    PROPHET_AVAILABLE = True
    logger.info("Facebook Prophet detected.")
except ImportError:
    PROPHET_AVAILABLE = False
    logger.warning("prophet not installed — using ExponentialSmoothing fallback.")

# ── Fallback: statsmodels Holt-Winters ───────────────────────────────────────
try:
    from statsmodels.tsa.holtwinters import ExponentialSmoothing
    STATSMODELS_AVAILABLE = True
except ImportError:
    STATSMODELS_AVAILABLE = False

# ── Path constants ─────────────────────────────────────────────────────────────
_ML_DIR    = Path(__file__).parent
MODELS_DIR = _ML_DIR / "models"
SAVE_PATH  = MODELS_DIR / "prophet_model.pkl"


# ── ProphetDemographer ────────────────────────────────────────────────────────

class ProphetDemographer:
    """
    Reference model — Facebook Prophet (or Holt-Winters fallback).

    Provides the "Tendanciel" BAU time-series trend + 95% CI.
    Used only for comparison and confidence validation.
    """

    def __init__(self):
        self.model = None
        self.metrics: Dict = {}
        self._use_prophet   = PROPHET_AVAILABLE
        self._use_hw        = STATSMODELS_AVAILABLE and not PROPHET_AVAILABLE
        self._train_years:  Optional[np.ndarray] = None
        self._train_pop:    Optional[np.ndarray] = None

    # ── Fit ───────────────────────────────────────────────────────────────────

    def fit(
        self,
        years_train: np.ndarray,
        pop_train: np.ndarray,
        years_test:  np.ndarray,
        pop_test:   np.ndarray,
    ) -> Dict:
        """
        Fit on (years_train, pop_train) and evaluate on (years_test, pop_test).
        """
        self._train_years = years_train
        self._train_pop   = pop_train

        print(f"\n{'='*55}")
        mode = "Prophet" if self._use_prophet else ("Holt-Winters" if self._use_hw else "Linear Trend")
        print(f"  Prophet Reference Model ({mode})")
        print(f"  Train: {len(years_train)} years | Test: {len(years_test)} years")
        print(f"{'='*55}")

        if self._use_prophet:
            self._fit_prophet(years_train, pop_train)
        elif self._use_hw:
            self._fit_holtwinters(pop_train)
        else:
            self._fit_linear(years_train, pop_train)

        mean, lower, upper = self.predict_with_ci(years_test)
        mae  = mean_absolute_error(pop_test, mean)
        rmse = float(np.sqrt(mean_squared_error(pop_test, mean)))
        r2   = r2_score(pop_test, mean)

        print(f"  MAE  : {mae:>15,.0f} people")
        print(f"  RMSE : {rmse:>15,.0f} people")
        print(f"  R²   : {r2:>15.6f}")

        self.metrics = {"mae": mae, "rmse": rmse, "r2": r2}
        return self.metrics

    def _fit_prophet(self, years: np.ndarray, pop: np.ndarray) -> None:
        """Fit Facebook Prophet on annual population data."""
        df = pd.DataFrame({
            "ds": pd.to_datetime([f"{int(y)}-01-01" for y in years]),
            "y":  pop.astype(float),
        })

        self.model = Prophet(
            yearly_seasonality=False,
            weekly_seasonality=False,
            daily_seasonality=False,
            seasonality_mode="additive",
            interval_width=0.95,
            changepoint_prior_scale=0.3,  # allow demographic shocks
        )
        # Add 5-year census cycle seasonality
        self.model.add_seasonality(name="quinquennial", period=5 * 365.25, fourier_order=3)

        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            self.model.fit(df)

        print("  Prophet training complete.")

    def _fit_holtwinters(self, pop: np.ndarray) -> None:
        """Holt-Winters exponential smoothing fallback."""
        self.model = ExponentialSmoothing(
            pop.astype(float),
            trend="add",
            seasonal=None,
            damped_trend=True,
            initialization_method="estimated",
        ).fit()
        print("  Holt-Winters training complete.")

    def _fit_linear(self, years: np.ndarray, pop: np.ndarray) -> None:
        """Minimal linear trend fallback."""
        from numpy.polynomial import polynomial as P
        self._linear_coef = P.polyfit(years, pop, deg=2)
        self.model = "linear"
        print("  Linear trend fallback fitted.")

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict_with_ci(
        self, years: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Returns (mean, ci_lower, ci_upper) for the given years."""

        if self._use_prophet and isinstance(self.model, Prophet):
            return self._predict_prophet(years)
        elif self._use_hw and self.model is not None:
            return self._predict_holtwinters(years)
        else:
            return self._predict_linear(years)

    def _predict_prophet(
        self, years: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        future = pd.DataFrame({
            "ds": pd.to_datetime([f"{int(y)}-01-01" for y in years])
        })
        import warnings
        with warnings.catch_warnings():
            warnings.simplefilter("ignore")
            fc = self.model.predict(future)

        mean  = fc["yhat"].values
        lower = fc["yhat_lower"].values
        upper = fc["yhat_upper"].values
        return mean, lower, upper

    def _predict_holtwinters(
        self, years: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        n_train = len(self._train_years)
        n_future = int(max(years) - max(self._train_years))
        if n_future <= 0:
            # in-sample
            mean = self.model.fittedvalues[-len(years):]
        else:
            fc   = self.model.forecast(n_future)
            mean = fc[-len(years):].values

        margin = mean * 0.03
        return mean, mean - margin, mean + margin

    def _predict_linear(
        self, years: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        from numpy.polynomial import polynomial as P
        mean   = P.polyval(years.astype(float), self._linear_coef)
        margin = mean * 0.04
        return mean, mean - margin, mean + margin

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> None:
        path = path or SAVE_PATH
        path.parent.mkdir(parents=True, exist_ok=True)
        joblib.dump({
            "model":        self.model,
            "metrics":      self.metrics,
            "use_prophet":  self._use_prophet,
            "use_hw":       self._use_hw,
        }, path)
        print(f"\n  [OK] Prophet model saved -> {path}")

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "ProphetDemographer":
        path = path or SAVE_PATH
        state = joblib.load(path)
        m = cls.__new__(cls)
        m.model        = state["model"]
        m.metrics      = state.get("metrics", {})
        m._use_prophet = state.get("use_prophet", False) and PROPHET_AVAILABLE
        m._use_hw      = state.get("use_hw", False) and STATSMODELS_AVAILABLE
        m._train_years = state.get("train_years")
        m._train_pop   = state.get("train_pop")
        return m


# ── Standalone training ───────────────────────────────────────────────────────

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  Prophet Demographer — Training & Evaluation")
    print("="*55)

    # Synthetic INSEED data (realistic national trend)
    np.random.seed(42)
    years_train = np.arange(2009, 2043)
    pop_train   = np.linspace(11_200_000, 27_000_000, len(years_train)) + np.random.normal(0, 60_000, len(years_train))

    years_test = np.arange(2043, 2051)
    pop_test   = np.linspace(27_200_000, 33_000_000, len(years_test))  + np.random.normal(0, 40_000, len(years_test))

    model = ProphetDemographer()
    metrics = model.fit(years_train, pop_train, years_test, pop_test)
    model.save()

    mean, lower, upper = model.predict_with_ci(years_test)
    print(f"\n  Sample 2043–2050 predictions (Millions):")
    print(f"  {'Year':<6} {'Actual':>10} {'Predicted':>10} {'Lower':>10} {'Upper':>10}")
    for yr, act, p, lo, hi in zip(years_test, pop_test, mean, lower, upper):
        print(f"  {yr:<6} {act/1e6:>10.2f} {p/1e6:>10.2f} {lo/1e6:>10.2f} {hi/1e6:>10.2f}")

    print(f"\n  Prophet MAE : {metrics['mae']:>12,.0f} people")
    print(f"  Prophet R²  : {metrics['r2']:>12.4f}")
    sys.exit(0)
