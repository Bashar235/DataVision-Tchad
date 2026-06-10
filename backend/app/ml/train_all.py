"""
train_all.py
============
DataVision Tchad — Full ML Training Orchestrator

Runs the complete training pipeline:
  1. Generate synthetic INSEED data (2009-2042 train / 2043-2050 test)
  2. DataCleaner fit_transform (quality gate)
  3. XGBoost primary model
  4. LSTM secondary model (PyTorch; GradientBoosting fallback)
  5. Prophet reference model
  6. Weighted ensemble evaluation
  7. Save all artifacts to app/ml/models/

Usage:
  # From c:\\DataVision\\backend (venv active):
  python -m app.ml.train_all
"""

import sys
import os
from pathlib import Path

# Ensure project root is on PYTHONPATH
_ROOT = Path(__file__).parent.parent.parent
sys.path.insert(0, str(_ROOT))

from app.ml.ensemble_engine import PredictorEngine


def main() -> None:
    print("\n" + "=" * 65)
    print("  DataVision Tchad — ML Training Pipeline")
    print("  Target: XGBoost (Primary) + LSTM (Secondary) + Prophet (Ref)")
    print("=" * 65)

    from app.db.session import SessionLocal
    db = SessionLocal()
    try:
        # Use the specific INSEED sync dataset ID if possible, or just the db session
        engine = PredictorEngine.train_all(db=db)
    finally:
        db.close()

    print("\n" + "=" * 65)
    print("  [OK]  Training complete. Saved artefacts:")
    models_dir = Path(__file__).parent / "models"
    for f in sorted(models_dir.glob("*.pkl")):
        size_kb = f.stat().st_size / 1024
        print(f"     {f.name:<30} {size_kb:>8.1f} KB")

    metrics = engine.get_metrics()
    print("\n  Final ensemble metrics (2043–2050 holdout):")
    for model, m in metrics.items():
        if isinstance(m, dict) and "mae" in m:
            print(f"    {model:<18} MAE={m['mae']:>12,.0f}  R²={m['r2']:>8.4f}")

    print("\n  [READY] Start the API and the /predict endpoint is live.")
    print("=" * 65)


if __name__ == "__main__":
    main()
