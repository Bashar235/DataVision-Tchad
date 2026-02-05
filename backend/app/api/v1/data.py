from fastapi import APIRouter, HTTPException, UploadFile, File, Request, Depends
from typing import Optional

import os
import pandas as pd
import joblib
from datetime import datetime
from app.db.session import get_db

router = APIRouter()

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
ML_DIR = os.path.join(BASE_DIR, "ml")
DATA_PATH = os.path.join(ML_DIR, "data", "synthetic_data.csv")

AUDIT_LOGS = [] # In-memory mock
UPLOAD_DIR = os.path.join(ML_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Helpers
def get_data():
    if not os.path.exists(DATA_PATH):
        return None
    return pd.read_csv(DATA_PATH)

models = {}
def load_model(name):
    if name not in models:
        path = os.path.join(ML_DIR, f"{name}.pkl")
        if os.path.exists(path):
            models[name] = joblib.load(path)
        else:
            models[name] = None
    return models[name]

# --- DATA OPS ---
import shutil
from fastapi import Form
from app.api.v1.auth import get_current_user
from app.models import User, AuditLog, Dataset
from sqlalchemy.orm import Session
import json

@router.post("/upload")
async def upload_data(
    file: UploadFile = File(...),
    category: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]: # Support both names for safety
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # File Validation
    filename = file.filename
    ext = filename.split('.')[-1].lower()
    if ext not in ["csv", "xlsx"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Use CSV or XLSX.")

    try:
        # Unique storage path
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        storage_filename = f"{timestamp}_{filename}"
        storage_path = os.path.join(UPLOAD_DIR, storage_filename)
        
        # Save file
        with open(storage_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        # Create Dataset record
        new_dataset = Dataset(
            original_filename=filename,
            storage_path=storage_path,
            status="PENDING",
            category=category,
            user_id=current_user.id
        )
        db.add(new_dataset)
        
        # Legacy Audit Log for UI compatibility
        audit = AuditLog(
            user_id=current_user.id,
            action="UPLOAD_DATA",
            details=json.dumps({
                "filename": filename,
                "category": category,
                "dataset_id": new_dataset.id
            }),
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        db.refresh(new_dataset)

        return {
            "status": "success", 
            "id": new_dataset.id,
            "filename": filename, 
            "message": "File uploaded and pending cleaning"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

@router.get("/datasets")
async def get_datasets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    datasets = db.query(Dataset).order_by(Dataset.created_at.desc()).all()
    # Serialize for frontend
    return [
        {
            "id": d.id,
            "name": d.original_filename,
            "status": d.status,
            "category": d.category,
            "date": d.created_at.isoformat(),
            "user_id": d.user_id,
            "row_count": d.row_count,
            "col_count": d.col_count,
            "null_count": d.null_count,
            "dupe_count": d.dupe_count,
            "health_score": round(100 * (1 - (d.null_count + d.dupe_count) / (d.row_count * d.col_count)), 2) if d.row_count and d.col_count else 100.0
        } for d in datasets
    ]

@router.get("/preview/{dataset_id}")
async def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    
    if not os.path.exists(dataset.storage_path):
        raise HTTPException(status_code=404, detail="Physical file missing")

    try:
        ext = dataset.original_filename.split('.')[-1].lower()
        if ext == "csv":
            df = pd.read_csv(dataset.storage_path, nrows=10)
        else:
            df = pd.read_excel(dataset.storage_path, nrows=10)
        
        # Safe JSON conversion
        df = df.replace([float('inf'), float('-inf')], float('nan'))
        df = df.fillna("")
        
        return {
            "id": dataset.id,
            "filename": dataset.original_filename,
            "headers": list(df.columns),
            "data": df.to_dict(orient="records")
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Preview failed: {str(e)}")

@router.post("/clean/{dataset_id}")
async def clean_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    try:
        ext = dataset.original_filename.split('.')[-1].lower()
        if ext == "csv":
            df = pd.read_csv(dataset.storage_path)
        else:
            df = pd.read_excel(dataset.storage_path)

        original_rows = len(df)
        original_cols = len(df.columns)
        null_count = int(df.isnull().sum().sum())
        dup_count = int(df.duplicated().sum())

        # Cleaning Logic
        df.drop_duplicates(inplace=True)
        
        # Fill missing values
        for col in df.select_dtypes(include=['number']).columns:
            df[col] = df[col].fillna(0)
        for col in df.select_dtypes(include=['object']).columns:
            df[col] = df[col].fillna("")

        # Save cleaned file (overwrite original storage for simplicity)
        df.to_csv(dataset.storage_path, index=False)
        
        # Update metrics and status
        dataset.row_count = original_rows
        dataset.col_count = original_cols
        dataset.null_count = null_count
        dataset.dupe_count = dup_count
        dataset.status = "CLEANED"
        db.commit()

        # Score calculation for the response
        total_cells = original_rows * original_cols
        score = 100.0
        if total_cells > 0:
            score = 100 * (1 - (null_count + dup_count) / total_cells)
            score = max(0, round(score, 2))

        return {
            "status": "success",
            "summary": {
                "rows_cleaned": original_rows,
                "nulls_fixed": null_count,
                "duplicates_removed": dup_count,
                "health_score": score
            }
        }
    except Exception as e:
        dataset.status = "ERROR"
        db.commit()
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")

    except Exception as e:
        # cleanup if needed
        raise HTTPException(status_code=500, detail=f"Processing error: {str(e)}")

# MOVED TO ADMIN.PY

# --- AUDIT ---
@router.get("/audit")
def get_audit_logs(role: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(AuditLog).order_by(AuditLog.created_at.desc())
    
    if role and role != "admin": # Admin sees all
        pass
        
    logs = query.all()
    return logs

@router.post("/audit/log")
def log_action(request: Request, action: str, dataset: str, user: str = "admin@inseed.td", payload: str = None):
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

@router.get("/export")
def export_data(request: Request, format: str, dataset: str):
    log_action(request, f"Export {format}", dataset)
    return {"status": "success", "download_url": f"/files/export_{datetime.now().timestamp()}.{format}"}

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
    df = get_data()
    if df is not None:
        regional_data = df[df['region'] == region]
        # If no data for region, fallback to national
        if len(regional_data) == 0:
            regional_data = df
    else:
        regional_data = pd.DataFrame()

    # Generate prediction data points (Future trend)
    current_year = 2024
    years = list(range(current_year, year + 1))
    
    # Simple linear growth simulation for mock
    base_val = 18.0 if indicator == "population" else 4.2 if indicator == "gdp" else 62.0
    growth_rate = 0.02 if indicator == "population" else 0.04 if indicator == "gdp" else 0.01
    
    prediction = []
    for y in years:
        val = base_val * (1 + growth_rate) ** (y - current_year)
        prediction.append({"year": str(y), "value": round(val, 2)})

    return {
        "status": "success",
        "indicator": indicator,
        "region": region,
        "target_year": year,
        "trained": is_training,
        "prediction": prediction,
        "confidence_score": 0.94 if not is_training else 0.88,
        "forecasted_growth": round((prediction[-1]["value"] / prediction[0]["value"] - 1) * 100, 1)
    }

@router.post("/predict/growth")
def predict_growth(year: int, birth_rate: Optional[float] = None, mortality_rate: Optional[float] = None, migration: Optional[float] = None, current_user: User = Depends(get_current_user)):
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

        df = get_data()
        historical = []
        if df is not None:
             hist_data = df.groupby('year')['population'].mean().reset_index()
             # Fill NaN before to_dict
             hist_data = hist_data.fillna(0)
             historical = hist_data.to_dict(orient='records')

        return {
            "year": year, 
            "predicted_population": round(pred_pop, 2),
            "historical_trend": historical
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/research/trends")
def get_trends(region: Optional[str] = None):
    df = get_data()
    if df is None:
        raise HTTPException(status_code=503, detail="Data source not available")
    if region:
        df = df[df['region'] == region]
        
    # JSON Safety: Handle NaN/Inf
    df = df.replace([float('inf'), float('-inf')], float('nan'))
    df = df.fillna(0) # or suitable default
    
    data = df.to_dict(orient='records')
    return {"count": len(data), "data": data}

@router.get("/stats")
def get_admin_stats():
    df = get_data()
    if df is None:
        raise HTTPException(status_code=503, detail="Data source not available")
    
    total_pop = df[df['year'] == 2024]['population'].sum() if 2024 in df['year'].values else 0
    
    # Safe pct_change
    if 'population' in df.columns and len(df) > 1:
        # Use simple pct_change handling NA
        try:
             # pct_change default fill_method warning fix: specify None or fill before
             pop_series = df['population'].ffill() 
             avg_growth = pop_series.pct_change(fill_method=None).mean() * 100 # set fill_method=None to avoid warning
        except:
             avg_growth = 0
    else:
        avg_growth = 0
        
    # Handle NaN in avg_growth
    if pd.isna(avg_growth): avg_growth = 0
    
    return {
        "active_users": 10,
        "server_uptime": "99.9%",
        "database_status": "Healthy",
        "total_records": len(df),
        "current_population_estimate": int(total_pop),
        "avg_growth_rate": f"{round(avg_growth, 2)}%"
    }
