"""
export.py — DataVision Tchad Export Router
==========================================
STRICT DATA PIPELINE: All exports MUST source data from `cleaned_data`.
The system NEVER attempts to query a table named after a filename.

Flow:
  POST /export  → cleaned_data WHERE dataset_id = X  (or full table)
"""

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from typing import Optional, cast
from app.schemas import ExportRequest
from app.api.v1.auth import get_current_user
from app.models import User, CleanedData, Dataset
from app.utils.security_logging import log_security_event
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
import pandas as pd
import io
import json
import re
import uuid as _uuid_module
from datetime import datetime, timezone
from reportlab.lib.pagesizes import landscape, letter
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle
from reportlab.lib import colors
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


def mask_sensitive_data(df: pd.DataFrame) -> pd.DataFrame:
    """Mask/anonymize sensitive columns in the dataframe."""
    df_masked = df.copy()

    sensitive_patterns = [
        r'email', r'phone', r'mobile', r'address', r'name', r'id_number',
        r'ssn', r'credit_card', r'bank_account', r'passport'
    ]

    for col in df_masked.columns:
        col_lower = col.lower()
        if any(re.search(pattern, col_lower) for pattern in sensitive_patterns):
            if df_masked[col].dtype == 'object':
                df_masked[col] = df_masked[col].astype(str).apply(
                    lambda x: f"{x[:2]}***{x[-2:]}" if len(x) > 4 else "***" if x and x != "nan" else x
                )
            else:
                df_masked[col] = "***"

    return df_masked


def _fetch_cleaned_data(
    db: Session,
    dataset_id: Optional[str] = None,
    regions: Optional[list] = None,
    region: Optional[str] = None,
    start_year: Optional[int] = None,
    end_year: Optional[int] = None,
) -> pd.DataFrame:
    """
    SINGLE authoritative function to fetch data for export.
    ALWAYS queries cleaned_data. NEVER reads a table named after a file.

    Priority:
      1. If dataset_id is provided → cleaned_data WHERE dataset_id = X
      2. Otherwise → all of cleaned_data
    Then applies optional region + year filters.
    """
    query = db.query(CleanedData)

    # ── Dataset filter (primary) ──────────────────────────────────────────────
    if dataset_id:
        try:
            ds_uuid = _uuid_module.UUID(dataset_id)
            query = query.filter(CleanedData.dataset_id == ds_uuid)
            logger.info("export: filtering by dataset_id=%s", dataset_id)
        except (ValueError, AttributeError):
            logger.warning("export: invalid dataset_id '%s', ignoring filter", dataset_id)

    # ── Region filter ─────────────────────────────────────────────────────────
    if regions and len(regions) > 0:
        query = query.filter(CleanedData.region.in_(regions))
    elif region and region not in ("National", "Tchad", "all"):
        query = query.filter(CleanedData.region == region)

    # ── Year filters ──────────────────────────────────────────────────────────
    if start_year:
        query = query.filter(CleanedData.year >= start_year)
    if end_year:
        query = query.filter(CleanedData.year <= end_year)

    df = pd.read_sql(query.statement, db.bind)  # type: ignore

    if not df.empty:
        # Return only the canonical export columns
        export_cols = ['indicator_name', 'value', 'year', 'region', 'gender', 'age_group', 'source_file']
        existing_cols = [c for c in export_cols if c in df.columns]
        df = df[existing_cols]

    return df


@router.post("/export")
async def export_data(
    request: ExportRequest,
    request_obj: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Export data to CSV / Excel / JSON / PDF.

    STRICT PIPELINE: Always reads from `cleaned_data`.
    The `table_name` field is used only to distinguish export types (users vs data),
    never to resolve an actual PostgreSQL table name from a filename.
    """
    client_ip = "127.0.0.1"
    if request_obj and request_obj.client:
        client_ip = request_obj.client.host

    table_name_lower = request.table_name.lower() if request.table_name else "cleaned_data"

    # ── Route 1: User table (admin only) ─────────────────────────────────────
    if table_name_lower == "users":
        if current_user.role != "administrator":
            log_security_event(
                db, cast(int, current_user.id), "RESTRICTED_EXPORT_ATTEMPT", client_ip,
                {"table": "users"}
            )
            raise HTTPException(status_code=403, detail="User data export is restricted to administrators.")
        from app.models import User as UserModel
        query = db.query(UserModel)
        df = pd.read_sql(query.statement, db.bind)  # type: ignore

    # ── Route 2: All other exports → cleaned_data (STRICT) ───────────────────
    else:
        # Resolve dataset_id: prefer explicit field, fall back to looking up by filename
        resolved_dataset_id: Optional[str] = request.dataset_id

        # If no dataset_id but table_name looks like a filename, look up by filename
        if not resolved_dataset_id and request.table_name and "." in request.table_name:
            dataset_by_name = db.query(Dataset).filter(
                Dataset.original_filename == request.table_name,
                func.lower(Dataset.status) == "cleaned"
            ).first()
            if dataset_by_name:
                resolved_dataset_id = str(dataset_by_name.id)
                logger.info(
                    "export: resolved filename '%s' → dataset_id=%s",
                    request.table_name, resolved_dataset_id
                )
            else:
                logger.warning(
                    "export: filename '%s' not found in datasets table — will export all cleaned_data",
                    request.table_name
                )

        df = _fetch_cleaned_data(
            db=db,
            dataset_id=resolved_dataset_id,
            regions=request.regions if hasattr(request, 'regions') else None,
            region=request.region if hasattr(request, 'region') else None,
            start_year=request.start_year if hasattr(request, 'start_year') else None,
            end_year=request.end_year if hasattr(request, 'end_year') else None,
        )

    record_count = len(df) if df is not None else 0
    logger.info(
        "export: table='%s' dataset_id='%s' format='%s' records=%d",
        request.table_name, request.dataset_id, request.format, record_count
    )

    if df is None or df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No cleaned data found for the requested export. "
                   f"Ensure the dataset has been cleaned before exporting."
        )

    # ── Apply masking ─────────────────────────────────────────────────────────
    df_masked = mask_sensitive_data(df)

    # ── Build output file ─────────────────────────────────────────────────────
    buffer = io.BytesIO()
    base_name = request.custom_filename or f"export_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}"
    base_name = re.sub(r'[\\/*?:"<>|]', "", base_name)
    filename = base_name
    requested_format = request.format.lower()

    if requested_format == "csv":
        df_masked.to_csv(buffer, sep=',', index=False, encoding='utf-8-sig')
        media_type = "text/csv"
        if not filename.lower().endswith(".csv"):
            filename += ".csv"

    elif requested_format in ["excel", "xlsx"]:
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            sheet_name = (request.table_name or "cleaned_data")[:31]
            df_masked.to_excel(writer, index=False, sheet_name=sheet_name)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if not filename.lower().endswith(".xlsx"):
            filename += ".xlsx"

    elif requested_format == "json":
        df_masked.to_json(buffer, orient="records")
        media_type = "application/json"
        if not filename.lower().endswith(".json"):
            filename += ".json"

    elif requested_format == "pdf":
        doc = SimpleDocTemplate(buffer, pagesize=landscape(letter))
        elements = []
        df_pdf = df_masked.head(500)
        data_list = [df_pdf.columns.tolist()] + df_pdf.values.tolist()
        data_list = [[f"{cell}"[:30] for cell in row] for row in data_list]
        t = Table(data_list)
        t.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
            ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
            ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
            ('BACKGROUND', (0, 1), (-1, -1), colors.white),
            ('GRID', (0, 0), (-1, -1), 1, colors.black)
        ]))
        elements.append(t)
        doc.build(elements)  # type: ignore
        media_type = "application/pdf"
        if not filename.lower().endswith(".pdf"):
            filename += ".pdf"

    else:
        log_security_event(
            db, cast(int, current_user.id), "FAILED_EXPORT", client_ip,
            {"table_name": request.table_name, "format": request.format, "error": "Unsupported format"}
        )
        raise HTTPException(status_code=400, detail="Unsupported format. Use: csv, excel, json, pdf")

    buffer.seek(0)

    # ── Audit & Activity ──────────────────────────────────────────────────────
    log_security_event(
        db,
        cast(int, current_user.id),
        "DATA_EXPORT",
        client_ip,
        {
            "table_name": request.table_name,
            "dataset_id": request.dataset_id,
            "format": request.format,
            "filename": filename,
            "row_count": len(df_masked),
            "anonymized": True,
            "source": "cleaned_data"
        }
    )

    from app.api.v1.user_activity import increment_activity
    increment_activity(db, cast(int, current_user.id), "export", details={
        "action": "EXPORT_DATA",
        "details": {"filename": filename, "format": request.format, "source": "cleaned_data"}
    })

    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
