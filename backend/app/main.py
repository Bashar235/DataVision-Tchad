from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, users, data, reports, export, admin, notifications, scheduler, contact, support, analytics, datasets
from app.core.config import settings
from app.api.v1.scheduler import scheduler as bg_scheduler
from app.db.session import engine, Base
from app.models import User # Ensure all models are registered

app = FastAPI(title=settings.PROJECT_NAME)

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

# Include Routers with legacy compatibility
app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(users.router, prefix="/api/admin/users", tags=["admin"])
app.include_router(admin.router, prefix="/api/admin", tags=["admin"])
app.include_router(data.router, prefix="/api/admin", tags=["admin"])
app.include_router(data.router, prefix="/api", tags=["data"])
app.include_router(reports.router, prefix="/api/reports", tags=["reports"])
app.include_router(reports.router, prefix="/api/admin/reports", tags=["admin"])  # Also mount under admin
app.include_router(export.router, prefix="/api/admin", tags=["admin"])
app.include_router(notifications.router, prefix="/api/notifications", tags=["notifications"])
app.include_router(scheduler.router, prefix="/api/schedule-export", tags=["scheduler"])
app.include_router(contact.router, prefix="/api/contact", tags=["contact"])
app.include_router(support.router, prefix="/api/support", tags=["support"])
app.include_router(analytics.router, prefix="/api/analytics", tags=["analytics"])
app.include_router(datasets.router, prefix="/api/datasets", tags=["datasets"])

@app.on_event("startup")
def startup_event():
    Base.metadata.create_all(bind=engine)
    bg_scheduler.start()

@app.on_event("shutdown")
def shutdown_event():
    bg_scheduler.shutdown()

@app.get("/")
def read_root():
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "docs": "/docs"}
