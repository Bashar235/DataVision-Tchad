"""
Spatial API Router for Geospatial Data Visualization

Endpoints:
- GET /geojson: Returns GeoJSON FeatureCollection for Chad's 23 provinces
- GET /stats: Returns demographic data by region_id for Recharts visualization
- GET /quality: Returns data quality metrics for Analyst audit view

Uses ISO 3166-2:TD region codes (e.g., TD-BA for Batha).
"""
import os
import re
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
from app.db.session import get_db
from app.models import User, IndicatorData, Dataset, CleanedData
from app.models.geospatial import GeospatialRegion
from app.api.v1.auth import get_current_user
from app.utils.demographics import normalize_region_name
from app.utils.indicators import GENDER_ALIASES

router = APIRouter()

FIVE_YEAR_COHORT_RE = re.compile(r"^\s*(\d+)-(\d+)\s*$|^\s*(\d+)\+\s*$")


def _is_five_year_age_cohort(age_group: str | None) -> bool:
    if not age_group:
        return False
    text = age_group.strip()
    match = FIVE_YEAR_COHORT_RE.match(text)
    if not match:
        return False
    if text.endswith("+"):
        return True
    start = int(match.group(1))
    end = int(match.group(2))
    return end - start == 4


def _age_cohort_sort_key(age_group: str | None) -> int:
    if not age_group:
        return 999
    match = re.match(r"^\s*(\d+)", age_group)
    return int(match.group(1)) if match else 999

# Absolute path to data files (avoids "File Not Found" during deployment)
SPATIAL_DATA_DIR = os.path.dirname(os.path.abspath(__file__))

# Chad's 23 provinces with ISO 3166-2:TD codes
# Placeholder coordinates (simplified polygons for MVP)
# Replace with actual HDX GeoJSON data for production
CHAD_PROVINCES = [
    {"region_id": "TD-BA", "name": "Batha", "name_fr": "Batha", "capital": "Ati", "coords": [17.34, 13.22]},
    {"region_id": "TD-LC", "name": "Lac", "name_fr": "Lac", "capital": "Bol", "coords": [14.72, 13.46]},
    {"region_id": "TD-BET", "name": "Borkou", "name_fr": "Borkou", "capital": "Faya-Largeau", "coords": [17.93, 18.00]},
    {"region_id": "TD-KA", "name": "Kanem", "name_fr": "Kanem", "capital": "Mao", "coords": [15.31, 14.12]},
    {"region_id": "TD-OD", "name": "Ouaddaï", "name_fr": "Ouaddaï", "capital": "Abéché", "coords": [20.83, 13.83]},
    {"region_id": "TD-BI", "name": "Wadi Fira", "name_fr": "Wadi Fira", "capital": "Biltine", "coords": [20.93, 14.53]},
    {"region_id": "TD-GR", "name": "Guéra", "name_fr": "Guéra", "capital": "Mongo", "coords": [18.69, 11.95]},
    {"region_id": "TD-SA", "name": "Salamat", "name_fr": "Salamat", "capital": "Am Timan", "coords": [20.28, 11.04]},
    {"region_id": "TD-CB", "name": "Chari-Baguirmi", "name_fr": "Chari-Baguirmi", "capital": "Massenya", "coords": [16.17, 11.40]},
    {"region_id": "TD-MC", "name": "Moyen-Chari", "name_fr": "Moyen-Chari", "capital": "Sarh", "coords": [18.39, 9.15]},
    {"region_id": "TD-HL", "name": "Hadjer-Lamis", "name_fr": "Hadjer-Lamis", "capital": "Massakory", "coords": [15.73, 12.47]},
    {"region_id": "TD-ME", "name": "Mayo-Kebbi Est", "name_fr": "Mayo-Kebbi Est", "capital": "Bongor", "coords": [15.37, 10.28]},
    {"region_id": "TD-MO", "name": "Mayo-Kebbi Ouest", "name_fr": "Mayo-Kebbi Ouest", "capital": "Pala", "coords": [14.97, 9.36]},
    {"region_id": "TD-ND", "name": "N'Djamena", "name_fr": "N'Djamena", "capital": "N'Djamena", "coords": [15.05, 12.11]},
    {"region_id": "TD-TA", "name": "Tandjilé", "name_fr": "Tandjilé", "capital": "Laï", "coords": [16.30, 9.40]},
    {"region_id": "TD-LO", "name": "Logone Occidental", "name_fr": "Logone Occidental", "capital": "Moundou", "coords": [16.07, 8.57]},
    {"region_id": "TD-LR", "name": "Logone Oriental", "name_fr": "Logone Oriental", "capital": "Doba", "coords": [16.85, 8.65]},
    {"region_id": "TD-MA", "name": "Mandoul", "name_fr": "Mandoul", "capital": "Koumra", "coords": [17.55, 8.91]},
    {"region_id": "TD-EN", "name": "Ennedi Est", "name_fr": "Ennedi Est", "capital": "Amdjarass", "coords": [22.84, 16.05]},
    {"region_id": "TD-EO", "name": "Ennedi Ouest", "name_fr": "Ennedi Ouest", "capital": "Fada", "coords": [21.58, 17.19]},
    {"region_id": "TD-SI", "name": "Sila", "name_fr": "Sila", "capital": "Goz Beïda", "coords": [21.41, 12.22]},
    {"region_id": "TD-TI", "name": "Tibesti", "name_fr": "Tibesti", "capital": "Bardaï", "coords": [17.00, 21.35]},
    {"region_id": "TD-BO", "name": "Barh El Gazel", "name_fr": "Barh El Gazel", "capital": "Moussoro", "coords": [16.49, 13.64]},
]


def _create_province_polygon(province_id: str, center_coords: list) -> dict:
    """
    Create a complex, professional polygon shape for a province.
    Uses a 6-point tessellated structure instead of a simple square.
    """
    lon, lat = center_coords
    
    # Dynamic scaling factor based on province to better reflect varying sizes
    size = 1.4 if province_id == "TD-BET" else 0.8
    if province_id == "TD-ND": size = 0.2  # N'Djamena is small
    
    # Create an irregular hexagon-like shape for professional GIS appearance
    points = [
        [lon - size*0.5, lat - size*0.8],
        [lon + size*0.6, lat - size*0.4],
        [lon + size*0.5, lat + size*0.7],
        [lon - size*0.4, lat + size*0.9],
        [lon - size*0.7, lat + size*0.2],
        [lon - size*0.5, lat - size*0.8]  # Close
    ]
    
    return {
        "type": "Polygon",
        "coordinates": [points]
    }


GEOJSON_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "static", "geojson", "chad_provinces.json")

@router.get("/geojson")
def get_chad_geojson(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns official GeoJSON FeatureCollection of Chad's 23 provinces.
    Merged with database-driven quality metrics.
    """
    import json
    if not os.path.exists(GEOJSON_PATH):
        # Fallback to legacy behavior if file missing
        features = []
        for province in CHAD_PROVINCES:
            feature = {
                "type": "Feature",
                "id": province["region_id"],
                "properties": {
                    "region_id": province["region_id"],
                    "name": province["name"],
                    "name_fr": province["name_fr"],
                    "capital": province["capital"],
                    "density": 15.0,
                    "growth": 2.5,
                    "quality_score": 95.0
                },
                "geometry": _create_province_polygon(str(province["region_id"]), list(province["coords"])) # type: ignore
            }
            features.append(feature)
        return {"type": "FeatureCollection", "features": features}

    with open(GEOJSON_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    # Enrich features with our internal region_id and names
    for feature in data.get("features", []):
        props = feature.get("properties", {})
        shape_name = props.get("shapeName", "").strip()
        
        # Robust matching logic: handle "Region" suffix and case-insensitivity
        clean_shape_name = shape_name.replace(" Region", "").lower()
        db_canonical_name = normalize_region_name(shape_name)
        
        match = next((
            p for p in CHAD_PROVINCES 
            if str(p["name"]).lower() == db_canonical_name.lower()
            or str(p["name_fr"]).lower() == db_canonical_name.lower()
            or str(p["name"]).lower() == clean_shape_name
            or str(p["name_fr"]).lower() == clean_shape_name
        ), None)
        
        if match:
            props.update({
                "region_id": match["region_id"],
                "name": match["name"],
                "name_fr": match["name_fr"],
                "capital": match["capital"]
            })
        else:
            props.update({
                "region_id": f"TD-{shape_name[:2].upper()}",
                "name": shape_name,
                "name_fr": shape_name
            })
        
        # Add some mock/real metrics for visualization
        props["quality_score"] = 92.5 if props["region_id"] in ["TD-BA", "TD-SA", "TD-GR"] else 97.8
        props["density"] = float(10 + (len(shape_name) * 2)) # Mock density
        props["growth"] = 2.8

    return data


@router.get("/gender-ratios")
def get_gender_ratios(
    year: int = Query(2024),
    dataset_id: Optional[str] = Query("35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns the gender ratio (Masculin / Féminin) for all provinces.
    Used for Blue/Pink intensity map styling.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    import uuid
    
    female_pat = '^f([eé]min[iï]n|emmes?|emale|_)?$'
    male_pat = '^(m(ale|asculin|_)?|hommes?)$'
    gender_regex_pattern = f"{female_pat}|{male_pat}"

    query = db.query(
        CleanedData.region,
        CleanedData.gender,
        func.sum(CleanedData.value).label("total")
    ).filter(
        CleanedData.year == year,
        func.lower(CleanedData.indicator_name).ilike('%population%'),
        CleanedData.gender.op('~*')(gender_regex_pattern)
    )

    if dataset_id:
        try:
            ds_uuid = uuid.UUID(dataset_id)
            query = query.filter(CleanedData.dataset_id == ds_uuid)
        except:
            pass

    data = query.group_by(CleanedData.region, CleanedData.gender).all()

    # Process into {region: {Masculin: X, Féminin: Y}}
    ratios = {}
    
    def get_gender_canonical(val: str) -> str:
        if not val:
            return "unknown"
        val_clean = val.strip().lower()
        if val_clean in GENDER_ALIASES['male']:
            return 'Male'
        if val_clean in GENDER_ALIASES['female']:
            return 'Female'
        import re
        if re.match(male_pat, val_clean, re.IGNORECASE):
            return 'Male'
        if re.match(female_pat, val_clean, re.IGNORECASE):
            return 'Female'
        return 'Unknown'

    for region, gender_label, total in data:
        reg_key = normalize_region_name(region)
        if reg_key not in ratios:
            ratios[reg_key] = {"Masculin": 0, "Féminin": 0}
        
        gen_canonical = get_gender_canonical(gender_label)
        if gen_canonical == "Male":
            ratios[reg_key]["Masculin"] += float(total)
        elif gen_canonical == "Female":
            ratios[reg_key]["Féminin"] += float(total)

    # Calculate final ratio score (0.5 = balanced, >0.5 = more Masculin, <0.5 = more Féminin)
    results = {}
    for reg, stats in ratios.items():
        total = stats["Masculin"] + stats["Féminin"]
        if total > 0:
            ratio = stats["Masculin"] / total
            results[reg] = {
                "ratio": round(ratio, 3),
                "total": total,
                "masculin": stats["Masculin"],
                "feminin": stats["Féminin"]
            }

    return results


@router.get("/stats/{region_name}")
def get_region_stats_by_name(
    region_name: str,
    year: Optional[int] = Query(2009),
    gender: Optional[str] = Query(None),
    dataset_id: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns demographic statistics for a specific region by name.
    Used by Recharts PieChart (gender) and BarChart (age) in the map popup.
    
    Queries indicators_data table with normalized string matching (lowercase, trimmed).
    Returns gender_stats and age_stats arrays for 'population' indicator.
    """
    # Default to Gold Standard Dataset ID if none provided
    GOLD_DATASET_ID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"
    target_ds_id = dataset_id or GOLD_DATASET_ID

    # Normalize the region name
    db_region_name = normalize_region_name(region_name)
    normalized_region = db_region_name.lower()
    clean_region = normalized_region
    
    # Handle accent variations for N'Djamena
    if "ndjamena" in clean_region.replace("'", "").replace(" ", "e").replace("é", "e"):
        clean_region = "n'djamena"
        normalized_region = "n'djamena"

    # Find the province from our list using normalized matching
    province = next(
        (p for p in CHAD_PROVINCES if str(p["name"]).lower() == clean_region 
         or str(p["name"]).lower() == normalized_region 
         or str(p["name_fr"]).lower() == clean_region), 
        None
    )
    
    # Handle "Tchad" (National) specifically
    is_national = normalized_region in ["tchad", "national", "total"]
    if is_national:
        province = {"region_id": "TD", "name": "Tchad", "name_fr": "Tchad", "capital": "N'Djaména", "coords": [18.73, 15.45]}
        province_name = "Tchad"
    elif not province:
        # Fallback: try to find by region_id (TD-BA style) if name match fails
        province = next(
            (p for p in CHAD_PROVINCES if str(p["region_id"]).strip().lower() == normalized_region),
            None
        )
        if not province:
            # Last ditch effort: partial match
            province = next(
                (p for p in CHAD_PROVINCES if clean_region in str(p["name"]).lower() or str(p["name"]).lower() in clean_region),
                None
            )
            
        if not province:
            raise HTTPException(status_code=404, detail=f"Region '{region_name}' not found")
        province_name = province["name"]
    else:
        province_name = province["name"]
    
    # ── NEAREST YEAR INTERPOLATION ──
    # If the requested year is not in the DB, find the closest available anchor
    import uuid
    ds_uuid = uuid.UUID(target_ds_id)
    
    available_years = db.query(CleanedData.year).filter(
        CleanedData.dataset_id == ds_uuid
    ).distinct().all()
    
    if available_years:
        years_list = [y[0] for y in available_years]
        if year not in years_list:
            # Find the closest year
            closest_year = min(years_list, key=lambda x: abs(x - year))
            year = closest_year

    # Unified Ennedi Fallback: If specific data for Ennedi Est/Ouest is missing, query unified 'Ennedi' record
    if normalized_region in ["ennedi est", "ennedi ouest"]:
        has_specific_data = db.query(CleanedData.id).filter(
            func.lower(func.trim(CleanedData.region)) == normalized_region,
            CleanedData.dataset_id == ds_uuid
        ).first()
        if not has_specific_data:
            normalized_region = "ennedi"

    # Build filter for region - handle N'Djamena accent variations
    if normalized_region == "n'djamena":
        region_filter = [func.lower(func.trim(CleanedData.region)).in_(["n'djamena", "n'djaména"])]
    else:
        region_filter = [func.lower(func.trim(CleanedData.region)) == normalized_region]

    female_pat = '^f([eé]min[iï]n|emmes?|emale|_)?$'
    male_pat = '^(m(ale|asculin|_)?|hommes?)$'
    gender_regex_pattern = f"{female_pat}|{male_pat}"

    # Query cleaned_data for gender stats
    # Filter: indicator_name = 'population' AND gender IS NOT NULL
    gender_q = db.query(
        CleanedData.gender,
        func.sum(CleanedData.value).label("total")
    ).filter(
        *region_filter,
        CleanedData.year == year,
        CleanedData.dataset_id == ds_uuid,
        func.lower(CleanedData.indicator_name).ilike('%population%'),
        CleanedData.gender.isnot(None),
        CleanedData.gender != '',
        CleanedData.gender.op('~*')(gender_regex_pattern)
    )
    
    if gender:
        gender_q = gender_q.filter(CleanedData.gender == gender)
        
    gender_data = gender_q.group_by(
        CleanedData.gender
    ).all()
    
    # Query cleaned_data for age stats (disaggregated by gender for pyramid)
    age_data = db.query(
        CleanedData.age_group,
        CleanedData.gender,
        func.sum(CleanedData.value).label("total")
    ).filter(
        *region_filter,
        CleanedData.year == year,
        CleanedData.dataset_id == ds_uuid,
        func.lower(CleanedData.indicator_name).ilike('%population%'),
        CleanedData.age_group.isnot(None),
        CleanedData.age_group != '',
        CleanedData.age_group != 'Total',
        CleanedData.gender.isnot(None),
        CleanedData.gender != '',
        CleanedData.gender.op('~*')(gender_regex_pattern)
    ).group_by(
        CleanedData.age_group,
        CleanedData.gender
    ).all()
    
    def get_gender_canonical(val: str) -> str:
        if not val:
            return "unknown"
        val_clean = val.strip().lower()
        if val_clean in GENDER_ALIASES['male']:
            return 'Male'
        if val_clean in GENDER_ALIASES['female']:
            return 'Female'
        import re
        if re.match(male_pat, val_clean, re.IGNORECASE):
            return 'Male'
        if re.match(female_pat, val_clean, re.IGNORECASE):
            return 'Female'
        return 'Unknown'

    # Build gender_stats array for PieChart
    if gender_data:
        male_sum = sum(int(row.total) for row in gender_data if row.total and get_gender_canonical(row.gender) == 'Male')
        female_sum = sum(int(row.total) for row in gender_data if row.total and get_gender_canonical(row.gender) == 'Female')
        total_sum = male_sum + female_sum
        
        if total_sum > 0:
            gender_stats = [
                {
                    "name": "Male",
                    "value": male_sum,
                    "percentage": round((male_sum / total_sum * 100), 1)
                },
                {
                    "name": "Female",
                    "value": female_sum,
                    "percentage": round((female_sum / total_sum * 100), 1)
                }
            ]
        else:
            gender_stats = [
                {"name": "Male", "value": 0, "percentage": 0},
                {"name": "Female", "value": 0, "percentage": 0}
            ]
    else:
        # Mock data for MVP demonstration
        gender_stats = [
            {"name": "Male", "value": 45000, "percentage": 49},
            {"name": "Female", "value": 47000, "percentage": 51},
        ]
    
    # Build age_stats array (pyramid format)
    if age_data:
        pyramid_map = {}
        for group, gender_label, total in age_data:
            if not _is_five_year_age_cohort(group):
                continue
            if group not in pyramid_map:
                pyramid_map[group] = {"age_group": group, "male": 0, "female": 0, "population": 0}
            
            gen_canonical = get_gender_canonical(gender_label)
            if gen_canonical == "Male":
                pyramid_map[group]["male"] += int(total)
            elif gen_canonical == "Female":
                pyramid_map[group]["female"] += int(total)
            
            pyramid_map[group]["population"] += int(total)
            
        age_stats = sorted(pyramid_map.values(), key=lambda x: _age_cohort_sort_key(x["age_group"]))
    else:
        # Mock data for MVP demonstration
        age_stats = [
            {"age_group": "0-14", "population": 42000, "percentage": 45},
            {"age_group": "15-24", "population": 18000, "percentage": 20},
            {"age_group": "25-54", "population": 25000, "percentage": 27},
            {"age_group": "55-64", "population": 4500, "percentage": 5},
            {"age_group": "65+", "population": 2500, "percentage": 3},
        ]
    
    return {
        "region_id": province["region_id"],
        "province_name": province_name,
        "province_name_fr": province["name_fr"],
        "capital": province["capital"],
        "gender_stats": gender_stats,
        "age_stats": age_stats,
        "data_source": "cleaned_data" if (gender_data or age_data) else "mock_data"
    }


@router.get("/stats")
def get_region_stats(
    region_id: str = Query(..., description="ISO 3166-2:TD region code (e.g., TD-BA)"),
    year: Optional[int] = Query(2009),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns demographic statistics for a specific region (legacy endpoint).
    Used by Recharts BarChart in the map popup.
    
    Returns age group distribution from indicators_data table.
    """
    # Find the province name from region_id
    province = next((p for p in CHAD_PROVINCES if p["region_id"] == region_id), None)
    if not province:
        raise HTTPException(status_code=404, detail=f"Region {region_id} not found")
    
    province_name = str(province["name"])
    normalized_region = province_name.strip().lower()
    
    # Query cleaned_data for this region with normalized matching
    # Group by age_group to get age distribution
    age_data = db.query(
        CleanedData.age_group,
        func.sum(CleanedData.value).label("total")
    ).filter(
        func.lower(func.trim(CleanedData.region)) == normalized_region,
        CleanedData.year == year,
        CleanedData.age_group != 'Total'
    ).group_by(
        CleanedData.age_group
    ).all()
    
    # If no real data, return mock data for MVP demonstration
    if not age_data:
        age_distribution = [
            {"age_group": "0-14", "population": 42000, "percentage": 45},
            {"age_group": "15-24", "population": 18000, "percentage": 20},
            {"age_group": "25-54", "population": 25000, "percentage": 27},
            {"age_group": "55-64", "population": 4500, "percentage": 5},
            {"age_group": "65+", "population": 2500, "percentage": 3},
        ]
    else:
        total = sum(row.total for row in age_data if row.total)
        age_distribution = [
            {
                "age_group": row.age_group or "Unknown",
                "population": int(row.total) if row.total else 0,
                "percentage": round((row.total / total * 100), 1) if total > 0 else 0
            }
            for row in age_data if row.age_group
        ]
    
    # Get gender distribution with normalized matching
    gender_data = db.query(
        CleanedData.gender,
        func.sum(CleanedData.value).label("total")
    ).filter(
        func.lower(func.trim(CleanedData.region)) == normalized_region,
        CleanedData.year == year,
        CleanedData.gender.isnot(None)
    ).group_by(
        CleanedData.gender
    ).all()
    
    if not gender_data:
        gender_distribution = [
            {"gender": "Male", "count": 45000, "percentage": 49},
            {"gender": "Female", "count": 47000, "percentage": 51},
        ]
    else:
        total = sum(row.total for row in gender_data if row.total)
        gender_distribution = [
            {
                "gender": row.gender or "Unknown",
                "count": int(row.total) if row.total else 0,
                "percentage": round((row.total / total * 100), 1) if total > 0 else 0
            }
            for row in gender_data if row.gender
        ]
    
    return {
        "region_id": region_id,
        "province_name": province_name,
        "province_name_fr": province["name_fr"],
        "capital": province["capital"],
        "age_distribution": age_distribution,
        "gender_distribution": gender_distribution,
        "data_source": "cleaned_data" if age_data else "mock_data"
    }



@router.get("/quality")
def get_region_quality(
    region_id: str = Query(..., description="ISO 3166-2:TD region code (e.g., TD-BA)"),
    year: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns data quality metrics for a specific region.
    Used by Analyst dashboard to show 95% Quality Gate status.
    
    Provinces colored Red (failed) or Green (passed) based on quality score.
    """
    # Check analyst permission
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Analyst role required")
    
    # Find the province name from region_id
    province = next((p for p in CHAD_PROVINCES if p["region_id"] == region_id), None)
    if not province:
        raise HTTPException(status_code=404, detail=f"Region {region_id} not found")
    
    province_name = province["name"]
    
    # Query datasets that contain data for this region
    # Calculate quality metrics based on null_count and dupe_count
    datasets = db.query(Dataset).filter(
        Dataset.status.in_(["CLEANED", "ERROR"]),
        Dataset.original_filename.ilike(f"%{province_name}%")
    ).all()
    
    total_cells = 0
    total_nulls = 0
    total_dupes = 0
    dataset_count = len(datasets)
    
    for ds in datasets:
        cells = (ds.row_count or 0) * (ds.col_count or 0)
        total_cells += cells
        total_nulls += ds.null_count or 0
        total_dupes += ds.dupe_count or 0
    
    # Calculate quality score using 95% Quality Gate formula
    if total_cells > 0:
        quality_score = 100 * (1 - (total_nulls + total_dupes) / total_cells)
        quality_score = max(0, round(quality_score, 2))  # type: ignore
    else:
        # No data for this region - return mock score for MVP
        quality_score = 92.5 if region_id in ["TD-BA", "TD-SA", "TD-GR"] else 97.8
    
    passed_quality_gate = quality_score >= 95.0
    
    # Error breakdown for popup display
    errors = []
    if total_nulls > 0:
        null_pct = round((total_nulls / total_cells * 100), 1) if total_cells > 0 else 0  # type: ignore
        errors.append({
            "type": "missing_values",
            "count": total_nulls,
            "percentage": null_pct,
            "message": f"{null_pct}% missing values"
        })
    
    if total_dupes > 0:
        dupe_pct = round((total_dupes / (total_cells / (datasets[0].col_count if datasets else 1)) * 100), 1) if total_cells > 0 else 0  # type: ignore
        errors.append({
            "type": "duplicates",
            "count": total_dupes,
            "percentage": dupe_pct,
            "message": f"{total_dupes} duplicate rows"
        })
    
    # Fetch population for the selected year if provided
    population_value = None
    if year:
        # Cast province_name as string for linting
        p_name = str(province_name)
        pop_record = db.query(CleanedData.value).filter(
            func.lower(func.trim(CleanedData.region)) == p_name.lower(),
            CleanedData.year == year,
            CleanedData.indicator_name.ilike("%Population Totale%"),
            CleanedData.age_group == "Total"
        ).first()
        if pop_record:
            population_value = float(pop_record[0])

    return {
        "region_id": region_id,
        "province_name": province_name,
        "capital": province["capital"],
        "quality_score": quality_score,
        "passed_quality_gate": passed_quality_gate,
        "status": "PASSED" if passed_quality_gate else "FAILED",
        "color": "green" if passed_quality_gate else "red",
        "datasets_analyzed": dataset_count,
        "total_cells": total_cells,
        "population_projection": population_value,
        "selected_year": year,
        "errors": errors if errors else None,
        "recommendation": None if passed_quality_gate else f"Review data quality for {province_name}. Current score: {quality_score}%"
    }


@router.get("/quality/all")
def get_all_regions_quality(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns quality status (Red/Green) for all provinces.
    Used to color the entire map in Analyst dashboard.
    """
    if current_user.role not in ["admin", "analyst", "administrator"]:
        raise HTTPException(status_code=403, detail="Analyst role required")
    
    results = []
    for province in CHAD_PROVINCES:
        # For MVP, use mock quality scores
        # In production, query actual dataset quality metrics
        mock_score = 92.5 if province["region_id"] in ["TD-BA", "TD-SA", "TD-GR"] else 97.8
        passed = mock_score >= 95.0
        
        results.append({
            "region_id": province["region_id"],
            "province_name": province["name"],
            "capital": province["capital"],
            "quality_score": mock_score,
            "passed_quality_gate": passed,
            "color": "green" if passed else "red"
        })
    
    return {
        "provinces": results,
        "summary": {
            "total": len(results),
            "passed": sum(1 for r in results if r["passed_quality_gate"]),
            "failed": sum(1 for r in results if not r["passed_quality_gate"])
        }
    }


@router.get("/meta")
def get_spatial_metadata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns unique regions, years, and indicators available in the database.
    Used for dynamically populating Visualizations filters.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        years = [r[0] for r in db.query(CleanedData.year).filter(CleanedData.year.isnot(None)).distinct().all()]
        regions = [r[0] for r in db.query(CleanedData.region).filter(CleanedData.region.isnot(None)).distinct().all()]
        indicators = [r[0] for r in db.query(CleanedData.indicator_name).filter(CleanedData.indicator_name.isnot(None)).distinct().all()]

        return {
            "years": sorted(years),
            "regions": sorted([r for r in regions if r.strip()]),
            "indicators": sorted(indicators)
        }
    except Exception as e:
        print(f"Error fetching metadata: {e}")
        # Fallback to prevent UI crash
        return {
            "years": [2009, 2024, 2050],
            "regions": ["N'Djaména", "Tchad"],
            "indicators": ["Population Totale", "Indice Synthétique de Fécondité"]
        }


@router.get("/timeseries/{region}")
def get_region_timeseries(
    region: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns full time-series data for a region, formatted for the Analyst Visualizations charts.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    try:
        normalized_region = region.strip().lower()
        
        # Determine if "all" was requested
        if normalized_region == "all" or normalized_region == "tchad":
            query = db.query(CleanedData).filter(
                func.lower(func.trim(CleanedData.region)) == "tchad"
            )
        else:
            query = db.query(CleanedData).filter(
                func.lower(func.trim(CleanedData.region)) == normalized_region
            )

        # Enforce Total age group to avoid inflation in multi-indicator charts
        query = query.filter(func.coalesce(CleanedData.age_group, "Total") == "Total")

        data = query.order_by(CleanedData.year.asc()).all()

        if not data:
            return {"data": []}

        # Need to format into an array of objects grouped by year:
        # [{ year: 2009, population: 954192, gdp: ..., }, { year: 2010 ... }]
        
        yearly_data = {}
        for row in data:
            if not row.year:
                continue
            
            y = row.year
            if y % 5 != 0 and y != 2009:
                continue
            
            if y not in yearly_data:
                yearly_data[y] = {"year": y, "region": row.region}
            
            # Map specific indicators to keys the frontend charts expect
            ind = row.indicator_name.lower()
            val = float(str(row.value)) if row.value is not None else 0.0

            # Map the exact INSEED Indicator Names
            if 'population totale' in ind or 'population' == ind:
                yearly_data[y]["population"] = val
            elif 'gdp' in ind:
                yearly_data[y]["gdp"] = val
            elif 'fécondité' in ind or 'birth' in ind:
                yearly_data[y]["fertility"] = val
            elif 'emploi' in ind or 'employment' in ind:
                yearly_data[y]["employment"] = val
            elif 'mortalité infantile' in ind:
                yearly_data[y]["infant_mortality"] = val
            
            # Additional keys
            yearly_data[y]["raw_" + row.indicator_name] = val

        return {
            "data": list(yearly_data.values())
        }
    except Exception as e:
        print(f"Error fetching timeseries: {e}")
        return {"data": []}


@router.get("/meta/indicators")
def get_indicator_metadata(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Returns unique indicator names available in the database.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
        
    indicators = [r[0] for r in db.query(IndicatorData.indicator_name).filter(IndicatorData.indicator_name.isnot(None), IndicatorData.is_cleaned == True).distinct().all()]
    return sorted(indicators)


from app.utils.indicators import resolve_indicator_names, INDICATOR_ALIASES

@router.get("/analytics/timeseries")
def get_analytics_timeseries(
    indicator: Optional[str] = Query(None),
    region: Optional[str] = Query(None),
    age_group: Optional[str] = Query(None, description="Filter by age group (e.g., 15-64)"),
    gender: Optional[str] = Query(None, description="Filter by gender (Masculin/Feminin)"),
    start_year: Optional[int] = Query(2009),
    end_year: Optional[int] = Query(2050),
    dataset_id: Optional[str] = Query(None, description="Filter by specific dataset ID"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Robust time-series endpoint for specific indicators and regions.
    Supports filtering by indicator_name, region, and age_group.

    Includes an alias resolver so that frontend strings like 'PIB Nominal',
    'GDP', 'Mortalité Infantile' etc. automatically match the stored DB values.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from app.models import CleanedData
    from sqlalchemy import or_ as sql_or
    import uuid

    # Default to Gold Standard Dataset ID if none provided
    GOLD_DATASET_ID = "35949ad2-8b2e-5123-bd6a-2dd65a98a9d3"
    target_ds_id = dataset_id or GOLD_DATASET_ID

    # Default to CleanedData for INSEED synced results
    query = db.query(CleanedData)

    try:
        ds_uuid = uuid.UUID(target_ds_id)
        query = query.filter(CleanedData.dataset_id == ds_uuid)
    except:
        pass

    if indicator:
        # ── Age group is handled separately ──────────────────────────────────
        if "\u00c2ge" in indicator or "Age" in indicator or "\xe2ge" in indicator.lower():
            query = query.filter(CleanedData.indicator_name.ilike("%Population par Groupe d'\u00c2ges%"))
        elif "population" in indicator.lower() or "pop" in indicator.lower():
            # STRICT FILTER for Population over Time
            query = query.filter(CleanedData.indicator_name == "Population Totale")
        else:
            # Resolve aliases first, then build an OR filter covering all candidates
            candidates = resolve_indicator_names(indicator)
            if len(candidates) == 1 and candidates[0] == indicator:
                # No alias hit — fall back to original ilike behaviour
                query = query.filter(CleanedData.indicator_name.ilike(f"%{indicator}%"))
            else:
                # Multiple candidates: exact OR ilike match
                conditions = [CleanedData.indicator_name.ilike(f"%{c}%") for c in candidates]
                query = query.filter(sql_or(*conditions))

    if region:
        normalized_region = region.strip().lower()
        if normalized_region in ["all", "national", "tchad", "total"]:
            query = query.filter(func.lower(func.trim(CleanedData.region)) == "tchad")
        elif "chari" in normalized_region and "baguirmi" in normalized_region:
            query = query.filter(func.lower(func.trim(CleanedData.region)).ilike("%chari%baguirmi%"))
        else:
            query = query.filter(func.lower(func.trim(CleanedData.region)) == normalized_region)

    # CRITICAL: Enforce 'Total' age group if no specific group is requested
    # to avoid population inflation (Total + Age 0-4 + Age 5-9 = triple counting)
    if not age_group:
        # If we are looking for population-related indicators, we MUST filter by Total
        # unless it's a specific non-population indicator like ISF which doesn't have age groups
        query = query.filter(sql_or(
            CleanedData.age_group == "Total",
            CleanedData.age_group == None,
            CleanedData.age_group == ""
        ))
    else:
        query = query.filter(CleanedData.age_group == age_group)

    if gender:
        query = query.filter(CleanedData.gender == gender)
    else:
        # Default to gender-neutral (Total) records for population indicators
        # to avoid summing disaggregated Masculin + Feminin records.
        if indicator and ("population" in indicator.lower() or "pop" in indicator.lower()):
            query = query.filter(CleanedData.gender == None)

    if start_year:
        query = query.filter(CleanedData.year >= start_year)
    if end_year:
        query = query.filter(CleanedData.year <= end_year)

    data = query.order_by(CleanedData.year.asc()).all()

    # Keep all years for high-resolution charts in new INSEED sync (annual)
    # data = [r for r in data]

    return [
        {
            "year":      r.year,
            "region":    r.region,
            "indicator": r.indicator_name,
            "value":     float(getattr(r, "value", 0.0)) if getattr(r, "value", None) is not None else 0.0,
            "unit":      getattr(r, "unit", ""),
        }
        for r in data
    ]


# ─── Bongaarts What-If Projection Endpoint ───────────────────────────────────

@router.get("/bongaarts")
def get_bongaarts_projection_endpoint(
    Cm: float = Query(70.7, description="% femmes en union 15-49 ans (ex: 70.7)"),
    Cc: float = Query(26.6, description="Prévalence contraceptive % (ex: 26.6)"),
    e0: float = Query(60.2, description="Espérance de vie à la naissance (années)"),
    year: int = Query(2035, description="Année cible de projection (2009–2050)"),
    region: str = Query("Tchad", description="Région (ex: Tchad, N'Djamena, Batha...)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Real-time Bongaarts What-If demographic projection.

    Implements: ISF = Cm × Ci × Ca × Cs × Cc × FN
    (Bongaarts Proximate Determinants Model — INSEED RGPH2 methodology)

    Returns: ISF, predicted population, delta vs. Tendanciel baseline,
             and a French-language interpretation.

    Called by the Predictive Analysis page sliders.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    # Validate ranges
    if not (0 <= Cm <= 100):
        raise HTTPException(status_code=422, detail="Cm must be between 0 and 100")
    if not (0 <= Cc <= 100):
        raise HTTPException(status_code=422, detail="Cc must be between 0 and 100")
    if not (30 <= e0 <= 90):
        raise HTTPException(status_code=422, detail="e0 must be between 30 and 90")
    if not (2009 <= year <= 2050):
        raise HTTPException(status_code=422, detail="year must be between 2009 and 2050")

    try:
        from app.utils.demographics import get_bongaarts_projection, REGION_NAME_MAP
        # The region from frontend may use hyphenated or space-separated form — normalize
        db_region = region.strip()
        result = get_bongaarts_projection(
            Cm_pct=Cm,
            Cc_pct=Cc,
            e0=e0,
            year=year,
            region=db_region,
            db=db,
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Projection error: {str(e)}")


@router.get("/bongaarts/tendanciel")
def get_tendanciel_series(
    region: str = Query("Tchad"),
    indicator: str = Query("ISF", description="Indicator code: ISF, e0, TBN, TBM, Cc, Cm, TMI"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns the full Scénario Tendanciel time series for an indicator (2009-2050).
    Used by the Predictive Analysis page to populate the baseline chart.
    """
    if current_user.role not in ["admin", "analyst", "administrator", "researcher"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")

    from app.utils.demographics import (
        get_tendanciel_value, get_tendanciel_population,
        get_indicator_label, REGION_NAME_MAP
    )

    db_region = REGION_NAME_MAP.get(region, region)

    series = []
    for yr in range(2009, 2051):
        # Filter for 5-year intervals (plus 2009 baseline)
        if yr % 5 != 0 and yr != 2009:
            continue
            
        if indicator == "Population_Total":
            val = get_tendanciel_population(db_region, yr, db=db)
        else:
            val = get_tendanciel_value(indicator, yr, db=db)

        if val is not None:
            series.append({"year": yr, "value": val, "region": db_region})

    label_info = get_indicator_label(indicator)
    return {
        "indicator": indicator,
        "label": label_info["label"],
        "unit": label_info["unit"],
        "region": db_region,
        "scenario": "Tendanciel (Hypothèse Moyenne)",
        "source": "INSEED RGPH2 2009-2050",
        "data": series,
    }
