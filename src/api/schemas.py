# src/api/schemas.py
from pydantic import BaseModel, Field
from typing import Dict, List, Optional

class PlotInput(BaseModel):
    plot_name: Optional[str] = None
    crop_type: str
    soil_type: str 
    region: str
    avg_temp: float = Field(..., ge=-20, le=60)
    rainfall_mm: float = Field(..., ge=0)
    crop_duration_days: int = Field(..., ge=1, le=730)
    soil_N: float = Field(..., ge=0)
    soil_P: float = Field(..., ge=0)
    soil_K: float = Field(..., ge=0)
    pH: float = Field(..., ge=0, le=14)
    organic_matter_pct: float = Field(..., ge=0, le=100)
    irrigation_type: str
    area_acre: float = Field(..., gt=0)

class PredictResponse(BaseModel):
    N_kg_ha: float
    P_kg_ha: float
    K_kg_ha: float
    yield_kg_ha: float
    insights: List[str] = []

class SoilHealthResponse(BaseModel):
    soil_health_index: float
    components: Dict[str, float]   # e.g., {"pH_score":.., "om_score":.., "nutrient_balance":..}

class CarbonResponse(BaseModel):
    co2eq_kg_ha: float

class FeedbackInput(BaseModel):
    actual_yield_kg_ha: float
