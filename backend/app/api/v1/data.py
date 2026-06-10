from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Depends, Form, Query
from fastapi.responses import StreamingResponse
from typing import Optional, List, cast
import io

import os
from pathlib import Path
import pandas as pd
import joblib
import logging
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from app.db.session import get_db

logger = logging.getLogger(__name__)

# ── Path to ML models directory (resolves relative to this file) ──────────────
ML_DIR = str(Path(__file__).parent.parent.parent / "ml" / "models")

router = APIRouter()

AUDIT_LOGS = [] # In-memory mock

# Helpers
import uuid
from app.models import IndicatorData, Dataset, CleanedData
from sqlalchemy import func

# Helpers
def get_data(db: Session, dataset_id: Optional[str] = None):
    """
    Pivot the indicators_data table into a wide format matching the old synthetic CSV schema.
    This ensures minimum breakage for existing analytics logic.
    """
    try:
        # Fetch data from the standardized cleaned_data table
        query = db.query(CleanedData)
        
        if dataset_id:
            try:
                import uuid as _uuid
                ds_uuid = _uuid.UUID(dataset_id)
                query = query.filter(CleanedData.dataset_id == ds_uuid)
            except:
                pass # Fallback to global data if ID is invalid
        
        df_raw = pd.read_sql(query.statement, db.bind) # type: ignore
        
        if df_raw.empty:
            return None

        # Unified Mapping (Internal Keys + French Display Names + Common Variants)
        mapping = {
            # ── Population ────────────────────────────────────────────────────
            "Population Totale": "population",
            "population_total": "population",
            "total_population": "population",
            "population": "population",
            
            # ── Fertility ─────────────────────────────────────────────────────
            "Indice Synthétique de Fécondité": "fertility_rate",
            "fertility_rate": "fertility_rate",
            "isf": "fertility_rate",
            
            # ── Mortality ─────────────────────────────────────────────────────
            "Taux de Mortalité Infantile": "mortality_rate",
            "Mortalité Infantile": "mortality_rate",
            "mortality_rate": "mortality_rate",
            "tmi": "mortality_rate",
            "TMI": "mortality_rate",
            "TBM": "mortality_rate",
            "Infant Mortality": "mortality_rate",
            "mortality": "mortality_rate",
            
            # ── Life Expectancy ───────────────────────────────────────────────
            "Espérance de vie à la naissance": "e0",
            "e0": "e0",
            
            # ── Urbanization ──────────────────────────────────────────────────
            "Taux d'Urbanisation": "urbanization_rate",
            "urbanization_rate": "urbanization_rate",
            "Turb": "urbanization_rate",
            
            # ── GDP / Economic ────────────────────────────────────────────────
            "PIB Nominal": "gdp_contribution",
            "PIB": "gdp_contribution",
            "pib": "gdp_contribution",
            "gdp": "gdp_contribution",
            "GDP": "gdp_contribution",
            "Taux d'Accroissement Naturel": "gdp_contribution",
            "gdp_per_capita": "gdp_contribution",
            "gdp_growth": "gdp_contribution",
            "gdp_contribution": "gdp_contribution",
            
            # ── Literacy ──────────────────────────────────────────────────────
            "Taux d'alphabétisation": "literacy_rate",
            "alphabetisation": "literacy_rate",
            "literacy_rate": "literacy_rate",
            "literacy": "literacy_rate",
            
            # ── Water access ──────────────────────────────────────────────────
            "Accès à l'eau potable": "water_access",
            "water_access": "water_access",
            "eau_potable": "water_access",
            
            # ── New Master Indicators ─────────────────────────────────────────
            "Economy_Index": "economy_index",
            "Health_Access_Rate": "health_access_rate",
        }

        # 1. Pivot main indicators
        df_main = df_raw[df_raw['indicator_name'].isin(mapping.keys())].copy()
        
        # If no indicators match our primary pivot mapping, fallback to returning the raw cleaned records
        # This prevents the "empty file" issue when the database contains data we don't know how to pivot.
        if df_main.empty:
            print(f"[DATA_FETCH] No indicators matched pivot mapping for {len(df_raw)} cleaned rows. Returning raw format.")
            return df_raw
            
        df_main['feature_name'] = df_main['indicator_name'].map(mapping)
        df_wide = df_main.pivot_table(index=['year', 'region'], columns='feature_name', values='value', aggfunc='mean').reset_index()
        
        # 2. Pivot Age Groups
        df_age = df_raw[df_raw['indicator_name'] == "Population par Groupe d'Âges"].copy()
        if not df_age.empty:
            def categorize_age(group):
                if group in ['0-4', '5-9', '10-14']: return 'age_0_14'
                if group in ['15-19', '20-24', '25-29', '30-34', '35-39', '40-44', '45-49', '50-54', '55-59', '60-64']: return 'age_15_64'
                return 'age_65_plus'
            df_age['age_category'] = df_age['age_group'].apply(categorize_age)
            df_age_agg = df_age.pivot_table(index=['year', 'region'], columns='age_category', values='value', aggfunc='sum').reset_index()
            df_wide = pd.merge(df_wide, df_age_agg, on=['year', 'region'], how='left')

        final_df = df_wide.fillna(0)
        return final_df if not final_df.empty else None
    except Exception as e:
        print(f"Error pivoting DB data: {e}")
        return None

models = {}
def load_model(name):
    if name not in models:
        # Models are now in backend/app/ml/
        path = os.path.join(ML_DIR, f"{name}.pkl")
        if os.path.exists(path):
            models[name] = joblib.load(path)
        else:
            print(f"Model {name} not found at {path}")
            models[name] = None
    return models[name]

# --- DATA OPS ---
import shutil
from fastapi import Form
from app.api.v1.auth import get_current_user
from app.models import User, AuditLog, Dataset, GeneratedReport
import json

@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    category: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    filename = file.filename or "unknown_file"
    ext = filename.split('.')[-1].lower() if '.' in filename else ""
    if ext not in ["csv", "xlsx"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Use CSV or XLSX.")

    try:
        # Read file into memory
        content = await file.read()
        
        # Basic metadata extraction for quick access
        file_metadata = {
            "original_filename": filename,
            "extension": ext,
            "size_bytes": len(content),
            "uploaded_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Create Dataset record with binary content
        new_dataset = Dataset(
            original_filename=filename,
            raw_content=content,
            status="pending",
            category=category,
            user_id=current_user.id,
            file_metadata=file_metadata
        )
        db.add(new_dataset)
        db.flush()  # Get ID before inserting children

        # ── ONE-WAY PIPELINE: Parse file → indicators_data (is_cleaned=False) ──
        raw_row_count = 0
        try:
            buffer = io.BytesIO(content)
            if ext == "csv":
                df_raw = pd.read_csv(buffer)
            else:
                df_raw = pd.read_excel(buffer)

            # Standardize structural columns
            rename_map = {}
            for col in df_raw.columns:
                lcol = col.strip().lower()
                if lcol in ['region', 'province']: rename_map[col] = 'region'
                elif lcol in ['year', 'annee']: rename_map[col] = 'year'
                elif lcol in ['gender', 'sexe']: rename_map[col] = 'gender'
                elif lcol in ['age_group', 'age_groupe']: rename_map[col] = 'age_group'
            df_raw.rename(columns=rename_map, inplace=True)

            structural_cols = {'region', 'year', 'gender', 'age_group'}
            indicator_cols = [c for c in df_raw.columns if c.lower() not in structural_cols]

            if (category or "").lower() == "census":
                required_cols = ['region', 'year', 'gender', 'age_group', 'population', 'ISF', 'e0', 'TMI', 'Cc', 'Cm']
                missing_cols = [col for col in required_cols if col not in df_raw.columns]
                if missing_cols:
                    raise ValueError("Census upload is missing required columns: " + ", ".join(missing_cols))
            else:
                for col in ['region', 'year', 'gender', 'age_group']:
                    if col not in df_raw.columns:
                        df_raw[col] = 'Total' if col != 'year' else 2024

            df_long = df_raw.melt(
                id_vars=['region', 'year', 'gender', 'age_group'],
                value_vars=[c for c in indicator_cols if c in df_raw.columns],
                var_name='indicator_name',
                value_name='value'
            )

            raw_records = []
            for _, row in df_long.iterrows():
                try:
                    raw_records.append(IndicatorData(
                        indicator_name=str(row['indicator_name']),
                        value=float(row['value']),
                        year=int(row['year']),
                        region=str(row['region']),
                        gender=str(row['gender']),
                        age_group=str(row['age_group']),
                        source_file=filename,
                        dataset_id=new_dataset.id,
                        is_cleaned=False,
                        created_at=datetime.now(timezone.utc)
                    ))
                except (ValueError, TypeError):
                    continue

            db.add_all(raw_records)
            raw_row_count = len(raw_records)
            logger.info("Inserted %d raw rows into indicators_data for dataset %s", raw_row_count, new_dataset.id)
        except Exception as parse_err:
            logger.warning("Could not parse file into indicators_data during upload: %s", parse_err)

        # Audit Log
        audit = AuditLog(
            user_id=current_user.id,
            action="UPLOAD_DATA",
            details=json.dumps({
                "filename": filename,
                "category": category,
                "dataset_id": str(new_dataset.id),
                "raw_rows_ingested": raw_row_count
            }),
            created_at=datetime.now(timezone.utc)
        )
        db.add(audit)

        from app.api.v1.user_activity import increment_activity
        increment_activity(db, cast(int, current_user.id), "upload", details={
            "action": "UPLOAD_DATA",
            "details": {"filename": filename, "category": category}
        })

        db.commit()
        db.refresh(new_dataset)

        return {
            "status": "success",
            "id": str(new_dataset.id),
            "filename": filename,
            "raw_rows_ingested": raw_row_count,
            "message": "File uploaded and raw rows staged in indicators_data (pending cleaning)"
        }
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/datasets")
async def get_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    query = db.query(Dataset)
    
    # Researchers only see Cleaned/Verified data; Admins see everything
    if current_user.role == "researcher":
        from sqlalchemy import func
        query = query.filter(func.lower(Dataset.status).in_(["cleaned", "verified"]))
        
    datasets = query.order_by(Dataset.created_at.desc()).all()
    # Serialize for frontend with cleaner status labels
    return [
        {
            "id": str(d.id),
            "name": d.original_filename,
            "status": "Pending" if d.status == "Uploaded" else d.status,
            "category": d.category,
            "date": d.created_at.isoformat(),
            "user_id": d.user_id,
            "row_count": d.row_count,
            "col_count": d.col_count,
            "null_count": d.null_count,
            "dupe_count": d.dupe_count,
            "health_score": round(100 * (1 - (cast(int, d.null_count) + cast(int, d.dupe_count)) / (cast(int, d.row_count) * cast(int, d.col_count))), 2) if d.row_count and d.col_count else 100.0
        } for d in datasets
    ]

@router.delete("/dataset/{dataset_id}", summary="Supprimer un Dataset (Cascade)")
async def delete_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently delete a dataset and all associated indicator records.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid dataset ID")

    dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        filename = dataset.original_filename

        # 1. DELETE children from cleaned_data
        db.query(CleanedData).filter(CleanedData.dataset_id == ds_uuid).delete(synchronize_session=False)
        
        # 2. DELETE children from indicators_data
        db.query(IndicatorData).filter(IndicatorData.dataset_id == ds_uuid).delete(synchronize_session=False)
        
        # 3. DELETE parent dataset (This also removes the BYTEA raw_content)
        db.delete(dataset)
        
        # 3. Log Audit
        audit = AuditLog(
            user_id=current_user.id,
            action="DELETE_DATASET",
            details=json.dumps({"filename": filename, "dataset_id": dataset_id}),
            created_at=datetime.utcnow()
        )
        db.add(audit)
        
        db.commit()
        logger.info(f"Dataset {dataset_id} ({filename}) and related records deleted successfully.")
        
        return {"status": "success", "message": f"Dataset '{filename}' and all associated data deleted."}
    except Exception as e:
        db.rollback()
        logger.error("Deletion failed: %s", e)
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


# ── BULK DELETE ───────────────────────────────────────────────────────────────
from pydantic import BaseModel

class BulkDeleteRequest(BaseModel):
    ids: List[str]

@router.post("/datasets/bulk-delete", summary="Bulk Delete Datasets (Cascade)")
async def bulk_delete_datasets(
    payload: BulkDeleteRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Permanently delete multiple datasets and all their associated child records
    in a single atomic transaction. Only admin and analyst roles are permitted.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    if not payload.ids:
        raise HTTPException(status_code=400, detail="No IDs provided")

    # Validate every UUID up-front before touching the DB
    try:
        uuids = [uuid.UUID(raw_id) for raw_id in payload.ids]
    except ValueError:
        raise HTTPException(status_code=400, detail="One or more IDs are not valid UUIDs")

    deleted_ids: List[str] = []
    try:
        for ds_uuid in uuids:
            dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
            if not dataset:
                continue  # skip non-existent – don't fail the whole batch

            filename = dataset.original_filename

            # 1. Delete child cleaned_data records
            db.query(CleanedData).filter(
                CleanedData.dataset_id == ds_uuid
            ).delete(synchronize_session=False)

            # 2. Delete child indicator_data records
            db.query(IndicatorData).filter(
                IndicatorData.dataset_id == ds_uuid
            ).delete(synchronize_session=False)

            # 3. Delete parent dataset row (including BYTEA raw_content)
            db.delete(dataset)

            deleted_ids.append(str(ds_uuid))

            # Audit log per deleted dataset
            db.add(AuditLog(
                user_id=current_user.id,
                action="BULK_DELETE_DATASET",
                details=json.dumps({"filename": filename, "dataset_id": str(ds_uuid)}),
                created_at=datetime.now(timezone.utc)
            ))

        # Single commit – entire operation is atomic
        db.commit()

        logger.info(
            "Bulk delete: user=%s deleted %d datasets: %s",
            current_user.id, len(deleted_ids), deleted_ids
        )

        return {
            "status": "success",
            "deleted_count": len(deleted_ids),
            "ids": deleted_ids
        }

    except Exception as e:
        db.rollback()
        logger.error("Bulk delete failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Bulk delete failed: {str(e)}")


@router.get("/preview/{dataset_id}")
async def preview_dataset(
    dataset_id: str,
    full: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid dataset ID format")
        
    dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    try:
        df = pd.DataFrame()
        if dataset.raw_content:
            # Parse from binary
            buffer = io.BytesIO(cast(bytes, dataset.raw_content))
            ext = dataset.original_filename.split('.')[-1].lower()
            nrows = None if full else 50
            if ext == "csv":
                df = pd.read_csv(buffer, nrows=nrows)
            else:
                df = pd.read_excel(buffer, nrows=nrows)
        elif dataset.category: # Fallback for old records if any (though we migrated)
             # Logic for "db://" style if kept
             pass

        # Common sanitation
        df = df.replace([float('inf'), float('-inf')], float('nan'))
        df = df.fillna("")
        
        return {
            "id": str(dataset.id),
            "filename": dataset.original_filename,
            "category": dataset.category,
            "headers": list(df.columns),
            "row_count": len(df),
            "is_preview": not full,
            "data": df.to_dict(orient="records")
        }
    except Exception as e:
        logger.error("Preview failed: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

from fastapi import BackgroundTasks
from app.api.v1.clean_status import init_progress, update_progress, set_comparison_data
from typing import Tuple

def apply_cleaning_rules(df_raw: pd.DataFrame, dataset_id: str, category: str) -> Tuple[pd.DataFrame, dict]:
    """
    Apply strict cleaning rules to raw dataframe using ML cleaner if available, 
    otherwise fallback to local cleaner, and cache the result for ML comparison.
    """
    from app.api.v1.clean_status import set_comparison_data
    from app.ml.cleaner import DataCleaner
    import pandas as pd
    from typing import Tuple, Optional, Any
    
    # 1. Try to use ML Engine cleaner
    cleaner = None
    try:
        from app.api.v1.ml import _get_engine
        eng = _get_engine()
        if eng and eng.cleaner:
            cleaner = eng.cleaner
    except Exception:
        pass
        
    if cleaner is None:
        cleaner = DataCleaner(enforce_gate=False, ext="csv")
        
    # Standardize column mapping for the cleaner
    rename_map = {
        "Region": "region", "region": "region", "Province": "region", "province": "region",
        "Year": "year", "year": "year", "Population_Total": "population",
        "Population": "population", "population": "population",
        "Contraception_Rate": "Cc", "Maternal_Mortality": "TBM",
        "GDP_Per_Capita": "gdp_per_capita", "Urbanization_Rate": "Turb"
    }
    df_standard = df_raw.rename(columns=rename_map)
    
    # Run the cleaner
    df_clean, report = cleaner.process_upload(df_standard, dataset_id=dataset_id, category=category)
    
    # Restore original headers for preview/comparison
    reverse_map = {v: k for k, v in rename_map.items() if k in df_raw.columns}
    df_clean_ui = df_clean.rename(columns=reverse_map)
    
    # Generate previews
    raw_preview = df_raw.head(20).fillna("").to_dict(orient="records")
    clean_preview = df_clean_ui.head(20).fillna("").to_dict(orient="records")
    
    # Cache the result for ML Comparison tool
    comparison_payload = {
        "raw_preview": raw_preview,
        "clean_preview": clean_preview,
        "report": report,
        "filename": f"Cleaned_{category}.csv",
        "category": category,
        "df_original": df_raw,
        "df_cleaned": df_clean
    }
    set_comparison_data(dataset_id, comparison_payload)
    
    return df_clean, report

def perform_cleaning(dataset_id: str, current_user_id: int) -> None:
    from app.db.session import SessionLocal
    from app.models import Dataset, IndicatorData, CleanedData, AuditLog
    from app.api.v1.clean_status import update_progress
    from app.api.v1.user_activity import increment_activity
    import pandas as pd
    import uuid
    import io
    from datetime import datetime, timezone
    from typing import cast

    db = SessionLocal()
    try:
        print(f"=== WORKER STARTED: perform_cleaning for dataset {dataset_id} ===")
        logger.info(f"=== WORKER STARTED: perform_cleaning for dataset {dataset_id} ===")
        ds_uuid = uuid.UUID(dataset_id)
        dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
        if not dataset:
            logger.error("perform_cleaning: Dataset %s not found", dataset_id)
            return

        dataset.status = 'cleaning_in_progress' # type: ignore
        db.commit()
        update_progress(dataset_id, stage="cleaning_in_progress", progress_percent=10.0, eta_seconds=45, message="Cleaning in progress...")
        import time
        time.sleep(1.5)

        staged_rows = db.query(IndicatorData).filter(IndicatorData.dataset_id == ds_uuid).all()

        if staged_rows:
            # 1. Staged rows path
            df_raw_long = pd.DataFrame([{
                'region': r.region, 'year': r.year, 'gender': r.gender,
                'age_group': r.age_group, 'indicator_name': r.indicator_name,
                'value': float(str(r.value)) if r.value is not None else None
            } for r in staged_rows])
            
            # Pivot to wide format for apply_cleaning_rules
            df_raw_wide = df_raw_long.pivot_table(
                index=["year", "region", "gender", "age_group"],
                columns="indicator_name",
                values="value",
                aggfunc="max"
            ).reset_index()
            df_raw_wide.columns = [c for c in df_raw_wide.columns]
            
            original_rows = len(df_raw_wide)
            original_cols = len(df_raw_wide.columns)
            null_count = int(df_raw_wide.isnull().sum().sum())
            dup_count = int(df_raw_wide.duplicated().sum())

            update_progress(dataset_id, stage="interpolating", progress_percent=35.0, eta_seconds=30, message="Interpolating missing values and removing duplicates...")

            df_clean_wide, report = apply_cleaning_rules(df_raw_wide, dataset_id, str(dataset.category or "census"))
            if "province" in df_clean_wide.columns and "region" not in df_clean_wide.columns:
                df_clean_wide = df_clean_wide.rename(columns={"province": "region"})
            for col, default in {"region": "Total", "year": 2024, "gender": "Total", "age_group": "Total"}.items():
                if col not in df_clean_wide.columns:
                    df_clean_wide[col] = default
            
            # Melt back to long format for insertion
            structural_cols = {'region', 'year', 'gender', 'age_group'}
            indicator_cols = [c for c in df_clean_wide.columns if c.lower() not in structural_cols]
            df_long = df_clean_wide.melt(
                id_vars=['region', 'year', 'gender', 'age_group'],
                value_vars=[c for c in indicator_cols if c in df_clean_wide.columns],
                var_name='indicator_name', value_name='value'
            )

        elif dataset.raw_content:
            # 2. Raw content path
            logger.warning("perform_cleaning: no staged rows in indicators_data for dataset %s — parsing raw_content", dataset_id)
            buffer = io.BytesIO(cast(bytes, dataset.raw_content))
            ext_local = dataset.original_filename.split('.')[-1].lower()
            df_raw_wide = pd.read_csv(buffer) if ext_local == 'csv' else pd.read_excel(buffer)

            original_rows = len(df_raw_wide)
            original_cols = len(df_raw_wide.columns)
            null_count = int(df_raw_wide.isnull().sum().sum())
            dup_count = int(df_raw_wide.duplicated().sum())

            update_progress(dataset_id, stage="interpolating", progress_percent=35.0, eta_seconds=30, message="Interpolating missing values and removing duplicates...")

            df_clean_wide, report = apply_cleaning_rules(df_raw_wide, dataset_id, str(dataset.category or "census"))
            if "province" in df_clean_wide.columns and "region" not in df_clean_wide.columns:
                df_clean_wide = df_clean_wide.rename(columns={"province": "region"})
            for col, default in {"region": "Total", "year": 2024, "gender": "Total", "age_group": "Total"}.items():
                if col not in df_clean_wide.columns:
                    df_clean_wide[col] = default
            
            # Melt back to long format for insertion
            structural_cols = {'region', 'year', 'gender', 'age_group'}
            indicator_cols = [c for c in df_clean_wide.columns if c.lower() not in structural_cols]
            df_long = df_clean_wide.melt(
                id_vars=['region', 'year', 'gender', 'age_group'],
                value_vars=[c for c in indicator_cols if c in df_clean_wide.columns],
                var_name='indicator_name', value_name='value'
            )
            
        else:
            update_progress(dataset_id, stage="failed", progress_percent=0.0, eta_seconds=0, message="No data to clean.")
            dataset.status = "failed" # type: ignore
            db.commit()
            return

        update_progress(dataset_id, stage="persisting", progress_percent=85.0, eta_seconds=5, message="Persisting cleaned data to database...")

        # Atomically replace cleaned_data for this dataset
        db.query(CleanedData).filter(CleanedData.dataset_id == dataset.id).delete()
        
        new_records = []
        for _, row in df_long.iterrows():
            try:
                new_records.append(CleanedData(
                    indicator_name=str(row['indicator_name']),
                    value=float(row['value']),
                    year=int(row['year']),
                    region=str(row['region']),
                    gender=str(row['gender']) if pd.notna(row['gender']) else 'Total',
                    age_group=str(row['age_group']) if pd.notna(row['age_group']) else 'Total',
                    source_file=dataset.original_filename,
                    dataset_id=dataset.id,
                    created_at=datetime.now(timezone.utc)
                ))
            except (ValueError, TypeError):
                continue
                
        db.add_all(new_records)

        # Update dataset metadata
        dataset.row_count = int(original_rows) # type: ignore
        dataset.col_count = int(original_cols) # type: ignore
        dataset.null_count = int(null_count) # type: ignore
        dataset.dupe_count = int(dup_count) # type: ignore
        dataset.status = 'cleaned' # type: ignore

        db.commit()

        score = report.get("score", 1.0) * 100.0

        increment_activity(db, current_user_id, "clean", details={
            "action": "CLEAN_DATA",
            "details": {"filename": dataset.original_filename, "health_score": round(score, 2)}
        })
        db.commit()

        dataset.status = 'cleaned' # type: ignore
        db.commit()
        update_progress(dataset_id, stage="cleaned", progress_percent=100.0, eta_seconds=0, message="Data successfully processed!")
        logger.info("perform_cleaning: successfully cleaned dataset %s", dataset_id)
        print(f"=== WORKER ENDED SUCCESSFULLY: perform_cleaning for dataset {dataset_id} ===")

    except Exception as e:
        db.rollback()
        # Always persist failure telemetry for the Analyst cleaning console
        logger.error(
            "perform_cleaning: failed for dataset %s: %s",
            dataset_id,
            str(e),
            exc_info=True
        )

        try:
            ds_uuid = uuid.UUID(dataset_id)
            dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
            if dataset:
                dataset.status = 'failed'  # type: ignore
                db.commit()
        except Exception as inner_e:
            logger.error(
                "perform_cleaning: failed to update dataset status to failed: %s",
                str(inner_e),
                exc_info=True
            )

        # Best-effort progress update (in-memory)
        try:
            update_progress(
                dataset_id,
                stage="failed",
                progress_percent=0.0,
                eta_seconds=0,
                message=f"Cleaning failed: {type(e).__name__}: {str(e)}"
            )
        except Exception:
            logger.error("perform_cleaning: update_progress(failed) crashed", exc_info=True)
    finally:
        db.close()




@router.post("/clean/{dataset_id}")
async def clean_dataset(
    dataset_id: str,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        ds_uuid = uuid.UUID(dataset_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid dataset ID format")

    dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        dataset.status = "cleaning_in_progress" # type: ignore
        db.commit()

        init_progress(dataset_id)
        background_tasks.add_task(perform_cleaning, dataset_id, cast(int, current_user.id))

        return {
            "status": "success",
            "message": "Cleaning task started in background.",
            "dataset_id": dataset_id,
            "stage": "cleaning_in_progress"
        }
    except Exception as e:
        db.rollback()
        logger.error("Failed to start cleaning task for dataset %s: %s", dataset_id, str(e))
        raise HTTPException(status_code=500, detail=f"Failed to start cleaning task: {str(e)}")


# MOVED TO ADMIN.PY

# --- AUDIT ---
@router.get("/audit")
def get_audit_logs(
    role: Optional[str] = None, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieve system audit logs with user details."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    query = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
    )
    
    if role:
        query = query.filter(User.role == role)
        
    logs = query.order_by(AuditLog.created_at.desc()).limit(100).all()
    
    formatted_logs = []
    for log, user in logs:
        details = {}
        try:
            details = json.loads(log.details) if isinstance(log.details, str) else log.details or {}
        except:
            pass

        formatted_logs.append({
            "id": log.id,
            "user": user.email if user else "System",
            "role": user.role if user else "N/A",
            "action": log.action,
            "dataset": details.get('table_name', details.get('dataset', 'System')),
            "time": log.created_at.isoformat() if log.created_at else "",
            "status": "success", # AuditLog doesn't have status, assuming success for logged actions
            "ip": log.ip_address or "unknown",
            "browser": "N/A", # Not stored currently
            "query": json.dumps(details)[:50]
        })
        
    return formatted_logs

@router.get("/download/{dataset_id}")
async def download_dataset(
    dataset_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Download the original binary file from PostgreSQL.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    import uuid
    try:
        ds_uuid = uuid.UUID(dataset_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid dataset ID")

    dataset = db.query(Dataset).filter(Dataset.id == ds_uuid).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    # Try to fetch cleaned data first as requested by user refactor
    query = db.query(CleanedData).filter(CleanedData.dataset_id == ds_uuid)
    df = pd.read_sql(query.statement, db.bind) # type: ignore

    if not df.empty:
        # Preserve specific columns as requested
        required_cols = ['indicator_name', 'value', 'year', 'region', 'gender', 'age_group']
        existing_cols = [c for c in required_cols if c in df.columns]
        df = df[existing_cols]

        buffer = io.BytesIO()
        df.to_csv(buffer, index=False, encoding='utf-8-sig')
        buffer.seek(0)
        
        filename = f"cleaned_{dataset.original_filename}"
        if not filename.endswith(".csv"):
            filename = filename.split('.')[0] + ".csv"
            
        return StreamingResponse(
            buffer,
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    # Fallback to raw binary if no cleaned data exists
    if not dataset.raw_content:
        raise HTTPException(status_code=404, detail="No data available for this dataset")

    filename = dataset.original_filename
    content = dataset.raw_content
    
    # Extract MIME type
    ext = filename.split('.')[-1].lower()
    if ext == "csv":
        media_type = "text/csv"
    elif ext == "xlsx":
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    else:
        media_type = "application/octet-stream"

    return StreamingResponse(
        io.BytesIO(cast(bytes, content)),
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.post("/audit/log")
def log_action(request: Request, action: str, dataset: str, user: str = "admin@inseed.td", payload: Optional[str] = None):
    log_entry = {
        "id": len(AUDIT_LOGS) + 1,
        "user": user,
        "action": action,
        "dataset": dataset,
        "payload": payload,
        "time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "status": "success",
        "ip": request.client.host if request.client else "unknown",
        "browser": request.headers.get("user-agent", "unknown"),
        "query": f"internal_op_{action.lower().replace(' ', '_')}"
    }
    AUDIT_LOGS.insert(0, log_entry)
    return log_entry

@router.post("/export-cleaned")
async def export_cleaned_data(
    request: Request,
    format: str = Form("csv"),
    region: Optional[str] = Form(None),
    indicator: Optional[str] = Form(None),
    year: Optional[int] = Form(None),
    category: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export cleaned data from cleaned_data table to CSV, Excel, or JSON.
    STRICT PIPELINE: Always reads from cleaned_data, never from indicators_data.
    """
    if current_user.role not in ["admin", "analyst", "researcher", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        query = db.query(CleanedData)
        
        if region:
            query = query.filter(CleanedData.region == region)
        if indicator:
            query = query.filter(CleanedData.indicator_name == indicator)
        if year:
            query = query.filter(CleanedData.year == year)
        if category:
            from sqlalchemy import or_
            query = query.filter(or_(CleanedData.source_file == category, CleanedData.indicator_name == category))

        df = pd.read_sql(query.statement, db.bind)  # type: ignore

        if df.empty:
            raise HTTPException(status_code=404, detail="No cleaned data found matching the filters")

        if not df.empty:
            cols_to_drop = ['id']
            df = df.drop(columns=[c for c in cols_to_drop if c in df.columns])

        # Generate File
        output = io.BytesIO()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"export_{timestamp}.{format if format != 'excel' else 'xlsx'}"
        media_type = "text/csv"

        if format == "csv":
            df.to_csv(output, index=False)
            media_type = "text/csv"
        elif format == "excel":
            for col in df.select_dtypes(include=['datetimetz', 'datetime']).columns: # type: ignore
                df[col] = df[col].dt.tz_localize(None) # type: ignore
            with pd.ExcelWriter(output, engine='openpyxl') as writer:
                df.to_excel(writer, index=False)
            media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif format == "json":
            df.to_json(output, orient="records")
            media_type = "application/json"
        else:
            raise HTTPException(status_code=400, detail="Invalid format. Use csv, excel, or json.")

        output.seek(0)

        # Audit & Activity
        from app.api.v1.user_activity import increment_activity
        params = {
            "region": region,
            "indicator": indicator,
            "year": year,
            "format": format,
            "filename": filename
        }
        
        increment_activity(db, cast(int, current_user.id), "report", details={
            "action": "EXPORT_DATA",
            "details": params
        })

        return StreamingResponse(
            output,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Export failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/preview-cleaned")
async def preview_cleaned_data_stream(
    region: Optional[str] = Query(None),
    indicator: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Preview the top 10 rows of cleaned_data based on filters.
    STRICT PIPELINE: Always reads from cleaned_data.
    """
    if current_user.role not in ["admin", "analyst", "researcher", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    query = db.query(CleanedData)

    if region:
        query = query.filter(CleanedData.region == region)
    if indicator:
        query = query.filter(CleanedData.indicator_name == indicator)
    if year:
        query = query.filter(CleanedData.year == year)
    if category:
        from sqlalchemy import or_
        query = query.filter(or_(CleanedData.source_file == category, CleanedData.indicator_name == category))

    df = pd.read_sql(query.limit(10).statement, db.bind)  # type: ignore
    
    # Sanitation
    df = df.replace([float('inf'), float('-inf')], float('nan'))
    df = df.fillna("")
    
    return {
        "headers": list(df.columns),
        "data": df.to_dict(orient="records")
    }

@router.get("/regions")
async def get_regions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Fetch distinct regions from cleaned_data. STRICT PIPELINE: only cleaned_data."""
    if current_user.role not in ["admin", "analyst", "researcher", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    regions = db.query(CleanedData.region).filter(
        CleanedData.region.isnot(None),
        CleanedData.region != "National"
    ).distinct().all()

    return sorted([r[0] for r in regions if r[0]])


# --- PREDICTIONS & TRENDS ---
@router.post("/predict/calculate")
async def calculate_prediction(
    region: str,
    year: int,
    indicator: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Mocking the model training/calculation logic
    # In a real scenario, this would check for a pre-trained model .pkl
    # and if missing, trigger a simulation using indicators_data.
    
    # 1. Check if model exists (mock check)
    model_name = f"{indicator}_{region}_{year}"
    model_path = os.path.join(ML_DIR, f"{model_name}.pkl")
    
    is_training = not os.path.exists(model_path)
    
    # 2. Simulate data from indicators_data
    df = get_data(db)
    if df is not None:
        regional_data = df[df['region'].str.lower() == region.lower()]
        # If no data for region, fallback to national
        if len(regional_data) == 0:
            regional_data = df
    else:
        regional_data = pd.DataFrame()

    # Model Inference for final year target
    growth_model = load_model("growth_model")
    if growth_model:
        X_pred = pd.DataFrame([[year]], columns=['year'])
        final_pop = growth_model.predict(X_pred)[0]
    else:
        # Fallback to simple growth
        base_val = 15.0 # M
        final_pop = base_val * (1.03 ** (year - 2024))

    # Generate prediction data points (Future trend)
    current_year = 2024
    years = list(range(current_year, year + 1))
    
    prediction = []
    # Interpolate between current and target
    start_pop = regional_data[regional_data['year'] <= 2024]['population'].iloc[-1] if not regional_data.empty and 2024 in regional_data['year'].values else 15.0
    
    # Simple linear interpolation for demonstration, or use the model for each year
    for y in years:
        if growth_model:
            val = growth_model.predict(pd.DataFrame([[y]], columns=['year']))[0]
        else:
            val = start_pop * (1.03 ** (y - current_year))  # type: ignore
        prediction.append({"year": str(y), "value": round(val, 2)})  # type: ignore

    return {
        "status": "success",
        "indicator": indicator,
        "region": region,
        "target_year": year,
        "trained": not is_training,
        "prediction": prediction,
        "confidence_score": 0.96 if not is_training else 0.85,
        "forecasted_growth": round((prediction[-1]["value"] / prediction[0]["value"] - 1) * 100, 1) if prediction[0]["value"] > 0 else 0  # type: ignore
    }

@router.post("/predict/growth")
def predict_growth(year: int, birth_rate: Optional[float] = None, mortality_rate: Optional[float] = None, migration: Optional[float] = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    model = load_model("growth_model")
    if not model:
        raise HTTPException(status_code=503, detail="Growth model not available")
    
    try:
        X_pred = pd.DataFrame([[year]], columns=['year'])
        pred_pop = model.predict(X_pred)[0]
        
        if birth_rate is not None and mortality_rate is not None:
            baseline_growth = (35 - 12 + 2) / 1000
            user_growth = (birth_rate - mortality_rate + (migration or 2)) / 1000
            years_diff = max(0, year - 2024)
            growth_delta = user_growth - baseline_growth
            adjustment_factor = (1 + growth_delta) ** years_diff
            pred_pop = pred_pop * adjustment_factor

        df = get_data(db)
        historical = []
        if df is not None:
             hist_data = df.groupby('year')['population'].mean().reset_index()
             # Fill NaN before to_dict
             hist_data = hist_data.fillna(0)
             historical = hist_data.to_dict(orient='records')

        return {
            "year": year, 
            "predicted_population": int(pred_pop),
            "historical_trend": historical
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/research/trends")
def get_trends(region: Optional[str] = None, db: Session = Depends(get_db)):
    df = get_data(db)
    if df is None:
        raise HTTPException(status_code=503, detail="Data source not available")
    if region:
        df = df[df['region'].str.lower() == region.lower()]
        
    # JSON Safety: Handle NaN/Inf
    df = df.replace([float('inf'), float('-inf')], float('nan'))
    df = df.fillna(0) # or suitable default
    
    data = df.to_dict(orient='records')
    return {"count": len(data), "data": data}

@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "analyst", "researcher", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    df = get_data(db)
    if df is None:
        raise HTTPException(status_code=503, detail="Data source not available")
    
    # INSEED data goes up to 2050. 2024 is a projection.
    total_pop = df[df['year'] == 2024]['population'].sum() if 2024 in df['year'].values else df['population'].max()
    
    # Safe pct_change
    if 'population' in df.columns and len(df) > 1:
        try:
             pop_series = df.groupby('year')['population'].sum().ffill() 
             avg_growth = pop_series.pct_change(fill_method=None).mean() * 100
        except:
             avg_growth = 0
    else:
        avg_growth = 0
        
    if pd.isna(avg_growth): avg_growth = 0
    
    # Real age distribution from DB (summed across regions for 2024)
    age_row = df[df['year'] == 2024]
    if not age_row.empty:
        total = age_row['age_0_14'].sum() + age_row['age_15_64'].sum() + age_row['age_65_plus'].sum()
        if total > 0:
            age_dist = {
                "age014": round(age_row['age_0_14'].sum() / total * 100, 1),
                "age1564": round(age_row['age_15_64'].sum() / total * 100, 1),
                "age65plus": round(age_row['age_65_plus'].sum() / total * 100, 1)
            }
        else:
            age_dist = {"age014": 47.1, "age1564": 50.4, "age65plus": 2.5}
    else:
        age_dist = {"age014": 47.1, "age1564": 50.4, "age65plus": 2.5}

    # Quality metrics from Datasets table
    quality_data = db.query(Dataset).filter(Dataset.status == "CLEANED").limit(5).all()
    quality = [
        {"region": q.original_filename[:15], "completeness": 100 - (q.null_count or 0)/((q.row_count or 1)*(q.col_count or 1))*100, "accuracy": 95}
        for q in quality_data
    ]

    # Real population trend from DB
    yearly_pop = df.groupby('year')['population'].sum().reset_index()
    pop_trend = [
        {"year": int(row.year), "population": round(row.population / 1000000, 1)}
        for index, row in yearly_pop.iterrows() if row.year in [2015, 2020, 2024, 2030, 2040, 2050]
    ]

    return {
        "active_users": 10,
        "server_uptime": "99.9%",
        "database_status": "Healthy",
        "total_records": len(df),
        "current_population_estimate": int(total_pop),
        "avg_growth_rate": f"{round(avg_growth, 2)}%",
        "age_distribution": age_dist,
        "employment_trends": [
            {"year": 2024, "agriculture": 70, "services": 18, "industry": 12}
        ],
        "quality_metrics": quality or [{"region": "National", "completeness": 99, "accuracy": 98}],
        "population_trend": pop_trend
    }

@router.get("/re-download/{filename}")
async def re_download_report(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Fetch the binary data from the file_content column and return a StreamingResponse.
    """
    report = db.query(GeneratedReport).filter(GeneratedReport.file_name == filename).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found in database")

    headers = {"Content-Disposition": f"attachment; filename={report.file_name}"}
    return StreamingResponse(
        io.BytesIO(cast(bytes, report.file_content)),
        media_type=cast(str, report.mime_type),
        headers=headers
    )


# ── Indicator Discovery Endpoint ──────────────────────────────────────────────

@router.get("/indicators", summary="Liste des indicateurs disponibles en BD")
async def get_available_indicators(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns all distinct indicator names that have **cleaned** records in the
    `indicators_data` table.  Used by the Researcher dashboard to populate
    dropdowns and confirm which indicators actually have data.

    Response: [
        { "name": "Population Totale", "record_count": 42, "regions": ["Tchad", …], "years": [2009, 2015, …] },
        …
    ]
    """
    if current_user.role not in ["admin", "analyst", "researcher", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        from sqlalchemy import func as sqlfunc

        # STRICT PIPELINE: query cleaned_data, not indicators_data
        rows = (
            db.query(
                CleanedData.indicator_name,
                sqlfunc.count(CleanedData.id).label("record_count"),
            )
            .group_by(CleanedData.indicator_name)
            .order_by(sqlfunc.count(CleanedData.id).desc())
            .all()
        )

        if not rows:
            return {
                "status": "empty",
                "message": "No cleaned indicator data found. Upload and clean a dataset first.",
                "indicators": []
            }

        result = []
        for row in rows:
            ind_name = row.indicator_name
            regions = [
                r[0] for r in db.query(CleanedData.region)
                .filter(CleanedData.indicator_name == ind_name)
                .distinct().all() if r[0]
            ]
            years = [
                y[0] for y in db.query(CleanedData.year)
                .filter(CleanedData.indicator_name == ind_name)
                .distinct().order_by(CleanedData.year.asc()).all() if y[0]
            ]
            result.append({
                "name": ind_name,
                "record_count": row.record_count,
                "regions": sorted(regions),
                "years": years,
            })

        return {
            "status": "ok",
            "total_indicators": len(result),
            "indicators": result
        }

    except Exception as e:
        logger.error("Failed to fetch indicator list: %s", e)
        raise HTTPException(status_code=500, detail=str(e))
