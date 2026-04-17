# src/api/main.py

import os
import sys
import logging
import asyncio
import uuid
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder

from .schemas import PlotInput, PredictResponse, SoilHealthResponse, CarbonResponse
from . import utils
from ..recommendation import (
    make_recommendation,
    suggest_organic_substitute,
    generate_pdf_report,
    make_product_blend,
)
from src.logging_config import setup_logging
from src.auth.api_key_auth import api_key_auth


from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

def get_rate_limit_key(request: Request):
    """
    Custom key function for rate limiting.
    In development, exempt localhost from rate limiting.
    """
    ENV = os.environ.get("ENV", "development").lower()
    DEBUG = os.environ.get("DEBUG", "").lower() == "true"
    
    # In development, don't rate limit localhost
    if (ENV == "development" or DEBUG):
        if request.client and request.client.host in ["127.0.0.1", "localhost"]:
            # Return a unique key per request to effectively disable rate limiting for localhost
            return str(uuid.uuid4())
        # Also check the X-Forwarded-For header for localhost in case of proxies
        forwarded_for = request.headers.get("X-Forwarded-For", "")
        if forwarded_for and any(host in forwarded_for for host in ["127.0.0.1", "localhost"]):
            return str(uuid.uuid4())
    
    # In production, use the standard IP-based rate limiting
    return get_remote_address(request)

from src.api.crud import save_plot, save_prediction, save_plot_weather

from src.api.auth import router as auth_router
from src.api.deps import get_current_user_token

from dotenv import load_dotenv
load_dotenv()

# -------------------------------------------------------
# Windows event loop compatibility
# -------------------------------------------------------
if sys.platform.startswith("win"):
    try:
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    except AttributeError:
        pass

# -------------------------------------------------------
# Configuration
# -------------------------------------------------------

# More lenient rate limiting for development
# Check if we're in development mode
ENV = os.environ.get("ENV", "development").lower()
if ENV == "development" or os.environ.get("DEBUG", "").lower() == "true":
    DEFAULT_RATE_LIMIT = "300/minute"  # Much higher for development
else:
    DEFAULT_RATE_LIMIT = "60/minute"  # Production default

RATE_LIMIT = os.environ.get("RATE_LIMIT", DEFAULT_RATE_LIMIT)
limiter = Limiter(key_func=get_rate_limit_key, default_limits=[RATE_LIMIT])

logger = setup_logging()

app = FastAPI(
    title="FertilizerOptimizer API - Secure",
    version="0.5",
    description="API for fertilizer recommendation, soil health analysis, and carbon estimation."
)

# -------------------------------------------------------
# CORS Setup - Must be added before routes
# -------------------------------------------------------
from fastapi.middleware.cors import CORSMiddleware

default_origins = [
    "http://localhost",
    "http://127.0.0.1",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

extra_origins = os.environ.get("CORS_ORIGINS")
if extra_origins:
    default_origins.extend(
        origin.strip()
        for origin in extra_origins.split(",")
        if origin.strip()
    )

# remove duplicates while preserving order
seen = set()
origins = []
for origin in default_origins:
    if origin not in seen:
        origins.append(origin)
        seen.add(origin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# ---- AUTO CREATE TABLES ON STARTUP ----
from sqlalchemy.ext.asyncio import AsyncEngine
from src.db.session import engine
from src.db.models import Base

from src.services.weather import fetch_weather_snapshot, derive_weather_risk, WeatherApiError

@app.on_event("startup")
async def on_startup():
    try:
        async_engine: AsyncEngine = engine
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ DATABASE TABLES CREATED")
    except Exception as e:
        logger.warning(f"⚠️  Database initialization failed (server will continue): {e}")
        print(f"⚠️  Database initialization failed (server will continue): {e}")


app.include_router(auth_router)

# after app.include_router(auth_router)
from src.api.plots import router as plots_router
from src.api.admin import router as admin_router
app.include_router(plots_router)
app.include_router(admin_router)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)


@app.exception_handler(RateLimitExceeded)
async def rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={"error": "Too many requests. Please slow down."}
    )

@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    """Handle HTTP exceptions and ensure CORS headers are included."""
    # Get the origin from the request and check if it's in allowed origins
    origin = request.headers.get("origin")
    if origin and origin in origins:
        cors_origin = origin
    else:
        # Default to first allowed origin or * if no match
        cors_origin = origins[0] if origins else "*"
    
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail},
        headers={
            "Access-Control-Allow-Origin": cors_origin,
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors and return detailed error messages."""
    errors = exc.errors()
    # Try to get the request body for debugging
    try:
        body = await request.body()
        logger.error(f"Validation error on {request.url.path}")
        logger.error(f"Request body: {body.decode('utf-8') if body else 'No body'}")
        logger.error(f"Validation errors: {errors}")
    except Exception as e:
        logger.error(f"Could not read request body: {e}")
        logger.error(f"Validation errors: {errors}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": errors,
            "message": "Validation error: Please check your input data.",
            "body_received": body.decode('utf-8') if 'body' in locals() and body else None
        }
    )


# -------------------------------------------------------
# Routes
# -------------------------------------------------------

@app.get("/")
async def root():
    return {
        "message": (
            "FertilizerOptimizer prototype running. Available endpoints: "
            "/predict, /soil-health, /carbon, /recommend, /report"
        )
    }

# ---------------------- Prediction ----------------------
@app.post("/predict", response_model=PredictResponse)
@limiter.limit(RATE_LIMIT)
async def predict(request: Request, input: PlotInput):
    """Predict NPK and yield based on soil and crop input."""
    try:
        logger.info(f"Received predict request with input: {input.dict()}")
        inp = input.dict()
        preds = utils.predict_npk_and_yield(inp)
        logger.info(f"Predictions generated: {preds}")
        return PredictResponse(**preds)
    except Exception as e:
        logger.exception("Error in /predict endpoint")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------- Soil Health ----------------------
@app.post("/soil-health", response_model=SoilHealthResponse)
@limiter.limit(RATE_LIMIT)
async def soil_health(request: Request, input: PlotInput):
    try:
        shi, comps = utils.soil_health_index_calc(input.dict())
        return SoilHealthResponse(soil_health_index=shi, components=comps)
    except Exception as e:
        logger.exception("Error in /soil-health endpoint")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------- Carbon Estimation ----------------------
@app.post("/carbon", response_model=CarbonResponse)
@limiter.limit(RATE_LIMIT)
async def carbon(request: Request, input: PlotInput):
    try:
        inp = input.dict()
        logger.info(f"Processing carbon request with input: {inp}")
        # First get predictions, then compute carbon from predictions
        preds = utils.predict_npk_and_yield(inp)
        logger.info(f"Predictions generated: {preds}")
        if not preds:
            raise ValueError("No predictions generated from input")
        co2 = utils.compute_carbon_from_plan(preds)
        logger.info(f"Carbon computed: {co2} kg CO2eq/ha")
        return CarbonResponse(co2eq_kg_ha=co2)
    except Exception as e:
        logger.exception(f"Error in /carbon endpoint: {str(e)}")
        logger.error(f"Input received: {input.dict() if hasattr(input, 'dict') else 'N/A'}")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------- Weather Preview (for Create Plot) ----------------------
@app.get("/weather/preview")
@limiter.limit(RATE_LIMIT)
async def weather_preview(
    request: Request,
    region: str | None = None,
    lat: float | None = None,
    lon: float | None = None,
):
    """
    Lightweight endpoint to fetch weather-based defaults for plot creation.

    - If lat/lon are provided, uses them.
    - Else falls back to region string.
    Returns compact defaults plus snapshot and risk summary.
    """
    query: str | None = None
    if lat is not None and lon is not None:
        query = f"{lat},{lon}"
    elif region:
        query = region
    else:
        raise HTTPException(status_code=400, detail="region or lat/lon must be provided")

    try:
        snapshot = await fetch_weather_snapshot(query)
        risk = derive_weather_risk(snapshot, soil_type="")
    except WeatherApiError as we:
        raise HTTPException(status_code=502, detail=f"Weather provider error: {we}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Unexpected weather error: {e}")

    current = snapshot.get("current") or {}
    forecast = snapshot.get("forecast_3d") or {}

    defaults = {
        # Prefer 3‑day average, fall back to current
        "avg_temp": forecast.get("avgtemp_c") or current.get("temp_c"),
        # Use 3‑day total precip as a good proxy for season-start rainfall input
        "rainfall_mm": forecast.get("totalprecip_mm"),
    }

    return {
        "defaults": defaults,
        "snapshot": snapshot,
        "risk": risk,
    }


# ---------------------- Recommendation ----------------------
@app.post("/recommend")
@limiter.limit(RATE_LIMIT)
async def recommend(
    request: Request,
    input: PlotInput,
    authorized: bool = Depends(api_key_auth),
    current_user: dict = Depends(get_current_user_token),
):
    """
    Full recommendation pipeline:
    - Predict NPK & yield  
    - Soil health index  
    - Fertilizer recommendation  
    - Organic substitute  
    - Carbon impact  
    - Store plot + prediction in async DB  
    """
    try:
        inp = input.dict()

        # ML pipeline
        preds = utils.predict_npk_and_yield(inp)
        shi, comps = utils.soil_health_index_calc(inp)

        # Optional weather-aware adjustments
        weather_snapshot = None
        weather_risk = None
        try:
            # Use region as default query; can be replaced with lat/lon later
            location_q = inp.get("region") or inp.get("crop_type")
            if location_q:
                weather_snapshot = await fetch_weather_snapshot(location_q)
                weather_risk = derive_weather_risk(
                    weather_snapshot, soil_type=inp.get("soil_type", "")
                )
        except WeatherApiError as we:
            logger.warning(f"WeatherAPI unavailable, skipping weather-aware logic: {we}")
        except Exception as we:
            logger.warning(f"Unexpected weather integration error: {we}")

        # Yield adjustment using weather factor (if available)
        if weather_risk and "yield_weather_factor" in weather_risk:
            base_yield = preds.get("yield_kg_ha", 0.0)
            yf = float(weather_risk["yield_weather_factor"])
            preds["yield_kg_ha_weather_adjusted"] = base_yield * yf

        # Build base recommendation
        rec = make_recommendation(preds, inp)

        # Weather-aware nitrogen risk adjustment on recommendation plan
        if weather_risk and "nitrogen_adjust_factor" in weather_risk:
            factor = float(weather_risk["nitrogen_adjust_factor"] or 1.0)
            if factor > 0 and factor < 1.0:
                # Scale N in plan and totals
                for evt in rec.get("plan", []):
                    if "N_kg_ha" in evt and isinstance(evt["N_kg_ha"], (int, float)):
                        evt["N_kg_ha"] = round(evt["N_kg_ha"] * factor, 2)
                totals = rec.get("totals") or {}
                if "N_total_kg_ha" in totals:
                    totals["N_total_kg_ha"] = round(
                        float(totals["N_total_kg_ha"]) * factor, 2
                    )
                rec["totals"] = totals

        organic = suggest_organic_substitute(preds, inp)
        blend = make_product_blend(preds, rec)
        co2 = utils.compute_carbon_from_plan(
            {
                "N_kg_ha": blend["supplied_kg_ha"]["N"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("N_kg_ha", 0.0),
                "P_kg_ha": blend["supplied_kg_ha"]["P"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("P_kg_ha", 0.0),
                "K_kg_ha": blend["supplied_kg_ha"]["K"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("K_kg_ha", 0.0),
            }
        )

        # -----------------------------------------
        # Save to database (ASYNC CRUD) - Optional, fail gracefully if DB unavailable
        # -----------------------------------------
        plot_id = None
        prediction_id = None
        try:
            plot = await save_plot(
                user_id=current_user["user_id"],
                data=inp,
                name=f"{inp.get('crop_type', 'Plot')} recommendation"
            )
            plot_id = plot.id

            # Save weather snapshot if available
            if weather_snapshot:
                try:
                    await save_plot_weather(plot_id=plot.id, snapshot=weather_snapshot, risk=weather_risk or {})
                except Exception as we:
                    logger.warning(f"Failed to persist weather snapshot (continuing): {we}")

            prediction = await save_prediction(
                plot_id=plot.id,
                model_version="v1.0",
                result={
                    "preds": preds,
                    "soil_health": {"soil_health_index": shi, "components": comps},
                    "recommendation": rec,
                    "organic_substitute": organic,
                    "fertilizer_blend": blend,
                    "carbon": co2,
                    "weather_snapshot": weather_snapshot,
                    "weather_risk": weather_risk,
                },
            )
            prediction_id = prediction.id
        except Exception as db_error:
            # Database unavailable - log but don't fail the request
            logger.warning(f"Database save failed (continuing without save): {db_error}")

        return {
            "plot_id": plot_id,
            "prediction_id": prediction_id,
            "predictions": preds,
            "soil_health": {"soil_health_index": shi, "components": comps},
            "recommendation": rec,
            "organic_substitute": organic,
            "fertilizer_blend": blend,
            "carbon_kg_ha": co2,
            "weather_snapshot": weather_snapshot,
            "weather_risk": weather_risk,
        }

    except Exception as e:
        logger.exception("Error in /recommend endpoint")
        raise HTTPException(status_code=500, detail=str(e))


# ---------------------- PDF Report ----------------------
@app.post("/report")
@limiter.limit(RATE_LIMIT)
async def report(request: Request, input: PlotInput, authorized: bool = Depends(api_key_auth)):
    """
    Generate a detailed PDF containing:
    - Predictions
    - Soil Health Metrics
    - Recommendations
    - Carbon Analysis
    """
    try:
        inp = input.dict()
        preds = utils.predict_npk_and_yield(inp)
        shi, comps = utils.soil_health_index_calc(inp)
        rec = make_recommendation(preds, inp)
        blend = make_product_blend(preds, rec)
        co2 = utils.compute_carbon_from_plan(
            {
                "N_kg_ha": blend["supplied_kg_ha"]["N"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("N_kg_ha", 0.0),
                "P_kg_ha": blend["supplied_kg_ha"]["P"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("P_kg_ha", 0.0),
                "K_kg_ha": blend["supplied_kg_ha"]["K"]
                if blend and "supplied_kg_ha" in blend
                else preds.get("K_kg_ha", 0.0),
            }
        )

        weather_snapshot = None
        weather_risk = None
        try:
            location_q = inp.get("region") or inp.get("crop_type")
            if location_q:
                weather_snapshot = await fetch_weather_snapshot(location_q)
                weather_risk = derive_weather_risk(
                    weather_snapshot, soil_type=inp.get("soil_type", "")
                )
        except WeatherApiError as we:
            logger.warning(f"WeatherAPI unavailable for report, skipping weather snapshot: {we}")
        except Exception as we:
            logger.warning(f"Unexpected weather integration error in /report: {we}")

        pdf_path = generate_pdf_report(
            preds,
            inp,
            rec,
            {"soil_health_index": shi, "components": comps},
            co2,
            blend,
            {"snapshot": weather_snapshot, "risk": weather_risk},
        )

        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=os.path.basename(pdf_path)
        )

    except Exception as e:
        logger.exception("Error in /report endpoint")
        raise HTTPException(status_code=500, detail=str(e))




# -------------------------------------------------------
# Logging Middleware
# -------------------------------------------------------
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Incoming request: {request.method} {request.url.path}")
    try:
        response = await call_next(request)
        logger.info(f"Completed request: {response.status_code} {request.url.path}")
        return response
    except Exception as e:
        logger.exception(f"Unhandled exception: {e}")
        raise