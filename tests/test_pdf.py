# tests/test_pdf.py
import os
from src.recommendation import generate_pdf_report
from src.recommendation import make_recommendation, suggest_organic_substitute
from src.recommendation import load_crop_profile

def test_generate_pdf(tmp_path):
    preds = {"N_kg_ha": 80.0, "P_kg_ha": 30.0, "K_kg_ha": 25.0, "yield_kg_ha": 4500.0}
    input_dict = {
        "crop_type": "wheat", "soil_type": "loam", "region": "regionA",
        "avg_temp": 22.0, "rainfall_mm": 200.0, "crop_duration_days": 120,
        "soil_N": 15.0, "soil_P": 12.0, "soil_K": 120.0,"pH":6.5,"organic_matter_pct":2.5,"irrigation_type":"irrigated","area_acre":2.5
    }
    rec = make_recommendation(preds, input_dict)
    shi = {"soil_health_index": 70.0}
    co2 = 500.0
    outfile = tmp_path / "test_report.pdf"
    path = generate_pdf_report(preds, input_dict, rec, shi, co2, out_path=str(outfile))
    assert os.path.exists(path)
    assert os.path.getsize(path) > 1000  # some bytes present
