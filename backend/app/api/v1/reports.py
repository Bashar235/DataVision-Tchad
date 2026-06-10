from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.db.session import get_db
from app.models import AuditLog, User, IndicatorData, ScheduledExport, DataDictionary, GeneratedReport, CleanedData
from app.api.v1.auth import get_current_user
from app.schemas import ReportRequest
import io
import os
import re
import json
import logging
from datetime import datetime, timedelta, timezone
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.platypus import Image, PageBreak
import matplotlib.pyplot as plt
import pandas as pd
import numpy as np

from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
import arabic_reshaper
from bidi.algorithm import get_display

router = APIRouter()

# Register Arabic-compatible font
FONT_PATH = "C:\\Windows\\Fonts\\arial.ttf"
if os.path.exists(FONT_PATH):
    pdfmetrics.registerFont(TTFont("Arial", FONT_PATH))
    pdfmetrics.registerFont(TTFont("Arial-Bold", "C:\\Windows\\Fonts\\arialbd.ttf"))

REPORTS_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))),
    "reports"
)

LOGO_PATH = os.path.join(REPORTS_DIR, "INSEED.jpeg")

PROVINCES_CHAD = [
    "Barh el Gazel", "Batha", "Borkou", "Chari-Baguirmi", "Ennedi Est", "Ennedi Ouest",
    "Guéra", "Hadjer-Lamis", "Kanem", "Lac", "Logone Occidental", "Logone Oriental",
    "Mandoul", "Mayo-Kebbi Est", "Mayo-Kebbi Ouest", "Moyen-Chari", "N'Djamena",
    "Ouaddaï", "Salamat", "Sila", "Tandjilé", "Tibesti", "Wadi Fira"
]

TRANSLATION_MAP_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "reports", "translation_map.json")

def _get_translator(lang: str):
    """Load translation map for the specified language."""
    try:
        with open(TRANSLATION_MAP_PATH, "r", encoding="utf-8") as f:
            full_map = json.load(f)
            return full_map.get(lang.lower(), full_map["en"])
    except Exception:
        # Fallback dictionary if file fails
        return {"sections": {}, "indicators": {}, "ui": {}, "columns": {}}

def _handle_text(text: str, lang: str):
    """Handle RTL reshaping and reordering for Arabic, preserving XML tags like <b> using single-char placeholders."""
    if lang.lower() == "ar":
        if not text:
            return text
        
        # Use single-character placeholders to avoid Bidi flipping the placeholder itself
        import re
        tags = re.findall(r'<[^>]+>', text)
        placeholder_map = {}
        temp_text = text
        
        # We use a range of characters that are unlikely to be in the text and are neutral
        # Start from \u0001 (SOH) upwards
        for i, tag in enumerate(tags):
            placeholder = chr(i + 1) 
            placeholder_map[placeholder] = tag
            # Use replace once to handle multiple identical tags correctly
            temp_text = temp_text.replace(tag, placeholder, 1)
            
        # Reshape Arabic characters
        reshaped = arabic_reshaper.reshape(temp_text)
        
        # Apply Bidi reordering
        visual = str(get_display(reshaped))
        
        # Restore original tags into their new visual positions
        for placeholder, tag in placeholder_map.items():
            visual = visual.replace(placeholder, tag)
            
        return visual
    return text

def _get_font(lang: str, is_bold: bool = False):
    """Return appropriate font name based on language."""
    if lang.lower() == "ar":
        return "Arial-Bold" if is_bold else "Arial"
    return "Helvetica-Bold" if is_bold else "Helvetica"

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _get_dict_info(db: Session, table_name: str, column_name: str):
    """Retrieve metadata from DataDictionary."""
    return db.query(DataDictionary).filter(
        DataDictionary.table_name == table_name,
        By := (DataDictionary.column_name == column_name)
    ).first()

def _make_pdf_table(data: list, col_widths: list | None = None, lang: str = "en") -> Table:
    """Build a styled ReportLab Table from `data` (header row first)."""
    effective_widths = col_widths or [2 * inch] * len(data[0])
    
    # Process Arabic text in cells
    processed_data = []
    for row in data:
        processed_row = [_handle_text(str(cell), lang) for cell in row]
        processed_data.append(processed_row)

    t = Table(processed_data, colWidths=effective_widths, repeatRows=1)
    font_name = _get_font(lang)
    bold_font = _get_font(lang, True)
    
    t.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  colors.HexColor("#1e3a5f")),
        ("TEXTCOLOR",     (0, 0), (-1, 0),  colors.whitesmoke),
        ("ALIGN",         (0, 0), (-1, -1), "CENTER"),
        ("FONTNAME",      (0, 0), (-1, 0),  bold_font),
        ("FONTNAME",      (0, 1), (-1, -1), font_name),
        ("FONTSIZE",      (0, 0), (-1, 0),  9),
        ("BOTTOMPADDING", (0, 0), (-1, 0),  10),
        ("BACKGROUND",    (0, 1), (-1, -1), colors.HexColor("#f0f4f8")),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [colors.white, colors.HexColor("#f0f4f8")]),
        ("GRID",          (0, 0), (-1, -1), 0.5, colors.HexColor("#ccd6e0")),
        ("FONTSIZE",      (0, 1), (-1, -1), 8),
    ]))
    return t


def _build_pdf_header(elements: list, styles, report_title: str, generated_by: str, lang: str = "fr"):
    """Append the standard INSEED letterhead to the elements list."""
    t = _get_translator(lang)
    ui = t["ui"]
    is_rtl = lang.lower() == "ar"
    
    header_style = ParagraphStyle(
        "Header",
        parent=styles["Heading1"],
        alignment=1, # Always center main header
        fontName=_get_font(lang, True),
        spaceAfter=6,
        fontSize=12,
        leading=14,
        textColor=colors.HexColor("#1e3a5f"),
    )
    sub_style = ParagraphStyle(
        "SubHeader",
        parent=styles["Normal"],
        alignment=1, # Center sub header
        fontName=_get_font(lang),
        fontSize=9,
        textColor=colors.HexColor("#4a5568"),
        spaceAfter=4,
    )
    
    # Add Logo if exists
    if os.path.exists(LOGO_PATH):
        try:
            img = Image(LOGO_PATH, width=1.0*inch, height=1.0*inch)
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 0.1 * inch))
        except Exception:
            pass

    republique = _handle_text(ui.get("country_name", "RÉPUBLIQUE DU TCHAD"), lang)
    devise = _handle_text(ui.get("motto", "UNITÉ - TRAVAIL - PROGRÈS"), lang)
    nom_inseed = _handle_text(ui.get("inseed_name1", "INSTITUT NATIONAL DE LA STATISTIQUE,"), lang)
    nom_inseed2 = _handle_text(ui.get("inseed_name2", "DES ÉTUDES ÉCONOMIQUES ET DÉMOGRAPHIQUES (INSEED)"), lang)

    elements.append(Paragraph(republique, header_style))
    elements.append(Paragraph(devise, sub_style))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(nom_inseed, header_style))
    elements.append(Paragraph(nom_inseed2, header_style))
    elements.append(Spacer(1, 0.2 * inch))
    
    # Body Header
    report_label = _handle_text(f"{ui.get('report', 'RAPPORT')} : {report_title.upper()}", lang)
    elements.append(Paragraph(f"<b>{report_label}</b>", header_style))
    
    gen_time = datetime.now().strftime('%d/%m/%Y %H:%M')
    gen_by_label = _handle_text(f"{ui.get('generated_on', 'Généré le')}: {gen_time}  |  {ui.get('by', 'Par')}: {generated_by}", lang)
    elements.append(Paragraph(gen_by_label, sub_style))
    
    certified_label = _handle_text(f"<i>{ui.get('certified', 'Certifié par DataVision AI')}</i>", lang)
    elements.append(Paragraph(certified_label, sub_style))
    elements.append(Spacer(1, 0.3 * inch))


def _build_watermark(canvas, doc, text="CONFIDENTIEL"):
    """Draw a watermark on each page."""
    canvas.saveState()
    canvas.setFont('Helvetica-Bold', 60)
    canvas.setStrokeColorRGB(0.9, 0.9, 0.9)
    canvas.setFillColorRGB(0.9, 0.9, 0.9)
    canvas.translate(A4[0]/2, A4[1]/2)
    canvas.rotate(45)
    canvas.drawCentredString(0, 0, text)
    canvas.restoreState()


def save_scheduled_report(
    db: Session,
    user_id: int,
    report_type: str,
    params: dict,
    frequency: str,
) -> ScheduledExport:
    """
    Mock-ready scheduling helper.
    Persists a PENDING ScheduledExport row that a real cron / APScheduler
    heartbeat can pick up and execute without user intervention.
    Frequency → timedelta mapping is intentionally simple; a production
    implementation would convert this to a cron expression stored alongside.
    """
    freq_map = {"daily": 1, "weekly": 7, "monthly": 30}
    days = freq_map.get(frequency.lower(), 1)
    next_run = datetime.now(timezone.utc) + timedelta(days=days)

    schedule_entry = ScheduledExport(
        user_id=user_id,
        export_details=json.dumps({
            "report_type": report_type,
            "params": params,
            "frequency": frequency,
        }),
        scheduled_time=next_run,
        status="PENDING",
        is_active=True,
        job_id=f"report__{report_type.replace(' ', '_')}__{frequency}",
        created_at=datetime.now(timezone.utc),
    )
    db.add(schedule_entry)
    db.commit()
    db.refresh(schedule_entry)
    return schedule_entry


# ─────────────────────────────────────────────────────────────────────────────
# PDF content builders (one per report type)
# ─────────────────────────────────────────────────────────────────────────────

def _build_executive_summary(elementsList: list, styles, db: Session, region: str, lang: str = "fr", dataset_id: str | None = None):
    """Executive summary based on Data Quality Gate."""
    t = _get_translator(lang)
    title = _handle_text(t["sections"].get("executive_summary", "1. Résumé Analytique"), lang)
    h_style = ParagraphStyle("H2", parent=styles["Heading2"], fontName=_get_font(lang, True))
    n_style = ParagraphStyle("N", parent=styles["Normal"], fontName=_get_font(lang), alignment=2 if lang=="ar" else 0)
    
    elementsList.append(Paragraph(title, h_style))
    
    from app.services.data_quality import detect_anomalies
    
    # Regional & Dataset Filtering
    model = CleanedData if dataset_id else IndicatorData
    query = db.query(model)
    if dataset_id:
        query = query.filter(model.dataset_id == dataset_id)
    if region != "National":
        query = query.filter(model.region == region)
    
    all_data = query.all()
    
    df = pd.DataFrame([{ "indicator_name": d.indicator_name, "region": d.region, "value": d.value, "id": d.id } for d in all_data])
    anomalies = detect_anomalies(df)
    
    total_records = len(all_data)
    clean_records = total_records - len(anomalies)
    quality_score = (clean_records / total_records * 100) if total_records > 0 else 100
    
    ui = t["ui"]
    region_display = region if region != "National" else ui.get("national", "National")
    templates = t.get("templates", {})
    
    summary_text = templates.get("summary_intro", "").format(
        region=region_display,
        total=total_records,
        score=f"{quality_score:.1f}"
    )
    
    if quality_score >= 95:
        summary_text += " " + templates.get("quality_pass", "")
    else:
        summary_text += " " + templates.get("quality_fail", "")
    
    # Partial Data Disclaimer
    if region != "National" and total_records < 50:
        disclaimer = _handle_text("Note: Basé sur des données partielles pour cette province." if lang != "ar" else "ملاحظة: بناءً على بيانات جزئية لهذه المنطقة.", lang)
        if lang == "en": disclaimer = "Note: Based on partial data for this province."
        summary_text += f"\n\n{disclaimer}"
        
    elementsList.append(Paragraph(_handle_text(summary_text, lang), n_style))
    elementsList.append(Spacer(1, 0.2 * inch))


def _build_demographic_pyramid(elementsList: list, styles, db: Session, region: str, lang: str = "fr", dataset_id: str | None = None):
    """Generate demographic pyramid using ReportLab native Drawing shapes (Rect, Line, String).

    Filters out aggregate cohorts (e.g. '15-49 ans'), aligns male and female lists
    consistently, sets symmetric horizontal scaling based on maximum percentage,
    places age group labels in a dedicated column on the left to avoid overlaps,
    and applies a professional stroke and layout to each cohort bar.
    """
    from reportlab.graphics.shapes import Drawing, String, Rect, Line
    from reportlab.graphics.charts.legends import Legend

    t = _get_translator(lang)
    title = _handle_text(t["sections"].get("demographics", "2. Pyramide des Âges"), lang)
    h_style = ParagraphStyle("H2Pyr", parent=styles["Heading2"], fontName=_get_font(lang, True))
    elementsList.append(Paragraph(title, h_style))

    GOLD_UUID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"

    # ── Region Mapping ──────────────────────────────────────────────────────
    # "National" and "Tchad" both resolve to "Tchad" in the database.
    query_region = "Tchad" if region in ("National", "Tchad") else region

    # ── Data Fetching (aligned with analyst.py /pyramid endpoint) ─────────
    effective_dataset_id = dataset_id or GOLD_UUID

    # Try multiple years (2025 matches the preview default, then fallbacks)
    raw_data = []
    for try_year in (2025, 2024, 2023, 2020, 2010):
        raw_data = db.query(CleanedData).filter(
            CleanedData.dataset_id == effective_dataset_id,
            CleanedData.region == query_region,
            CleanedData.year == try_year,
        ).all()
        if raw_data:
            logging.info("Pyramid PDF: %d CleanedData rows, region=%s year=%d",
                         len(raw_data), query_region, try_year)
            break

    # Fallback: IndicatorData (legacy seeded rows)
    if not raw_data:
        for try_year in (2024, 2020, 2010):
            raw_data = db.query(IndicatorData).filter(
                IndicatorData.indicator_name == "Population par Groupe d'Âges",
                IndicatorData.region == query_region,
                IndicatorData.year == try_year,
                IndicatorData.gender.in_(["Masculin", "Féminin"]),
            ).all()
            if raw_data:
                logging.info("Pyramid PDF: %d IndicatorData rows, region=%s year=%d",
                             len(raw_data), query_region, try_year)
                break

    # ── Build pyramid_map (mirrors analyst.py logic) ─────────────────────
    pyramid_map: dict = {}
    total_pop = 0

    for r in raw_data:
        try:
            val = float(getattr(r, "value")) if getattr(r, "value") is not None else 0.0
        except (ValueError, TypeError):
            val = 0.0

        ind = getattr(r, "indicator_name", "")

        # Total population (for synthetic-fallback sizing)
        if ind == "Population Totale" and not getattr(r, "gender", None) and not getattr(r, "age_group", None):
            total_pop = val
            continue

        # Format 1: M_0_4 / F_15_19 indicator names
        if ind.startswith("M_") or ind.startswith("F_"):
            parts = ind.split("_")
            if len(parts) >= 3:
                gender = "male" if parts[0] == "M" else "female"
                age_key = f"{parts[1]}+" if parts[-1] == "plus" else f"{parts[1]}-{parts[2]}"
                pyramid_map.setdefault(age_key, {"age": age_key, "male": 0, "female": 0})
                pyramid_map[age_key][gender] += int(val)

        # Format 2: "Population" with gender/age_group columns
        elif ind == "Population" and getattr(r, "gender", None) and getattr(r, "age_group", None):
            age_key = r.age_group
            if age_key not in ("Total",) and not str(age_key).startswith("Part"):
                pyramid_map.setdefault(age_key, {"age": age_key, "male": 0, "female": 0})
                g = r.gender.lower()
                if g in ("masculin", "male", "m"):
                    pyramid_map[age_key]["male"] += int(val)
                elif g in ("feminin", "female", "f", "féminin"):
                    pyramid_map[age_key]["female"] += int(val)

        # Format 3: "Population par Groupe d'Âges" with gender/age_group
        elif ind == "Population par Groupe d'Âges" and getattr(r, "gender", None) and getattr(r, "age_group", None):
            age_key = r.age_group
            pyramid_map.setdefault(age_key, {"age": age_key, "male": 0, "female": 0})
            if r.gender == "Masculin":
                pyramid_map[age_key]["male"] += int(val)
            elif r.gender == "Féminin":
                pyramid_map[age_key]["female"] += int(val)

    pyramid_data = list(pyramid_map.values())

    # ── Synthetic Fallback (same as analyst.py) ───────────────────────────
    if not pyramid_data:
        logging.info("Pyramid PDF: synthetic fallback for region=%s", query_region)
        synthetic = {
            "0-4": 18.0, "5-9": 16.0, "10-14": 14.0, "15-19": 11.0,
            "20-24": 9.0, "25-29": 7.5, "30-34": 6.0, "35-39": 5.0,
            "40-44": 4.0, "45-49": 3.0, "50-54": 2.5, "55-59": 1.5,
            "60-64": 1.0, "65-69": 0.8, "70-74": 0.4, "75-79": 0.2, "80+": 0.1,
        }
        if total_pop == 0:
            total_pop = 18_000_000 if query_region == "Tchad" else 500_000
        for age, pct in synthetic.items():
            grp = total_pop * pct / 100.0
            pyramid_data.append({"age": age, "male": int(grp * 0.495), "female": int(grp * 0.505)})

    # ── Sort by age bucket ────────────────────────────────────────────────
    def _age_key(item):
        s = item["age"]
        if "+" in s:
            return 999
        try:
            return int(s.split("-")[0])
        except Exception:
            return 0

    pyramid_data.sort(key=_age_key)

    # ── Filter Out Aggregates (The 'Giant Bar' Fix) ───────────────────────
    def _is_aggregate_cohort(age_key: str) -> bool:
        s = age_key.strip().lower()
        if s in (
            "total", "tous", "all", "15-49", "15-49 ans", "15-49ans", 
            "15-59", "15-64", "0-14", "15-64 ans", "65+ ans", "global"
        ):
            return True
        if "total" in s or "part" in s:
            return True
        if "ans" in s and ("15-49" in s or "15-59" in s or "0-14" in s):
            return True
        if "-" in age_key:
            try:
                parts = age_key.split("-")
                if len(parts) == 2:
                    low = int(parts[0].strip())
                    high_part = parts[1].strip().split()[0]
                    high = int(high_part)
                    if high - low > 9:
                        return True
            except ValueError:
                pass
        return False

    pyramid_data = [d for d in pyramid_data if not _is_aggregate_cohort(d["age"])]

    # ── Consistency & Setup ───────────────────────────────────────────────
    age_labels  = [d["age"]    for d in pyramid_data]
    males_raw   = [d["male"]   for d in pyramid_data]
    females_raw = [d["female"] for d in pyramid_data]

    grand_total = sum(males_raw) + sum(females_raw)
    if grand_total <= 0:
        grand_total = 1.0

    males_pct = [m / grand_total * 100 for m in males_raw]
    females_pct = [f / grand_total * 100 for f in females_raw]

    # Scaling Logic: Calculate the max_pct across both genders to set horizontal axis limit
    max_pct = max(max(males_pct) if males_pct else 0.0, max(females_pct) if females_pct else 0.0)
    if max_pct <= 0:
        max_pct = 1.0

    num_groups = len(age_labels)
    BAR_HEIGHT = 12
    SPACING = 5
    chart_h = max(200, num_groups * (BAR_HEIGHT + SPACING))
    chart_w = 450
    draw_h = chart_h + 70

    drawing = Drawing(chart_w, draw_h)

    # Coordinates
    center_x = 260
    max_bar_width = 170
    scale = max_bar_width / max_pct  # scale pixels per percentage point
    label_x = 40  # dedicated column in the far left
    
    # ── Vertical Grid Lines (drawn first so they are behind the bars) ──────
    grid_h = num_groups * (BAR_HEIGHT + SPACING)
    for frac in (1/3, 2/3, 1.0):
        # Left grid lines (males)
        lx = center_x - frac * max_bar_width
        drawing.add(Line(
            lx, 35, lx, 35 + grid_h,
            strokeColor=colors.HexColor("#e2e8f0"),
            strokeWidth=0.5
        ))
        # Right grid lines (females)
        rx = center_x + frac * max_bar_width
        drawing.add(Line(
            rx, 35, rx, 35 + grid_h,
            strokeColor=colors.HexColor("#e2e8f0"),
            strokeWidth=0.5
        ))

    # Central Axis zero line
    drawing.add(Line(
        center_x, 35, center_x, 35 + grid_h,
        strokeColor=colors.HexColor("#4a5568"),
        strokeWidth=1.0
    ))

    # ── Draw Cohort Bars & Labels ─────────────────────────────────────────
    for i in range(num_groups):
        y_pos = 35 + i * (BAR_HEIGHT + SPACING)
        
        # Age group label
        age_text = _handle_text(age_labels[i], lang)
        drawing.add(String(
            label_x, y_pos + 2, age_text,
            fontName=_get_font(lang),
            fontSize=8,
            textAnchor="middle",
            fillColor=colors.HexColor("#4a5568")
        ))
        
        # Male Bar: x = center - (value * scale)
        male_w = males_pct[i] * scale
        r_male = Rect(center_x - male_w, y_pos, male_w, BAR_HEIGHT)
        r_male.fillColor = colors.HexColor("#1e3a5f")
        r_male.strokeColor = colors.HexColor("#0f223b")
        r_male.strokeWidth = 0.75
        drawing.add(r_male)
        
        # Female Bar: x = center (extends to center + width)
        female_w = females_pct[i] * scale
        r_female = Rect(center_x, y_pos, female_w, BAR_HEIGHT)
        r_female.fillColor = colors.HexColor("#e53e3e")
        r_female.strokeColor = colors.HexColor("#9b2c2c")
        r_female.strokeWidth = 0.75
        drawing.add(r_female)

    # ── Horizontal Axis Ticks & Labels ────────────────────────────────────
    # Bottom line
    drawing.add(Line(
        center_x - max_bar_width, 35, center_x + max_bar_width, 35,
        strokeColor=colors.HexColor("#4a5568"),
        strokeWidth=0.75
    ))

    # Tick labels
    for frac in (1.0, 2/3, 1/3):
        val_lbl = f"{frac * max_pct:.1f}%"
        # Male ticks (left side)
        lx = center_x - frac * max_bar_width
        drawing.add(Line(lx, 31, lx, 35, strokeColor=colors.HexColor("#4a5568"), strokeWidth=0.75))
        drawing.add(String(lx, 20, val_lbl, fontName=_get_font(lang), fontSize=7, textAnchor="middle"))
        
        # Female ticks (right side)
        rx = center_x + frac * max_bar_width
        drawing.add(Line(rx, 31, rx, 35, strokeColor=colors.HexColor("#4a5568"), strokeWidth=0.75))
        drawing.add(String(rx, 20, val_lbl, fontName=_get_font(lang), fontSize=7, textAnchor="middle"))
        
    # Center Zero tick
    drawing.add(Line(center_x, 31, center_x, 35, strokeColor=colors.HexColor("#4a5568"), strokeWidth=0.75))
    drawing.add(String(center_x, 20, "0%", fontName=_get_font(lang), fontSize=7, textAnchor="middle"))

    # Legend
    m_label = _handle_text("Masculin" if lang != "ar" else "ذكور", lang)
    f_label = _handle_text("Féminin"  if lang != "ar" else "إناث", lang)

    legend            = Legend()
    legend.x          = chart_w // 2 - 50
    legend.y          = draw_h - 15
    legend.fontSize   = 8
    legend.fontName   = _get_font(lang)
    legend.alignment  = "right"
    legend.colorNamePairs = [
        (colors.HexColor("#1e3a5f"), m_label),
        (colors.HexColor("#e53e3e"), f_label),
    ]
    drawing.add(legend)

    # Chart title
    if region in ("National", "Tchad"):
        region_display = {"en": "National", "fr": "National", "ar": "الوطني"}.get(lang, "National")
    else:
        region_display = region
    chart_title = _handle_text(f"Pyramide - {region_display}", lang)
    drawing.add(String(
        chart_w // 2, draw_h - 3, chart_title,
        fontSize=10, fontName=_get_font(lang, True),
        fillColor=colors.HexColor("#1e3a5f"), textAnchor="middle",
    ))

    elementsList.append(drawing)
    elementsList.append(Spacer(1, 0.2 * inch))


def _build_predictive_trends(elementsList: list, styles, db: Session, region: str, lang: str = "fr", dataset_id: str | None = None):
    """Inject Predictive Trends using ML Engine."""
    t = _get_translator(lang)
    title = _handle_text(t["sections"].get("trends", "3. Projections"), lang)
    h_style = ParagraphStyle("H2", parent=styles["Heading2"], fontName=_get_font(lang, True))
    elementsList.append(Paragraph(title, h_style))
    
    from app.ml.ensemble_engine import PredictorEngine
    try:
        # ML Realignment: Fetch baseline data for the region
        model = CleanedData if dataset_id else IndicatorData
        if region == "National":
            isf_q = db.query(func.avg(model.value)).filter(model.indicator_name == "ISF", model.year == 2024)
            e0_q = db.query(func.avg(model.value)).filter(model.indicator_name == "e0", model.year == 2024)
        else:
            isf_q = db.query(model.value).filter(model.region == region, model.indicator_name == "ISF", model.year == 2024)
            e0_q = db.query(model.value).filter(model.region == region, model.indicator_name == "e0", model.year == 2024)
            
        if dataset_id:
            isf_q = isf_q.filter(model.dataset_id == dataset_id)
            e0_q = e0_q.filter(model.dataset_id == dataset_id)
            
        isf_val = isf_q.scalar() or 6.5
        e0_val = e0_q.scalar() or 58.0
            
        engine = PredictorEngine.load()
        years = list(range(2025, 2051))
        preds = engine.predict(params={"ISF": float(isf_val), "e0": float(e0_val)}, years=years)
        raw_data = preds.get("predictions", [])
        
        y_values = [p["ensemble_pred"] for p in raw_data]
        
        try:
            plt.figure(figsize=(6, 4))
            plt.plot(years, y_values, marker='o', color='#1e3a5f', linewidth=2, label='Ensemble AI')
            plt.fill_between(years, [p["ci_lower"] for p in raw_data], [p["ci_upper"] for p in raw_data], color='#1e3a5f', alpha=0.1)
            
            # Scaling: Zoom in on provincial range
            y_min, y_max = min(y_values), max(y_values)
            plt.ylim(y_min * 0.9, y_max * 1.1)
            
            plt.title(f"Projection - {region}")
            plt.xlabel("Year")
            plt.legend()
            plt.grid(True, linestyle=':', alpha=0.5)
            
            img_buffer = io.BytesIO()
            plt.savefig(img_buffer, format='png', bbox_inches='tight')
            plt.close()
            img_buffer.seek(0)
            
            img = Image(img_buffer, width=5*inch, height=3.5*inch)
            img.hAlign = 'CENTER'
            elementsList.append(img)
        finally:
            plt.clf()
            plt.close('all')
            
        # Add a table for precise values
        cols = t.get("columns", {})
        header = [cols.get("Year", "Year"), cols.get("Value", "Value"), cols.get("Lower (CI)", "Lower"), cols.get("Upper (CI)", "Upper")]
        tab_data = [header]
        for p in raw_data:
            tab_data.append([str(p["year"]), f"{p['ensemble_pred']:.2f}", f"{p['ci_lower']:.2f}", f"{p['ci_upper']:.2f}"])
        
        elementsList.append(Spacer(1, 0.1 * inch))
        elementsList.append(_make_pdf_table(tab_data, [1.5*inch, 1.5*inch, 1.5*inch, 1.5*inch], lang=lang))
        
    except Exception as e:
        elementsList.append(Paragraph(f"Error: {str(e)}", styles["Normal"]))
        
    elementsList.append(Spacer(1, 0.2 * inch))


def _build_data_health_audit(elementsList: list, styles, db: Session, region: str, lang: str = "fr", dataset_id: str | None = None):
    """Summary of data audit."""
    t = _get_translator(lang)
    title = _handle_text(t["sections"].get("health_audit", "4. Audit Santé"), lang)
    h_style = ParagraphStyle("H2", parent=styles["Heading2"], fontName=_get_font(lang, True))
    n_style = ParagraphStyle("N", parent=styles["Normal"], fontName=_get_font(lang), alignment=2 if lang=="ar" else 0)
    elementsList.append(Paragraph(title, h_style))
    
    from app.services.data_quality import detect_anomalies
    # Regional & Dataset Filtering
    model = CleanedData if dataset_id else IndicatorData
    query = db.query(model)
    if dataset_id:
        query = query.filter(model.dataset_id == dataset_id)
    if region != "National":
        query = query.filter(model.region == region)
    
    health_data = query.limit(1000).all()
        
    df = pd.DataFrame([{ "indicator_name": d.indicator_name, "region": d.region, "value": d.value } for d in health_data])
    anomalies = detect_anomalies(df)
    
    if not anomalies:
        msg = _handle_text("Aucune anomalie détectée." if lang!="ar" else "لم يتم الكشف عن أي خلل.", lang)
        elementsList.append(Paragraph(msg, n_style))
    else:
        msg = _handle_text(f"L'audit a identifié {len(anomalies)} points de vigilance." if lang!="ar" else f"حدد التدقيق {len(anomalies)} نقطة يقظة.", lang)
        elementsList.append(Paragraph(msg, n_style))
        cols = t.get("columns", {})
        data = [[cols.get("Indicator", "Indicateur"), cols.get("Reason", "Raison"), cols.get("Severity", "Sévérité")]]
        for a in anomalies[:10]:
            data.append([a["indicator"], a["reason"], a["severity"]])
        elementsList.append(_make_pdf_table(data, [2.5*inch, 2.5*inch, 1.5*inch], lang=lang))
    
    elementsList.append(Spacer(1, 0.2 * inch))

def _build_legend(elements: list, styles, lang: str):
    """Add trilingual legend/nomenclature at the end."""
    t = _get_translator(lang)
    ui = t["ui"]
    h_style = ParagraphStyle("H2", parent=styles["Heading2"], fontName=_get_font(lang, True))
    n_style = ParagraphStyle("N", parent=styles["Normal"], fontName=_get_font(lang), alignment=2 if lang=="ar" else 0)
    
    elements.append(Paragraph(_handle_text(ui.get("legend", "Nomenclature / Legend"), lang), h_style))
    elements.append(Paragraph(_handle_text(ui.get("note", "Note: This report uses international database standards."), lang), n_style))
    elements.append(Spacer(1, 0.1 * inch))
    
    data = [[ui.get("field", "Field"), ui.get("translation", "Translation")]]
    trans_map = t.get("indicators", {})
    for k, v in trans_map.items():
        data.append([k.replace("_", " ").title(), v])
    
    elements.append(_make_pdf_table(data, [3*inch, 3*inch], lang=lang))


def _generate_excel_report(db: Session, request: ReportRequest):
    """Generate a multi-tab Excel workbook with trilingual headers."""
    lang = request.language or "en"
    t = _get_translator(lang)
    cols = t.get("columns", {})
    output = io.BytesIO()
    
    # Sheet Names
    if lang == "ar":
        summary_sheet, raw_sheet, clean_sheet, ml_sheet = "الملخص", "البيانات الخام", "البيانات المنقحة", "توقعات ML"
    elif lang == "fr":
        summary_sheet, raw_sheet, clean_sheet, ml_sheet = "Résumé", "Données Brutes", "Données Nettoyées", "Projections ML"
    else:
        summary_sheet, raw_sheet, clean_sheet, ml_sheet = "Summary", "Raw Data", "Cleaned Data", "ML Projections"

    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Tab 1: Summary
        summary_df = pd.DataFrame({
            t["ui"].get("field", "Field"): ["Report", "Region", "Date", "Status"],
            t["ui"].get("translation", "Translation"): [
                request.type or "Custom",
                request.region or "National",
                datetime.now().strftime("%Y-%m-%d %H:%M"),
                t["ui"].get("certified", "Verified by DataVision AI")
            ]
        })
        summary_df.to_excel(writer, sheet_name=summary_sheet, index=False)
        
        ind_map = t.get("indicators", {})
        
        # Tab 2: Raw Data
        raw_model = CleanedData if request.dataset_id else IndicatorData
        raw_q = db.query(raw_model)
        if request.dataset_id:
            raw_q = raw_q.filter(raw_model.dataset_id == request.dataset_id)
        if request.region != "National":
            raw_q = raw_q.filter(raw_model.region == request.region)
        
        raw_records = raw_q.limit(1000).all()
            
        if raw_records:
            raw_df = pd.DataFrame([{ 
                cols.get("Year", "Year"): r.year, 
                cols.get("Indicator", "Indicator"): ind_map.get(r.indicator_name, r.indicator_name), 
                cols.get("Value", "Value"): r.value 
            } for r in raw_records])
            raw_df.to_excel(writer, sheet_name=raw_sheet, index=False)
            
        # Tab 3: Cleaned Data
        clean_model = CleanedData if request.dataset_id else IndicatorData
        clean_q = db.query(clean_model)
        if not request.dataset_id:
            clean_q = clean_q.filter(getattr(clean_model, "is_cleaned") == True)
        if request.dataset_id:
            clean_q = clean_q.filter(clean_model.dataset_id == request.dataset_id)
        if request.region != "National":
            clean_q = clean_q.filter(clean_model.region == request.region)
            
        clean_records = clean_q.limit(1000).all()
            
        if clean_records:
            clean_df = pd.DataFrame([{ 
                cols.get("Year", "Year"): r.year, 
                cols.get("Indicator", "Indicator"): ind_map.get(r.indicator_name, r.indicator_name), 
                cols.get("Value", "Value"): r.value 
            } for r in clean_records])
            clean_df.to_excel(writer, sheet_name=clean_sheet, index=False)
            
        # Tab 4: ML Projections
        from app.ml.ensemble_engine import PredictorEngine
        try:
            # Localized baseline for Excel too
            model = CleanedData if request.dataset_id else IndicatorData
            if request.region == "National":
                isf_q = db.query(func.avg(model.value)).filter(model.indicator_name == "ISF", model.year == 2024)
                e0_q = db.query(func.avg(model.value)).filter(model.indicator_name == "e0", model.year == 2024)
            else:
                isf_q = db.query(model.value).filter(model.region == request.region, model.indicator_name == "ISF", model.year == 2024)
                e0_q = db.query(model.value).filter(model.region == request.region, model.indicator_name == "e0", model.year == 2024)
                
            if request.dataset_id:
                isf_q = isf_q.filter(model.dataset_id == request.dataset_id)
                e0_q = e0_q.filter(model.dataset_id == request.dataset_id)
                
            isf_val = isf_q.scalar() or 6.5
            e0_val = e0_q.scalar() or 58.0
                
            engine = PredictorEngine.load()
            proj = engine.predict(params={"ISF": float(isf_val), "e0": float(e0_val)}, years=list(range(2024, 2051)))
            proj_df = pd.DataFrame(proj["predictions"])
            col_rename = {
                "year": cols.get("Year", "Year"),
                "ensemble_pred": cols.get("Value", "Value"),
                "ci_lower": cols.get("Lower (CI)", "Lower (CI)"),
                "ci_upper": cols.get("Upper (CI)", "Upper (CI)")
            }
            proj_df.rename(columns=col_rename, inplace=True)
            proj_df.to_excel(writer, sheet_name=ml_sheet, index=False)
        except:
            pass
            
    output.seek(0)
    return output.getvalue()


def _build_admin_pdf_header(elements: list, styles, report_title: str, generated_by: str, lang: str = "en"):
    """Admin-focused PDF header with trilingual support."""
    is_ar = lang.lower() == "ar"
    font_name = _get_font(lang)
    bold_font = _get_font(lang, True)
    
    header_style = ParagraphStyle(
        "AdminHeader",
        parent=styles["Heading1"],
        alignment=1,
        fontName=bold_font,
        spaceAfter=6,
        fontSize=14,
        leading=16,
        textColor=colors.HexColor("#1e3a5f"),
    )
    sub_style = ParagraphStyle(
        "AdminSubHeader",
        parent=styles["Normal"],
        alignment=1,
        fontName=font_name,
        fontSize=9,
        textColor=colors.HexColor("#4a5568"),
        spaceAfter=4,
    )

    # Add Logo if exists
    if os.path.exists(LOGO_PATH):
        try:
            img = Image(LOGO_PATH, width=0.8*inch, height=0.8*inch)
            img.hAlign = 'CENTER'
            elements.append(img)
            elements.append(Spacer(1, 0.1 * inch))
        except Exception:
            pass

    admin_label = {
        "en": "DATAVISION CHAD — ADMINISTRATION",
        "fr": "DATAVISION TCHAD — ADMINISTRATION",
        "ar": "داتا فيجن تشاد - الإدارة"
    }
    system_report = {
        "en": "System Report · Confidential",
        "fr": "Rapport Système · Confidentiel",
        "ar": "تقرير النظام · سري"
    }
    gen_on = {"en": "Generated", "fr": "Généré", "ar": "أنشئ في"}
    by_par = {"en": "By", "fr": "Par", "ar": "بواسطة"}
    
    h1 = _handle_text(admin_label.get(lang.lower(), admin_label["en"]), lang)
    h2 = _handle_text(system_report.get(lang.lower(), system_report["en"]), lang)
    
    elements.append(Paragraph(h1, header_style))
    elements.append(Paragraph(h2, sub_style))
    elements.append(Spacer(1, 0.15 * inch))

    elements.append(Paragraph(f"<b>{_handle_text(report_title.upper(), lang)}</b>", header_style))
    
    # Date formatting for header
    if is_ar:
        gen_time = datetime.now().strftime('%Y/%m/%d %H:%M')
    else:
        gen_time = datetime.now().strftime('%d/%m/%Y %H:%M')
        
    info_text = f"{gen_on.get(lang.lower(), gen_on['en'])}: {gen_time}  |  {by_par.get(lang.lower(), by_par['en'])}: {generated_by}"
    elements.append(Paragraph(_handle_text(info_text, lang), sub_style))
    elements.append(Spacer(1, 0.3 * inch))


def _build_system_health(elements: list, styles, db: Session):
    """Admin-only: DB-level counts summarised in the PDF."""
    total_users  = db.query(func.count(User.id)).scalar() or 0
    active_users = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    total_records = db.query(func.count(IndicatorData.id)).scalar() or 0
    audit_count  = db.query(func.count(AuditLog.id)).scalar() or 0

    elements.append(Paragraph("System Health Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    data = [
        ["Metric", "Value"],
        ["Total Users",              str(total_users)],
        ["Active Users",             str(active_users)],
        ["Inactive Users",           str(total_users - active_users)],
        ["Total Indicator Records",  str(total_records)],
        ["Total Audit Log Entries",  str(audit_count)],
        ["Report Generated At",      datetime.now().strftime("%d/%m/%Y %H:%M")],
    ]
    elements.append(_make_pdf_table(data, [3 * inch, 3 * inch]))


def _build_user_activity_audit(elements: list, styles, db: Session, audit_type: str | None, date_range: str | None, user_role: str | None):
    """Admin-only: a JOIN between AuditLog and User so each row carries the full name."""
    elements.append(Paragraph("User Activity Audit Report", styles["Heading2"]))
    if audit_type or date_range or user_role:
        elements.append(Paragraph(
            f"Filters — Audit type: {audit_type or 'All'} | Date range: {date_range or 'All'} | Role: {user_role or 'All'}",
            styles["Normal"],
        ))
    elements.append(Spacer(1, 0.1 * inch))

    # Build base query with a JOIN so we only hit the DB once
    query = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
    )

    # Filter by audit_type keyword
    if audit_type == "user_actions":
        query = query.filter(AuditLog.action.in_(["LOGIN", "LOGOUT", "PASSWORD_CHANGE"]))
    elif audit_type == "export_history":
        query = query.filter(AuditLog.action == "DATA_EXPORT")
    elif audit_type == "database_changes":
        query = query.filter(AuditLog.action.in_(["DATA_MODIFICATION", "UPLOAD_DATA", "DELETE_ROW"]))

    # Filter by date_range
    now = datetime.now(timezone.utc)
    range_map = {
        "today":   now - timedelta(days=1),
        "week":    now - timedelta(days=7),
        "month":   now - timedelta(days=30),
        "quarter": now - timedelta(days=90),
        "year":    now - timedelta(days=365),
    }
    if date_range and date_range in range_map:
        query = query.filter(AuditLog.created_at >= range_map[date_range])

    # Filter by role (requires joining User — already joined above)
    if user_role:
        query = query.filter(User.role == user_role)

    activities = query.order_by(AuditLog.created_at.desc()).limit(100).all()

    data = [["User", "Role", "Action", "Time", "Details"]]
    for log, user in activities:
        details_raw = log.details or {}
        details_str = json.dumps(details_raw) if isinstance(details_raw, dict) else str(details_raw)
        data.append([
            user.full_name if user else "Unknown",
            user.role      if user else "—",
            log.action,
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
            details_str[:80],
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [1.6*inch, 1.1*inch, 1.5*inch, 1.4*inch, 2.4*inch]))
    else:
        elements.append(Paragraph("No activity records found for the selected filters.", styles["Normal"]))


def _build_data_export_log(elements: list, styles, db: Session):
    elements.append(Paragraph("Data Export Log Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    exports = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(AuditLog.action == "DATA_EXPORT")
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )

    data = [["User", "Dataset", "Format", "Time"]]
    for log, user in exports:
        det = log.details or {}
        if isinstance(det, str):
            try:
                det = json.loads(det)
            except Exception:
                det = {}
        data.append([
            user.full_name if user else "Unknown",
            det.get("table_name", "Unknown"),
            det.get("format", "Unknown"),
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [2*inch, 2*inch, 1.5*inch, 2*inch]))
    else:
        elements.append(Paragraph("No data export records found.", styles["Normal"]))


def _build_database_changes(elements: list, styles, db: Session):
    elements.append(Paragraph("Database Changes Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    changes = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(AuditLog.action.in_(["DATA_MODIFICATION", "UPLOAD_DATA", "DELETE_ROW", "TABLE_TRUNCATE"]))
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )

    data = [["User", "Action", "Time", "Details"]]
    for log, user in changes:
        det = log.details or {}
        if isinstance(det, str):
            try:
                det = json.loads(det)
            except Exception:
                det = {}
        data.append([
            user.full_name if user else "Unknown",
            log.action,
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
            str(det)[:100],
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [1.8*inch, 1.8*inch, 1.6*inch, 2.8*inch]))
    else:
        elements.append(Paragraph("No database change records found.", styles["Normal"]))


def _build_audit_logs(elements: list, styles, db: Session):
    """Broad Audit Logs — all action types."""
    elements.append(Paragraph("Full Audit Log", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    logs = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .order_by(AuditLog.created_at.desc())
        .limit(200)
        .all()
    )

    data = [["User", "Action", "IP Address", "Time"]]
    for log, user in logs:
        data.append([
            user.full_name if user else "Unknown",
            log.action,
            log.ip_address or "—",
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [2*inch, 2*inch, 1.5*inch, 2*inch]))
    else:
        elements.append(Paragraph("No audit log entries found.", styles["Normal"]))


def _build_user_statistics(elements: list, styles, db: Session):
    """Admin-only: per-role breakdown and active/inactive counts."""
    elements.append(Paragraph("User Statistics Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    # Role breakdown
    role_counts = (
        db.query(User.role, func.count(User.id))
        .group_by(User.role)
        .all()
    )

    total    = db.query(func.count(User.id)).scalar() or 0
    active   = db.query(func.count(User.id)).filter(User.is_active == True).scalar() or 0
    inactive = total - active

    summary_data = [
        ["Metric", "Count"],
        ["Total Users",    str(total)],
        ["Active Users",   str(active)],
        ["Inactive Users", str(inactive)],
    ]
    elements.append(Paragraph("Summary", styles["Heading3"]))
    elements.append(_make_pdf_table(summary_data, [3*inch, 3*inch]))
    elements.append(Spacer(1, 0.15 * inch))

    role_data = [["Role", "Count"]] + [[r or "Unknown", str(c)] for r, c in role_counts]
    elements.append(Paragraph("Breakdown by Role", styles["Heading3"]))
    elements.append(_make_pdf_table(role_data, [3*inch, 3*inch]))


def _build_security_violations(elements: list, styles, db: Session, date_range: str | None = None):
    """Admin-only: Security violations — failed logins, unauthorized access, 2FA failures."""
    elements.append(Paragraph("Security Violations Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    SECURITY_ACTIONS = [
        "LOGIN_FAILED", "UNAUTHORIZED_ACCESS", "2FA_FAILED",
        "SESSION_HIJACK", "PASSWORD_CHANGE", "ACCOUNT_LOCKED",
    ]

    query = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
        .filter(AuditLog.action.in_(SECURITY_ACTIONS))
    )

    # Apply date range filter
    now = datetime.now(timezone.utc)
    range_map = {
        "today":   now - timedelta(days=1),
        "week":    now - timedelta(days=7),
        "month":   now - timedelta(days=30),
        "quarter": now - timedelta(days=90),
        "year":    now - timedelta(days=365),
    }
    if date_range and date_range in range_map:
        query = query.filter(AuditLog.created_at >= range_map[date_range])

    violations = query.order_by(AuditLog.created_at.desc()).limit(200).all()

    # Summary counts
    action_counts = {}
    for log, _ in violations:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1

    if action_counts:
        elements.append(Paragraph("Summary", styles["Heading3"]))
        summary_data = [["Violation Type", "Count"]]
        for action, count in sorted(action_counts.items(), key=lambda x: -x[1]):
            summary_data.append([action.replace("_", " ").title(), str(count)])
        elements.append(_make_pdf_table(summary_data, [3.5 * inch, 2.5 * inch]))
        elements.append(Spacer(1, 0.15 * inch))

    # Detailed log
    elements.append(Paragraph("Detailed Violations", styles["Heading3"]))
    data = [["User", "Action", "IP Address", "Time", "Details"]]
    for log, user in violations:
        details_raw = log.details or {}
        details_str = json.dumps(details_raw) if isinstance(details_raw, dict) else str(details_raw)
        data.append([
            user.full_name if user else "Unknown",
            log.action.replace("_", " ").title(),
            log.ip_address or "—",
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
            details_str[:60],
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [1.4*inch, 1.4*inch, 1.2*inch, 1.3*inch, 2.2*inch]))
    else:
        elements.append(Paragraph("No security violations found for the selected period.", styles["Normal"]))


def _build_system_logs_report(elements: list, styles, db: Session, date_range: str | None = None, user_role: str | None = None):
    """Admin-only: Comprehensive system logs from audit_logs table."""
    elements.append(Paragraph("System Logs Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    query = (
        db.query(AuditLog, User)
        .outerjoin(User, User.id == AuditLog.user_id)
    )

    # Date range filter
    now = datetime.now(timezone.utc)
    range_map = {
        "today":   now - timedelta(days=1),
        "week":    now - timedelta(days=7),
        "month":   now - timedelta(days=30),
        "quarter": now - timedelta(days=90),
        "year":    now - timedelta(days=365),
    }
    if date_range and date_range in range_map:
        query = query.filter(AuditLog.created_at >= range_map[date_range])

    # Role filter
    if user_role:
        query = query.filter(User.role == user_role)

    logs = query.order_by(AuditLog.created_at.desc()).limit(300).all()

    # Action distribution summary
    action_counts = {}
    for log, _ in logs:
        action_counts[log.action] = action_counts.get(log.action, 0) + 1

    if action_counts:
        elements.append(Paragraph("Action Distribution", styles["Heading3"]))
        dist_data = [["Action", "Count", "Percentage"]]
        total = sum(action_counts.values())
        for action, count in sorted(action_counts.items(), key=lambda x: -x[1]):
            pct = f"{(count / total * 100):.1f}%"
            dist_data.append([action.replace("_", " ").title(), str(count), pct])
        elements.append(_make_pdf_table(dist_data, [3 * inch, 1.5 * inch, 1.5 * inch]))
        elements.append(Spacer(1, 0.15 * inch))

    # Detailed entries
    elements.append(Paragraph("Log Entries", styles["Heading3"]))
    data = [["User", "Role", "Action", "IP Address", "Time"]]
    for log, user in logs:
        data.append([
            user.full_name if user else "Unknown",
            user.role if user else "—",
            log.action,
            log.ip_address or "—",
            log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—",
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [1.5*inch, 1*inch, 1.8*inch, 1.2*inch, 1.5*inch]))
    else:
        elements.append(Paragraph("No log entries found for the selected filters.", styles["Normal"]))


def _build_database_growth(elements: list, styles, db: Session):
    """Admin-only: Current database table sizes and record counts."""
    from sqlalchemy import text as sa_text

    elements.append(Paragraph("Database Growth Report", styles["Heading2"]))
    elements.append(Spacer(1, 0.1 * inch))

    try:
        sql = sa_text("""
            SELECT
                relname as table_name,
                n_live_tup as row_count,
                pg_size_pretty(pg_total_relation_size(relid)) as total_size,
                pg_total_relation_size(relid) as size_bytes
            FROM pg_stat_user_tables
            WHERE schemaname = 'public'
            ORDER BY pg_total_relation_size(relid) DESC
        """)
        result = db.execute(sql).fetchall()

        data = [["Table Name", "Row Count", "Total Size"]]
        total_rows = 0
        for row in result:
            data.append([row.table_name, f"{row.row_count:,}", row.total_size])
            total_rows += row.row_count

        if len(data) > 1:
            elements.append(_make_pdf_table(data, [2.5 * inch, 2 * inch, 2 * inch]))
            elements.append(Spacer(1, 0.1 * inch))
            elements.append(Paragraph(
                f"<b>Total rows across all tables:</b> {total_rows:,}",
                styles["Normal"]
            ))
        else:
            elements.append(Paragraph("No table statistics available.", styles["Normal"]))

    except Exception as e:
        elements.append(Paragraph(f"Database growth query failed: {str(e)}", styles["Normal"]))

    elements.append(Spacer(1, 0.15 * inch))

    # Recent data modifications summary
    elements.append(Paragraph("Recent Data Modifications (Last 30 Days)", styles["Heading3"]))
    thirty_days_ago = datetime.now(timezone.utc) - timedelta(days=30)
    mod_actions = ["UPLOAD_DATA", "DATA_MODIFICATION", "DELETE_ROW", "TABLE_TRUNCATE", "DATA_IMPORT"]

    mod_counts = (
        db.query(AuditLog.action, func.count(AuditLog.id))
        .filter(
            AuditLog.action.in_(mod_actions),
            AuditLog.created_at >= thirty_days_ago
        )
        .group_by(AuditLog.action)
        .all()
    )

    if mod_counts:
        mod_data = [["Modification Type", "Count (Last 30 Days)"]]
        for action, count in mod_counts:
            mod_data.append([action.replace("_", " ").title(), str(count)])
        elements.append(_make_pdf_table(mod_data, [3.5 * inch, 2.5 * inch]))
    else:
        elements.append(Paragraph("No data modifications in the last 30 days.", styles["Normal"]))


def _build_indicator_report(elements: list, styles, db: Session, indicator_keys: list, title: str):
    """Generic builder for reports based on IndicatorData."""
    elements.append(Paragraph(title, styles["Heading2"]))
    
    # Fetch Data Dictionary info for the first indicator to show context if possible
    main_info = _get_dict_info(db, "indicators_data", indicator_keys[0])
    if main_info:
        elements.append(Paragraph(f"<b>Overview:</b> {main_info.description or main_info.display_name}", styles["Normal"]))
    
    elements.append(Spacer(1, 0.15 * inch))

    # Fetch records for these indicators (2020-2030 to show current/near-future trends)
    records = (
        db.query(IndicatorData)
        .filter(IndicatorData.indicator_name.in_(indicator_keys))
        .filter(IndicatorData.year >= 2020)
        .filter(IndicatorData.year <= 2030)
        .order_by(IndicatorData.indicator_name, IndicatorData.year.asc())
        .limit(100)
        .all()
    )

    data = [["Indicator", "Year", "Region", "Value"]]
    for rec in records:
        rec_indicator_name = str(getattr(rec, "indicator_name", ""))
        info = _get_dict_info(db, "indicators_data", rec_indicator_name)
        display_name = str(getattr(info, "display_name", "")) if info else rec_indicator_name
        
        info_unit = getattr(info, "unit", "") if info else ""
        unit = str(info_unit) if info_unit is not None else ""
        
        rec_val = getattr(rec, "value", None)
        val_str = f"{float(rec_val):,.2f}" if rec_val is not None else "0.00"
        if unit:
            val_str += f" {unit}"

        rec_region = getattr(rec, "region", None)
        region_str = str(rec_region) if rec_region else "National"

        data.append([
            display_name,
            str(getattr(rec, "year", "")),
            region_str,
            val_str
        ])

    if len(data) > 1:
        elements.append(_make_pdf_table(data, [2.5*inch, 1*inch, 1.5*inch, 1.5*inch]))
    else:
        elements.append(Paragraph("No indicator data found for this report type in the current range (2020-2030).", styles["Normal"]))


# ─────────────────────────────────────────────────────────────────────────────
# Routes
# ─────────────────────────────────────────────────────────────────────────────

ADMIN_ONLY_REPORTS = {
    "System Health", "User Statistics", "Audit Logs",
    "Security Violations", "System Logs", "Database Growth",
    "User Activity Audit", "Data Export Log", "Database Changes",
}

# All admin report types — these MUST skip demographic/predictive analysis
_ADMIN_DISPATCH = {
    "System Health":        lambda el, st, db, req: _build_system_health(el, st, db),
    "User Activity Audit":  lambda el, st, db, req: _build_user_activity_audit(el, st, db, req.audit_type, req.date_range, req.user_role),
    "Data Export Log":      lambda el, st, db, req: _build_data_export_log(el, st, db),
    "Database Changes":     lambda el, st, db, req: _build_database_changes(el, st, db),
    "Audit Logs":           lambda el, st, db, req: _build_audit_logs(el, st, db),
    "User Statistics":      lambda el, st, db, req: _build_user_statistics(el, st, db),
    "Security Violations":  lambda el, st, db, req: _build_security_violations(el, st, db, req.date_range),
    "System Logs":          lambda el, st, db, req: _build_system_logs_report(el, st, db, req.date_range, req.user_role),
    "Database Growth":      lambda el, st, db, req: _build_database_growth(el, st, db),
}

@router.post("/generate-audit")
async def generate_audit_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Admin-exclusive PDF Generation for precise, strictly filtered Audit/Activity logs."""
    # Strict role enforcement
    if current_user.role not in ["admin", "administrator"]:
        raise HTTPException(status_code=403, detail="Forbidden: Restricted to administrators.")
        
    report_type = request.type or request.template or "Audit Logs"
    report_title = request.report_title or report_type
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_type = re.sub(r'[\\/*?:"<>| ]', "_", report_type)
    filename  = f"DataVision_Tchad_Admin_{safe_type}_{timestamp}.pdf"
    file_format = request.format or "pdf"

    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements = []
    styles = getSampleStyleSheet()

    lang = request.language or "en"
    is_ar = lang.lower() == "ar"

    # Admin Header - Localized Title
    title_map = {
        "en": "System Security Audit",
        "fr": "Audit de Sécurité du Système",
        "ar": "تدقيق أمن النظام"
    }
    localized_title = title_map.get(lang.lower(), title_map["en"])
    _build_admin_pdf_header(elements, styles, localized_title, str(getattr(current_user, "full_name")), lang=lang)

    # Schema sync map
    audit_type_mapping = {
        "user_actions": ["LOGIN", "LOGOUT", "PASSWORD_CHANGE", "LOGIN_FAILED", "UNAUTHORIZED_ACCESS", "2FA_FAILED"],
        "export_history": ["DATA_EXPORT"],
        "database_changes": ["DATA_MODIFICATION", "UPLOAD_DATA", "DELETE_ROW", "TABLE_TRUNCATE", "TABLE_LOCK_UPDATED", "DB_BACKUP", "DB_RESTORE"]
    }

    now = datetime.now(timezone.utc)
    range_map = {
        "today":   now - timedelta(days=1),
        "week":    now - timedelta(days=7),
        "month":   now - timedelta(days=30),
        "quarter": now - timedelta(days=90),
        "year":    now - timedelta(days=365),
    }

    query = db.query(AuditLog, User).outerjoin(User, User.id == AuditLog.user_id)

    if request.audit_type and request.audit_type in audit_type_mapping:
        query = query.filter(AuditLog.action.in_(audit_type_mapping[request.audit_type]))

    if request.date_range and request.date_range in range_map:
        query = query.filter(AuditLog.created_at >= range_map[request.date_range])

    if request.user_role and request.user_role != "all_roles":
        query = query.filter(User.role == request.user_role)

    logs = query.order_by(AuditLog.created_at.desc()).limit(500).all()

    def _tr(key):
        m = {
            "Total Actions": {"en": "Total Actions Logged", "fr": "Actions totales enregistrées", "ar": "إجمالي الإجراءات المسجلة"},
            "Critical Warnings": {"en": "Critical Warnings", "fr": "Avertissements critiques", "ar": "تحذيرات حرجة"},
            "Most Active User": {"en": "Most Active User", "fr": "Utilisateur le plus actif", "ar": "المستخدم الأكثر نشاطا"},
            "Most Frequent Action": {"en": "Most Frequent Action", "fr": "Action la plus fréquente", "ar": "الإجراء الأكثر تكرارا"},
            "Audit Summary": {"en": "Audit Summary", "fr": "Résumé de l'audit", "ar": "ملخص التدقيق"},
            "No audit events": {"en": "No audit events recorded for the selected criteria.", "fr": "Aucun événement d'audit enregistré pour les critères sélectionnés.", "ar": "لا توجد أحداث تدقيق مسجلة للمعايير المحددة."}
        }
        return _handle_text(m.get(key, {}).get(lang.lower(), m.get(key, {}).get("en", key)), lang)

    if not logs:
        # Zero-Result Handling
        elements.append(Spacer(1, 1 * inch))
        empty_style = ParagraphStyle("EmptyState", parent=styles["Normal"], alignment=1, fontSize=12, textColor=colors.HexColor("#64748b"))
        elements.append(Paragraph(_tr("No audit events"), empty_style))
    else:
        # Build the Visual Summary Table
        total_actions = len(logs)
        critical_warnings = sum(1 for log, _ in logs if log.action in ["LOGIN_FAILED", "UNAUTHORIZED_ACCESS", "2FA_FAILED", "SESSION_HIJACK"])
        
        user_counts: dict[str, int] = {}
        action_counts: dict[str, int] = {}
        for log, user in logs:
            uname = str(getattr(user, "full_name")) if user else "Unknown"
            user_counts[uname] = user_counts.get(uname, 0) + 1
            action = str(getattr(log, "action"))
            action_counts[action] = action_counts.get(action, 0) + 1
            
        most_active = max(user_counts, key=lambda k: user_counts[k]) if user_counts else "N/A"
        most_freq = max(action_counts, key=lambda k: action_counts[k]).replace("_", " ").title() if action_counts else "N/A"

        elements.append(Paragraph(_tr("Audit Summary"), styles["Heading2"]))
        summary_data = [
            [_tr("Total Actions"), str(total_actions)],
            [_tr("Critical Warnings"), str(critical_warnings)],
            [_tr("Most Active User"), _handle_text(most_active, lang)],
            [_tr("Most Frequent Action"), _handle_text(most_freq, lang)]
        ]
        elements.append(_make_pdf_table(summary_data, [3.5*inch, 2*inch], lang=lang))
        elements.append(Spacer(1, 0.3 * inch))

        # Build Detailed Logs - Trilingual Headers
        headers_en = ["Timestamp", "User", "Action", "IP Address", "Status"]
        headers_fr = ["Horodatage", "Utilisateur", "Action", "Adresse IP", "Statut"]
        headers_ar = ["الطابع الزمني", "المستخدم", "الإجراء", "عنوان IP", "الحالة"]
        
        h_map = {"en": headers_en, "fr": headers_fr, "ar": headers_ar}
        headers = h_map.get(lang.lower(), headers_en)
        
        # Column widths
        widths = [1.3*inch, 1.4*inch, 1.8*inch, 1.2*inch, 0.8*inch]
        
        # RTL Mirroring
        if is_ar:
            headers = headers[::-1]
            widths = widths[::-1]

        data = [headers]
        
        for log, user in logs[:200]:
            details_raw = log.details or {}
            status = details_raw.get("status", "COMPLETED") if isinstance(details_raw, dict) else "COMPLETED"
            
            # Localized Date Formatting
            if is_ar:
                ts = log.created_at.strftime("%Y/%m/%d") if log.created_at else "—"
            else:
                ts = log.created_at.strftime("%d/%m/%Y %H:%M") if log.created_at else "—"
                
            row = [
                ts,
                user.full_name if user else "Unknown",
                log.action.replace("_", " ").title(),
                log.ip_address or "—",
                status
            ]
            
            if is_ar:
                row = row[::-1]
                
            data.append(row)
            
        elements.append(_make_pdf_table(data, widths, lang=lang))

    doc.build(elements)
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()

    # Log and Save completely outside main `generate_report`
    new_report = GeneratedReport(
        user_id=current_user.id,
        file_name=filename,
        file_content=pdf_bytes,
        mime_type="application/pdf",
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)

    audit_entry = AuditLog(
        user_id=current_user.id,
        action="REPORT_GENERATION",
        details={
            "type": report_type,
            "title": report_title,
            "filename": filename,
            "report_id": str(new_report.id),
            "status": "COMPLETED",
            "filters_applied": "audit"
        },
        created_at=datetime.now(timezone.utc)
    )
    db.add(audit_entry)
    db.commit()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.post("/generate")
async def generate_report(
    request: ReportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Entry point for report generation: handles both PDF and Excel."""
    region = request.region or "National"
    print(f"LOG: Generating Report for Region: {region}")
    logging.info(f"Generating Report for Region: {region}")
    
    report_type = request.type or request.template or "standard"
    report_title = request.report_title or report_type
    file_format = request.format or "pdf"
    sections = request.sections if request.sections is not None else ["executive_summary", "trends"]
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    safe_type = re.sub(r'[\\/*?:"<>| ]', "_", report_type)

    # ── ADMIN REPORT GUARD ────────────────────────────────────────────────
    # If the report_type is an admin type, enforce role check and bypass
    # all demographic/predictive analysis (Prophet, XGBoost, pyramids).
    is_admin_report = report_type in _ADMIN_DISPATCH

    if is_admin_report:
        # Enforce admin-only access
        if current_user.role not in ["admin", "administrator"]:
            raise HTTPException(
                status_code=403,
                detail=f"Report type '{report_type}' is restricted to administrators.",
            )
        # Force empty sections to prevent demographic data from being generated
        sections = []
    
    # ── Handle Excel Format ───────────────────────────────────────────────
    if file_format == "excel":
        content = _generate_excel_report(db, request)
        # Build Excel entirely in memory (io.BytesIO is a context manager here via with statement)
        filename = f"DataVision_Tchad_{safe_type}_{timestamp}.xlsx"
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        
        # Save to Database instead of disk
        new_report = GeneratedReport(
            user_id=current_user.id,
            file_name=filename,
            file_content=content,
            mime_type=media_type,
            created_at=datetime.now(timezone.utc)
        )
        db.add(new_report)
        db.commit()
            
        return StreamingResponse(
            io.BytesIO(content),
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # ── Build PDF ──────────────────────────────────────────────────────────
    filename  = f"DataVision_Tchad_{safe_type}_{timestamp}.pdf"

    buffer   = io.BytesIO()
    doc      = SimpleDocTemplate(buffer, pagesize=A4, topMargin=0.5*inch, bottomMargin=0.5*inch)
    elements: list = []
    styles   = getSampleStyleSheet()

    # Apply watermark if requested
    def canvas_setup(canvas, doc):
        if request.include_watermark:
            _build_watermark(canvas, doc)

    # ── ADMIN REPORT PATH (strict data isolation) ─────────────────────────
    if is_admin_report:
        # Use admin-focused header (no demographic branding)
        _build_admin_pdf_header(elements, styles, report_title, str(getattr(current_user, "full_name")), lang=request.language or "en")

        # Dispatch to the correct admin builder — NO demographic data
        _ADMIN_DISPATCH[report_type](elements, styles, db, request)

    else:
        # ── ANALYST / STANDARD REPORT PATH ────────────────────────────────
        # Build Header (Only Once per Document)
        _build_pdf_header(elements, styles, report_title, str(getattr(current_user, "full_name")), lang=request.language or "fr")

        # Define Regions loop
        if request.regions and len(request.regions) > 0:
            regions_to_process = request.regions
        else:
            regions_to_process = PROVINCES_CHAD if region == "National" else [region]

        for current_region in regions_to_process:
            # Empty Region Guard
            model = CleanedData if request.dataset_id else IndicatorData
            query = db.query(model).filter(model.region == current_region)
            
            if request.dataset_id:
                query = query.filter(model.dataset_id == request.dataset_id)
            else:
                query = query.filter(model.is_cleaned == True)
            
            region_data = query.first()

            if not region_data and current_region != "National" and current_region != "Tchad":
                if region == "National" or (request.regions and len(request.regions) > 1):
                    continue
                else:
                    elements.append(Paragraph(f"<b>[Data Pending] No data available for {current_region}.</b>", styles["Normal"]))
                    continue

            # Add Region sub-header
            elements.append(Paragraph(f"<font color='#1e3a5f'><b>--- Province: {current_region} ---</b></font>", styles["Heading3"]))
            elements.append(Spacer(1, 0.1 * inch))

            # Build Sections based on selection
            if "executive_summary" in sections:
                _build_executive_summary(elements, styles, db, current_region, lang=request.language or "fr", dataset_id=request.dataset_id)
            
            if "demographics" in sections or "pyramid" in sections:
                _build_demographic_pyramid(elements, styles, db, current_region, lang=request.language or "fr", dataset_id=request.dataset_id)
                
            if "trends" in sections or "predictive" in sections:
                _build_predictive_trends(elements, styles, db, current_region, lang=request.language or "fr", dataset_id=request.dataset_id)
                
            if "health_audit" in sections:
                _build_data_health_audit(elements, styles, db, current_region, lang=request.language or "fr", dataset_id=request.dataset_id)

            # Page break after every region
            elements.append(PageBreak())

        # Add Nomenclature Legend at the end
        _build_legend(elements, styles, lang=request.language or "fr")

        # If no builder sections selected, fallback to standard templates
        if not any(s in sections for s in ["executive_summary", "pyramid", "trends", "health_audit"]):
            dispatch = {
                "standard":      lambda: _build_indicator_report(elements, styles, db, ["GDP Total", "Population", "Employment Industry"], "Rapport National Standard"),
                "monthly_demo":  lambda: _build_indicator_report(elements, styles, db, ["Infant Mortality", "Literacy Rate", "Age 0-14"], "Rapport Démographique Mensuel"),
            }
            if report_type in dispatch:
                dispatch[report_type]()
            else:
                elements.append(Paragraph("Contenu de rapport générique.", styles["Normal"]))

    elements.append(Spacer(1, 0.4 * inch))
    elements.append(Paragraph(
        "Ce document est généré automatiquement par le système DataVision Tchad · INSEED.",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7, textColor=colors.grey, alignment=1),
    ))

    # Build PDF with watermark support
    doc.build(elements, onFirstPage=canvas_setup, onLaterPages=canvas_setup)
    
    buffer.seek(0)
    pdf_bytes = buffer.getvalue()

    # ── Persist to Database ───────────────────────────────────────────────
    new_report = GeneratedReport(
        user_id=current_user.id,
        file_name=filename,
        file_content=pdf_bytes,
        mime_type="application/pdf",
        created_at=datetime.now(timezone.utc)
    )
    db.add(new_report)
    db.commit()
    db.refresh(new_report)
    
    buffer.close() # Explicitly close to prevent memory leaks as per technical directive

    # ── AuditLog entry ───────────────────────────────────────────────────
    audit_details = {
        "type":      report_type,
        "title":     report_title,
        "region":    region,
        "format":    file_format,
        "filename":  filename,
        "path":      "db://generated_reports",
        "report_id": str(new_report.id),
        "status":    "COMPLETED",
        "sections":  sections
    }

    audit_entry = AuditLog(
        user_id=current_user.id,
        action="REPORT_GENERATION",
        details=audit_details,
        created_at=datetime.now(timezone.utc),
    )
    db.add(audit_entry)
    db.commit()

    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


@router.get("/preview/{filename}")
async def preview_report(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Serve a PDF for in-browser rendering (inline, not attachment).
    Restricted to administrators only.
    """
    # Fetch from Database
    report = db.query(GeneratedReport).filter(GeneratedReport.file_name == filename).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found in database.")

    # Permissions: Administrator can preview anything. 
    # Others can only preview if they are the owner (user_id matches).
    if current_user.role != "administrator" and report.user_id != current_user.id:
        raise HTTPException(
            status_code=403,
            detail="You do not have permission to preview this report.",
        )

    file_content = getattr(report, "file_content")
    mime_type = str(getattr(report, "mime_type"))
    file_name = str(getattr(report, "file_name"))
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=mime_type,
        headers={"Content-Disposition": f"inline; filename={file_name}"},
    )


@router.get("/download/{filename}")
async def download_report(
    filename: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Force-download a generated report from the database."""
    report = db.query(GeneratedReport).filter(GeneratedReport.file_name == filename).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")

    file_content = getattr(report, "file_content")
    mime_type = str(getattr(report, "mime_type"))
    file_name = str(getattr(report, "file_name"))
    return StreamingResponse(
        io.BytesIO(file_content),
        media_type=mime_type,
        headers={"Content-Disposition": f"attachment; filename={file_name}"},
    )


@router.get("/history")
def get_report_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Return all REPORT_GENERATION audit entries.
    Admin sees every user's reports; other roles see only their own.
    """
    query = db.query(AuditLog).filter(AuditLog.action == "REPORT_GENERATION")

    if current_user.role != "administrator":
        query = query.filter(AuditLog.user_id == current_user.id)

    reports = query.order_by(AuditLog.created_at.desc()).limit(200).all()

    # Cache user lookups
    user_cache: dict[int, User | None] = {}

    history = []
    for report in reports:
        user_id = int(getattr(report, "user_id"))
        if user_id not in user_cache:
            user_cache[user_id] = db.query(User).filter(User.id == user_id).first()
        user = user_cache[user_id]

        details: dict = {}
        if isinstance(report.details, dict):
            details = report.details
        elif isinstance(report.details, str):
            try:
                details = json.loads(report.details)
            except Exception:
                pass

        filename = details.get("filename", "")

        # Determine live file status
        if details.get("status") == "processing":
            status = "processing"
        elif filename and db.query(GeneratedReport).filter(GeneratedReport.file_name == filename).first():
            status = "ready"
        else:
            status = "expired"

        history.append({
            "id":              report.id,
            "report_type":     details.get("type", "Unknown"),
            "filters_applied": details.get("parameters", {}),
            "schedule":        details.get("schedule"),
            "created_by":      user.full_name if user else "Unknown",
            "timestamp":       report.created_at.isoformat() if report.created_at else "",
            "filename":        filename,
            "status":          status,
            "parameters":      details,
        })

    return history


@router.get("/my-history")
def get_my_report_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Dedicated endpoint for analysts to see ONLY their own reports.
    Strict user isolation enforced by current_user.id.
    """
    reports = (
        db.query(AuditLog)
        .filter(AuditLog.action == "REPORT_GENERATION")
        .filter(AuditLog.user_id == current_user.id)
        .order_by(AuditLog.created_at.desc())
        .limit(100)
        .all()
    )

    history = []
    for report in reports:
        details: dict = {}
        if isinstance(report.details, dict):
            details = report.details
        elif isinstance(report.details, str):
            try:
                details = json.loads(report.details)
            except Exception:
                pass

        filename = details.get("filename", "")
        if details.get("status") == "COMPLETED" and filename and db.query(GeneratedReport).filter(GeneratedReport.file_name == filename).first():
            status = "ready"
        else:
            status = "expired"

        history.append({
            "id":              report.id,
            "report_type":     details.get("title") or details.get("type", "Unknown"),
            "filters_applied": details.get("parameters", {}),
            "created_by":      current_user.full_name,
            "timestamp":       report.created_at.isoformat() if report.created_at else "",
            "filename":        filename,
            "status":          status,
            "path":            details.get("path")
        })

    return history
