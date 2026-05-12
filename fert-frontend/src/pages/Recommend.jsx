// src/pages/Recommend.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api, { buildHeaders } from "../api/api";
import { emitWorkspaceUpdate } from "../utils/workspaceEvents";
import { kgHaToKgAcre } from "../utils/unitConversion";
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid
} from "recharts";

const workflow = [
  { step: "Capture", detail: "Use Create Plot to save local soil + weather profile." },
  { step: "Predict", detail: "Get instant predictions for NPK requirements, soil health, and carbon impact." },
  { step: "Recommend", detail: "Receive ML-backed fertilizer strategy tailored to your field conditions." },
  { step: "Report", detail: "Generate PDF summary and share recommendations with your team." },
];

function DataCards({ data }) {
  if (!data) return null;
  if (typeof data !== "object") {
    return <p className="mt-2 text-sm text-slate-700 bg-slate-50 border border-slate-100 p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-sm">{String(data)}</p>;
  }
  return (
    <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Object.entries(data).map(([key, val]) => {
        if (val === null || val === undefined) return null;
        if (typeof val === "object" && !Array.isArray(val)) return null; // Skip deeply nested objects for flat card views
        return (
          <div key={key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 sm:p-4 shadow-sm hover:shadow-md transition-shadow">
            <h4 className="text-[10px] sm:text-[11px] uppercase tracking-wider text-emerald-600 font-bold mb-1">
              {key.replace(/_/g, " ")}
            </h4>
            <p className="text-sm font-medium text-slate-800">
              {Array.isArray(val) ? val.join(", ") : String(val)}
            </p>
          </div>
        );
      })}
    </div>
  );
}

function NpkPieChart({ N, P, K }) {
  const data = [
    { name: "Nitrogen (N)", value: N ?? 0, color: "#10b981" },
    { name: "Phosphorus (P)", value: P ?? 0, color: "#0ea5e9" },
    { name: "Potassium (K)", value: K ?? 0, color: "#f59e0b" },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius="50%"
          outerRadius="80%"
          paddingAngle={4}
          dataKey="value"
          animationBegin={300}
          animationDuration={1200}
          animationEasing="ease-out"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} stroke="transparent" />
          ))}
        </Pie>
        <Tooltip 
          formatter={(value) => `${value.toFixed(1)} kg/ha`} 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function AnimatedYieldChart({ yieldKg }) {
  const data = [{ name: "Yield", value: yieldKg ?? 0 }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 20, right: 20, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
        <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <Tooltip 
          cursor={{ fill: "transparent" }} 
          formatter={(val) => `${val.toFixed(0)} kg/ha`} 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Bar 
          dataKey="value" 
          fill="#3b82f6" 
          radius={[6, 6, 0, 0]} 
          animationBegin={500} 
          animationDuration={1200} 
          animationEasing="ease-out"
          barSize={60}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function AnimatedCarbonChart({ co2 }) {
  const data = [{ name: "Carbon", value: co2 ?? 0 }];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
        <XAxis type="number" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="name" hide />
        <Tooltip 
          cursor={{ fill: "transparent" }} 
          formatter={(val) => `${val.toFixed(1)} kg CO₂/ha`} 
          contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
        />
        <Bar 
          dataKey="value" 
          fill="#64748b" 
          radius={[0, 6, 6, 0]} 
          animationBegin={700} 
          animationDuration={1200} 
          animationEasing="ease-out"
          barSize={40} 
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PlanTable({ plan = [], notes }) {
  if (!plan || plan.length === 0) return <p className="text-xs text-slate-500 mt-2">No plan available.</p>;
  return (
    <div className="mt-3">
      <div className="overflow-x-auto rounded-xl border border-slate-100 shadow-sm">
        <table className="min-w-full text-xs text-left text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-400">
            <tr>
              <th className="px-3 py-2">Day</th>
              <th className="px-3 py-2">Application</th>
              <th className="px-3 py-2 text-right">N (kg/ha)</th>
              <th className="px-3 py-2 text-right">P (kg/ha)</th>
              <th className="px-3 py-2 text-right">K (kg/ha)</th>
            </tr>
          </thead>
          <tbody>
            {plan.map((row, idx) => (
              <tr key={`${row.day}-${idx}`} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-3 py-2 font-medium">{row.day === 0 ? "0 (Basal)" : row.day}</td>
                <td className="px-3 py-2">{row.application}</td>
                <td className="px-3 py-2 text-right text-emerald-700 font-medium">{row.N_kg_ha}</td>
                <td className="px-3 py-2 text-right text-sky-700 font-medium">{row.P_kg_ha}</td>
                <td className="px-3 py-2 text-right text-amber-600 font-medium">{row.K_kg_ha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {notes && notes.length > 0 && (
        <div className="mt-3 space-y-2">
          {notes.map((note, idx) => (
            <p key={idx} className="text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-lg border border-amber-100 flex gap-2">
              <span className="font-bold">Note:</span> {note}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}

function OrganicCards({ data }) {
  if (!data || Object.keys(data).length === 0) {
    return <p className="text-xs text-slate-500 mt-2">No organic substitute data available.</p>;
  }
  const { replace_pct, ...rest } = data;
  return (
    <div className="mt-3">
      {replace_pct > 0 && (
        <p className="text-xs text-emerald-700 bg-emerald-50 inline-block px-3 py-1.5 rounded-lg mb-3 font-medium border border-emerald-100">
          Replacing {(replace_pct * 100).toFixed(0)}% of synthetic nutrients with Farm Yard Manure (FYM)
        </p>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Object.entries(rest).map(([key, val]) => {
          if (val === null || val === undefined) return null;
          const formattedKey = key.replace(/_/g, " ").replace("kg ha", "(kg/ha)");
          return (
            <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3 shadow-sm hover:shadow-md transition-shadow">
              <h4 className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">{formattedKey}</h4>
              <p className="text-lg font-semibold text-slate-800">{val}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function Recommend() {
  const navigate = useNavigate();
  const [input, setInput] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [pdfLoading, setPdfLoading] = useState(false);

  const [unit, setUnit] = useState(() => localStorage.getItem("pref_unit") || "acre");
  useEffect(() => {
    const handler = () => setUnit(localStorage.getItem("pref_unit") || "acre");
    window.addEventListener("unitChange", handler);
    return () => window.removeEventListener("unitChange", handler);
  }, []);

  const primaryStats = useMemo(() => {
    if (!response?.predictions) return [];

    const blend = response.fertilizer_blend;
    const products = blend?.products || [];
    const isHa = unit === "ha";

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
          value: isHa ? urea?.rate_kg_ha : urea?.rate_kg_acre ?? null,
          unit: isHa ? "kg/ha" : "kg/acre",
        },
        {
          label: "DAP (18-46-0)",
          value: isHa ? dap?.rate_kg_ha : dap?.rate_kg_acre ?? null,
          unit: isHa ? "kg/ha" : "kg/acre",
        },
        {
          label: "MOP (0-0-60)",
          value: isHa ? mop?.rate_kg_ha : mop?.rate_kg_acre ?? null,
          unit: isHa ? "kg/ha" : "kg/acre",
        },
        {
          label: "Expected yield",
          value: isHa ? response.predictions.yield_kg_ha : kgHaToKgAcre(response.predictions.yield_kg_ha),
          unit: isHa ? "kg/ha" : "kg/acre",
        },
      ];
    }

    // Fallback: original NPK view if blend is missing
    return [
      { label: "Nitrogen (N)", value: isHa ? response.predictions.N_kg_ha : kgHaToKgAcre(response.predictions.N_kg_ha), unit: isHa ? "kg/ha" : "kg/acre" },
      { label: "Phosphorus (P)", value: isHa ? response.predictions.P_kg_ha : kgHaToKgAcre(response.predictions.P_kg_ha), unit: isHa ? "kg/ha" : "kg/acre" },
      { label: "Potassium (K)", value: isHa ? response.predictions.K_kg_ha : kgHaToKgAcre(response.predictions.K_kg_ha), unit: isHa ? "kg/ha" : "kg/acre" },
      { label: "Expected yield", value: isHa ? response.predictions.yield_kg_ha : kgHaToKgAcre(response.predictions.yield_kg_ha), unit: isHa ? "kg/ha" : "kg/acre" },
    ];
  }, [response, unit]);

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
      setError(err.response?.data?.detail || err.message || "Unable to generate recommendation");
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
    setPdfLoading(true);
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
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-4 sm:space-y-6 pb-10 pt-4 sm:pt-6">
      <style>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes zoomIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
      @keyframes gradientShift {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
        .animate-zoom-in {
          animation: zoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
      <section className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-4 sm:p-6 opacity-0 animate-fade-in-up" style={{ animationDelay: "0ms" }}>
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
              className="w-full sm:w-auto rounded-lg sm:rounded-full bg-emerald-600 px-4 sm:px-6 py-3 sm:py-3 text-sm font-semibold text-white shadow transition-all hover:bg-emerald-500 hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-70 disabled:hover:translate-y-0 disabled:hover:shadow min-h-touch"
            >
              {loading ? "Running…" : "Run recommendation"}
            </button>
            <button
              onClick={previewPdf}
              disabled={pdfLoading}
              className={`w-full sm:w-auto rounded-lg sm:rounded-full px-4 sm:px-6 py-3 sm:py-3 text-sm font-semibold transition-all min-h-touch disabled:opacity-80 disabled:hover:translate-y-0 ${
                pdfLoading
                  ? "bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400 bg-[length:200%_200%] animate-[gradientShift_2s_ease_infinite] text-white shadow border-transparent"
                  : "border border-slate-200 text-slate-700 hover:border-emerald-400 hover:text-emerald-700 hover:bg-emerald-50 hover:-translate-y-0.5 hover:shadow-md"
              }`}
            >
              {pdfLoading ? "Generating..." : "Preview PDF"}
            </button>
          </div>
        </div>
        {error && (
          <div className="mt-3 sm:mt-4 rounded-lg sm:rounded-2xl border border-red-200 bg-red-50 p-3 sm:p-4 text-xs sm:text-sm text-red-600">
            {error}
          </div>
        )}

        <div className="mt-6 grid gap-4 md:grid-cols-4">
          {workflow.map(({ step, detail }, idx) => (
            <div 
              key={step} 
              className="rounded-2xl border border-slate-100 p-4 text-sm opacity-0 animate-fade-in-up transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
              style={{ animationDelay: `${(idx + 1) * 100}ms` }}
            >
              <p className="text-xs uppercase tracking-wide text-slate-400">{step}</p>
              <p className="mt-1 font-semibold text-slate-900">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {response && (
        <>
          <section 
            className="rounded-3xl bg-white shadow-sm border border-slate-100 p-6 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "100ms" }}
          >
            <div className="grid gap-4 md:grid-cols-4">
              {primaryStats.map((stat, idx) => (
                <div 
                  key={stat.label} 
                  className="rounded-2xl border border-slate-100 p-4 opacity-0 animate-zoom-in transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default"
                  style={{ animationDelay: `${(idx + 2) * 100}ms` }}
                >
                  <p className="text-xs uppercase tracking-wide text-slate-500">{stat.label}</p>
                  <p className="text-3xl font-semibold text-slate-900">
                    {stat.value?.toFixed(1) ?? "—"}
                  </p>
                  <p className="text-xs text-slate-500">{stat.unit}</p>
                </div>
              ))}
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <div 
                className="rounded-2xl border border-slate-100 p-4 opacity-0 animate-fade-in-up transition-all hover:shadow-md flex flex-col min-h-[220px]"
                style={{ animationDelay: "300ms" }}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">NPK profile</p>
                  <div className="flex gap-1.5 items-center">
                    <span className="w-2 h-2 rounded-full bg-[#10b981]" title="Nitrogen"></span>
                    <span className="w-2 h-2 rounded-full bg-[#0ea5e9]" title="Phosphorus"></span>
                    <span className="w-2 h-2 rounded-full bg-[#f59e0b]" title="Potassium"></span>
                  </div>
                </div>
                <div className="flex-1 mt-2 relative min-h-[160px]">
                  <NpkPieChart
                    N={response.predictions?.N_kg_ha}
                    P={response.predictions?.P_kg_ha}
                    K={response.predictions?.K_kg_ha}
                  />
                </div>
              </div>
              <div 
                className="rounded-2xl border border-slate-100 p-4 opacity-0 animate-fade-in-up transition-all hover:shadow-md flex flex-col min-h-[220px]"
                style={{ animationDelay: "400ms" }}
              >
                <p className="text-sm font-semibold text-slate-900">Yield projection</p>
                <div className="flex-1 mt-2 relative min-h-[160px]">
                  <AnimatedYieldChart
                    yieldKg={
                      response.predictions?.yield_kg_ha_weather_adjusted ??
                      response.predictions?.yield_kg_ha
                    }
                  />
                </div>
              </div>
              <div 
                className="rounded-2xl border border-slate-100 p-4 opacity-0 animate-fade-in-up transition-all hover:shadow-md flex flex-col min-h-[220px]"
                style={{ animationDelay: "500ms" }}
              >
                <p className="text-sm font-semibold text-slate-900">Carbon impact</p>
                <div className="flex-1 mt-2 relative min-h-[160px]">
                  <AnimatedCarbonChart co2={response.carbon_kg_ha} />
                </div>
              </div>
            </div>
          </section>

          <section 
            className="rounded-3xl bg-white shadow-sm border border-slate-100 p-6 space-y-6 opacity-0 animate-fade-in-up"
            style={{ animationDelay: "400ms" }}
          >
            {response.predictions?.insights?.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Model insights</h3>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  {response.predictions.insights.map((insight, idx) => (
                    <div key={idx} className="flex gap-3 rounded-2xl bg-emerald-50/50 p-4 border border-emerald-100 text-sm text-slate-700">
                      <span className="text-emerald-500 text-lg leading-none">💡</span>
                      <p>{insight}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
              <PlanTable plan={response.recommendation?.plan} notes={response.recommendation?.notes} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Organic substitute</h3>
              <OrganicCards data={response.organic_substitute} />
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
                        <th className="px-3 py-2 text-right">Rate (kg/{unit === "ha" ? "ha" : "acre"})</th>
                      </tr>
                    </thead>
                    <tbody>
                      {response.fertilizer_blend.products.map((p) => (
                        <tr key={p.name} className="border-t border-slate-100">
                          <td className="px-3 py-2">{p.name}</td>
                          <td className="px-3 py-2 text-right">
                            {p.N_pct}-{p.P_pct}-{p.K_pct}
                          </td>
                          <td className="px-3 py-2 text-right">{unit === "ha" ? p.rate_kg_ha : p.rate_kg_acre}</td>
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