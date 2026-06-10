"""
backend/scripts/seed_inseed.py
==============================
DataVision Tchad — INSEED RGPH2 Official Data Seeder
=====================================================

Populates the `indicators_data` PostgreSQL table with the official INSEED
Scénario Tendanciel data (2009–2050) from the Deuxième Recensement Général
de la Population et de l'Habitat (RGPH2).

Indicators Seeded:
  - Population Totale      (by region, quinquennial)
  - Indice Synthétique de Fécondité (ISF)
  - Taux de Mortalité Infantile (TMI)
  - Taux d'Urbanisation (Turb)
  - PIB Nominal            (national, estimated from WB/INSEED data)
  - Taux d'alphabétisation (national estimates)
  - Accès à l'eau potable  (national estimates)
  - Taux Brut de Natalité  (TBN)
  - Taux Brut de Mortalité (TBM)
  - Espérance de Vie (e0)

Usage (from project root, venv active):
    cd c:\\DataVision\\backend
    python scripts/seed_inseed.py

    # Dry-run (print row count, no write):
    python scripts/seed_inseed.py --dry-run

    # Wipe existing INSEED rows before inserting:
    python scripts/seed_inseed.py --reset
"""

import sys
import os
import argparse
from pathlib import Path
from datetime import datetime

# ── Ensure backend root is on PYTHONPATH ─────────────────────────────────────
_BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_ROOT))

from sqlalchemy.orm import Session
from app.db.session import SessionLocal, engine, Base
from app.models import IndicatorData


# ═══════════════════════════════════════════════════════════════════════════════
#  INSEED RGPH2 — Official Tendanciel Data
# ═══════════════════════════════════════════════════════════════════════════════

# Annual years from 2009 to 2050
YEARS_ANNUAL = list(range(2009, 2051))

def interpolate_annual(data_points: dict[int, float]) -> dict[int, float]:
    """Linearly interpolate quinquennial data points into annual resolution."""
    sorted_years = sorted(data_points.keys())
    annual_data = {}
    
    for i in range(len(sorted_years) - 1):
        y_start, y_end = sorted_years[i], sorted_years[i+1]
        v_start, v_end = data_points[y_start], data_points[y_end]
        
        step = (v_end - v_start) / (y_end - y_start)
        
        for year in range(y_start, y_end):
            annual_data[year] = v_start + step * (year - y_start)
            
    # Add the final year
    annual_data[sorted_years[-1]] = data_points[sorted_years[-1]]
    return annual_data

# ── 1. Population Totale by Region (Tableau 2.04 RGPH2) ───────────────────────
POPULATION_BY_REGION: dict[str, dict[int, float]] = {
    "Tchad":             {2009:11_072_067, 2010:11_477_757, 2015:13_708_639, 2020:16_344_852, 2025:19_639_116, 2030:23_612_921, 2035:28_251_052, 2040:33_527_974, 2045:39_512_622, 2050:46_285_731},
    "Batha":             {2009:489_882,    2010:508_017,    2015:612_006,    2020:689_835,    2025:832_000,    2030:1_001_000,  2035:1_187_446,  2040:1_412_000,  2045:1_651_000,  2050:1_904_300},
    "Borkou":            {2009:93_857,     2010:97_345,     2015:117_200,    2020:138_103,    2025:166_000,    2030:193_000,    2035:218_178,    2040:254_000,    2045:300_000,    2050:343_947},
    "Chari-Baguirmi":   {2009:580_112,    2010:601_496,    2015:726_000,    2020:845_088,    2025:1_021_000,  2030:1_213_000,  2035:1_422_178,  2040:1_699_000,  2045:1_974_000,  2050:2_267_472},
    "Guéra":            {2009:539_929,    2010:559_727,    2015:674_000,    2020:635_822,    2025:814_000,    2030:975_000,    2035:1_214_814,  2040:1_448_000,  2045:1_694_000,  2050:1_945_465},
    "Hadjer-Lamis":     {2009:568_511,    2010:589_249,    2015:710_000,    2020:822_223,    2025:991_000,    2030:1_186_000,  2035:1_379_028,  2040:1_641_000,  2045:1_920_000,  2050:2_204_360},
    "Kanem":            {2009:334_359,    2010:346_605,    2015:418_000,    2020:498_268,    2025:601_000,    2030:715_000,    2035:817_137,    2040:976_000,    2045:1_144_000,  2050:1_307_566},
    "Lac":              {2009:435_055,    2010:451_048,    2015:543_000,    2020:638_662,    2025:769_000,    2030:910_000,    2035:1_059_442,  2040:1_254_000,  2045:1_470_000,  2050:1_692_278},
    "Logone Occidental":{2009:691_053,    2010:716_461,    2015:863_000,    2020:1_032_542,  2025:1_245_000,  2030:1_470_000,  2035:1_740_003,  2040:2_053_000,  2045:2_421_000,  2050:2_793_170},
    "Logone Oriental":  {2009:781_612,    2010:810_358,    2015:975_000,    2020:1_161_153,  2025:1_399_000,  2030:1_658_000,  2035:1_964_008,  2040:2_326_000,  2045:2_738_000,  2050:3_151_046},
    "Mandoul":          {2009:629_897,    2010:653_010,    2015:786_000,    2020:928_304,    2025:1_119_000,  2030:1_323_000,  2035:1_501_550,  2040:1_766_000,  2045:2_010_000,  2050:2_225_228},
    "Mayo-Kebbi Est":   {2009:777_041,    2010:805_748,    2015:969_000,    2020:1_146_679,  2025:1_383_000,  2030:1_636_000,  2035:1_929_102,  2040:2_286_000,  2045:2_693_000,  2050:3_099_163},
    "Mayo-Kebbi Ouest": {2009:566_116,    2010:586_943,    2015:707_000,    2020:845_389,    2025:1_018_000,  2030:1_214_000,  2035:1_432_216,  2040:1_712_000,  2045:2_009_000,  2050:2_305_921},
    "Moyen-Chari":      {2009:589_723,    2010:611_521,    2015:735_000,    2020:877_778,    2025:1_051_000,  2030:1_247_000,  2035:1_462_308,  2040:1_736_000,  2045:2_041_000,  2050:2_339_596},
    "Ouaddaï":          {2009:723_269,    2010:749_928,    2015:901_000,    2020:1_068_945,  2025:1_288_000,  2030:1_521_000,  2035:1_783_377,  2040:2_107_000,  2045:2_484_000,  2050:2_860_177},
    "Salamat":          {2009:303_183,    2010:314_297,    2015:378_000,    2020:450_505,    2025:543_000,    2030:645_000,    2035:755_612,    2040:897_000,    2045:1_056_000,  2050:1_214_485},
    "Tandjilé":         {2009:663_836,    2010:688_079,    2015:828_000,    2020:996_203,    2025:1_200_000,  2030:1_421_000,  2035:1_679_851,  2040:1_991_000,  2045:2_346_000,  2050:2_701_994},
    "Wadi Fira":        {2009:509_865,    2010:528_721,    2015:636_000,    2020:754_740,    2025:910_000,    2030:1_077_000,  2035:1_267_044,  2040:1_503_000,  2045:1_769_000,  2050:2_036_938},
    "N'Djamena":        {2009:954_192,    2010:1_004_000,  2015:1_295_000,  2020:1_592_258,  2025:2_046_000,  2030:2_622_000,  2035:3_434_779,  2040:4_392_000,  2045:5_529_000,  2050:6_722_429},
    "Barh El Gazel":    {2009:258_017,    2010:267_523,    2015:322_000,    2020:373_443,    2025:449_000,    2030:526_000,    2035:602_156,    2040:711_000,    2045:832_000,    2050:951_198},
    "Ennedi-Est":       {2009:168_409,    2010:174_602,    2015:209_000,    2020:247_412,    2025:298_000,    2030:343_000,    2035:389_456,    2040:457_000,    2045:534_000,    2050:612_053},
    "Sila":             {2009:388_591,    2010:402_962,    2015:484_000,    2020:563_716,    2025:680_000,    2030:803_000,    2035:953_932,    2040:1_134_000,  2045:1_328_000,  2050:1_522_976},
    "Tibesti":          {2009:25_557,     2010:26_503,     2015:31_900,     2020:37_784,     2025:44_900,     2030:51_700,     2035:57_435,     2040:66_000,     2045:75_000,     2050:83_969},
}

# ── 2. National Indicator Time Series ─────────────────────────────────────────
NATIONAL_INDICATORS: dict[str, dict[int, float]] = {
    # Fertility Rate (children / woman)
    "Indice Synthétique de Fécondité": {
        2009:7.10, 2010:7.10, 2015:7.04, 2020:6.80, 2025:6.52, 2030:6.23, 2035:5.92, 2040:5.58, 2045:5.21, 2050:4.82
    },
    # Infant Mortality Rate (‰)
    "Taux de Mortalité Infantile": {
        2009:98.0, 2010:96.2, 2015:87.9, 2020:79.5, 2025:71.3, 2030:63.4, 2035:55.7, 2040:48.5, 2045:41.4, 2050:36.4
    },
    # Urbanization Rate (%)
    "Taux d'Urbanisation": {
        2009:21.9, 2010:23.0, 2015:23.5, 2020:24.8, 2025:26.2, 2030:27.5, 2035:30.4, 2040:33.2, 2045:36.1, 2050:39.0
    },
    # Life Expectancy (years)
    "Espérance de Vie à la Naissance": {
        2009:52.4, 2010:52.8, 2015:52.9, 2020:54.0, 2025:56.0, 2030:58.0, 2035:60.2, 2040:62.5, 2045:64.8, 2050:66.6
    },
    # Crude Birth Rate (‰)
    "Taux Brut de Natalité": {
        2009:49.6, 2010:49.6, 2015:47.9, 2020:46.2, 2025:45.4, 2030:44.1, 2035:42.2, 2040:39.9, 2045:37.6, 2050:35.3
    },
    # Crude Death Rate (‰)
    "Taux Brut de Mortalité": {
        2009:14.8, 2010:14.9, 2015:13.6, 2020:12.2, 2025:10.9, 2030:9.8, 2035:8.6, 2040:7.5, 2045:6.6, 2050:5.9
    },
    # PIB Nominal (USD Billions, IMF/WB estimates for Chad)
    "PIB Nominal": {
        2009:6.98, 2010:8.74, 2015:12.84, 2020:10.77, 2025:13.50, 2030:16.20, 2035:19.80, 2040:24.50, 2045:30.10, 2050:37.20
    },
    # Literacy Rate (%)
    "Taux d'alphabétisation": {
        2009:30.5, 2010:31.1, 2015:35.4, 2020:40.2, 2025:45.5, 2030:51.2, 2035:57.3, 2040:63.2, 2045:69.0, 2050:74.5
    },
    # Water Access (%)
    "Accès à l'eau potable": {
        2009:46.0, 2010:47.2, 2015:52.3, 2020:57.8, 2025:63.2, 2030:68.5, 2035:73.8, 2040:78.9, 2045:83.5, 2050:87.6
    },
    # Contraceptive Prevalence (%)
    "Taux de Prévalence Contraceptive": {
        2009:4.8, 2010:5.1, 2015:6.6, 2020:11.6, 2025:16.6, 2030:21.6, 2035:26.6, 2040:31.6, 2045:36.6, 2050:41.6
    },
}


# ═══════════════════════════════════════════════════════════════════════════════
#  Seeder Logic
# ═══════════════════════════════════════════════════════════════════════════════

def _build_records(now: datetime) -> list[dict]:
    """Build the full list of IndicatorData dicts to insert."""
    rows: list[dict] = []

    # ── Population rows (one per region × year) ────────────────────────────
    for region, quinquennial_vals in POPULATION_BY_REGION.items():
        annual_vals = interpolate_annual(quinquennial_vals)
        for year, value in annual_vals.items():
            rows.append({
                "indicator_name": "Population Totale",
                "value":          round(float(value), 0),
                "year":           year,
                "region":         region,
                "gender":         None,
                "age_group":      None,
                "source_file":    "seed_inseed.py",
                "is_cleaned":     True,
                "validated_at":   now,
                "created_at":     now,
            })

    # ── National indicator rows (one per indicator × year) ─────────────────
    for ind_name, quinquennial_vals in NATIONAL_INDICATORS.items():
        annual_vals = interpolate_annual(quinquennial_vals)
        for year, value in annual_vals.items():
            rows.append({
                "indicator_name": ind_name,
                "value":          float(value),
                "year":           year,
                "region":         "Tchad",
                "gender":         None,
                "age_group":      None,
                "source_file":    "seed_inseed.py",
                "is_cleaned":     True,
                "validated_at":   now,
                "created_at":     now,
            })

    return rows


def seed(db: Session, reset: bool = False, dry_run: bool = False) -> int:
    """
    Insert INSEED records into indicators_data.

    Parameters
    ----------
    db      : SQLAlchemy session
    reset   : If True, delete all existing rows with source_file='seed_inseed.py' first.
    dry_run : If True, only print the count — no DB writes.
    """
    now = datetime.utcnow()
    records = _build_records(now)

    if dry_run:
        print(f"  [DRY-RUN] Would insert {len(records)} rows.")
        return len(records)

    if reset:
        deleted = db.query(IndicatorData).filter(
            IndicatorData.source_file == "seed_inseed.py"
        ).delete(synchronize_session=False)
        print(f"  [RESET] Deleted {deleted} existing seed rows.")

    # Bulk insert
    objs = []
    for r in records:
        objs.append(IndicatorData(**r))

    db.bulk_save_objects(objs)
    db.commit()
    print(f"  [OK] Inserted {len(objs)} rows into indicators_data.")
    return len(objs)


# ═══════════════════════════════════════════════════════════════════════════════
#  Entry point
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    parser = argparse.ArgumentParser(
        description="Seed PostgreSQL with INSEED RGPH2 official data."
    )
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Delete existing seed rows (source_file='seed_inseed.py') before inserting."
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Print the number of rows that would be inserted without writing to DB."
    )
    args = parser.parse_args()

    print("\n" + "=" * 65)
    print("  DataVision Tchad — INSEED RGPH2 DB Seeder")
    print(f"  Database : {os.environ.get('DATABASE_URL', '(from .env)')}")
    print("=" * 65)

    # Honour .env file
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).parent.parent / ".env")

    Base.metadata.create_all(bind=engine)  # Ensure tables exist

    db: Session = SessionLocal()
    try:
        count = seed(db, reset=args.reset, dry_run=args.dry_run)
        print(f"\n  Summary: {count} rows {'would be ' if args.dry_run else ''}seeded.")
        print("\n  Indicators available after seeding:")
        for ind in sorted(NATIONAL_INDICATORS.keys()):
            print(f"    • {ind}")
        print("    • Population Totale  (23 regions × all years)")
        print("=" * 65)
    finally:
        db.close()


if __name__ == "__main__":
    main()
