# src/recommendation.py
from typing import Dict, List, Any, Tuple
import math
import os
import json
from datetime import datetime
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from .carbon import compute_co2eq_from_npk
from datetime import datetime, UTC 

# default fallback config (previous DEFAULT_CONFIG)
DEFAULT_CONFIG = {
    "max_kg_per_application": {"N": 80.0, "P": 60.0, "K": 80.0},
    "n_split": [0.4, 0.6],
    "topdress_splits": 2,
    "organic_replacement_pct_when_om_high": 0.3,
    "organic_conversions": {"N": 20.0, "P": 50.0, "K": 10.0}
}

# standard fertilizer products for blend optimization
FERTILIZER_PRODUCTS = {
    "Urea (46-0-0)": {"N_pct": 46.0, "P_pct": 0.0, "K_pct": 0.0},
    "DAP (18-46-0)": {"N_pct": 18.0, "P_pct": 46.0, "K_pct": 0.0},
    "MOP (0-0-60)": {"N_pct": 0.0, "P_pct": 0.0, "K_pct": 60.0},
}

# path to crop profiles JSON (editable by agronomist)
CROP_PROFILE_PATH = os.path.join(os.path.dirname(__file__), "data", "crop_profiles.json")

def load_crop_profile(crop_type: str) -> Dict[str, Any]:
    """
    Load crop profile from JSON. Returns empty dict if not found.
    """
    try:
        with open(CROP_PROFILE_PATH, "r", encoding="utf-8") as f:
            profiles = json.load(f)
    except Exception:
        return {}
    return profiles.get(crop_type.lower(), {})

def _cap_per_application(n, nutrient, max_caps):
    """
    Cap the nutrient per application to safety limit passed in max_caps dict.
    """
    limit = max_caps.get(nutrient, DEFAULT_CONFIG["max_kg_per_application"].get(nutrient, 9999.0))
    return min(n, limit)

def make_recommendation(preds: Dict[str, float], input_dict: Dict[str, Any], config: Dict = None) -> Dict[str, Any]:
    """
    Create a fertilizer application plan using crop-specific profiles if present.
    preds: dict with keys 'N_kg_ha','P_kg_ha','K_kg_ha' (or 'N','P','K')
    input_dict: incoming input (contains crop_type etc)
    config: optional global overrides
    """
    # load profile
    crop = (input_dict.get("crop_type") or "").lower()
    profile = load_crop_profile(crop)

    # merge config: profile values override default
    cfg = DEFAULT_CONFIG.copy()
    if config:
        cfg.update(config)
    # override with profile fields when available
    if profile:
        # replace n_split, topdress_splits, max caps
        if "n_split" in profile:
            cfg["n_split"] = profile["n_split"]
        if "topdress_splits" in profile:
            cfg["topdress_splits"] = profile["topdress_splits"]
        if "max_kg_per_application" in profile:
            # merge nested dict
            new_caps = cfg["max_kg_per_application"].copy()
            new_caps.update(profile["max_kg_per_application"])
            cfg["max_kg_per_application"] = new_caps

    N = float(preds.get("N_kg_ha", preds.get("N", 0.0)))
    P = float(preds.get("P_kg_ha", preds.get("P", 0.0)))
    K = float(preds.get("K_kg_ha", preds.get("K", 0.0)))

    basal_frac = cfg["n_split"][0]
    top_frac = cfg["n_split"][1]
    basal_N_raw = N * basal_frac
    basal_N = _cap_per_application(basal_N_raw, "N", cfg["max_kg_per_application"])

    top_N_total = N * top_frac
    td_splits = int(cfg.get("topdress_splits", 0))
    if td_splits <= 0:
        top_N_each = 0.0
        td_days = []
    else:
        top_N_each_raw = top_N_total / td_splits
        top_N_each = _cap_per_application(top_N_each_raw, "N", cfg["max_kg_per_application"])
        # schedule topdress in mid-season evenly
        duration = float(input_dict.get("crop_duration_days", 100))
        td_start = int(max(7, duration * 0.25))
        td_end = int(min(duration - 7, duration * 0.75))
        td_days = []
        if td_splits == 1:
            td_days = [int((td_start + td_end) / 2)]
        else:
            for i in range(td_splits):
                day = int(td_start + (i * (td_end - td_start) / (td_splits - 1))) if td_splits > 1 else int((td_start + td_end) / 2)
                td_days.append(day)

    basal_P = _cap_per_application(P, "P", cfg["max_kg_per_application"])
    basal_K = _cap_per_application(K, "K", cfg["max_kg_per_application"])

    plan = []
    plan.append({
        "day": 0,
        "application": "Basal",
        "N_kg_ha": round(basal_N, 2),
        "P_kg_ha": round(basal_P, 2),
        "K_kg_ha": round(basal_K, 2)
    })

    for day in td_days:
        plan.append({
            "day": int(day),
            "application": "Topdress",
            "N_kg_ha": round(top_N_each, 2),
            "P_kg_ha": 0.0,
            "K_kg_ha": 0.0
        })

    totals = {
        "N_total_kg_ha": round(basal_N + top_N_each * len(td_days), 2),
        "P_total_kg_ha": round(basal_P, 2),
        "K_total_kg_ha": round(basal_K, 2)
    }

    notes = []
    rainfall = float(input_dict.get("rainfall_mm", 0.0))
    if rainfall > 250:
        notes.append("High historical rainfall — avoid heavy basal application if heavy rains are forecast.")
    irr = str(input_dict.get("irrigation_type", "")).lower()
    if irr in ["drip", "irrigated"]:
        notes.append("Irrigation available — splitting applications is recommended.")
    elif irr == "rainfed":
        notes.append("Rainfed conditions — timing applications with expected rainfall is critical.")

    if profile and "notes" in profile:
        notes.append(profile["notes"])

    rec = {"plan": plan, "totals": totals, "notes": notes, "profile_used": profile.get("display_name") if profile else None}
    return rec


def make_product_blend(preds: Dict[str, float], rec: Dict[str, Any]) -> Dict[str, Any]:
    """
    Convert NPK requirements (kg/ha) into a practical blend of market fertilizer SKUs.

    Uses:
      - Urea (46-0-0)
      - DAP  (18-46-0)
      - MOP  (0-0-60)

    The dataset and ML outputs remain unchanged; this is a thin layer on top that
    converts the predicted N/P/K needs into product rates.
    """
    if not preds:
        return {}

    totals = (rec or {}).get("totals", {}) if rec else {}

    # Targets in kg/ha (backend basis)
    N_target = float(
        totals.get("N_total_kg_ha")
        or preds.get("N_kg_ha")
        or preds.get("N", 0.0)
    )
    P_target = float(
        totals.get("P_total_kg_ha")
        or preds.get("P_kg_ha")
        or preds.get("P", 0.0)
    )
    K_target = float(
        totals.get("K_total_kg_ha")
        or preds.get("K_kg_ha")
        or preds.get("K", 0.0)
    )

    if N_target <= 0 and P_target <= 0 and K_target <= 0:
        return {}

    # Start from P and K using DAP & MOP, then top up N with Urea,
    # but keep within agronomic-style product and oversupply limits.
    dap = FERTILIZER_PRODUCTS["DAP (18-46-0)"]
    mop = FERTILIZER_PRODUCTS["MOP (0-0-60)"]
    urea = FERTILIZER_PRODUCTS["Urea (46-0-0)"]

    # Composition fractions
    dap_P_frac = max(dap["P_pct"], 1e-6) / 100.0
    dap_N_frac = dap["N_pct"] / 100.0
    mop_K_frac = max(mop["K_pct"], 1e-6) / 100.0
    urea_N_frac = max(urea["N_pct"], 1e-6) / 100.0

    # Simple agronomic guardrails (can be tuned per region)
    DAP_MAX_KG_HA = 250.0   # ~100 kg/acre
    MOP_MAX_KG_HA = 250.0   # ~100 kg/acre
    UREA_MAX_KG_HA = 350.0  # ~140 kg/acre
    MAX_P_OVERSUPPLY = 0.15  # allow up to +15% P
    MAX_K_OVERSUPPLY = 0.15  # allow up to +15% K

    # ----- MOP for K -----
    if K_target > 0:
        mop_ideal = K_target / mop_K_frac
        mop_by_k_oversupply = (K_target * (1.0 + MAX_K_OVERSUPPLY)) / mop_K_frac
        mop_kg_ha = min(mop_ideal, MOP_MAX_KG_HA, mop_by_k_oversupply)
        mop_kg_ha = max(mop_kg_ha, 0.0)
    else:
        mop_kg_ha = 0.0

    # ----- DAP for P (and some N) -----
    if P_target > 0:
        dap_ideal = P_target / dap_P_frac
        dap_by_p_oversupply = (P_target * (1.0 + MAX_P_OVERSUPPLY)) / dap_P_frac
        dap_kg_ha = min(dap_ideal, DAP_MAX_KG_HA, dap_by_p_oversupply)
        dap_kg_ha = max(dap_kg_ha, 0.0)
    else:
        dap_kg_ha = 0.0

    N_from_dap = dap_kg_ha * dap_N_frac
    N_remaining = max(N_target - N_from_dap, 0.0)

    # ----- Urea for remaining N -----
    if N_remaining > 0:
        urea_ideal = N_remaining / urea_N_frac
        urea_kg_ha = min(urea_ideal, UREA_MAX_KG_HA)
        urea_kg_ha = max(urea_kg_ha, 0.0)
    else:
        # DAP already covers or exceeds N; don't add Urea in that case.
        urea_kg_ha = 0.0

    # Compute what this blend actually supplies (kg/ha)
    supplied_N = urea_kg_ha * urea_N_frac + dap_kg_ha * dap_N_frac
    supplied_P = dap_kg_ha * dap_P_frac
    supplied_K = mop_kg_ha * mop_K_frac

    # Simple kg/ha -> kg/acre conversion for UI
    KG_HA_TO_KG_ACRE = 0.404686

    products: List[Dict[str, Any]] = [
        {
            "name": "Urea (46-0-0)",
            "N_pct": urea["N_pct"],
            "P_pct": urea["P_pct"],
            "K_pct": urea["K_pct"],
            "rate_kg_ha": round(urea_kg_ha, 1),
            "rate_kg_acre": round(urea_kg_ha * KG_HA_TO_KG_ACRE, 1),
        },
        {
            "name": "DAP (18-46-0)",
            "N_pct": dap["N_pct"],
            "P_pct": dap["P_pct"],
            "K_pct": dap["K_pct"],
            "rate_kg_ha": round(dap_kg_ha, 1),
            "rate_kg_acre": round(dap_kg_ha * KG_HA_TO_KG_ACRE, 1),
        },
        {
            "name": "MOP (0-0-60)",
            "N_pct": mop["N_pct"],
            "P_pct": mop["P_pct"],
            "K_pct": mop["K_pct"],
            "rate_kg_ha": round(mop_kg_ha, 1),
            "rate_kg_acre": round(mop_kg_ha * KG_HA_TO_KG_ACRE, 1),
        },
    ]

    return {
        "targets_kg_ha": {
            "N": round(N_target, 2),
            "P": round(P_target, 2),
            "K": round(K_target, 2),
        },
        "supplied_kg_ha": {
            "N": round(supplied_N, 2),
            "P": round(supplied_P, 2),
            "K": round(supplied_K, 2),
        },
        "gap_kg_ha": {
            # positive = oversupply, negative = deficit
            "N": round(supplied_N - N_target, 2),
            "P": round(supplied_P - P_target, 2),
            "K": round(supplied_K - K_target, 2),
        },
        "products": products,
    }

def suggest_organic_substitute(preds: Dict[str,float], input_dict: Dict[str,Any], config: Dict=None) -> Dict[str,Any]:
    if config is None:
        config = DEFAULT_CONFIG
    om = float(input_dict.get("organic_matter_pct", 1.5))
    replace_pct = 0.0
    if om >= 3.0:
        replace_pct = config["organic_replacement_pct_when_om_high"]
    elif om >= 2.0:
        replace_pct = config["organic_replacement_pct_when_om_high"] / 2.0
    else:
        replace_pct = 0.0

    N = float(preds.get("N_kg_ha", preds.get("N", 0.0)))
    P = float(preds.get("P_kg_ha", preds.get("P", 0.0)))
    K = float(preds.get("K_kg_ha", preds.get("K", 0.0)))

    replacer = config["organic_conversions"]
    replace_plan = {}
    for nut, val in [("N", N), ("P", P), ("K", K)]:
        qty_to_replace = val * replace_pct
        conversion = replacer.get(nut, 20.0)
        fym_needed = qty_to_replace * conversion
        replace_plan[f"{nut}_replace_kg_ha"] = round(qty_to_replace, 2)
        replace_plan[f"{nut}_fym_kg_ha"] = int(round(fym_needed))

    replace_plan["replace_pct"] = round(replace_pct, 2)
    return replace_plan

# (keep generate_pdf_report unchanged from earlier version)
# copy your previous generate_pdf_report implementation here (unchanged)
# to keep message short I assume you already have it in the file.
# If it's missing, copy the earlier generate_pdf_report function verbatim.

# PDF report generator using ReportLab
def generate_pdf_report(preds: Dict[str,float],
                        input_dict: Dict[str,Any],
                        rec: Dict[str,Any],
                        shi: Dict[str,Any],
                        co2: float,
                        blend: Dict[str,Any] | None = None,
                        weather: Dict[str,Any] | None = None,
                        out_path: str = None) -> str:
    """
    Generate a simple PDF report saved to out_path (if None, will create timestamped file in src/artifact/).
    Returns the path to the saved PDF.
    """
    base_dir = os.path.join(os.path.dirname(__file__), "artifact")
    os.makedirs(base_dir, exist_ok=True)
    if out_path is None:
        timestamp = datetime.utcnow().strftime("%Y%m%dT%H%M%SZ")
        out_path = os.path.join(base_dir, f"recommendation_report_{timestamp}.pdf")

    c = canvas.Canvas(out_path, pagesize=A4)
    width, height = A4

    margin = 20*mm
    x = margin
    y = height - margin

    # Title
    c.setFont("Helvetica-Bold", 16)
    c.drawString(x, y, "FertilizerOptimizer — Recommendation Report")
    y -= 10*mm

    # Input summary
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Plot / Input Summary")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    for k in ["crop_type","soil_type","region","area_acre","crop_duration_days","irrigation_type","avg_temp","rainfall_mm"]:
        val = input_dict.get(k, "")
        c.drawString(x, y, f"{k}: {val}")
        y -= 5*mm

    y -= 3*mm
    # Predictions (model-internal NPK outputs)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Model Predictions (internal NPK basis)")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    for k, label in [
        ("N_kg_ha", "Nitrogen requirement (kg/ha)"),
        ("P_kg_ha", "Phosphorus requirement (kg/ha)"),
        ("K_kg_ha", "Potassium requirement (kg/ha)"),
        ("yield_kg_ha", "Expected yield (kg/ha)"),
    ]:
        v = preds.get(k, "")
        c.drawString(x, y, f"{label}: {v}")
        y -= 5*mm

    # Product blend view (Urea / DAP / MOP)
    if blend and isinstance(blend, dict):
        y -= 4*mm
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x, y, "Fertilizer Blend (Urea / DAP / MOP)")
        y -= 6*mm
        c.setFont("Helvetica", 10)

        products: List[Dict[str, Any]] = blend.get("products") or []
        for p in products:
            name = p.get("name", "")
            n_pct = p.get("N_pct", 0)
            p_pct = p.get("P_pct", 0)
            k_pct = p.get("K_pct", 0)
            rate_ha = p.get("rate_kg_ha", 0)
            rate_acre = p.get("rate_kg_acre", 0)
            c.drawString(
                x,
                y,
                f"{name} ({n_pct}-{p_pct}-{k_pct}) -> {rate_acre} kg/acre ({rate_ha} kg/ha)",
            )
            y -= 5*mm
            if y < margin + 40*mm:
                c.showPage()
                y = height - margin

    # Weather snapshot (if available)
    if weather:
        y -= 4*mm
        c.setFont("Helvetica-Bold", 12)
        c.drawString(x, y, "Weather snapshot at recommendation time")
        y -= 6*mm
        c.setFont("Helvetica", 10)
        risk = weather.get("risk") or {}
        snap = weather.get("snapshot") or {}
        current = (snap.get("current") or {})
        forecast = (snap.get("forecast_3d") or {})

        c.drawString(
            x,
            y,
            f"Avg Temp (3d): {forecast.get('avgtemp_c', '–')} °C   "
            f"3‑day Rainfall: {forecast.get('totalprecip_mm', '–')} mm",
        )
        y -= 5*mm
        c.drawString(
            x,
            y,
            f"Humidity: {current.get('humidity', '–')}%   Wind: {current.get('wind_kph', '–')} km/h",
        )
        y -= 5*mm
        c.drawString(
            x,
            y,
            f"Weather Risk: {risk.get('weather_risk_band', '–')} "
            f"(score {risk.get('weather_risk_score', '–')})",
        )
        y -= 5*mm
        if risk.get("safe_application_window"):
            c.drawString(
                x,
                y,
                f"Suggested low‑rain application window: {risk['safe_application_window']}",
            )
            y -= 5*mm
        if risk.get("nitrogen_loss_risk"):
            c.drawString(
                x,
                y,
                f"Nitrogen loss risk: {risk['nitrogen_loss_risk']}",
            )
            y -= 5*mm

    y -= 4*mm
    # Recommendation Plan (still expressed in NPK, backend basis)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Recommended Application Plan")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    for event in rec.get("plan", []):
        c.drawString(x, y, f"Day {event['day']}: {event['application']} -> N:{event['N_kg_ha']} kg/ha, P:{event['P_kg_ha']} kg/ha, K:{event['K_kg_ha']} kg/ha")
        y -= 5*mm
        if y < margin + 40*mm:
            c.showPage()
            y = height - margin

    y -= 4*mm
    # Soil health & carbon
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Soil Health & Carbon")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    c.drawString(x, y, f"Soil Health Index: {shi.get('soil_health_index', '')}")
    y -= 5*mm
    c.drawString(x, y, f"Carbon footprint (kgCO2e/ha): {round(co2,2)}")
    y -= 8*mm

    # Notes
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x, y, "Notes")
    y -= 6*mm
    c.setFont("Helvetica", 10)
    notes = rec.get("notes", [])
    if not notes:
        c.drawString(x, y, "No special notes.")
        y -= 5*mm
    else:
        for line in notes:
            c.drawString(x, y, f"- {line}")
            y -= 5*mm
            if y < margin + 40*mm:
                c.showPage()
                y = height - margin

    # Footer
    c.setFont("Helvetica-Oblique", 8)
    c.drawString(
    margin,
    15 * mm,
    f"Generated by FertilizerOptimizer on {datetime.now(UTC).isoformat()}"
    )
    c.save()
    return out_path