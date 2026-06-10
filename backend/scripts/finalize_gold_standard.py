import sys
import uuid
from pathlib import Path
from sqlalchemy import text

BACKEND_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(BACKEND_ROOT))

from app.db.session import SessionLocal

def finalize():
    label = "INSEED_GOLD_STANDARD_2026"
    ds_id = uuid.uuid5(uuid.NAMESPACE_DNS, label)
    print(f"Finalizing Dataset ID: {ds_id}")

    db = SessionLocal()
    try:
        # Check if quality_score column exists first to avoid error
        columns = db.execute(text("SELECT column_name FROM information_schema.columns WHERE table_name='datasets'")).fetchall()
        column_names = [c[0] for c in columns]
        
        update_sqls = []
        update_sqls.append("status = 'cleaned'")
        update_sqls.append("null_count = 0")
        update_sqls.append("dupe_count = 0")
        
        if 'quality_score' in column_names:
            update_sqls.append("quality_score = 1.0")
        else:
            print("Warning: 'quality_score' column not found in datasets table. Skipping.")

        sql = f"UPDATE datasets SET {', '.join(update_sqls)} WHERE id = :id"
        print(f"Executing: {sql}")
        db.execute(text(sql), {"id": ds_id})
        db.commit()
        
        # Verify
        res = db.execute(text("SELECT id, status, row_count FROM datasets WHERE id = :id"), {"id": ds_id}).fetchone()
        print(f"Verification: {res}")
        
        # Check data count in cleaned_data
        count = db.execute(text("SELECT COUNT(*) FROM cleaned_data WHERE dataset_id = :id"), {"id": ds_id}).scalar()
        print(f"Cleaned Data Count: {count}")

    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    finalize()
