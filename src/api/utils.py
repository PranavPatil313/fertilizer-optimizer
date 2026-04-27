# src/api/utils.py
from ..model_utils import load_artifact
from ..carbon import compute_co2eq_from_npk
import pandas as pd
import numpy as np

def _prepare_df_from_dict(d: dict, num_cols: list, cat_cols: list):
    # Create a copy to avoid modifying the original
    data = d.copy()
    
    # Conversion factor: 1 acre = 0.404686 hectares
    ACRE_TO_HECTARE = 0.404686
    
    # Check what columns the preprocessor actually expects
    expected_cols = set(num_cols + cat_cols)
    
    # Always work with acres from frontend, convert to hectares if preprocessor expects it
    # If we have area_acre but preprocessor expects area_ha, convert it
    if 'area_acre' in data:
        if 'area_ha' in expected_cols and 'area_acre' not in expected_cols:
            # Convert acres to hectares for the preprocessor
            data['area_ha'] = float(data['area_acre']) * ACRE_TO_HECTARE
            # Remove area_acre since preprocessor doesn't expect it
            del data['area_acre']
        # If preprocessor expects area_acre, keep it as is (no conversion needed)
    
    # ensure columns exist and order isn't required (preprocessor handles it)
    df = pd.DataFrame([data])
    df.columns = [c.strip() for c in df.columns]
    # add missing expected columns as NaN
    for c in num_cols + cat_cols:
        if c not in df.columns:
            df[c] = np.nan
    # reorder not required
    return df

def predict_npk_and_yield(input_dict: dict):
    """
    Predict NPK requirements and yield, with agronomic validation.
    """
    artifact = load_artifact()
    preproc = artifact["preprocessor"]
    models = artifact["model_bundle"]["models"]
    metadata = artifact["metadata"]
    num_cols = metadata.get("num_cols", [])
    cat_cols = metadata.get("cat_cols", [])
    target_cols = metadata.get("targets", ["N_kg_ha", "P_kg_ha", "K_kg_ha", "yield_kg_ha"])

    try:
        df = _prepare_df_from_dict(input_dict, num_cols, cat_cols)
        Xp = preproc.transform(df)
        # Predict using each model for its target
        out = {}
        for target in target_cols:
            if target in models:
                pred = models[target].predict(Xp)[0]
                out[target] = float(pred)
        
        # Agronomic validation: ensure predictions are within reasonable ranges
        # Note: Predictions are in kg/ha (hectares). The preprocessing pipeline converts
        # CSV data from kg/acre to kg/ha during dataset preprocessing (multiply by 2.47105).
        
        # Cap negative predictions to 0
        out["N_kg_ha"] = max(0.0, out.get("N_kg_ha", 0.0))
        out["P_kg_ha"] = max(0.0, out.get("P_kg_ha", 0.0))
        out["K_kg_ha"] = max(0.0, out.get("K_kg_ha", 0.0))
        out["yield_kg_ha"] = max(0.0, out.get("yield_kg_ha", 0.0))
        
        # Agronomic upper bounds - crop-specific yield limits (kg/ha)
        crop_type = str(input_dict.get("crop_type", "")).lower()
        crop_yield_limits = {
            "maize": 20000,      # 20 tons/ha (realistic max for excellent conditions)
            "wheat": 12000,      # 12 tons/ha
            "rice": 15000,       # 15 tons/ha
            "soybean": 6000,     # 6 tons/ha
            "cotton": 5000,      # 5 tons/ha (lint + seed)
            "sugarcane": 120000, # 120 tons/ha (fresh weight)
        }
        # Default to 20 tons/ha if crop not found
        max_yield = crop_yield_limits.get(crop_type, 20000)
        
        # Apply agronomic caps
        out["N_kg_ha"] = min(out["N_kg_ha"], 400.0)   # Cap at 400 kg/ha (very high but possible)
        out["P_kg_ha"] = min(out["P_kg_ha"], 150.0)   # Cap at 150 kg/ha (realistic max)
        out["K_kg_ha"] = min(out["K_kg_ha"], 300.0)   # Cap at 300 kg/ha (realistic max)
        out["yield_kg_ha"] = min(out["yield_kg_ha"], max_yield)  # Crop-specific yield cap
        
        # Apply rainfall-based yield reduction for rainfed crops with insufficient rainfall
        rainfall_mm = float(input_dict.get("rainfall_mm", 0.0))
        irrigation = str(input_dict.get("irrigation_type", "")).lower()
        
        if irrigation == "rainfed":
            # Crop-specific minimum rainfall requirements (mm)
            crop_min_rainfall = {
                "maize": 400,      # Maize needs 400-800mm
                "wheat": 300,      # Wheat needs 300-600mm
                "rice": 1000,      # Rice needs 1000-2000mm (paddy)
                "soybean": 400,    # Soybean needs 400-700mm
                "cotton": 500,     # Cotton needs 500-800mm
                "sugarcane": 1200, # Sugarcane needs 1200-2500mm
            }
            min_rainfall = crop_min_rainfall.get(crop_type, 400)
            
            if rainfall_mm < min_rainfall:
                # Calculate reduction factor based on rainfall deficit
                if rainfall_mm < 50:
                    # Extreme drought: crop failure (0-5% yield)
                    reduction_factor = max(0.0, rainfall_mm / 50.0 * 0.05)
                elif rainfall_mm < 100:
                    # Severe drought: 5-20% yield
                    reduction_factor = 0.05 + (rainfall_mm - 50) / 50.0 * 0.15
                elif rainfall_mm < min_rainfall * 0.5:
                    # Moderate drought: 20-50% yield
                    reduction_factor = 0.20 + (rainfall_mm - 100) / (min_rainfall * 0.5 - 100) * 0.30
                else:
                    # Mild deficit: 50-100% yield
                    reduction_factor = 0.50 + (rainfall_mm - min_rainfall * 0.5) / (min_rainfall * 0.5) * 0.50
                
                out["yield_kg_ha"] = out["yield_kg_ha"] * reduction_factor
                # Also reduce NPK recommendations proportionally (but keep minimum for soil health)
                out["N_kg_ha"] = max(10.0, out["N_kg_ha"] * reduction_factor)
                out["P_kg_ha"] = max(5.0, out["P_kg_ha"] * reduction_factor)
                out["K_kg_ha"] = max(10.0, out["K_kg_ha"] * reduction_factor)
        
        return out
    except (KeyError, ValueError) as e:
        error_msg = str(e)
        # If the error mentions area_ha is missing, try converting area_acre to area_ha
        if 'area_ha' in error_msg and 'area_acre' in input_dict:
            # Retry with area_ha converted from area_acre (1 acre = 0.404686 hectares)
            retry_dict = input_dict.copy()
            ACRE_TO_HECTARE = 0.404686
            retry_dict['area_ha'] = float(retry_dict.pop('area_acre')) * ACRE_TO_HECTARE
            df = _prepare_df_from_dict(retry_dict, num_cols, cat_cols)
            Xp = preproc.transform(df)
            out = {}
            for target in target_cols:
                if target in models:
                    pred = models[target].predict(Xp)[0]
                    out[target] = float(pred)
            return out
        # Better error message for missing columns
        missing_cols = set(num_cols + cat_cols) - set(df.columns if 'df' in locals() else [])
        raise ValueError(f"columns are missing: {missing_cols}. Received columns: {list(input_dict.keys())}")
    except Exception as e:
        # Re-raise with more context
        raise ValueError(f"Prediction error: {str(e)}. Expected columns: {num_cols + cat_cols}")

# Soil Health Index - rule based:
def soil_health_index_calc(input_dict: dict):
    """
    Compute a simple Soil Health Index (0-100) using:
      - pH (optimal 6.0-7.5)
      - organic matter (OM) (higher better)
      - nutrient balance (N,P,K relative to thresholds)
    This is a toy domain-driven function; adjust weights and thresholds for your region.
    """
    pH = float(input_dict.get("pH", 6.5))
    om = float(input_dict.get("organic_matter_pct", 1.5))
    soil_N = float(input_dict.get("soil_N", 5.0))
    soil_P = float(input_dict.get("soil_P", 5.0))
    soil_K = float(input_dict.get("soil_K", 50.0))

    # pH score (0-30)
    if 6.0 <= pH <= 7.5:
        pH_score = 30.0
    else:
        # linear penalty outside optimal
        pH_score = max(0.0, 30.0 - abs(pH - 6.75) * 20.0)

    # OM score (0-30) - assume OM in percentage: desirable >=3%
    om_score = min(30.0, (om / 3.0) * 30.0)

    # nutrient balance: compute deficits relative to simple targets (0-30)
    targetN = 10.0
    targetP = 8.0
    targetK = 100.0
    n_balance = max(0.0, 1.0 - abs(soil_N - targetN) / max(targetN, 1.0))
    p_balance = max(0.0, 1.0 - abs(soil_P - targetP) / max(targetP, 1.0))
    k_balance = max(0.0, 1.0 - abs(soil_K - targetK) / max(targetK, 1.0))
    nutrient_score = (n_balance + p_balance + k_balance) / 3.0 * 30.0

    # combine
    total = pH_score + om_score + nutrient_score
    # normalize to 0-100
    shi = max(0.0, min(100.0, total))
    components = {
        "pH_score": round(pH_score, 2),
        "om_score": round(om_score, 2),
        "nutrient_score": round(nutrient_score, 2)
    }
    return float(round(shi, 2)), components

def compute_carbon_from_plan(plan: dict, factors: dict=None):
    """
    Accepts a plan dict with keys 'N','P','K' (kg/ha) or full names 'N_kg_ha' etc.
    """
    if plan is None:
        raise ValueError("plan dict cannot be None")
    
    # normalize keys
    try:
        if "N" in plan and "P" in plan and "K" in plan:
            N = float(plan["N"]) if plan["N"] is not None else 0.0
            P = float(plan["P"]) if plan["P"] is not None else 0.0
            K = float(plan["K"]) if plan["K"] is not None else 0.0
        else:
            N_val = plan.get("N_kg_ha", 0.0)
            P_val = plan.get("P_kg_ha", 0.0)
            K_val = plan.get("K_kg_ha", 0.0)
            N = float(N_val) if N_val is not None and not (isinstance(N_val, float) and np.isnan(N_val)) else 0.0
            P = float(P_val) if P_val is not None and not (isinstance(P_val, float) and np.isnan(P_val)) else 0.0
            K = float(K_val) if K_val is not None and not (isinstance(K_val, float) and np.isnan(K_val)) else 0.0
        
        # Ensure values are not NaN
        N = 0.0 if np.isnan(N) else N
        P = 0.0 if np.isnan(P) else P
        K = 0.0 if np.isnan(K) else K
        
        return float(compute_co2eq_from_npk(N, P, K, factors))
    except (ValueError, TypeError, KeyError) as e:
        raise ValueError(f"Error processing carbon plan: {str(e)}. Plan keys: {list(plan.keys()) if plan else 'None'}")
