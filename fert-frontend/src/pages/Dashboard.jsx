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

function SummaryCard({ label, value, subtext }) {
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-gray-500">{label}</p>
      <p className="text-3xl font-semibold text-gray-900">{value}</p>
      {subtext && <p className="text-sm text-gray-500">{subtext}</p>}
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
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm p-6">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          Sign in to unlock analytics
        </h2>
        <p className="text-gray-600">
          Log in or create an account to access saved plots, recommendations, and shareable reports.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-emerald-700 to-lime-600 rounded-3xl p-6 text-white shadow-lg">
        <p className="text-sm uppercase tracking-widest text-emerald-100 mb-1">
          Operations board
        </p>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold">
              Welcome back, {user.email}
            </h1>
            <p className="text-sm text-green-100 mt-1">
              Keep an eye on plots, predictions, and generated reports from this single view.
            </p>
          </div>
          <button
            className="inline-flex items-center justify-center rounded-full bg-white/20 px-5 py-2 text-sm font-semibold backdrop-blur transition hover:bg-white/30"
            onClick={() => window.open(`${API_URL}/docs`, "_blank")}
          >
            API Reference →
          </button>
        </div>
      </div>

      {status.error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {status.error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <SummaryCard
          label="Saved plots"
          value={status.loading ? "…" : plots.length}
          subtext="Current portfolio"
        />
        <SummaryCard
          label="Predictions"
          value={status.loading ? "…" : predictions.length}
          subtext="Model runs tracked"
        />
        <SummaryCard
          label="Last activity"
          value={
            latestPrediction?.created_at
              ? new Date(latestPrediction.created_at).toLocaleString()
              : status.loading
              ? "Syncing…"
              : "No predictions yet"
          }
          subtext="Latest timestamp"
        />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Plots stored on server
            </h3>
            <span className="text-xs uppercase text-gray-500">
              Saved fields
            </span>
          </div>
          {status.loading ? (
            <p className="text-sm text-gray-500">Loading plots…</p>
          ) : plots.length === 0 ? (
            <p className="text-sm text-gray-600">
              Nothing yet. Use “Create Plot” and run a recommendation to persist
              data.
            </p>
          ) : (
            <div className="space-y-4">
              {plots.map((plot) => (
                <div
                  key={plot.id}
                  className="rounded-xl border border-gray-100 p-4 hover:border-green-200 transition"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm uppercase text-gray-500">
                        Plot #{plot.id}
                      </p>
                      <p className="text-lg font-semibold text-gray-900">
                        {plot.name || plot.data?.crop_type || "Unnamed field"}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">
                      {plot.created_at
                        ? new Date(plot.created_at).toLocaleDateString()
                        : "—"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mt-2">
                    {plot.data?.crop_type} • {plot.data?.soil_type} •{" "}
                    {plot.data?.area_acre} acres
                  </p>
                  {plot.predictions?.length > 0 && (
                    <div className="mt-3 text-xs text-gray-500">
                      {plot.predictions.length} predictions stored for this plot
                    </div>
                  )}
                  <div className="mt-3 flex justify-end">
                    <button
                      className="text-xs text-red-600 hover:underline"
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

        <div className="rounded-2xl bg-white shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Latest predictions
            </h3>
            <span className="text-xs uppercase text-gray-500">
              Model results
            </span>
          </div>
          {status.loading ? (
            <p className="text-sm text-gray-500">Loading predictions…</p>
          ) : predictions.length === 0 ? (
            <p className="text-sm text-gray-600">
              Run the recommender to populate this list.
            </p>
          ) : (
            <ul className="space-y-3 max-h-[28rem] overflow-auto pr-2">
              {predictions.map((prediction) => (
                <li
                  key={prediction.id}
                  className="rounded-xl border border-gray-100 p-4 hover:border-green-200 transition"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-gray-900">
                      Model {prediction.model_version}
                    </p>
                    <span className="text-xs text-gray-400">
                      {prediction.created_at
                        ? new Date(prediction.created_at).toLocaleTimeString()
                        : "—"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    Plot ID {prediction.plot_id}
                  </p>
                  <pre className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3 mt-2 overflow-auto max-h-40">
                    {JSON.stringify(prediction.result?.predictions, null, 2)}
                  </pre>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="text-xs text-green-700 font-semibold hover:underline"
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
