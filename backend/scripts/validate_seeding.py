import sys
import os
from pathlib import Path
import pandas as pd

# Add backend root to path
BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal
from app.models import CleanedData
from sqlalchemy import func

def validate():
    db = SessionLocal()
    try:
        print("--- Validating INSEED Sync Results ---")
        
        # 1. Check Baseline (2009) and Benchmark (2026)
        pop_2009 = db.query(CleanedData.value).filter(
            CleanedData.region == "Tchad",
            CleanedData.year == 2009,
            CleanedData.indicator_name == "Population Totale"
        ).scalar()
        
        pop_2026 = db.query(CleanedData.value).filter(
            CleanedData.region == "Tchad",
            CleanedData.year == 2026,
            CleanedData.indicator_name == "Population Totale"
        ).scalar()
        
        print(f"National Population 2009: {pop_2009:,.0f} (Target: ~11,039,873)")
        print(f"National Population 2026: {pop_2026:,.0f} (Target: ~20,031,602)")
        
        if abs(pop_2009 - 11_039_873) < 100:
            print("  [OK] 2009 Baseline is accurate.")
        else:
            print("  [ERROR] 2009 Baseline is OFF.")
            
        if abs(pop_2026 - 20_031_602) < 5000:
            print("  [OK] 2026 Benchmark is accurate.")
        else:
            print("  [ERROR] 2026 Benchmark is OFF.")

        # 2. Check 'Total' Age Group vs 'Population Totale'
        mismatched_totals = db.query(CleanedData.year, CleanedData.region).filter(
            CleanedData.indicator_name == "Population",
            CleanedData.age_group == "Total"
        ).all()
        
        check_passed = True
        for yr, reg in mismatched_totals[:5]: # Sample check
            total_age_val = db.query(CleanedData.value).filter(
                CleanedData.region == reg, CleanedData.year == yr,
                CleanedData.indicator_name == "Population", CleanedData.age_group == "Total"
            ).scalar()
            
            pop_total_val = db.query(CleanedData.value).filter(
                CleanedData.region == reg, CleanedData.year == yr,
                CleanedData.indicator_name == "Population Totale"
            ).scalar()
            
            if total_age_val != pop_total_val:
                print(f"  [ERROR] {reg} {yr}: Age Group 'Total' ({total_age_val}) != Population Totale ({pop_total_val})")
                check_passed = False
        
        if check_passed:
            print("  [OK] 'Total' age group rows match 'Population Totale' indicators.")

        # 3. Check Cohort Summation Integrity
        # Select a random year/region to verify sum
        sample_reg = "N'Djamena"
        sample_yr = 2030
        
        total_val = db.query(CleanedData.value).filter(
            CleanedData.region == sample_reg, CleanedData.year == sample_yr,
            CleanedData.indicator_name == "Population", CleanedData.age_group == "Total"
        ).scalar()
        
        cohort_sum = db.query(func.sum(CleanedData.value)).filter(
            CleanedData.region == sample_reg, CleanedData.year == sample_yr,
            CleanedData.indicator_name == "Population",
            CleanedData.age_group.in_(["0-4", "5-9", "10-14", "15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49", "50-54", "55-59", "60+"])
        ).scalar()
        
        print(f"Sample Sum Check (N'Djamena 2030): Cohorts Sum ({cohort_sum}) vs Total ({total_val})")
        if cohort_sum == total_val:
            print("  [OK] Age cohorts sum exactly to 'Total' row.")
        else:
            print("  [ERROR] Cohort summation mismatch.")

        # 4. Check Life Expectancy 2050
        e0_2050 = db.query(func.avg(CleanedData.value)).filter(
            CleanedData.region == "Tchad",
            CleanedData.year == 2050,
            CleanedData.indicator_name == "Espérance de vie à la naissance"
        ).scalar()
        print(f"Average Life Expectancy 2050: {e0_2050:.1f} (Target: ~65.2)")
        if 64.0 <= e0_2050 <= 66.5:
            print("  [OK] Life expectancy 2050 is on target.")
            
        # 5. Check Tibesti Population (Scale check)
        tib_2009 = db.query(CleanedData.value).filter(
            CleanedData.region == "Tibesti", CleanedData.year == 2009,
            CleanedData.indicator_name == "Population Totale"
        ).scalar()
        print(f"Tibesti Population 2009: {tib_2009:,.0f} (Should be ~25k)")
        if tib_2009 < 50000:
            print("  [OK] Tibesti scale is realistic.")
        else:
            print("  [ERROR] Tibesti scale is too high.")

    finally:
        db.close()

if __name__ == "__main__":
    validate()
