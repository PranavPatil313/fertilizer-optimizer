// src/pages/Results.jsx
import React, { useMemo, useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { downloadReport, explainPrediction, analyzeRoi, generateSmsSummary, generateOrganicPlan } from "../api/api";
import ChatbotWidget from "../components/ChatbotWidget";
import useAuth from "../auth/useAuth";
import { kgHaToKgAcre } from "../utils/unitConversion";

function BaselineComparison({ res }) {
  const [baseline, setBaseline] = useState({ N: "", P: "", K: "" });
  
  const baseN = Number(baseline.N) || 0;
  const baseP = Number(baseline.P) || 0;
  const baseK = Number(baseline.K) || 0;
  
  // Compute total baseline footprint then scale to acre to display
  const baseCarbonAcre = (baseN * 6.7) + (baseP * 1.1) + (baseK * 0.9);
  const modelCarbonAcre = kgHaToKgAcre(res.carbon_kg_ha ?? 0);
  const carbonSavings = baseCarbonAcre - modelCarbonAcre;
  const saved = carbonSavings > 0;

  return (
    <div className="mt-6 border-t border-gray-100 pt-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Historical Plan Comparison</h3>
      <p className="text-sm text-gray-500 mb-4">Enter the farmer's traditional application rate (kg/acre) to calculate sustainability ROI.</p>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <input type="number" placeholder="Trad. N" value={baseline.N} onChange={e => setBaseline({ ...baseline, N: e.target.value })} className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none bg-gray-50" />
        <input type="number" placeholder="Trad. P" value={baseline.P} onChange={e => setBaseline({ ...baseline, P: e.target.value })} className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none bg-gray-50" />
        <input type="number" placeholder="Trad. K" value={baseline.K} onChange={e => setBaseline({ ...baseline, K: e.target.value })} className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none bg-gray-50" />
      </div>
      {(baseN > 0 || baseP > 0 || baseK > 0) && (
        <div className={`p-4 rounded-2xl ${saved ? "bg-emerald-50 border border-emerald-100" : "bg-amber-50 border border-amber-100"}`}>
          <p className="text-sm font-semibold text-gray-900">
            {saved ? "🌱 Sustainable Reduction Achieved" : "⚠️ ML Recommends Higher Nutrients"}
          </p>
          <p className={`text-2xl font-bold mt-1 ${saved ? "text-emerald-700" : "text-amber-700"}`}>
            {saved ? "-" : "+"}{Math.abs(carbonSavings).toFixed(1)} kg CO₂e / acre
          </p>
          <p className="text-xs text-gray-600 mt-1">Difference vs. traditional baseline</p>
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("brand_company") || "");
  const [consultantName, setConsultantName] = useState(() => localStorage.getItem("brand_consultant") || "");
  const [logoUrl, setLogoUrl] = useState(() => localStorage.getItem("brand_logo") || "");

  // Explain Why states
  const [isExplaining, setIsExplaining] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [explainModalOpen, setExplainModalOpen] = useState(false);

  // ROI states
  const [isAnalyzingRoi, setIsAnalyzingRoi] = useState(false);
  const [roiAnalysis, setRoiAnalysis] = useState("");
  const [roiModalOpen, setRoiModalOpen] = useState(false);

  // SMS states
  const [isTranslating, setIsTranslating] = useState(false);
  const [smsSummary, setSmsSummary] = useState("");
  const [smsModalOpen, setSmsModalOpen] = useState(false);

  // Organic Plan states
  const [isPlanningOrganic, setIsPlanningOrganic] = useState(false);
  const [organicPlan, setOrganicPlan] = useState("");
  const [organicPlanModalOpen, setOrganicPlanModalOpen] = useState(false);

  const persistedResult = useMemo(() => {
    if (state?.result) return state.result;
    const raw = localStorage.getItem("latest_prediction_result");
    return raw ? JSON.parse(raw) : null;
  }, [state]);
  const persistedInput = useMemo(() => {
    if (state?.input) return state.input;
    const raw = localStorage.getItem("latest_prediction_input");
    return raw ? JSON.parse(raw) : null;
  }, [state]);

  if (!persistedResult) {
    return (
      <div className="max-w-3xl mx-auto w-full bg-white p-8 sm:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 mt-10 lg:mt-16 text-center">
        <div className="text-4xl mb-4">📑</div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          No recommendation selected
        </h2>
        <p className="text-slate-600">
          Run a recommendation or open one from your dashboard to review the
          production-grade analytics.
        </p>
        <button
          className="mt-6 rounded-full bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-white font-semibold shadow-sm transition"
          onClick={() => navigate("/dashboard")}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  const res = useMemo(() => normalizeResultPayload(persistedResult), [persistedResult]);

  if (!res) {
    return (
      <div className="max-w-3xl mx-auto w-full bg-white p-8 sm:p-12 rounded-2xl sm:rounded-3xl shadow-sm border border-slate-100 mt-10 lg:mt-16 text-center">
        <div className="text-4xl mb-4">📑</div>
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          No recommendation selected
        </h2>
        <p className="text-slate-600">
          Run a recommendation or open one from your dashboard to review the
          production-grade analytics.
        </p>
        <button
          className="mt-6 rounded-full bg-emerald-600 hover:bg-emerald-500 px-6 py-2.5 text-white font-semibold shadow-sm transition"
          onClick={() => navigate("/dashboard")}
        >
          Go to dashboard
        </button>
      </div>
    );
  }

  const barData = [
    {
      name: "Nitrogen",
      value: kgHaToKgAcre(res.predictions?.N_kg_ha ?? res.predictions?.N ?? 0),
    },
    {
      name: "Phosphorus",
      value: kgHaToKgAcre(res.predictions?.P_kg_ha ?? res.predictions?.P ?? 0),
    },
    {
      name: "Potassium",
      value: kgHaToKgAcre(res.predictions?.K_kg_ha ?? res.predictions?.K ?? 0),
    },
    { name: "Yield", value: kgHaToKgAcre(res.predictions?.yield_kg_ha ?? 0) },
  ];

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      if (!persistedInput) {
        alert("Original plot input not found. Re-run recommendation to download PDF.");
        return;
      }
      const queryParams = new URLSearchParams();
      if (companyName) {
        queryParams.append("company_name", companyName);
        localStorage.setItem("brand_company", companyName);
      }
      if (consultantName) {
        queryParams.append("consultant_name", consultantName);
        localStorage.setItem("brand_consultant", consultantName);
      }
      if (logoUrl) {
        queryParams.append("logo_url", logoUrl);
        localStorage.setItem("brand_logo", logoUrl);
      }
      const endpoint = `/report${queryParams.toString() ? `?${queryParams.toString()}` : ""}`;
      const blob = await downloadReport(endpoint, persistedInput, user ? localStorage.getItem("access_token") : null);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function handleExplain() {
    setExplainModalOpen(true);
    if (explanation) return; // already fetched
    setIsExplaining(true);
    try {
      const data = await explainPrediction({
        plot_data: persistedInput,
        predictions: res.predictions,
      });
      setExplanation(data.explanation);
    } catch (err) {
      setExplanation("Sorry, could not generate an explanation at this time.");
    } finally {
      setIsExplaining(false);
    }
  }

  async function handleAnalyzeRoi() {
    setRoiModalOpen(true);
    if (roiAnalysis) return; // already fetched
    setIsAnalyzingRoi(true);
    try {
      const data = await analyzeRoi({
        plot_data: persistedInput,
        predictions: res.predictions,
        fertilizer_blend: res.fertilizer_blend,
      });
      setRoiAnalysis(data.analysis);
    } catch (err) {
      setRoiAnalysis("Sorry, could not generate an economic analysis at this time.");
    } finally {
      setIsAnalyzingRoi(false);
    }
  }

  async function handleSmsTranslate(lang) {
    setSmsModalOpen(true);
    setSmsSummary(""); // reset for new language
    setIsTranslating(true);
    try {
      const data = await generateSmsSummary({
        plot_data: persistedInput,
        fertilizer_blend: res.fertilizer_blend,
        language: lang
      });
      setSmsSummary(data.summary);
    } catch (err) {
      setSmsSummary(`Failed to generate ${lang} summary.`);
    } finally {
      setIsTranslating(false);
    }
  }

  async function handleOrganicPlan() {
    setOrganicPlanModalOpen(true);
    if (organicPlan) return;
    setIsPlanningOrganic(true);
    try {
      const data = await generateOrganicPlan({
        plot_data: persistedInput,
        recommendation: res.recommendation,
      });
      setOrganicPlan(data.plan);
    } catch (err) {
      setOrganicPlan("Failed to generate organic transition plan.");
    } finally {
      setIsPlanningOrganic(false);
    }
  }

  // Reusable Simple Markdown Renderer
  function renderSimpleMarkdown(text) {
    return text.split('\n').map((line, i) => (
      <p key={i} className="mb-3 last:mb-0 min-h-[1rem]">
        {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
          part.startsWith('**') && part.endsWith('**') 
            ? <strong key={j} className="text-slate-900">{part.slice(2, -2)}</strong> 
            : part
        )}
      </p>
    ));
  }

  return (
    <>
      <style>{`
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
      `}</style>
      <div className="max-w-6xl mx-auto w-full px-2 sm:px-6 lg:px-8 space-y-3 sm:space-y-8 pb-10 pt-1 sm:pt-6 -mt-2 sm:mt-0">
      <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-green-600">
              Deployment insight
            </p>
            <h1 className="text-3xl font-semibold text-gray-900">
              Recommendation summary
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Plot ID {res.plot_id ?? "—"} • Prediction ID {res.prediction_id ?? "—"}
            </p>
          </div>
        <div className="flex flex-wrap items-center justify-end gap-2 mt-4 md:mt-0">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Company Name"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none w-28 sm:w-auto bg-gray-50 hover:bg-white transition-colors"
            />
            <input
              type="text"
              placeholder="Logo URL"
              value={logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none w-28 sm:w-auto bg-gray-50 hover:bg-white transition-colors"
            />
            <input
              type="text"
              placeholder="Consultant"
              value={consultantName}
              onChange={(e) => setConsultantName(e.target.value)}
              className="px-3 py-2 text-sm rounded-xl border border-gray-200 focus:border-green-500 focus:outline-none w-28 sm:w-auto bg-gray-50 hover:bg-white transition-colors"
            />
          </div>
            <button
              onClick={handleExplain}
              className="rounded-full px-5 py-2 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 shadow-sm hover:bg-emerald-100 transition-all flex items-center gap-1.5"
            >
              <span className="text-base leading-none">✨</span> Explain Why
            </button>
            <button
              onClick={handleAnalyzeRoi}
              className="rounded-full px-5 py-2 text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 shadow-sm hover:bg-blue-100 transition-all flex items-center gap-1.5"
            >
              <span className="text-base leading-none">📈</span> Analyze ROI
            </button>
            <button
              onClick={handleOrganicPlan}
              className="rounded-full px-5 py-2 text-sm font-semibold text-green-700 bg-green-50 border border-green-200 shadow-sm hover:bg-green-100 transition-all flex items-center gap-1.5"
            >
              <span className="text-base leading-none">🌱</span> 3-Yr Organic Plan
            </button>
            <button
              onClick={() => handleSmsTranslate("Marathi")}
              className="rounded-full px-5 py-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 shadow-sm hover:bg-orange-100 transition-all flex items-center gap-1.5"
            >
              <span className="text-base leading-none">📱</span> Marathi SMS
            </button>
            <button
              onClick={() => handleSmsTranslate("Hindi")}
              className="rounded-full px-5 py-2 text-sm font-semibold text-orange-700 bg-orange-50 border border-orange-200 shadow-sm hover:bg-orange-100 transition-all flex items-center gap-1.5"
            >
              <span className="text-base leading-none">📱</span> Hindi SMS
            </button>
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className={`rounded-full px-5 py-2 text-sm font-semibold text-white shadow disabled:opacity-80 transition-all ${
                downloading
                  ? "bg-gradient-to-r from-emerald-500 via-teal-400 to-emerald-500 bg-[length:200%_200%] animate-[gradientShift_2s_ease_infinite]"
                  : "bg-green-700 hover:bg-green-800"
              }`}
            >
              {downloading ? "Preparing…" : "Download PDF"}
            </button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-4 mt-6">
          {renderTopMetrics(res)}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Nutrient balance & yield
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            Chart is generated from live predictions and ready for stakeholder reporting.
          </p>
          <div style={{ width: "100%", height: 320 }}>
            <ResponsiveContainer>
              <BarChart data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#15803d" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <BaselineComparison res={res} />
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Soil health</h3>
            <p className="text-4xl font-semibold text-gray-900">
              {res.soil_health?.soil_health_index?.toFixed(2) ?? "—"}
            </p>
            <p className="text-sm text-gray-500">Composite index from our agronomy model</p>
            <ul className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600">
              {res.soil_health?.components
                ? Object.entries(res.soil_health.components).map(([k, v]) => (
                    <li key={k} className="rounded-lg bg-gray-50 px-3 py-2">
                      <span className="font-semibold">{k}:</span> {v}
                    </li>
                  ))
                : <li>No component breakdown provided.</li>}
            </ul>
          </div>

          {res.predictions?.insights?.length > 0 && (
            <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Model insights</h3>
              <ul className="space-y-3 text-sm text-gray-600">
                {res.predictions.insights.map((insight, idx) => (
                  <li key={idx} className="flex gap-2 items-start">
                    <span className="text-emerald-500 mt-0.5">💡</span> 
                    <span>{insight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Carbon & weather impact</h3>
            <p className="text-4xl font-semibold text-gray-900">
              {kgHaToKgAcre(res.carbon_kg_ha ?? res.carbon ?? 0).toFixed(1)}{" "}
              <span className="text-base text-gray-500">kg CO₂e / acre</span>
            </p>
            <p className="text-sm text-gray-500">
              Estimated carbon footprint for this nutrient plan.
            </p>
            {res.weather_risk ? (
              <div className="mt-2 rounded-2xl bg-gray-50 border border-gray-100 p-3 text-xs text-gray-700 space-y-1">
                <p>
                  <span className="font-semibold">Weather risk:</span>{" "}
                  {res.weather_risk.weather_risk_band ?? "—"}{" "}
                  {res.weather_risk.weather_risk_score != null &&
                    `(score ${res.weather_risk.weather_risk_score})`}
                </p>
                <p>
                  <span className="font-semibold">Rain next 3 days:</span>{" "}
                  {res.weather_risk.rain_mm_next3d ?? "—"} mm
                </p>
                <p>
                  <span className="font-semibold">Nitrogen loss risk:</span>{" "}
                  {res.weather_risk.nitrogen_loss_risk ?? "—"}
                </p>
                {res.weather_risk.safe_application_window && (
                  <p>
                    <span className="font-semibold">Safe application window:</span>{" "}
                    {res.weather_risk.safe_application_window}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-gray-500">
                Weather risk summary not available for this record.
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-900">
          Recommendation narrative & Fertilizer Blend Optimizer
        </h3>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          <PlanTable
            plan={res.recommendation?.plan}
            title="Fertilizer plan"
            notes={res.recommendation?.notes}
            plotData={persistedInput}
            blendData={res.fertilizer_blend}
          />
          <KeyValueCard title="Organic substitute" payload={res.organic_substitute} />
          <BlendCard
            title="Fertilizer Blend Optimizer (Real Market SKU Based)"
            blend={res.fertilizer_blend}
          />
        </div>
      </div>
    </div>

    {/* Explain Why Modal */}
    {explainModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-zoom-in relative">
          <button 
            onClick={() => setExplainModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">✨</span>
            <h3 className="text-xl font-semibold text-slate-900">AI Agronomist Explanation</h3>
          </div>
          <div className="text-slate-700 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {isExplaining ? (
              <div className="flex items-center gap-2 text-emerald-600 animate-pulse font-medium">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Analyzing prediction data...
              </div>
            ) : (
              renderSimpleMarkdown(explanation)
            )}
          </div>
        </div>
      </div>
    )}

    {/* ROI Modal */}
    {roiModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-zoom-in relative border-t-4 border-blue-500">
          <button 
            onClick={() => setRoiModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📈</span>
            <h3 className="text-xl font-semibold text-slate-900">Economic & ROI Analysis</h3>
          </div>
          <div className="text-slate-700 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {isAnalyzingRoi ? (
              <div className="flex items-center gap-2 text-blue-600 animate-pulse font-medium">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Calculating economics...
              </div>
            ) : (
              renderSimpleMarkdown(roiAnalysis)
            )}
          </div>
        </div>
      </div>
    )}

    {/* SMS Modal */}
    {smsModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-zoom-in relative border-t-4 border-orange-500">
          <button 
            onClick={() => setSmsModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">📱</span>
            <h3 className="text-xl font-semibold text-slate-900">Localized SMS Summary</h3>
          </div>
          <div className="text-slate-700 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar bg-orange-50 p-4 rounded-xl border border-orange-100">
            {isTranslating ? (
              <div className="flex items-center gap-2 text-orange-600 animate-pulse font-medium">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Translating for farmer...
              </div>
            ) : (
              renderSimpleMarkdown(smsSummary)
            )}
          </div>
        </div>
      </div>
    )}

    {/* Organic Plan Modal */}
    {organicPlanModalOpen && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-zoom-in relative border-t-4 border-green-500">
          <button 
            onClick={() => setOrganicPlanModalOpen(false)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
          <div className="flex items-center gap-3 mb-4">
            <span className="text-2xl">🌱</span>
            <h3 className="text-xl font-semibold text-slate-900">3-Year Organic Transition</h3>
          </div>
          <div className="text-slate-700 text-sm leading-relaxed max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
            {isPlanningOrganic ? (
              <div className="flex items-center gap-2 text-green-600 animate-pulse font-medium">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                Generating regenerative roadmap...
              </div>
            ) : (
              renderSimpleMarkdown(organicPlan)
            )}
          </div>
        </div>
      </div>
    )}

    {/* Floating Chatbot Widget */}
    <ChatbotWidget plotContext={persistedInput} />
    </>
  );
}

function Metric({ value, label, unit }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-3xl font-semibold text-gray-900">
        {value !== undefined && value !== null ? value.toFixed(1) : "—"}
      </p>
      <p className="text-xs text-gray-500">{unit}</p>
    </div>
  );
}

function renderTopMetrics(res) {
  const blend = res.fertilizer_blend;
  const products = blend?.products || [];

  if (products.length) {
    const findProduct = (prefix) =>
      products.find((p) => typeof p.name === "string" && p.name.startsWith(prefix));

    const urea = findProduct("Urea");
    const dap = findProduct("DAP");
    const mop = findProduct("MOP");

    return (
      <>
        <Metric value={urea?.rate_kg_acre ?? null} label="Urea (46-0-0)" unit="kg/acre" />
        <Metric value={dap?.rate_kg_acre ?? null} label="DAP (18-46-0)" unit="kg/acre" />
        <Metric value={mop?.rate_kg_acre ?? null} label="MOP (0-0-60)" unit="kg/acre" />
        <Metric
          value={kgHaToKgAcre(res.predictions?.yield_kg_ha)}
          label="Expected yield"
          unit="kg/acre"
        />
      </>
    );
  }

  // Fallback: original NPK metrics if blend not present
  return (
    <>
      <Metric
        value={kgHaToKgAcre(res.predictions?.N_kg_ha)}
        label="Nitrogen (N)"
        unit="kg/acre"
      />
      <Metric
        value={kgHaToKgAcre(res.predictions?.P_kg_ha)}
        label="Phosphorus (P)"
        unit="kg/acre"
      />
      <Metric
        value={kgHaToKgAcre(res.predictions?.K_kg_ha)}
        label="Potassium (K)"
        unit="kg/acre"
      />
      <Metric
        value={kgHaToKgAcre(res.predictions?.yield_kg_ha)}
        label="Expected yield"
        unit="kg/acre"
      />
    </>
  );
}

function KeyValueCard({ title, payload }) {
  if (!payload || (typeof payload === "object" && Object.keys(payload).length === 0)) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
        {title} not available for this record.
      </div>
    );
  }
  if (typeof payload === "string") {
    return (
      <div className="rounded-2xl border border-gray-100 p-4 text-sm text-gray-700 bg-gray-50">
        <p className="font-semibold text-gray-900 mb-1">{title}</p>
        <p>{payload}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <p className="font-semibold text-gray-900 mb-2">{title}</p>
      <ul className="space-y-2 text-sm text-gray-600">
        {Object.entries(payload).map(([k, v]) => (
          <li key={k} className="flex justify-between gap-4">
            <span className="text-gray-500">{k}</span>
            <span className="font-semibold text-gray-900">
              {typeof v === "object" ? JSON.stringify(v) : String(v)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BlendCard({ title, blend }) {
  if (!blend || typeof blend !== "object" || Object.keys(blend).length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
        {title} not available for this record.
      </div>
    );
  }

  const products = blend.products || [];

  return (
    <div className="rounded-2xl border border-gray-100 p-4 space-y-3">
      <p className="font-semibold text-gray-900 mb-1">{title}</p>
      {products.length > 0 && (
        <div className="overflow-x-auto rounded-xl border border-gray-100">
          <table className="min-w-full text-xs text-left text-gray-700">
            <thead className="bg-gray-50 text-[11px] uppercase tracking-wide text-gray-400">
              <tr>
                <th className="px-3 py-2">Product</th>
                <th className="px-3 py-2 text-right">N-P-K</th>
                <th className="px-3 py-2 text-right">Rate (kg/acre)</th>
              </tr>
            </thead>
            <tbody>
              {products.map((p) => (
                <tr key={p.name} className="border-t border-gray-100">
                  <td className="px-3 py-2">{p.name}</td>
                  <td className="px-3 py-2 text-right">
                    {p.N_pct}-{p.P_pct}-{p.K_pct}
                  </td>
                  <td className="px-3 py-2 text-right">{p.rate_kg_acre}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <pre className="bg-gray-50 rounded-xl p-3 text-[11px] overflow-auto max-h-40">
        {JSON.stringify(blend, null, 2)}
      </pre>
    </div>
  );
}

function PlanTable({ plan = [], title, notes, plotData, blendData }) {
  if (!plan || plan.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
        {title} not available for this record.
      </div>
    );
  }

  function handleDownloadCalendar() {
    let ics = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//Fertilizer Optimizer//EN\n";
    const plotName = plotData?.plot_name || plotData?.crop_type || "Plot";
    
    plan.forEach((event, idx) => {
      const date = new Date();
      date.setDate(date.getDate() + event.day);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const dtstart = `${year}${month}${day}T090000Z`;
      const dtend = `${year}${month}${day}T100000Z`;
      
      ics += "BEGIN:VEVENT\n";
      ics += `UID:fertopt-${Date.now()}-${idx}@agtech.com\n`;
      ics += `DTSTAMP:${dtstart}\n`;
      ics += `DTSTART:${dtstart}\n`;
      ics += `DTEND:${dtend}\n`;
      ics += `SUMMARY:Apply ${event.application} Fertilizer - ${plotName}\n`;
      ics += `DESCRIPTION:Application: N: ${event.N_kg_ha} kg/ha\\, P: ${event.P_kg_ha} kg/ha\\, K: ${event.K_kg_ha} kg/ha\n`;
      ics += "END:VEVENT\n";
    });
    ics += "END:VCALENDAR";
    
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Fertilizer_Plan_${plotName.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  function handleWhatsAppShare() {
    const plotName = plotData?.plot_name || plotData?.crop_type || "Plot";
    let text = `🌱 *Fertilizer Plan for ${plotName}* 🌱\n\n`;
    
    if (blendData?.products && blendData.products.length > 0) {
      text += `*Required Products (per acre):*\n`;
      blendData.products.forEach(p => {
        text += `• ${p.name}: ${p.rate_kg_acre} kg\n`;
      });
      text += `\n`;
    }
    
    text += `*Application Schedule:*\n`;
    plan.forEach(event => {
      text += `• Day ${event.day} (${event.application}): N:${event.N_kg_ha}, P:${event.P_kg_ha}, K:${event.K_kg_ha} kg/ha\n`;
    });
    
    text += `\n_Generated by Fertilizer Optimizer AI_`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  }

  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <p className="font-semibold text-gray-900 mb-2">{title}</p>
      <table className="w-full text-sm text-left text-gray-600">
        <thead>
          <tr className="text-xs uppercase text-gray-400">
            <th className="py-1">Stage</th>
            <th className="py-1">Application</th>
            <th className="py-1">N (kg/acre)</th>
            <th className="py-1">P (kg/acre)</th>
            <th className="py-1">K (kg/acre)</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((row, idx) => (
            <tr key={`${row.day}-${idx}`} className="border-t border-gray-100">
              <td className="py-2">{row.day}</td>
              <td>{row.application}</td>
              <td>{row.N_kg_ha != null ? kgHaToKgAcre(row.N_kg_ha).toFixed(1) : "—"}</td>
              <td>{row.P_kg_ha != null ? kgHaToKgAcre(row.P_kg_ha).toFixed(1) : "—"}</td>
              <td>{row.K_kg_ha != null ? kgHaToKgAcre(row.K_kg_ha).toFixed(1) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes && (
        <p className="mt-3 text-xs text-gray-500">
          {Array.isArray(notes) ? notes.join(" ") : notes}
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          onClick={handleDownloadCalendar}
          className="text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 px-3 py-1.5 rounded-lg transition border border-blue-200 flex items-center gap-1.5"
        >
          <span>📅</span> Add to Calendar
        </button>
        <button
          onClick={handleWhatsAppShare}
          className="text-xs font-semibold text-green-700 bg-green-50 hover:bg-green-100 px-3 py-1.5 rounded-lg transition border border-green-200 flex items-center gap-1.5"
        >
          <span>💬</span> Send via WhatsApp
        </button>
      </div>
    </div>
  );
}

function normalizeResultPayload(result) {
  if (!result) return null;
  const base = result.result ?? result;
  const predictions = base.predictions || base.preds || {};
  const soilHealth = base.soil_health || base.soilHealth || {};
  return {
    predictions,
    soil_health: soilHealth,
    recommendation: base.recommendation || {},
    organic_substitute: base.organic_substitute || {},
    fertilizer_blend: base.fertilizer_blend || base.product_blend || {},
    weather_risk: base.weather_risk || result.weather_risk || null,
    carbon_kg_ha:
      base.carbon_kg_ha ??
      base.carbon ??
      base.co2eq_kg_ha ??
      (typeof base.carbon === "object" ? base.carbon?.co2eq_kg_ha : undefined),
    plot_id: base.plot_id ?? result.plot_id ?? null,
    prediction_id: base.prediction_id ?? result.prediction_id ?? null,
  };
}
