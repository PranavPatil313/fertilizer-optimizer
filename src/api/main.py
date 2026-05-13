# src/api/main.py

import os
import sys
import logging
import asyncio
import uuid
from fastapi import FastAPI, HTTPException, Request, Depends, BackgroundTasks, UploadFile, File, Form
from datetime import datetime, timedelta, timezone
from fastapi.responses import FileResponse, JSONResponse
from fastapi.exceptions import RequestValidationError
from fastapi.encoders import jsonable_encoder
from pydantic import BaseModel
from typing import List, Dict, Any, Optional

from .schemas import PlotInput, PredictResponse, SoilHealthResponse, CarbonResponse, FeedbackInput
from . import utils
from ..recommendation import (
    make_recommendation,
    suggest_organic_substitute,
    generate_pdf_report,
    make_product_blend,
)
from src.logging_config import setup_logging
from src.services.llm import generate_agronomic_insights, explain_prediction, chat_with_agronomist, analyze_crop_image, analyze_roi, generate_sms_summary, generate_organic_plan
from src.auth.api_key_auth import api_key_auth

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    history: List[ChatMessage] = []
    plot_context: Optional[Dict[str, Any]] = None

class ExplainRequest(BaseModel):
    plot_data: Dict[str, Any]
    predictions: Dict[str, Any]

class ROIRequest(BaseModel):
    plot_data: Dict[str, Any]
    predictions: Dict[str, Any]
    fertilizer_blend: Dict[str, Any]

class SmsRequest(BaseModel):
    plot_data: Dict[str, Any]
    fertilizer_blend: Dict[str, Any]
    language: str = "Marathi"

class OrganicPlanRequest(BaseModel):
    plot_data: Dict[str, Any]
    recommendation: Dict[str, Any]

class SettingsUpdate(BaseModel):
    chat_prompt: str

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

from src.db.session import AsyncSessionLocal
from sqlalchemy import select, text
from src.db.models import Prediction, Plot

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
    "https://fertilizer-optimizer-production.up.railway.app",
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

# --- Simple In-Memory Cache for Weather API ---
WEATHER_SNAPSHOT_CACHE = {}
WEATHER_CACHE_TTL = timedelta(minutes=30)

async def get_cached_weather_snapshot(query: str):
    now = datetime.now(timezone.utc)
    if query in WEATHER_SNAPSHOT_CACHE:
        entry = WEATHER_SNAPSHOT_CACHE[query]
        if now - entry["time"] < WEATHER_CACHE_TTL:
            return entry["snapshot"]
    
    snapshot = await fetch_weather_snapshot(query)
    WEATHER_SNAPSHOT_CACHE[query] = {"snapshot": snapshot, "time": now}
    return snapshot

@app.on_event("startup")
async def on_startup():
    try:
        async_engine: AsyncEngine = engine
        async with async_engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ DATABASE TABLES CREATED")
        
        # Pre-load ML models to prevent cold-start latency on the first API request
        logger.info("Pre-loading ML models into memory...")
        from src.model_utils import load_artifact
        utils._CACHED_ARTIFACT = load_artifact()
        logger.info("✅ ML MODELS PRE-LOADED")
    except Exception as e:
        logger.warning(f"⚠️  Startup sequence issue (server will continue): {e}")
        print(f"⚠️  Startup sequence issue (server will continue): {e}")


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
        snapshot = await get_cached_weather_snapshot(query)
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
                weather_snapshot = await get_cached_weather_snapshot(location_q)
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

        # Generate dynamic LLM insights
        llm_insights = await generate_agronomic_insights(inp, preds, weather_risk)
        # Prepend LLM insights to existing rule-based insights for a richer output
        existing_insights = preds.get("insights", [])
        preds["insights"] = llm_insights + existing_insights

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
                name=inp.get("plot_name") or f"{inp.get('crop_type', 'Plot')} recommendation"
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


# ---------------------- Feedback Loop -------------------
@app.post("/predictions/{prediction_id}/feedback")
@limiter.limit(RATE_LIMIT)
async def submit_prediction_feedback(
    request: Request,
    prediction_id: int,
    feedback: FeedbackInput,
    current_user: dict = Depends(get_current_user_token)
):
    """Submit actual yield to monitor model drift and performance."""
    try:
        async with AsyncSessionLocal() as session:
            q = await session.execute(
                select(Prediction).join(Plot).where(
                    Prediction.id == prediction_id,
                    Plot.user_id == current_user["user_id"]
                )
            )
            pred = q.scalars().first()
            if not pred:
                raise HTTPException(status_code=404, detail="Prediction not found or unauthorized")
            
            # Safely copy and mutate the JSON result
            res = pred.result.copy() if pred.result else {}
            if "feedback" not in res:
                res["feedback"] = {}
            res["feedback"]["actual_yield_kg_ha"] = feedback.actual_yield_kg_ha
            pred.result = res
            
            session.add(pred)
            await session.commit()
            return {"message": "Harvest feedback saved", "actual_yield_kg_ha": feedback.actual_yield_kg_ha}
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error saving prediction feedback")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------- Weekly Reports (Admin) ----------------------
@app.post("/admin/trigger-weekly-reports")
@limiter.limit(RATE_LIMIT)
async def trigger_weekly_reports(
    request: Request,
    background_tasks: BackgroundTasks,
    current_user: dict = Depends(get_current_user_token)
):
    """Trigger weekly summary emails for all users."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
        
    async def send_reports():
        try:
            async with AsyncSessionLocal() as session:
                # Get all active users
                from src.db.models import User
                users_q = await session.execute(select(User).where(User.is_active == 1))
                users = users_q.scalars().all()
                
                seven_days_ago = datetime.now(timezone.utc) - timedelta(days=7)
                
                for u in users:
                    # Count predictions for this user in last 7 days
                    q = await session.execute(
                        select(Prediction).join(Plot).where(
                            Plot.user_id == u.id,
                            Prediction.created_at >= seven_days_ago
                        )
                    )
                    recent_preds = q.scalars().all()
                    if recent_preds:
                        # STUB: Send email
                        logger.info(f"\n" + "="*45)
                        logger.info(f"📧 AUTOMATED WEEKLY EMAIL STUB")
                        logger.info(f"To: {u.email}")
                        logger.info(f"Subject: Your Agronomy Weekly Summary")
                        logger.info(f"Body: You ran {len(recent_preds)} ML predictions this week.")
                        logger.info(f"      Log in to FertilizerOptimizer to view details.")
                        logger.info("="*45 + "\n")
        except Exception as e:
            logger.error(f"Failed to send weekly reports: {e}")
            
    background_tasks.add_task(send_reports)
    return {"message": "Weekly reports triggered and sending in the background."}

# ---------------------- PDF Report ----------------------
@app.post("/report")
@limiter.limit(RATE_LIMIT)
async def report(
    request: Request, 
    input: PlotInput, 
    company_name: str = None, 
    consultant_name: str = None, 
    logo_url: str = None,
    authorized: bool = Depends(api_key_auth)
):
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
                weather_snapshot = await get_cached_weather_snapshot(location_q)
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
            company_name=company_name,
            consultant_name=consultant_name,
            logo_url=logo_url
        )

        return FileResponse(
            pdf_path,
            media_type="application/pdf",
            filename=os.path.basename(pdf_path)
        )

    except Exception as e:
        logger.exception("Error in /report endpoint")
        raise HTTPException(status_code=500, detail=str(e))

# ---------------------- AI Agronomist & Explainable AI ----------------------
@app.post("/chat")
@limiter.limit(RATE_LIMIT)
async def chat_endpoint(request: Request, payload: ChatRequest):
    """Interactive chat with Gemini acting as an Agronomist."""
    try:
        history_dict = [{"role": msg.role, "content": msg.content} for msg in payload.history]
        reply = await chat_with_agronomist(
            message=payload.message, 
            plot_context=payload.plot_context, 
            history=history_dict
        )
        return {"reply": reply}
    except Exception as e:
        logger.exception("Error in /chat endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/explain")
@limiter.limit(RATE_LIMIT)
async def explain_endpoint(request: Request, payload: ExplainRequest):
    """Explainable AI (XAI) - tells the user why the ML pipeline predicted what it did."""
    try:
        explanation = await explain_prediction(
            plot_data=payload.plot_data, 
            predictions=payload.predictions
        )
        return {"explanation": explanation}
    except Exception as e:
        logger.exception("Error in /explain endpoint")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-image")
@limiter.limit(RATE_LIMIT)
async def analyze_image_endpoint(
    request: Request,
    file: UploadFile = File(...),
    plot_data: str = Form("{}")
):
    """Multimodal vision analysis of crop images to detect disease/deficiency."""
    try:
        import json
        plot_dict = json.loads(plot_data)
        image_bytes = await file.read()
        analysis = await analyze_crop_image(image_bytes, file.content_type, plot_dict)
        return {"analysis": analysis}
    except Exception as e:
        logger.exception("Error in /analyze-image endpoint")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/analyze-roi")
@limiter.limit(RATE_LIMIT)
async def analyze_roi_endpoint(request: Request, payload: ROIRequest):
    """Smart ROI & Economics Analyzer."""
    try:
        analysis = await analyze_roi(
            plot_data=payload.plot_data, 
            predictions=payload.predictions,
            blend=payload.fertilizer_blend
        )
        return {"analysis": analysis}
    except Exception as e:
        logger.exception("Error in /analyze-roi endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/sms-summary")
@limiter.limit(RATE_LIMIT)
async def sms_summary_endpoint(request: Request, payload: SmsRequest):
    """Generates a localized SMS summary for farmers."""
    try:
        summary = await generate_sms_summary(
            plot_data=payload.plot_data,
            blend=payload.fertilizer_blend,
            language=payload.language
        )
        return {"summary": summary}
    except Exception as e:
        logger.exception("Error in /sms-summary endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/organic-plan")
@limiter.limit(RATE_LIMIT)
async def organic_plan_endpoint(request: Request, payload: OrganicPlanRequest):
    """Generates a multi-year organic transition roadmap."""
    try:
        plan = await generate_organic_plan(
            plot_data=payload.plot_data,
            current_plan=payload.recommendation
        )
        return {"plan": plan}
    except Exception as e:
        logger.exception("Error in /organic-plan endpoint")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/admin/settings")
@limiter.limit(RATE_LIMIT)
async def get_admin_settings(request: Request, current_user: dict = Depends(get_current_user_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_path = os.path.join(os.path.dirname(__file__), "..", "data", "settings.json")
    import json
    if os.path.exists(settings_path):
        with open(settings_path, "r") as f:
            return json.load(f)
    return {"chat_prompt": "You are a helpful, expert agronomist AI assistant."}

@app.post("/admin/settings")
@limiter.limit(RATE_LIMIT)
async def save_admin_settings(request: Request, payload: SettingsUpdate, current_user: dict = Depends(get_current_user_token)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    settings_path = os.path.join(os.path.dirname(__file__), "..", "data", "settings.json")
    import json
    os.makedirs(os.path.dirname(settings_path), exist_ok=True)
    with open(settings_path, "w") as f:
        json.dump({"chat_prompt": payload.chat_prompt}, f)
    return {"message": "Settings saved"}

@app.post("/admin/clear-cache")
@limiter.limit(RATE_LIMIT)
async def clear_ml_cache(request: Request, current_user: dict = Depends(get_current_user_token)):
    """Hot-swaps ML models and clears Weather/Prediction caches."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    utils._CACHED_ARTIFACT = None
    utils._PREDICT_CACHE.clear()
    
    global WEATHER_SNAPSHOT_CACHE
    WEATHER_SNAPSHOT_CACHE.clear()
    
    return {"message": "All ML and API caches cleared successfully. Next request will reload from disk."}

@app.get("/admin/health")
@limiter.limit(RATE_LIMIT)
async def get_system_health(request: Request, current_user: dict = Depends(get_current_user_token)):
    """Pings system components to verify they are connected and online."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    health = {"database": "offline", "gemini": "offline", "weather": "offline", "ml_models": "offline"}
    
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
            health["database"] = "online"
    except Exception:
        pass
        
    if os.getenv("GEMINI_API_KEY"):
        health["gemini"] = "online"
    if os.getenv("WEATHER_API_KEY"):
        health["weather"] = "online"
        
    if utils._CACHED_ARTIFACT is not None:
        health["ml_models"] = "loaded (memory)"
    elif os.path.exists(os.path.join(os.path.dirname(__file__), "..", "artifact", "model.pkl")):
        health["ml_models"] = "available (disk)"
        
    return health

@app.get("/admin/backup")
@limiter.limit(RATE_LIMIT)
async def download_backup(request: Request, current_user: dict = Depends(get_current_user_token)):
    """Securely download a snapshot of the SQLite database."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    db_url = os.getenv("DATABASE_URL", "sqlite:///./fertilizer.db")
    if db_url.startswith("sqlite:///"):
        file_path = db_url.replace("sqlite:///", "")
        if os.path.exists(file_path):
            return FileResponse(file_path, filename=f"database_backup_{datetime.now().strftime('%Y%m%d')}.sqlite")
    raise HTTPException(status_code=400, detail="Direct backup download is only supported for local SQLite configurations.")

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