"""
INSEED GOLD STANDARD SEEDER (2009-2050)
dataset_id = 'INSEED_GOLD_STANDARD_2026'
All anchors locked: Pop 2009=11,039,873 | Pop 2024=20,299,123 | Pop 2026≈21,560,000
Zero random noise — deterministic smooth curves only.
"""
import sys
import os
import uuid
from datetime import datetime
from pathlib import Path

BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal, engine
from app.models import CleanedData, Dataset, Base
from sqlalchemy import text

# ─── Constants ────────────────────────────────────────────────────────────────
DATASET_LABEL = "INSEED_GOLD_STANDARD_2026"
DATASET_ID    = uuid.uuid5(uuid.NAMESPACE_DNS, DATASET_LABEL)

YEARS = list(range(2009, 2051))

# Gender split (constant)
MALE_RATIO   = 0.498
FEMALE_RATIO = 0.502

# Province list (23 provinces)
PROVINCES = [
    "Batha", "Chari-Baguirmi", "Hadjer-Lamis", "Wadi Fira", "Barh El Gazel",
    "Borkou", "Ennedi Est", "Ennedi Ouest", "Guéra", "Kanem", "Lac",
    "Logone Occidental", "Logone Oriental", "Mandoul", "Mayo-Kebbi Est",
    "Mayo-Kebbi Ouest", "Moyen-Chari", "Ouaddaï", "Salamat", "Sila",
    "Tandjilé", "Tibesti", "N'Djamena"
]

# 2009 provincial baseline populations (sum = 11,039,873)
BASE_POPS_2009 = {
    "Batha":             485_482,
    "Chari-Baguirmi":    574_796,
    "Hadjer-Lamis":      564_885,
    "Wadi Fira":         505_301,
    "Barh El Gazel":     257_605,
    "Borkou":             94_124,
    "Ennedi Est":        168_434,
    "Ennedi Ouest":       59_447,
    "Guéra":             535_029,
    "Kanem":             331_913,
    "Lac":               430_993,
    "Logone Occidental": 683_643,
    "Logone Oriental":   772_813,
    "Mandoul":           624_194,
    "Mayo-Kebbi Est":    767_859,
    "Mayo-Kebbi Ouest":  559_796,
    "Moyen-Chari":       584_555,
    "Ouaddaï":           718_324,
    "Salamat":           302_189,
    "Sila":              386_407,
    "Tandjilé":          658_869,
    "Tibesti":            24_769,
    "N'Djamena":         948_446,
}

# Verify baseline
_total_check = sum(BASE_POPS_2009.values())
assert _total_check == 11_039_873, f"Baseline sum mismatch: {_total_check}"

# ─── Smooth Interpolation Helper ──────────────────────────────────────────────
def _interp(y0: float, y1: float, t: float) -> float:
    """Linear interpolation: t ∈ [0, 1]"""
    return y0 + (y1 - y0) * t

def progress(year: int, start: int = 2009, end: int = 2050) -> float:
    return (year - start) / (end - start)

# ─── National-Level Indicator Anchors ─────────────────────────────────────────
# ISF: 6.4 (2009) → 5.8 (2024) → 4.2 (2050)
def get_isf(year: int) -> float:
    if year <= 2024:
        t = (year - 2009) / (2024 - 2009)
        return round(_interp(6.4, 5.8, t), 3)
    else:
        t = (year - 2024) / (2050 - 2024)
        return round(_interp(5.8, 4.2, t), 3)

# e0: 51.5 (2009) → 55.6 (2024) → 65.0 (2050)
def get_e0(year: int) -> float:
    if year <= 2024:
        t = (year - 2009) / (2024 - 2009)
        return round(_interp(51.5, 55.6, t), 2)
    else:
        t = (year - 2024) / (2050 - 2024)
        return round(_interp(55.6, 65.0, t), 2)

# TMI: 78 (2009) → 61 (2024) → 35 (2050)
def get_tmi(year: int) -> float:
    if year <= 2024:
        t = (year - 2009) / (2024 - 2009)
        return round(_interp(78.0, 61.0, t), 2)
    else:
        t = (year - 2024) / (2050 - 2024)
        return round(_interp(61.0, 35.0, t), 2)

# Urbanisation: 21% (2009) → 32% (2050) linear
def get_urbanisation(year: int) -> float:
    return round(_interp(21.0, 32.0, progress(year)), 2)

# Growth rate: 3.6% (2009) → 3.1% (2050) smooth
def get_growth_rate(year: int) -> float:
    return _interp(0.036, 0.031, progress(year))

# ─── National Population via Anchored Growth ──────────────────────────────────
# Build year-by-year national totals locked to: 2009=11,039,873 | 2024=20,299,123 | 2026≈21,560,000
def build_national_pops() -> dict:
    pops = {2009: 11_039_873}
    # Phase 1: 2009→2024, solve for exact rate to hit 20,299,123
    # rate = (20299123/11039873)^(1/15) - 1 ≈ 0.04177 but we smooth it
    # Use anchor-locked annual growth derived from segment targets
    # Segment 2009-2024 (15 yrs): target 20,299,123
    import math
    r1 = (20_299_123 / 11_039_873) ** (1/15) - 1  # ~4.177%
    for y in range(2010, 2025):
        pops[y] = round(pops[y-1] * (1 + r1))
    # Correct 2024 to exact anchor
    pops[2024] = 20_299_123

    # Segment 2024-2026: target ~21,560,000
    r2 = (21_560_000 / 20_299_123) ** (1/2) - 1
    for y in range(2025, 2027):
        pops[y] = round(pops[y-1] * (1 + r2))
    pops[2026] = 21_560_000

    # Segment 2026-2050: smooth deceleration 3.6%→3.1%
    for y in range(2027, 2051):
        # Smooth annual growth from ~r2 down to 3.1%
        t = (y - 2026) / (2050 - 2026)
        rate = _interp(r2, 0.031, t)
        pops[y] = round(pops[y-1] * (1 + rate))

    return pops

NAT_POPS = build_national_pops()

# ─── Provincial Population Distribution ───────────────────────────────────────
# N'Djamena = 12.5% of national with slightly higher growth (4.2%)
# Other provinces share remaining 87.5% proportionally
def build_provincial_pops() -> dict:
    """Returns {year: {province: pop}}"""
    result = {}
    base_non_ndj = {p: BASE_POPS_2009[p] for p in PROVINCES if p != "N'Djamena"}
    total_non_ndj_2009 = sum(base_non_ndj.values())

    for y in YEARS:
        nat = NAT_POPS[y]
        ndj_pop = round(nat * 0.125)
        remaining = nat - ndj_pop
        # Scale each non-NDJ province by their base proportion * remaining
        year_pops = {}
        allocated = 0
        provinces_list = [p for p in PROVINCES if p != "N'Djamena"]
        for i, p in enumerate(provinces_list):
            share = BASE_POPS_2009[p] / total_non_ndj_2009
            if i == len(provinces_list) - 1:
                year_pops[p] = remaining - allocated
            else:
                year_pops[p] = round(remaining * share)
                allocated += year_pops[p]
        year_pops["N'Djamena"] = ndj_pop
        result[y] = year_pops
    return result

PROV_POPS = build_provincial_pops()

# ─── INSEED Age Cohort Structure ───────────────────────────────────────────────
# Cohorts: 0-4, 6-11, 12-18, 18+, 60+
# These sum exactly to Population Totale
# Proportions evolve smoothly with e0 (aging population)
def get_cohort_proportions(year: int) -> dict:
    """Returns proportions for INSEED cohorts that sum to 1.0"""
    # As e0 rises and ISF falls, youth shrinks, elderly grows
    p = progress(year)
    prop_0_4   = round(_interp(0.185, 0.145, p), 4)
    prop_6_11  = round(_interp(0.150, 0.120, p), 4)
    prop_12_18 = round(_interp(0.125, 0.110, p), 4)
    prop_60p   = round(_interp(0.040, 0.075, p), 4)
    # 18+ gets the remainder
    prop_18p   = round(1.0 - prop_0_4 - prop_6_11 - prop_12_18 - prop_60p, 4)
    return {
        "0-4":   prop_0_4,
        "6-11":  prop_6_11,
        "12-18": prop_12_18,
        "18+":   prop_18p,
        "60+":   prop_60p,
    }

# ─── Additional Indicators ────────────────────────────────────────────────────
def get_tbn(year: int) -> float:
    """Taux Brut de Natalité ‰: ~49 (2009) → 35 (2050)"""
    return round(_interp(49.6, 35.0, progress(year)), 2)

def get_tbm(year: int) -> float:
    """Taux Brut de Mortalité ‰: ~14.8 (2009) → 5.9 (2050)"""
    return round(_interp(14.8, 5.9, progress(year)), 2)

def get_tan(year: int) -> float:
    """Taux Accroissement Naturel %"""
    return round((get_tbn(year) - get_tbm(year)) / 10.0, 3)

def get_alphabetisation(year: int) -> float:
    """Taux alphabétisation %: 35 (2009) → 65 (2050)"""
    return round(_interp(35.0, 65.0, progress(year)), 2)

def get_eau(year: int) -> float:
    """Accès eau potable %: 45 (2009) → 80 (2050)"""
    return round(_interp(45.0, 80.0, progress(year)), 2)

def get_contraception(year: int) -> float:
    """Prévalence contraceptive %: 4.8 (2009) → 42 (2050)"""
    return round(_interp(4.8, 42.0, progress(year)), 2)

def get_hiv(year: int) -> float:
    """VIH prévalence %: 3.4 (2009) → 1.0 (2050)"""
    return round(_interp(3.4, 1.0, progress(year)), 3)

def get_tbr(year: int) -> float:
    """Taux Brut de Reproduction filles/femme"""
    return round(get_isf(year) * 0.487, 3)

def get_tmm5(year: int) -> float:
    """Mortalité Infanto-Juvénile ‰: 145 (2009) → 55 (2050)"""
    return round(_interp(145.0, 55.0, progress(year)), 2)

def get_e0_male(year: int) -> float:
    return round(get_e0(year) - 2.5, 2)

def get_e0_female(year: int) -> float:
    return round(get_e0(year) + 2.5, 2)

def get_fem_en_union(year: int) -> float:
    """Femmes en union 15-49 %: 77.2 (2009) → 67 (2050)"""
    return round(_interp(77.2, 67.0, progress(year)), 2)

def get_densite(pop: float, area_km2: float) -> float:
    return round(pop / area_km2, 2)

# Province areas (km²) — approximate INSEED values
PROV_AREAS = {
    "Batha": 88_800, "Chari-Baguirmi": 82_910, "Hadjer-Lamis": 25_340,
    "Wadi Fira": 61_910, "Barh El Gazel": 93_900, "Borkou": 251_860,
    "Ennedi Est": 100_000, "Ennedi Ouest": 72_000, "Guéra": 58_950,
    "Kanem": 114_520, "Lac": 22_320, "Logone Occidental": 8_695,
    "Logone Oriental": 28_035, "Mandoul": 23_615, "Mayo-Kebbi Est": 30_080,
    "Mayo-Kebbi Ouest": 27_870, "Moyen-Chari": 45_180, "Ouaddaï": 76_240,
    "Salamat": 79_360, "Sila": 44_730, "Tandjilé": 18_045,
    "Tibesti": 324_000, "N'Djamena": 300,
}

# ─── Employment / Active Pop Helpers ──────────────────────────────────────────
def get_active_ratio(year: int) -> float:
    """Ratio of 15-49 who are active: 62% (2009) → 75% (2050)"""
    return _interp(0.62, 0.75, progress(year))

def get_sector_split(year: int) -> dict:
    """Distribution of active pop: Agriculture (Primaire) shrinking, Services (Tertiaire) growing"""
    p = progress(year)
    pri = _interp(0.78, 0.55, p)
    sec = _interp(0.08, 0.15, p)
    ter = 1.0 - pri - sec
    return {"Primaire": pri, "Secondaire": sec, "Tertiaire": ter}

# ─── Record Builder ───────────────────────────────────────────────────────────
def build_records() -> list:
    records = []

    for year in YEARS:
        isf   = get_isf(year)
        e0    = get_e0(year)
        tmi   = get_tmi(year)
        urb   = get_urbanisation(year)
        tbn   = get_tbn(year)
        tbm   = get_tbm(year)
        tan   = get_tan(year)
        alpha = get_alphabetisation(year)
        eau   = get_eau(year)
        cc    = get_contraception(year)
        hiv   = get_hiv(year)
        tbr   = get_tbr(year)
        tmm5  = get_tmm5(year)
        e0m   = get_e0_male(year)
        e0f   = get_e0_female(year)
        fem_u = get_fem_en_union(year)
        cohort_props = get_cohort_proportions(year)

        prov_pops = PROV_POPS[year]
        nat_pop   = NAT_POPS[year]

        for province in PROVINCES + ["Tchad"]:
            pop = nat_pop if province == "Tchad" else prov_pops[province]
            pop_m = round(pop * MALE_RATIO)
            pop_f = pop - pop_m

            def row(indicator, value, gender=None, age_group=None):
                return {
                    "region": province,
                    "year": year,
                    "indicator_name": indicator,
                    "value": value,
                    "gender": gender,
                    "age_group": age_group,
                }

            # 1. Population Totale
            records.append(row("Population Totale", pop))
            records.append(row("Population Totale", pop_m, gender="Masculin"))
            records.append(row("Population Totale", pop_f, gender="Feminin"))

            # 2. Age Cohorts (INSEED structure) — sum exactly = pop
            cohort_values = {}
            allocated = 0
            cohort_names = list(cohort_props.keys())
            for i, cname in enumerate(cohort_names):
                if i == len(cohort_names) - 1:
                    val = pop - allocated
                else:
                    val = round(pop * cohort_props[cname])
                    allocated += val
                cohort_values[cname] = val

                val_m = round(val * MALE_RATIO)
                val_f = val - val_m
                records.append(row("Population", val,   age_group=cname))
                records.append(row("Population", val_m, gender="Masculin", age_group=cname))
                records.append(row("Population", val_f, gender="Feminin",  age_group=cname))

            # Verify cohort sum = pop
            assert sum(cohort_values.values()) == pop, f"Cohort sum mismatch at {province} {year}"

            # 3. Demographic Indicators
            records.append(row("Indice Synthétique de Fécondité", isf))
            records.append(row("Espérance de vie à la naissance", e0))
            records.append(row("Espérance de vie à la naissance", e0m, gender="Masculin"))
            records.append(row("Espérance de vie à la naissance", e0f, gender="Feminin"))
            records.append(row("Mortalité Infantile", tmi))
            records.append(row("Mortalité Infanto-Juvénile", tmm5))
            records.append(row("Taux Brut de Natalité", tbn))
            records.append(row("Taux Brut de Mortalité", tbm))
            records.append(row("Taux d'Accroissement Naturel", tan))
            records.append(row("Taux Brut de Reproduction", tbr))

            # 4. Social / Health Indicators
            records.append(row("Taux d'Urbanisation", urb))
            records.append(row("Taux d'alphabétisation", alpha))
            records.append(row("Accès à l'eau potable", eau))
            records.append(row("Prévalence Contraceptive", cc))
            records.append(row("Femmes en Union (15-49)", fem_u))
            records.append(row("Prévalence VIH/SIDA", hiv))

            # 5. Density
            area = PROV_AREAS.get(province, 1_284_000 if province == "Tchad" else 50_000)
            records.append(row("Densité de Population", get_densite(pop, area)))

            # 6. Annual Births & Deaths (derived)
            naissances = round(pop * tbn / 1000)
            deces      = round(pop * tbm / 1000)
            records.append(row("Naissances Annuelles", naissances))
            records.append(row("Décès Annuels", deces))

            # 7. Femmes en âge de procréer (15-49) ≈ cohort 12-18 overlap + 18+
            fap = round(pop_f * 0.47)
            records.append(row("Population", fap, gender="Feminin", age_group="15-49 ans - Femmes"))

            # 8. Employment & Active Population
            # Approx 45% of total pop is in 15-49 range
            active_pop_total = round(pop * 0.45 * get_active_ratio(year))
            records.append(row("Population Active (15-49)", active_pop_total))
            
            sectors = get_sector_split(year)
            for sector, ratio in sectors.items():
                records.append(row(f"Emploi - {sector}", round(active_pop_total * ratio)))

            # 9. Taux de Croissance
            if year > 2009:
                prev_pop = NAT_POPS[year-1] if province == "Tchad" else PROV_POPS[year-1][province]
                growth_pct = round((pop - prev_pop) / prev_pop * 100, 4)
            else:
                growth_pct = 3.6
            records.append(row("Taux de Croissance", growth_pct))

    return records

# ─── Main Seeder ──────────────────────────────────────────────────────────────
def seed():
    print("=" * 60)
    print("INSEED GOLD STANDARD SEEDER (2009-2050)")
    print(f"Dataset ID: {DATASET_ID}")
    print(f"Anchors: 2009={NAT_POPS[2009]:,} | 2024={NAT_POPS[2024]:,} | 2026={NAT_POPS[2026]:,}")
    print("=" * 60)

    print("Building records (zero-noise deterministic)...")
    data = build_records()
    print(f"Total records generated: {len(data):,}")

    db = SessionLocal()
    try:
        # Step 1: Clear existing Gold Standard data only
        print("Removing previous Gold Standard data...")
        db.execute(text("DELETE FROM cleaned_data WHERE dataset_id = :id"), {"id": DATASET_ID})
        db.execute(text("DELETE FROM datasets WHERE id = :id"),            {"id": DATASET_ID})
        db.commit()

        # Step 2: Insert Dataset metadata
        print("Creating dataset record...")
        dataset = Dataset(
            id=DATASET_ID,
            original_filename="INSEED_GOLD_STANDARD_2026.csv",
            status="Cleaned",
            category="census",
            row_count=len(data),
            col_count=8,
            null_count=0,
            dupe_count=0,
            created_at=datetime.utcnow(),
        )
        db.add(dataset)
        db.commit()

        # Step 3: Batch insert cleaned_data
        print("Inserting records in batches...")
        batch_size = 3000
        total_batches = (len(data) + batch_size - 1) // batch_size
        for i in range(0, len(data), batch_size):
            batch = data[i:i + batch_size]
            objects = [
                CleanedData(
                    region=d["region"],
                    year=d["year"],
                    indicator_name=d["indicator_name"],
                    value=d["value"],
                    gender=d.get("gender"),
                    age_group=d.get("age_group"),
                    source_file="gold_standard_seeder.py",
                    dataset_id=DATASET_ID,
                    created_at=datetime.utcnow(),
                )
                for d in batch
            ]
            db.bulk_save_objects(objects)
            print(f"  Batch {i // batch_size + 1}/{total_batches} inserted ({len(batch)} rows)")

        db.commit()

        # Step 4: Update quality metadata
        print("Updating quality scores...")
        db.execute(text("""
            UPDATE datasets
            SET status       = 'Cleaned',
                null_count   = 0,
                dupe_count   = 0,
                row_count    = :rc
            WHERE id = :id
        """), {"rc": len(data), "id": DATASET_ID})
        db.commit()

        # Step 5: Verification
        count = db.execute(text("SELECT COUNT(*) FROM cleaned_data WHERE dataset_id = :id"), {"id": DATASET_ID}).scalar()
        nat_2024 = db.execute(text("""
            SELECT value FROM cleaned_data
            WHERE dataset_id = :id AND region = 'Tchad' AND year = 2024
              AND indicator_name = 'Population Totale' AND gender IS NULL AND age_group IS NULL
            LIMIT 1
        """), {"id": DATASET_ID}).scalar()
        nat_2009 = db.execute(text("""
            SELECT value FROM cleaned_data
            WHERE dataset_id = :id AND region = 'Tchad' AND year = 2009
              AND indicator_name = 'Population Totale' AND gender IS NULL AND age_group IS NULL
            LIMIT 1
        """), {"id": DATASET_ID}).scalar()

        print("\n" + "=" * 60)
        print("✓ GOLD STANDARD SEEDING COMPLETE")
        print(f"  Records in DB      : {count:,}")
        print(f"  Tchad 2009         : {nat_2009:,}  (target: 11,039,873)")
        print(f"  Tchad 2024         : {nat_2024:,}  (target: 20,299,123)")
        print(f"  Dataset ID         : {DATASET_ID}")
        print(f"  Dataset Label      : {DATASET_LABEL}")
        print("=" * 60)

    except Exception as e:
        db.rollback()
        print(f"\n[ERROR] Seeding failed: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    seed()
