from fastapi.testclient import TestClient
from src.api.main import app

# Create a test client using your FastAPI app
client = TestClient(app)

def test_read_root():
    """Test that the root endpoint is accessible and returns the correct message."""
    response = client.get("/")
    assert response.status_code == 200
    assert "FertilizerOptimizer prototype running" in response.json()["message"]

def test_weather_preview_missing_params():
    """Test that the weather endpoint correctly rejects requests missing location data."""
    response = client.get("/weather/preview")
    assert response.status_code == 400
    assert "region or lat/lon must be provided" in response.json()["detail"]

def test_unauthorized_recommendation():
    """Test that the recommendation endpoint rejects unauthorized requests."""
    payload = {
        "crop_type": "Wheat",
        "soil_type": "Black",
        "region": "Pune",
        "avg_temp": 25.0,
        "rainfall_mm": 500.0,
        "crop_duration_days": 120,
        "pH": 6.5,
        "organic_matter_pct": 1.5
    }
    response = client.post("/recommend", json=payload)
    assert response.status_code in [401, 403, 422]  # Should fail due to missing auth/keys