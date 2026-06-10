"""
analyst.py — DataVision Tchad Analyst-Specific Router
======================================================
Provides endpoints exclusively for the Analyst role:

  POST /pre-flight-check     — Analyze a file's health WITHOUT writing to DB.
  POST /log-ai-repair        — Log the Analyst's AI Repair authorization.

All routes are protected by the get_current_user dependency and require
the authenticated user to have the 'analyst', 'admin', or 'administrator' role.
"""

from __future__ import annotations

import io
import json
import logging
from datetime import datetime, timezone

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.api.v1.auth import get_current_user
from app.core.cleaner import analyze_file_health, apply_strict_numeric_casting
from app.db.session import get_db
from app.ml.cleaner import apply_smart_census_schema
from app.models import User, AuditLog, CleanedData, Dataset
def _to_float(value):
    """Safely convert a SQLAlchemy column value to float, handling None and type errors."""
    try:
        return float(value) if value is not None else 0.0
    except Exception:
        return 0.0
from app.schemas import ReportRequest

logger = logging.getLogger(__name__)

router = APIRouter()

from app.api.v1 import clean_status
router.include_router(clean_status.router)

# ---------------------------------------------------------------------------
# Column schema for ML-compatible census datasets
# ---------------------------------------------------------------------------
# All 10 columns must be present for the Researcher's ML simulation to work.
# Accept 'province' OR 'region' for the geographic column.
MANDATORY_ML_COLS = {
    "year", "gender", "age_group", "population", "ISF", "e0", "TMI", "Cc", "Cm"
}
GEO_COL_ALIASES = {"province", "region"}

COL_LABELS = {
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

# ---------------------------------------------------------------------------
# Allowed roles for any analyst-facing endpoint
# ---------------------------------------------------------------------------
_ALLOWED_ROLES = {"admin", "analyst", "administrator"}


def _require_analyst(current_user: User) -> None:
    """Raise 403 if the authenticated user does not have a permitted role."""
    if current_user.role not in _ALLOWED_ROLES:
        raise HTTPException(
            status_code=403,
            detail="Insufficient permissions. Analyst role or higher required.",
        )


# ---------------------------------------------------------------------------
# Endpoint 1: Pre-Flight Health Check
# ---------------------------------------------------------------------------

@router.post(
    "/pre-flight-check",
    summary="Pre-Flight Data Health Check (No DB Write)",
    description=(
        "Analyzes the uploaded file in-memory using strict numeric casting "
        "and returns a structured health report. "
        "**No data is written to the database.** "
        "The Analyst must explicitly choose to proceed after reviewing the report."
    ),
)
async def pre_flight_check(
    file: UploadFile = File(..., description="CSV or XLSX file to analyze"),
    category: str = Form(..., description="Data category (census, health, economy)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PHASE 1 — Pre-Flight Check:

    1. Validate file format (CSV / XLSX only).
    2. Parse into a pandas DataFrame in-memory (no filesystem writes).
    3. Apply strict numeric casting via cleaner.apply_strict_numeric_casting().
    4. Run diagnostic engine via cleaner.analyze_file_health().
    5. Return the structured health report JSON.

    The Analyst then decides whether to:
      A. Proceed with AI Repair → call /upload then navigate to CleaningConsole.
      B. Abort and fix the file manually.
    """
    _require_analyst(current_user)

    filename = file.filename or "unknown_file"
    ext = filename.rsplit(".", 1)[-1].lower()

    if ext not in {"csv", "xlsx", "xls"}:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '.{ext}'. Use .csv or .xlsx.",
        )

    # ── Read file bytes once ─────────────────────────────────────────────────
    try:
        content = await file.read()
        buffer = io.BytesIO(content)
    except Exception as e:
        logger.error("pre_flight_check: failed to read upload — %s", e)
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")

    # ── Parse into DataFrame ─────────────────────────────────────────────────
    try:
        if ext == "csv":
            df_original = pd.read_csv(buffer)
        else:
            df_original = pd.read_excel(buffer)
    except Exception as e:
        logger.error("pre_flight_check: parse error for '%s' — %s", filename, e)
        raise HTTPException(
            status_code=422,
            detail=f"Could not parse '{filename}': {e}",
        )

    if df_original.empty:
        raise HTTPException(
            status_code=422,
            detail="The uploaded file appears to be empty or has no data rows.",
        )

    # ── Strict casting + diagnostics (entirely in-memory) ────────────────────
    try:
        df_casted = apply_strict_numeric_casting(df_original)
        health_report = analyze_file_health(df_casted, df_original)
    except Exception as e:
        logger.error("pre_flight_check: diagnostic engine error — %s", e)
        raise HTTPException(
            status_code=500,
            detail=f"Diagnostic engine failed: {e}",
        )

    # ── Schema validation for census datasets (ML compatibility gate) ────────
    schema_errors: list = []
    smart_schema = {
        "valid": True,
        "missing_required": [],
        "injected_columns": [],
        "has_geo": True,
        "default_value": 0.0,
    }
    if category == "census":
        _, smart_schema = apply_smart_census_schema(df_original, geo_target="province")

        for col in smart_schema["missing_required"]:
            schema_errors.append({
                "column":  col,
                "label":   COL_LABELS.get(col, col),
                "message": (
                    f"The model cannot prepare the dataset without the "
                    f"'{col}' ({COL_LABELS.get(col, col)}) column."
                ),
            })

    # ── Enrich report with file metadata ────────────────────────────────────
    health_report["filename"]      = filename
    health_report["category"]      = category
    health_report["row_count"]     = len(df_original)
    health_report["col_count"]     = len(df_original.columns)
    health_report["analyst_id"]    = current_user.id
    health_report["analyst_email"] = current_user.email
    health_report["schema_errors"] = schema_errors
    health_report["smart_schema"] = smart_schema
    health_report["injected_columns"] = smart_schema.get("injected_columns", [])
    health_report["ml_compatible"] = (category != "census" or len(schema_errors) == 0)

    logger.info(
        "pre_flight_check: analyst=%s file='%s' total_errors=%d schema_errors=%d",
        current_user.email,
        filename,
        health_report["total_errors"],
        len(schema_errors),
    )

    return health_report


# ---------------------------------------------------------------------------
# Endpoint 2: Log AI Repair Authorization
# ---------------------------------------------------------------------------

@router.post(
    "/log-ai-repair",
    summary="Log Analyst's AI Repair Authorization",
    description=(
        "Creates an immutable AuditLog entry recording that the Analyst "
        "explicitly authorized AI interpolation for detected format errors. "
        "Must be called AFTER the dataset has been uploaded (so a dataset_id exists)."
    ),
)
async def log_ai_repair(
    dataset_id: str = Form(..., description="UUID of the newly created Dataset record"),
    filename: str = Form(..., description="Original filename for human-readable audit trail"),
    format_error_count: int = Form(..., description="Number of FORMAT errors the AI will repair"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    PHASE 3 — Audit Trail:

    Writes a structured entry to the AuditLog table:
      Action : AI_REPAIR_AUTHORIZED
      Details: {
          "analyst_id": <int>,
          "analyst_email": "<email>",
          "filename": "<filename>",
          "dataset_id": "<uuid>",
          "format_errors_authorized": <int>,
          "decision": "AI_INTERPOLATION",
          "timestamp": "<ISO8601>"
      }

    This satisfies INSEED Section A, Item 8 (Testing Evidence) by providing
    a verifiable, timestamped record of every human decision to invoke AI repair.
    """
    _require_analyst(current_user)

    audit_details = {
        "analyst_id": current_user.id,
        "analyst_email": current_user.email,
        "filename": filename,
        "dataset_id": dataset_id,
        "format_errors_authorized": format_error_count,
        "decision": "AI_INTERPOLATION",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "human_readable": (
            f"Analyst {current_user.email} (ID: {current_user.id}) authorized "
            f"AI interpolation for {format_error_count} format error(s) "
            f"in file '{filename}' (dataset: {dataset_id})."
        ),
    }

    try:
        audit_entry = AuditLog(
            user_id=current_user.id,
            action="AI_REPAIR_AUTHORIZED",
            details=audit_details,
            created_at=datetime.utcnow(),
        )
        db.add(audit_entry)
        db.commit()
        db.refresh(audit_entry)

        logger.info(
            "AI_REPAIR_AUTHORIZED: analyst=%s file='%s' format_errors=%d dataset=%s",
            current_user.email,
            filename,
            format_error_count,
            dataset_id,
        )

        return {
            "status": "logged",
            "audit_id": audit_entry.id,
            "message": audit_details["human_readable"],
        }
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to log AI repair authorization: {str(e)}")
        raise HTTPException(status_code=500, detail="Database error while logging authorization.")

@router.get(
    "/overview",
    summary="Get live Analyst Dashboard aggregates",
    description="Returns smoothed population trends, quality metrics, and employment distribution for the Gold Standard dataset.",
)
async def get_analyst_overview(
    region: str = "Tchad",
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Live Overview Aggregator:
    1. Population Trend (2009-2050) from CleanedData.
    2. Data Quality (Radial) from Dataset metadata.
    3. Employment Distribution (Stacked Bar) from CleanedData.
    """
    _require_analyst(current_user)

    GOLD_UUID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"

    # 1. Population Trend (Smoothed)
    pop_data = db.query(CleanedData).filter(
        CleanedData.dataset_id == GOLD_UUID,
        CleanedData.region == region,
        CleanedData.indicator_name == "Population Totale",
        CleanedData.gender == None,
        CleanedData.age_group == None
    ).order_by(CleanedData.year.asc()).all()

    population_trend = [{"year": r.year, "population": _to_float(r.value)} for r in pop_data]

    # 2. Data Quality Metric
    dataset = db.query(Dataset).filter(Dataset.id == GOLD_UUID).first()
    quality_score = 100.0
    if dataset and dataset.row_count and dataset.row_count > 0:
        row_cnt = float(dataset.row_count)  # type: ignore
        null_cnt = float(dataset.null_count or 0)  # type: ignore
        dupe_cnt = float(dataset.dupe_count or 0)  # type: ignore
        total_errors = null_cnt + dupe_cnt
        # Using a conservative calculation for the gauge
        quality_score = max(0.0, 100.0 - (total_errors / row_cnt * 100.0))

    # 3. Employment Distribution (Active Pop sectors trend)
    sectors = ["Primaire", "Secondaire", "Tertiaire"]
    # We aggregate data per year for each sector to show the trend
    employment_trend_data = db.query(
        CleanedData.year,
        CleanedData.indicator_name,
        CleanedData.value
    ).filter(
        CleanedData.dataset_id == GOLD_UUID,
        CleanedData.region == region,
        CleanedData.indicator_name.in_([f"Emploi - {s}" for s in sectors])
    ).order_by(CleanedData.year.asc()).all()

    # Pivot data into a flat format per year
    temp_dict = {}
    for r in employment_trend_data:
        year = r.year
        if year not in temp_dict:
            temp_dict[year] = {"year": year}
        
        # Map DB indicator names to chart keys
        key_map = {
            "Emploi - Primaire": "agriculture",
            "Emploi - Secondaire": "industry",
            "Emploi - Tertiaire": "services"
        }
        chart_key = key_map.get(r.indicator_name, r.indicator_name)
        temp_dict[year][chart_key] = float(r.value) if r.value is not None else 0.0  # type: ignore

    employment_distribution = sorted(list(temp_dict.values()), key=lambda x: x["year"])

    # Summary Stats for Cards
    total_pop_latest = population_trend[-1]["population"] if population_trend else 0
    total_records = db.query(CleanedData).filter(CleanedData.dataset_id == GOLD_UUID).count()
    
    return {
        "summary": {
            "total_population": total_pop_latest,
            "total_records": total_records,
            "quality_score": round(quality_score, 1),
            "active_dataset": dataset.original_filename if dataset else "Gold Standard",
        },
        "population_trend": population_trend,
        "quality_metrics": {
            "score": round(quality_score, 1),
            "rows": total_records,
            "errors": (dataset.null_count or 0) + (dataset.dupe_count or 0) if dataset else 0
        },
        "employment_distribution": employment_distribution
    }

@router.get(
    "/pyramid",
    summary="Get Demographic Pyramid Data",
    description="Returns age-cohort indicators transformed into Recharts format. If no specific cohort data is available for the given year/region, calculates a synthetic distribution.",
)
async def get_analyst_pyramid(
    region: str = "Tchad",
    year: int = 2025,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    _require_analyst(current_user)

    GOLD_UUID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"

    # Try to fetch explicit age-cohort indicators (M_0_4, F_0_4, M_5_9...)
    # Or fallback to gender + age_group column format
    raw_data = db.query(CleanedData).filter(
        CleanedData.dataset_id == GOLD_UUID,
        CleanedData.region == region,
        CleanedData.year == year
    ).all()

    # Dictionary to hold transformed data
    # Format: { '0-4': {'age': '0-4', 'male': 500, 'female': -450}, ... }
    pyramid_map = {}

    total_pop = 0

    for r in raw_data:
        val = _to_float(r.value)  # type: ignore
        if r.indicator_name == "Population Totale" and not r.gender and not r.age_group:
            total_pop = val
        
        # 1. Handle explicit indicator names like 'M_0_4' or 'F_15_19'
        elif r.indicator_name.startswith('M_') or r.indicator_name.startswith('F_'):
            parts = r.indicator_name.split('_')
            if len(parts) >= 3:
                gender = "male" if parts[0] == 'M' else "female"
                if parts[-1] == "plus":
                    age_key = f"{parts[1]}+"
                else:
                    age_key = f"{parts[1]}-{parts[2]}"
                
                if age_key not in pyramid_map:
                    pyramid_map[age_key] = {"age": age_key, "male": 0, "female": 0}
                
                if gender == "male":
                    pyramid_map[age_key]["male"] += int(val)
                else:
                    pyramid_map[age_key]["female"] -= int(val) # Negative for Recharts pyramid

        # 2. Handle DB format using `gender` and `age_group` columns
        elif r.indicator_name == "Population" and r.gender and r.age_group:
            age_key = r.age_group
            # Ensure not Total
            if age_key != "Total" and not age_key.startswith("Part"):
                if age_key not in pyramid_map:
                    pyramid_map[age_key] = {"age": age_key, "male": 0, "female": 0}
                
                gender = r.gender.lower()
                if gender in ["masculin", "male", "m"]:
                    pyramid_map[age_key]["male"] += int(val)
                elif gender in ["feminin", "female", "f"]:
                    pyramid_map[age_key]["female"] -= int(val)

    # Convert to list
    pyramid_data = list(pyramid_map.values())

    # Fallback to Synthetic Distribution if empty
    if not pyramid_data:
        # Standard Chad developing demographic distribution percentages
        synthetic_distribution = {
            "0-4": 18.0, "5-9": 16.0, "10-14": 14.0, "15-19": 11.0,
            "20-24": 9.0, "25-29": 7.5, "30-34": 6.0, "35-39": 5.0,
            "40-44": 4.0, "45-49": 3.0, "50-54": 2.5, "55-59": 1.5,
            "60-64": 1.0, "65-69": 0.8, "70-74": 0.4, "75-79": 0.2, "80+": 0.1
        }
        
        # If total_pop not found for specific year/region, use a baseline
        if total_pop == 0:
            if region == "Tchad":
                total_pop = 18_000_000 # 18M estimate
            else:
                total_pop = 500_000
                
        for age, pct in synthetic_distribution.items():
            # roughly 50.5% female, 49.5% male
            group_pop = total_pop * (pct / 100.0)
            male_pop = int(group_pop * 0.495)
            female_pop = int(group_pop * 0.505)
            
            pyramid_data.append({
                "age": age,
                "male": male_pop,
                "female": -female_pop
            })

    # Sort the data by age bucket
    def age_sorter(item):
        age_str = item["age"]
        if "+" in age_str:
            return 999
        try:
            return int(age_str.split("-")[0])
        except:
            return 0

    pyramid_data.sort(key=age_sorter)

    return {"pyramid_data": pyramid_data}


@router.post(
    "/reports/generate",
    summary="Generate Custom Analyst Report",
    description="Generates a customized report (PDF/Excel) with specific sections, filtered by region and dataset.",
)
async def generate_analyst_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Delegates report generation to the centralized reports service.
    Ensures all analyst-specific filters (dataset_id, region) are applied.
    """
    _require_analyst(current_user)
    from app.api.v1.reports import generate_report
    return await generate_report(request, db, current_user)
