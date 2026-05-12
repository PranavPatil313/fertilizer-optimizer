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
    icon: "🌍",
  },
  {
    title: "Run recommendation",
    description: "Generate customized nutrient plans, yield estimates, and carbon insights.",
    to: "/recommend",
    icon: "⚡",
  },
  {
    title: "Review dashboard",
    description: "Browse saved plots, drill into predictions, and open PDF summaries.",
    to: "/dashboard",
    icon: "📊",
  },
  {
    title: "Results workspace",
    description: "Share-ready visuals and reports for agronomy and sustainability teams.",
    to: "/results",
    icon: "📑",
  },
];

export default function Home() {
  const { user } = useAuth();
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
          className="group relative overflow-hidden rounded-2xl sm:rounded-3xl border border-slate-100 bg-white p-5 sm:p-6 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl"
        >
          <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-2xl group-hover:scale-110 group-hover:bg-emerald-100 transition-transform duration-300">
            {action.icon}
          </div>
          <p className="text-xs uppercase tracking-wide text-slate-500">{action.title}</p>
          <p className="mt-2 text-slate-700 text-sm font-medium">{action.description}</p>
        </Link>
      )),
    []
  );

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
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .animate-float {
          animation: float 6s ease-in-out infinite;
        }
        .animate-float-delayed {
          animation: float 7s ease-in-out infinite 2s;
        }
      `}</style>

      <section className="relative overflow-hidden rounded-3xl sm:rounded-[2.5rem] bg-gradient-to-br from-emerald-800 via-emerald-600 to-teal-500 p-6 sm:p-12 text-white shadow-2xl opacity-0 animate-fade-in-up">
        {/* Decorative background shapes */}
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-white/10 blur-3xl animate-float"></div>
        <div className="absolute -bottom-24 -left-24 h-72 w-72 rounded-full bg-teal-400/20 blur-3xl animate-float-delayed"></div>

        <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs uppercase tracking-[0.4em] text-emerald-100">Overview</p>
            <h1 className="mt-3 text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight">
              Plan resilient fertilizer programs
            </h1>
            <p className="mt-4 text-sm sm:text-base text-emerald-50/90 leading-relaxed max-w-xl">
              Track inputs, generate nutrient blends, and share-ready reports from a single control
              center. Everything you need to guide agronomy decisions with confidence.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3 sm:gap-4">
              <Link
                to="/create-plot"
                className="rounded-xl sm:rounded-full bg-white px-6 py-3.5 text-center text-sm font-bold text-emerald-700 shadow-lg transition-all hover:bg-emerald-50 hover:-translate-y-0.5 hover:shadow-xl min-h-touch"
              >
                Build a plot
              </Link>
              <Link
                to="/dashboard"
                className="rounded-xl sm:rounded-full border-2 border-white/30 bg-white/10 backdrop-blur-sm px-6 py-3.5 text-center text-sm font-bold text-white transition-all hover:bg-white/20 hover:border-white/50 hover:-translate-y-0.5 min-h-touch"
              >
                View activity
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section 
        className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "150ms" }}
      >
        {quickActions}
      </section>

      <section 
        className="grid gap-4 sm:gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "300ms" }}
      >
        <div className="rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-8 shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Local workspace</h2>
            {localInput && (
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                Draft saved
              </span>
            )}
          </div>
          {localInput ? (
            <div className="mt-5 space-y-3 text-sm text-slate-600 bg-slate-50 p-4 sm:p-5 rounded-2xl border border-slate-100 flex-1">
              <Row label="Crop targeted" value={localInput.crop_type} />
              <Row label="Soil profile" value={localInput.soil_type} />
              <Row label="Field area" value={`${localInput.area_acre} acres`} />
              <div className="pt-3 mt-3 border-t border-slate-200">
                <Link to="/create-plot" className="text-emerald-600 text-sm font-semibold hover:text-emerald-700 transition flex items-center gap-1">
                Edit plot
                  <span aria-hidden="true">&rarr;</span>
              </Link>
              </div>
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500 mb-4">No plot saved yet. Start with the form to capture field context.</p>
              <Link to="/create-plot" className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 transition">Start capturing</Link>
            </div>
          )}
        </div>

        <div className="rounded-2xl sm:rounded-3xl bg-white p-5 sm:p-8 shadow-sm border border-slate-100 flex flex-col h-full">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Cloud sync</h2>
            {!user && (
              <Link to="/login" className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 transition">
                Sign in
              </Link>
            )}
          </div>
          {serverData.loading ? (
            <div className="mt-5 flex-1 flex items-center justify-center">
              <p className="text-sm text-slate-500 animate-pulse">Syncing with server...</p>
            </div>
          ) : serverData.error ? (
            <div className="mt-5 rounded-2xl bg-red-50 p-4 border border-red-100 text-sm text-red-600">
              {serverData.error}
            </div>
          ) : user ? (
            <div className="mt-5 space-y-4 flex-1 flex flex-col">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatusTile label="Plots" value={serverData.plots} />
                <StatusTile label="Predictions" value={serverData.predictions} />
                <div className="col-span-2 sm:col-span-1">
                  <StatusTile
                    label="Latest update"
                    value={
                      serverData.lastPrediction?.created_at
                        ? new Date(serverData.lastPrediction.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})
                        : "—"
                    }
                  />
                </div>
              </div>
              {serverData.lastPrediction ? (
                <div className="mt-auto rounded-2xl bg-slate-50 p-4 sm:p-5 border border-slate-100 text-sm text-slate-700">
                  <p className="font-semibold text-slate-900">Most recent model run</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Plot #{serverData.lastPrediction.plot_id} • Model {serverData.lastPrediction.model_version}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link to="/dashboard" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg border border-emerald-100 transition">View in dashboard</Link>
                  </div>
                </div>
              ) : (
                <div className="mt-auto rounded-2xl bg-slate-50 p-4 text-sm text-slate-500 text-center">
                  No server predictions yet.
                </div>
              )}
            </div>
          ) : (
            <div className="mt-5 flex-1 flex flex-col items-center justify-center p-6 sm:p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500 mb-4">Sign in to view synced plots, predictions, and generate reports.</p>
              <Link to="/login" className="rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 transition">Sign in</Link>
            </div>
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