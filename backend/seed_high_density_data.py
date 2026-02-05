import pandas as pd
import numpy as np
import os

# Paths
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "app", "ml", "data")
DATA_PATH = os.path.join(DATA_DIR, "synthetic_data.csv")

# Chad Regions (22-23 standard)
regions = [
    "N'Djamena", "Logone Occidental", "Logone Oriental", "Mayo-Kebbi Est",
    "Mayo-Kebbi Ouest", "Chari-Baguirmi", "Hadjer-Lamis", "Moyen-Chari",
    "Mandoul", "Tandjilé", "Ouaddaï", "Guéra", "Batha", "Salamat",
    "Kanem", "Barh El Gazel", "Lac", "Wadi Fira", "Borkou", "Ennedi",
    "Tibesti", "Sila"
]

years = list(range(2020, 2031))

data = []

# Base stats for 2020 (Approximate)
base_pop = 16200000 
pop_growth = 1.03
gdp_growth = 1.025

for year in years:
    pop_year = base_pop * (pop_growth ** (year - 2020))
    # Aggregate National Entry
    data.append({
        "year": year,
        "region": "National",
        "population": round(pop_year),
        "fertility_rate": round(6.0 - (year - 2020) * 0.05, 2),
        "mortality_rate": 12.0,
        "migration_net": 10000,
        "urbanization_rate": 23.0 + (year - 2020) * 0.5,
        "gdp_contribution": round(12000 * (gdp_growth ** (year - 2020))),
        "employment_agriculture": 70.0,
        "employment_industry": 10.0,
        "employment_services": 20.0,
        "age_0_14": 47.0,
        "age_15_64": 50.0,
        "age_65_plus": 3.0,
        "risk_score": 0.4,
        "category": "population",
        "indicator_name": "Total Population",
        "value": round(pop_year),
        "unit": "Habitants"
    })

    # Per Region Entries
    for reg in regions:
        # Distribute population (N'Djamena ~10%, others distributed)
        reg_weight = 0.15 if reg == "N'Djamena" else (0.85 / (len(regions)-1))
        reg_pop = pop_year * reg_weight * (1 + np.random.uniform(-0.05, 0.05))
        
        data.append({
            "year": year,
            "region": reg,
            "population": round(reg_pop),
            "fertility_rate": round(5.5 + np.random.uniform(0, 1), 2),
            "mortality_rate": 11.0 + np.random.uniform(0, 2),
            "migration_net": 500 if reg != "N'Djamena" else 5000,
            "urbanization_rate": 20.0 if reg != "N'Djamena" else 85.0,
            "gdp_contribution": round((12000 / len(regions)) * (gdp_growth ** (year - 2020)) * (1.2 if reg == "N'Djamena" else 0.8)),
            "employment_agriculture": 80.0 if reg != "N'Djamena" else 10.0,
            "employment_industry": 5.0 if reg != "N'Djamena" else 25.0,
            "employment_services": 15.0 if reg != "N'Djamena" else 65.0,
            "age_0_14": 48.0,
            "age_15_64": 49.0,
            "age_65_plus": 3.0,
            "risk_score": 0.3 + np.random.uniform(0, 0.3),
            "category": "population",
            "indicator_name": "Regional Population",
            "value": round(reg_pop),
            "unit": "Habitants"
        })

df = pd.DataFrame(data)
os.makedirs(DATA_DIR, exist_ok=True)
df.to_csv(DATA_PATH, index=False)

print(f"Successfully seeded {len(df)} records into {DATA_PATH}")
