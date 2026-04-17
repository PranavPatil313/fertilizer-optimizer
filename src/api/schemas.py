# src/api/schemas.py
from pydantic import BaseModel
from typing import Dict

class PlotInput(BaseModel):
    crop_type: str
    soil_type: str 
    region: str
    avg_temp: float
    rainfall_mm: float
    crop_duration_days: int
    soil_N: float
    soil_P: float
    soil_K: float
    pH: float
    organic_matter_pct: float
    irrigation_type: str
    area_acre: float

class PredictResponse(BaseModel):
    N_kg_ha: float
    P_kg_ha: float
    K_kg_ha: float
    yield_kg_ha: float

class SoilHealthResponse(BaseModel):
    soil_health_index: float
    components: Dict[str, float]   # e.g., {"pH_score":.., "om_score":.., "nutrient_balance":..}

class CarbonResponse(BaseModel):
    co2eq_kg_ha: float
