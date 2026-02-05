# DataVision Tchad: REST API Documentation

**Base URL**: `http://localhost:8000/api`  
**Production URL**: `https://datavision.inseed.td/api` (on-premise INSEED server)  
**API Version**: v1  
**Document Version**: 1.0  
**Date**: February 2026  
**Authentication**: Bearer JWT tokens (format: `jwt_<user_id>_<role>`)

---

## Executive Summary

The DataVision Tchad REST API follows **OpenAPI 3.0** standards and implements a **resource-oriented architecture**. All endpoints return JSON responses with consistent error formatting. The API prioritizes **data sovereignty** (on-premise hosting), **auditability** (all actions logged to `audit_logs`), and **resilience** (graceful degradation for offline scenarios).

**Key Features**:
- **CORS Enabled**: Supports frontend on separate domain (localhost:5173 during development)
- **Rate Limiting**: 500 requests/minute per IP (prevents abuse)
- **Compression**: All responses gzip-compressed to reduce bandwidth
- **Validation**: Pydantic schemas enforce strict request/response contracts

---

## Authentication Endpoints

### 1. POST `/auth/login`
**Description**: Validate user credentials (email + password)  
**Authentication**: None required  
**Request Body**:
```json
{
  "email": "basharbidjere@gmail.com",
  "password": "SecureP@ssw0rd"
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "user": {
    "id": 1,
    "name": "Dr. Mahamat Saleh",
    "email": "basharbidjere@gmail.com",
    "role": "administrator",
    "is_active": true
  }
}
```

**Error** (401 Unauthorized):
```json
{
  "detail": "Invalid email or password"
}
```

---

### 2. POST `/auth/otp/generate`
**Description**: Generate and send 6-digit OTP to user's email  
**Authentication**: None required  
**Request Body**:
```json
{
  "email": "basharbidjere@gmail.com"
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "OTP sent to email"
}
```

**Backend Behavior**:
- Generates random 6-digit code (100000-999999)
- Stores in memory (`OTP_STORE` dictionary) with 5-minute TTL
- Sends email via SMTP (`app.utils.email.send_otp_email`)
- Prints OTP to console for development (removed in production)

---

### 3. POST `/auth/otp/verify`
**Description**: Verify OTP code and issue JWT token  
**Authentication**: None required  
**Request Body**:
```json
{
  "email": "basharbidjere@gmail.com",
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "token": "jwt_1_administrator",
  "user": {
    "role": "administrator"
  }
}
```

**Special Codes**:
- `000000`: Bypasses OTP check (development only)

**Error** (400 Bad Request):
```json
{
  "detail": "Invalid or expired verification code"
}
```

---

### 4. POST `/auth/2fa/setup`
**Description**: Generate TOTP secret and QR code for 2FA authentication  
**Authentication**: Bearer token required  
**Headers**:
```
Authorization: Bearer jwt_1_administrator
```

**Response** (200 OK):
```json
{
  "secret": "JBSWY3DPEHPK3PXP",
  "qr_code": "data:image/png;base64,iVBORw0KGgoAAAANSUh...",
  "otpauth_uri": "otpauth://totp/DataVision%20Tchad:basharbidjere@gmail.com?secret=JBSWY3DPEHPK3PXP&issuer=DataVision%20Tchad"
}
```

**Backend Logic**:
- Uses `pyotp.random_base32()` to generate secret
- Stores `totp_secret` in `users` table (but `is_2fa_enabled` remains FALSE until verification)
- Generates QR code using `qrcode` library
- Returns base64-encoded PNG image

---

### 5. POST `/auth/2fa/verify`
**Description**: Verify TOTP code from authenticator app and enable 2FA  
**Authentication**: Bearer token required  
**Request Body**:
```json
{
  "code": "123456"
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "2FA has been enabled successfully"
}
```

**Backend Logic**:
- Uses `pyotp.TOTP(user.totp_secret).verify(code, valid_window=1)`
- Sets `is_2fa_enabled = TRUE` in `users` table
- Logs action to `audit_logs` with action `2FA_ENABLED`

---

## Dataset Management Endpoints

### 6. POST `/datasets/upload`
**Description**: Upload Excel/CSV file with automatic quality validation  
**Authentication**: Bearer token required (Analyst or Admin role)  
**Content-Type**: `multipart/form-data`  
**Request Body**:
```
file: (binary data) // .xlsx, .xls, or .csv file (max 50 MB)
```

**Response** (200 OK - Quality >= 95%):
```json
{
  "status": "success",
  "dataset_id": 42,
  "quality_score": 98.2,
  "message": "Dataset uploaded and migrated to production schema"
}
```

**Response** (422 Unprocessable Entity - Quality < 95%):
```json
{
  "error": "Quality Gate Failed",
  "quality_score": 87.34,
  "required_score": 95.0,
  "null_cells": 347,
  "duplicate_rows": 23,
  "message": "Data retained in temporary_storage. Please clean and re-upload.",
  "dataset_id": 42
}
```

**Backend Flow**:
1. Parse file to Pandas DataFrame
2. Calculate quality metrics:
   ```python
   total_cells = rows * columns
   null_count = df.isnull().sum().sum()
   dupe_count = df.duplicated().sum()
   quality_score = ((total_cells - null_count) / total_cells) * 100
   if dupe_count > 0:
       quality_score -= (dupe_count / rows) * 10
   ```
3. Insert into `temporary_storage.validation_staging` table
4. **If score >= 95%**: Migrate to `indicators_data`, log `DATASET_APPROVED`
5. **If score < 95%**: Retain in staging, log `QUALITY_GATE_FAILED`, return 422

---

### 7. GET `/datasets`
**Description**: List all datasets uploaded by the current user  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
[
  {
    "id": 42,
    "name": "RGPH2024_Mayo-Kebbi.xlsx",
    "date": "2026-02-03T14:22:10+01:00",
    "status": "CLEANED",
    "health_score": 98.2,
    "row_count": 15420,
    "null_count": 347
  },
  {
    "id": 41,
    "name": "Census_Salamat.csv",
    "date": "2026-01-28T09:15:00+01:00",
    "status": "ERROR",
    "health_score": 82.1,
    "row_count": 8732,
    "null_count": 1523
  }
]
```

---

### 8. GET `/datasets/{id}/preview`
**Description**: Get first 100 rows of a dataset for visual inspection  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
{
  "filename": "RGPH2024_Mayo-Kebbi.xlsx",
  "headers": ["province", "year", "population", "birth_rate", "mortality_rate"],
  "data": [
    ["Mayo-Kebbi Est", 2023, 827463, 42.3, 10.7],
    ["Mayo-Kebbi Ouest", 2023, 598284, 41.8, 11.2],
    // ... (up to 100 rows)
  ]
}
```

---

### 9. POST `/datasets/{id}/clean`
**Description**: Trigger automated data cleaning for a PENDING dataset  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
{
  "summary": {
    "rows_before": 15420,
    "rows_after": 15397,
    "nulls_filled": 347,
    "duplicates_removed": 23,
    "outliers_corrected": 12,
    "final_quality_score": 98.2
  }
}
```

---

## Analytics Endpoints

### 10. GET `/analytics/dashboard`
**Description**: Get KPI metrics for the main dashboard  
**Authentication**: Bearer token required  
**Query Parameters**:
- `year` (optional): Filter by year (default: 2023)
- `province` (optional): Filter by province (default: all)
- `gender` (optional): Filter by gender (M/F/all, default: all)

**Request**:
```
GET /api/analytics/dashboard?year=2023&province=Mayo-Kebbi Est&gender=F
```

**Response** (200 OK):
```json
{
  "kpis": {
    "total_population": 16244513,
    "population_growth_yoy": 2.1,
    "birth_rate": 42.3,
    "birth_rate_change_yoy": -0.5,
    "mortality_rate": 10.7,
    "mortality_rate_change_yoy": -1.2,
    "regions_count": 23
  },
  "population_trend": [
    {"year": 2015, "value": 12075000},
    {"year": 2016, "value": 12450000},
    // ... (last 10 years)
    {"year": 2023, "value": 16244513}
  ],
  "regional_breakdown": [
    {"province": "N'Djamena", "population": 1605696},
    {"province": "Mayo-Kebbi Est", "population": 827463},
    // ... (top 5 provinces)
  ]
}
```

---

### 11. GET `/analytics/health`
**Description**: Get data quality health score for all datasets  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
{
  "overall_health_score": 94.7,
  "total_datasets": 127,
  "passed_quality_gate": 119,
  "failed_quality_gate": 8,
  "recommendation": "Review 8 rejected datasets in temporary_storage"
}
```

---

### 12. GET `/analytics/map`
**Description**: Get geospatial data for choropleth map visualization  
**Authentication**: Bearer token required  
**Query Parameters**:
- `indicator`: Indicator name (e.g., "population", "GDP")
- `year`: Reference year

**Request**:
```
GET /api/analytics/map?indicator=population&year=2023
```

**Response** (200 OK - GeoJSON format):
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "properties": {
        "province_name": "Mayo-Kebbi Est",
        "province_code": "MK-E",
        "population": 827463,
        "area_km2": 14929.45,
        "density": 55.4
      },
      "geometry": {
        "type": "MultiPolygon",
        "coordinates": [[[15.5, 9.2], [15.6, 9.1], ...]]
      }
    },
    // ... (22 more provinces)
  ]
}
```

---

## AI Forecasting Endpoints (PROPOSED - Phase 2)

> [!WARNING]
> **Status**: PROPOSED - Endpoints for XGBoost/Prophet integration  
> Current implementation uses simple linear regression in `app.ml.train_model.py`

### 13. POST `/forecasts/generate`
**Description**: Generate population/GDP forecast using ML models  
**Authentication**: Bearer token required (Researcher or Admin role)  
**Request Body**:
```json
{
  "indicator": "population",
  "region": "Mayo-Kebbi Est",
  "model": "prophet",
  "start_year": 2024,
  "end_year": 2027,
  "parameters": {
    "seasonality_mode": "additive",
    "growth": "linear",
    "confidence_interval": 0.95
  }
}
```

**Response** (200 OK):
```json
{
  "forecast_id": 89,
  "indicator": "population",
  "region": "Mayo-Kebbi Est",
  "model_used": "PROPHET",
  "predictions": [
    {
      "year": 2024,
      "predicted_value": 847320.00,
      "confidence_lower": 830145.00,
      "confidence_upper": 864495.00
    },
    {
      "year": 2025,
      "predicted_value": 867890.00,
      "confidence_lower": 848210.00,
      "confidence_upper": 887570.00
    },
    {
      "year": 2026,
      "predicted_value": 889123.00,
      "confidence_lower": 866891.00,
      "confidence_upper": 911355.00
    },
    {
      "year": 2027,
      "predicted_value": 911045.00,
      "confidence_lower": 886245.00,
      "confidence_upper": 935845.00
    }
  ],
  "model_metrics": {
    "rmse": 1205.45,
    "mae": 950.32,
    "r_squared": 0.94
  },
  "generated_at": "2026-02-05T11:00:00+01:00"
}
```

**Backend Implementation** (Proposed):
```python
from prophet import Prophet
import pandas as pd

# Load historical data
df = pd.DataFrame({
    'ds': ['2015-01-01', '2016-01-01', ..., '2023-01-01'],
    'y': [750000, 768000, ..., 827463]
})

# Train model
model = Prophet(seasonality_mode='additive', growth='linear')
model.fit(df)

# Generate forecast
future = model.make_future_dataframe(periods=4, freq='Y')
forecast = model.predict(future)

# Extract predictions and confidence intervals
results = forecast[['ds', 'yhat', 'yhat_lower', 'yhat_upper']].tail(4)
```

---

### 14. GET `/forecasts/{id}`
**Description**: Retrieve a previously generated forecast  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
{
  "forecast_id": 89,
  "indicator": "population",
  "region": "Mayo-Kebbi Est",
  "model_used": "PROPHET",
  "predictions": [...],
  "generated_at": "2026-02-05T11:00:00+01:00"
}
```

---

## User Management Endpoints (Admin Only)

### 15. GET `/admin/users`
**Description**: List all users in the system  
**Authentication**: Bearer token required (Administrator role only)  
**Response** (200 OK):
```json
[
  {
    "id": 1,
    "full_name": "Dr. Mahamat Saleh",
    "email": "basharbidjere@gmail.com",
    "role": "administrator",
    "is_active": true,
    "is_2fa_enabled": true,
    "last_login": "2026-02-05T09:15:22+01:00"
  },
  {
    "id": 2,
    "full_name": "Amina Ahmat",
    "email": "scoopsofficial01@gmail.com",
    "role": "analyst",
    "is_active": true,
    "is_2fa_enabled": false,
    "last_login": "2026-02-04T14:30:10+01:00"
  }
]
```

---

### 16. POST `/admin/users`
**Description**: Create a new user account  
**Authentication**: Bearer token required (Administrator role only)  
**Request Body**:
```json
{
  "full_name": "Dr. Ibrahim Youssouf",
  "email": "bbidjere@gmail.com",
  "password": "SecureP@ssw0rd",
  "role": "researcher"
}
```

**Response** (201 Created):
```json
{
  "id": 3,
  "full_name": "Dr. Ibrahim Youssouf",
  "email": "bbidjere@gmail.com",
  "role": "researcher",
  "is_active": true
}
```

---

### 17. PATCH `/admin/users/{id}`
**Description**: Update user details (name, email, role, or deactivate account)  
**Authentication**: Bearer token required (Administrator role only)  
**Request Body**:
```json
{
  "full_name": "Dr. Ibrahim Youssouf (Updated)",
  "is_active": false
}
```

**Response** (200 OK):
```json
{
  "status": "success",
  "message": "User updated successfully"
}
```

---

## Additional Endpoints

### 18. GET `/notifications`
**Description**: Get unread notifications for the current user  
**Authentication**: Bearer token required  
**Response** (200 OK):
```json
[
  {
    "id": 15,
    "type": "EXPORT_READY",
    "message": "Your scheduled export 'GDP 2025-2029' is ready.",
    "details": {
      "filename": "GDP_Export_2026-02-05.xlsx",
      "download_url": "/api/exports/download/GDP_Export_2026-02-05.xlsx"
    },
    "is_read": false,
    "created_at": "2026-02-05T10:30:00+01:00"
  }
]
```

---

### 19. POST `/schedule-export`
**Description**: Schedule a future data export  
**Authentication**: Bearer token required  
**Request Body**:
```json
{
  "export_details": "GDP data for all provinces 2025-2029",
  "scheduled_time": "2026-02-06T08:00:00+01:00"
}
```

**Response** (201 Created):
```json
{
  "schedule_id": 42,
  "status": "PENDING",
  "scheduled_time": "2026-02-06T08:00:00+01:00"
}
```

---

### 20. POST `/support`
**Description**: Submit a support ticket  
**Authentication**: Bearer token required  
**Request Body**:
```json
{
  "subject": "Unable to upload dataset - file format error",
  "message": "I'm trying to upload a CSV file but getting 'Invalid format' error. The file opens fine in Excel."
}
```

**Response** (201 Created):
```json
{
  "ticket_id": 89,
  "status": "OPEN",
  "created_at": "2026-02-05T11:45:00+01:00"
}
```

---

### 21. GET `/admin/audit-logs`
**Description**: Retrieve audit log entries  
**Authentication**: Bearer token required (Administrator role only)  
**Query Parameters**:
- `user_id` (optional): Filter by specific user
- `action` (optional): Filter by action type
- `start_date` (optional): Filter from date
- `end_date` (optional): Filter to date

**Request**:
```
GET /api/admin/audit-logs?action=DATASET_UPLOAD&start_date=2026-02-01
```

**Response** (200 OK):
```json
[
  {
    "id": 45231,
    "user_id": 1,
    "user_name": "Dr. Mahamat Saleh",
    "action": "DATASET_UPLOAD",
    "ip_address": "196.168.1.45",
    "details": {
      "dataset_id": 42,
      "filename": "RGPH2024_Mayo-Kebbi.xlsx",
      "file_size_mb": 3.7,
      "quality_score": 87.34,
      "validation_status": "REJECTED"
    },
    "created_at": "2026-02-03T14:22:10+01:00"
  }
]
```

---

## Error Handling

All errors follow this standard format:

**Generic Error** (500 Internal Server Error):
```json
{
  "detail": "An unexpected error occurred. Please contact support.",
  "error_code": "INTERNAL_ERROR"
}
```

**Validation Error** (422 Unprocessable Entity):
```json
{
  "detail": [
    {
      "loc": ["body", "email"],
      "msg": "field required",
      "type": "value_error.missing"
    }
  ]
}
```

**Authentication Error** (401 Unauthorized):
```json
{
  "detail": "Invalid authentication token"
}
```

**Authorization Error** (403 Forbidden):
```json
{
  "detail": "Insufficient permissions. Administrator role required."
}
```

---

## Rate Limiting & Bandwidth Optimization

**Rate Limits**:
- General endpoints: 500 requests/minute per IP
- Upload endpoints: 10 uploads/hour per user
- OTP generation: 5 OTPs/hour per email

**Bandwidth Optimization for Chad**:
1. **gzip Compression**: All JSON responses compressed (70% size reduction)
2. **Pagination**: Default page size 50, max 100
3. **Field Selection**: `?fields=id,name,status` to request only specific fields
4. **ETags**: Conditional requests using `If-None-Match` header
5. **Delta Sync**: `?since=2026-02-01T00:00:00Z` to fetch only new/updated records

---

## CORS Configuration

**Allowed Origins** (Development):
```python
origins = [
    "http://localhost:5173",  # Vite dev server
    "http://localhost:3000",  # Alternative port
    "http://127.0.0.1:5173",
]
```

**Allowed Origins** (Production):
```python
origins = [
    "https://datavision.inseed.td",  # Production frontend
]
```

---

## Postman Collection

A complete Postman collection with all endpoints and example requests is available at:
`Backend/docs/DataVision_API.postman_collection.json`

**Import Instructions**:
1. Open Postman
2. File → Import → Upload `DataVision_API.postman_collection.json`
3. Set environment variable `BASE_URL` to `http://localhost:8000/api`
4. Set environment variable `AUTH_TOKEN` after successful login

---

**Document Prepared By**: Antigravity AI for INSEED Chad  
**Review Status**: Pending Backend Team Review  
**Next Update**: Upon XGBoost/Prophet ML endpoint implementation
