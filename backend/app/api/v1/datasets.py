from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from app.db.session import get_db
from app.models import Dataset, User, AuditLog
from app.api.v1.auth import get_current_user
import pandas as pd
import io
import os
import json
from datetime import datetime
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch

router = APIRouter()

@router.post("/{id}/verify")
def verify_dataset(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Enforce the 95% Quality Gate before allowing verification/publication.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if dataset.status != "CLEANED":
        raise HTTPException(status_code=400, detail="Dataset must be cleaned before verification")

    # Math check for 95% threshold
    total_cells = dataset.row_count * dataset.col_count
    if total_cells == 0:
        raise HTTPException(status_code=400, detail="Empty dataset cannot be verified")

    score = (1 - (dataset.null_count + dataset.dupe_count) / total_cells)
    
    if score < 0.95:
        raise HTTPException(
            status_code=400, 
            detail=f"Institutional Quality Gate: Score must be ≥ 95%. Current score: {round(score * 100, 2)}%"
        )

    dataset.status = "VERIFIED"
    db.commit()
    
    return {"status": "success", "message": "Dataset verified and published to repository"}

@router.get("/{id}/quality-report")
def get_quality_report(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate a PDF diagnostic report for a dataset.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    dataset = db.query(Dataset).filter(Dataset.id == id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")

    if not os.path.exists(dataset.storage_path):
        raise HTTPException(status_code=404, detail="Dataset file missing")

    try:
        # 1. Load data to find failures
        ext = dataset.original_filename.split('.')[-1].lower()
        if ext == "csv":
            df = pd.read_csv(dataset.storage_path)
        else:
            df = pd.read_excel(dataset.storage_path)

        # 2. Identify Failures
        failures = []
        
        # Nulls
        null_coords = df.isnull().stack()
        for (row_idx, col_name), is_null in null_coords.items():
            if is_null:
                failures.append([row_idx + 1, col_name, "NULL Value", "Manual entry required"])
                if len(failures) >= 100: break # Guardrail
        
        # Duplicates
        if len(failures) < 100:
            duplicates = df.duplicated(keep=False)
            for row_idx, is_dupe in duplicates.items():
                if is_dupe:
                    failures.append([row_idx + 1, "(All Columns)", "Duplicate Row", "Removal recommended"])
                    if len(failures) >= 100: break

        # 3. PDF Generation
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4)
        elements = []
        styles = getSampleStyleSheet()
        
        # Institutional Header
        header_style = ParagraphStyle('Header', parent=styles['Heading1'], alignment=1, spaceAfter=20, fontSize=16, textColor=colors.indigo)
        elements.append(Paragraph("DATAVISION TCHAD - INSEED", header_style))
        elements.append(Paragraph("Automated Quality Diagnostic Report", styles['Heading2']))
        elements.append(Spacer(1, 0.2 * inch))

        # Executive Summary
        total_cells = dataset.row_count * dataset.col_count
        score = dataset.health_score or (100 * (1 - (dataset.null_count + dataset.dupe_count) / total_cells) if total_cells > 0 else 100)
        status_text = "PASSED" if score >= 95 else "FAILED"
        status_color = colors.green if score >= 95 else colors.red

        elements.append(Paragraph("<b>Executive Summary</b>", styles['Heading3']))
        summary_data = [
            ["Dataset Filename", dataset.original_filename],
            ["Generated at", datetime.now().strftime("%Y-%m-%d %H:%M")],
            ["Health Score", f"{round(score, 2)}%"],
            ["Quality Gate Threshold", "95.00%"],
            ["Institution Status", status_text]
        ]
        summary_table = Table(summary_data, colWidths=[2.5*inch, 3*inch])
        summary_table.setStyle(TableStyle([
            ('BACKGROUND', (0, 0), (-1, -1), colors.white),
            ('TEXTCOLOR', (1, -1), (1, -1), status_color),
            ('FONTNAME', (1, -1), (1, -1), 'Helvetica-Bold'),
            ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
            ('PADDING', (0, 0), (-1, -1), 8),
        ]))
        elements.append(summary_table)
        elements.append(Spacer(1, 0.3 * inch))

        # Failure Map
        elements.append(Paragraph("<b>Failure Map (Top 100 Issues)</b>", styles['Heading3']))
        if not failures:
            elements.append(Paragraph("No critical integrity issues detected.", styles['Normal']))
        else:
            table_data = [["Row #", "Column", "Issue Type", "Recommendation"]] + failures[:100]
            failure_table = Table(table_data, colWidths=[0.8*inch, 1.5*inch, 1.5*inch, 1.7*inch])
            failure_table.setStyle(TableStyle([
                ('BACKGROUND', (0, 0), (-1, 0), colors.indigo),
                ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                ('BOTTOMPADDING', (0, 0), (-1, 0), 10),
                ('GRID', (0, 0), (-1, -1), 0.5, colors.grey),
                ('FONTSIZE', (0, 0), (-1, -1), 8),
            ]))
            elements.append(failure_table)

        elements.append(Spacer(1, 0.5 * inch))
        elements.append(Paragraph("<i>This report is an official diagnostic tool of Inseed DataVision.</i>", styles['Normal']))

        doc.build(elements)
        buffer.seek(0)

        filename = f"Quality_Report_{dataset.original_filename.split('.')[0]}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Report generation failed: {str(e)}")
