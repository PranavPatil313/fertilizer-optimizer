// src/pages/Home.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import useAuth from "../auth/useAuth";
import { API_URL, fetchPlots, fetchPredictions } from "../api/api";
import { getWorkspaceVersion, subscribeWorkspaceUpdate } from "../utils/workspaceEvents";
import { kgHaToKgAcre } from "../utils/unitConversion";

const actions = [
  {
    title: "Capture a plot",
    description: "Enter soil chemistry, climate and farm operations. The form autosaves locally.",
    to: "/create-plot",
  },
  {
    title: "Run recommendation",
    description: "Trigger the ML pipeline for nutrient plans, yield, and carbon insights.",
    to: "/recommend",
  },
  {
    title: "Review dashboard",
    description: "Browse saved plots, drill into predictions, and open PDF summaries.",
    to: "/dashboard",
  },
  {
    title: "Results workspace",
    description: "Share-ready visuals and reports for agronomy and sustainability teams.",
    to: "/results",
  },
];

export default function Home() {
  const { user } = useAuth();
  const [apiStatus, setApiStatus] = useState({ latency: null, error: "" });
  const [serverData, setServerData] = useState({
    loading: !!user,
    error: "",
    plots: 0,
    predictions: 0,
    lastPrediction: null,
  });
  const [localInput, setLocalInput] = useState(null);
  const [recentPredictions, setRecentPredictions] = useState([]);
  const [refreshTick, setRefreshTick] = useState(() => getWorkspaceVersion());
  const lastFetchRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    async function ping() {
      const started = performance.now();
      try {
        await fetch(`${API_URL}/`);
        if (!cancelled) {
          setApiStatus({ latency: Math.round(performance.now() - started), error: "" });
        }
      } catch (err) {
        if (!cancelled) {
          setApiStatus({ latency: null, error: "Temporarily unreachable" });
        }
      }
    }
    ping();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const storedInput = localStorage.getItem("plot_input");
    setLocalInput(storedInput ? JSON.parse(storedInput) : null);
    const recents = JSON.parse(localStorage.getItem("recent_predictions") || "[]");
    setRecentPredictions(recents.slice(0, 3));
  }, [refreshTick]);

  useEffect(() => {
    const unsubscribe = subscribeWorkspaceUpdate(() => {
      setRefreshTick(getWorkspaceVersion());
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (!user) {
      setServerData((prev) => ({ ...prev, loading: false }));
      return;
    }
    let active = true;
    const now = Date.now();
    if (refreshTick !== 0 && now - lastFetchRef.current < 1500) {
      return;
    }
    lastFetchRef.current = now;
    setServerData((prev) => ({ ...prev, loading: true, error: "" }));
    (async () => {
      try {
        const [plots, predictions] = await Promise.all([fetchPlots(), fetchPredictions()]);
        if (!active) return;
        setServerData({
          loading: false,
          error: "",
          plots: plots.length,
          predictions: predictions.length,
          lastPrediction: predictions[0] || null,
        });
      } catch (err) {
        if (!active) return;
        const errorMessage =
          err.response?.status === 429
            ? "Refreshing too quickly. Waiting a moment before trying again."
            : err.response?.data?.detail || err.message || "Unable to refresh right now.";
        setServerData({
          loading: false,
          error: errorMessage,
          plots: 0,
          predictions: 0,
          lastPrediction: null,
        });
      }
    })();
    return () => {
      active = false;
    };
  }, [user, refreshTick]);

  const quickActions = useMemo(
    () =>
      actions.map((action) => (
        <Link
          key={action.title}
          to={action.to}
          className="rounded-2xl border border-transparent bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent p-4 shadow-sm ring-1 ring-slate-100 hover:shadow-md transition"
        >
          <p className="text-xs uppercase tracking-wide text-slate-500">{action.title}</p>
          <p className="mt-2 text-slate-700 text-sm">{action.description}</p>
        </Link>
      )),
    []
  );

  const statusLabel = apiStatus.error ? "Attention needed" : "Operational";
  const statusTone = apiStatus.error ? "text-red-600" : "text-emerald-600";

  return (
    <div className="space-y-10">
      <section className="overflow-hidden rounded-3xl border border-transparent bg-gradient-to-r from-emerald-600 via-emerald-500 to-lime-500 p-8 text-white shadow-lg">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-100">Overview</p>
            <h1 className="mt-2 text-4xl font-semibold leading-tight">Plan resilient fertilizer programs</h1>
            <p className="mt-3 max-w-2xl text-emerald-50">
              Track inputs, generate nutrient blends, and share-ready reports from a single control
              center. Everything you need to guide agronomy decisions with confidence.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/create-plot"
                className="rounded-full bg-white/90 px-6 py-3 text-sm font-semibold text-emerald-700 shadow hover:bg-white"
              >
                Build a plot
              </Link>
              <Link
                to="/dashboard"
                className="rounded-full border border-white/40 px-6 py-3 text-sm font-semibold text-white/90 hover:border-white"
              >
                View activity
              </Link>
            </div>
          </div>
          <div className="rounded-3xl bg-white/10 p-5 backdrop-blur">
            <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">Platform status</p>
            <p className={`mt-1 text-2xl font-semibold ${statusTone}`}>{statusLabel}</p>
            <p className="text-sm text-emerald-100">
              Response time: {apiStatus.latency !== null ? `${apiStatus.latency} ms` : "monitoring"}
            </p>
            <a
              href={`${API_URL}/docs`}
              target="_blank"
              rel="noreferrer"
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-white hover:underline"
            >
              Documentation →
            </a>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">{quickActions}</section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-3xl border border-transparent bg-white/90 p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Local workspace</h2>
            {localInput && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Draft saved
              </span>
            )}
          </div>
          {localInput ? (
            <div className="mt-4 space-y-2 text-sm text-slate-600">
              <Row label="Crop" value={localInput.crop_type} />
              <Row label="Soil" value={localInput.soil_type} />
              <Row label="Area" value={`${localInput.area_acre} acres`} />
              <Link to="/create-plot" className="text-emerald-600 text-sm font-semibold hover:underline">
                Edit plot
              </Link>
            </div>
          ) : (
            <p className="text-sm text-slate-600 mt-4">No plot saved yet. Start with the form to capture field context.</p>
          )}

          <div className="mt-6">
            <h3 className="text-sm uppercase tracking-wide text-slate-500">Recent local predictions</h3>
            {recentPredictions.length === 0 ? (
              <p className="text-sm text-slate-600 mt-2">Run the recommender to populate this feed.</p>
            ) : (
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                {recentPredictions.map((rec, idx) => (
                  <li key={`${rec.name}-${idx}`} className="rounded-2xl bg-gradient-to-r from-emerald-50 to-white px-4 py-3">
                    <p className="font-semibold text-slate-900">{rec.name}</p>
                    <p className="text-xs text-slate-500">
                      {(() => {
                        const yieldAcre = kgHaToKgAcre(rec.predictions?.yield_kg_ha);
                        const carbonAcre = kgHaToKgAcre(rec.carbon_kg_ha);
                        return `Yield ${yieldAcre?.toFixed(0) ?? "—"} kg/acre • CO₂ ${carbonAcre?.toFixed(1) ?? "—"} kg/acre`;
                      })()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-transparent bg-white/90 p-6 shadow-sm ring-1 ring-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Workspace sync</h2>
            {!user && (
              <Link to="/login" className="text-sm font-semibold text-emerald-600 hover:underline">
                Sign in
              </Link>
            )}
          </div>
          {serverData.loading ? (
            <p className="text-sm text-slate-600 mt-4">Refreshing saved plots…</p>
          ) : serverData.error ? (
            <p className="text-sm text-red-600 mt-4">{serverData.error}</p>
          ) : user ? (
            <div className="mt-4 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatusTile label="Plots" value={serverData.plots} />
                <StatusTile label="Predictions" value={serverData.predictions} />
                <StatusTile
                  label="Latest update"
                  value={
                    serverData.lastPrediction?.created_at
                      ? new Date(serverData.lastPrediction.created_at).toLocaleTimeString()
                      : "—"
                  }
                />
              </div>
              {serverData.lastPrediction && (
                <div className="rounded-2xl border border-slate-100 p-4 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Most recent model run</p>
                  <p className="text-xs text-slate-500">
                    Plot #{serverData.lastPrediction.plot_id} • Model {serverData.lastPrediction.model_version}
                  </p>
                  <pre className="mt-2 text-xs bg-slate-50 rounded-xl p-3 max-h-32 overflow-auto">
                    {JSON.stringify(serverData.lastPrediction.result?.predictions, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-600 mt-4">Sign in to view synced plots, predictions, and reports.</p>
          )}
        </div>
      </section>
    </div>
  );
}

function Row({ label, value }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span className="font-semibold text-slate-900">{value}</span>
    </div>
  );
}

function StatusTile({ label, value }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3 text-center">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-2xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}