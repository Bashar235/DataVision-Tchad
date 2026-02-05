# DataVision Tchad - Backend

This is the FastAPI backend for DataVision Tchad.

## Setup

1. **Install Python 3.11** if not already installed.
2. Create a virtual environment:
   ```bash
   python -m venv venv
   ```
3. Activate the virtual environment:
   - Windows: `venv\Scripts\activate`
   - Mac/Linux: `source venv/bin/activate`
4. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

## Running the App

1. **Train the ML Model** (First time only):
   ```bash
   python -m app.ml.train_model
   ```
   *Note: Ensure you are in the `Backend` directory.*

2. **Start the Server**:
   ```bash
   uvicorn app.main:app --reload
   ```

3. **API Documentation**:
   Open `http://localhost:8000/docs` to see the Swagger UI.

## Structure

- `app/main.py`: Entry point.
- `app/routers/`: API endpoints.
- `app/ml/`: Machine learning models and training scripts.
