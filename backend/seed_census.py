import sys
import os
import random
import uuid
from datetime import datetime
import pandas as pd
import numpy as np

# Add the current directory to sys.path so we can import app
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.db.session import SessionLocal, engine
from app.models import IndicatorData, CleanedData, Dataset, Base

# Provinces of Tchad (23)
PROVINCES = [
    "Batha", "Chari-Baguirmi", "Hadjer-Lamis", "Wadi Fira", "Barh El Gazel",
    "Borkou", "Ennedi Est", "Ennedi Ouest", "Gera", "Kanem", "Lac",
    "Logone Occidental", "Logone Oriental", "Mandoul", "Mayo-Kebbi Est",
    "Mayo-Kebbi Ouest", "Moyen-Chari", "Ouaddaï", "Salamat", "Sila",
    "Tandjilé", "Tibesti", "N'Djamena"
]

YEARS = list(range(1995, 2025)) # 30 years

def generate_longitudinal_data():
    data = []
    
    # Base values for 1995 (realistic-ish for Tchad)
    # Population roughly 7M in 1995, now 18M
    # Each province gets a share
    base_pop = {p: random.randint(200000, 1000000) if p != "N'Djamena" else 1500000 for p in PROVINCES}
    
    for province in PROVINCES:
        # Province-specific growth rates and trends
        pop_growth = random.uniform(0.025, 0.035)
        isf_base = random.uniform(7.0, 7.5)
        e0_base = random.uniform(45.0, 48.0)
        tmi_base = random.uniform(110.0, 130.0)
        econ_base = random.uniform(10.0, 20.0)
        health_base = random.uniform(15.0, 25.0)
        
        for i, year in enumerate(YEARS):
            # Evolutionary trends
            # Population grows exponentially
            pop = base_pop[province] * ((1 + pop_growth) ** i)
            
            # ISF decreases slowly
            isf = max(4.0, isf_base - (i * random.uniform(0.05, 0.08)))
            
            # e0 increases
            e0 = min(65.0, e0_base + (i * random.uniform(0.3, 0.5)))
            
            # TMI decreases
            tmi = max(35.0, tmi_base - (i * random.uniform(2.0, 3.0)))
            
            # Economy Index (abstract) increases
            econ = econ_base + (i * random.uniform(1.0, 2.0)) + random.uniform(-2, 2)
            
            # Health Access Rate increases
            health = min(85.0, health_base + (i * random.uniform(1.5, 2.5)))
            
            # Append each indicator as a row
            row_base = {
                "region": province,
                "year": year,
                "source_file": "seed_census.py",
                "created_at": datetime.utcnow()
            }
            
            indicators = [
                ("Population Totale", pop),
                ("Indice Synthétique de Fécondité", isf),
                ("Espérance de vie à la naissance", e0),
                ("Taux de Mortalité Infantile", tmi),
                ("Economy_Index", econ),
                ("Health_Access_Rate", health)
            ]
            
            for name, val in indicators:
                data.append({**row_base, "indicator_name": name, "value": val})
                
    return data

def seed_master_dataset():
    print(f"Starting Master Seeder for {len(PROVINCES)} provinces over {len(YEARS)} years...")
    
    db = SessionLocal()
    try:
        # 1. Create a dummy dataset record to anchor this data
        master_ds = Dataset(
            id=uuid.uuid4(),
            original_filename="Master_Census_Longitudinal.csv",
            status="Cleaned",
            category="census",
            row_count=len(PROVINCES) * len(YEARS),
            col_count=6,
            created_at=datetime.utcnow()
        )
        db.add(master_ds)
        db.flush()
        
        raw_data = generate_longitudinal_data()
        print(f"Generated {len(raw_data)} data points.")
        
        # 2. Inject into indicators_data (for Visualizations)
        print("Injecting into indicators_data...")
        indicator_objects = [
            IndicatorData(**d, dataset_id=master_ds.id, is_cleaned=True)
            for d in raw_data
        ]
        db.bulk_save_objects(indicator_objects)
        
        # 3. Inject into cleaned_data (for ML Model)
        print("Injecting into cleaned_data...")
        cleaned_objects = [
            CleanedData(**d, dataset_id=master_ds.id)
            for d in raw_data
        ]
        db.bulk_save_objects(cleaned_objects)
        
        db.commit()
        print("Master injection successful!")
        print(f"Anchored to Dataset ID: {master_ds.id}")
        
    except Exception as e:
        db.rollback()
        print(f"Seeding failed: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_master_dataset()
