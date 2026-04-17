import os
from typing import Any, Dict, Optional, Tuple

import httpx
from datetime import datetime


WEATHER_API_BASE_URL = "https://api.weatherapi.com/v1/forecast.json"


class WeatherApiError(Exception):
  """Raised when WeatherAPI call fails or returns invalid data."""


def _get_api_key() -> str:
  key = os.getenv("WEATHER_API_KEY")
  if not key:
    # Fail gracefully – caller can decide to skip weather-aware logic.
    raise WeatherApiError("WEATHER_API_KEY environment variable not set.")
  return key


async def fetch_weather_snapshot(location: str) -> Dict[str, Any]:
  """
  Fetch a compact weather snapshot for agronomy logic using WeatherAPI.

  Uses:
    - current: temp_c, humidity, wind_kph, precip_mm
    - forecast (3 days): avg temp, total precip, max wind, max chance_of_rain
  """
  api_key = _get_api_key()

  async with httpx.AsyncClient(timeout=10.0) as client:
    resp = await client.get(
      WEATHER_API_BASE_URL,
      params={
        "key": api_key,
        "q": location,
        "days": 3,
        "aqi": "no",
        "alerts": "no",
      },
    )

  if resp.status_code != 200:
    raise WeatherApiError(
      f"WeatherAPI error {resp.status_code}: {resp.text[:200]}"
    )

  data = resp.json()

  current = data.get("current") or {}
  forecast_days = (data.get("forecast") or {}).get("forecastday") or []

  # Aggregate 3‑day forecast stats
  total_precip_3d = 0.0
  max_wind_3d = 0.0
  temps = []
  max_chance_of_rain = 0

  for day in forecast_days[:3]:
    day_info = day.get("day") or {}
    total_precip_3d += float(day_info.get("totalprecip_mm") or 0.0)
    max_wind_3d = max(max_wind_3d, float(day_info.get("maxwind_kph") or 0.0))
    temps.append(float(day_info.get("avgtemp_c") or 0.0))

    # Scan hourly for worst-case chance_of_rain
    for hour in day.get("hour") or []:
      chance = int(hour.get("chance_of_rain") or 0)
      if chance > max_chance_of_rain:
        max_chance_of_rain = chance

  avg_temp_3d = sum(temps) / len(temps) if temps else None

  snapshot: Dict[str, Any] = {
    "location": data.get("location") or {},
    "current": {
      "temp_c": current.get("temp_c"),
      "humidity": current.get("humidity"),
      "wind_kph": current.get("wind_kph"),
      "precip_mm": current.get("precip_mm"),
    },
    "forecast_3d": {
      "avgtemp_c": avg_temp_3d,
      "totalprecip_mm": total_precip_3d,
      "maxwind_kph": max_wind_3d,
      "max_chance_of_rain": max_chance_of_rain,
    },
    "raw": data,
    "fetched_at": datetime.utcnow().isoformat() + "Z",
  }

  return snapshot


def derive_weather_risk(snapshot: Dict[str, Any], soil_type: str) -> Dict[str, Any]:
  """
  Compute simple agronomic risk indicators from a weather snapshot.
  """
  soil = (soil_type or "").lower()
  forecast = snapshot.get("forecast_3d") or {}
  rain_mm = float(forecast.get("totalprecip_mm") or 0.0)
  max_chance = int(forecast.get("max_chance_of_rain") or 0)
  avgtemp_c = forecast.get("avgtemp_c")
  max_wind = float(forecast.get("maxwind_kph") or 0.0)

  # Simplified classification for soil leaching risk
  light_soils = {"red", "sandy", "sandy loam"}
  medium_soils = {"reddish brown"}

  # ---- Nitrogen leaching risk ----
  n_risk = "low"
  n_adjust_factor = 1.0
  split_topdress = False

  if rain_mm > 40 and soil in light_soils:
    n_risk = "very_high"
    n_adjust_factor = 0.85
    split_topdress = True
  elif rain_mm > 25 and (soil in light_soils or soil in medium_soils):
    n_risk = "high"
    n_adjust_factor = 0.9
    split_topdress = True
  elif rain_mm > 15:
    n_risk = "moderate"
    n_adjust_factor = 0.95

  # ---- Simple yield adjustment factor ----
  rain_factor = 1.0
  if rain_mm < 5:
    rain_factor -= 0.05
  if rain_mm > 40:
    rain_factor -= 0.08

  # ---- Fertilizer timing window (low rain probability) ----
  safe_window_label: Optional[str] = None
  try:
    forecast_days = (snapshot.get("raw") or {}).get("forecast", {}).get("forecastday") or []
    low_rain_days: list[Tuple[datetime, str]] = []

    for day in forecast_days:
      date_str = day.get("date")
      day_info = day.get("day") or {}
      daily_chance = int(day_info.get("daily_chance_of_rain") or 0)
      if daily_chance < 40:
        dt = datetime.fromisoformat(date_str)
        low_rain_days.append((dt, date_str))

    if len(low_rain_days) >= 2:
      # pick first 2 chronological low-rain days
      low_rain_days.sort(key=lambda x: x[0])
      start, end = low_rain_days[0][0], low_rain_days[1][0]
      safe_window_label = f"{start.strftime('%b %d')} – {end.strftime('%b %d')}"
  except Exception:
    safe_window_label = None

  # ---- Weather risk score (0–100) ----
  rain_risk = min(rain_mm / 50.0, 1.0) * 40  # up to 40 points
  wind_risk = min(max_wind / 40.0, 1.0) * 30  # up to 30
  heat_risk = 0.0
  if avgtemp_c is not None:
    if avgtemp_c > 32:
      heat_risk = min((avgtemp_c - 32) / 10.0, 1.0) * 30
  weather_risk_score = round(rain_risk + wind_risk + heat_risk, 1)

  if weather_risk_score < 30:
    risk_band = "Low"
  elif weather_risk_score < 60:
    risk_band = "Moderate"
  else:
    risk_band = "High"

  return {
    "rain_mm_next3d": rain_mm,
    "max_chance_of_rain": max_chance,
    "nitrogen_loss_risk": n_risk,
    "nitrogen_adjust_factor": n_adjust_factor,
    "split_topdress": split_topdress,
    "yield_weather_factor": rain_factor,
    "safe_application_window": safe_window_label,
    "weather_risk_score": weather_risk_score,
    "weather_risk_band": risk_band,
  }

