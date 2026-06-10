from sqlalchemy import or_ as sql_or

# ── Indicator Alias Resolver ──────────────────────────────────────────────────
# Maps any frontend display name, English variant, or shorthand to the full set
# of indicator_name strings that may exist in the indicators_data table.
# Keys are lowercase for case-insensitive lookup.
INDICATOR_ALIASES: dict[str, list[str]] = {
    # Population
    "population totale":                     ["Population Totale", "population_total", "population"],
    "population":                            ["Population Totale", "population_total", "population"],
    "total population":                      ["Population Totale", "population_total", "population"],

    # GDP / PIB
    "pib nominal":                           ["PIB Nominal", "PIB", "pib", "gdp", "GDP", "gdp_contribution", "gdp_per_capita", "Taux d'Accroissement Naturel"],
    "pib":                                   ["PIB Nominal", "PIB", "pib", "gdp", "GDP", "gdp_contribution"],
    "gdp":                                   ["PIB Nominal", "PIB", "pib", "gdp", "GDP", "gdp_contribution", "gdp_per_capita"],
    "gdp nominal":                           ["PIB Nominal", "PIB", "pib", "gdp"],
    "gdp_contribution":                      ["PIB Nominal", "PIB", "pib", "gdp", "gdp_contribution"],

    # Fertility
    "indice synthétique de fécondité":       ["Indice Synthétique de Fécondité", "isf", "ISF", "fertility_rate"],
    "isf":                                   ["Indice Synthétique de Fécondité", "isf", "ISF", "fertility_rate"],
    "fertility_rate":                        ["Indice Synthétique de Fécondité", "isf", "ISF", "fertility_rate"],
    "fertility rate":                        ["Indice Synthétique de Fécondité", "isf", "ISF", "fertility_rate"],

    # Infant Mortality
    "taux de mortalité infantile":           ["Taux de Mortalité Infantile", "Mortalité Infantile", "mortality_rate", "TMI", "tmi"],
    "mortalité infantile":                   ["Taux de Mortalité Infantile", "Mortalité Infantile", "mortality_rate", "TMI", "tmi"],
    "infant mortality":                      ["Taux de Mortalité Infantile", "Mortalité Infantile", "mortality_rate", "TMI", "tmi"],
    "mortality_rate":                        ["Taux de Mortalité Infantile", "Mortalité Infantile", "mortality_rate", "TMI"],
    "tmi":                                   ["Taux de Mortalité Infantile", "Mortalité Infantile", "TMI", "tmi"],

    # Urbanization
    "taux d'urbanisation":                   ["Taux d'Urbanisation", "urbanization_rate", "Turb", "turb"],
    "urbanization_rate":                     ["Taux d'Urbanisation", "urbanization_rate", "Turb"],
    "urbanisation":                          ["Taux d'Urbanisation", "urbanization_rate", "Turb"],
    "urbanization":                          ["Taux d'Urbanisation", "urbanization_rate", "Turb"],

    # Literacy
    "taux d'alphabétisation":               ["Taux d'alphabétisation", "alphabetisation", "literacy_rate", "literacy"],
    "literacy_rate":                         ["Taux d'alphabétisation", "alphabetisation", "literacy_rate"],
    "literacy":                              ["Taux d'alphabétisation", "alphabetisation", "literacy_rate"],
    "alphabetisation":                       ["Taux d'alphabétisation", "alphabetisation", "literacy_rate"],

    # Water access
    "accès à l'eau potable":                ["Accès à l'eau potable", "water_access", "eau_potable"],
    "water_access":                          ["Accès à l'eau potable", "water_access", "eau_potable"],
    "water access":                          ["Accès à l'eau potable", "water_access", "eau_potable"],
    "eau potable":                           ["Accès à l'eau potable", "water_access", "eau_potable"],

    # Age groups
    "population par groupe d'âges":         ["Population par Groupe d'Âges"],
    "age groups":                            ["Population par Groupe d'Âges"],
    "age distribution":                      ["Population par Groupe d'Âges"],
}

# ── Gender Alias Resolver ──────────────────────────────────────────────────────
# Standardized gender aliases mapping to match historical database variations.
GENDER_ALIASES = {
    'female': ['female', 'femme', 'femmes', 'f', 'feminin', 'féminin', 'f_'],
    'male': ['male', 'homme', 'hommes', 'm', 'masculin', 'm_']
}



def resolve_indicator_names(indicator: str) -> list[str]:
    """
    Given any indicator string from the frontend, return a deduplicated list
    of candidate indicator_name values to search for in the DB.
    Falls back to the raw string when no alias is found.
    """
    key = indicator.strip().lower()
    # Exact alias match
    if key in INDICATOR_ALIASES:
        return INDICATOR_ALIASES[key]
    # Partial alias match (e.g. 'PIB' matches 'pib nominal')
    for alias_key, candidates in INDICATOR_ALIASES.items():
        if key in alias_key or alias_key in key:
            return candidates
    # No alias found — return the raw indicator so ilike still runs
    return [indicator]
