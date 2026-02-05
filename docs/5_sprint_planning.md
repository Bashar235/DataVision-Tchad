# DataVision Tchad: Sprint Planning & Work Breakdown Structure

**Project Duration**: 8 weeks (3 sprints)  
**Team Composition**: 1 Full-Stack Developer, 1 Database Administrator, 1 UI/UX Designer  
**Sprint Length**: 2-3 weeks per sprint  
**Document Version**: 1.0  
**Date**: February 2026  
**Methodology**: Agile Scrum (adapted for small team)

---

## Executive Summary

This sprint plan organizes the DataVision Tchad project into **3 major sprints** aligned with the platform's core capabilities: **Authentication & Infrastructure** (Sprint 1), **Data Cleaning & Quality Gate** (Sprint 2), and **AI Forecasting & Geospatial Visualization** (Sprint 3). Each sprint delivers a functional increment that can be demonstrated to INSEED stakeholders.

**Total Effort Estimate**: 480 person-hours (60 person-days)  
**Risk Buffer**: 20% added for Chad-specific challenges (connectivity testing, French translation)  
**Deployment Target**: On-premise INSEED server (N'Djamena Data Center)

---

## Sprint 1: Foundation & Authentication (Weeks 1-3)

### Sprint Goal
Establish the **technical foundation** and **secure authentication system** for DataVision Tchad, enabling INSEED staff to log in with OTP/2FA and access role-based dashboards.

### Sprint Duration
**3 weeks** (120 person-hours)

---

### Task Breakdown

#### 1.1 Database Infrastructure (24 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| DB-101 | Install PostgreSQL 15 + PostGIS 3.3 on INSEED server | 4h | DBA | Server access granted | Running DB instance |
| DB-102 | Create schemas: `public`, `temporary_storage`, `spatial` | 2h | DBA | DB-101 | Schema structure |
| DB-103 | Implement `users` table with 2FA fields | 3h | DBA | DB-102 | Users table created |
| DB-104 | Implement `datasets`, `validation_staging`, `validation_logs` | 5h | DBA | DB-102 | Core tables created |
| DB-105 | Implement `audit_logs`, `notifications`, `schedules` | 4h | DBA | DB-102 | Supporting tables |
| DB-106 | Create indexes (users.email, audit_logs.action, etc.) | 2h | DBA | DB-105 | Optimized queries |
| DB-107 | Seed test data (3 users, 5 provinces geometry) | 4h | DBA | DB-106 | Test environment ready |

**Acceptance Criteria**:
- ✅ All tables created with correct constraints
- ✅ PostGIS extension enabled and `provinces_geometry` table populated
- ✅ Can create a user with bcrypt password hash
- ✅ Foreign key relationships enforced

---

#### 1.2 Backend Authentication (32 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| AUTH-101 | Set up FastAPI project structure | 3h | Developer | None | `Backend/app/main.py` |
| AUTH-102 | Implement `POST /auth/login` endpoint | 4h | Developer | AUTH-101 | Login endpoint |
| AUTH-103 | Implement OTP generation (`POST /auth/otp/generate`) | 5h | Developer | AUTH-102 | OTP email sent |
| AUTH-104 | Implement OTP verification (`POST /auth/otp/verify`) | 4h | Developer | AUTH-103 | JWT token issued |
| AUTH-105 | Implement TOTP 2FA setup (`POST /auth/2fa/setup`) | 6h | Developer | AUTH-104 | QR code generation |
| AUTH-106 | Implement TOTP verification (`POST /auth/2fa/verify`) | 5h | Developer | AUTH-105 | 2FA enabled |
| AUTH-107 | Add password change endpoint (`POST /auth/change-password`) | 3h | Developer | AUTH-106 | Password update |
| AUTH-108 | Write unit tests (pytest) for all auth endpoints | 2h | Developer | AUTH-107 | 90% code coverage |

**Acceptance Criteria**:
- ✅ User can log in with email/password → OTP sent to email
- ✅ OTP verification returns JWT token
- ✅ QR code scannable by Google Authenticator
- ✅ 2FA code validates correctly
- ✅ All endpoints return appropriate HTTP status codes

---

#### 1.3 Frontend Authentication UI (28 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| FE-101 | Set up Vite + React 18 project | 3h | Developer | None | Running dev server |
| FE-102 | Install Shadcn UI + Tailwind CSS | 2h | Developer | FE-101 | UI library configured |
| FE-103 | Create Login page (`pages/Login.tsx`) | 5h | Developer | FE-102 | Login form |
| FE-104 | Create OTP Verification page (`pages/OTPVerification.tsx`) | 5h | Developer | FE-103 | OTP input |
| FE-105 | Implement 2FA setup modal with QR code display | 6h | Developer | FE-104 | 2FA modal |
| FE-106 | Create Axios API service (`services/api.ts`) | 4h | Developer | FE-105 | API integration |
| FE-107 | Add French/English language switcher | 3h | Developer | FE-106 | Bilingual UI |

**Acceptance Criteria**:
- ✅ User can complete full auth flow: Login → OTP → Dashboard redirect
- ✅ 2FA setup modal shows QR code and manual secret key
- ✅ Language switcher updates all labels instantly
- ✅ Responsive design works on tablet (min 768px)

---

#### 1.4 Role-Based Dashboard Scaffolding (24 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| UI-101 | Create Analyst Sidebar component | 4h | Developer | FE-107 | Sidebar UI |
| UI-102 | Create Researcher Sidebar component | 3h | Developer | UI-101 | Sidebar UI |
| UI-103 | Create Admin Sidebar component | 3h | Developer | UI-102 | Sidebar UI |
| UI-104 | Create blank dashboard pages (Analyst/Researcher/Admin) | 6h | Developer | UI-103 | 3 dashboard pages |
| UI-105 | Implement role-based routing (React Router) | 5h | Developer | UI-104 | Route protection |
| UI-106 | Add session timeout hook (15 min idle) | 3h | Developer | UI-105 | Auto-logout |

**Acceptance Criteria**:
- ✅ Analyst redirects to `/analyst/dashboard` after login
- ✅ Admin cannot access `/analyst` routes (403 error)
- ✅ Session expires after 15 minutes of inactivity

---

#### 1.5 PWA Configuration (12 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| PWA-101 | Install `vite-plugin-pwa` | 1h | Developer | FE-107 | Plugin installed |
| PWA-102 | Configure Service Worker caching strategy | 5h | Developer | PWA-101 | SW configured |
| PWA-103 | Test offline functionality (cache API responses) | 4h | Developer | PWA-102 | Offline mode works |
| PWA-104 | Add app manifest (`manifest.json`) | 2h | Developer | PWA-103 | Installable PWA |

**Acceptance Criteria**:
- ✅ App loads when offline (cached HTML/CSS/JS)
- ✅ Map tiles cached for offline viewing
- ✅ "Add to Home Screen" prompt appears on mobile

---

### Sprint 1 Deliverables
1. ✅ Working authentication system (OTP + 2FA)
2. ✅ PostgreSQL database with core tables
3. ✅ Role-based dashboards (blank pages)
4. ✅ PWA with offline capability
5. ✅ Bilingual UI (French/English)

**Sprint 1 Demo**:
- Show login flow with OTP email delivery
- Demonstrate 2FA setup with QR code scanning
- Show offline dashboard (cached version)

---

## Sprint 2: Data Cleaning Engine & 95% Quality Gate (Weeks 4-6)

### Sprint Goal
Implement the **data ingestion pipeline** with the **95% Quality Gate**, enabling analysts to upload demographic datasets that are automatically validated and either approved for production or quarantined for cleaning.

### Sprint Duration
**3 weeks** (120 person-hours)

---

### Task Breakdown

#### 2.1 Dataset Upload & Validation (36 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| DS-201 | Implement `POST /datasets/upload` endpoint | 8h | Developer | Sprint 1 complete | Upload API |
| DS-202 | Add file parsing (Excel + CSV) using Pandas | 6h | Developer | DS-201 | File parser |
| DS-203 | Calculate quality metrics (null_count, dupe_count) | 5h | Developer | DS-202 | Quality scorer |
| DS-204 | Implement 95% Quality Gate blocking logic | 7h | Developer | DS-203 | Gate enforcer |
| DS-205 | Insert data into `temporary_storage.validation_staging` | 4h | Developer | DS-204 | Staging populated |
| DS-206 | Migrate approved data to `indicators_data` table | 6h | Developer | DS-205 | Production migration |

**Acceptance Criteria**:
- ✅ Upload returns 200 if quality >= 95%
- ✅ Upload returns 422 if quality < 95%
- ✅ Data < 95% **NOT** in `indicators_data` (blocked)
- ✅ `validation_logs` entry created for all uploads

---

#### 2.2 Data Cleaning Frontend (32 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| UI-201 | Create Data Ingestion page (`analyst/DataImport.tsx`) | 6h | Developer | Sprint 1 UI | Upload page |
| UI-202 | Implement drag-and-drop file upload zone | 5h | Developer | UI-201 | Drag-drop UI |
| UI-203 | Add upload progress bar with quality metrics | 6h | Developer | UI-202 | Progress UI |
| UI-204 | Create Data Cleaning page (`analyst/DataCleaning.tsx`) | 8h | Developer | UI-203 | Cleaning console |
| UI-205 | Display quality gauge (Recharts semi-circle chart) | 5h | Developer | UI-204 | Quality gauge |
| UI-206 | Add "View Error Details" modal with JSON expansion | 2h | Developer | UI-205 | Error modal |

**Acceptance Criteria**:
- ✅ Analyst can drag .xlsx file onto upload zone
- ✅ Progress bar updates in real-time during upload
- ✅ Quality score displayed prominently (colored: red/yellow/green)
- ✅ If <95%, modal shows exact error counts (nulls, dupes)

---

#### 2.3 Diagnostic PDF Report Generation (24 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| RPT-201 | Install `ReportLab` (Python PDF library) | 1h | Developer | DS-206 | PDF library |
| RPT-202 | Create PDF template for data quality report | 6h | Developer | RPT-201 | PDF template |
| RPT-203 | Implement `GET /datasets/{id}/quality-report` endpoint | 7h | Developer | RPT-202 | PDF generation API |
| RPT-204 | Add download button to Data Cleaning page | 4h | Developer | RPT-203 | Download feature |
| RPT-205 | Include visualizations (quality gauge, error tables) in PDF | 6h | Developer | RPT-204 | Enhanced PDF |

**Acceptance Criteria**:
- ✅ PDF includes dataset name, upload date, quality score
- ✅ PDF lists all validation errors (null cells, duplicate rows)
- ✅ PDF downloads with filename `Quality_Report_{dataset_name}.pdf`

---

#### 2.4 Data Health Dashboard (20 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| DASH-201 | Create `GET /analytics/health` endpoint | 5h | Developer | DS-206 | Health API |
| DASH-202 | Create Data Health page (`analyst/DataHealth.tsx`) | 8h | Developer | DASH-201 | Health dashboard |
| DASH-203 | Add IntegrityGauge component (semi-circle Recharts) | 5h | Developer | DASH-202 | Gauge component |
| DASH-204 | Display list of failed datasets (score < 95%) | 2h | Developer | DASH-203 | Failed list |

**Acceptance Criteria**:
- ✅ Dashboard shows overall health score (average across all datasets)
- ✅ Displays count of datasets passing/failing quality gate
- ✅ Gauge is red if overall score < 95%, green if >= 95%

---

#### 2.5 Audit Logging (8 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| AUDIT-201 | Add audit log entries for dataset actions | 4h | Developer | DS-206 | Audit logging |
| AUDIT-202 | Store IP address and JSONB details in `audit_logs` | 4h | Developer | AUDIT-201 | Full audit trail |

**Acceptance Criteria**:
- ✅ Every upload logs `DATASET_UPLOAD` action
- ✅ Quality pass/fail logged as `DATASET_APPROVED` or `QUALITY_GATE_FAILED`
- ✅ JSONB `details` includes filename, score, null/dupe counts

---

### Sprint 2 Deliverables
1. ✅ Dataset upload with 95% Quality Gate enforcement
2. ✅ Data Cleaning Console (Analyst dashboard)
3. ✅ Diagnostic PDF report generation
4. ✅ Data Health Dashboard
5. ✅ Full audit logging

**Sprint 2 Demo**:
- Upload dataset with 87% quality → show rejection modal
- Upload dataset with 98% quality → show approval + migration to production
- Download and review PDF diagnostic report
- Show Data Health Dashboard with overall score

---

## Sprint 3: AI Forecasting & Geospatial Maps (Weeks 7-8)

### Sprint Goal
Integrate **AI forecasting capabilities** (Prophet/XGBoost) and **interactive geospatial maps** (Leaflet.js) to enable demographic projections and provincial visualizations for Chad's 23 provinces.

### Sprint Duration
**2 weeks** (80 person-hours)

---

### Task Breakdown

#### 3.1 Geospatial Map Implementation (28 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| GIS-301 | Populate `provinces_geometry` table with Chad boundaries | 4h | DBA | Sprint 2 complete | GeoJSON data |
| GIS-302 | Implement `GET /analytics/map` endpoint (GeoJSON response) | 6h | Developer | GIS-301 | Map API |
| GIS-303 | Install Leaflet.js + react-leaflet | 2h | Developer | GIS-302 | Map library |
| GIS-304 | Create Geospatial Map page (`researcher/MapView.tsx`) | 8h | Developer | GIS-303 | Map page |
| GIS-305 | Add choropleth layer (color provinces by population) | 5h | Developer | GIS-304 | Choropleth |
| GIS-306 | Add province click → show details panel | 3h | Developer | GIS-305 | Interactive map |

**Acceptance Criteria**:
- ✅ Map displays all 23 Chad provinces with correct boundaries
- ✅ Provinces colored by population density (green → yellow → red)
- ✅ Clicking province shows popup with name, population, area
- ✅ Map tiles cached for offline viewing

---

#### 3.2 AI Forecasting Engine (32 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| ML-301 | Install Prophet + XGBoost libraries | 2h | Developer | Sprint 2 complete | ML libraries |
| ML-302 | Create training script (`app/ml/train_prophet.py`) | 8h | Developer | ML-301 | Prophet model |
| ML-303 | Implement `POST /forecasts/generate` endpoint | 10h | Developer | ML-302 | Forecast API |
| ML-304 | Create Forecast Configurator page (`researcher/ForecastStudio.tsx`) | 8h | Developer | ML-303 | Forecast UI |
| ML-305 | Add forecast results chart (Recharts Line with confidence interval) | 4h | Developer | ML-304 | Results chart |

**Acceptance Criteria**:
- ✅ User can select indicator (Population, GDP), region, and forecast horizon (12-36 months)
- ✅ Backend trains Prophet model on historical data
- ✅ API returns predictions with 95% confidence intervals
- ✅ Chart displays historical data + forecast line + shaded CI

---

#### 3.3 Admin Dashboard (12 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| ADMIN-301 | Create User Management page (`admin/UserManagement.tsx`) | 5h | Developer | Sprint 1 UI | User CRUD |
| ADMIN-302 | Create Audit Log page (`admin/AuditLog.tsx`) | 5h | Developer | ADMIN-301 | Audit viewer |
| ADMIN-303 | Add expandable JSONB details rows | 2h | Developer | ADMIN-302 | JSON expansion |

**Acceptance Criteria**:
- ✅ Admin can create/edit/deactivate users
- ✅ Audit log displays all actions with filters (user, action, date)
- ✅ Clicking row expands JSONB details

---

#### 3.4 Testing & Deployment (8 hours)

| Task ID | Description | Effort | Assignee | Dependencies | Deliverable |
|---------|-------------|--------|----------|--------------|-------------|
| TEST-301 | End-to-end testing (login → upload → forecast) | 4h | Developer | All features complete | Test suite |
| DEPLOY-301 | Deploy to INSEED on-premise server | 3h | DBA | TEST-301 | Production deployment |
| DOC-301 | Create user manual (French + English) | 1h | Developer | DEPLOY-301 | PDF manual |

**Acceptance Criteria**:
- ✅ Application accessible at `https://datavision.inseed.td`
- ✅ All 3 user roles can log in and access respective dashboards
- ✅ Upload, map, and forecast features functional

---

### Sprint 3 Deliverables
1. ✅ Interactive geospatial map (23 Chad provinces)
2. ✅ AI forecasting engine (Prophet/XGBoost)
3. ✅ Admin User Management & Audit Log
4. ✅ Production deployment on INSEED server
5. ✅ User manual (French + English)

**Sprint 3 Demo (Final)**:
- Show choropleth map with province drill-down
- Generate 3-year population forecast for Mayo-Kebbi Est
- Review audit log for all demo activities
- Download forecast results as Excel

---

## Work Breakdown Structure (WBS)

```
DataVision Tchad (100%)
│
├── 1. Foundation & Authentication (37.5%)
│   ├── 1.1 Database Infrastructure (7.5%)
│   ├── 1.2 Backend Authentication (10%)
│   ├── 1.3 Frontend Authentication UI (8.75%)
│   ├── 1.4 Dashboard Scaffolding (7.5%)
│   └── 1.5 PWA Configuration (3.75%)
│
├── 2. Data Cleaning & Quality Gate (37.5%)
│   ├── 2.1 Upload & Validation (11.25%)
│   ├── 2.2 Cleaning Frontend (10%)
│   ├── 2.3 PDF Report Generation (7.5%)
│   ├── 2.4 Data Health Dashboard (6.25%)
│   └── 2.5 Audit Logging (2.5%)
│
└── 3. AI Forecasting & Geospatial (25%)
    ├── 3.1 Geospatial Maps (8.75%)
    ├── 3.2 AI Forecasting Engine (10%)
    ├── 3.3 Admin Dashboard (3.75%)
    └── 3.4 Testing & Deployment (2.5%)
```

---

## Risk Mitigation During Sprints

| Risk | Sprint | Mitigation Strategy |
|------|--------|---------------------|
| **OTP emails not delivered** | Sprint 1 | Test with multiple INSEED email addresses; configure SPF/DKIM records |
| **Quality Gate too strict (no data passes)** | Sprint 2 | Make threshold configurable (admin can adjust 95% → 90%) |
| **Prophet model installation fails on Windows** | Sprint 3 | Use Docker container with pre-installed Prophet |
| **Map tiles require internet** | Sprint 3 | Pre-cache tiles for zoom levels 5-10 during PWA setup |
| **French translations incomplete** | All sprints | Hire French translator for review before each sprint demo |

---

## Definition of Done (DoD)

A task is "Done" when:
- ✅ Code merged to `main` branch
- ✅ Unit tests written and passing (minimum 80% coverage)
- ✅ Tested manually on Firefox and Chrome
- ✅ French translations verified by native speaker
- ✅ Added to release notes document

---

**Document Prepared By**: Antigravity AI for INSEED Chad  
**Review Status**: Pending Project Manager Approval  
**Next Update**: After Sprint 1 retrospective
