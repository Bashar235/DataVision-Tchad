"""
sync_inseed_metadata.py
=======================
One-time script: Sync the datasets table row for the INSEED 2026 dataset
that was injected manually (bypassing the API upload pipeline).

UUID: 35949ad2-8b2e-5123-bd6a-2dd65a98a9d3
Target: status='Cleaned', row_count=50400
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db.session import SessionLocal
from app.models import Dataset, CleanedData
from sqlalchemy import func
import uuid

INSEED_UUID = uuid.UUID("35949ad2-8b2e-5123-bd6a-2dd65a98a9d3")
TARGET_ROW_COUNT = 50400

def sync():
    db = SessionLocal()
    try:
        dataset = db.query(Dataset).filter(Dataset.id == INSEED_UUID).first()

        if not dataset:
            print(f"ERROR: Dataset {INSEED_UUID} not found in datasets table.")
            print("Hint: The datasets table may need a manual INSERT for this seed record.")
            # Try to create a placeholder entry
            actual_count = db.query(func.count(CleanedData.id)).filter(
                CleanedData.dataset_id == INSEED_UUID
            ).scalar() or 0
            print(f"  cleaned_data rows found for this UUID: {actual_count}")
            return

        # Update metadata
        dataset.status = "Cleaned"           # type: ignore
        dataset.row_count = TARGET_ROW_COUNT  # type: ignore
        # Set col_count to 6 (the long-format schema columns)
        if not dataset.col_count:
            dataset.col_count = 6            # type: ignore
        # Reset quality counters to reflect clean seeded data
        dataset.null_count = 0               # type: ignore
        dataset.dupe_count = 0               # type: ignore

        db.commit()
        db.refresh(dataset)

        print(f"SUCCESS: Dataset '{dataset.original_filename}' updated.")
        print(f"  status    = {dataset.status}")
        print(f"  row_count = {dataset.row_count}")
        print(f"  col_count = {dataset.col_count}")
        print(f"  null_count= {dataset.null_count}")
        print(f"  dupe_count= {dataset.dupe_count}")

        # Verify cleaned_data count
        cd_count = db.query(func.count(CleanedData.id)).filter(
            CleanedData.dataset_id == INSEED_UUID
        ).scalar() or 0
        print(f"\n  cleaned_data rows for this UUID: {cd_count}")

    except Exception as e:
        db.rollback()
        print(f"ERROR: {e}")
        raise
    finally:
        db.close()

if __name__ == "__main__":
    sync()
