from app.db.session import engine, Base
from app.models import User, IndicatorData, DataDictionary, TableSettings, AuditLog, Notification, ScheduledExport, Dataset

def reset_db():
    print("Dropping all tables...")
    Base.metadata.drop_all(bind=engine)
    print("Creating all tables...")
    Base.metadata.create_all(bind=engine)
    print("Database reset completed.")

if __name__ == "__main__":
    reset_db()
