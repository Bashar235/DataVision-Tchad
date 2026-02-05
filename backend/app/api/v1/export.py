from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from app.schemas import ExportRequest
from app.api.v1.data import get_data
from app.api.v1.auth import get_current_user
from app.models import User
from app.utils.security_logging import log_security_event
from sqlalchemy.orm import Session
from app.db.session import get_db
import pandas as pd
import io
import json
import re
from datetime import datetime

router = APIRouter()

def mask_sensitive_data(df: pd.DataFrame) -> pd.DataFrame:
    """Mask/anonymize sensitive columns in the dataframe."""
    df_masked = df.copy()
    
    # Common sensitive column patterns
    sensitive_patterns = [
        r'email', r'phone', r'mobile', r'address', r'name', r'id_number',
        r'ssn', r'credit_card', r'bank_account', r'passport'
    ]
    
    for col in df_masked.columns:
        col_lower = col.lower()
        # Check if column matches sensitive patterns
        if any(re.search(pattern, col_lower) for pattern in sensitive_patterns):
            # Mask the data (keep first/last chars, mask middle)
            if df_masked[col].dtype == 'object':
                df_masked[col] = df_masked[col].astype(str).apply(
                    lambda x: f"{x[:2]}***{x[-2:]}" if len(x) > 4 else "***" if x and x != "nan" else x
                )
            else:
                df_masked[col] = "***"
    
    return df_masked

@router.post("/export") # Relative to /api/admin as per user request mapping, or /api/v1/export
async def export_data(
    request: ExportRequest,
    request_obj: Request = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Fetch Data (Mocking selection based on table_name for now as we have one main source)
    # In a real scenario, this would query specific SQL tables via SQLAlchemy
    df = get_data()
    
    if df is None:
        raise HTTPException(status_code=503, detail="Data source unavailable")

    # Filter mock logic based on table name (just for demonstration of "Query requested table")
    if request.table_name.lower() == "employment":
        # Return a subset columns if it were real
        pass
    
    # Apply masking/anonymization
    df_masked = mask_sensitive_data(df)
    
    # Get client IP for logging
    client_ip = "127.0.0.1"
    if request_obj:
        client_ip = request_obj.client.host if request_obj.client else "127.0.0.1"
    
    buffer = io.BytesIO()
    
    # Use custom filename if provided, otherwise generate one
    base_name = request.custom_filename or f"{request.table_name}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    
    # Sanitization (though better handled at the input modal, backend should be safe too)
    base_name = re.sub(r'[\\/*?:"<>|]', "", base_name)
    
    filename = base_name
    if request.format.lower() == "csv":
        df_masked.to_csv(buffer, sep=',', index=False, encoding='utf-8-sig')
        media_type = "text/csv"
        if not filename.lower().endswith(".csv"):
            filename += ".csv"
    elif request.format.lower() == "excel":
        with pd.ExcelWriter(buffer, engine='openpyxl') as writer:
            df_masked.to_excel(writer, index=False, sheet_name=request.table_name)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if not filename.lower().endswith(".xlsx"):
            filename += ".xlsx"
    elif request.format.lower() == "json":
        df_masked.to_json(buffer, orient="records")
        media_type = "application/json"
        if not filename.lower().endswith(".json"):
            filename += ".json"
    else:
        raise HTTPException(status_code=400, detail="Unsupported format")
        
    buffer.seek(0)
    
    # Log security event for export
    log_security_event(
        db,
        current_user.id,
        "DATA_EXPORT",
        client_ip,
        {
            "table_name": request.table_name,
            "format": request.format,
            "filename": filename,
            "row_count": len(df_masked),
            "anonymized": True
        }
    )
    
    return StreamingResponse(
        buffer,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
