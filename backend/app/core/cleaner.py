"""
cleaner.py — DataVision Tchad Strict Data Integrity Engine
===========================================================
Provides two core functions for the pre-flight health check pipeline:

  1. apply_strict_numeric_casting(df) → pd.DataFrame
     Forces all indicator columns to numeric via pd.to_numeric(errors='coerce').
     This is the "500ZER killer": any alphanumeric string in a numeric column
     is silently converted to NaN instead of passing through undetected.

  2. analyze_file_health(df_casted, df_original) → dict
     Compares the strictly casted DataFrame against the original to classify every
     detected anomaly by its physical location (row index, column name).

     Error taxonomy:
       Type A — FORMAT  : Value was non-null in original but became NaN after casting.
                          Root cause: alphanumeric corruption (e.g., "500ZER", "N/A").
       Type B — MISSING : Value was null/empty in the original file itself.
                          Root cause: missing field in the source data.
       Type C — LOGICAL : Value is numeric but violates domain constraints
                          (negative population, duplicate rows).
"""

from __future__ import annotations

import pandas as pd
import numpy as np
from typing import List, Dict, Any


# ---------------------------------------------------------------------------
# Column classification helpers
# ---------------------------------------------------------------------------

# Structural (non-indicator) column names — these are never cast to numeric
_STRUCTURAL_COLS = {
    "region", "province", "year", "annee", "age_group", "age_groupe", "gender",
    "sexe", "source", "notes", "observation", "département", "departement",
}

# Logical constraint: population-type columns must be non-negative
_POPULATION_KEYWORDS = {
    "population", "pop", "total", "effectif", "count", "nombre",
    "habitants", "resident",
}


def _is_structural(col: str) -> bool:
    """Return True if the column is a structural/identifier column (skip numeric cast)."""
    return col.strip().lower() in _STRUCTURAL_COLS


def _is_population_col(col: str) -> bool:
    """Return True if the column name suggests a population/count indicator."""
    col_lower = col.strip().lower()
    return any(kw in col_lower for kw in _POPULATION_KEYWORDS)


class CleaningError(Exception):
    """Exception raised for errors during the data cleaning process."""
    pass


# ---------------------------------------------------------------------------
# Core function 1: Strict Numeric Casting
# ---------------------------------------------------------------------------

def apply_strict_numeric_casting(df: pd.DataFrame) -> pd.DataFrame:
    """
    Return a copy of *df* where every non-structural column has been coerced
    to numeric via pd.to_numeric(series, errors='coerce').

    Any value that cannot be interpreted as a number (e.g., '500ZER', 'N/A',
    an accidental string) will become NaN. The original DataFrame is NOT
    mutated.

    Args:
        df: Raw DataFrame parsed from the uploaded CSV/XLSX file.

    Returns:
        A new DataFrame with the same shape; indicator columns are float64
        (or their original dtype if they were already purely numeric).
    """
    df_out = df.copy()

    for col in df_out.columns:
        if _is_structural(col):
            continue  # Leave Year, Region, etc. untouched

        # Only attempt cast on object (mixed/string) columns or columns that
        # already look numeric — this handles both CSV-parsed strings and
        # Excel-parsed numbers.
        df_out[col] = pd.to_numeric(df_out[col], errors="coerce")
        
        # Type Verification
        assert df_out[col].dtype != 'object', f"Column {col} failed strict casting and remains an 'object' type."
        if df_out[col].dtype == 'object':
            raise CleaningError(f"Column {col} failed to cast to numeric and remains an 'object' type.")

    return df_out


# ---------------------------------------------------------------------------
# Core function 2: Diagnostic Engine
# ---------------------------------------------------------------------------

def analyze_file_health(
    df_casted: pd.DataFrame,
    df_original: pd.DataFrame,
) -> Dict[str, Any]:
    """
    Generate a comprehensive line-by-line health report by comparing the
    strictly-casted DataFrame against the raw original.

    Args:
        df_casted:  Output of apply_strict_numeric_casting().
        df_original: Raw DataFrame exactly as read from the uploaded file.

    Returns:
        A dict suitable for JSON serialisation:
        {
            "total_errors": <int>,
            "format_errors": <int>,   # Type A — alphanumeric corruption
            "missing_errors": <int>,  # Type B — original null values
            "logical_errors": <int>,  # Type C — negative values, duplicates
            "errors": [
                {
                    "line": <int>,          # 1-based row number (header = 0)
                    "column": <str>,        # Column name exactly as in the file
                    "original_value": <str>,# The raw cell value as a string
                    "error_type": <str>     # "FORMAT" | "MISSING" | "LOGICAL"
                },
                ...
            ]
        }
    """
    errors: List[Dict[str, Any]] = []

    # ── Detect duplicate rows (Type C) ─────────────────────────────────────
    # Mark duplicates using keep=False so ALL copies are flagged, not just tail
    duplicate_mask = df_original.duplicated(keep=False)
    duplicate_rows = set(df_original.index[duplicate_mask].tolist())

    # ── Pre-calculate stats for Outlier Detection ──────────────────────────
    col_stats = {}
    for col in df_casted.columns:
        if not _is_structural(col):
            col_stats[col] = {
                'mean': df_casted[col].mean(),
                'std': df_casted[col].std()
            }

    # ── Cell-by-cell analysis ───────────────────────────────────────────────
    for col in df_original.columns:
        if _is_structural(col):
            continue  # Structural columns are not validated for numeric content

        orig_col = df_original[col]

        # Does this column exist in the casted df? (should always be True)
        has_casted = col in df_casted.columns
        cast_col = df_casted[col] if has_casted else None

        for row_idx in df_original.index:
            orig_val = orig_col.iloc[row_idx]
            line_number = row_idx + 2  # +1 for 0-index, +1 for header row

            # ── Type B (MISSING): originally null ───────────────────────────
            is_originally_null = (
                orig_val is None
                or orig_val == ""
                or (isinstance(orig_val, float) and np.isnan(orig_val))
                or (isinstance(orig_val, str) and orig_val.strip() == "")
            )

            if is_originally_null:
                errors.append({
                    "line": line_number,
                    "column": col,
                    "original_value": "",
                    "error_type": "MISSING",
                })
                continue  # No further checks needed for this cell

            # ── Type A (FORMAT): casting introduced NaN ─────────────────────
            if cast_col is not None:
                cast_val = cast_col.iloc[row_idx]
                cast_is_nan = (
                    cast_val is None
                    or (isinstance(cast_val, float) and np.isnan(cast_val))
                )
                if cast_is_nan:
                    errors.append({
                        "line": line_number,
                        "column": col,
                        "original_value": str(orig_val),
                        "error_type": "FORMAT",
                        "message": f'Line {line_number}: Value "{orig_val}" is invalid and will be replaced by AI estimation.'
                    })
                    continue

            # ── Type C (LOGICAL): Negative or Floor Check for Population ─────────────────
            if cast_col is not None and _is_population_col(col):
                cast_val = cast_col.iloc[row_idx]
                if isinstance(cast_val, (int, float)) and not np.isnan(cast_val):
                    if cast_val < 0:
                        errors.append({
                            "line": line_number,
                            "column": col,
                            "original_value": str(orig_val),
                            "error_type": "LOGICAL",
                            "message": "Negative value in population column."
                        })
                        continue
                    elif cast_val < 50000:
                        errors.append({
                            "line": line_number,
                            "column": col,
                            "original_value": str(orig_val),
                            "error_type": "LOGICAL",
                            "message": f"Population impossibly low (< 50,000 for a region): {cast_val}."
                        })
                        continue

            # ── Type C (LOGICAL): Statistical Outlier Detection (Z-Score) ────────────────
            if cast_col is not None and col in col_stats and not _is_population_col(col):
                cast_val = cast_col.iloc[row_idx]
                if isinstance(cast_val, (int, float)) and not np.isnan(cast_val):
                    c_mean = col_stats[col]['mean']
                    c_std = col_stats[col]['std']
                    if pd.notna(c_mean) and pd.notna(c_std) and c_std > 0:
                        if abs(cast_val - c_mean) > 3 * c_std:
                            errors.append({
                                "line": line_number,
                                "column": col,
                                "original_value": str(orig_val),
                                "error_type": "LOGICAL",
                                "message": f"Value {cast_val} is >3 standard deviations from the mean."
                            })
                            continue

        # ── Type C (LOGICAL): flag duplicate rows once per column ──────────
        # We report duplicates on the "Year" or first structural column only,
        # to avoid flooding the report. Here we add one entry per duplicate row.

    # Report duplicates separately (once per duplicate row, not per column)
    for row_idx in duplicate_rows:
        line_number = row_idx + 2
        errors.append({
            "line": line_number,
            "column": "(Entire Row)",
            "original_value": f"Duplicate of row {line_number}",
            "error_type": "LOGICAL",
        })

    # ── Aggregate counts ────────────────────────────────────────────────────
    format_count = sum(1 for e in errors if e["error_type"] == "FORMAT")
    missing_count = sum(1 for e in errors if e["error_type"] == "MISSING")
    logical_count = sum(1 for e in errors if e["error_type"] == "LOGICAL")

    return {
        "total_errors": len(errors),
        "format_errors": format_count,
        "missing_errors": missing_count,
        "logical_errors": logical_count,
        "errors": errors,
    }
