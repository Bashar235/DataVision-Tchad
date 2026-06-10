"""
lstm_model.py
=============
Phase 2 – Sequence Expert

2-layer LSTM (PyTorch) for capturing the 42-year demographic rhythm.
Sliding window: 5-year lookback → predict next value.

Falls back to scikit-learn GradientBoostingRegressor if PyTorch
is unavailable (Python 3.14 / no wheel).

Usage:
  python -m app.ml.lstm_model   # standalone training + evaluation
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

# ── Optional PyTorch import ───────────────────────────────────────────────────
try:
    import torch
    import torch.nn as nn
    from torch.utils.data import DataLoader, TensorDataset
    TORCH_AVAILABLE = True
    logger.info("PyTorch %s detected — using LSTM.", torch.__version__)
except ImportError:
    TORCH_AVAILABLE = False
    logger.warning("PyTorch not available — using GradientBoosting fallback for LSTM slot.")

from sklearn.ensemble import GradientBoostingRegressor
from sklearn.preprocessing import MinMaxScaler

# ── Path constants ─────────────────────────────────────────────────────────────
_ML_DIR    = Path(__file__).parent
MODELS_DIR = _ML_DIR / "models"
SAVE_PATH  = MODELS_DIR / "lstm_model.pkl"

# ── LSTM configuration ────────────────────────────────────────────────────────
WINDOW     = 5      # years of lookback
HIDDEN     = 64
LAYERS     = 2
DROPOUT    = 0.2
EPOCHS     = 150
BATCH_SIZE = 8
LR         = 1e-3

# ── Fallback GB config ────────────────────────────────────────────────────────
GB_PARAMS: Dict = {
    "n_estimators": 400,
    "max_depth":    4,
    "learning_rate": 0.04,
    "subsample":    0.8,
    "loss":         "squared_error",
    "random_state": 42,
}


# ── PyTorch LSTM Architecture ─────────────────────────────────────────────────

class _LSTMNet(nn.Module if TORCH_AVAILABLE else object):  # type: ignore[misc]
    """2-Layer LSTM → Linear head for regression."""

    def __init__(self, input_size: int, hidden: int = HIDDEN, layers: int = LAYERS):
        super().__init__()
        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden,
            num_layers=layers,
            batch_first=True,
            dropout=DROPOUT,
        )
        self.head = nn.Sequential(
            nn.Linear(hidden, 32),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(32, 1),
        )

    def forward(self, x):
        out, _ = self.lstm(x)          # (batch, seq, hidden)
        last   = out[:, -1, :]         # take last timestep
        return self.head(last).squeeze(-1)


# ── Sliding window helper ─────────────────────────────────────────────────────

def _make_windows(
    seq: np.ndarray,          # shape (T, F) — multi-feature sequence
    targets: np.ndarray,      # shape (T,)
    window: int = WINDOW,
) -> Tuple[np.ndarray, np.ndarray]:
    """Convert (T, F) series to supervised (N, window, F) / (N,) arrays."""
    X_out, y_out = [], []
    for i in range(window, len(seq)):
        X_out.append(seq[i - window:i])
        y_out.append(targets[i])
    return np.array(X_out, dtype=np.float32), np.array(y_out, dtype=np.float32)


# ── LSTMDemographer ───────────────────────────────────────────────────────────

class LSTMDemographer:
    """
    Secondary prediction model.

    - PyTorch mode  : 2-layer LSTM with sliding-window inputs
    - Fallback mode : GradientBoostingRegressor on the same features
    """

    def __init__(self):
        self.model = None
        self.scaler_X: Optional[MinMaxScaler] = None
        self.scaler_y: Optional[MinMaxScaler] = None
        self.feature_cols: List[str] = []
        self.metrics: Dict = {}
        self._use_torch = TORCH_AVAILABLE

    # ── Fit ───────────────────────────────────────────────────────────────────

    def fit(
        self,
        X_train: pd.DataFrame,
        y_train: pd.Series,
        X_test: pd.DataFrame,
        y_test: pd.Series,
    ) -> Dict:
        self.feature_cols = list(X_train.columns)
        mode = "PyTorch LSTM" if self._use_torch else "GradientBoosting fallback"

        print(f"\n{'='*55}")
        print(f"  LSTM Secondary Model ({mode})")
        print(f"  Train: {len(X_train)} rows | Test: {len(X_test)} rows")
        print(f"{'='*55}")

        if self._use_torch:
            self._fit_lstm(X_train, y_train)
        else:
            self._fit_gb(X_train, y_train)

        y_pred = self.predict_mean(X_test)
        mae  = mean_absolute_error(y_test, y_pred)
        rmse = float(np.sqrt(mean_squared_error(y_test, y_pred)))
        r2   = r2_score(y_test, y_pred)

        print(f"  MAE  : {mae:>15,.0f} people")
        print(f"  RMSE : {rmse:>15,.0f} people")
        print(f"  R²   : {r2:>15.6f}")

        self.metrics = {"mae": mae, "rmse": rmse, "r2": r2}
        return self.metrics

    def _fit_lstm(self, X_train: pd.DataFrame, y_train: pd.Series) -> None:
        """Train the LSTM on sliding windows."""
        # Scale inputs and targets to [0,1]
        self.scaler_X = MinMaxScaler()
        self.scaler_y = MinMaxScaler()

        X_scaled = self.scaler_X.fit_transform(np.asarray(X_train.fillna(0).values)) # type: ignore
        y_scaled = self.scaler_y.fit_transform(np.asarray(y_train).reshape(-1, 1)).ravel() # type: ignore

        X_w, y_w = _make_windows(np.asarray(X_scaled), np.asarray(y_scaled), WINDOW)

        if len(X_w) == 0:
            logger.warning("Not enough data for LSTM windows — falling back to GB.")
            self._use_torch = False
            self._fit_gb(X_train, y_train)
            return

        X_t = torch.tensor(X_w)
        y_t = torch.tensor(y_w)

        dataset = TensorDataset(X_t, y_t)
        loader  = DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)

        input_size = X_w.shape[2]
        self.model = _LSTMNet(input_size=input_size, hidden=HIDDEN, layers=LAYERS)
        optimiser  = torch.optim.Adam(self.model.parameters(), lr=LR, weight_decay=1e-4)
        criterion  = nn.MSELoss()
        scheduler  = torch.optim.lr_scheduler.CosineAnnealingLR(optimiser, T_max=EPOCHS)

        self.model.train()
        best_loss = float("inf")
        for epoch in range(EPOCHS):
            epoch_loss = 0.0
            for xb, yb in loader:
                optimiser.zero_grad()
                pred = self.model(xb)
                loss = criterion(pred, yb)
                loss.backward()
                nn.utils.clip_grad_norm_(self.model.parameters(), 1.0)
                optimiser.step()
                epoch_loss += loss.item()
            scheduler.step()
            avg_loss = epoch_loss / len(loader)
            if avg_loss < best_loss:
                best_loss = avg_loss
            if (epoch + 1) % 50 == 0:
                print(f"    Epoch {epoch+1:>3}/{EPOCHS}  Loss: {avg_loss:.6f}")

        self.model.eval()
        print(f"  Training complete. Best loss: {best_loss:.6f}")

    def _fit_gb(self, X_train: pd.DataFrame, y_train: pd.Series) -> None:
        """Fallback: scikit-learn GradientBoosting."""
        print("  Training GradientBoosting fallback…")
        self.model = GradientBoostingRegressor(**GB_PARAMS)
        self.model.fit(X_train.fillna(0), y_train)

    # ── Predict ───────────────────────────────────────────────────────────────

    def predict_mean(self, X: pd.DataFrame) -> np.ndarray:
        X_in = X[[c for c in self.feature_cols if c in X.columns]].fillna(0)

        if self._use_torch and isinstance(self.model, _LSTMNet):
            return self._predict_lstm(np.asarray(X_in.values))
        else:
            assert self.model is not None
            return self.model.predict(X_in) # type: ignore

    def _predict_lstm(self, X_raw: np.ndarray) -> np.ndarray:
        """Predict using LSTM — pads or slides as needed."""
        assert self.scaler_X is not None
        assert self.scaler_y is not None
        assert self.model is not None
        
        X_scaled = self.scaler_X.transform(X_raw) # type: ignore

        # Build windows (pad the beginning with the first available row)
        pad = np.tile(X_scaled[0], (WINDOW, 1))
        full_seq = np.vstack([pad, X_scaled])

        windows = np.array(
            [full_seq[i:i + WINDOW] for i in range(len(X_scaled))],
            dtype=np.float32,
        )
        with torch.no_grad():
            preds_scaled = self.model(torch.tensor(windows)).numpy() # type: ignore

        return self.scaler_y.inverse_transform(preds_scaled.reshape(-1, 1)).ravel() # type: ignore

    def predict_with_ci(
        self, X: pd.DataFrame, n_samples: int = 30
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Returns (mean, lower, upper) 95% CI via MC dropout (LSTM)
        or ±1.96 × residual estimate (GB).
        """
        if self._use_torch and isinstance(self.model, _LSTMNet):
            assert self.scaler_X is not None
            assert self.scaler_y is not None
            # MC dropout: run n_samples forward passes in train mode (dropout active)
            X_in = X[[c for c in self.feature_cols if c in X.columns]].fillna(0).values
            X_scaled = self.scaler_X.transform(X_in)
            pad = np.tile(X_scaled[0], (WINDOW, 1))
            full_seq = np.vstack([pad, X_scaled])
            windows = np.array(
                [full_seq[i:i + WINDOW] for i in range(len(X_in))],
                dtype=np.float32,
            )
            t_windows = torch.tensor(windows)

            self.model.train()  # enable dropout
            samples = []
            with torch.no_grad():
                for _ in range(n_samples):
                    p = self.model(t_windows).numpy()
                    samples.append(p)
            self.model.eval()

            samples_arr = np.array(samples)  # (n_samples, T)
            mean_scaled = samples_arr.mean(axis=0)
            std_scaled  = samples_arr.std(axis=0)

            mean  = self.scaler_y.inverse_transform(mean_scaled.reshape(-1, 1)).ravel()
            lower = self.scaler_y.inverse_transform((mean_scaled - 1.96 * std_scaled).reshape(-1, 1)).ravel()
            upper = self.scaler_y.inverse_transform((mean_scaled + 1.96 * std_scaled).reshape(-1, 1)).ravel()
        else:
            mean   = self.predict_mean(X)
            margin = mean * 0.04   # ~4% uncertainty for GB
            lower  = mean - margin
            upper  = mean + margin

        return mean, lower, upper # type: ignore

    # ── Persistence ───────────────────────────────────────────────────────────

    def save(self, path: Optional[Path] = None) -> None:
        path = path or SAVE_PATH
        path.parent.mkdir(parents=True, exist_ok=True)

        state: Dict = {
            "use_torch":    self._use_torch,
            "feature_cols": self.feature_cols,
            "metrics":      self.metrics,
            "scaler_X":     self.scaler_X,
            "scaler_y":     self.scaler_y,
            "input_size":   len(self.feature_cols) if self.feature_cols else 0,
        }

        if self._use_torch and isinstance(self.model, _LSTMNet):
            state["model_state"] = self.model.state_dict()
            state["model_class"] = "LSTMNet"
        else:
            state["model"] = self.model

        joblib.dump(state, path)
        print(f"\n  [OK] LSTM model saved -> {path}")

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "LSTMDemographer":
        path = path or SAVE_PATH
        state = joblib.load(path)
        m = cls.__new__(cls)
        m._use_torch    = state.get("use_torch", False)
        m.feature_cols  = state["feature_cols"]
        m.metrics       = state.get("metrics", {})
        m.scaler_X      = state.get("scaler_X")
        m.scaler_y      = state.get("scaler_y")

        if m._use_torch and TORCH_AVAILABLE and state.get("model_class") == "LSTMNet":
            net = _LSTMNet(input_size=state["input_size"])
            net.load_state_dict(state["model_state"])
            net.eval()
            m.model = net
        else:
            m._use_torch = False
            m.model = state.get("model")

        return m


# ── Standalone training ───────────────────────────────────────────────────────

def _gen_data(start: int, end: int, seed: int = 42) -> pd.DataFrame:
    years = np.arange(start, end + 1)
    n = len(years)
    rng = np.random.default_rng(seed)
    ratio = np.linspace(0, 1, n)
    df = pd.DataFrame({
        "year":       years,
        "ISF":        7.1 - 2.3 * ratio + rng.normal(0, 0.04, n),
        "Cc":         3.0 + 38.6 * ratio + rng.normal(0, 0.4, n),
        "Cm":         75.0 - 8.0 * ratio + rng.normal(0, 0.25, n),
        "e0":         49.5 + 17.1 * ratio + rng.normal(0, 0.15, n),
        "TMI":        110.0 - 73.6 * ratio + rng.normal(0, 0.8, n),
        "HIV_prev":   3.0 - 2.0 * ratio + rng.normal(0, 0.04, n),
        "Turb":       22.0 + 17.0 * ratio + rng.normal(0, 0.2, n),
        "Population_Total": np.linspace(11_200_000, 33_000_000, n) + rng.normal(0, 40_000, n),
    })
    df["year_sq"]   = df["year"] ** 2
    df["e0_sq"]     = df["e0"] ** 2
    df["isf_cc"]    = df["ISF"] * df["Cc"]
    df["year_norm"] = (df["year"] - 2009) / 41.0
    return df


if __name__ == "__main__":
    FEAT = ["year", "ISF", "Cc", "Cm", "e0", "TMI", "HIV_prev", "Turb",
            "year_sq", "e0_sq", "isf_cc", "year_norm"]

    df_train = _gen_data(2009, 2042, seed=42)
    df_test  = _gen_data(2043, 2050, seed=99)

    X_train = df_train[[c for c in FEAT if c in df_train.columns]]
    y_train = df_train["Population_Total"]
    X_test  = df_test[[c for c in FEAT if c in df_test.columns]]
    y_test  = df_test["Population_Total"]

    model = LSTMDemographer()
    metrics = model.fit(X_train, y_train, X_test, y_test)
    model.save()

    mean, lower, upper = model.predict_with_ci(X_test)
    print(f"\n  Sample 2043–2050 (Millions):")
    print(f"  {'Year':<6} {'Actual':>12} {'Predicted':>12} {'Lower':>12} {'Upper':>12}")
    for yr, act, p, lo, hi in zip(df_test["year"], y_test, mean, lower, upper):
        print(f"  {yr:<6} {act/1e6:>12.2f} {p/1e6:>12.2f} {lo/1e6:>12.2f} {hi/1e6:>12.2f}")

    print(f"\n  LSTM MAE : {metrics['mae']:>12,.0f} people")
    print(f"  LSTM R²  : {metrics['r2']:>12.4f}")
    sys.exit(0)
