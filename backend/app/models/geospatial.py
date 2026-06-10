"""
Geospatial Region Model for Chad's 23 Provinces

Uses ISO 3166-2:TD region codes (e.g., TD-BA for Batha) as the standard
region_id to prevent spelling variations and ensure data integrity.
"""
from sqlalchemy import Column, Integer, String, Numeric, Boolean
from sqlalchemy.dialects.postgresql import JSONB
from app.db.session import Base


class GeospatialRegion(Base):
    """
    Stores Chad province boundaries and metadata.
    
    GeoJSON coordinates stored in JSONB format (simplified approach).
    For full PostGIS support, upgrade to GEOMETRY type in future.
    """
    __tablename__ = "geospatial_regions"

    id = Column(Integer, primary_key=True, index=True)
    
    # ISO 3166-2:TD region code (e.g., "TD-BA" for Batha)
    region_id = Column(String(10), unique=True, nullable=False, index=True)
    
    # Province names
    province_name = Column(String(100), nullable=False)
    province_name_fr = Column(String(100), nullable=True)  # French name
    
    # GeoJSON geometry as JSONB (simplified PostGIS alternative)
    geojson = Column(JSONB, nullable=False)
    
    # Metadata
    area_km2 = Column(Numeric(10, 2), nullable=True)
    population_2023 = Column(Integer, nullable=True)
    capital = Column(String(100), nullable=True)
    
    # Data quality tracking (for Analyst view)
    has_quality_issues = Column(Boolean, default=False)
    quality_score = Column(Numeric(5, 2), nullable=True)
