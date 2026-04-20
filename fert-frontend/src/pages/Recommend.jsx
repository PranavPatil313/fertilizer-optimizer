// src/pages/Recommend.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { buildHeaders } from "../api/api";
import NpkChart from "../widgets/NpkChart";
import YieldChart from "../widgets/YieldChart";
import CarbonChart from "../widgets/CarbonChart";
import { emitWorkspaceUpdate } from "../utils/workspaceEvents";
import { kgHaToKgAcre } from "../utils/unitConversion";

const workflow = [
  { step: "Capture", detail: "Use Create Plot to save local soil + weather profile." },
  { step: "Predict", detail: "Get instant predictions for NPK requirements, soil health, and carbon impact." },
  { step: "Recommend", detail: "Receive ML-backed fertilizer strategy tailored to your field conditions." },
  { step: "Report", detail: "Generate PDF summary and share recommendations with your team." },
];

export default function Recommend() {
  const navigate = useNavigate();
  const [input, setInput] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const primaryStats = useMemo(() => {
    if (!response?.predictions) return [];

    const blend = response.fertilizer_blend;
    const products = blend?.products || [];

    // Try to show Urea/DAP/MOP first (product-based view)
    if (products.length) {
      const findProduct = (prefix) =>
        products.find((p) => typeof p.name === "string" && p.name.startsWith(prefix));

      const urea = findProduct("Urea");
      const dap = findProduct("DAP");
      const mop = findProduct("MOP");

      return [
        {
          label: "Urea (46-0-0)",
          value: urea?.rate_kg_acre ?? null,
          unit: "kg/acre",
        },
        {
          label: "DAP (18-46-0)",
          value: dap?.rate_kg_acre ?? null,
          unit: "kg/acre",
        },
        {
          label: "MOP (0-0-60)",
          value: mop?.rate_kg_acre ?? null,
          unit: "kg/acre",
        },
        {
          label: "Expected yield",
          value: kgHaToKgAcre(response.predictions.yield_kg_ha),
          unit: "kg/acre",
        },
      ];
    }

    // Fallback: original NPK view if blend is missing
    return [
      { label: "Nitrogen (N)", value: kgHaToKgAcre(response.predictions.N_kg_ha), unit: "kg/acre" },
      { label: "Phosphorus (P)", value: kgHaToKgAcre(response.predictions.P_kg_ha), unit: "kg/acre" },
      { label: "Potassium (K)", value: kgHaToKgAcre(response.predictions.K_kg_ha), unit: "kg/acre" },
      { label: "Expected yield", value: kgHaToKgAcre(response.predictions.yield_kg_ha), unit: "kg/acre" },
    ];
  }, [response]);

  useEffect(() => {
    const stored = localStorage.getItem("plot_input");
    if (stored) {
      setInput(JSON.parse(stored));
    }
  }, []);

  async function runRecommend() {
    setError("");
    if (!input) {
      setError("No plot input found. Head to Create Plot first.");
      return;
    }
    setLoading(true);
    try {
      const res = await api.post("/recommend", input, {
        headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
      });
      const data = res.data ?? res;
      setResponse(data);
      localStorage.setItem("latest_prediction_result", JSON.stringify(data));
      localStorage.setItem("latest_prediction_input", JSON.stringify(input));

      const recents = JSON.parse(localStorage.getItem("recent_predictions") || "[]");
      recents.unshift({
        name: `${input.crop_type} • ${new Date().toLocaleString()}`,
        ...data,
      });
      localStorage.setItem("recent_predictions", JSON.stringify(recents.slice(0, 15)));
      emitWorkspaceUpdate({ source: "recommend", kind: "run" });
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to reach backend");
    } finally {
      setLoading(false);
    }
  }

  async function previewPdf() {
    setError("");
    if (!input) {
      setError("No input available for report.");
      return;
    }
    try {
      const resp = await api.post("/report", input, {
        headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
        responseType: "blob",
      });
      const blob = new Blob([resp.data || resp], { type: "application/pdf" });
      const url = window.URL.createObjectURL(blob);
      window.open(url, "_blank");
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Could not generate PDF");
    }
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <section className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-4 sm:p-6">
        <div className="flex flex-col gap-3 sm:gap-4">
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-[0.3em] text-emerald-600">Recommendation</p>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-semibold text-slate-900">Generate fertilizer plan</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              Crop: <span className="font-semibold break-words">{input?.crop_type ?? "No plot selected"}</span>
            </p>
          </div>
          <div className="flex flex-col gap-2 w-full">
            <button
              onClick={runRecommend}
              disabled={loading}
              className="w-full sm:w-auto rounded-lg sm:rounded-full bg-emerald-600 px-4 sm:px-6 py-3 sm:py-3 text-sm font-semibold text-white shadow hover:bg-emerald-500 disabled:opacity-70 transition min-h-touch"
            >
              {loading ? "Running…" : "Run recommendation"}
            </button>
            <button
              onClick={previewPdf}
              className="w-full sm:w-auto rounded-lg sm:rounded-full border border-slate-200 px-4 sm:px-6 py-3 sm:py-3 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition min-h-touch"
            >
              Preview PDF
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {workflow.map(({ step, detail }) => (
            <div key={step} className="rounded-2xl border border-slate-100 p-4 text-sm">
              <p className="text-xs uppercase tracking-wide text-slate-400">{step}</p>
              <p className="mt-1 font-semibold text-slate-900">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {response && (
        <>
          <section className="rounded-3xl bg-white shadow-sm border border-slate-100 p-6">
            <div className="grid gap-4 md:grid-cols-4">
              {primaryStats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-100 p-4">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                  <p className="text-3xl font-semibold text-slate-900">
                    {stat.value?.toFixed(1) ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">{stat.unit}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">NPK profile</p>
                <NpkChart
                  N={response.predictions?.N_kg_ha}
                  P={response.predictions?.P_kg_ha}
                  K={response.predictions?.K_kg_ha}
                />
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">Yield projection</p>
                <YieldChart
                  yieldKg={
                    response.predictions?.yield_kg_ha_weather_adjusted ??
                    response.predictions?.yield_kg_ha
                  }
                />
              </div>
              <div className="rounded-2xl border border-slate-100 p-4">
                <p className="text-sm font-semibold text-slate-900">Carbon impact</p>
                <CarbonChart co2={response.carbon_kg_ha} />
              </div>
            </div>
          </section>

          <section className="rounded-3xl bg-white shadow-sm border border-slate-100 p-6 space-y-6">
            <div>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-slate-900">Fertilizer recommendation</h3>
                <button
                  className="text-sm font-semibold text-emerald-600"
                  onClick={() => navigate("/results", { state: { result: response, input } })}
                >
                  Open deployment view →
                </button>
              </div>
              <pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(response.recommendation, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Organic substitute</h3>
              <pre className="mt-2 max-h-56 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(response.organic_substitute, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Fertilizer Blend Optimizer (Real Market SKU Based)
              </h3>
              {response.fertilizer_blend?.products?.length ? (
                <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="min-w-full text-xs text-left text-slate-700">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Product</th>
                        <th className="px-3 py-2 text-right">N-P-K</th>
                        <th className="px-3 py-2 text-right">kg/acre</th>
                        <th className="px-3 py-2 text-right">kg/ha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.fertilizer_blend.products.map((p) => (
                        <tr key={p.name} className="border-t border-slate-100">
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 text-right">
                            {p.N_pct}-{p.P_pct}-{p.K_pct}
                          </td>
                          <td className="px-3 py-2 text-right">{p.rate_kg_acre}</td>
                          <td className="px-3 py-2 text-right">{p.rate_kg_ha}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Fertilizer blend not available for this recommendation.
                </p>
              )}
              <pre className="mt-3 max-h-56 overflow-auto rounded-2xl bg-slate-50 p-4 text-xs text-slate-700">
                {JSON.stringify(response.fertilizer_blend, null, 2)}
              </pre>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Weather impact</h3>
              {response.weather_risk ? (
                <div className="mt-2 rounded-2xl bg-slate-50 border border-slate-100 p-4 text-xs text-slate-700 space-y-2">
                  <p className="font-semibold text-slate-900">
                    Weather Risk: {response.weather_risk.weather_risk_band ?? "—"}{" "}
                    {response.weather_risk.weather_risk_score != null &&
                      `(score ${response.weather_risk.weather_risk_score})`}
                  </p>
                  <p>
                    Rain next 3 days:{" "}
                    <span className="font-semibold">
                      {response.weather_risk.rain_mm_next3d ?? "—"} mm
                    </span>
                  </p>
                  <p>
                    Nitrogen loss risk:{" "}
                    <span className="font-semibold">
                      {response.weather_risk.nitrogen_loss_risk ?? "—"}
                    </span>
                  </p>
                  {response.weather_risk.safe_application_window && (
                    <p>
                      Suggested low‑rain application window:{" "}
                      <span className="font-semibold">
                        {response.weather_risk.safe_application_window}
                      </span>
                    </p>
                  )}
                  {response.weather_risk.split_topdress && (
                    <p>
                      Recommended adjustment:{" "}
                      <span className="font-semibold">
                        Split topdress applications to reduce leaching risk.
                      </span>
                    </p>
                  )}
                </div>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  Weather impact not available for this recommendation.
                </p>
              )}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
// src/pages/Recommend.jsx