"""
ml.py
=====
Phase 4 – API Exposure

FastAPI router for the Tri-Model Ensemble Engine.
Exposes /predict, /metrics, /status, and /train (admin-only) endpoints.
"""
import logging
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

import os
import uuid
from functools import lru_cache
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Response, status
from datetime import datetime
from pydantic import BaseModel, Field

from app.api.v1.auth import get_current_user
from app.api.v1.user_activity import increment_activity
from app.ml.cleaner import DataQualityError
from app.ml.ensemble_engine import PredictorEngine
from app.ml.scenario_engine import get_pivoted_data, FEATURE_COLS, TARGET_COL
from app.db.session import get_db
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)

router = APIRouter()
engine: Optional[PredictorEngine] = None
_training_lock = threading.Lock()
_is_training = False

# ── Model directories ──────────────────────────────────────────────────────────
_MODELS_DIR = Path(__file__).parent.parent.parent / "ml" / "models"


# ── Request/Response Schemas ───────────────────────────────────────────────────

class PredictRequest(BaseModel):
    region: str = Field(default="Tchad", description="Région géographique")
    dataset_id: Optional[str] = Field(default=None, description="ID of the baseline dataset")
    # Core Bongaarts proximate determinants
    Cm:       float = Field(default=70.0, ge=0,  le=100, description="% femmes en union")
    Cc:       float = Field(default=20.0, ge=0,  le=100, description="% prévalence contraceptive")
    e0:       float = Field(default=58.0, ge=30, le=90,  description="Espérance de vie à la naissance")
    ISF:      float = Field(default=6.5,  ge=1,  le=12,  description="Indice Synthétique de Fécondité")
    # Secondary demographic indicators (optional, default to INSEED 2024 est.)
    TMI:      float = Field(default=70.0, ge=0,  le=200, description="Taux de Mortalité Infantile")
    HIV_prev: float = Field(default=1.8,  ge=0,  le=30,  description="Prévalence VIH (%)")
    Turb:     float = Field(default=28.0, ge=0,  le=80,  description="Taux d'Urbanisation (%)")
    TBN:      float = Field(default=40.0, ge=0,  le=80,  description="Taux Brut de Natalité")
    TBM:      float = Field(default=13.0, ge=0,  le=40,  description="Taux Brut de Mortalité")
    # Projection years
    years: List[int] = Field(
        default=[2025, 2026, 2027, 2028, 2029, 2030, 2031, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040, 2041, 2042, 2043, 2044, 2045, 2046, 2047, 2048, 2049, 2050],
        description="Années cibles de projection",
    )


# ── Engine helpers ─────────────────────────────────────────────────────────────

def _get_engine() -> PredictorEngine:
    """Load engine from disk if not already in memory."""
    global engine
    if engine is None:
        try:
            engine = PredictorEngine.load()
            logger.info("ML Engine loaded on demand.")
        except Exception as exc:
            logger.error("Failed to load ML Engine: %s", exc)
            raise HTTPException(
                status_code=503,
                detail=(
                    "ML Engine is offline. "
                    "No trained models found — run POST /api/v1/ml/train first."
                ),
            )
    return engine


# Engine is now loaded via main.py lifespan or on-demand via get_ml_engine()


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/predict", summary="Projection démographique AI Ensemble")
def predict_population(
    req: PredictRequest,
    response: Response,
    current_user: Any = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Generate population projections using the Tri-Model ensemble.
    Returns 202 if engine is still loading or training.
    """
    global _is_training, engine
    
    if _is_training or engine is None:
        try:
            # Attempt a quick load if not loaded
            eng = _get_engine()
        except HTTPException as e:
            if _is_training:
                response.status_code = status.HTTP_202_ACCEPTED
                return {
                    "status": "processing", 
                    "message": "ML Engine is currently training. Please retry in a few seconds.",
                    "is_training": True
                }
            raise e
    else:
        eng = engine

    # ── Extract real baseline population from dataset ──────────────────────────
    import pandas as _pd
    import io as _io_ml
    import uuid as _uuid_ml

    real_baseline_pop = None
    real_last_year = None
    historical_data = []
    official_baseline_db = []
    
    # Priority: req.dataset_id -> Gold Standard ID
    GOLD_DATASET_ID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"
    target_ds_id = req.dataset_id or GOLD_DATASET_ID

    if target_ds_id:
        try:
            from app.models import CleanedData as _CleanedData
            from sqlalchemy import func as _func
            
            ds_uuid = _uuid_ml.UUID(target_ds_id)
            
            # Find the most recent year available for this dataset
            real_last_year_rec = db.query(_func.max(_CleanedData.year)).filter(
                _CleanedData.dataset_id == ds_uuid
            ).scalar()
            
            if real_last_year_rec:
                real_last_year = int(real_last_year_rec)
                
                # Fetch population for that year and region
                region_lower = req.region.strip().lower()
                
                query = db.query(_func.sum(_CleanedData.value)).filter(
                    _CleanedData.dataset_id == ds_uuid,
                    _CleanedData.year == real_last_year,
                    _CleanedData.indicator_name == "Population Totale",
                    _CleanedData.age_group.is_(None),
                    _CleanedData.gender.is_(None)
                )
                
                # Fetch ALL historical population records for this dataset and region for the chart
                hist_query = db.query(_CleanedData.year, _func.sum(_CleanedData.value)).filter(
                    _CleanedData.dataset_id == ds_uuid,
                    _CleanedData.indicator_name == "Population Totale",
                    _CleanedData.age_group.is_(None),
                    _CleanedData.gender.is_(None)
                ).group_by(_CleanedData.year).order_by(_CleanedData.year)
                
                if region_lower in ("tchad", "national", "total", ""):
                    query = query.filter(_func.lower(_CleanedData.region).in_(['tchad', 'national', 'total']))
                    hist_query = hist_query.filter(_func.lower(_CleanedData.region).in_(['tchad', 'national', 'total']))
                else:
                    query = query.filter(_func.lower(_func.trim(_CleanedData.region)) == region_lower)
                    hist_query = hist_query.filter(_func.lower(_func.trim(_CleanedData.region)) == region_lower)
                
                real_baseline_pop_val = query.scalar()
                if real_baseline_pop_val:
                    real_baseline_pop = float(real_baseline_pop_val)
                
                hist_records = hist_query.all()
                # Split historical data into pre-2025 (Historical) and 2025+ (Official Baseline/Validation)
                historical_data = [{"year": r[0], "population": float(r[1])} for r in hist_records if r[0] <= 2024]
                official_baseline_db = [{"year": r[0], "value": float(r[1])} for r in hist_records if r[0] > 2024]
                
                logger.info(
                    "predict: fetched %d hist and %d official records from DB dataset=%s region=%s",
                    len(historical_data), len(official_baseline_db), target_ds_id, req.region
                )
        except Exception as _exc_db:
            logger.warning(
                "predict: failed to extract baseline/history from database for dataset %s: %s",
                target_ds_id, _exc_db,
            )
    else:
        pass

    try:
        # Ensure the baseline year is included in target_years for scaling factor calculation
        sim_years = list(set(req.years))
        if real_last_year:
            sim_years.append(real_last_year)
        target_years = sorted(list(set(sim_years + [2009])))

        res = eng.predict(
            params={
                "Cm":       req.Cm,
                "Cc":       req.Cc,
                "e0":       req.e0,
                "ISF":      req.ISF,
                "TMI":      req.TMI,
                "HIV_prev": req.HIV_prev,
                "Turb":     req.Turb,
                "TBN":      req.TBN,
                "TBM":      req.TBM,
            },
            years=target_years,
            dataset_id=req.dataset_id,
            db=db,
        )

        # ── Scale ensemble output to real dataset baseline ─────────────────────
        if real_baseline_pop and real_last_year:
            preds_raw = res.get("predictions", [])
            model_base = next(
                (p["ensemble_pred"] for p in preds_raw if p["year"] == real_last_year),
                preds_raw[0]["ensemble_pred"] if preds_raw else None,
            )
            if model_base and model_base > 0:
                sf = real_baseline_pop / model_base
                for p in preds_raw:
                    for k in ("ensemble_pred", "ci_lower", "ci_upper",
                              "prophet_ref", "prophet_lower", "prophet_upper"):
                        if k in p:
                            p[k] = p[k] * sf

        # Phase 4: Evidence Logging for INSEED
        try:
            from app.db.session import SessionLocal
            from app.models import AuditLog
            import json

            _db_log = SessionLocal()
            try:
                user_id = current_user.id if hasattr(current_user, 'id') else None
                audit_log = AuditLog(
                    user_id=user_id,
                    action="SCENARIO_SIMULATION",
                    details=json.dumps({
                        "dataset_id": req.dataset_id,
                        "region": req.region,
                        "ISF": req.ISF,
                        "e0": req.e0,
                        "TMI": req.TMI,
                        "baseline_year": real_last_year,
                        "forecast_horizon": "2050",
                        "model": "ensemble"
                    })
                )
                _db_log.add(audit_log)
                _db_log.commit()
            except Exception as e:
                logger.error("Failed to insert SCENARIO_SIMULATION AuditLog: %s", e)
            finally:
                _db_log.close()
        except Exception as e:
            logger.error("Error setting up AuditLog session: %s", e)

    except DataQualityError as exc:
        logger.warning("Data Quality Gate blocked prediction: %s", exc)
        raise HTTPException(status_code=422, detail=str(exc))

    import math
    def _sanitize(obj):
        if isinstance(obj, dict):
            return {k: _sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [_sanitize(v) for v in obj]
        elif hasattr(obj, "item"):  # Catch numpy scalars
            val = obj.item()
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                return None
            return val
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj):
                return None
        return obj

    try:
        res = _sanitize(res)
        raw_predictions = res.get("predictions", [])
        
        # ── Refactor response into unified Historical + Reference + Projection ──
        # 1. Historical: Real data from DB (or synthetic fallback) up to baseline_year
        # 2. Reference: Prophet model baseline for all years
        # 3. Projection: AI Ensemble future trends (after baseline_year)
        
        # Splitting logic: 
        # Historical Actuals are always <= 2024.
        # AI Projections are always > 2024.
        # This ensures the 'Blue Graph' appears even if the dataset has data up to 2050.
        baseline_yr = 2024
        
        # Format Reference (Prophet) for all years
        reference_data = []
        for p in raw_predictions:
            reference_data.append({
                "year": int(p["year"]),
                "value": p["prophet_ref"]
            })
            
        # Format Projection (Ensemble) for years > baseline_year
        projection_data = []
        for p in raw_predictions:
            yr = int(p["year"])
            if yr > baseline_yr:
                projection_data.append({
                    "year": yr,
                    "value": p["ensemble_pred"],
                    "lower": p["ci_lower"],
                    "upper": p["ci_upper"],
                    "divergence_pct": p["divergence_pct"]
                })
                
        # Ensure Historical starts from 2009
        historical_data_final = []
        if historical_data:
            historical_data_final = historical_data
        elif real_baseline_pop is None:
            # Fallback to engine's own logic if no DB data
            for p in raw_predictions:
                yr = int(p["year"])
                if yr <= 2024:
                    historical_data_final.append({
                        "year": yr,
                        "population": p["ensemble_pred"]
                    })

        return {
            "status": "success",
            "region": req.region,
            "dataset_id": req.dataset_id,
            "baseline_year": 2024,
            "data": {
                "historical": historical_data_final,
                "reference": reference_data,
                "official_baseline": official_baseline_db if 'official_baseline_db' in locals() else [],
                "projection": projection_data,
                "metrics": res.get("metrics", {}), 
                "quality_score": res.get("quality_score", 0),
                "confidence": res.get("confidence", "🟡 Low Confidence"),
                "feature_importance": res.get("feature_importance", {}),
                "is_synthetic": real_baseline_pop is None,
                "data_source": "rgph_census" if real_baseline_pop is not None else "inseed_2009_synthetic",
            }
        }
    except Exception as exc:
        logger.error("ML Prediction error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail="Internal ML processing error.")


@router.get("/analytics/{dataset_id}", summary="Get ML Analytics for Dataset")
def get_ml_analytics(
    dataset_id: str,
    region: str = "Tchad",
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    Returns pre-computed ML analytics for a specific dataset.
    This bridge allows the UI to see the 'Cleaned' vs 'Predicted' divergence.
    """
    try:
        import uuid
        ds_uuid = uuid.UUID(dataset_id)
        
        # We invoke the internal prediction logic with the dataset's baseline
        # to generate the comparative graph data
        eng = _get_engine()
        
        # 1. Fetch baseline parameters from the dataset in DB
        from app.models import CleanedData
        from sqlalchemy import func
        
        baseline_params = {
            "Cm": 70.7, "Cc": 26.6, "e0": 60.2, "ISF": 5.92,
            "TMI": 55.7, "HIV_prev": 1.5, "Turb": 30.4, "TBN": 42.2, "TBM": 8.6
        }
        
        # Try to find real averages in DB for this dataset
        latest_year = db.query(func.max(CleanedData.year)).filter(
            CleanedData.dataset_id == ds_uuid
        ).scalar()
        
        if latest_year:
            # Simple heuristic: map DB indicator names to Bongaarts params
            param_map = {
                "Cc": "Cc", "isf": "ISF", "isf_computed": "ISF", "e0": "e0",
                "tmi": "TMI", "hiv": "HIV_prev", "urban": "Turb"
            }
            for db_key, p_key in param_map.items():
                query_p = db.query(func.avg(CleanedData.value)).filter(
                    CleanedData.dataset_id == ds_uuid,
                    CleanedData.year == latest_year,
                    CleanedData.indicator_name.ilike(f"%{db_key}%")
                )
                
                # For population indicators, enforce Total age group
                if "population" in db_key.lower():
                    query_p = query_p.filter(CleanedData.age_group == "Total")
                
                val = query_p.scalar()
                if val:
                    baseline_params[p_key] = float(val)

        # 2. Run prediction
        res = eng.predict(params=baseline_params, years=list(range(2025, 2051)), dataset_id=dataset_id)
        
        # 3. Restructure for Recharts
        predictions = []
        for p in res.get("predictions", []):
            predictions.append({
                "year": p["year"],
                "value": p["ensemble_pred"],
                "lower": p["ci_lower"],
                "upper": p["ci_upper"],
                "prophet": p["prophet_ref"]
            })
            
        return {
            "dataset_id": dataset_id,
            "region": region,
            "last_cleaned_year": latest_year,
            "predictions": predictions,
            "metrics": res.get("metrics", {}),
            "feature_importance": res.get("feature_importance", {}),
            "quality_score": res.get("quality_score", 95.0)
        }
    except Exception as e:
        logger.error("Analytics endpoint error: %s", e)
        raise HTTPException(status_code=500, detail=str(e))


class TrainPayload(BaseModel):
    dataset_id: Optional[str] = None

class UploadPayload(BaseModel):
    category: str
    filename: str
    data: Optional[List[Dict[str, Any]]] = None
    dataset_id: Optional[str] = None

@router.post("/clean-upload", summary="Exécuter la Pipeline de Nettoyage")
def clean_upload(payload: UploadPayload, current_user: Any = Depends(get_current_user)):
    """
    Feed RAW JSON records (from CSV) through the ML DataCleaner (IsolationForest, Beers).
    Returns standardized format and a quality report for the Cleaning Console terminal.
    """
    # Role guard — admin or analyst only
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Only admin/analyst users can perform data cleaning.",
        )

    if engine is None or not engine.cleaner:
        raise HTTPException(status_code=503, detail="ML Engine not loaded.")

    import pandas as pd
    import io
    import uuid
    from app.db.session import get_db
    from sqlalchemy.orm import Session
    from app.models import Dataset

    try:
        df_raw = pd.DataFrame()
        
        if payload.dataset_id:
            db_gen = get_db()
            db: Session = next(db_gen)
            # Use explicit UUID cast for reliability
            try:
                ds_uuid = uuid.UUID(payload.dataset_id)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="Invalid dataset ID format.")
                
            dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
            if not dataset or not dataset.raw_content:
                raise HTTPException(status_code=404, detail="Dataset or binary content not found")
            
            from typing import cast
            buffer = io.BytesIO(cast(bytes, dataset.raw_content))
            original_filename = dataset.original_filename
            ext = original_filename.split('.')[-1].lower()
            if ext == "csv":
                df_raw = pd.read_csv(buffer)
            else:
                df_raw = pd.read_excel(buffer)
        elif payload.data:
            df_raw = pd.DataFrame(payload.data)
        else:
            raise HTTPException(status_code=400, detail="Either data or dataset_id must be provided.")

        if df_raw.empty:
            raise HTTPException(status_code=400, detail="Empty dataset provided.")
            
        # Keep original headers for UI report comparison
        original_cols = list(df_raw.columns)

        # --- Standardize incoming schemas from User CSVs ---
        rename_map = {
            "Region": "region",
            "region": "region",
            "Province": "region",
            "province": "region",
            "Year": "year",
            "year": "year",
            "Population_Total": "population",
            "Population": "population",
            "population": "population",
            "Contraception_Rate": "Cc",
            "Maternal_Mortality": "TBM",
            "GDP_Per_Capita": "gdp_per_capita",
            "Urbanization_Rate": "Turb"
        }
        df_standard = df_raw.rename(columns=rename_map)

        df_clean, report = engine.cleaner.process_upload(
            df_standard,
            dataset_id=payload.dataset_id,
            category=payload.category,
        )
        
        # --- Map back to original headers for UI comparison logic ---
        # The UI expects the same keys as the raw data to highlight anomalies
        reverse_map = {v: k for k, v in rename_map.items() if k in original_cols}
        df_clean_ui = df_clean.rename(columns=reverse_map)

        # Ensure we return sanitised data with original headers for the UI report
        clean_dict = df_clean_ui.to_dict(orient="records")

        import math
        def _sanitize(obj):
            if isinstance(obj, dict):
                return {k: _sanitize(v) for k, v in obj.items()}
            elif isinstance(obj, list):
                return [_sanitize(v) for v in obj]
            elif hasattr(obj, "item"):  
                val = obj.item()
                if isinstance(val, float) and (math.isnan(val) or math.isinf(val)):
                    return None
                return val
            elif isinstance(obj, float):
                if math.isnan(obj) or math.isinf(obj):
                    return None
            return obj

        return {
            "status": "success",
            "data": {
                "clean_data": _sanitize(clean_dict),
                "quality_report": _sanitize(report)
            }
        }
    except Exception as exc:
        logger.error("Cleaning Pipeline error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
@router.get("/comparison/{dataset_id}", summary="Aperçu Comparatif (Audit)")
def get_comparison(dataset_id: str, db: Session = Depends(get_db), current_user: Any = Depends(get_current_user)):
    """
    Fetch the top 20 rows of both RAW and CLEANED versions for side-by-side audit in the UI.
    Does not persist changes.
    """
    # Role guard — admin or analyst only
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "superadmin"):
        raise HTTPException(status_code=403, detail="Unauthorized")

    import pandas as pd
    import io
    import uuid
    from app.models import Dataset, CleanedData
    from app.api.v1.clean_status import get_comparison_data

    # Helper function for float sanitation
    import math
    def _sanitize(obj):
        if isinstance(obj, dict): return {k: _sanitize(v) for k, v in obj.items()}
        elif isinstance(obj, list): return [_sanitize(v) for v in obj]
        elif hasattr(obj, "item"): 
            val = obj.item()
            if isinstance(val, float) and (math.isnan(val) or math.isinf(val)): return None
            return val
        elif isinstance(obj, float):
            if math.isnan(obj) or math.isinf(obj): return None
        return obj

    # 1. Try to retrieve from Cache first
    cache_data = get_comparison_data(dataset_id)
    if cache_data:
        return {
            "status": "success",
            "data": {
                "raw_preview": _sanitize(cache_data["raw_preview"]),
                "clean_preview": _sanitize(cache_data["clean_preview"]),
                "report": _sanitize(cache_data["report"]),
                "filename": cache_data.get("filename", "Dataset.csv"),
                "category": cache_data.get("category", "census")
            }
        }

    # 2. Cache Miss: Retrieve from database
    try:
        ds_uuid = uuid.UUID(dataset_id)
        dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
        if not dataset:
            raise HTTPException(status_code=404, detail="Dataset not found")
            
        # Retrieve df_original from database raw_content
        if not dataset.raw_content:
            raise HTTPException(status_code=400, detail="Original raw content is missing.")
            
        from typing import cast
        buffer = io.BytesIO(cast(bytes, dataset.raw_content))
        ext = dataset.original_filename.split('.')[-1].lower()
        if ext == "csv":
            df_original = pd.read_csv(buffer)
        else:
            df_original = pd.read_excel(buffer)

        if df_original.empty:
             raise HTTPException(status_code=400, detail="Empty original dataset")

        # Query CleanedData table for df_cleaned
        cleaned_records = db.query(CleanedData).filter(CleanedData.dataset_id == ds_uuid).all()
        if not cleaned_records:
            # Cleaned data is missing in database and cache, return 400 error as requested
            raise HTTPException(status_code=400, detail="Cleaned version of the dataset is missing or has not been processed yet.")

        # Reconstruct df_cleaned from CleanedData (long format to wide format)
        from app.ml.scenario_engine import get_pivoted_data
        df_cleaned = get_pivoted_data(db, ds_uuid)
        
        if df_cleaned.empty:
            raise HTTPException(status_code=400, detail="Cleaned version of the dataset is empty or invalid.")

        # Preview raw (top 20)
        raw_preview = df_original.head(20).fillna("").to_dict(orient="records")

        # Rename columns back to original casing if possible
        rename_map = {
            "Region": "region", "Year": "year", "Population_Total": "population",
            "region": "region", "Province": "region", "province": "region",
            "year": "year", "Population": "population", "population": "population",
            "Contraception_Rate": "Cc", "Maternal_Mortality": "TBM",
            "GDP_Per_Capita": "gdp_per_capita", "Urbanization_Rate": "Turb"
        }
        reverse_map = {v: k for k, v in rename_map.items() if k in df_original.columns}
        df_clean_ui = df_cleaned.rename(columns=reverse_map)
        clean_preview = df_clean_ui.head(20).fillna("").to_dict(orient="records")

        # Re-run cleaner to generate report (handle initialization errors)
        cleaner = None
        try:
            eng = _get_engine()
            cleaner = eng.cleaner if eng and eng.cleaner else None
        except Exception:
            cleaner = None

        if cleaner is None:
            from app.ml.cleaner import DataCleaner
            cleaner = DataCleaner(enforce_gate=False, ext="csv")

        df_standard = df_original.rename(columns=rename_map)
        _, report = cleaner.process_upload(
            df_standard,
            dataset_id=dataset_id,
            category=dataset.category,
        )

        return {
            "status": "success",
            "data": {
                "raw_preview": _sanitize(raw_preview),
                "clean_preview": _sanitize(clean_preview),
                "report": _sanitize(report),
                "filename": dataset.original_filename,
                "category": dataset.category
            }
        }
    except HTTPException:
        raise
    except Exception as exc:
        logger.error("Comparison error: %s", exc)
        raise HTTPException(status_code=400, detail=f"Comparison failed: {str(exc)}")

class PersistPayload(BaseModel):
    category: str
    filename: Optional[str] = None
    data: List[Dict[str, Any]]
    dataset_id: Optional[str] = None

@router.post("/persist-cleaned", summary="Persister les données nettoyées en BD")
def persist_cleaned(payload: PersistPayload, current_user: Any = Depends(get_current_user)):
    """
    (Analyst/Admin) Commit cleaned records to the 'indicators_data' table.
    Ensures transactional safety (all or nothing).
    """
    # Role guard — admin or analyst only
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "superadmin"):
        raise HTTPException(
            status_code=403,
            detail="Only admin/analyst users can persist cleaned data.",
        )
    import pandas as pd
    from app.db.session import get_db
    from sqlalchemy.orm import Session
    from sqlalchemy.sql import text

    db_gen = get_db()
    db: Session = next(db_gen)

    try:
        inserted_count = 0
        for record in payload.data:
            # Re-standardize the record since the UI sent back the original uppercase names
            region_val = record.get("Region") or record.get("region", "Tchad")
            year_val = int(record.get("Year") or record.get("year", 2000))
            
            # Map wide format to long format
            indicators = {}
            if payload.category == "census":
                indicators["population_total"] = record.get("Population_Total") or record.get("population")
            elif payload.category == "health":
                indicators["Cc"] = record.get("Contraception_Rate") or record.get("Cc")
                indicators["TBM"] = record.get("Maternal_Mortality") or record.get("TBM")
            elif payload.category == "economy":
                indicators["gdp_per_capita"] = record.get("GDP_Per_Capita") or record.get("gdp_per_capita")
                indicators["Turb"] = record.get("Urbanization_Rate") or record.get("Turb")
                
            for ind_name, val in indicators.items():
                if val is not None and not pd.isna(val):
                    try:
                        stmt = text("""
                            INSERT INTO cleaned_data (region, source_file, indicator_name, year, value, created_at, dataset_id)
                            VALUES (:region, :category, :indicator, :year, :value, NOW(), :dataset_id)
                        """)
                        db.execute(stmt, {
                            "region": region_val,
                            "category": payload.category,
                            "indicator": ind_name,
                            "year": year_val,
                            "value": float(val),
                            "dataset_id": payload.dataset_id
                        })
                        inserted_count += 1
                    except (ValueError, TypeError):
                        logger.warning("Skipping unparseable value '%s' for indicator '%s'", val, ind_name)
                        continue
        
        db.commit()

        # --- Update 'datasets' table status ---
        try:
            import uuid
            from app.models import Dataset
            if payload.dataset_id:
                try:
                    ds_uuid = uuid.UUID(payload.dataset_id)
                except:
                    ds_uuid = payload.dataset_id # Fallback if already uuid-like
                    
                existing_ds = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
                if existing_ds:
                    existing_ds.status = "Cleaned" # type: ignore
                    # Capture cleaned metrics
                    df_final = pd.DataFrame(payload.data)
                    existing_ds.row_count = len(payload.data) # type: ignore
                    existing_ds.col_count = len(df_final.columns) # type: ignore
                    logger.info("Updated existing dataset %s to Cleaned", str(existing_ds.id))
                else:
                    logger.warning("Dataset %s not found, fallback to new record", payload.dataset_id)
                    new_ds = Dataset(
                        original_filename=payload.filename or f"Cleaned_{payload.category}.csv",
                        status="Cleaned", # type: ignore
                        category=payload.category,
                        user_id=getattr(current_user, "id", None),
                        row_count=len(payload.data), # type: ignore
                        col_count=len(pd.DataFrame(payload.data).columns) # type: ignore
                    )
                    db.add(new_ds)
            else:
                new_ds = Dataset(
                    original_filename=payload.filename or f"Cleaned_{payload.category}.csv",
                    status="Cleaned",
                    category=payload.category,
                    user_id=getattr(current_user, "id", None),
                    row_count=len(payload.data),
                    col_count=len(pd.DataFrame(payload.data).columns)
                )
                db.add(new_ds)

            db.commit()

            # Increment user activity
            from app.api.v1.user_activity import increment_activity
            increment_activity(db, current_user.id, "clean", details={
                "action": "CLEAN_DATA",
                "details": {
                    "filename": payload.filename,
                    "category": payload.category,
                    "row_count": len(payload.data)
                }
            })
            db.commit()
        except Exception as ds_err:
            logger.error("Failed to register cleaned dataset: %s", ds_err)

        return {"status": "success", "message": f"{inserted_count} valid datapoints persisted."}

    except Exception as exc:
        db.rollback()
        logger.error("Persistence error: %s", exc, exc_info=True)
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        db.close()


@router.get("/status", summary="État des modèles ML")
def get_ml_status(_current_user: Any = Depends(get_current_user)):
    """
    Returns which models are in memory and which .pkl files exist on disk.
    """
    pkl_files = {
        "xgboost_model.pkl":  (_MODELS_DIR / "xgboost_model.pkl").exists(),
        "lstm_model.pkl":     (_MODELS_DIR / "lstm_model.pkl").exists(),
        "prophet_model.pkl":  (_MODELS_DIR / "prophet_model.pkl").exists(),
        "scaler.pkl":         (_MODELS_DIR / "scaler.pkl").exists(),
    }
    models_ready = all(pkl_files.values())

    return {
        "engine_loaded":  engine is not None,
        "models_ready":   models_ready,
        "model_files":    pkl_files,
        "is_training":    _is_training,
    }


@router.get("/metrics", summary="Métriques de performance des modèles")
def get_ml_metrics(_current_user: Any = Depends(get_current_user)):
    """Return model performance metrics (MAE, RMSE, R²) for all sub-models."""
    eng = _get_engine()
    return {
        "status":  "online",
        "metrics": eng.get_metrics(),
    }


def _run_training_background(dataset_id: Optional[str] = None):
    """Background thread: train all models and reload engine into memory."""
    global engine, _is_training
    from app.db.session import SessionLocal
    
    db = SessionLocal()
    try:
        logger.info("Background ML training started for dataset_id: %s", dataset_id)
        # Pass the DB session and dataset_id to train_all
        new_engine = PredictorEngine.train_all(db=db, dataset_id=dataset_id)
        engine = new_engine
        logger.info("Background ML training completed successfully.")
    except Exception as exc:
        logger.error("Background ML training failed: %s", exc, exc_info=True)
    finally:
        _is_training = False
        db.close()


@router.post("/train", summary="Entraîner tous les modèles ML (admin)", status_code=status.HTTP_202_ACCEPTED)
def train_ml_models(
    payload: Optional[TrainPayload] = None,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    current_user: Any = Depends(get_current_user),
):
    """
    (Admin) Trigger full ML training pipeline in the background.
    Returns 202 Accepted.
    """
    global _is_training
    
    dataset_id = payload.dataset_id if payload else None

    # Basic role guard
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "superadmin", "administrator"):
        raise HTTPException(
            status_code=403,
            detail="Only admin/analyst users can trigger model training.",
        )

    if _is_training:
        return {
            "status":  "processing",
            "message": "Training already in progress.",
            "is_training": True
        }

    _is_training = True
    thread = threading.Thread(target=_run_training_background, args=(dataset_id,), daemon=True)
    thread.start()

    return {
        "status":  "training_started",
        "message": "Model training running in background. High-intensity task started.",
        "is_training": True
    }


@router.get("/researcher-datasets", summary="Get Datasets for Researcher Baseline")
def get_researcher_datasets(
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    (Researcher) Returns datasets that are 'Cleaned' and belong to census/demographic categories.
    Unifies with the cleaned database by checking indicators in cleaned_data.
    """
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "researcher", "superadmin", "administrator"):
        raise HTTPException(
            status_code=403,
            detail="Access restricted.",
        )
    
    from app.models import Dataset
    
    # User said: "Letting Researchers see all Cleaned datasets is the correct decision."
    datasets = db.query(Dataset).filter(
        Dataset.status == "Cleaned"
    ).order_by(Dataset.created_at.desc()).all()
    
    results = []
    for d in datasets:
        try:
            from typing import cast
            # Instead of reading raw_content, we get the pivoted view from scenario_engine
            df = get_pivoted_data(db, cast(uuid.UUID, d.id))
            
            if df.empty:
                columns = []
                baseline_year = None
                row_count = 0
            else:
                columns = df.columns.tolist()
                baseline_year = int(df["year"].max())
                row_count = len(df)

            results.append({
                "id": str(d.id),
                "name": d.original_filename,
                "category": d.category,
                "row_count": row_count,
                "columns": columns,
                "baseline_year": baseline_year,
                "date": d.created_at.isoformat()
            })
        except Exception as e:
            logger.error(f"Error processing researcher dataset {d.id}: {e}")
            continue
            
    return results


@router.get("/dataset-baseline/{dataset_id}", summary="Get Real Baseline Values from Dataset")
def get_dataset_baseline(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: Any = Depends(get_current_user)
):
    """
    (Researcher) Read the pivoted data from database and return baseline values.
    Used to auto-populate the Scenario sliders.
    """
    user_role = getattr(current_user, "role", "")
    if user_role not in ("admin", "analyst", "researcher", "superadmin", "administrator"):
        raise HTTPException(status_code=403, detail="Access restricted.")

    try:
        ds_uuid = uuid.UUID(dataset_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid dataset ID format.")

    # Use unified ScenarioEngine logic
    import pandas as pd
    df = get_pivoted_data(db, ds_uuid)
    
    if df.empty:
        raise HTTPException(status_code=404, detail="Dataset not found or has no cleaned data.")

    last_year = int(df["year"].max())
    df_last = df[df["year"] == last_year].copy()

    def _avg(col_name: str) -> Optional[float]:
        if col_name in df_last.columns:
            vals = pd.to_numeric(df_last[col_name], errors="coerce").dropna()
            return round(vals.mean(), 3) if len(vals) > 0 else None
        return None

    provinces = sorted(df["region"].dropna().unique().tolist())

    return {
        "dataset_id":  dataset_id,
        "last_year":   last_year,
        "ISF":         _avg("ISF"),
        "e0":          _avg("e0"),
        "TMI":         _avg("TMI"),
        "Cc":          _avg("Cc"),
        "Cm":          _avg("Cm"),
        "provinces":   provinces,
        "province_count": len(provinces),
    }


# --- Technical Requirement 3: HealthCheck Cache ---
_health_cache = {}

@router.get("/dataset-health/{dataset_id}")
def get_dataset_health(dataset_id: str, db: Session = Depends(get_db)):
    """
    Checks if the dataset has sufficient pivoted data for simulations.
    Replaces hardcoded frontend CSV column checks.
    """
    try:
        if dataset_id in _health_cache:
            return _health_cache[dataset_id]
            
        ds_uuid = uuid.UUID(dataset_id)
        df = get_pivoted_data(db, ds_uuid)
        
        if df.empty:
            res = {
                "is_compatible": False,
                "missing_indicators": FEATURE_COLS + [TARGET_COL],
                "row_count": 0,
                "message": "Dataset not found in cleaned_data table."
            }
        else:
            cols = set(df.columns)
            required = set(FEATURE_COLS + [TARGET_COL])
            missing = list(required - cols)
            
            # Additional check: minimum row threshold
            min_years = 5
            unique_years = df["year"].nunique()
            is_compatible = len(missing) == 0 and unique_years >= min_years
            
            res = {
                "is_compatible": is_compatible,
                "missing_indicators": missing,
                "row_count": len(df),
                "year_count": unique_years,
                "message": "Dataset is healthy" if is_compatible else "Dataset lacks required data"
            }
            
        _health_cache[dataset_id] = res
        return res
    except Exception as e:
        logger.error(f"HealthCheck failed for {dataset_id}: {e}")
        return {"is_compatible": False, "error": str(e)}
