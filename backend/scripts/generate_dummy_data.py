import pandas as pd
import numpy as np
import os
from datetime import datetime
from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine
from app.models import IndicatorData
from sqlalchemy import text

# localized settings
REGIONS = [
    "N'Djamena", "Logone Occidental", "Logone Oriental", "Mayo-Kebbi Ouest", 
    "Mayo-Kebbi Est", "Tandjilé", "Moyen-Chari", "Mandoul", "Salamat", 
    "Guéra", "Batha", "Ouaddaï", "Sila", "Wadi Fira", "Ennedi Ouest", 
    "Ennedi Est", "Borkou", "Tibesti", "Kanem", "Lac", "Hadjer-Lamis", 
    "Chari-Baguirmi"
]

def simulate_event(year):
    """Simulate random events affecting metrics"""
    # 5% chance of a major event (drought, crisis, boom)
    if np.random.random() < 0.05:
        return np.random.choice(["drought", "crisis", "boom"])
    return "normal"

def generate_data():
    np.random.seed(42)
    # 2000 to 2035
    years = range(2000, 2036) 
    
    data_points = []
    
    print(f"Generating data for {len(REGIONS)} regions from 2000 to 2035...")
    
    for region in REGIONS:
        # Base stats for year 2000
        base_pop = np.random.randint(200000, 1500000)
        growth_rate = np.random.uniform(0.02, 0.04) # 2-4% growth
        
        # Base indicators
        infant_mortality = np.random.uniform(80, 120) # per 1000 births
        literacy_rate = np.random.uniform(20, 40) # %
        clean_water = np.random.uniform(30, 50) # %
        
        for year in years:
            event = simulate_event(year)
            
            # 1. Population Growth
            year_growth = growth_rate + np.random.normal(0, 0.005)
            if event == "crisis": year_growth -= 0.015
            if event == "boom": year_growth += 0.01
            
            if year > 2000:
                base_pop = int(base_pop * (1 + year_growth))
            
            # 2. Key Demographics
            fertility_rate = max(3.5, 6.8 - (year - 2000) * 0.08 + np.random.normal(0, 0.1))
            mortality_rate = max(7.0, 15.0 - (year - 2000) * 0.15 + np.random.normal(0, 0.2))
            
            if event == "drought": mortality_rate += 2.0
            
            migration_net = int(np.random.normal(0, 5000))
            if event == "crisis": migration_net -= 10000
            
            urbanization = min(1.0, 0.15 + (year - 2000) * 0.012 + np.random.normal(0, 0.002))
            
            # 3. Correlated Indicators
            # Infrastructure loosely correlates with Urbanization
            infrastructure_inv = (urbanization * 1000) + np.random.normal(50, 20)
            if event == "boom": infrastructure_inv *= 1.5
            
            # Improvements over time
            infant_mortality = max(30, infant_mortality * 0.98 + np.random.normal(0, 1))
            literacy_rate = min(95, literacy_rate * 1.02 + np.random.normal(0, 0.5))
            clean_water = min(98, clean_water * 1.015 + np.random.normal(0, 0.8))

            # 4. Economic
            gdp_per_capita = 400 + (year - 2000) * 15 + np.random.normal(0, 20)
            if event == "drought": gdp_per_capita -= 50
            
            gdp_total = (base_pop * gdp_per_capita) / 1000000 # in Millions
            
            # Employment
            emp_agri = max(30, 80 - (year - 2000) * 0.8)
            emp_serv = min(50, 15 + (year - 2000) * 0.6)
            emp_ind = 100 - emp_agri - emp_serv
            
            # Age Structure
            age_0_14 = np.random.uniform(40, 48)
            age_65_plus = np.random.uniform(2.5, 4.5)
            age_15_64 = 100 - age_0_14 - age_65_plus

            # Create Record for Flattened Table (IndicatorsData)
            # We map specific metrics to the "indicators_data" table schema: 
            # id, indicator_name, value, year, region, unit, source
            
            metrics = {
                "Population": base_pop,
                "Fertility Rate": round(fertility_rate, 2),
                "Mortality Rate": round(mortality_rate, 2),
                "Urbanization Rate": round(urbanization, 3),
                "GDP Total": round(gdp_total, 2),
                "GDP Per Capita": round(gdp_per_capita, 2),
                "Employment Agriculture": round(emp_agri, 1),
                "Employment Industry": round(emp_ind, 1),
                "Employment Services": round(emp_serv, 1),
                "Infant Mortality": round(infant_mortality, 1),
                "Literacy Rate": round(literacy_rate, 1),
                "Access to Clean Water": round(clean_water, 1),
                "Infrastructure Investment": round(infrastructure_inv, 2),
                "Age 0-14": round(age_0_14, 1),
                "Age 15-64": round(age_15_64, 1),
                "Age 65+": round(age_65_plus, 1)
            }
            
            for name, val in metrics.items():
                data_points.append({
                    "indicator_name": name,
                    "value": val,
                    "year": year,
                    "region": region,
                    "unit": "Count" if name == "Population" else ("Percent" if "Rate" in name or "Employment" in name or "Water" in name else "USD"),
                    "category": "Demographic" if name in ["Population", "Fertility Rate", "Mortality Rate"] else "Economic"
                })

    # DB Insertion
    print("Inserting data into database...")
    db = SessionLocal()
    try:
        # Optional: Truncate existing data to avoid duplicates if re-running
        db.execute(text("TRUNCATE TABLE indicators_data RESTART IDENTITY CASCADE;"))
        db.commit()
        
        # Batch insert
        # Filter out keys that don't exist in the model
        model_keys = ["indicator_name", "value", "year", "region"]
        objects = []
        for d in data_points:
            filtered_d = {k: v for k, v in d.items() if k in model_keys}
            objects.append(IndicatorData(**filtered_d))
        
        # Insert in chunks to avoid memory issues
        chunk_size = 5000
        for i in range(0, len(objects), chunk_size):
            db.bulk_save_objects(objects[i:i+chunk_size])
            db.commit()
            print(f"Inserted chunk {i} to {i+chunk_size}")
            
    except Exception as e:
        print(f"Error inserting data: {e}")
        db.rollback()
    finally:
        db.close()
        
    print(f"Successfully generated and inserted {len(data_points)} records.")

if __name__ == "__main__":
    generate_data()
