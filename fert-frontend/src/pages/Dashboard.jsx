// src/pages/Dashboard.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  API_URL,
  fetchPlots,
  fetchPredictions,
  deletePlot,
} from "../api/api";
import useAuth from "../auth/useAuth";
import { getWorkspaceVersion, subscribeWorkspaceUpdate } from "../utils/workspaceEvents";

function SummaryCard({ label, value, subtext, delay = "0ms", icon }) {
  return (
    <div 
      className="rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 opacity-0 animate-fade-in-up flex flex-col justify-between"
      style={{ animationDelay: delay }}
    >
      <div>
        <div className="flex items-center gap-2 mb-1">
          {icon && <span className="text-lg">{icon}</span>}
          <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{label}</p>
        </div>
        <p className="text-2xl sm:text-4xl font-semibold text-slate-900 mt-2 break-words">{value}</p>
      </div>
      {subtext && <p className="text-xs sm:text-sm text-slate-500 mt-3 font-medium">{subtext}</p>}
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [plots, setPlots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [status, setStatus] = useState({ loading: true, error: "" });
  const [refreshTick, setRefreshTick] = useState(() => getWorkspaceVersion());
  const lastFetchRef = useRef(0);

  // Listen for token expiration events
  useEffect(() => {
    const handleTokenExpired = (event) => {
      const message = event.detail?.message || "Your session has expired. Please log in again.";
      setStatus({ loading: false, error: message });
      // Optionally auto-logout after showing message
      setTimeout(() => {
        logout();
      }, 3000);
    };

    window.addEventListener("auth:token-expired", handleTokenExpired);
    return () => {
      window.removeEventListener("auth:token-expired", handleTokenExpired);
    };
  }, [logout]);

  useEffect(() => {
    async function bootstrap() {
      if (!user) return;
      const now = Date.now();
      if (refreshTick !== 0 && now - lastFetchRef.current < 1500) {
        return;
      }
      lastFetchRef.current = now;
      setStatus({ loading: true, error: "" });
      try {
        const [plotsRes, predictionsRes] = await Promise.all([
          fetchPlots(),
          fetchPredictions(),
        ]);
        setPlots(plotsRes);
        setPredictions(predictionsRes);
        setStatus({ loading: false, error: "" });
      } catch (err) {
        console.error("Dashboard fetch failed", err);
        let errorMessage;
        if (err.response?.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
          // Clear user state and redirect after a delay
          setTimeout(() => {
            logout();
            window.location.href = "/";
          }, 2000);
        } else if (err.response?.status === 429) {
          errorMessage = "Refreshing too quickly. Waiting a moment before trying again.";
        } else {
          errorMessage = err.response?.data?.detail || err.message || "Unable to load data right now.";
        }
        setStatus({
          loading: false,
          error: errorMessage,
        });
      }
    }
    bootstrap();
  }, [user, refreshTick]);

  useEffect(() => {
    const unsubscribe = subscribeWorkspaceUpdate(() => {
      setRefreshTick(getWorkspaceVersion());
    });
    return unsubscribe;
  }, []);

  const latestPrediction = useMemo(
    () => predictions?.[0] ?? null,
    [predictions]
  );
  const plotLookup = useMemo(() => {
    const map = new Map();
    plots.forEach((plot) => map.set(plot.id, plot));
    return map;
  }, [plots]);

  if (!user) {
    return (
      <div className="max-w-3xl mx-auto w-full bg-white rounded-2xl sm:rounded-3xl shadow-sm p-8 sm:p-12 text-center border border-slate-100 mt-10 lg:mt-16">
        <div className="text-4xl mb-4">🔒</div>
        <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 mb-3">
          Sign in to unlock analytics
        </h2>
        <p className="text-sm sm:text-base text-slate-600 max-w-md mx-auto">
          Log in or create an account to access saved plots, recommendations, and shareable reports.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto w-full space-y-6 sm:space-y-10 pb-10 pt-4 sm:pt-6">
      <style>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        @keyframes float {
          0% { transform: translateY(0px); }
          50% { transform: translateY(-15px); }
          100% { transform: translateY(0px); }
        }
        @keyframes fadeInRight {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 7s ease-in-out infinite 2s;
        }
      `}</style>

      <section className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500 p-6 sm:p-10 text-white shadow-2xl opacity-0 animate-fade-in-up">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-float"></div>
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-delayed"></div>

        <div className="relative z-10 flex flex-col gap-6 sm:gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-xl">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-100">Operations board</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold leading-tight tracking-tight break-words">
              Welcome back,
              <span className="block text-emerald-200 mt-1">{user.email.split('@')[0]}!</span>
            </h1>
            <p className="mt-4 text-sm sm:text-base text-emerald-50/90 leading-relaxed max-w-lg">
              Keep an eye on plots, predictions, and generated reports from this single view.
            </p>
          </div>
        </div>
      </section>

      {status.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {status.error}
        </div>
      )}

      <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-3">
        <SummaryCard
          icon="🌍"
          label="Saved plots"
          value={status.loading ? "…" : plots.length}
          subtext="Current portfolio"
          delay="100ms"
        />
        <SummaryCard
          icon="⚡"
          label="Predictions"
          value={status.loading ? "…" : predictions.length}
          subtext="Model runs tracked"
          delay="200ms"
        />
        <SummaryCard
          icon="⏱️"
          label="Last activity"
          value={
            latestPrediction?.created_at
              ? new Date(latestPrediction.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
              : status.loading
              ? "Syncing…"
              : "—"
          }
          subtext="Latest timestamp"
          delay="300ms"
        />
      </div>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div 
          className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-5 sm:p-8 flex flex-col opacity-0 animate-fade-in-up h-full"
          style={{ animationDelay: "400ms" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">🌍</span> Saved plots
            </h3>
          </div>
          {status.loading ? (
            <div className="flex-1 flex items-center justify-center p-6"><p className="text-sm text-slate-500 animate-pulse">Loading plots…</p></div>
          ) : plots.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500">Nothing yet. Use “Create Plot” and run a recommendation to persist data.</p>
            </div>
          ) : (
            <div className="space-y-3 pr-1 max-h-[32rem] overflow-y-auto">
              {plots.map((plot, idx) => (
                <div
                  key={plot.id}
                  className="rounded-xl border border-slate-100 bg-slate-50/50 p-4 hover:border-emerald-200 hover:shadow-sm transition-all duration-300 opacity-0 animate-fade-in-right"
                  style={{ animationDelay: `${(idx * 50)}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-lg font-semibold text-slate-900 leading-tight">
                        {plot.name || plot.data?.crop_type || "Unnamed field"}
                      </p>
                      <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
                        Plot #{plot.id}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-slate-500 bg-white border border-slate-100 px-2 py-1 rounded-md shadow-sm">
                      {plot.created_at
                        ? new Date(plot.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 mt-3 font-medium">
                    {plot.data?.crop_type} <span className="text-slate-300 mx-1">•</span> {plot.data?.soil_type} <span className="text-slate-300 mx-1">•</span>{" "}
                    {plot.data?.area_acre} acres
                  </p>
                  {plot.predictions?.length > 0 && (
                    <div className="mt-3 text-xs text-slate-500 bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-md inline-block font-semibold">
                      {plot.predictions.length} predictions stored for this plot
                    </div>
                  )}
                  <div className="mt-4 flex justify-end">
                    <button
                      className="text-xs text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors font-semibold"
                      onClick={async () => {
                        if (!window.confirm("Delete this plot and its predictions?")) return;
                        try {
                          await deletePlot(plot.id);
                          setRefreshTick(Date.now());
                        } catch (err) {
                          alert(err.response?.data?.detail || "Failed to delete plot.");
                        }
                      }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div 
          className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-5 sm:p-8 flex flex-col opacity-0 animate-fade-in-up h-full"
          style={{ animationDelay: "500ms" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">⚡</span> Latest predictions
            </h3>
          </div>
          {status.loading ? (
            <div className="flex-1 flex items-center justify-center p-6"><p className="text-sm text-slate-500 animate-pulse">Loading predictions…</p></div>
          ) : predictions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500">Run the recommender to populate this list.</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
              {predictions.map((prediction, idx) => (
                <li
                  key={prediction.id}
                  className="rounded-xl border border-slate-100 bg-white shadow-sm p-4 hover:border-emerald-300 hover:shadow-md transition-all duration-300 opacity-0 animate-fade-in-right"
                  style={{ animationDelay: `${(idx * 50)}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900">
                      Model {prediction.model_version}
                    </p>
                    <span className="text-xs text-slate-400">
                      {prediction.created_at
                        ? new Date(prediction.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Plot ID {prediction.plot_id}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {prediction.result?.predictions && Object.entries(prediction.result.predictions).map(([k, v]) => {
                      if (v == null || typeof v === "object") return null;
                      return (
                        <span key={k} className="inline-flex items-center px-2 py-1 rounded border border-slate-100 bg-slate-50 text-[10px] sm:text-[11px] text-slate-700 font-medium">
                          <span className="text-slate-400 mr-1 uppercase tracking-wider">{k.replace('_kg_ha', '').replace('_pct', '')}</span> {typeof v === 'number' ? v.toFixed(1) : v}
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-4 flex gap-2">
                    <button
                      className="text-xs text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 font-semibold hover:bg-emerald-100 hover:text-emerald-800 transition"
                      onClick={() => {
                        const parentPlot = plotLookup.get(prediction.plot_id);
                        if (parentPlot?.data) {
                          localStorage.setItem(
                            "latest_prediction_input",
                            JSON.stringify(parentPlot.data)
                          );
                        }
                        const normalizedResult = normalizeResultPayload({
                          ...prediction.result,
                          plot_id: prediction.plot_id,
                          prediction_id: prediction.id,
                        });
                        localStorage.setItem(
                          "latest_prediction_result",
                          JSON.stringify(normalizedResult)
                        );
                        window.location.href = "/results";
                      }}
                    >
                      Open in results
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

function normalizeResultPayload(result) {
  if (!result) return null;
  const base = result.result ?? result;
  const predictions = base.predictions || base.preds || {};
  const soilHealth = base.soil_health || base.soilHealth || {};
  const carbon =
    base.carbon_kg_ha ??
    base.carbon ??
    base.co2eq_kg_ha ??
    (typeof base.carbon === "object" ? base.carbon?.co2eq_kg_ha : undefined);

  return {
    predictions,
    soil_health: soilHealth,
    recommendation: base.recommendation || {},
    organic_substitute: base.organic_substitute || {},
    carbon_kg_ha: carbon,
    plot_id: base.plot_id ?? result.plot_id ?? null,
    prediction_id: base.prediction_id ?? result.prediction_id ?? null,
  };
}
