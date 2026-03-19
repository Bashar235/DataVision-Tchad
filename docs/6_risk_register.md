# DataVision Tchad: Risk Register & Mitigation Strategies

**Project**: DataVision Tchad - Demographic Modernization Platform  
**Prepared For**: INSEED Chad (Institut National de la Statistique)  
**Document Version**: 1.0  
**Date**: February 2026  
**Risk Assessment Method**: Qualitative (Likelihood × Impact = Risk Score)

---

## Executive Summary

This risk register identifies **6 critical risks** (3 technical, 3 operational) specific to deploying DataVision Tchad in the République du Tchad. Each risk is evaluated based on **likelihood** (Low/Medium/High) and **impact** (Low/Medium/High), with tailored mitigation strategies addressing Chad's unique infrastructure and institutional challenges.

**Risk Severity Scale**:
- 🟢 **Low Risk** (1-3): Monitor, no action required
- 🟡 **Medium Risk** (4-6): Mitigation plan in place
- 🔴 **High Risk** (7-9): Immediate attention required

---

## Technical Risks

### TECH-01: Intermittent Network Connectivity (High Risk 🔴)

**Risk ID**: TECH-01  
**Category**: Infrastructure  
**Risk Owner**: System Administrator

#### Risk Description
Chad's unreliable electrical grid and cellular network infrastructure (especially in provinces like Batha, Salamat, and Lac) will cause **frequent internet disconnections**, preventing analysts from uploading datasets and accessing real-time dashboards.

#### Likelihood & Impact
- **Likelihood**: **HIGH** (90%)
  - Power outages occur 3-5 times per week in regional offices
  - Cellular network uptime in rural areas averages 60-70%
  - Fiber optic connectivity limited to N'Djamena only

- **Impact**: **HIGH**
  - Complete service unavailability during outages
  - Missed data collection deadlines for census projects
  - Frustrated users abandoning platform in favor of Excel
  - Potential data loss if uploads interrupted mid-transfer

**Risk Score**: **9/9** (Critical)

#### Mitigation Strategies

**Primary Mitigation: Offline-First PWA Architecture**
1. **Service Worker Implementation**:
   ```javascript
   // Cache all critical UI assets (HTML, CSS, JS)
   workbox.precaching.precacheAndRoute([
     { url: '/index.html', revision: '1.2.3' },
     { url: '/assets/main.css', revision: '4.5.6' },
   ]);
   
   // Queue failed uploads for retry when online
   workbox.backgroundSync.registerBackgroundSync('upload-queue', {
     maxRetentionTime: 24 * 60 // 24 hours
   });
   ```

2. **IndexedDB Queuing**:
   - Store upload requests in browser IndexedDB when offline
   - Automatically sync to server when connectivity restored
   - Display "Pending Sync" badge showing number of queued uploads

3. **Map Tile Pre-caching**:
   - Cache Leaflet.js tiles for Chad (zoom levels 5-10) during initial app install
   - Store 23 province GeoJSON boundaries in IndexedDB (~2MB)
   - Total cached data: ~50MB per user

**Secondary Mitigation: Data Synchronization Resilience**
- **Exponential Backoff**: Retry failed API calls with delays (1s, 2s, 4s, 8s)
- **Delta Sync**: Only transmit changed records since last successful sync
- **Heartbeat Monitor**: Frontend pings `/api/health` every 60s to detect disconnection
- **Graceful Degradation**: Disable real-time features (notifications, live charts) when offline

**Tertiary Mitigation: Infrastructure Backup**
- **UPS Installation**: Deploy APC Smart-UPS 1500VA (3-hour runtime) at INSEED N'Djamena server
- **4G LTE Failover**: Equip regional offices with 4G USB modems as backup internet
- **Offline Data Kits**: Provide analysts with USB drives containing app installer + 6 months cached data

#### Contingency Plan
If nationwide internet outage lasts > 3 days:
1. Analysts export pending uploads to encrypted USB drives
2. Physical data courier transports USBs to N'Djamena office
3. IT staff manually import data into production database
4. Audit log records manual import with `action: MANUAL_UPLOAD_OFFLINE`

#### Monitoring & Early Warning
- **Metric**: Average uptime per province (tracked in `system_health` table)
- **Threshold**: Alert if any province < 50% uptime over 7 days
- **Dashboard**: Admin panel displays real-time connectivity status per office

---

### TECH-02: Data Integrity & Quality Failures (High Risk 🔴)

**Risk ID**: TECH-02  
**Category**: Data Quality  
**Risk Owner**: Lead Data Analyst

#### Risk Description
Uploaded demographic datasets may contain **systematic errors** (typos, duplicate records, missing values, outliers) that corrupt the production database, leading to inaccurate forecasts and policy decisions based on flawed data.

#### Likelihood & Impact
- **Likelihood**: **MEDIUM** (60%)
  - Manual data entry prone to human error
  - Inconsistent column naming across provinces
  - Excel files from 10+ years ago with outdated schemas

- **Impact**: **HIGH**
  - Incorrect population forecasts mislead policymakers
  - Budget allocations misallocated (healthcare, education)
  - Erosion of trust in INSEED statistical integrity
  - Legal liability if census data published with errors

**Risk Score**: **7/9** (High)

#### Mitigation Strategies

**Primary Mitigation: 95% Quality Gate Enforcement**
1. **Blocking Validation** (Implemented in Sprint 2):
   - All uploads stored in `temporary_storage.validation_staging`
   - Quality score calculated:
     ```python
     total_cells = rows × columns
     valid_cells = total_cells - null_count
     quality_score = (valid_cells / total_cells) * 100
     
     # Deduct points for duplicates
     if dupe_count > 0:
         quality_score -= (dupe_count / row_count) * 10
     ```
   - **If score < 95%**: Data **BLOCKED** from migration to `indicators_data` table
   - Analyst receives detailed error report (PDF + UI modal)

2. **Validation Rules**:
   - **Schema Check**: Verify required columns present (`province`, `year`, `value`)
   - **Data Type Check**: Ensure numeric fields contain only numbers
   - **Range Check**: Flag outliers (e.g., age > 120, GDP < 0)
   - **Referential Integrity**: Verify `province` values match `provinces_geometry` table

3. **Validation Logs**:
   - Every upload creates immutable `validation_logs` entry
   - Stores: `integrity_score`, `null_cells`, `duplicate_rows`, `passed_quality_gate`
   - Enables retrospective audit of all data quality decisions

**Secondary Mitigation: Automated Data Cleaning**
- **NULL Imputation**: Fill missing numeric values with regional median
- **Duplicate Removal**: Auto-delete exact duplicate rows
- **Outlier Correction**: Cap values at 99th percentile (with analyst approval modal)
- **Standardization**: Auto-correct common typos (e.g., "NDjamena" → "N'Djamena")

**Tertiary Mitigation: Human Review Workflow**
- Datasets with 90-94.9% score flagged for **manual review** (not auto-rejected)
- Senior analyst can override Quality Gate with justification (logged to `audit_logs`)
- Monthly data quality review meeting with INSEED leadership

#### Contingency Plan
If production database corrupted due to bad data:
1. Restore from previous day's PostgreSQL backup (daily dumps stored on NAS)
2. Identify corrupted dataset via `audit_logs` → `DATASET_UPLOAD` action
3. Delete affected records from `indicators_data` using `source_file` field
4. Re-upload corrected dataset with quality score >= 95%

#### Monitoring & Early Warning
- **Metric**: Percentage of uploads failing Quality Gate per week
- **Threshold**: Alert if > 30% failure rate (indicates systemic Excel template issues)
- **Dashboard**: Data Health page shows overall integrity score + rejection reasons

---

### TECH-03: AI Model Accuracy & Prediction Reliability (Medium Risk 🟡)

**Risk ID**: TECH-03  
**Category**: Machine Learning  
**Risk Owner**: ML Engineer / Researcher

#### Risk Description
Prophet/XGBoost forecasting models may produce **inaccurate predictions** due to limited historical data (census conducted only every 10 years in Chad), non-stationary population trends (wars, refugee migrations), or model overfitting.

#### Likelihood & Impact
- **Likelihood**: **MEDIUM** (50%)
  - Census data sparse (1993, 2009, 2024 only)
  - COVID-19 pandemic disrupted 2020 demographic trends
  - Climate change driving internal migration (not captured in historical data)

- **Impact**: **MEDIUM**
  - Forecasts deviate significantly from reality (e.g., predict 18M population when actual is 20M)
  - Policymakers lose confidence in AI-generated insights
  - Resource misallocation (infrastructure projects in wrong provinces)

**Risk Score**: **6/9** (Medium)

#### Mitigation Strategies

**Primary Mitigation: Confidence Intervals & Model Validation**
1. **95% Confidence Intervals**:
   - All forecasts include upper/lower bounds (e.g., 18M ± 2M)
   - Frontend displays shaded CI region on charts
   - Training: "Use forecast ranges, not point estimates, for planning"

2. **Cross-Validation**:
   - Train Prophet on 1993-2019 data → validate on 2020-2024 holdout
   - Calculate RMSE (Root Mean Squared Error) and R² score
   - Only deploy model if R² > 0.85 (85% variance explained)

3. **Ensemble Modeling**:
   - Combine Prophet + XGBoost + ARIMA predictions (weighted average)
   - Reduces risk of single model bias
   - Example: `final_prediction = 0.4 * prophet + 0.4 * xgboost + 0.2 * arima`

**Secondary Mitigation: Human-in-the-Loop Validation**
- Researcher reviews forecast before "saving to database"
- Override option if prediction seems unrealistic (e.g., negative population growth)
- Justification required for override (stored in `forecast_results.model_params`)

**Tertiary Mitigation: Regular Model Retraining**
- Retrain models quarterly when new census data available
- Update training scripts in `app/ml/train_prophet.py`
- Version control: Store model files as `prophet_v1.2_2026Q1.pkl`

#### Contingency Plan
If forecast proves highly inaccurate (> 15% error):
1. Mark forecast as `DEPRECATED` in `forecast_results` table
2. Notify all users who downloaded forecast via email
3. Conduct root cause analysis (data quality vs. model choice vs. external shock)
4. Publish correction notice on INSEED website

#### Monitoring & Early Warning
- **Metric**: Compare forecast to actual census counts when available
- **Threshold**: Alert if forecast error > 10% for any province
- **Dashboard**: ML Metrics page showing RMSE, MAE, R² for each model

---

## Operational Risks

### OPS-01: User Adoption Resistance & Change Management (High Risk 🔴)

**Risk ID**: OPS-01  
**Category**: People & Training  
**Risk Owner**: INSEED Director General

#### Risk Description
INSEED analysts accustomed to **manual Excel workflows** may **resist adopting** DataVision Tchad due to fear of technology, lack of training, or preference for familiar processes. Low adoption rates would render the platform ineffective.

#### Likelihood & Impact
- **Likelihood**: **HIGH** (70%)
  - Average analyst age: 45+ years (many not "digital natives")
  - Limited prior experience with web applications
  - Excel muscle memory built over 20 years of work

- **Impact**: **HIGH**
  - Platform underutilized (< 30% adoption rate)
  - Continued manual errors due to Excel usage
  - ₣200M development investment wasted
  - INSEED fails to modernize by 2027 deadline

**Risk Score**: **8/9** (High)

#### Mitigation Strategies

**Primary Mitigation: Comprehensive Training Program**
1. **In-Person Workshops** (N'Djamena + 5 regional capitals):
   - 3-day hands-on training per province (15 analysts/session)
   - Curriculum:
     - Day 1: Login, 2FA setup, dashboard navigation
     - Day 2: Dataset upload, quality gate understanding, error fixing
     - Day 3: Map exploration, forecasting, report generation
   - Delivered in **French** by certified trainer
   - Printed user manual (100 pages) provided to each participant

2. **Video Tutorials**:
   - 15 × 5-minute screencasts covering common tasks
   - Hosted on INSEED intranet (offline-accessible)
   - Subtitles in French + Chadian Arabic (for diversity)

3. **Champion Network**:
   - Identify 1 "tech-savvy" analyst per province as local champion
   - Champions receive advanced training + direct hotline to support team
   - Champions conduct peer training sessions (train-the-trainer model)

**Secondary Mitigation: Bilingual UI & Intuitive Design**
- **French-First Design**: Primary language is French (Chadian national language)
- **Icon-Heavy UI**: Minimize text, use recognizable icons (📂 Upload, 🗺️ Map, 📊 Chart)
- **Tooltips**: Hovering over icons shows explanatory text
- **Progressive Disclosure**: Advanced features hidden until user clicks "Show Advanced"

**Tertiary Mitigation: Incentive Structure**
- **Certification Program**: Issue official INSEED certificate upon completing training
- **Performance Metrics**: Track upload frequency per analyst (visible to supervisors)
- **Recognition**: Quarterly award for "Most Active Data Analyst" (cash prize + public recognition)

#### Contingency Plan
If adoption rate < 40% after 6 months:
1. Conduct anonymous user survey to identify pain points
2. Offer 1-on-1 personalized training sessions (2 hours per analyst)
3. Implement "Excel Import Bridge": Allow analysts to continue using Excel templates that auto-sync to DataVision
4. Escalate to Ministry of Planning for executive mandate requiring platform usage

#### Monitoring & Early Warning
- **Metric**: Unique active users per week (tracked in `audit_logs.user_id`)
- **Threshold**: Alert if < 50% of analysts log in at least once per week
- **Dashboard**: Admin panel shows adoption rate by province + user activity heatmap

---

### OPS-02: Data Governance & Regulatory Compliance (Medium Risk 🟡)

**Risk ID**: OPS-02  
**Category**: Legal & Compliance  
**Risk Owner**: Legal Advisor (INSEED)

#### Risk Description
DataVision Tchad handles **sensitive census microdata** (names, addresses, ethnicity). Inadequate data protection measures could violate **Chad's data protection laws**, **GDPR** (if data shared with EU partners), or **K-Anonymity principles**, leading to legal liability or data breaches.

#### Likelihood & Impact
- **Likelihood**: **MEDIUM** (40%)
  - Chad's data protection framework still evolving (2022 law)
  - Staff may inadvertently export PII-containing datasets
  - External researchers requesting access to raw microdata

- **Impact**: **MEDIUM**
  - Fines from APDP (Autorité de Protection des Données Personnelles) up to ₣50M
  - Reputational damage to INSEED
  - Loss of international partnerships (World Bank, UN)

**Risk Score**: **5/9** (Medium)

#### Mitigation Strategies

**Primary Mitigation: K-Anonymity & PII Masking**
1. **Automated PII Redaction**:
   - Production `indicators_data` table contains **only aggregated data** (no individual records)
   - Raw microdata (names, addresses) stored in **separate secure schema** (`secure_microdata`)
   - Access restricted to Database Administrator only (PostgreSQL role-based permissions)

2. **K-Anonymity Enforcement** (k ≥ 5):
   - Before exporting any dataset, verify each record is indistinguishable from ≥ 4 others
   - Suppression: Remove quasi-identifiers (exact age → age group "25-29")
   - Generalization: Replace specific locations ("Village XYZ") with province-level aggregates

3. **Data Minimization**:
   - API endpoints return only necessary fields
   - Example: `GET /analytics/map` returns `province_name, population_total` (NOT individual births/deaths)

**Secondary Mitigation: Access Control & Audit Logging**
- **Role-Based Access Control (RBAC)**:
  - Administrator: Full access (create users, view audit logs)
  - Analyst: Upload + clean data (cannot access raw microdata)
  - Researcher: View aggregated data + forecasts only (no uploads)
- **Audit Logs**: Every data access logged with `user_id, action, IP address, timestamp`
- **Export Controls**: CSV/Excel exports watermarked with "INSEED Confidential - For Official Use Only"

**Tertiary Mitigation: Compliance Documentation**
- **Privacy Impact Assessment (PIA)**: Document how DataVision handles PII (submitted to APDP)
- **Data Processing Agreement**: Signed between INSEED and all users (acknowledging confidentiality)
- **Regular Audits**: Annual third-party security audit by certified firm

#### Contingency Plan
If data breach occurs (accidental PII exposure):
1. Immediately revoke all user access (disable login API)
2. Forensic analysis: Identify which records exposed + which users accessed
3. Notify APDP within 72 hours (legal requirement)
4. Notify affected individuals if > 100 people impacted
5. Implement corrective measures (e.g., stronger encryption, mandatory 2FA)

#### Monitoring & Early Warning
- **Metric**: Number of `EXPORT_DATA` actions per month (tracked in `audit_logs`)
- **Threshold**: Alert if single user exports > 10 datasets per week (potential data exfiltration)
- **Dashboard**: Security page showing recent exports + user permissions matrix

---

### OPS-03: Long-Term Maintenance & Sustainability (Medium Risk 🟡)

**Risk ID**: OPS-03  
**Category**: Budget & Resources  
**Risk Owner**: INSEED IT Manager

#### Risk Description
After initial deployment, DataVision Tchad requires ongoing **software updates**, **server maintenance**, **technical support**, and **data refreshes**. Insufficient budget allocation or staff turnover could lead to platform degradation and eventual abandonment.

#### Likelihood & Impact
- **Likelihood**: **MEDIUM** (50%)
  - INSEED IT budget fluctuates based on government funding cycles
  - Only 2 IT staff currently employed (risk of knowledge loss if they resign)
  - No formal maintenance contract with external vendor

- **Impact**: **MEDIUM**
  - Security vulnerabilities unpatched (e.g., Postgres CVEs)
  - Data becomes outdated (no census updates after 2024)
  - Platform unusable within 3 years

**Risk Score**: **6/9** (Medium)

#### Mitigation Strategies

**Primary Mitigation: Open-Source Technology Stack**
1. **No Vendor Lock-In**:
   - All technologies are open-source (React, FastAPI, PostgreSQL, Leaflet.js)
   - No licensing fees (sustainable on limited budget)
   - Large community support (Stack Overflow, GitHub issues)

2. **Self-Hosting**:
   - On-premise deployment at INSEED (no cloud subscription fees)
   - Full control over data (no dependency on AWS/Azure)

3. **Documentation**:
   - Comprehensive README.md files for Backend + Frontend
   - Deployment guide (`docs/DEPLOYMENT.md`)
   - Database migration scripts (`Backend/app/db/migrations/`)

**Secondary Mitigation: Knowledge Transfer & Training**
1. **Staff Cross-Training**:
   - Train 2 additional INSEED IT staff on platform architecture
   - Document common troubleshooting procedures (`docs/TROUBLESHOOTING.md`)

2. **External Consultant Retainer**:
   - Annual contract with freelance developer (₣5M/year, ~$8,000 USD)
   - Scope: Quarterly security updates, bug fixes, feature enhancements

3. **Community Engagement**:
   - Open-source code on GitHub (public repository)
   - Engage Chadian developer community for volunteer contributions

**Tertiary Mitigation: Scheduled Maintenance Tasks**
- **Monthly**:
  - PostgreSQL VACUUM to reclaim disk space
  - Review audit logs for suspicious activity
  - Test backup restoration process

- **Quarterly**:
  - Update Python packages (`pip install --upgrade -r requirements.txt`)
  - Update Node.js packages (`npm update`)
  - Review and archive old datasets (> 2 years)

- **Annually**:
  - PostgreSQL major version upgrade
  - Security penetration testing
  - User survey to identify missing features

#### Contingency Plan
If IT budget cut by > 50%:
1. Freeze new feature development (maintenance mode only)
2. Migrate hosting to AWS Free Tier (first 12 months free)
3. Seek donor funding (World Bank, UNICEF) for ₣20M multi-year grant
4. Partner with Chadian university (e.g., Université de N'Djamena) for student intern support

#### Monitoring & Early Warning
- **Metric**: Server uptime percentage (target: 99.5%)
- **Threshold**: Alert if uptime < 95% in any calendar month
- **Dashboard**: System Health page showing disk usage, memory consumption, request latency

---

## Risk Summary Matrix

| Risk ID | Risk Name | Likelihood | Impact | Score | Priority | Owner |
|---------|-----------|------------|--------|-------|----------|-------|
| TECH-01 | Network Connectivity | High | High | 9/9 | 🔴 Critical | Sys Admin |
| TECH-02 | Data Integrity | Medium | High | 7/9 | 🔴 High | Lead Analyst |
| OPS-01 | User Adoption | High | High | 8/9 | 🔴 Critical | Director |
| TECH-03 | AI Model Accuracy | Medium | Medium | 6/9 | 🟡 Medium | ML Engineer |
| OPS-02 | Data Governance | Medium | Medium | 5/9 | 🟡 Medium | Legal Advisor |
| OPS-03 | Maintenance | Medium | Medium | 6/9 | 🟡 Medium | IT Manager |

---

## Escalation Procedures

**Green Risks (Score 1-3)**: Handled by project team, no escalation required  
**Yellow Risks (Score 4-6)**: Escalate to Project Manager + monthly review  
**Red Risks (Score 7-9)**: Escalate to INSEED Director General + weekly review

---
