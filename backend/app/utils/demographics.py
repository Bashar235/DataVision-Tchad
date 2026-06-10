"""
app/utils/demographics.py
=========================
INSEED RGPH2 Demographic Projection Utility
Callable by FastAPI endpoints for real-time Bongaarts What-If projections.

Ported from scripts/inseed_engine.py for use inside the backend app.
"""

from typing import Optional, Dict, List, Tuple, TYPE_CHECKING

if TYPE_CHECKING:
    from sqlalchemy.orm import Session

# ─── Region Name Mapping (INSEED CSV names → DB canonical names) ─────────────
# DB canonical names match spatial.py CHAD_PROVINCES list
REGION_NAME_MAP = {
    # INSEED CSV Name          → DB Canonical Name
    "Chari Baguirmi":          "Chari-Baguirmi",
    "Hadjer Lamis":            "Hadjer-Lamis",
    "Moyen Chari":             "Moyen-Chari",
    "Mayo Kebbi Est":          "Mayo-Kebbi Est",
    "Mayo Kebbi Ouest":        "Mayo-Kebbi Ouest",
    "N'Djaména":               "N'Djamena",
    "Barh El Gazal":           "Barh El Gazel",   # spatial.py uses "Gazel"
    "Ennedi":                  "Ennedi-Est",       # spatial.py splits Ennedi
}

# Reverse map: DB name → INSEED CSV name (for lookups)
REGION_NAME_MAP_REVERSE = {v: k for k, v in REGION_NAME_MAP.items()}


def normalize_region_for_db(region: str) -> str:
    """Convert INSEED CSV region name to DB canonical form."""
    return REGION_NAME_MAP.get(region, region)


def normalize_region_for_inseed(region: str) -> str:
    """Convert DB canonical region name to INSEED CSV form, for indicator lookups."""
    return REGION_NAME_MAP_REVERSE.get(region, region)


def normalize_region_name(region_name: str) -> str:
    """
    Standardizes region names from various layers (GeoJSON shape names, frontend inputs, 
    historical variations) to the database canonical name.
    Handles URL encodings, case-insensitivity, and spelling bridges (e.g. Bahr vs Barh).
    """
    if not region_name:
        return ""
    
    # Strip whitespace and replace URL spaces
    cleaned = region_name.strip().replace('%20', ' ').replace('+', ' ')
    
    # Lowercase for case-insensitive matching
    cleaned_lower = cleaned.lower()
    
    # Spelling Bridge for Bahr El Gazel / Barh El Gazal variations
    if cleaned_lower in ["bahr el gazel", "bahr el gazal", "barh el gazal", "barh el gazel", "bahr-el-gazel", "barh-el-gazel"]:
        return "Barh El Gazel"
        
    # Ennedi variations
    if cleaned_lower in ["ennedi-est", "ennedi est", "ennedi_est", "ennedi_e"]:
        return "Ennedi Est"
    if cleaned_lower in ["ennedi-ouest", "ennedi ouest", "ennedi_ouest", "ennedi_o"]:
        return "Ennedi Ouest"
        
    # N'Djamena variations
    if "ndjamena" in cleaned_lower.replace("'", "").replace(" ", "e").replace("é", "e"):
        return "N'Djamena"
        
    # Other common normalization mapping
    # Capitalize matching against known DB names
    db_mapping = {
        "batha": "Batha",
        "lac": "Lac",
        "borkou": "Borkou",
        "kanem": "Kanem",
        "ouaddaï": "Ouaddaï",
        "ouaddai": "Ouaddaï",
        "wadi fira": "Wadi Fira",
        "guéra": "Guéra",
        "guera": "Guéra",
        "salamat": "Salamat",
        "chari-baguirmi": "Chari-Baguirmi",
        "chari baguirmi": "Chari-Baguirmi",
        "moyen-chari": "Moyen-Chari",
        "moyen chari": "Moyen-Chari",
        "hadjer-lamis": "Hadjer-Lamis",
        "hadjer lamis": "Hadjer-Lamis",
        "mayo-kebbi est": "Mayo-Kebbi Est",
        "mayo kebbi est": "Mayo-Kebbi Est",
        "mayo-kebbi ouest": "Mayo-Kebbi Ouest",
        "mayo kebbi ouest": "Mayo-Kebbi Ouest",
        "tandjilé": "Tandjilé",
        "tandjile": "Tandjilé",
        "logone occidental": "Logone Occidental",
        "logone oriental": "Logone Oriental",
        "mandoul": "Mandoul",
        "sila": "Sila",
        "tibesti": "Tibesti",
        "tchad": "Tchad",
        "national": "Tchad",
        "total": "Tchad",
    }
    
    return db_mapping.get(cleaned_lower, cleaned)



# ─── National Population Anchors (Scénario Tendanciel) ───────────────────────
# Source: INSEED Tableau 2.01b
_NATIONAL_TOTALS = {
    2009: 11_072_067, 2010: 11_477_757, 2011: 11_893_517, 2012: 12_324_956,
    2013: 12_771_220, 2014: 13_232_163, 2015: 13_708_639, 2016: 14_199_375,
    2017: 14_706_217, 2018: 15_230_931, 2019: 15_775_428, 2020: 16_344_852,
    2025: 19_639_116, 2030: 23_612_921, 2035: 28_251_052,
    2040: 33_527_974, 2045: 39_512_622, 2050: 46_285_731,
}

# Regional anchors Scénario Tendanciel (Tableau 2.04)
_REGIONAL_TOTALS = {
    "Batha":            {2009:489_882, 2020:689_835, 2035:1_187_446, 2050:1_904_300},
    "Borkou":           {2009:93_857,  2020:138_103, 2035:218_178,   2050:343_947},
    "Chari-Baguirmi":   {2009:580_112, 2020:845_088, 2035:1_422_178, 2050:2_267_472},
    "Guéra":            {2009:539_929, 2020:635_822, 2035:1_214_814, 2050:1_945_465},
    "Hadjer-Lamis":     {2009:568_511, 2020:822_223, 2035:1_379_028, 2050:2_204_360},
    "Kanem":            {2009:334_359, 2020:498_268, 2035:817_137,   2050:1_307_566},
    "Lac":              {2009:435_055, 2020:638_662, 2035:1_059_442, 2050:1_692_278},
    "Logone Occidental":{2009:691_053, 2020:1_032_542,2035:1_740_003,2050:2_793_170},
    "Logone Oriental":  {2009:781_612, 2020:1_161_153,2035:1_964_008,2050:3_151_046},
    "Mandoul":          {2009:629_897, 2020:928_304, 2035:1_501_550, 2050:2_225_228},
    "Mayo-Kebbi Est":   {2009:777_041, 2020:1_146_679,2035:1_929_102,2050:3_099_163},
    "Mayo-Kebbi Ouest": {2009:566_116, 2020:845_389, 2035:1_432_216, 2050:2_305_921},
    "Moyen-Chari":      {2009:589_723, 2020:877_778, 2035:1_462_308, 2050:2_339_596},
    "Ouaddaï":          {2009:723_269, 2020:1_068_945,2035:1_783_377,2050:2_860_177},
    "Salamat":          {2009:303_183, 2020:450_505, 2035:755_612,   2050:1_214_485},
    "Tandjilé":         {2009:663_836, 2020:996_203, 2035:1_679_851, 2050:2_701_994},
    "Wadi Fira":        {2009:509_865, 2020:754_740, 2035:1_267_044, 2050:2_036_938},
    "N'Djamena":        {2009:954_192, 2020:1_592_258,2035:3_434_779,2050:6_722_429},
    "Barh El Gazel":    {2009:258_017, 2020:373_443, 2035:602_156,   2050:951_198},
    "Ennedi-Est":       {2009:168_409, 2020:247_412, 2035:389_456,   2050:612_053},
    "Sila":             {2009:388_591, 2020:563_716, 2035:953_932,   2050:1_522_976},
    "Tibesti":          {2009:25_557,  2020:37_784,  2035:57_435,    2050:83_969},
    "Tchad":            _NATIONAL_TOTALS,
}

# Indicator anchors for interpolation (Scénario Tendanciel)
_INDICATOR_ANCHORS = {
    "ISF":      {2009:7.1,   2010:7.1,   2015:7.04, 2020:6.8,  2025:6.52, 2030:6.23, 2035:5.92, 2040:5.58, 2045:5.21, 2050:4.82},
    "TBN":      {2009:49.6,  2010:49.6,  2015:47.9, 2020:46.2, 2025:45.4, 2030:44.1, 2035:42.2, 2040:39.9, 2045:37.6, 2050:35.3},
    "TBM":      {2009:14.8,  2010:14.9,  2015:13.6, 2020:12.2, 2025:10.9, 2030:9.8,  2035:8.6,  2040:7.5,  2045:6.6,  2050:5.9},
    "TAN":      {2009:3.6,   2010:3.5,   2015:3.43, 2020:3.4,  2025:3.44, 2030:3.43, 2035:3.36, 2040:3.24, 2045:3.1,  2050:2.94},
    "e0":       {2009:52.4,  2010:52.8,  2015:52.9, 2020:54.0, 2025:56.0, 2030:58.0, 2035:60.2, 2040:62.5, 2045:64.8, 2050:66.6},
    "TMI":      {2009:98.0,  2010:96.2,  2015:87.9, 2020:79.5, 2025:71.3, 2030:63.4, 2035:55.7, 2040:48.5, 2045:41.4, 2050:36.4},
    "Cc":       {2009:4.8,  2010:5.1,  2015:6.6,  2020:11.6, 2025:16.6, 2030:21.6, 2035:26.6, 2040:31.6, 2045:36.6, 2050:41.6},
    "Cm":       {2009:77.2, 2010:77.0, 2015:75.7, 2020:74.5, 2025:73.3, 2030:72.0, 2035:70.7, 2040:69.5, 2045:68.2, 2050:67.0},
    "HIV_prev": {2009:3.4,   2010:3.34,  2015:3.05, 2020:2.76, 2025:2.47, 2030:2.17, 2035:1.88, 2040:1.59, 2045:1.29, 2050:1.0},
    "Turb":     {2009:21.9,  2010:23.0,  2015:23.5, 2020:24.8, 2025:26.2, 2030:27.5, 2035:30.4, 2040:33.2, 2045:36.1, 2050:39.0},
    "TBR":      {2009:3.5,   2010:3.5,   2015:3.44, 2020:3.32, 2025:3.18, 2030:3.04, 2035:2.89, 2040:2.72, 2045:2.54, 2050:2.35},
}


def _interp(anchors: dict, year: int) -> float:
    """Linear interpolation between anchor years."""
    keys = sorted(anchors.keys())
    if year <= keys[0]:
        return anchors[keys[0]]
    if year >= keys[-1]:
        return anchors[keys[-1]]
    for i in range(len(keys) - 1):
        y0, y1 = keys[i], keys[i + 1]
        if y0 <= year <= y1:
            t = (year - y0) / (y1 - y0)
            return anchors[y0] + t * (anchors[y1] - anchors[y0])
    return anchors[keys[-1]]


def get_tendanciel_value(indicator: str, year: int, db: Optional[Session] = None, dataset_id: Optional[str] = None) -> Optional[float]:
    """
    Return the Scénario Tendanciel value for an indicator at a given year.
    Prioritizes CleanedData records if a DB session is provided.
    """
    if db:
        from app.models import CleanedData
        from sqlalchemy import func
        import uuid
        
        # Unified indicator mapping for robust matching
        mapping = {
            "isf": ["indice synthétique de fécondité", "isf"],
            "e0": ["espérance de vie à la naissance", "e0"],
            "tmi": ["mortalité infantile", "taux de mortalité infantile", "tmi"],
            "cc": ["prévalence contraceptive", "contraception_rate", "cc"],
            "cm": ["femmes en union (15-49)", "marriage_rate", "cm"],
            "hiv_prev": ["prévalence vih/sida", "hiv_prev"],
            "turb": ["taux d'urbanisation", "turb"],
            "tbn": ["taux brut de natalité", "tbn"],
            "tbm": ["taux brut de mortalité", "tbm"]
        }
        
        indicator_variants = mapping.get(indicator.lower(), [indicator.lower()])
        
        query = db.query(CleanedData.value).filter(
            func.lower(CleanedData.indicator_name).in_(indicator_variants),
            CleanedData.year == year,
            func.lower(CleanedData.region).in_(['tchad', 'national', 'total'])
        )
        
        if dataset_id:
            try:
                ds_uuid = uuid.UUID(dataset_id)
                query = query.filter(CleanedData.dataset_id == ds_uuid)
            except:
                pass
                
        db_val = query.first()
        if db_val:
            return float(db_val[0])

    if indicator not in _INDICATOR_ANCHORS:
        return None
    return round(float(_interp(_INDICATOR_ANCHORS[indicator], year)), 6)  # type: ignore


def get_tendanciel_population(region: str, year: int, db: Optional[Session] = None, dataset_id: Optional[str] = None) -> Optional[float]:
    """
    Return the Scénario Tendanciel population for a region at a specific year.
    Prioritizes CleanedData records if a DB session is provided.
    """
    if db:
        from app.models import CleanedData
        from sqlalchemy import func
        import uuid
        
        query = db.query(CleanedData.value).filter(
            CleanedData.indicator_name.ilike('%population%'),
            CleanedData.year == year,
            func.lower(CleanedData.region) == region.lower(),
            (func.lower(CleanedData.age_group) == 'total') | (CleanedData.age_group.is_(None))
        )
        
        if dataset_id:
            try:
                ds_uuid = uuid.UUID(dataset_id)
                query = query.filter(CleanedData.dataset_id == ds_uuid)
            except:
                pass
                
        db_val = query.first()
        if db_val:
            return float(db_val[0])

    anchors = _REGIONAL_TOTALS.get(region)
    if anchors is None:
        # Fallback to space/hyphen alternate format
        alt_region = region.replace(" ", "-") if " " in region else region.replace("-", " ")
        anchors = _REGIONAL_TOTALS.get(alt_region)
    if anchors is None:
        return None
    return round(float(_interp(anchors, year)), 0)  # type: ignore


# ─── Bongaarts Fertility Formula ─────────────────────────────────────────────

def compute_bongaarts_isf(
    Cm: float,       # % women in union (0–1 scale, e.g., 0.707)
    Cc: float,       # contraceptive prevalence (0–1 scale, e.g., 0.266)
    Ci_months: float = 13.5,  # post-partum insusceptibility (months)
    Ca: float = 0.0,          # abortion index
    Cs: float = 0.03,         # sterility fraction
    FN: float = 15.3,         # natural fertility constant (Bongaarts 1984 SSA)
) -> float:
    """
    Bongaarts Proximate Determinants Model: ISF = Cm × Ci × Ca × Cs × Cc × FN

    Parameters use 0-1 scale for Cm and Cc.
    Returns ISF (children per woman).
    """
    # Ci: post-partum infecundability index
    Ci = 20.0 / (18.5 + max(Ci_months, 1.0))

    # Cc: contraceptive prevalence index (1.08 × u × e, e=0.90 composite)
    Cc_index = max(1.0 - (1.08 * Cc * 0.90), 0.01)

    # Cs: sterility index
    Cs_index = 1.0 - Cs

    # Ca: abortion index
    Ca_index = 1.0 - (0.4 * Ca)

    isf = Cm * Ci * Ca_index * Cs_index * Cc_index * FN
    return round(float(max(isf, 1.0)), 4)  # type: ignore


# ─── Core Projection Function ─────────────────────────────────────────────────

def get_bongaarts_projection(
    Cm_pct: float,        # Women in union % (0–100 scale from frontend slider)
    Cc_pct: float,        # Contraceptive prevalence % (0–100 scale)
    e0: float,            # Life expectancy at birth (years)
    year: int,            # Target year (2009–2050)
    region: str = "Tchad",
    Ci_months: Optional[float] = None,  # If None, interpolated from Tendanciel
    Ca: float = 0.0,
    Cs: float = 0.03,
    db: Optional[Session] = None,
    dataset_id: Optional[str] = None,
) -> dict:
    """
    Run a What-If Bongaarts projection and return ISF + population estimate.

    Algorithm:
    1. Compute ISF using Bongaarts formula with user inputs
    2. Compare ISF to Tendanciel ISF for same year → ISF ratio
    3. Apply ISF ratio as a fertility multiplier to the Tendanciel population
       (simplified: population ≈ Tendanciel × (1 + fertility_delta × years × weight))

    Returns a dict with ISF, population, delta, and interpretation.
    """
    # Clamp inputs to valid ranges
    Cm = max(0.01, min(Cm_pct / 100.0, 0.99))
    Cc = max(0.0,  min(Cc_pct / 100.0, 0.99))
    year = max(2009, min(year, 2050))

    # Interpolate Ci_months if not provided (now optionally DB-aware)
    if Ci_months is None:
        # Linear decline from 15.7 (2009) to 9.5 (2050)
        Ci_months = 15.7 - (15.7 - 9.5) * (year - 2009) / 41.0

    # 1. User scenario ISF
    user_isf = compute_bongaarts_isf(Cm=Cm, Cc=Cc, Ci_months=Ci_months, Ca=Ca, Cs=Cs)

    # 2. Tendanciel ISF for same year (Now DB-aware)
    baseline_isf = get_tendanciel_value("ISF", year, db=db, dataset_id=dataset_id) or 7.1

    # 3. Tendanciel population (Now DB-aware)
    baseline_pop = get_tendanciel_population(region, year, db=db, dataset_id=dataset_id)
    if baseline_pop is None:
        baseline_pop = get_tendanciel_population("Tchad", year, db=db, dataset_id=dataset_id) or 11_072_067

    # 4. Fertility-driven population adjustment
    # ISF affects the population with a lag (children born now affect future structure)
    # Simplified: each 1-unit ISF difference → ~3% population difference per decade
    years_from_base = max(0, year - 2009)
    isf_delta = user_isf - baseline_isf
    fertility_effect = isf_delta * 0.03 * (years_from_base / 10.0)

    # Life expectancy effect: each additional year of e0 beyond baseline (Now DB-aware)
    baseline_e0 = get_tendanciel_value("e0", year, db=db, dataset_id=dataset_id) or 52.4
    e0_delta = e0 - baseline_e0
    mortality_effect = e0_delta * 0.005 * (years_from_base / 10.0)

    total_adjustment = 1.0 + fertility_effect + mortality_effect
    simulated_pop = round(float(baseline_pop * max(0.5, total_adjustment)), 0)  # type: ignore

    delta_millions = round((simulated_pop - baseline_pop) / 1_000_000, 3)

    # Interpretation in French
    if abs(delta_millions) < 0.1:
        trend = "proche du scénario tendanciel INSEED"
    elif delta_millions > 0.0:
        trend = f"supérieur de {delta_millions:.1f} million(s) au tendanciel (fécondité plus élevée)"
    else:
        trend = f"inférieur de {abs(delta_millions):.1f} million(s) au tendanciel (meilleure maîtrise de la fécondité)"

    # ISF classification
    if user_isf < 3.5:
        isf_label = "Transition démographique avancée"
    elif user_isf < 5.0:
        isf_label = "Transition démographique en cours"
    elif user_isf < 6.5:
        isf_label = "Fécondité élevée"
    else:
        isf_label = "Fécondité très élevée"

    return {
        "ISF":                   user_isf,
        "ISF_label":             isf_label,
        "ISF_baseline":          round(baseline_isf, 4),
        "predicted_population":  int(simulated_pop),
        "baseline_population":   int(baseline_pop),
        "delta_millions":        delta_millions,
        "e0_baseline":           round(baseline_e0, 2),
        "region":                region,
        "year":                  year,
        "scenario_label":        "Scénario Personnalisé (Bongaarts)",
        "interpretation":        trend,
        "inputs": {
            "Cm_pct": Cm_pct,
            "Cc_pct": Cc_pct,
            "e0":     e0,
            "year":   year,
        }
    }


# ─── Indicator Display Labels (French) ───────────────────────────────────────
INDICATOR_LABELS_FR = {
    "ISF":               {"label": "Indice Synthétique de Fécondité",    "unit": "enfants/femme"},
    "TBN":               {"label": "Taux Brut de Natalité",              "unit": "‰"},
    "TBM":               {"label": "Taux Brut de Mortalité",             "unit": "‰"},
    "TAN":               {"label": "Taux d'Accroissement Naturel",       "unit": "%"},
    "e0":                {"label": "Espérance de Vie à la Naissance",    "unit": "années"},
    "e0_male":           {"label": "Espérance de Vie (Hommes)",          "unit": "années"},
    "e0_female":         {"label": "Espérance de Vie (Femmes)",          "unit": "années"},
    "TMI":               {"label": "Taux de Mortalité Infantile",        "unit": "‰"},
    "TMM5":              {"label": "Mortalité Infanto-Juvénile",         "unit": "‰"},
    "Cc":                {"label": "Prévalence Contraceptive",           "unit": "%"},
    "Cm":                {"label": "Femmes en Union (15-49 ans)",        "unit": "%"},
    "HIV_prev":          {"label": "Prévalence VIH/SIDA",                "unit": "%"},
    "Turb":              {"label": "Taux d'Urbanisation",                "unit": "%"},
    "TBR":               {"label": "Taux Brut de Reproduction",          "unit": "filles/femme"},
    "Population_Total":  {"label": "Population Totale",                  "unit": "Millions"},
    "Pop_0_4":           {"label": "Population 0-4 ans",                 "unit": "personnes"},
    "Pop_6_11":          {"label": "Population 6-11 ans",               "unit": "personnes"},
    "Pop_15_49":         {"label": "Femmes en Âge de Procréer (15-49)", "unit": "personnes"},
    "Naissances":        {"label": "Naissances Annuelles",               "unit": "personnes"},
    "Deces":             {"label": "Décès Annuels",                      "unit": "personnes"},
}


def get_indicator_label(indicator_code: str) -> dict:
    """Return French label and unit for an indicator code."""
    return INDICATOR_LABELS_FR.get(indicator_code, {"label": indicator_code, "unit": ""})


# ─── Beers Interpolation & Cohort-Component Math ─────────────────────────────

# National population by 5-yr age group (as of 1 July 2009)
# Format: {age_group: (males, females)}
BASELINE_POP_BY_AGE = {
    "0-4":   (1_211_620, 1_183_214),
    "5-9":   (939_038,   912_970),
    "10-14": (684_814,   667_359),
    "15-19": (522_379,   544_918),
    "20-24": (388_387,   498_778),
    "25-29": (315_924,   420_798),
    "30-34": (279_780,   332_694),
    "35-39": (241_192,   265_361),
    "40-44": (208_687,   200_733),
    "45-49": (172_426,   154_086),
    "50-54": (130_580,   111_011),
    "55-59": (102_909,    85_543),
    "60-64": ( 79_549,    69_172),
    "65-69": ( 61_739,    53_704),
    "70-74": ( 46_552,    39_712),
    "75-79": ( 33_984,    27_196),
    "80+":   ( 47_525,    37_733),
}

def beers_interpolate(pop_5yr: List[float]) -> List[float]:
    """
    Beers Modified Interpolation — converts 5-year age groups to
    single-year estimates.

    Parameters
    ----------
    pop_5yr : list of 5-year group populations in order:
              [0-4, 5-9, 10-14, 15-19, 20-24, 25-29, 30-34, 35-39,
               40-44, 45-49, 50-54, 55-59, 60-64, 65-69, 70-74, 75-79, 80+]
              Length must be >= 5 groups (at least indices 0-5)

    Returns
    -------
    ages_single : list of single-year populations (ages 0 through 79, + 80+)
    """
    p = pop_5yr

    def _expand_0_4(p1, p2, p3, p4, p5):
        """Beers coefficients for age group 0-4"""
        return [
            0.3333*p1 - 0.1636*p2 - 0.0210*p3 + 0.0796*p4 - 0.0283*p5,
            0.2595*p1 - 0.0780*p2 + 0.0130*p3 + 0.0100*p4 - 0.0045*p5,
            0.1924*p1 + 0.0064*p2 + 0.0184*p3 - 0.0256*p4 + 0.0084*p5,
            0.1329*p1 + 0.0844*p2 + 0.0054*p3 - 0.0356*p4 + 0.0129*p5,
            0.0819*p1 + 0.1508*p2 - 0.0158*p3 - 0.0284*p4 + 0.0115*p5,
        ]

    def _expand_5_9(p1, p2, p3, p4, p5):
        """Beers coefficients for age group 5-9"""
        return [
            0.0404*p1 + 0.2000*p2 - 0.0344*p3 - 0.0128*p4 + 0.0068*p5,
            0.0093*p1 + 0.2268*p2 - 0.0402*p3 + 0.0028*p4 + 0.0013*p5,
           -0.0108*p1 + 0.2272*p2 - 0.0248*p3 + 0.0112*p4 - 0.0028*p5,
           -0.0198*p1 + 0.1992*p2 + 0.0172*p3 + 0.0072*p4 - 0.0038*p5,
           -0.0191*p1 + 0.1468*p2 + 0.0822*p3 - 0.0084*p4 - 0.0015*p5,
        ]

    def _expand_mid(pa_m2, pa_m1, pa, pa_p1, pa_p2):
        """Beers coefficients for age groups 10-14 through 70-74"""
        return [
            -0.0117*pa_m2 + 0.0804*pa_m1 + 0.1570*pa  - 0.0284*pa_p1 + 0.0027*pa_p2,
            -0.0020*pa_m2 + 0.0160*pa_m1 + 0.2200*pa  - 0.0400*pa_p1 + 0.0060*pa_p2,
             0.0050*pa_m2 - 0.0280*pa_m1 + 0.2460*pa  - 0.0280*pa_p1 + 0.0050*pa_p2,
             0.0060*pa_m2 - 0.0400*pa_m1 + 0.2200*pa  + 0.0160*pa_p1 - 0.0020*pa_p2,
             0.0027*pa_m2 - 0.0284*pa_m1 + 0.1570*pa  + 0.0804*pa_p1 - 0.0117*pa_p2,
        ]

    def _expand_75_79(p60_64, p65_69, p70_74, p75_79, p80p):
        """Beers coefficients for age group 75-79"""
        return [
            -0.0015*p60_64 - 0.0084*p65_69 + 0.0822*p70_74 + 0.1468*p75_79 - 0.0191*p80p,
            -0.0038*p60_64 + 0.0072*p65_69 + 0.0172*p70_74 + 0.1992*p75_79 - 0.0198*p80p,
            -0.0028*p60_64 + 0.0112*p65_69 - 0.0248*p70_74 + 0.2272*p75_79 - 0.0108*p80p,
             0.0013*p60_64 + 0.0028*p65_69 - 0.0402*p70_74 + 0.2268*p75_79 + 0.0093*p80p,
             0.0068*p60_64 - 0.0128*p65_69 - 0.0344*p70_74 + 0.2000*p75_79 + 0.0404*p80p,
        ]

    p_list = list(pop_5yr)
    n = len(p_list)
    if n < 5:
        raise ValueError("Need at least 5 five-year age groups")

    while len(p_list) < 17:
        p_list.append(0.0)

    result = []

    result.extend(_expand_0_4(p_list[0], p_list[1], p_list[2], p_list[3], p_list[4]))
    result.extend(_expand_5_9(p_list[0], p_list[1], p_list[2], p_list[3], p_list[4]))
    for i in range(2, 15): 
        pm2 = p_list[i-2] if i >= 2 else 0.0
        pm1 = p_list[i-1] if i >= 1 else 0.0
        pc  = p_list[i]
        pp1 = p_list[i+1] if i+1 < len(p_list) else 0.0
        pp2 = p_list[i+2] if i+2 < len(p_list) else 0.0
        result.extend(_expand_mid(pm2, pm1, pc, pp1, pp2))
    result.extend(_expand_75_79(p_list[12], p_list[13], p_list[14], p_list[15], p_list[16]))
    result.append(p_list[16])

    return [max(0.0, x) for x in result]


def project_population_component(
    pop_age_sex: Dict[str, Tuple[float, float]],
    isf: float,
    e0_male: float,
    e0_female: float,
    net_migration: int = 0,
    sex_ratio_birth: float = 1.05,
    fap_distribution: Optional[List[float]] = None,
) -> Dict[str, Tuple[float, float]]:
    """
    One-year cohort-component projection step simulating aging and births over time.
    """
    age_groups = [
        "0-4", "5-9", "10-14", "15-19", "20-24", "25-29",
        "30-34", "35-39", "40-44", "45-49", "50-54", "55-59",
        "60-64", "65-69", "70-74", "75-79", "80+"
    ]

    def survival_prob(e0: float, age: int) -> float:
        """Approximate 1-year survival probability using Brass logit model."""
        alpha = 5.0 / max(1.0, e0)
        if age == 0:
            return 1.0 - min(0.95, 0.15 * alpha)
        elif age < 5:
            return 1.0 - min(0.95, 0.08 * alpha)
        elif age < 15:
            return 1.0 - min(0.95, 0.02 * alpha)
        elif age < 50:
            return 1.0 - min(0.95, 0.03 * alpha * (1 + age / 100))
        elif age < 65:
            return 1.0 - min(0.95, 0.06 * alpha * (1 + age / 50))
        else:
            return 1.0 - min(0.95, 0.12 * alpha * (1 + age / 30))

    fap_dist: List[float] = fap_distribution if fap_distribution is not None else [0.207, 0.267, 0.230, 0.165, 0.093, 0.032, 0.006]

    fertile_groups = ["15-19", "20-24", "25-29", "30-34", "35-39", "40-44", "45-49"]

    total_births: float = 0.0
    for i, ag in enumerate(fertile_groups):
        if ag in pop_age_sex:
            fem = pop_age_sex[ag][1]
            births_from_group = isf * fap_dist[i] * fem / 5.0
            total_births = float(total_births + births_from_group)  # type: ignore

    male_births = total_births * sex_ratio_birth / (1.0 + sex_ratio_birth)
    female_births = total_births / (1.0 + sex_ratio_birth)

    new_pop = {}

    for j, ag in enumerate(age_groups):
        if ag == "0-4":
            s0m = survival_prob(e0_male, 0)
            s0f = survival_prob(e0_female, 0)
            new_m = male_births * s0m + net_migration * 0.05
            new_f = female_births * s0f + net_migration * 0.05
        elif ag == "80+":
            prev_m_75, prev_f_75 = pop_age_sex.get("75-79", (0, 0))
            prev_m_80, prev_f_80 = pop_age_sex.get("80+", (0, 0))
            s_m80 = survival_prob(e0_male, 77)
            s_f80 = survival_prob(e0_female, 77)
            s_m85 = survival_prob(e0_male, 82)
            s_f85 = survival_prob(e0_female, 82)
            new_m = prev_m_75 * s_m80 + prev_m_80 * s_m85
            new_f = prev_f_75 * s_f80 + prev_f_80 * s_f85
        else:
            prev_ag = age_groups[j - 1]
            prev_m, prev_f = pop_age_sex.get(prev_ag, (0, 0))
            mid_age = int(ag.split("-")[0]) + 2
            s_m = survival_prob(e0_male, mid_age)
            s_f = survival_prob(e0_female, mid_age)
            new_m = prev_m * s_m + net_migration * 0.04
            new_f = prev_f * s_f + net_migration * 0.04

        new_pop[ag] = (max(0.0, new_m), max(0.0, new_f))

    return new_pop
