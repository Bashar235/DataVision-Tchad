# DataVision Tchad

**DataVision Tchad** is a comprehensive data analysis and visualization platform designed for the [INSEED](https://inseed.td) (Institut National de la Statistique, des Études Économiques et Démographiques). It provides specialized dashboards for Analysts, Researchers, and Administrators to monitor, forecast, and visualize Tchad's demographic and economic data.

## 🏗️ Architecture

The project is built as a modern full-stack web application:

*   **Frontend**: A unified **React 18** Single Page Application (SPA) powered by **Vite**. It uses `react-router-dom` for navigation between role-based modules (Analyst, Researcher, Admin).
    *   **UI Library**: Shadcn UI + Tailwind CSS for a premium, responsive design.
    *   **Data Visualization**: Recharts for dynamic, interactive charts.
    *   **State Management**: React Hooks (`useState`, `useEffect`) for real-time reactivity.
*   **Backend**: A high-performance **FastAPI** (Python 3.11) server.
    *   **ML Engine**: Scikit-learn & Pandas for predictive modeling (Linear Regression, Random Forest, K-Means).
    *   **API**: RESTful endpoints serving predictions and aggregated stats.

## 📂 Repository Structure

```
DataVision/
├── frontend/               # React 18 + Vite frontend application
│   ├── src/
│   │   ├── pages/         # Role-based dashboard pages
│   │   ├── components/    # Reusable UI components
│   │   ├── services/      # API integration layer
│   │   └── data/          # Translation and static data
│   ├── package.json
│   └── vite.config.ts
│
├── backend/               # FastAPI backend application
│   ├── app/
│   │   ├── main.py       # Application entry point
│   │   ├── api/          # REST API endpoints
│   │   ├── models/       # Database models
│   │   ├── services/     # Business logic
│   │   └── ml/           # Machine learning modules
│   └── requirements.txt
│
├── docs/                  # Technical documentation
│   ├── 1_architecture_diagram.md
│   ├── 2_database_design.md
│   ├── 3_wireframe_specifications.md
│   ├── 4_api_documentation.md
│   ├── 5_sprint_planning.md
│   ├── 6_risk_register.md
│   └── 7_ethics_compliance.md
│
├── .gitignore            # Git exclusions for both stacks
├── docker-compose.yml    # Container orchestration (placeholder)
└── README.md             # This file
```

> **📚 Documentation:** For detailed technical specifications, architecture diagrams, and implementation guides, see the [`/docs`](./docs/) folder.

## 🚀 Getting Started

### Prerequisites

Before running the application, ensure you have the following installed:

- **Node.js** 18.x or higher ([Download](https://nodejs.org/))
- **Python** 3.9 or higher ([Download](https://www.python.org/))
- **PostgreSQL** 13 or higher ([Download](https://www.postgresql.org/))

### Quick Start

#### 1️⃣ Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173`

#### 2️⃣ Backend Setup

```bash
cd backend

# Create and activate virtual environment (recommended)
python -m venv venv
# On Windows:
.\venv\Scripts\Activate
# On Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start the server
uvicorn app.main:app --reload
```

The API will be available at `http://localhost:8000`

> **💡 Tip:** Run both servers simultaneously in separate terminal windows for full functionality.

---

## 🎯 How to Run (Detailed)

You need **two** terminal windows running simultaneously.

### Terminal 1: Backend (API & ML Model)

1.  Navigate to the Backend directory:
    ```bash
    cd backend
    ```
2.  (Optional) Generate Data & Train Models:
    *If this is your first run, initialize the AI models:*
    ```bash
    # Generate realistic synthetic data
    python -m app.ml.generate_dummy_data

    # Train the prediction models
    python -m app.ml.train_model
    ```
3.  Start the Server:
    ```bash
    uvicorn app.main:app --reload
    ```
    *The API will be live at `http://localhost:8000`*

### Terminal 2: Frontend (User Interface)

1.  Navigate to the Frontend directory:
    ```bash
    cd frontend
    ```
2.  Install Dependencies (if new):
    ```bash
    npm install
    ```
3.  Start the Dev Server:
    ```bash
    npm run dev
    ```
    *The App will be live at `http://localhost:5173` (or similar port shown in terminal)*

## ✨ Key Features by Module

### 1. Analyst Dashboard (`/analyst`)
*   **Target Audience**: Statisticians & Data Scientists.
*   **Core Feature**: **Predictive Analytics**.
    *   Users can adjust "What-If" parameters (Birth Rate, Mortality, Migration).
    *   The frontend sends these live values to the Backend ML model.
    *   The backend recalculates population forecasts on-the-fly.
*   **Functionality**: Data Import, Cleaning Console, Database Management.

### 2. Researcher Dashboard (`/researcher`)
*   **Target Audience**: Policymakers & General Public.
*   **Core Feature**: **Interactive Visualizations**.
    *   Filter data by Region (e.g., N'Djamena, Mayo-Kebbi) and Year.
    *   Visualizes GDP, Employment, and Demographic trends using Area and Bar charts.
    *   **Zero-Click Updates**: Changing a filter instantly refreshes the data without page reloads.

### 3. Admin Dashboard (`/admin`)
*   **Core Feature**: **System Overview**.
*   Monitor API health, active ML models, and recent user activity (downloads, logins).

## 🛠️ Build & Deployment

To build the project for production:

1.  **Frontend Build**:
    ```bash
    cd frontend
    npm run build
    ```
    This creates a static `dist/` folder containing the optimized HTML/CSS/JS.

2.  **Deployment**:
    *   Serve the `dist/` folder using any static host (Nginx, Vercel, Netlify).
    *   Deploy the `backend/` to a Python host (Heroku, AWS EC2, DigitalOcean) and ensure the Frontend can reach the API URL.

---
