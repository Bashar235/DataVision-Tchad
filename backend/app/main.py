from fastapi import FastAPI
from contextlib import asynccontextmanager
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, users, data, reports, export, admin, notifications, scheduler, contact, support, analytics, datasets, spatial, ml, user_activity, analyst, researcher
from app.core.config import settings
from app.api.v1.scheduler import scheduler as bg_scheduler
from app.db.session import engine, Base
from app.models import User # Ensure all models are registered

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    Base.metadata.create_all(bind=engine)
    bg_scheduler.start()
    
    # Load ML Engine at startup
    try:
        from app.api.v1.ml import load_ml_engine
        load_ml_engine()
    except Exception as e:
        print(f"ML Engine startup error: {e}")
        
    yield
    
    # Shutdown
    bg_scheduler.shutdown()

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# CORS setup
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8080",
    "http://localhost:8081",
    "http://localhost:8082",
    "http://127.0.0.1:8080",
    "http://127.0.0.1:8081",
    "http://127.0.0.1:8082",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers with /v1 standard
app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/v1/admin/users", tags=["admin"])
app.include_router(admin.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(data.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(data.router, prefix="/api/v1/data", tags=["data"])
app.include_router(reports.router, prefix="/api/v1/reports", tags=["reports"])
app.include_router(reports.router, prefix="/api/v1/admin/reports", tags=["admin"])
app.include_router(export.router, prefix="/api/v1/admin", tags=["admin"])
app.include_router(notifications.router, prefix="/api/v1/notifications", tags=["notifications"])
app.include_router(scheduler.router, prefix="/api/v1/schedule-export", tags=["scheduler"])
app.include_router(contact.router, prefix="/api/v1/contact", tags=["contact"])
app.include_router(support.router, prefix="/api/v1/support", tags=["support"])
app.include_router(analytics.router, prefix="/api/v1/analytics", tags=["analytics"])
app.include_router(datasets.router, prefix="/api/v1/datasets", tags=["datasets"])
app.include_router(spatial.router, prefix="/api/v1/spatial", tags=["spatial"])
app.include_router(ml.router, prefix="/api/v1/ml", tags=["ml"])
app.include_router(user_activity.router, prefix="/api/v1/activity", tags=["activity"])
app.include_router(analyst.router, prefix="/api/v1/analyst", tags=["analyst"])
app.include_router(researcher.router, prefix="/api/v1/researcher", tags=["researcher"])

# Base routes
@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "docs": "/docs"}
