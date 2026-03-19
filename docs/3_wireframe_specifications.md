# DataVision Tchad: UI/UX Wireframe Specifications

**Platform**: INSEED Chad Demographic Analytics & Forecasting  
**Design System**: Shadcn UI + Tailwind CSS  
**Document Version**: 1.0  
**Date**: February 2026  
**Target Users**: Analysts, Researchers, Administrators (INSEED Chad staff)

---

## Executive Summary

This document provides detailed wireframe specifications for the **6 core user interfaces** of DataVision Tchad. All screens are designed with **bilingual support (French/English)**, **RTL-aware layouts**, and **low-bandwidth optimization** for Chad's infrastructure constraints. The design prioritizes accessibility, clarity, and efficiency for statistical professionals working across N'Djamena and regional provinces.

**Design Principles**:
- **Offline-First**: Critical functions work without internet connectivity
- **Mobile-Responsive**: Usable on tablets and smartphones (minimum 768px width)
- **High Contrast**: WCAG AA compliant for readability in bright sunlight
- **Progressive Disclosure**: Complex features hidden behind expandable panels

---

## Screen 1: Secure Login with 2FA/OTP Authentication

### 1.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────┐
│                    INSEED CHAD LOGO                         │
│                                                             │
│           ╔═══════════════════════════════════╗            │
│           ║   DataVision Tchad                ║            │
│           ║   Plateforme d'Analyse            ║            │
│           ║   Démographique                   ║            │
│           ╚═══════════════════════════════════╝            │
│                                                             │
│   ┌─────────────────────────────────────────────┐          │
│   │  Email Address / Adresse E-mail             │          │
│   │  [________________________]                 │          │
│   │  📧                                          │          │
│   └─────────────────────────────────────────────┘          │
│                                                             │
│   ┌─────────────────────────────────────────────┐          │
│   │  Password / Mot de passe                    │          │
│   │  [________________________] 👁               │          │
│   │  🔒                                          │          │
│   └─────────────────────────────────────────────┘          │
│                                                             │
│   [  Se connecter / Login  ]  (Primary Button)             │
│                                                             │
│   ← Back to Home / Retour à l'accueil                      │
│                                                             │
│   🌐 Language: Français | English                          │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 Component Specifications

| Element | Component | Properties | Behavior |
|---------|-----------|------------|----------|
| **Email Input** | Shadcn Input | `type="email"`, `autocomplete="username"` | Validates email format on blur |
| **Password Input** | Shadcn Input + Button | `type="password"`, toggle visibility icon | Shows/hides password on click |
| **Login Button** | Shadcn Button | `variant="default"`, full-width | Disabled if fields empty |
| **Language Switcher** | Custom Toggle | Flags: 🇫🇷 / 🇬🇧 | Updates all UI labels instantly |
| **Back Link** | React Router Link | `to="/"` | Returns to public landing page |

### 1.3 Authentication Flow (Multi-Step)

**Step 1: Credential Validation**
```
User enters email + password
   ↓
Frontend: POST /api/auth/login
   ↓
Backend validates credentials
   ↓
If valid: Show OTP screen
If invalid: Show error "Invalid email or password / Email ou mot de passe invalide"
```

**Step 2: OTP Verification Screen**

```
┌─────────────────────────────────────────────────────────────┐
│              Vérification de sécurité                       │
│              Security Verification                           │
│                                                             │
│   Un code de vérification a été envoyé à:                  │
│   A verification code has been sent to:                     │
│   basharbidjere@gmail.com                                   │
│                                                             │
│   ┌───────────────────────────────────────┐                │
│   │  Enter 6-Digit Code / Code à 6 chiffres│                │
│   │  [___] [___] [___] [___] [___] [___]   │                │
│   └───────────────────────────────────────┘                │
│                                                             │
│   [  Vérifier / Verify  ]                                   │
│                                                             │
│   Didn't receive code? / Code non reçu?                     │
│   [ Resend Code / Renvoyer (Available in 30s) ]            │
│                                                             │
│   ← Back to Login / Retour à la connexion                  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Component Details**:
- **OTP Input**: 6 separate input boxes (auto-focus next on digit entry)
- **Resend Button**: Disabled for 30 seconds after initial send (countdown timer)
- **Backend Call**: `POST /api/auth/otp/verify {email, code}`
- **Success Action**: Redirect to role-based dashboard (`/analyst`, `/researcher`, `/admin`)

**Step 3: 2FA TOTP Setup (Optional - First Login)**

```
┌─────────────────────────────────────────────────────────────┐
│           Activer l'authentification à deux facteurs        │
│           Enable Two-Factor Authentication                   │
│                                                             │
│   Scannez ce QR code avec Google Authenticator:            │
│   Scan this QR code with Google Authenticator:              │
│                                                             │
│        ┌─────────────────┐                                 │
│        │   █████████     │                                 │
│        │   ██ ▄▄▄ ██     │  QR Code (Base64 Image)        │
│        │   ██ ███ ██     │                                 │
│        │   █████████     │                                 │
│        └─────────────────┘                                 │
│                                                             │
│   Secret Key (Manual Entry):                               │
│   JBSWY3DPEHPK3PXP                [Copy 📋]                 │
│                                                             │
│   Enter 6-digit code from app:                             │
│   [________________________]                                │
│                                                             │
│   [  Enable 2FA / Activer 2FA  ]  [ Skip / Passer ]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Screen 2: Main Analytics Dashboard (KPI Overview)

### 2.1 Screen Layout (Analyst/Researcher Role)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [☰ SIDEBAR]  │  DataVision Tchad - Tableau de bord          [🔔] [👤] [🌐] │
│              │                                                               │
│ 🏠 Dashboard │  ┌──────────────┬──────────────┬──────────────┬──────────────┐│
│ 📊 Analytics │  │ Population   │ Birth Rate   │ Mortality    │ Regions      ││
│ 📁 Datasets  │  │ 16,244,513   │ 42.3‰        │ 10.7‰        │ 23           ││
│ 🗺️  Maps     │  │ +2.1% YoY    │ -0.5% YoY    │ -1.2% YoY    │ Provinces    ││
│ 🤖 Forecast  │  │ 👥           │ 👶           │ ⚰️            │ 🗺️           ││
│              │  └──────────────┴──────────────┴──────────────┴──────────────┘│
│              │                                                               │
│              │  ┌─────────────────────────────────────────────────────────┐  │
│              │  │  Filters / Filtres                                      │  │
│              │  │  Year: [2023 ▼]  Province: [All / Tous ▼]  Gender: [All▼]│
│              │  └─────────────────────────────────────────────────────────┘  │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  Population Trend / Tendance de la population           │ │
│              │  │                                                          │ │
│              │  │  18M ┤                                        ●          │ │
│              │  │  16M ┤                               ●                   │ │
│              │  │  14M ┤                      ●                            │ │
│              │  │  12M ┤             ●                                     │ │
│              │  │  10M ┤    ●                                              │ │
│              │  │      └────┴────┴────┴────┴────┴────┴────┴────┴────      │ │
│              │  │      2000  2005  2010  2015  2020  2025                 │ │
│              │  │                                                          │ │
│              │  │  [Recharts Line Chart Component]                        │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌────────────────────┬────────────────────────────────────┐  │
│              │  │ Regional Breakdown │ Recent Activity                    │  │
│              │  │ N'Djamena: 1.6M   │ • Dataset uploaded (2h ago)        │  │
│              │  │ Mayo-Kebbi: 827K  │ • Report generated (5h ago)        │  │
│              │  │ Salamat: 384K     │ • Forecast completed (1d ago)      │  │
│              │  └────────────────────┴────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 2.2 Component Specifications

**KPI Cards (Top Row)**:
| Metric | Data Source | Update Frequency | Visual Indicator |
|--------|-------------|------------------|------------------|
| Population Totale | `indicators_data.value` WHERE `indicator_name='Population'` | Daily | Green ↑ if YoY > 0 |
| Birth Rate (‰) | Calculated from `indicators_data` | Weekly | Trend line sparkline |
| Mortality Rate (‰) | Calculated from `indicators_data` | Weekly | Trend line sparkline |
| Regions Count | `COUNT(DISTINCT region)` | Static (23) | Map icon |

**Interactive Filters**:
- **Year Selector**: Dropdown (`<Select>`) with range 1990-2025
- **Province Filter**: Multi-select dropdown (23 Chad provinces + "All")
- **Gender Filter**: Radio group (Male, Female, All)
- **Filter Behavior**: On change → `GET /api/analytics/dashboard?year={year}&province={province}&gender={gender}`

**Population Trend Chart**:
- **Library**: Recharts `<LineChart>`
- **Data Points**: Last 10 years (annual)
- **Interactivity**: Hover tooltip shows exact population + percentage change
- **Responsive**: Collapses to bar chart on mobile (<768px)

---

## Screen 3: Data Ingestion Portal (Upload & Validation)

### 3.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [☰ SIDEBAR]  │  Upload Dataset / Télécharger des données     [🔔] [👤] [🌐] │
│              │                                                               │
│ 📁 Upload    │  ┌──────────────────────────────────────────────────────────┐ │
│ 🧹 Cleaning  │  │  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │ │
│ 📊 Datasets  │  │  ┃  Drag and drop your Excel or CSV file here         ┃  │ │
│              │  │  ┃  Glissez-déposez votre fichier Excel ou CSV ici    ┃  │ │
│              │  │  ┃                                                     ┃  │ │
│              │  │  ┃               📂 UPLOAD ZONE                        ┃  │ │
│              │  │  ┃                                                     ┃  │ │
│              │  │  ┃  Supported: .xlsx, .xls, .csv (Max 50 MB)          ┃  │ │
│              │  │  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │ │
│              │  │                 OR                                       │ │
│              │  │  [ Browse Files / Parcourir les fichiers ]               │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  Upload Progress / Progression du téléchargement         │ │
│              │  │                                                          │ │
│              │  │  📄 RGPH2024_Mayo-Kebbi.xlsx (3.7 MB)                    │ │
│              │  │                                                          │ │
│              │  │  ████████████████░░░░░░░░ 87%                           │ │
│              │  │                                                          │ │
│              │  │  ⚙️  Validating data quality... (95% Quality Gate)      │ │
│              │  │                                                          │ │
│              │  │  ✅ Schema check: PASSED                                 │ │
│              │  │  ⚠️  NULL values detected: 347 cells                     │ │
│              │  │  ✅ Duplicate rows: 23 (1.5%)                            │ │
│              │  │  🔴 Quality Score: 87.3% (BLOCKED - Requires ≥95%)       │ │
│              │  │                                                          │ │
│              │  │  [  Cancel Upload / Annuler  ]  [  View Report / Voir  ]│ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  Upload History / Historique des téléchargements         │ │
│              │  │  ┌──────────────────────────────────────────────────┐   │ │
│              │  │  │ File                  Date       Status   Score  │   │ │
│              │  │  │ RGPH2023_NDjamena    2026-02-01  ✅ CLEANED  98% │   │ │
│              │  │  │ Census_Salamat       2026-01-28  🔴 REJECTED 82% │   │ │
│              │  │  └──────────────────────────────────────────────────┘   │ │
│              │  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 3.2 Upload Flow & Validation Logic

**Step 1: File Selection**
```javascript
// Frontend validation (immediate)
const allowedExtensions = ['.xlsx', '.xls', '.csv'];
const maxFileSize = 50 * 1024 * 1024; // 50 MB

if (!allowedExtensions.some(ext => file.name.endsWith(ext))) {
  showError("Invalid file type / Type de fichier invalide");
}
if (file.size > maxFileSize) {
  showError("File too large (max 50 MB) / Fichier trop volumineux");
}
```

**Step 2: Upload with Progress Tracking**
```javascript
// Axios upload with progress callback
const formData = new FormData();
formData.append('file', file);

axios.post('/api/datasets/upload', formData, {
  onUploadProgress: (progressEvent) => {
    const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
    setProgress(percentCompleted);
  }
});
```

**Step 3: Real-Time Quality Check Display**

Backend returns:
```json
{
  "dataset_id": 42,
  "quality_score": 87.3,
  "validation_status": "REJECTED",
  "errors": {
    "null_cells": 347,
    "duplicate_rows": 23,
    "total_cells": 185040
  },
  "message": "Quality score below 95% threshold. Data retained in temporary_storage."
}
```

Frontend displays:
- **Quality Gauge**: Semi-circular gauge (Recharts `<RadialBarChart>`)
- **Color Coding**: Red (<95%), Yellow (95-97%), Green (≥97%)
- **Blocking Modal**: If score <95%, show modal with options:
  - "Clean Data in Excel and Re-upload"
  - "View Detailed Error Report (PDF)"
  - "Contact Support"

---

## Screen 4: Geospatial Map View (Provincial Drill-Down)

### 4.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [☰ SIDEBAR]  │  Geospatial Analysis / Analyse Géospatiale    [🔔] [👤] [🌐] │
│              │                                                               │
│ 🗺️  Map View │  ┌──────────────────────────────────────────────────────────┐ │
│ 📊 Heatmap   │  │  Indicator: [Population ▼]  Year: [2023 ▼]              │ │
│ 📍 Provinces │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │                                                          │ │
│              │  │            ╔═══════════════════════════════╗             │ │
│              │  │            ║                               ║             │ │
│              │  │            ║        CHAD MAP               ║             │ │
│              │  │            ║    (Leaflet.js Interactive)   ║             │ │
│              │  │            ║                               ║             │ │
│              │  │  ┌──────┐  ║   🔴 N'Djamena (1.6M)        ║  ┌─────────┐│ │
│              │  │  │Legend│  ║   🟠 Mayo-Kebbi (827K)       ║  │Province ││ │
│              │  │  │      │  ║   🟡 Salamat (384K)          ║  │Details  ││ │
│              │  │  │ 🔴   │  ║   🟢 Batha (274K)            ║  │         ││ │
│              │  │  │ High │  ║                               ║  │Name:    ││ │
│              │  │  │ 🟠   │  ║   [Choropleth Layer]         ║  │Mayo-    ││ │
│              │  │  │ Med  │  ║   [Marker Clusters]          ║  │Kebbi Est││ │
│              │  │  │ 🟡   │  ║                               ║  │         ││ │
│              │  │  │ Low  │  ║                               ║  │Pop:     ││ │
│              │  │  │ 🟢   │  ║                               ║  │827,463  ││ │
│              │  │  │ None │  ║                               ║  │         ││ │
│              │  │  └──────┘  ╚═══════════════════════════════╝  │Density: ││ │
│              │  │                                               │55.4/km² ││ │
│              │  │                                               └─────────┘│ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  Top 5 Provinces by Population / Top 5 provinces         │ │
│              │  │  1. N'Djamena: 1,605,696                                 │ │
│              │  │  2. Mayo-Kebbi Est: 827,463                              │ │
│              │  │  3. Logone Oriental: 779,339                             │ │
│              │  │  4. Ouaddaï: 721,166                                     │ │
│              │  │  5. Moyen-Chari: 598,284                                 │ │
│              │  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.2 Map Implementation Details

**Leaflet.js Configuration**:
```javascript
import { MapContainer, TileLayer, GeoJSON, Marker, Popup } from 'react-leaflet';

<MapContainer center={[15.4542, 18.7322]} zoom={6} style={{ height: '600px' }}>
  {/* Base Map Tiles (Cached for offline) */}
  <TileLayer
url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
    attribution='&copy; OpenStreetMap contributors'
  />
  
  {/* Choropleth Layer - Population Density */}
  <GeoJSON
    data={provincesGeoJSON}
    style={(feature) => ({
      fillColor: getColorByPopulation(feature.properties.population),
      weight: 2,
      color: '#666',
      fillOpacity: 0.7
    })}
    onEachFeature={(feature, layer) => {
      layer.on('click', () => handleProvinceClick(feature.properties));
    }}
  />
  
  {/* Province Markers */}
  {provinces.map(province => (
    <Marker key={province.id} position={[province.lat, province.lon]}>
      <Popup>
        <strong>{province.name}</strong><br/>
        Population: {province.population.toLocaleString()}<br/>
        Area: {province.area_km2} km²
      </Popup>
    </Marker>
  ))}
</MapContainer>
```

**Data Flow**:
1. Frontend: `GET /api/analytics/map?indicator=population&year=2023`
2. Backend queries: `SELECT region, SUM(value) FROM indicators_data JOIN provinces_geometry ON region = province_name`
3. Returns GeoJSON with population values merged into geometry properties
4. Frontend renders choropleth with color scale (green → yellow → red)

**Offline Capability**:
- Map tiles for Chad cached via Service Worker (zoom levels 5-10)
- GeoJSON boundaries stored in IndexedDB (23 provinces, ~2MB)
- Fallback to cached data if API unavailable

---

## Screen 5: AI Forecast Configurator (12-36 Month Predictions)

### 5.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [☰ SIDEBAR]  │  AI Forecasting Studio / Studio de Prévision  [🔔] [👤] [🌐] │
│              │                                                               │
│ 🤖 Forecast  │  ┌──────────────────────────────────────────────────────────┐ │
│ 📊 Results   │  │  Configure Forecast Parameters / Configurer les paramètres│ │
│ 📈 Models    │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌────────────────────┬──────────────────────────────────────┐│
│              │  │ SELECT INDICATOR   │ SELECT MODEL                         ││
│              │  │                    │                                      ││
│              │  │ ○ Population       │ ○ Prophet (Facebook)                 ││
│              │  │ ○ Birth Rate       │   • Trend + Seasonality              ││
│              │  │ ○ Mortality Rate   │   • Handles missing data             ││
│              │  │ ● GDP per Capita   │   • Best for: Long-term trends       ││
│              │  │ ○ Employment Rate  │                                      ││
│              │  │                    │ ● XGBoost (Gradient Boosting)        ││
│              │  │ Region:            │   • Feature engineering              ││
│              │  │ [Mayo-Kebbi ▼]     │   • Non-linear patterns              ││
│              │  │                    │   • Best for: Short-term precision   ││
│              │  │                    │                                      ││
│              │  │                    │ ○ ARIMA (Statistical)                ││
│              │  │                    │   • Classical time series            ││
│              │  └────────────────────┴──────────────────────────────────────┘│
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  PREDICTION HORIZON / HORIZON DE PRÉVISION               │ │
│              │  │                                                          │ │
│              │  │  Start Year: [2024]   End Year: [2027] (36 months)      │ │
│              │  │                                                          │ │
│              │  │  ├────────────────────────────────────┤                 │ │
│              │  │  12                 24                  36 months        │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  ADVANCED SETTINGS (Collapsed by default)                │ │
│              │  │  ▼ Show / Afficher                                       │ │
│              │  │                                                          │ │
│              │  │  Seasonality Mode: [Additive ▼]                          │ │
│              │  │  Growth Type: [Linear ▼]                                 │ │
│              │  │  Confidence Interval: [95% ▼]                            │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  [  Generate Forecast / Générer la prévision  ] (Primary)    │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  FORECAST RESULTS / RÉSULTATS DE PRÉVISION               │ │
│              │  │                                                          │ │
│              │  │  Indicator: GDP per Capita (Mayo-Kebbi Est)              │ │
│              │  │  Model: XGBoost   Confidence: 95%   RMSE: 120.45        │ │
│              │  │                                                          │ │
│              │  │  2500 ┤                                                  │ │
│              │  │  2000 ┤         ●━━━━━━━━━━━━━●━━━━━━━━━●              │ │
│              │  │  1500 ┤    ●                                             │ │
│              │  │  1000 ┤  ●    (Shaded Confidence Interval)              │ │
│              │  │   500 ┤●                                                 │ │
│              │  │       └────┴────┴────┴────┴────┴────┴────┴────          │ │
│              │  │       2020 2021 2022 2023 2024 2025 2026 2027            │ │
│              │  │       ──── Historical  ──── Forecast  ░░ 95% CI         │ │
│              │  │                                                          │ │
│              │  │  [  Export to Excel  ]  [  Save to Database  ]           │ │
│              │  └──────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 API Request/Response Schema (Proposed)

**Request**: `POST /api/forecasts/generate`
```json
{
  "indicator": "GDP_per_capita",
  "region": "Mayo-Kebbi Est",
  "model": "xgboost",
  "start_year": 2024,
  "end_year": 2027,
  "parameters": {
    "seasonality_mode": "additive",
    "growth": "linear",
    "confidence_interval": 0.95
  }
}
```

**Response**:
```json
{
  "forecast_id": 89,
  "indicator": "GDP_per_capita",
  "region": "Mayo-Kebbi Est",
  "model_used": "XGBOOST",
  "predictions": [
    {"year": 2024, "value": 1872.34, "ci_lower": 1752.10, "ci_upper": 1992.58},
    {"year": 2025, "value": 1945.67, "ci_lower": 1810.23, "ci_upper": 2081.11},
    {"year": 2026, "value": 2021.89, "ci_lower": 1871.45, "ci_upper": 2172.33},
    {"year": 2027, "value": 2101.23, "ci_lower": 1935.90, "ci_upper": 2266.56}
  ],
  "model_metrics": {
    "rmse": 120.45,
    "mae": 95.32,
    "r_squared": 0.87
  },
  "generated_at": "2026-02-05T11:00:00+01:00"
}
```

---

## Screen 6: Administrative Audit Log (Full Activity Tracking)

### 6.1 Screen Layout

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ [☰ SIDEBAR]  │  Audit Log / Journal d'audit               [🔔] [👤] [🌐]    │
│              │                                                               │
│ 🔒 Security  │  ┌──────────────────────────────────────────────────────────┐ │
│ 📜 Audit Log │  │  Filters / Filtres                                       │ │
│ 👥 Users     │  │  User: [All ▼]  Action: [All ▼]  Date: [Last 7 days ▼]  │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  RECENT ACTIVITY / ACTIVITÉ RÉCENTE                      │ │
│              │  │  ┌────────────────────────────────────────────────────┐  │ │
│              │  │  │ Time      User          Action            Details  │  │ │
│              │  │  │──────────────────────────────────────────────────  │  │ │
│              │  │  │ 11:23 AM  Dr. Saleh     DATASET_UPLOAD    [▼]     │  │ │
│              │  │  │           (Admin)                         │       │  │ │
│              │  │  │                                            │       │  │ │
│              │  │  │  ┌────────────────────────────────────────────┐   │  │ │
│              │  │  │  │ Details (JSONB Expansion):               │   │  │ │
│              │  │  │  │ {                                        │   │  │ │
│              │  │  │  │   "dataset_id": 42,                      │   │  │ │
│              │  │  │  │   "filename": "RGPH2024.xlsx",           │   │  │ │
│              │  │  │  │   "file_size_mb": 3.7,                   │   │  │ │
│              │  │  │  │   "quality_score": 87.34,                │   │  │ │
│              │  │  │  │   "validation_status": "REJECTED",       │   │  │ │
│              │  │  │  │   "ip_address": "196.168.1.45"           │   │  │ │
│              │  │  │  │ }                                        │   │  │ │
│              │  │  │  └────────────────────────────────────────────┘   │  │ │
│              │  │  │                                                    │  │ │
│              │  │  │ 09:15 AM  Amina Ahmat   LOGIN_SUCCESS     🔐      │  │ │
│              │  │  │           (Analyst)     OTP Verified              │  │ │
│              │  │  │                                                    │  │ │
│              │  │  │ 08:42 AM  Dr. Youssouf  REPORT_GENERATION PDF     │  │ │
│              │  │  │           (Researcher)  Population_2023.pdf        │  │ │
│              │  │  │                                                    │  │ │
│              │  │  │ 07:33 AM  System        FORECAST_GENERATED        │  │ │
│              │  │  │           (Automated)   Prophet Model (GDP)        │  │ │
│              │  │  └────────────────────────────────────────────────────┘  │ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  ┌──────────────────────────────────────────────────────────┐ │
│              │  │  STATISTICS / STATISTIQUES                               │ │
│              │  │  Total Events Today: 127   Failed Logins: 3   Uploads: 8│ │
│              │  └──────────────────────────────────────────────────────────┘ │
│              │                                                               │
│              │  [  Export Log (CSV)  ]  [  Clear Filters  ]                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

### 6.2 Component Specifications

**Audit Log Table**:
- **Data Source**: `GET /api/admin/audit-logs?user_id={id}&action={action}&start_date={date}&end_date={date}`
- **Pagination**: 50 entries per page (infinite scroll)
- **Expandable Rows**: Click `[▼]` to show JSONB `details` formatted as syntax-highlighted JSON
- **Color Coding**:
  - 🟢 Green: Successful actions (LOGIN_SUCCESS, DATASET_APPROVED)
  - 🔴 Red: Failures or critical actions (LOGIN_FAILED, USER_DEACTIVATED)
  - 🟡 Yellow: Warnings (QUALITY_GATE_FAILED, 2FA_DISABLED)

**Real-Time Updates**:
- WebSocket connection (future enhancement) to push live audit events
- Current: Auto-refresh every 30 seconds via polling

---

## Cross-Cutting Concerns

### Responsive Design Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | <768px | Sidebar collapses to hamburger menu, charts switch to bar format |
| Tablet | 768px-1024px | Sidebar remains visible, 2-column grid for cards |
| Desktop | >1024px | Full 3-column layout, sidebar always visible |

### Accessibility (WCAG AA)

- **Keyboard Navigation**: All interactive elements Tab-accessible
- **Screen Readers**: ARIA labels on all icons and charts
- **Color Contrast**: Minimum 4.5:1 ratio for text
- **Focus Indicators**: Visible focus rings on all inputs

### Internationalization

All UI strings use i18n keys:
```javascript
import { useLanguage } from '@/contexts/LanguageContext';
const { t } = useLanguage();

<Button>{t('common_submit')}</Button> // "Submit" / "Soumettre"
```

Translation files: `src/data/translations.ts`

---
