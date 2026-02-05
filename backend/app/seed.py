from app.db.session import engine, Base, SessionLocal
from app.models import User, DataDictionary, TableSettings
from app.utils.security import get_password_hash

def seed_data_dictionary(db):
    print("Seeding Data Dictionary...")
    definitions = [
        # indicators_data
        {"table_name": "indicators_data", "column_name": "indicator_name", "display_name": "Indicator", "description": "The specific demographic or economic metric name.", "data_type": "string"},
        {"table_name": "indicators_data", "column_name": "value", "display_name": "Value", "description": "The measured numeric value for the indicator.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "year", "display_name": "Year", "description": "The calendar year of data collection.", "data_type": "integer"},
        {"table_name": "indicators_data", "column_name": "region", "display_name": "Region", "description": "The administrative region associated with the data.", "data_type": "string"},
        {"table_name": "indicators_data", "column_name": "Infant Mortality", "display_name": "Infant Mortality", "description": "Deaths of infants under one year old per 1,000 live births.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Literacy Rate", "display_name": "Literacy Rate", "description": "Percentage of population aged 15 and above who can read and write.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Access to Clean Water", "display_name": "Access to Clean Water", "description": "Percentage of population with access to improved water sources.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Infrastructure Investment", "display_name": "Infrastructure Investment", "description": "Public spending on infrastructure development (indexed).", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Age 0-14", "display_name": "Age 0-14", "description": "Percentage of population aged 0 to 14 years.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Age 15-64", "display_name": "Age 15-64", "description": "Percentage of population aged 15 to 64 years.", "data_type": "numeric"},
        {"table_name": "indicators_data", "column_name": "Age 65+", "display_name": "Age 65+", "description": "Percentage of population aged 65 years and older.", "data_type": "numeric"},
        # spatial_ref_sys
        {"table_name": "spatial_ref_sys", "column_name": "srid", "display_name": "SRID", "description": "Spatial Reference System Identifier - unique ID for coordinate systems.", "data_type": "integer"},
        {"table_name": "spatial_ref_sys", "column_name": "auth_name", "display_name": "Authority", "description": "The authority that defined the coordinate system (e.g., EPSG).", "data_type": "string"},
        {"table_name": "spatial_ref_sys", "column_name": "proj4text", "display_name": "Proj4 String", "description": "Parameters for projection transformations.", "data_type": "string"},
    ]
    
    for defn in definitions:
        exists = db.query(DataDictionary).filter(
            DataDictionary.table_name == defn["table_name"],
            DataDictionary.column_name == defn["column_name"]
        ).first()
        if not exists:
            db.add(DataDictionary(**defn))
    
    db.commit()
    print("Data Dictionary seeded successfully.")

def seed_table_settings(db):
    print("Seeding Table Settings...")
    tables = [
        "indicators_data", 
        "spatial_ref_sys", 
        "demographics", 
        "economic_metrics", 
        "gdp_data", 
        "employment",
        "users",
        "audit_logs"
    ]
    for name in tables:
        exists = db.query(TableSettings).filter(TableSettings.table_name == name).first()
        if not exists:
            db.add(TableSettings(table_name=name, is_locked=False))
    db.commit()
    print("Table Settings seeded successfully.")

def seed_db():
    print("Creating tables...")
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        # Seeding admin
        admin = db.query(User).filter(User.email == "basharbidjere@gmail.com").first()
        if not admin:
            print("Seeding initial admin user...")
            admin_user = User(
                full_name="Administrator",
                email="basharbidjere@gmail.com",
                password_hash=get_password_hash("admin123"),
                role="administrator",
                is_active=True
            )
            db.add(admin_user)
            db.commit()
            print("Admin user created successfully.")
        else:
            # Update password if user exists (in case password changed)
            admin.password_hash = get_password_hash("admin123")
            db.commit()
            print("Admin user already exists - password updated.")
        
        # Seeding analyst
        analyst = db.query(User).filter(User.email == "scoopsofficial01@gmail.com").first()
        if not analyst:
            print("Seeding analyst user...")
            analyst_user = User(
                full_name="Data Analyst",
                email="scoopsofficial01@gmail.com",
                password_hash=get_password_hash("anal1234"),
                role="analyst",
                is_active=True
            )
            db.add(analyst_user)
            db.commit()
            print("Analyst user created successfully.")
        else:
            # Update password if user exists
            analyst.password_hash = get_password_hash("anal1234")
            db.commit()
            print("Analyst user already exists - password updated.")
        
        # Seeding researcher
        researcher = db.query(User).filter(User.email == "bbidjere@gmail.com").first()
        if not researcher:
            print("Seeding researcher user...")
            researcher_user = User(
                full_name="Researcher",
                email="bbidjere@gmail.com",
                password_hash=get_password_hash("rese1234"),
                role="researcher",
                is_active=True
            )
            db.add(researcher_user)
            db.commit()
            print("Researcher user created successfully.")
        else:
            # Update password if user exists
            researcher.password_hash = get_password_hash("rese1234")
            db.commit()
            print("Researcher user already exists - password updated.")
        
        # Seeding dictionary
        seed_data_dictionary(db)
        
        # Seeding table settings
        seed_table_settings(db)

    except Exception as e:
        print(f"Error seeding DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_db()
