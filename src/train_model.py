# train_model.py
import os
import json
import joblib
import numpy as np
import pandas as pd
from tqdm import tqdm
from datetime import datetime
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import OneHotEncoder, StandardScaler, PolynomialFeatures
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.ensemble import StackingRegressor
import xgboost as xgb
from catboost import CatBoostRegressor
import warnings
warnings.filterwarnings("ignore")

RND = 42
np.random.seed(RND)

# ------------- 1) Synthetic dataset generator -------------
def generate_synthetic_dataset(n=5000, random_state=RND):
    rng = np.random.RandomState(random_state)
    crop_types = ["wheat", "rice", "maize", "soybean", "cotton"]
    soil_types = ["sandy", "loamy", "clay"]
    regions = ["north", "south", "east", "west"]
    irrigation_types = ["rainfed", "drip", "flood", "sprinkler"]

    rows = []
    for _ in range(n):
        crop = rng.choice(crop_types)
        soil = rng.choice(soil_types)
        region = rng.choice(regions)
        irrigation = rng.choice(irrigation_types)

        # Weather / environment
        avg_temp = float(np.round(rng.normal(loc=25, scale=6), 1))  # C
        rainfall = float(np.round(max(0.0, rng.normal(loc=800, scale=300)), 1))  # mm/year

        # Soil chemistry (plausible ranges)
        soil_N = float(np.round(abs(rng.normal(loc=8, scale=4)), 2))   # mg/kg or arbitrary
        soil_P = float(np.round(abs(rng.normal(loc=6, scale=3)), 2))
        soil_K = float(np.round(abs(rng.normal(loc=120, scale=60)), 2))

        pH = float(np.round(rng.normal(loc=6.8 if soil!="sandy" else 6.5, scale=0.6), 2))
        organic_matter_pct = float(np.round(abs(rng.normal(loc=2.5 if soil=="loamy" else 1.5, scale=1.0)), 2))

        crop_duration_days = int(rng.normal(loc=120 if crop=="maize" else 140, scale=20))
        # Area in acres (range: 0.5-12.4 acres)
        area_acre = float(np.round(rng.uniform(0.5, 12.4), 2))

        # True underlying response function for yield: (toy but realistic)
        # yield baseline depends on crop, soil, rainfall, NPK and pH & organic matter
        base_yield = {
            "wheat": 3500,
            "rice": 6000,
            "maize": 7000,
            "soybean": 2500,
            "cotton": 1800
        }[crop]

        # simulate recommended fertilizer amounts as function of deficits
        # Desired: N_target, P_target, K_target depend on crop & yield goal
        N_target = 100 + (base_yield/1000.0)*20  # kg/ha scaling
        P_target = 50 + (base_yield/1000.0)*10
        K_target = 60 + (base_yield/1000.0)*15

        # simple rule: if soil_N low -> need more N, similarly for P,K
        N_need = max(0, N_target - soil_N * 5 + rng.normal(0, 5))
        P_need = max(0, P_target - soil_P * 3 + rng.normal(0, 3))
        K_need = max(0, K_target - soil_K * 0.5 + rng.normal(0, 8))

        # Final yield is affected by NPK applied (simulate as partial saturation)
        # We'll simulate "observed yield" (target) as function below:
        # - better pH near 6.5-7.5 increases yield, OM increases yield
        pH_score = np.exp(-((pH - 6.75)**2) / 0.8)
        om_score = 1.0 + (organic_matter_pct / 5.0)

        # effect of rainfall and irrigation
        rain_effect = 1.0 + (rainfall - 700) / 3000.0
        irrigation_bonus = 1.0 + (0.1 if irrigation in ("drip","sprinkler") else 0.0)

        # yield multiplier from nutrients (saturating function)
        nut_effect = (1 - np.exp(-0.02 * N_need)) * 0.5 + (1 - np.exp(-0.03 * P_need)) * 0.25 + (1 - np.exp(-0.01 * K_need)) * 0.25
        yield_kg_ha = base_yield * pH_score * om_score * rain_effect * irrigation_bonus * (1 + nut_effect)
        # add noise
        yield_kg_ha = float(max(200.0, yield_kg_ha + rng.normal(0, base_yield*0.08)))

        rows.append({
            "crop_type": crop,
            "soil_type": soil,
            "region": region,
            "avg_temp": avg_temp,
            "rainfall_mm": rainfall,
            "crop_duration_days": crop_duration_days,
            "soil_N": soil_N,
            "soil_P": soil_P,
            "soil_K": soil_K,
            "pH": pH,
            "organic_matter_pct": organic_matter_pct,
            "irrigation_type": irrigation,
            "area_acre": area_acre,
            # targets (these are what the API prediction will output)
            "N_kg_ha": float(round(N_need, 2)),
            "P_kg_ha": float(round(P_need, 2)),
            "K_kg_ha": float(round(K_need, 2)),
            "yield_kg_ha": float(round(yield_kg_ha, 2))
        })

    df = pd.DataFrame(rows)
    return df

# ------------- 2) Build preprocessing pipeline -------------
def build_preprocessor(df):
    # Choose categorical and numeric features
    cat_cols = ["crop_type", "soil_type", "region", "irrigation_type"]
    num_cols = ["avg_temp", "rainfall_mm", "crop_duration_days", "soil_N", "soil_P", "soil_K", "pH", "organic_matter_pct", "area_acre"]

    # We will create a small polynomial on pH and organic matter interactions
    poly = Pipeline([
        ("poly", PolynomialFeatures(degree=2, include_bias=False, interaction_only=False))
    ])

    # Preprocessor: scale numeric, one-hot encode categorical
    preprocessor = ColumnTransformer(transformers=[
        ("num", StandardScaler(), num_cols),
        ("cat", OneHotEncoder(handle_unknown="ignore", sparse_output=False), cat_cols)
    ], remainder="drop", sparse_threshold=0)

    return preprocessor, num_cols, cat_cols

# ------------- 3) Build model (stacked ensemble) -------------
def build_model():
    # base learners
    cat = CatBoostRegressor(verbose=0, random_state=RND, iterations=800, depth=6, learning_rate=0.05)
    xgb_model = xgb.XGBRegressor(n_estimators=500, max_depth=6, learning_rate=0.05, random_state=RND, verbosity=0)
    rf  = RandomForestRegressor(n_estimators=300, max_depth=14, random_state=RND, n_jobs=-1)

    estimators = [
        ("catboost", cat),
        ("xgboost", xgb_model),
        ("rf", rf)
    ]

    # meta learner
    stack = StackingRegressor(estimators=estimators, final_estimator=LinearRegression(), n_jobs=-1, passthrough=False)
    return stack

# ------------- 4) Train separate models for each target using same preprocessor -------------
def train_and_save(artifact_dir="artifact", n_samples=5000):
    print("Generating synthetic dataset...")
    df = generate_synthetic_dataset(n=n_samples)

    # features and targets
    FEATURES = ["crop_type","soil_type","region","avg_temp","rainfall_mm","crop_duration_days",
                "soil_N","soil_P","soil_K","pH","organic_matter_pct","irrigation_type","area_acre"]
    TARGETS = ["N_kg_ha", "P_kg_ha", "K_kg_ha", "yield_kg_ha"]

    X = df[FEATURES]
    y = df[TARGETS]

    # build preprocessor
    preprocessor, num_cols, cat_cols = build_preprocessor(df)

    # Split
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.12, random_state=RND)

    # Fit preprocessor on training
    print("Fitting preprocessor...")
    preprocessor.fit(X_train)

    # Transform
    Xtr = preprocessor.transform(X_train)
    Xte = preprocessor.transform(X_test)

    print("Preprocessor output shape (train):", Xtr.shape)

    # train one stacked model per target (you can also multioutput but stacking regressors easier per-target)
    models = {}
    scores = {}
    for target in TARGETS:
        print(f"\nTraining model for target: {target}")
        y_tr = y_train[target].values
        y_te = y_test[target].values

        model = build_model()
        print("Fitting stacked model (this may take a few minutes)...")
        model.fit(Xtr, y_tr)

        # predict & metrics
        yhat = model.predict(Xte)
        mae = mean_absolute_error(y_te, yhat)
        rmse = mean_squared_error(y_te, yhat, squared=False)
        r2 = r2_score(y_te, yhat)
        print(f"{target} -> MAE: {mae:.2f}  RMSE: {rmse:.2f}  R2: {r2:.3f}")

        models[target] = model
        scores[target] = {"mae": float(mae), "rmse": float(rmse), "r2": float(r2)}

    # Save artifacts
    os.makedirs(artifact_dir, exist_ok=True)
    print("\nSaving artifacts...")

    # Save a dict-of-models structure
    model_bundle = {"models": models, "created_at": datetime.utcnow().isoformat()}
    joblib.dump(model_bundle, os.path.join(artifact_dir, "model.pkl"), compress=3)
    joblib.dump(preprocessor, os.path.join(artifact_dir, "preprocessor.pkl"), compress=3)

    metadata = {
        "features": FEATURES,
        "targets": TARGETS,
        "num_cols": num_cols,
        "cat_cols": cat_cols,
        "scores": scores,
        "created_at": datetime.utcnow().isoformat(),
        "notes": "Stacked ensemble: CatBoost + XGBoost + RandomForest; meta=LinearRegression"
    }
    with open(os.path.join(artifact_dir, "metadata.json"), "w") as f:
        json.dump(metadata, f, indent=2)

    print("Artifacts saved to:", os.path.abspath(artifact_dir))
    return artifact_dir, metadata

if __name__ == "__main__":
    artifact_dir = os.path.join(os.path.dirname(__file__), "artifact")
    artifact_dir, metadata = train_and_save(artifact_dir=artifact_dir, n_samples=6000)
    print("\nDone. Metadata summary:")
    print(json.dumps(metadata, indent=2))
