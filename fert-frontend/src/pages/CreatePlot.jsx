// src/pages/CreatePlot.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  predictNpk,
  fetchSoilHealth,
  fetchCarbonEstimate,
  fetchWeatherPreview,
} from "../api/api";
import useDebounce from "../hooks/useDebounce";
import { kgHaToKgAcre } from "../utils/unitConversion";

const initial = {
  crop_type: "Sugarcane",
  soil_type: "Black",
  region: "Kolhapur",
  avg_temp: 20,
  rainfall_mm: 1000,
  crop_duration_days: 0, // Can be empty in CSV
  soil_N: 75,
  soil_P: 50,
  soil_K: 100,
  pH: 6.5,
  organic_matter_pct: 2.0,
  irrigation_type: "rainfed",
  area_acre: 2.5
};

// Default crop durations in days (used to autofill until user overrides)
const CROP_DEFAULT_DURATIONS = {
  sugarcane: 365,
  wheat: 120,
  rice: 130,
  maize: 110,
  soybean: 110,
  cotton: 160,
};

// Safe NPK limits per acre by crop (from agronomy table)
const CROP_SAFE_LIMITS_PER_ACRE = {
  sugarcane: { N_max: 160, P_max: 75, K_max: 80 },
  wheat: { N_max: 65, P_max: 30, K_max: 25 },
  "rice (irrigated)": { N_max: 70, P_max: 35, K_max: 35 },
  rice: { N_max: 70, P_max: 35, K_max: 35 },
  maize: { N_max: 95, P_max: 45, K_max: 40 },
  soybean: { N_max: 25, P_max: 40, K_max: 30 },
  tur: { N_max: 20, P_max: 30, K_max: 25 },
  pigeonpea: { N_max: 20, P_max: 30, K_max: 25 },
  onion: { N_max: 80, P_max: 50, K_max: 60 },
};

const ABSOLUTE_MAX_PER_ACRE = { N_max: 160, P_max: 75, K_max: 80 };

// Derive Urea / DAP / MOP blend from NPK model outputs (kg/ha)
function computeProductBlendFromPredictions(preds, cropType) {
  if (!preds) return null;

  let N_target = Number(preds.N_kg_ha ?? preds.N ?? 0);
  let P_target = Number(preds.P_kg_ha ?? preds.P ?? 0);
  let K_target = Number(preds.K_kg_ha ?? preds.K ?? 0);

  // Convert model outputs (kg/ha) to kg/acre and clamp to crop-specific safe bands
  const cropKey = String(cropType || "").toLowerCase();
  const limits = CROP_SAFE_LIMITS_PER_ACRE[cropKey];

  const N_acre = kgHaToKgAcre(N_target);
  const P_acre = kgHaToKgAcre(P_target);
  const K_acre = kgHaToKgAcre(K_target);

  const N_max_acre = limits?.N_max ?? ABSOLUTE_MAX_PER_ACRE.N_max;
  const P_max_acre = limits?.P_max ?? ABSOLUTE_MAX_PER_ACRE.P_max;
  const K_max_acre = limits?.K_max ?? ABSOLUTE_MAX_PER_ACRE.K_max;

  const N_acre_limited = Math.min(N_acre, N_max_acre);
  const P_acre_limited = Math.min(P_acre, P_max_acre);
  const K_acre_limited = Math.min(K_acre, K_max_acre);

  const KG_HA_TO_KG_ACRE = 0.404686;
  N_target = N_acre_limited / KG_HA_TO_KG_ACRE;
  P_target = P_acre_limited / KG_HA_TO_KG_ACRE;
  K_target = K_acre_limited / KG_HA_TO_KG_ACRE;

  if (N_target <= 0 && P_target <= 0 && K_target <= 0) return null;

  // Match backend agronomic-style guardrails
  const UREA_N = 0.46; // 46-0-0
  const DAP_N = 0.18;  // 18-46-0
  const DAP_P = 0.46;
  const MOP_K = 0.60;  // 0-0-60

  const DAP_MAX_KG_HA = 250.0;
  const MOP_MAX_KG_HA = 250.0;
  const UREA_MAX_KG_HA = 350.0;
  const MAX_P_OVERSUPPLY = 0.15;
  const MAX_K_OVERSUPPLY = 0.15;

  // MOP for K
  let mopKgHa = 0;
  if (K_target > 0) {
    const mopIdeal = K_target / MOP_K;
    const mopByKOversupply = (K_target * (1 + MAX_K_OVERSUPPLY)) / MOP_K;
    mopKgHa = Math.min(mopIdeal, MOP_MAX_KG_HA, mopByKOversupply);
    mopKgHa = Math.max(mopKgHa, 0);
  }

  // DAP for P (and some N)
  let dapKgHa = 0;
  if (P_target > 0) {
    const dapIdeal = P_target / DAP_P;
    const dapByPOversupply = (P_target * (1 + MAX_P_OVERSUPPLY)) / DAP_P;
    dapKgHa = Math.min(dapIdeal, DAP_MAX_KG_HA, dapByPOversupply);
    dapKgHa = Math.max(dapKgHa, 0);
  }

  const N_from_dap = dapKgHa * DAP_N;
  const N_remaining = Math.max(N_target - N_from_dap, 0);

  // Urea for remaining N
  let ureaKgHa = 0;
  if (N_remaining > 0) {
    const ureaIdeal = N_remaining / UREA_N;
    ureaKgHa = Math.min(ureaIdeal, UREA_MAX_KG_HA);
    ureaKgHa = Math.max(ureaKgHa, 0);
  }

  // Convert to kg/acre for display
  const ureaKgAcre = kgHaToKgAcre(ureaKgHa);
  const dapKgAcre = kgHaToKgAcre(dapKgHa);
  const mopKgAcre = kgHaToKgAcre(mopKgHa);

  return {
    urea: { kgHa: ureaKgHa, kgAcre: ureaKgAcre },
    dap: { kgHa: dapKgHa, kgAcre: dapKgAcre },
    mop: { kgHa: mopKgHa, kgAcre: mopKgAcre },
    npkHa: { N: N_target, P: P_target, K: K_target },
    npkAcre: { N: N_acre_limited, P: P_acre_limited, K: K_acre_limited },
  };
}

const sections = [
  {
    title: "Crop & Weather",
    fields: [
      { key: "crop_type", label: "Crop Type", type: "text", options: ["Cotton", "Sugarcane", "Wheat", "Maize", "Rice", "Soybean"] },
      { key: "region", label: "Region", type: "text", options: ["Kolhapur", "Pune", "Sangli", "Satara", "Solapur"] },
      { key: "avg_temp", label: "Average Temperature (°C)", type: "number" },
      { key: "rainfall_mm", label: "Season Rainfall (mm)", type: "number" },
      { key: "crop_duration_days", label: "Crop Duration (days)", type: "number" },
    ],
  },
  {
    title: "Soil Profile",
    fields: [
      { key: "soil_type", label: "Soil Type", type: "text", options: ["Black", "Red", "Reddish Brown"] },
      { key: "pH", label: "Soil pH", type: "number" },
      { key: "soil_N", label: "Nitrogen (ppm)", type: "number" },
      { key: "soil_P", label: "Phosphorus (ppm)", type: "number" },
      { key: "soil_K", label: "Potassium (ppm)", type: "number" },
      { key: "organic_matter_pct", label: "Organic Matter (%)", type: "number" },
    ],
  },
  {
    title: "Operations",
    fields: [
      { key: "irrigation_type", label: "Irrigation Type", type: "text", options: ["rainfed"] },
      { key: "area_acre", label: "Area (acre)", type: "number" },
    ],
  },
];

export default function CreatePlot() {
  const [payload, setPayload] = useState(() => {
    const s = localStorage.getItem("plot_input");
    if (s) {
      const parsed = JSON.parse(s);
      // Migrate old area_ha to area_acre if present
      if (parsed.area_ha !== undefined && parsed.area_acre === undefined) {
        parsed.area_acre = parsed.area_ha;
        delete parsed.area_ha;
        // Update localStorage with migrated data
        localStorage.setItem("plot_input", JSON.stringify(parsed));
      }
      // Ensure area_acre exists, default to initial value
      if (parsed.area_acre === undefined) {
        parsed.area_acre = initial.area_acre;
      }
      return parsed;
    }
    return initial;
  });
  const [preview, setPreview] = useState({
    predictions: null,
    soil: null,
    carbon: null,
  });
  const [previewState, setPreviewState] = useState({
    loading: false,
    error: "",
  });
  const [weatherAutofillDone, setWeatherAutofillDone] = useState(false);
  const [durationTouched, setDurationTouched] = useState(false);
  const nav = useNavigate();
  const debouncedPayload = useDebounce(payload, 800);

  const displayFields = useMemo(() => sections, []);

  function setField(k, v) {
    setPayload((prev) => {
      const updated = { ...prev, [k]: v };
      // If updating area_ha, migrate to area_acre
      if (k === 'area_ha') {
        updated.area_acre = v;
        delete updated.area_ha;
      }
      // Remove any old area_ha field
      if (updated.area_ha !== undefined && updated.area_acre !== undefined) {
        delete updated.area_ha;
      }
      return updated;
    });
  }

  function save() {
    localStorage.setItem("plot_input", JSON.stringify(payload));
    nav("/recommend");
  }

  // Autofill crop duration when crop type changes, until user manually edits duration
  useEffect(() => {
    if (durationTouched) return;
    const key = String(payload.crop_type || "").toLowerCase();
    const defaultDuration = CROP_DEFAULT_DURATIONS[key];
    if (!defaultDuration) return;
    setPayload((prev) => ({
      ...prev,
      crop_duration_days:
        prev.crop_duration_days && prev.crop_duration_days > 0
          ? prev.crop_duration_days
          : defaultDuration,
    }));
  }, [payload.crop_type, durationTouched]);

  // Autofill avg_temp and rainfall_mm from WeatherAPI using region (or later lat/lon)
  useEffect(() => {
    async function autoFillWeather() {
      if (weatherAutofillDone) return;
      const region = payload.region;
      if (!region) return;
      try {
        const data = await fetchWeatherPreview({ region });
        const defaults = data?.defaults || {};
        setPayload((prev) => ({
          ...prev,
          avg_temp:
            defaults.avg_temp != null && !Number.isNaN(defaults.avg_temp)
              ? defaults.avg_temp
              : prev.avg_temp,
          rainfall_mm:
            defaults.rainfall_mm != null && !Number.isNaN(defaults.rainfall_mm)
              ? defaults.rainfall_mm
              : prev.rainfall_mm,
        }));
        setWeatherAutofillDone(true);
      } catch (err) {
        console.error("Weather preview failed", err);
      }
    }
    autoFillWeather();
  }, [payload.region, weatherAutofillDone]);

  useEffect(() => {
    async function hydratePreview() {
      // Validate payload has all required fields before making API calls
      const requiredFields = [
        'crop_type', 'soil_type', 'region', 'avg_temp', 'rainfall_mm',
        'crop_duration_days', 'soil_N', 'soil_P', 'soil_K', 'pH',
        'organic_matter_pct', 'irrigation_type', 'area_acre'
      ];
      
      // Check if all required fields exist and are not empty strings (but allow 0 for numbers)
      const hasAllFields = requiredFields.every(field => {
        const value = debouncedPayload[field];
        if (value === undefined || value === null) return false;
        // For string fields, check they're not empty
        if (['crop_type', 'soil_type', 'region', 'irrigation_type'].includes(field)) {
          return value !== '';
        }
        // For numeric fields, allow 0 but not empty string
        return value !== '';
      });
      
      if (!hasAllFields) {
        console.log("Missing fields, skipping API call. Payload:", debouncedPayload);
        return; // Don't make API calls if payload is incomplete
      }

      setPreviewState((s) => ({ ...s, loading: true, error: "" }));
      try {
        // Ensure all numeric fields are numbers, not strings
        // Use nullish coalescing to preserve 0 values
        // Migrate area_ha to area_acre if present
        const areaValue = debouncedPayload.area_acre != null 
          ? debouncedPayload.area_acre 
          : (debouncedPayload.area_ha != null ? debouncedPayload.area_ha : initial.area_acre);
        
        const cleanPayload = {
          crop_type: String(debouncedPayload.crop_type || ''),
          soil_type: String(debouncedPayload.soil_type || ''),
          region: String(debouncedPayload.region || ''),
          irrigation_type: String(debouncedPayload.irrigation_type || ''),
          avg_temp: debouncedPayload.avg_temp != null ? Number(debouncedPayload.avg_temp) : 0,
          rainfall_mm: debouncedPayload.rainfall_mm != null ? Number(debouncedPayload.rainfall_mm) : 0,
          crop_duration_days: debouncedPayload.crop_duration_days != null ? Number(debouncedPayload.crop_duration_days) : 0,
          soil_N: debouncedPayload.soil_N != null ? Number(debouncedPayload.soil_N) : 0,
          soil_P: debouncedPayload.soil_P != null ? Number(debouncedPayload.soil_P) : 0,
          soil_K: debouncedPayload.soil_K != null ? Number(debouncedPayload.soil_K) : 0,
          pH: debouncedPayload.pH != null ? Number(debouncedPayload.pH) : 0,
          organic_matter_pct: debouncedPayload.organic_matter_pct != null ? Number(debouncedPayload.organic_matter_pct) : 0,
          area_acre: Number(areaValue),
        };
        
        // Remove any old area_ha field if it exists
        delete cleanPayload.area_ha;

        console.log("Sending payload to API:", cleanPayload);

        const [predictions, soil, carbon] = await Promise.all([
          predictNpk(cleanPayload),
          fetchSoilHealth(cleanPayload),
          fetchCarbonEstimate(cleanPayload),
        ]);
        
        console.log("API responses:", { predictions, soil, carbon });
        
        // Ensure we only set valid response objects
        setPreview({ 
          predictions: predictions || null, 
          soil: soil || null, 
          carbon: carbon || null 
        });
        setPreviewState({ loading: false, error: "" });
      } catch (err) {
        console.error("Live preview failed", err);
        // Log the full error details for debugging
        if (err.response?.data) {
          console.error("Error response data:", JSON.stringify(err.response.data, null, 2));
        }
        if (err.response?.status === 422) {
          console.error("Validation error - check the payload format matches the API schema");
        }
        const errorMessage = err.response?.data?.detail || err.response?.data?.message || err.message || "Unable to refresh the preview right now.";
        // Ensure error message is a string, not an object
        const errorStr = typeof errorMessage === 'string' ? errorMessage : JSON.stringify(errorMessage);
        setPreviewState({
          loading: false,
          error: errorStr,
        });
        // Reset preview on error to avoid rendering stale data
        setPreview({ predictions: null, soil: null, carbon: null });
      }
    }
    if (debouncedPayload) {
      hydratePreview();
    }
  }, [debouncedPayload]);

  return (
    <div className="grid gap-6 md:grid-cols-[2fr,1fr]">
      <div className="rounded-3xl border border-transparent bg-white/95 p-6 shadow-xl ring-1 ring-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-green-700">
              Plot builder
            </p>
            <h2 className="text-2xl font-semibold text-gray-900">
              Field configuration
            </h2>
          </div>
          <button
            onClick={save}
            className="bg-green-700 hover:bg-green-800 text-white px-4 py-2 rounded-lg transition"
          >
            Save & Continue
          </button>
        </div>

        <div className="space-y-8">
          {displayFields.map((section) => (
            <div key={section.title}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-gray-800">
                  {section.title}
                </h3>
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  Live preview enabled
                </span>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {section.fields.map((field) => (
                  <label
                    key={field.key}
                    className="text-sm font-medium text-gray-600"
                  >
                    <span className="block mb-1">{field.label}</span>
                    <input
                      type={field.type}
                      inputMode={field.type === "number" ? "decimal" : "text"}
                      step="any"
                      value={payload[field.key] ?? initial[field.key] ?? ""}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (field.key === "crop_duration_days") {
                          setDurationTouched(true);
                        }
                        if (field.type === "number") {
                          // Allow empty string temporarily, but convert to number for storage
                          const numValue = value === "" ? initial[field.key] : parseFloat(value);
                          setField(field.key, isNaN(numValue) ? initial[field.key] : numValue);
                        } else {
                          setField(field.key, value);
                        }
                      }}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm focus:border-emerald-500 focus:ring-emerald-500"
                    />
                    {field.options && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {field.options.map((option) => (
                          <button
                            key={option}
                            type="button"
                            className={`rounded-full border px-3 py-1 text-xs ${
                              payload[field.key] === option
                                ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                                : "border-slate-200 text-slate-500 hover:border-emerald-300"
                            }`}
                            onClick={() => setField(field.key, option)}
                          >
                            {option}
                          </button>
                        ))}
                      </div>
                    )}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-3xl border border-transparent bg-gradient-to-b from-emerald-600/10 to-white p-5 shadow-sm ring-1 ring-emerald-100 h-fit">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900">
              Live agronomy insight
            </h3>
            {previewState.loading && (
              <span className="text-xs text-gray-500 animate-pulse">
                Syncing…
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Keep tweaking your field inputs while the preview estimates nutrients, yield, and carbon
            impact in real time.
          </p>

          {previewState.error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
              {previewState.error}
            </div>
          )}

          {!previewState.error && (
            <div className="space-y-4">
              {(() => {
                const blend = computeProductBlendFromPredictions(
                  preview.predictions,
                  payload.crop_type
                );

                const cards = [
                  {
                    key: "urea",
                    label: "Urea (46-0-0)",
                    value: blend?.urea?.kgAcre,
                  },
                  {
                    key: "dap",
                    label: "DAP (18-46-0)",
                    value: blend?.dap?.kgAcre,
                  },
                  {
                    key: "mop",
                    label: "MOP (0-0-60)",
                    value: blend?.mop?.kgAcre,
                  },
                ];

                // Carbon intensity based on safe NPK (same factors as backend)
                let carbonDisplay = "—";
                if (blend?.npkHa) {
                  const { N, P, K } = blend.npkHa;
                  const carbonKgHa = N * 6.7 + P * 1.1 + K * 0.9;
                  const carbonKgAcre = kgHaToKgAcre(carbonKgHa);
                  if (typeof carbonKgAcre === "number" && !Number.isNaN(carbonKgAcre)) {
                    carbonDisplay = `${carbonKgAcre.toFixed(1)} kg CO₂e/acre`;
                  }
                }

                return (
                  <>
                    <div className="grid grid-cols-3 gap-3">
                      {cards.map((card) => (
                        <div
                          key={card.key}
                          className="rounded-lg border border-green-50 bg-green-50 p-3 text-center"
                        >
                          <p className="text-xs uppercase tracking-wide text-green-700">
                            {card.label}
                          </p>
                          <p className="text-2xl font-semibold text-green-900">
                            {typeof card.value === "number" ? card.value.toFixed(1) : "—"}
                          </p>
                          <p className="text-[11px] text-green-600">kg/acre</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-gray-500 mb-1">
                        Yield projection
                      </p>
                      <p className="text-3xl font-semibold text-gray-900">
                        {typeof preview.predictions?.yield_kg_ha === "number"
                          ? (() => {
                              const yieldKgAcre = kgHaToKgAcre(
                                preview.predictions.yield_kg_ha
                              );
                              return yieldKgAcre !== null
                                ? `${yieldKgAcre.toFixed(0)} kg/acre`
                                : "—";
                            })()
                          : "—"}
                      </p>
                    </div>

              <div className="rounded-lg border p-3">
                <p className="text-xs uppercase text-gray-500 mb-1">
                  Soil health index
                </p>
                <p className="text-3xl font-semibold text-gray-900">
                  {typeof preview.soil?.soil_health_index === 'number'
                    ? preview.soil.soil_health_index.toFixed(2)
                    : "—"}
                </p>
                <p className="text-xs text-gray-500">
                  {typeof preview.soil?.soil_health_index === 'number' ? "Higher is better" : "Gathering details"}
                </p>
              </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-xs uppercase text-gray-500 mb-1">
                        Carbon intensity
                      </p>
                      <p className="text-3xl font-semibold text-gray-900">
                        {carbonDisplay}
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-dashed border-emerald-400/60 bg-emerald-50/70 p-4 text-sm text-emerald-900">
          <p className="font-semibold mb-1">Why this matters</p>
          <p>
            Nail the inputs here and the rest of the workflow (recommendations, dashboards, PDFs)
            stays aligned. Use the preview to spot anomalies before sharing plans with growers.
          </p>
        </div>
      </div>
    </div>
  );
}