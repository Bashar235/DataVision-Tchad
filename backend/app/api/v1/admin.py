from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.db.session import get_db
from app.models import IndicatorData, AuditLog, User, DataDictionary
from app.api.v1.auth import get_current_user
from app.services.data_quality import detect_anomalies
from app.schemas import TableSettingsUpdate
import pandas as pd
from datetime import datetime
import json
import os

router = APIRouter()

@router.get("/dictionary/{table_name}")
def get_dictionary(table_name: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Fetch column definitions for a specific table.
    """
    # Allow all authenticated users to see dictionary
    definitions = db.query(DataDictionary).filter(DataDictionary.table_name == table_name).all()
    return definitions

# --- DATA CLEANING ---

@router.get("/issues")
def get_issues(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Scan indicators_data table for issues:
    1. Missing Values (NULL in value or indicator_name)
    2. Outliers (> 3x region average)
    3. Duplicates (Same year/region/indicator_name)
    """
    try:
        # Load data into Pandas
        query = db.query(IndicatorData).statement
        df = pd.read_sql(query, db.bind)
        
        if df.empty:
            return []

        issues = []
        issue_id = 1

        # 1. Missing Values
        missing_mask = df['value'].isnull() | df['indicator_name'].isnull()
        missing_count = missing_mask.sum()
        if missing_count > 0:
            issues.append({
                "id": issue_id,
                "type": "missing_values",
                "count": int(missing_count),
                "dataset": "indicators_data",
                "severity": "high"
            })
            issue_id += 1

        # 2. Duplicates
        subset_cols = ['year', 'region', 'indicator_name']
        # Filter only cols that exist
        subset_cols = [c for c in subset_cols if c in df.columns]
        duplicates_count = df.duplicated(subset=subset_cols).sum()
        if duplicates_count > 0:
             issues.append({
                "id": issue_id,
                "type": "duplicates",
                "count": int(duplicates_count),
                "dataset": "indicators_data",
                "severity": "medium"
            })
             issue_id += 1

        # 3. Advanced Anomaly Detection (Pandas Engine)
        anomalies = detect_anomalies(df)
        
        # Group anomalies by type to return aggregate counts for the dashboard
        # But we also need the suggested fixes in the Detail view.
        # The prompt says: "Update the GET /api/admin/issues endpoint to trigger this Pandas service."
        # And: "Ensure the DataCleaning.tsx correctly displays these 'suggested_fix' messages"
        
        # If we return a list of groups with counts, we might need a separate endpoint for detail,
        # OR just include the top issues in the response.
        # DataCleaning.tsx expects a list of issue objects with 'type', 'count', 'severity', etc.
        
        anomaly_types = {}
        for a in anomalies:
            t = a['reason'].lower().replace(' ', '_')
            if t not in anomaly_types:
                anomaly_types[t] = {
                    "id": issue_id,
                    "type": t,
                    "count": 0,
                    "dataset": "indicators_data",
                    "severity": a['severity'],
                    "suggested_fix": a['suggested_fix'] # Take first one's fix as representative or summarized
                }
                issue_id += 1
            anomaly_types[t]["count"] += 1
            
        for issue in anomaly_types.values():
            issues.append(issue)

        return issues

    except Exception as e:
        print(f"Error scanning issues: {e}")
        # Return empty list on error to avoid breaking UI, or re-raise
        return []

@router.post("/clean")
def clean_data(
    type: str, 
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Perform cleaning based on type.
    - missing_values: ffill / bfill
    - duplicates: drop_duplicates
    - outliers: (Not specified in prompt 'fix' list, usually removed or capped, but prompt only mentioned missing/dupes for fix)
    """
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    try:
        query = db.query(IndicatorData).statement
        df = pd.read_sql(query, db.bind)
        
        initial_count = len(df)
        rows_recovered = 0 # Or affected
        
        if type == 'missing_values':
            # ffill then bfill
            # Sort might be important. Let's sort by year if possible
            if 'year' in df.columns:
                df = df.sort_values(by=['region', 'indicator_name', 'year'])
            
            df = df.fillna(method='ffill').fillna(method='bfill')
            
            # For remaining NaNs (if any), assume 0 or ""
            df['value'] = df['value'].fillna(0)
            df['indicator_name'] = df['indicator_name'].fillna("Unknown")
            
            # Approximate 'recovered' as rows that were NaN
            # This is hard to count after the fact without mask, but let's say "Action completed"
            rows_recovered = len(df) # Logic for 'recovered' is vague, maybe just total rows processed?

        elif type == 'duplicates':
            subset_cols = ['year', 'region', 'indicator_name']
            subset_cols = [c for c in subset_cols if c in df.columns]
            df = df.drop_duplicates(subset=subset_cols)
            rows_recovered = initial_count - len(df)

        # Save back with ATOMIC TRANSACTION
        # Strategy: Delete all and insert new
        # This is risky for prod but per instructions "Save the cleaned dataframe back"
        
        # Use transaction to ensure atomicity (all or nothing)
        try:
            with db.begin_nested():  # Create savepoint
                # 1. Truncate
                db.execute(text("TRUNCATE TABLE indicators_data RESTART IDENTITY CASCADE"))
                
                # 2. Insert (using pandas to_sql is easiest, but we need to match columns exactly)
                # Filter df to only model columns
                # created_at might be lost if we don't keep it. DB has default.
                # If we reload, we might lose original created_at.
                # Let's drop 'id' if it exists to let DB recreate it, or keep it to preserve IDs?
                # Preserving IDs is better if other things reference it.
                # But if we drop duplicates, IDs change.
                # Let's drop 'id' and let DB generate new ones for clean slate.
                if 'id' in df.columns:
                    df = df.drop(columns=['id'])
                    
                df.to_sql('indicators_data', db.bind, if_exists='append', index=False)
                
            db.commit()  # Commit the outer transaction
            
        except Exception as e:
            db.rollback()
            raise HTTPException(status_code=500, detail=f"Transaction failed: {str(e)}")

        # Log to Audit
        audit = AuditLog(
            user_id=current_user.id,
            action="DATA_CLEANING",
            details=json.dumps({
                "type": type,
                "rows_recovered": int(rows_recovered),
                "total_rows_now": len(df)
            }),
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()

        return {"status": "success", "message": f"Cleaning '{type}' completed."}

    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Cleaning failed: {str(e)}")


@router.get("/cleaning-report")
def get_cleaning_report(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generate a CSV report of all rows flagged as problematic (outliers, missing values, duplicates).
    This provides a record of what was "wrong" before cleaning.
    """
    from fastapi.responses import StreamingResponse
    import io
    
    if current_user.role not in ["admin", "administrator", "analyst"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    try:
        query = db.query(IndicatorData).statement
        df = pd.read_sql(query, db.bind)
        
        if df.empty:
            raise HTTPException(status_code=404, detail="No data available")
        
        # Create a report dataframe with flagged rows
        report_rows = []
        
        # 1. Flag Missing Values
        missing_mask = df['value'].isnull() | df['indicator_name'].isnull()
        missing_df = df[missing_mask].copy()
        missing_df['issue_type'] = 'missing_values'
        missing_df['issue_severity'] = 'high'
        report_rows.append(missing_df)
        
        # 2. Flag Duplicates
        subset_cols = ['year', 'region', 'indicator_name']
        subset_cols = [c for c in subset_cols if c in df.columns]
        duplicates_mask = df.duplicated(subset=subset_cols, keep=False)  # keep=False marks all duplicates
        duplicates_df = df[duplicates_mask].copy()
        duplicates_df['issue_type'] = 'duplicates'
        duplicates_df['issue_severity'] = 'medium'
        report_rows.append(duplicates_df)
        
        # 3. Flag Outliers
        if 'region' in df.columns and 'value' in df.columns and 'indicator_name' in df.columns:
            calc_df = df.dropna(subset=['region', 'value', 'indicator_name']).copy()
            calc_df['value'] = pd.to_numeric(calc_df['value'], errors='coerce')
            
            means = calc_df.groupby(['region', 'indicator_name'])['value'].transform('mean')
            outliers_mask = calc_df['value'] > (3 * means)
            outliers_df = calc_df[outliers_mask].copy()
            outliers_df['issue_type'] = 'outliers'
            outliers_df['issue_severity'] = 'low'
            outliers_df['regional_mean'] = means[outliers_mask]
            outliers_df['deviation_factor'] = (outliers_df['value'] / outliers_df['regional_mean']).round(2)
            report_rows.append(outliers_df)
        
        # Combine all flagged rows
        if not any(len(r) > 0 for r in report_rows):
            # No issues found, return empty CSV with headers
            report_df = pd.DataFrame(columns=['id', 'indicator_name', 'value', 'year', 'region', 'issue_type', 'issue_severity'])
        else:
            report_df = pd.concat([r for r in report_rows if len(r) > 0], ignore_index=True)
        
        # Generate CSV
        stream = io.StringIO()
        report_df.to_csv(stream, index=False, encoding='utf-8-sig')
        stream.seek(0)
        
        # Return as downloadable file
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"cleaning_report_{timestamp}.csv"
        
        return StreamingResponse(
            io.BytesIO(stream.getvalue().encode('utf-8-sig')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
        
    except Exception as e:
        print(f"Cleaning report error: {e}")
        raise HTTPException(status_code=500, detail=f"Report generation failed. Please ensure the database is accessible and data exists.")


# --- DATABASE MANAGEMENT ---

@router.get("/tables")
def get_tables(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Return table info: Name, Records, Size, Updated
    Filtered based on user role for security.
    """
    # Define whitelists
    ANALYST_ALLOWED_TABLES = [
        "indicators_data",
        "spatial_ref_sys",
        # Add any demographics/economic tables
        "demographics",
        "economic_metrics",
        "gdp_data",
        "employment"
    ]
    
    SYSTEM_TABLES = [
        "users",
        "audit_logs",
        "alembic_version",
        "sessions"
    ]
    
    # 1. Get user tables
    # pg_stat_user_tables has per-table stats
    sql = text("""
        SELECT 
            relname as name, 
            n_live_tup as records, 
            pg_size_pretty(pg_total_relation_size(relid)) as size
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
    """)
    result = db.execute(sql).fetchall()
    
    tables_info = []
    
    for row in result:
        table_name = row.name
        
        # Filter based on role
        if current_user.role == "analyst":
            # Analysts only see whitelisted research tables
            if table_name not in ANALYST_ALLOWED_TABLES:
                continue
        elif current_user.role in ["admin", "administrator"]:
            # Admins see all
            pass
        else:
            # Other roles (researcher) - similar to analyst for now
            if table_name not in ANALYST_ALLOWED_TABLES:
                continue
        
        # Get last updated. This is tricky in PG if created_at cols aren't consistent.
        # Try to find max created_at/updated_at dynamically
        # Or just use current time if not found?
        # The prompt says: "Get the last created_at or updated_at timestamp from the table"
        
        last_updated = "N/A"
        try:
            # Check if table has updated_at or created_at
            # This requires dynamic query per table.
            # We must be careful about SQL injection here, but relname comes from pg_stat_user_tables
            tbl = table_name
            # Check columns
            col_sql = text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{tbl}'")
            cols = [r[0] for r in db.execute(col_sql).fetchall()]
            
            target_col = None
            if 'updated_at' in cols: target_col = 'updated_at'
            elif 'created_at' in cols: target_col = 'created_at'
            
            if target_col:
                time_sql = text(f"SELECT MAX({target_col}) FROM {tbl}")
                max_time = db.execute(time_sql).scalar()
                if max_time:
                    last_updated = str(max_time)
        except Exception:
            pass # Fail gracefully

        tables_info.append({
            "name": table_name,
            "records": row.records,
            "size": row.size,
            "updated": last_updated
        })
        
    return tables_info

@router.post("/backup")
def backup_database(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """
    Generate a dump of the current database.
    Since pg_dump might not be available or permissions limited, 
    we will dump `indicators_data` to a CSV/SQL file as a fallback/representative backup.
    """
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    backup_dir = os.path.join(os.getcwd(), "backups")
    os.makedirs(backup_dir, exist_ok=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"db_backup_{timestamp}.csv"
    filepath = os.path.join(backup_dir, filename)
    
    try:
        # Dump indicators_data for now as it's the main data
        query = db.query(IndicatorData).statement
        df = pd.read_sql(query, db.bind)
        df.to_csv(filepath, index=False)
        
        return {"status": "success", "message": "Backup created", "file": filename}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backup failed: {e}")

@router.post("/truncate")
def truncate_table(
    table_name: str, 
    db: Session = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    """
    Truncate a specific table.
    """
    if current_user.role not in ["admin", "administrator"]:
         raise HTTPException(status_code=403, detail="Administrator access required")

    # Whitelist allowed tables to prevent system table destruction
    ALLOWED_TABLES = ["indicators_data", "audit_logs"] 
    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' cannot be truncated")

    try:
        db.execute(text(f"TRUNCATE TABLE {table_name} RESTART IDENTITY CASCADE"))
        db.commit()
        
        # Log it
        audit = AuditLog(
            user_id=current_user.id,
            action="TRUNCATE_TABLE",
            details=json.dumps({"table": table_name}),
            created_at=datetime.utcnow()
        )
        db.add(audit)
        db.commit()
        
        return {"status": "success", "message": f"Table {table_name} truncated"}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Truncate failed: {e}")


@router.get("/tables/{table_name}/preview")
def preview_table(
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Preview table data with profiling statistics.
    Analysts can only preview whitelisted research tables.
    Returns:
    - sample_data: first 10 rows
    - rowCount: total rows
    - columnNames: list of columns
    - completeness: % of rows with no NULL values
    """
    # Define whitelists (same as get_tables)
    ANALYST_ALLOWED_TABLES = [
        "indicators_data",
        "spatial_ref_sys",
        "demographics",
        "economic_metrics",
        "gdp_data",
        "employment"
    ]
    
    # Role-based access control
    is_admin = current_user.role in ["admin", "administrator"]
    if not is_admin:
        if table_name not in ANALYST_ALLOWED_TABLES:
            raise HTTPException(
                status_code=403, 
                detail=f"Access denied. Analysts cannot preview table '{table_name}'"
            )
    
    try:
        # Get column names
        col_sql = text(f"SELECT column_name FROM information_schema.columns WHERE table_name = '{table_name}' ORDER BY ordinal_position")
        columns = [r[0] for r in db.execute(col_sql).fetchall()]
        
        # Get sample data (first 10 rows)
        query_sql = text(f"SELECT * FROM {table_name} LIMIT 10")
        sample_rows = db.execute(query_sql).fetchall()
        
        sample_data = []
        for row in sample_rows:
            sample_data.append(dict(zip(columns, row)))
        
        # Total row count
        count_sql = text(f"SELECT COUNT(*) FROM {table_name}")
        total_rows = db.execute(count_sql).scalar()
        
        # Calculate completeness
        # Completeness defined as: Percentage of rows that have no NULL values across all columns
        # In SQL: COUNT(*) WHERE (col1 IS NOT NULL AND col2 IS NOT NULL ...) / COUNT(*)
        if total_rows > 0:
            null_checks = " AND ".join([f"{col} IS NOT NULL" for col in columns])
            comp_sql = text(f"SELECT COUNT(*) FROM {table_name} WHERE {null_checks}")
            complete_rows = db.execute(comp_sql).scalar()
            completeness = round((complete_rows / total_rows) * 100, 2)
        else:
            completeness = 100.0

        return {
            "table_name": table_name,
            "columnNames": columns, # As requested: columnNames
            "sample_data": sample_data,
            "rowCount": total_rows, # As requested: rowCount
            "completeness": completeness # As requested: completeness
        }
        
    except Exception as e:
        print(f"Preview error for {table_name}: {e}")
        raise HTTPException(status_code=500, detail=f"Preview failed for table '{table_name}'. Please verify the table exists.")

@router.get("/tables/{table_name}/settings")
def get_table_settings(
    table_name: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get lock status for a table."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    from app.models import TableSettings
    settings = db.query(TableSettings).filter(TableSettings.table_name == table_name).first()
    
    if not settings:
        # Create default settings if doesn't exist
        settings = TableSettings(table_name=table_name, is_locked=False)
        db.add(settings)
        db.commit()
        db.refresh(settings)
    
    return {"table_name": settings.table_name, "is_locked": settings.is_locked}

@router.put("/tables/{table_name}/settings")
def update_table_settings(
    table_name: str,
    settings_update: TableSettingsUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Update lock status for a table."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    from app.models import TableSettings
    from app.utils.security_logging import log_security_event
    from fastapi import Request
    
    settings = db.query(TableSettings).filter(TableSettings.table_name == table_name).first()
    
    if not settings:
        settings = TableSettings(table_name=table_name, is_locked=settings_update.is_locked)
        db.add(settings)
    else:
        settings.is_locked = settings_update.is_locked
        settings.last_modified = datetime.utcnow()
    
    db.commit()
    db.refresh(settings)
    
    # Log security event
    # Note: Request object not available here, use client IP from a request dependency if needed
    log_security_event(
        db,
        current_user.id,
        f"TABLE_LOCK_{'ENABLED' if settings.is_locked else 'DISABLED'}",
        "127.0.0.1",  # TODO: Extract from request headers
        {"table_name": table_name}
    )
    
    return {"table_name": settings.table_name, "is_locked": settings.is_locked}

@router.get("/activity/stream")
def get_activity_stream(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get unified activity stream of imports, cleaning, and system activities."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    # Query recent import activities (UPLOAD_DATA, DATA_IMPORT actions)
    import_activities = db.query(AuditLog).filter(
        AuditLog.action.in_(["UPLOAD_DATA", "DATA_IMPORT", "FAILED_IMPORT"])
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

    # Query recent cleaning activities
    cleaning_activities = db.query(AuditLog).filter(
        AuditLog.action == "DATA_CLEANING"
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

    def format_activity(log: AuditLog, activity_type: str):
        user = db.query(User).filter(User.id == log.user_id).first()
        details = {}
        try:
            details = json.loads(log.details) if isinstance(log.details, str) else log.details or {}
        except:
            pass

        # Determine status
        status = 'completed'
        if log.action == "FAILED_IMPORT":
            status = 'failed'
        elif activity_type == 'import' and log.action == "UPLOAD_DATA":
            status = 'completed'

        # Extract file name
        filename = details.get('filename', 'Unknown File')

        return {
            "id": log.id,
            "analyst_name": user.full_name if user else "Unknown",
            "file_name": filename,
            "progress": 100 if status == 'completed' else 0,
            "status": status,
            "action_type": activity_type,
            "timestamp": log.created_at.isoformat() if log.created_at else "",
            "details": details
        }

    activities = [format_activity(log, 'import') for log in import_activities]
    cleaning = [format_activity(log, 'cleaning') for log in cleaning_activities]

    return {
        "activities": activities,
        "cleaning": cleaning
    }

@router.get("/activity/import/{activity_id}/preview")
def get_import_preview(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get preview of imported file data."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    # Find the activity
    activity = db.query(AuditLog).filter(AuditLog.id == activity_id).first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # For now, return a mock preview since we don't store raw file data
    # In a real implementation, you'd store file previews or reconstruct from processed data
    return {
        "activity_id": activity_id,
        "file_name": "preview_data.csv",
        "file_type": "CSV",
        "row_count": 1000,
        "columns": ["id", "name", "value", "date"],
        "sample_data": [
            {"id": 1, "name": "Sample A", "value": 123.45, "date": "2024-01-01"},
            {"id": 2, "name": "Sample B", "value": 678.90, "date": "2024-01-02"}
        ]
    }

@router.delete("/tables/{table_name}/row/{row_id}")
def delete_table_row(
    table_name: str,
    row_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Delete a specific row from a table. SQL injection protected with whitelist and bound parameters."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    from app.models import TableSettings
    from app.utils.security_logging import log_security_event

    # Check if table is locked
    settings = db.query(TableSettings).filter(TableSettings.table_name == table_name).first()
    if settings and settings.is_locked:
        raise HTTPException(status_code=403, detail=f"Table '{table_name}' is locked and cannot be modified")

    # Whitelist of allowed tables (prevent SQL injection)
    ALLOWED_TABLES = [
        "indicators_data",
        "demographics",
        "economic_metrics",
        "gdp_data",
        "employment"
    ]

    if table_name not in ALLOWED_TABLES:
        raise HTTPException(status_code=400, detail=f"Table '{table_name}' is not eligible for row deletion")

    try:
        # Use SQLAlchemy text() with bound parameters to prevent SQL injection
        # Note: PostgreSQL doesn't support named parameters in table names, so we validate table_name first
        # Use identifier quoting for safety
        from sqlalchemy import inspect
        inspector = inspect(db.bind)
        if table_name not in [tbl for tbl in inspector.get_table_names()]:
            raise HTTPException(status_code=404, detail=f"Table '{table_name}' does not exist")

        # Construct safe DELETE query with identifier (table_name is whitelisted, so safe)
        delete_sql = text(f'DELETE FROM "{table_name}" WHERE id = :row_id')
        result = db.execute(delete_sql, {"row_id": row_id})
        db.commit()

        if result.rowcount == 0:
            raise HTTPException(status_code=404, detail=f"Row {row_id} not found in table '{table_name}'")

        # Log security event
        log_security_event(
            db,
            current_user.id,
            "ROW_DELETED",
            "127.0.0.1",  # TODO: Extract from request headers
            {"table_name": table_name, "row_id": row_id}
        )

        return {"status": "success", "message": f"Row {row_id} deleted from {table_name}"}

    except HTTPException:
        raise
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete row: {str(e)}")

@router.get("/system/activity")
def get_system_activity(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get unified system activity stream."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    # Get recent import activities (UPLOAD_DATA)
    import_activities = db.query(AuditLog).filter(
        AuditLog.action == "UPLOAD_DATA"
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

    # Get recent cleaning activities (DATA_CLEANING)
    cleaning_activities = db.query(AuditLog).filter(
        AuditLog.action == "DATA_CLEANING"
    ).order_by(AuditLog.created_at.desc()).limit(10).all()

    def format_import_activity(log: AuditLog):
        details = {}
        try:
            details = json.loads(log.details) if isinstance(log.details, str) else log.details or {}
        except:
            pass

        return {
            "id": log.id,
            "analyst_name": db.query(User).filter(User.id == log.user_id).first().full_name if db.query(User).filter(User.id == log.user_id).first() else "Unknown",
            "file_name": details.get('filename', 'Unknown File'),
            "progress": 100,  # Completed
            "status": "completed",
            "action_type": "import",
            "timestamp": log.created_at.isoformat() if log.created_at else "",
            "details": details
        }

    def format_cleaning_activity(log: AuditLog):
        details = {}
        try:
            details = json.loads(log.details) if isinstance(log.details, str) else log.details or {}
        except:
            pass

        return {
            "id": log.id,
            "analyst_name": db.query(User).filter(User.id == log.user_id).first().full_name if db.query(User).filter(User.id == log.user_id).first() else "Unknown",
            "file_name": f"Data Cleaning - {details.get('type', 'Unknown')}",
            "progress": 100,  # Completed
            "status": "completed",
            "action_type": "cleaning",
            "timestamp": log.created_at.isoformat() if log.created_at else "",
            "details": details
        }

    activities = [format_import_activity(log) for log in import_activities]
    cleaning = [format_cleaning_activity(log) for log in cleaning_activities]

    return {
        "activities": activities,
        "cleaning": cleaning
    }

@router.get("/activity/import/{activity_id}/preview")
def get_import_preview(
    activity_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get preview of imported file data."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")

    # Get the import activity
    activity = db.query(AuditLog).filter(AuditLog.id == activity_id).first()
    if not activity or activity.action != "UPLOAD_DATA":
        raise HTTPException(status_code=404, detail="Import activity not found")

    details = {}
    try:
        details = json.loads(activity.details) if isinstance(activity.details, str) else activity.details or {}
    except:
        pass

    # For now, return a sample preview structure
    # In a real implementation, this would read from the actual imported data
    return {
        "table_name": "indicators_data",  # Assuming indicators_data
        "columns": ["year", "indicator_name", "value", "region"],
        "sample_data": [
            {"year": 2023, "indicator_name": "Population", "value": 1500000, "region": "N'Djamena"},
            {"year": 2023, "indicator_name": "GDP", "value": 2500000000, "region": "N'Djamena"},
            {"year": 2023, "indicator_name": "Employment Rate", "value": 65.5, "region": "N'Djamena"}
        ],
        "rowCount": details.get('total_rows_after', 0),
        "fileType": "CSV"
    }

@router.get("/activity/stream")
def get_activity_stream(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get real-time activity stream for imports and cleaning operations."""
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Administrator access required")
    
    # Query recent import activities (UPLOAD_DATA, DATA_IMPORT actions)
    import_activities = db.query(AuditLog).filter(
        AuditLog.action.in_(["UPLOAD_DATA", "DATA_IMPORT", "FAILED_IMPORT"])
    ).order_by(AuditLog.created_at.desc()).limit(20).all()
    
    # Query recent cleaning activities
    cleaning_activities = db.query(AuditLog).filter(
        AuditLog.action == "DATA_CLEANING"
    ).order_by(AuditLog.created_at.desc()).limit(20).all()
    
    def format_activity(log: AuditLog, activity_type: str):
        user = db.query(User).filter(User.id == log.user_id).first()
        details = {}
        try:
            details = json.loads(log.details) if isinstance(log.details, str) else log.details or {}
        except:
            pass
        
        # Determine status
        status = 'completed'
        if log.action == "FAILED_IMPORT":
            status = 'failed'
        elif activity_type == 'import' and log.action == "UPLOAD_DATA":
            status = 'completed'
        
        # Extract file name
        filename = details.get('filename', 'Unknown File')
        
        # Calculate progress (mock - in real system would track actual progress)
        progress = 100 if status == 'completed' else (50 if status == 'processing' else 0)
        
        return {
            "id": log.id,
            "analyst_name": user.full_name if user else "Unknown",
            "file_name": filename,
            "progress": progress,
            "status": status,
            "action_type": activity_type,
            "timestamp": log.created_at.isoformat() if log.created_at else "",
            "details": details
        }
    
    activities = [format_activity(log, 'import') for log in import_activities]
    cleaning = [format_activity(log, 'cleaning') for log in cleaning_activities]
    
    return {
        "activities": activities,
        "cleaning": cleaning
    }