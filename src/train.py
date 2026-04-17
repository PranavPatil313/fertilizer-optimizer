# src/train.py
"""
Train script to produce a multi-output model that predicts N,P,K and yield.
Run: python src/train.py
"""
import pandas as pd
import numpy as np
from pathlib import Path

from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.multioutput import MultiOutputRegressor
from xgboost import XGBRegressor
import joblib

from model_utils import save_artifact

def generate_synthetic(n=3000, seed=42):
    rng = np.random.default_rng(seed)
    crops = ["wheat", "maize", "rice", "soybean"]
    soils = ["clay", "silt", "sand", "loam"]
    regions = ["regionA", "regionB", "regionC"]
    irrigation = ["irrigated", "rainfed"]

    rows = []
    for _ in range(n):
        crop = rng.choice(crops)
        soil = rng.choice(soils)
        region = rng.choice(regions)
        irrig = rng.choice(irrigation)
        avg_temp = float(rng.normal(25, 4))
        rainfall_mm = float(abs(rng.normal(200 if irrig=="irrigated" else 100, 80)))
        crop_duration_days = int(rng.integers(90, 140))
        soil_N = float(abs(rng.normal(10, 5)))
        soil_P = float(abs(rng.normal(8, 4)))
        soil_K = float(abs(rng.normal(110, 30)))
        pH = float(np.clip(rng.normal(6.5, 0.8), 4.5, 8.5))
        om = float(abs(rng.normal(2.0, 1.0)))
        # Area in acres (range: 0.25-12.4 acres)
        area_acre = float(np.round(rng.uniform(0.25, 12.4), 2))

        base_req = {"wheat": (80, 30, 30), "maize": (120, 40, 40), "rice": (100, 30, 40), "soybean": (20, 20, 20)}
        baseN, baseP, baseK = base_req[crop]

        deficitN = max(0, baseN - soil_N*3)
        deficitP = max(0, baseP - soil_P*2)
        deficitK = max(0, baseK - soil_K*0.3)

        rain_factor = 1.0 if rainfall_mm>120 else 1.12
        N_need = max(0, baseN * rain_factor + deficitN * 0.8 + rng.normal(0,5))
        P_need = max(0, baseP * rain_factor + deficitP * 0.6 + rng.normal(0,3))
        K_need = max(0, baseK * rain_factor + deficitK * 0.3 + rng.normal(0,4))

        # yield roughly increases with N and soil OM (toy formula)
        yield_kg_ha = max(300, (1500 + (N_need * 18) + (om * 120) + rng.normal(0,300)))

        rows.append({
            "crop_type": crop, "soil_type": soil, "region": region, "avg_temp": avg_temp,
            "rainfall_mm": rainfall_mm, "crop_duration_days": crop_duration_days,
            "soil_N": soil_N, "soil_P": soil_P, "soil_K": soil_K, "pH": pH,
            "organic_matter_pct": om, "irrigation_type": irrig, "area_acre": area_acre,
            "N_kg_ha": float(N_need), "P_kg_ha": float(P_need), "K_kg_ha": float(K_need),
            "yield_kg_ha": float(yield_kg_ha)
        })
    return pd.DataFrame(rows)


def build_preprocessor():
    num_cols = ["avg_temp", "rainfall_mm", "crop_duration_days", "soil_N", "soil_P", "soil_K", "pH", "organic_matter_pct", "area_acre"]
    cat_cols = ["crop_type", "soil_type", "region", "irrigation_type"]

    num_pipe = Pipeline([("imputer", SimpleImputer(strategy="median")), ("scaler", StandardScaler())])
    cat_pipe = Pipeline([( "ohe", OneHotEncoder(handle_unknown='ignore', sparse_output=False))])

    preproc = ColumnTransformer([("num", num_pipe, num_cols), ("cat", cat_pipe, cat_cols)])
    return preproc, num_cols, cat_cols

def train_and_save(n=3000):
    print("Generating synthetic data...")
    df = generate_synthetic(n)
    features = ["crop_type","soil_type","region","avg_temp","rainfall_mm","crop_duration_days",
                "soil_N","soil_P","soil_K","pH","organic_matter_pct","irrigation_type","area_acre"]
    targets = ["N_kg_ha","P_kg_ha","K_kg_ha","yield_kg_ha"]

    X = df[features].copy()
    y = df[targets].copy()

    preproc, num_cols, cat_cols = build_preprocessor()
    print("Fitting preprocessor...")
    Xp = preproc.fit_transform(X)

    print("Training multi-output XGBoost model...")
    xgb = XGBRegressor(objective="reg:squarederror", n_estimators=300, max_depth=6, verbosity=0)
    model = MultiOutputRegressor(xgb)
    model.fit(Xp, y)

    artifact = {
        "preprocessor": preproc,
        "model": model,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "target_cols": targets
    }
    save_artifact(artifact)
    # also save a CSV sample for inspection
    sample_path = Path(__file__).resolve().parent.parent / "data" / "synthetic_sample.csv"
    df.sample(100, random_state=1).to_csv(sample_path, index=False)
    print(f"Saved sample data to {sample_path}")

if __name__ == "__main__":
    train_and_save(3000)
