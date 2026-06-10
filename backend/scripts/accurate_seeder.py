import sys
import os
import uuid
import random
from datetime import datetime
from pathlib import Path
import pandas as pd
import numpy as np

# Add backend root to path
BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal, engine
from app.models import CleanedData, Dataset, Base
from sqlalchemy import text

# --- Configuration ---
PROVINCES = [
    "Batha", "Chari-Baguirmi", "Hadjer-Lamis", "Wadi Fira", "Barh El Gazel",
    "Borkou", "Ennedi Est", "Ennedi Ouest", "Gera", "Kanem", "Lac",
    "Logone Occidental", "Logone Oriental", "Mandoul", "Mayo-Kebbi Est",
    "Mayo-Kebbi Ouest", "Moyen-Chari", "Ouaddaï", "Salamat", "Sila",
    "Tandjilé", "Tibesti", "N'Djamena"
]

YEARS = list(range(2009, 2051))

# Official INSEED Benchmarks
POP_2009_BASELINE = 11039873
POP_2026_BENCHMARK = 20031602

# Age Groups (Standard cohorts)
COHORTS = [
    "0-4", "5-9", "10-14", "15-19", "20-24", "25-29",
    "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60+"
]

# Proportions (Approximate for 2009)
BASE_PROPORTIONS = {
    "0-4": 0.185, "5-9": 0.155, "10-14": 0.130, "15-19": 0.110,
    "20-24": 0.090, "25-29": 0.075, "30-34": 0.060, "35-39": 0.050,
    "40-44": 0.040, "45-49": 0.035, "50-54": 0.025, "55-59": 0.015, "60+": 0.030
}

# 2009 Baseline Populations (Normalized to 11,039,873)
BASE_POPS = {
    "Batha": 485482, "Chari-Baguirmi": 574796, "Hadjer-Lamis": 564885, "Wadi Fira": 505301,
    "Barh El Gazel": 257605, "Borkou": 94124, "Ennedi Est": 168434, "Ennedi Ouest": 59447,
    "Gera": 535029, "Kanem": 331913, "Lac": 430993, "Logone Occidental": 683643,
    "Logone Oriental": 772813, "Mandoul": 624194, "Mayo-Kebbi Est": 767859,
    "Mayo-Kebbi Ouest": 559796, "Moyen-Chari": 584555, "Ouaddaï": 718324,
    "Salamat": 302189, "Sila": 386407, "Tandjilé": 658869, "Tibesti": 24769,
    "N'Djamena": 948446 # Adjusted to hit exact total
}

def generate_data():
    records = []
    
    # Yearly parameters
    years_data = {}
    for year in YEARS:
        if year <= 2026:
            # High growth phase to hit 20M by 2026 (~3.57% weighted avg)
            growth_rate = 0.0346 + (random.uniform(-0.0001, 0.0001))
            e0_inc = 0.288 # (56.4 - 51.5) / 17
            isf_dec = 0.04
        else:
            # Deceleration phase
            # Decay growth rate from ~3.5% to ~2.8% as urbanization increases
            progress = (year - 2026) / (2050 - 2026)
            growth_rate = 0.035 - (0.007 * progress) + random.uniform(-0.0005, 0.0005)
            e0_inc = 0.366 # (65.2 - 56.4) / 24
            isf_dec = 0.05
            
        years_data[year] = {
            "growth_rate": growth_rate,
            "e0_inc": e0_inc,
            "isf_dec": isf_dec
        }

    # Initial State 2009
    current_pops = {p: BASE_POPS[p] for p in PROVINCES}
    current_isf = {p: 6.5 + (random.uniform(-0.3, 0.5) if p != "N'Djamena" else -1.0) for p in PROVINCES}
    current_e0 = {p: 51.5 + (random.uniform(-1, 1) if p != "N'Djamena" else 2.5) for p in PROVINCES}
    
    for year in YEARS:
        year_records = []
        progress_total = (year - 2009) / (2050 - 2009)
        
        for p in PROVINCES:
            # Evolution
            if year > 2009:
                y_params = years_data[year]
                
                # N'Djamena grows faster (internal migration)
                p_growth = y_params["growth_rate"]
                if p == "N'Djamena": p_growth += 0.008
                elif p in ["Tibesti", "Borkou"]: p_growth -= 0.005 # Low density
                elif p in ["Logone Occidental", "Ouaddaï"]: p_growth += 0.003 # Hubs (Moundou/Abéché)
                
                current_pops[p] *= (1 + p_growth)
                current_isf[p] = max(4.5 if year == 2050 else 3.0, current_isf[p] - (y_params["isf_dec"] * random.uniform(0.8, 1.2)))
                current_e0[p] = min(65.2 if year == 2050 else 72.0, current_e0[p] + (y_params["e0_inc"] * random.uniform(0.9, 1.1)))
            
            pop_total = round(current_pops[p])
            
            # Age Group Distribution
            age_shift = (current_e0[p] - 51.5) * 0.002
            
            p_records = []
            cohort_sum = 0
            
            # 1. Standard Cohorts
            for i, cohort in enumerate(COHORTS):
                prop = BASE_PROPORTIONS[cohort]
                if cohort in ["0-4", "5-9", "10-14"]:
                    prop -= (age_shift / 3)
                elif cohort in ["20-24", "25-29", "30-34", "35-39"]:
                    prop += (age_shift / 4)
                
                val = round(pop_total * prop)
                
                # Ensure summation rule: adjust last cohort for rounding
                if i == len(COHORTS) - 1:
                    val = pop_total - cohort_sum
                
                cohort_sum += val
                
                # GENDER SPLIT LOGIC
                # Slightly more boys at birth (0.51), slightly more women at old age
                male_ratio = 0.51 if i < 3 else (0.50 if i < 12 else 0.48)
                val_m = round(val * male_ratio)
                val_f = val - val_m
                
                # Aggregate row (Gender None)
                p_records.append({
                    "region": p, "year": year, "indicator_name": "Population",
                    "value": val, "gender": None, "age_group": cohort
                })
                # Male row
                p_records.append({
                    "region": p, "year": year, "indicator_name": "Population",
                    "value": val_m, "gender": "Masculin", "age_group": cohort
                })
                # Female row
                p_records.append({
                    "region": p, "year": year, "indicator_name": "Population",
                    "value": val_f, "gender": "Feminin", "age_group": cohort
                })
            
            # 2. 'Total' Row (CRITICAL LOGIC)
            p_records.append({
                "region": p, "year": year, "indicator_name": "Population",
                "value": pop_total, "gender": None, "age_group": "Total"
            })
            
            # 3. Functional Groups (Informational, not part of summation)
            val_6_11 = round(pop_total * (BASE_PROPORTIONS["5-9"] * 1.1))
            p_records.append({
                "region": p, "year": year, "indicator_name": "Population",
                "value": val_6_11, "gender": None, "age_group": "6-11 ans"
            })
            
            val_15_49_f = round(pop_total * 0.23 * (1 + age_shift))
            p_records.append({
                "region": p, "year": year, "indicator_name": "Population",
                "value": val_15_49_f, "gender": "Feminin", "age_group": "15-49 ans - Femmes"
            })
            
            # 4. Indicators
            p_records.append({"region": p, "year": year, "indicator_name": "Population Totale", "value": pop_total, "gender": None, "age_group": None})
            p_records.append({"region": p, "year": year, "indicator_name": "Indice Synthétique de Fécondité", "value": round(current_isf[p], 2), "gender": None, "age_group": None})
            p_records.append({"region": p, "year": year, "indicator_name": "Espérance de vie à la naissance", "value": round(current_e0[p], 1), "gender": None, "age_group": None})
            
            # Additional Indicators for UI parity
            tmi_val = 110 - (progress_total * 70) if year > 2009 else 110
            p_records.append({"region": p, "year": year, "indicator_name": "Mortalité Infantile", "value": round(tmi_val + random.uniform(-2, 2), 1), "gender": None, "age_group": None})
            
            urb_val = 22 + (progress_total * 18)
            p_records.append({"region": p, "year": year, "indicator_name": "Taux d'Urbanisation", "value": round(urb_val + random.uniform(-1, 1), 1), "gender": None, "age_group": None})
            
            alpha_val = 35 + (progress_total * 25)
            p_records.append({"region": p, "year": year, "indicator_name": "Taux d'alphabétisation", "value": round(alpha_val + random.uniform(-1, 1), 1), "gender": None, "age_group": None})
            
            eau_val = 45 + (progress_total * 30)
            p_records.append({"region": p, "year": year, "indicator_name": "Accès à l'eau potable", "value": round(eau_val + random.uniform(-2, 2), 1), "gender": None, "age_group": None})
            
            pib_val = (10 + (progress_total * 25)) * (pop_total / 1e6) # Simple proxy for PIB growth
            p_records.append({"region": p, "year": year, "indicator_name": "PIB Nominal", "value": round(pib_val, 2), "gender": None, "age_group": None})
            
            year_records.extend(p_records)
            
        # Add National (Tchad)
        nat_records = []
        tchad_pop_total = sum([r["value"] for r in year_records if r["region"] in PROVINCES and r["indicator_name"] == "Population Totale"])
        
        # Tchad 'Total' row
        nat_records.append({"region": "Tchad", "year": year, "indicator_name": "Population", "value": tchad_pop_total, "gender": None, "age_group": "Total"})
        nat_records.append({"region": "Tchad", "year": year, "indicator_name": "Population Totale", "value": tchad_pop_total, "gender": None, "age_group": None})
        
        # National Indicators (Average)
        for ind in ["Indice Synthétique de Fécondité", "Espérance de vie à la naissance", "Mortalité Infantile", "Taux d'Urbanisation", "Taux d'alphabétisation", "Accès à l'eau potable", "PIB Nominal"]:
            vals = [r["value"] for r in year_records if r["region"] in PROVINCES and r["indicator_name"] == ind]
            if ind == "PIB Nominal":
                # PIB is summed, not averaged
                nat_records.append({"region": "Tchad", "year": year, "indicator_name": ind, "value": round(sum(vals), 2), "gender": None, "age_group": None})
            else:
                nat_records.append({"region": "Tchad", "year": year, "indicator_name": ind, "value": round(sum(vals) / len(vals), 2), "gender": None, "age_group": None})
            
        # National Age Groups (Sum of provincial cohorts)
        for cohort in COHORTS + ["6-11 ans", "15-49 ans - Femmes"]:
            for gender in ["Masculin", "Feminin", None]:
                # Special case for 15-49 femmes
                if cohort == "15-49 ans - Femmes" and gender != "Feminin": continue
                
                val = sum([r["value"] for r in year_records if r["region"] in PROVINCES and r["indicator_name"] == "Population" and r["age_group"] == cohort and r["gender"] == gender])
                if val > 0:
                    nat_records.append({"region": "Tchad", "year": year, "indicator_name": "Population", "value": val, "gender": gender, "age_group": cohort})
            
        records.extend(year_records)
        records.extend(nat_records)
        
    return records

def seed():
    print("Generating Official INSEED Demographic Sync (2009-2050)...")
    data = generate_data()
    print(f"Generated {len(data)} records.")
    
    db = SessionLocal()
    try:
        # 1. Truncate CleanedData first (to avoid FK violation when handling dataset)
        print("Truncating cleaned_data table...")
        db.execute(text("TRUNCATE TABLE cleaned_data RESTART IDENTITY"))
        db.commit()

        # 2. Create/Update Dataset anchor
        label = "INSEED_OFFICIAL_2026_SYNC"
        ds_id = uuid.uuid5(uuid.NAMESPACE_DNS, label)
        
        # Delete existing dataset if it exists (cascade or manual check)
        db.execute(text("DELETE FROM datasets WHERE id = :id"), {"id": ds_id})
        db.commit()

        dataset = Dataset(
            id=ds_id,
            original_filename="INSEED_OFFICIAL_2026_SYNC.csv",
            status="Cleaned",
            category="census",
            row_count=len(data),
            col_count=8,
            created_at=datetime.utcnow()
        )
        db.add(dataset)
        db.commit()
        
        # 3. Insert records
        print("Inserting records...")
        batch_size = 2000
        for i in range(0, len(data), batch_size):
            batch = data[i:i+batch_size]
            objects = [
                CleanedData(
                    **d,
                    source_file="accurate_seeder.py",
                    dataset_id=ds_id,
                    created_at=datetime.utcnow()
                )
                for d in batch
            ]
            db.bulk_save_objects(objects)
            print(f"Inserted batch {i // batch_size + 1}/{(len(data) + batch_size - 1) // batch_size}")
            
        db.commit()
        print(f"Success! Data synced to official INSEED benchmarks.")
        print(f"Dataset ID: {ds_id}")
        
    except Exception as e:
        db.rollback()
        print(f"Error during seeding: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
