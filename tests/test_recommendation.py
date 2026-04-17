# tests/test_recommendation.py
import json
import os
from src.recommendation import make_recommendation, suggest_organic_substitute, load_crop_profile

# simple deterministic input
sample_input = {
    "crop_type": "wheat",
    "soil_type": "loam",
    "region": "regionA",
    "avg_temp": 22.0,
    "rainfall_mm": 200.0,
    "crop_duration_days": 120,
    "soil_N": 15.0,
    "soil_P": 12.0,
    "soil_K": 120.0,
    "pH": 6.5,
    "organic_matter_pct": 2.5,
    "irrigation_type": "irrigated",
    "area_acre": 2.5
}

def test_load_profile():
    p = load_crop_profile("wheat")
    assert isinstance(p, dict)
    # profile should include n_split when using the starter crop_profiles.json
    if p:
        assert "n_split" in p

def test_make_recommendation_basic():
    preds = {"N_kg_ha": 80.0, "P_kg_ha": 30.0, "K_kg_ha": 25.0}
    rec = make_recommendation(preds, sample_input)
    assert "plan" in rec and isinstance(rec["plan"], list)
    # basal entry must exist at day 0
    basal = [e for e in rec["plan"] if e["day"] == 0]
    assert len(basal) == 1
    assert rec["totals"]["N_total_kg_ha"] > 0

def test_suggest_organic_substitute():
    preds = {"N_kg_ha": 80.0, "P_kg_ha": 30.0, "K_kg_ha": 25.0}
    subs = suggest_organic_substitute(preds, sample_input)
    assert "replace_pct" in subs
    assert "N_replace_kg_ha" in subs
