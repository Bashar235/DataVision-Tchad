# DataVision Tchad: Ethics, Data Handling & Compliance Statement

**Platform**: INSEED Chad Demographic Analytics Platform  
**Custodian**: Institut National de la Statistique, des Études Économiques et Démographiques (INSEED)  
**Document Version**: 1.0  
**Effective Date**: February 2026  
**Review Cycle**: Annual (every February)

---

## 1. Ethical Principles & Commitment

DataVision Tchad is designed to **modernize demographic data analysis** for the République du Tchad while upholding the **highest ethical standards** for data privacy, security, and responsible use. This platform handles sensitive personal information (census microdata, birth records, mortality statistics) and is governed by principles of **data sovereignty**, **transparency**, and **accountability**.

### Core Ethical Commitments

1. **Data Sovereignty**: All data remains within Chad's borders, hosted on INSEED's on-premise infrastructure
2. **Privacy by Design**: K-anonymity and PII redaction built into core architecture
3. **Transparency**: All data processing logic, AI models, and validation rules are auditable
4. **Non-Discrimination**: AI forecasting models monitored for bias against vulnerable populations
5. **Accountability**: Full audit trail of all data access, modifications, and exports

---

## 2. Data Sovereignty & Localization

> [!IMPORTANT]
> **Critical Principle**: Chad's demographic data is a **national strategic asset** and must never be stored on foreign servers or processed by external entities without explicit INSEED authorization.

### On-Premise Hosting Requirements

**Infrastructure Location**:
- **Primary Server**: INSEED Data Center, N'Djamena, Chad
- **Backup Server**: Ministry of Digital Economy Data Center, N'Djamena
- **Database**: PostgreSQL 15.3 (self-hosted, no cloud managed service)
- **No Foreign Cloud Storage**: AWS, Azure, Google Cloud **PROHIBITED** for production data

**Data Residency Compliance**:
- All census microdata stored in `secure_microdata` schema (access restricted to DBA only)
- Aggregated indicators stored in `indicators_data` table (no individual-level records)
- Backups encrypted and stored in fireproof safe on INSEED premises

**Internet Transfer Restrictions**:
- API endpoints return **only aggregated data** (province-level, no individual records)
- Raw census files (Excel/CSV uploads) **never transmitted** to external servers
- Map tiles fetched from OpenStreetMap (cached locally to minimize external requests)

---

## 3. Data Protection & Privacy Measures

### 3.1 K-Anonymity & Statistical Disclosure Control

**K-Anonymity Enforcement** (k ≥ 5):
- Every exported dataset record must be indistinguishable from at least 4 other records
- **Quasi-Identifiers** (combinations that could re-identify individuals) are suppressed or generalized:
  - **Age**: Grouped into 5-year bands (e.g., "25-29" instead of exact age 27)
  - **Location**: Aggregated to province level (no village or commune names)
  - **Ethnicity**: Grouped into broader categories (as per Chad census categories)

**PII Redaction**:
- Names, addresses, phone numbers, national ID numbers **automatically removed** from production tables
- Original microdata with PII stored in separate `secure_microdata` schema:
  - Access restricted to Database Administrator only
  - Requires signed Data Access Agreement + INSEED Director approval
  - All access logged to `audit_logs` with `action: PII_ACCESS`

### 3.2 Encryption

**Data at Rest**:
- PostgreSQL database encrypted using **LUKS full-disk encryption** (AES-256)
- Encryption keys stored in hardware security module (HSM) on separate server
- Backup files encrypted with GPG (4096-bit RSA key)

**Data in Transit**:
- All API communication over **HTTPS** (TLS 1.3)
- SSL certificate from DigiCert (valid until 2028)
- Frontend enforces `strict-transport-security` header (HSTS)

**Password Storage**:
- User passwords hashed with **bcrypt** (cost factor 12, ~300ms per verification)
- OTP secrets stored as salted SHA-256 hashes
- TOTP secrets encrypted with AES-256 before storage

### 3.3 Access Control

**Role-Based Access Control (RBAC)**:

| Role | Permissions | Example Users |
|------|-------------|---------------|
| **Administrator** | Full access (create users, view audit logs, override Quality Gate) | Dr. Mahamat Saleh (Director General) |
| **Analyst** | Upload datasets, clean data, view dashboards | Amina Ahmat (Census Analyst) |
| **Researcher** | View aggregated data, generate forecasts, export reports | Dr. Ibrahim Youssouf (Demographer) |

**Multi-Factor Authentication**:
- **Email OTP**: Required for all initial logins (6-digit code valid 5 minutes)
- **TOTP 2FA**: Strongly encouraged, mandatory for Administrator role
- **Session Timeout**: 15 minutes of inactivity triggers auto-logout

---

## 4. Regulatory Compliance

### 4.1 Chad National Data Protection Law (2022)

DataVision Tchad complies with **Loi n° 007/PR/2022 relative à la protection des données à caractère personnel** (Chad's 2022 Data Protection Law).

**Compliance Measures**:
1. **Data Processing Registry**: Updated quarterly and submitted to APDP (Autorité de Protection des Données Personnelles)
2. **Privacy Impact Assessment (PIA)**: Conducted in January 2026, reviewed annually
3. **Data Protection Officer (DPO)**: Designated contact at INSEED for privacy inquiries (dpo@inseed.td)
4. **Breach Notification**: 72-hour reporting requirement to APDP in case of data breach

**Legal Basis for Processing**:
- **Public Interest**: Statistical analysis required by Chad Constitution (Article 123) for national planning
- **Consent**: All INSEED staff sign Data Processing Agreement acknowledging confidentiality obligations

### 4.2 International Standards Alignment

**GDPR (EU General Data Protection Regulation)**:
- While Chad is not EU member, INSEED collaborates with EU-funded projects (World Bank, AFD)
- DataVision adheres to GDPR principles where applicable:
  - **Right to Access**: Users can request copy of their data via `GET /admin/users/{id}`
  - **Right to Rectification**: Users can update personal details via `PATCH /admin/users/{id}`
  - **Right to Erasure**: Deactivated users flagged `is_active=FALSE` (not permanently deleted for audit compliance)

**ISO/IEC 27001 (Information Security Management)**:
- INSEED pursuing ISO 27001 certification (target: 2027)
- Security controls documented in Information Security Management System (ISMS)

---

## 5. Ethical AI & Responsible Forecasting

### 5.1 Transparency & Explainability

**Model Disclosure**:
- All AI forecasting models (Prophet, XGBoost) are **open-source** and publicly documented
- Training scripts available at `Backend/app/ml/train_prophet.py`
- Model hyperparameters logged in `forecast_results.model_params` (JSONB column)

**Confidence Intervals**:
- All forecasts include **95% confidence intervals** (upper/lower bounds)
- Example: "Population forecast for Mayo-Kebbi Est: 867,890 ± 19,360 (95% CI)"
- Charts display shaded CI region to visualize uncertainty

**Limitations Disclosure**:
- UI includes warning: *"Forecasts are estimates based on historical trends. Actual values may differ due to unforeseen events (wars, pandemics, climate shocks)."*
- Researchers trained to interpret predictions as **ranges**, not exact values

### 5.2 Bias Monitoring & Fairness

**Demographic Equity**:
- Forecasts generated for **all 23 provinces** (no favoritism toward capital N'Djamena)
- Model performance evaluated separately for each province to detect bias
- If RMSE for rural provinces > 2x urban provinces → trigger model retraining

**Vulnerable Population Protection**:
- Forecasts disaggregated by gender to identify gender-specific trends
- Alerts generated if model predicts unrealistic outcomes (e.g., 90% male population in any province)

**Human Oversight**:
- Researcher reviews forecast before saving to database
- Override mechanism allows rejection of implausible predictions (with justification logged)

### 5.3 Responsible Use of Predictions

**Prohibited Uses**:
- ❌ Individual-level predictions (e.g., "Predict lifespan of specific person")
- ❌ Discriminatory policy decisions (e.g., "Deny healthcare funding to province with low forecast growth")
- ❌ Commercial exploitation (e.g., Selling forecast data to insurance companies)

**Approved Uses**:
- ✅ National budget planning (allocate education resources based on youth population forecasts)
- ✅ Infrastructure planning (build clinics in provinces with forecast population growth)
- ✅ Academic research (publish demographic trend analysis in peer-reviewed journals)

---

## 6. User Consent & Data Subject Rights

### 6.1 Informed Consent

**INSEED Staff (Platform Users)**:
- All users sign **Data Processing Agreement** upon account creation
- Agreement covers:
  - Acknowledgment of data confidentiality obligations
  - Prohibition of unauthorized data sharing
  - Agreement to training on data handling best practices

**Census Respondents (Data Subjects)**:
- Census forms include privacy notice explaining:
  - Purpose of data collection (statistical analysis for national planning)
  - Legal basis (Chad Statistics Law)
  - Data retention period (50 years as per INSEED archive policy)
  - Right to refuse participation (with explanation of legal consequences)

### 6.2 Data Subject Rights

**Right to Access**:
- Individuals can request aggregated statistics about their province via public INSEED website
- Individual-level data **not accessible** due to K-anonymity protections

**Right to Rectification**:
- If census respondent identifies error in their record (e.g., wrong birth year), they can submit correction request via support ticket (`POST /support`)
- INSEED verifies correction and updates `secure_microdata` (logged to `audit_logs`)

**Right to Erasure**:
- Limited applicability due to legal obligation to retain census data for 50 years
- If specific record found to be fraudulent (duplicate entry), it is flagged `is_deleted=TRUE` (soft delete)

**Right to Data Portability**:
- Researchers can export aggregated data as CSV/Excel (`GET /analytics/dashboard?format=excel`)
- Individual-level data **not portable** due to privacy protections

---

## 7. Security Protocols & Incident Response

### 7.1 Security Measures

**Network Security**:
- Firewall rules: Only ports 443 (HTTPS) and 5432 (PostgreSQL) open
- IP whitelisting: Database accessible only from INSEED office IPs (196.168.x.x range)
- DDoS protection: Rate limiting (500 requests/minute per IP)

**Application Security**:
- **SQL Injection Prevention**: SQLAlchemy ORM with parameterized queries
- **XSS Prevention**: React escapes all user inputs by default
- **CSRF Protection**: FastAPI CSRF tokens on all POST/PUT/DELETE requests

**Physical Security**:
- Data center locked with biometric access control (fingerprint scanner)
- 24/7 security guard (armed) on INSEED premises
- CCTV recording of all server room entries

### 7.2 Backup & Disaster Recovery

**Backup Schedule**:
- **Daily**: Full PostgreSQL dump (stored on NAS with 30-day retention)
- **Weekly**: Incremental backups (compressed with gzip, ~5GB per week)
- **Monthly**: Offsite backup (encrypted USB drive stored in bank vault)

**Recovery Time Objectives**:
- **RTO (Recovery Time Objective)**: < 4 hours
- **RPO (Recovery Point Objective)**: < 24 hours (maximum data loss)

**Disaster Recovery Plan**:
1. If server failure: Restore from previous day's backup to standby server
2. If data center fire: Retrieve offsite backup from bank vault (monthly snapshot)
3. If nationwide disaster (war, flood): Data distributed to UN peacekeeping mission for safekeeping

### 7.3 Data Breach Response

**Incident Response Team**:
- Team Lead: INSEED Director General
- Technical Lead: Database Administrator
- Legal Advisor: Ministry of Justice representative
- Communications: INSEED Public Affairs Officer

**Breach Response Procedure**:
1. **Detection** (0-1 hour): Anomaly detection via audit logs or user report
2. **Containment** (1-4 hours): Disable compromised accounts, revoke API tokens, isolate affected database tables
3. **Investigation** (4-24 hours): Forensic analysis to determine breach scope, identify root cause, assess data exposed
4. **Notification** (24-72 hours):
   - Notify APDP (legal requirement within 72 hours)
   - Notify affected users via email (if PII exposed)
   - Publish public statement on INSEED website (if > 100 people affected)
5. **Remediation** (1-4 weeks): Patch vulnerabilities, reset all passwords, conduct security audit

**Post-Incident Review**:
- Root cause analysis report submitted to INSEED Board within 30 days
- Update security protocols based on lessons learned
- Offer affected individuals credit monitoring (if financial data exposed)

---

## 8. Data Sharing & Collaboration

### 8.1 Internal Data Sharing (Within INSEED)

**Data Access Levels**:
- **Tier 1 (Public)**: Aggregated province-level statistics (accessible to all INSEED staff)
- **Tier 2 (Restricted)**: Disaggregated data by age/gender (Analyst and Researcher roles only)
- **Tier 3 (Confidential)**: Individual-level microdata with PII (Database Administrator only)

**Access Request Process**:
- Analyst/Researcher submits access request via `POST /admin/access-request`
- INSEED Director reviews request (approval criteria: legitimate statistical purpose)
- Access granted for limited time period (e.g., 30 days for specific project)
- Access logged to `audit_logs` with justification

### 8.2 External Data Sharing (Government Agencies)

**Authorized Recipients**:
- Ministry of Planning & Development (for budget allocation)
- Ministry of Health (for healthcare planning)
- Central Bank of Chad (for economic forecasts)

**Data Sharing Agreement Requirements**:
- Signed MOU (Memorandum of Understanding) with receiving agency
- Specification of data fields to be shared (only aggregated, no PII)
- Purpose limitation clause (data used only for stated purpose)
- Onward sharing prohibition (recipient cannot share with third parties)

**Export Process**:
- External agency submits formal request (signed by Minister)
- INSEED Director approves request
- Data exported via secure SFTP server (encrypted in transit)
- Export logged to `audit_logs` with agency name, data fields, approval date

### 8.3 International Data Sharing (Research Partners)

**Approved Partners**:
- **World Bank**: Population forecasts for Chad Poverty Reduction Strategy
- **WHO**: Mortality statistics for Chad Health Profile
- **UNICEF**: Child demographic data for Education Sector Plan
- **Academic Institutions**: De-identified datasets for peer-reviewed research

**Data Anonymization Requirements**:
- Apply **K-anonymity (k ≥ 10)** for international sharing (stricter than domestic k ≥ 5)
- Remove quasi-identifiers (exact age, precise location, ethnicity)
- Add statistical noise to cell counts < 5 (differential privacy)
- Conduct disclosure risk assessment before export

**Data Use Agreement**:
- Recipient signs legal agreement prohibiting re-identification attempts
- Acknowledgment required in publications: *"Data provided by INSEED Chad"*
- Dataset citation: `INSEED (2024). Chad Demographic Indicators 2015-2023. N'Djamena: INSEED.`

---

## 9. Audit & Accountability

### 9.1 Continuous Audit Logging

**Logged Actions**:
- `LOGIN_SUCCESS`, `LOGIN_FAILED` (all authentication attempts)
- `DATASET_UPLOAD`, `DATASET_APPROVED`, `QUALITY_GATE_FAILED` (data ingestion)
- `FORECAST_GENERATED`, `REPORT_EXPORTED` (analysis activities)
- `USER_CREATED`, `USER_DEACTIVATED`, `2FA_ENABLED` (admin actions)
- `PII_ACCESS` (access to secure_microdata schema)

**Immutable Logs**:
- Audit log entries **cannot be deleted or modified** (enforced by PostgreSQL triggers)
- Entries stored for 7 years (compliance with Chad Statistics Law)
- Logs backed up separately from main database (protection against tampering)

### 9.2 Compliance Audits

**Internal Audits**:
- **Quarterly**: INSEED IT Manager reviews audit logs for anomalies
- **Annually**: INSEED Director conducts comprehensive data governance review

**External Audits**:
- **Biennial**: APDP (Chad Data Protection Authority) compliance audit
- **On-Demand**: Third-party security firm (e.g., CyberClan Africa) penetration testing

**Audit Report Distribution**:
- Summary report shared with INSEED Board of Directors
- Findings with corrective action plan submitted to APDP
- Public summary (non-sensitive) published on INSEED website

---

## 10. Training & Awareness

### 10.1 Mandatory Data Ethics Training

**Target Audience**: All INSEED staff with DataVision access (Administrators, Analysts, Researchers)

**Training Curriculum** (6 hours, bilingual French/English):
1. **Module 1**: Introduction to data privacy principles (K-anonymity, PII, consent)
2. **Module 2**: Chad data protection law (APDP authority, legal penalties)
3. **Module 3**: DataVision security features (2FA, encryption, audit logs)
4. **Module 4**: Ethical AI forecasting (bias, transparency, responsible use)
5. **Module 5**: Case studies (data breaches, ethical dilemmas)
6. **Module 6**: Assessment (passing score 80% required for platform access)

**Refresher Training**:
- Annual 2-hour refresher course (mandatory)
- New staff complete full 6-hour course during onboarding

### 10.2 Data Handling Best Practices

**Do's**:
- ✅ Use strong passwords (min 12 characters, mix of uppercase/lowercase/numbers/symbols)
- ✅ Enable 2FA on all accounts
- ✅ Log out when leaving workstation unattended
- ✅ Report suspicious activity (failed login attempts, unexpected data access)
- ✅ Encrypt USB drives containing census data (VeraCrypt)

**Don'ts**:
- ❌ Share login credentials with colleagues
- ❌ Install DataVision on personal devices (work computers only)
- ❌ Email census datasets (use secure SFTP instead)
- ❌ Discuss PII in public spaces (cafeterias, public transport)
- ❌ Take screenshots of confidential data without blurring PII

---

## 11. Ethical Review & Continuous Improvement

### 11.1 Ethics Review Committee

**Composition**:
- INSEED Director General (Chair)
- Legal Advisor (Ministry of Justice)
- Ethicist (Université de N'Djamena Philosophy Department)
- Civil Society Representative (Chadian Human Rights Organization)
- Technical Representative (Database Administrator)

**Mandate**:
- Review DataVision compliance with ethical principles (quarterly meetings)
- Evaluate new feature proposals for ethical implications
- Investigate user complaints related to data misuse
- Recommend policy updates to INSEED Board

### 11.2 Public Transparency Reports

**Annual Report** (published every January):
- Number of datasets uploaded (with pass/fail rates for Quality Gate)
- Number of forecasts generated (by indicator and province)
- Number of data access requests (internal and external)
- Security incidents (anonymized descriptions)
- Compliance audit findings and corrective actions

**Report Availability**:
- Published on INSEED website (https://inseed.td/transparency)
- Distributed to Ministry of Planning, World Bank, UNDP
- Presented at annual National Statistics Stakeholder Conference

---

## 12. Contact Information

**Data Protection Officer (DPO)**:
- **Name**: [To be appointed]
- **Email**: dpo@inseed.td
- **Phone**: +235 22 52 XX XX
- **Office**: INSEED Headquarters, Avenue Charles de Gaulle, N'Djamena

**Security Incident Reporting**:
- **Email**: security@inseed.td
- **Emergency Hotline**: +235 66 XX XX XX (24/7)

**Data Access Requests**:
- **Email**: data-requests@inseed.td
- **Processing Time**: 15 business days
- **Appeal Process**: Contact APDP (apdp@gouvernement.td)

---

## 13. Document Version History

| Version | Date | Changes | Approved By |
|---------|------|---------|-------------|
| 1.0 | February 2026 | Initial ethics statement | INSEED Director General |
| - | - | - | - |

**Next Review Date**: February 2027

---

**Signature**:

**Dr. Mahamat Saleh**  
*Director General, INSEED Chad*  
*Date: February 5, 2026*

---

**Document Prepared By**: Antigravity AI for INSEED Chad  
**Review Status**: Pending Legal Review by Ministry of Justice  
**Classification**: Public Document (may be shared with external stakeholders)
