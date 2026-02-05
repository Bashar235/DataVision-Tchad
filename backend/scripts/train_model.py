import pandas as pd
import joblib
import os
from sklearn.linear_model import LinearRegression
from sklearn.ensemble import RandomForestClassifier
from sklearn.cluster import KMeans
from sklearn.preprocessing import StandardScaler

# Paths
current_dir = os.path.dirname(os.path.abspath(__file__))
data_path = os.path.join(current_dir, "data", "synthetic_data.csv")
output_dir = current_dir

def train_models():
    if not os.path.exists(data_path):
        print(f"Data file not found at {data_path}. Please run generate_dummy_data.py first.")
        return

    print("Loading data...")
    df = pd.read_csv(data_path)
    
    # 1. Growth Model (Linear Regression)
    # Predicting Population based on Year
    print("Training Growth Model...")
    X_growth = df[['year']]
    y_growth = df['population']
    growth_model = LinearRegression()
    growth_model.fit(X_growth, y_growth)
    joblib.dump(growth_model, os.path.join(output_dir, "growth_model.pkl"))
    
    # 2. Risk Model (Classification)
    # Predicting Category (Stable/Vulnerable) based on metrics
    print("Training Risk Model...")
    # Map categories to numbers for simplicity if needed, or use label encoder. 
    # RF handles strings in some versions but better to encode.
    df['category_code'] = df['category'].astype('category').cat.codes
    features = ['fertility_rate', 'mortality_rate', 'urbanization_rate', 'gdp_contribution']
    X_risk = df[features]
    y_risk = df['category'] # Keep string for easier readout if using direct supported model or just use RF
    
    risk_model = RandomForestClassifier(n_estimators=100, random_state=42)
    risk_model.fit(X_risk, y_risk)
    joblib.dump(risk_model, os.path.join(output_dir, "risk_model.pkl"))
    
    # 3. Clustering Model (Regional Segmentation)
    print("Training Clustering Model...")
    cluster_features = ['population', 'gdp_contribution', 'urbanization_rate']
    X_cluster = df[cluster_features]
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X_cluster)
    
    kmeans = KMeans(n_clusters=3, random_state=42)
    kmeans.fit(X_scaled)
    
    # Save both model and scaler
    joblib.dump(kmeans, os.path.join(output_dir, "clustering_model.pkl"))
    joblib.dump(scaler, os.path.join(output_dir, "scaler.pkl"))
    
    print("All models trained and saved.")

if __name__ == "__main__":
    train_models()
