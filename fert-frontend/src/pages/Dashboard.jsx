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
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

const REGION_COORDS = {
  "Kolhapur": [16.7050, 74.2433],
  "Pune": [18.5204, 73.8567],
  "Sangli": [16.8524, 74.5815],
  "Satara": [17.6805, 74.0183],
  "Solapur": [17.6599, 75.9064],
};

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
  const [activeMetric, setActiveMetric] = useState("Yield");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [searchTerm, setSearchTerm] = useState("");

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

  async function handleLogHarvest(predictionId) {
    const val = window.prompt("Enter actual harvested yield (kg/ha) for this plot:");
    if (!val) return;
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      alert("Please enter a valid number.");
      return;
    }
    try {
      const token = localStorage.getItem("access_token");
      const apiBase = import.meta.env.VITE_API_URL || API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/predictions/${predictionId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ actual_yield_kg_ha: num })
      });
      if (!res.ok) throw new Error("Failed to save harvest data");
      setRefreshTick(Date.now());
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleCsvImport(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setImporting(true);
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split('\n').filter(l => l.trim().length > 0);
        if (lines.length < 2) {
          alert("CSV must have a header row and at least one data row.");
          return;
        }
        
        // Force headers to lowercase for safe mapping
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const parsedPlots = [];
        
        for (let i = 1; i < lines.length; i++) {
          const values = lines[i].split(',').map(v => v.trim());
          const plot = {};
          headers.forEach((h, idx) => { plot[h] = values[idx]; });
          parsedPlots.push(plot);
        }
        
        setImportProgress({ current: 0, total: parsedPlots.length });
        let successCount = 0;
        const token = localStorage.getItem("access_token");
        const apiBase = import.meta.env.VITE_API_URL || API_URL || "http://localhost:8000";
        
        for (let i = 0; i < parsedPlots.length; i++) {
          try {
            const p = parsedPlots[i];
            const payload = {
              plot_name: p.plot_name || `Imported Plot ${i+1}`,
              crop_type: p.crop_type || "Wheat",
              soil_type: p.soil_type || "Black",
              region: p.region || "Pune",
              avg_temp: Number(p.avg_temp) || 25,
              rainfall_mm: Number(p.rainfall_mm) || 500,
              crop_duration_days: Number(p.crop_duration_days) || 120,
              soil_N: Number(p.soil_n) || 50,
              soil_P: Number(p.soil_p) || 30,
              soil_K: Number(p.soil_k) || 100,
              pH: Number(p.ph) || 6.5,
              organic_matter_pct: Number(p.organic_matter_pct) || 1.5,
              irrigation_type: p.irrigation_type || "rainfed",
              area_acre: Number(p.area_acre) || 2.0
            };
            
            const res = await fetch(`${apiBase}/recommend`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
              body: JSON.stringify(payload)
            });
            
            if (res.ok) successCount++;
          } catch (err) {
            console.error("Failed to import plot", i, err);
          }
          setImportProgress({ current: i + 1, total: parsedPlots.length });
          // 600ms delay safely spaces requests apart to prevent 429 Rate Limits
          await new Promise(r => setTimeout(r, 600));
        }
        alert(`Successfully processed ${successCount} out of ${parsedPlots.length} plots!`);
        setRefreshTick(Date.now());
      } catch (err) {
        console.error("Import error", err);
        alert("Failed to parse CSV file.");
      } finally {
        setImporting(false);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const latestPrediction = useMemo(
    () => predictions?.[0] ?? null,
    [predictions]
  );
  const plotLookup = useMemo(() => {
    const map = new Map();
    plots.forEach((plot) => map.set(plot.id, plot));
    return map;
  }, [plots]);

  const filteredPlots = useMemo(() => {
    if (!searchTerm.trim()) return plots;
    const lower = searchTerm.toLowerCase();
    return plots.filter((p) =>
      (p.name && p.name.toLowerCase().includes(lower)) ||
      (p.data?.crop_type && p.data.crop_type.toLowerCase().includes(lower)) ||
      (p.data?.region && p.data.region.toLowerCase().includes(lower)) ||
      String(p.id).includes(lower)
    );
  }, [plots, searchTerm]);

  const filteredPredictions = useMemo(() => {
    if (!searchTerm.trim()) return predictions;
    const lower = searchTerm.toLowerCase();
    return predictions.filter((p) => {
      const plot = plotLookup.get(p.plot_id);
      const plotName = plot?.name || plot?.data?.crop_type || "";
      return (
        String(p.plot_id).includes(lower) ||
        plotName.toLowerCase().includes(lower) ||
        (p.model_version && p.model_version.toLowerCase().includes(lower))
      );
    });
  }, [predictions, plotLookup, searchTerm]);

  const trendData = useMemo(() => {
    if (!predictions || predictions.length === 0) return [];
    // Reverse to show oldest to newest left-to-right
    return [...predictions].reverse().map(p => {
       const date = new Date(p.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
       const yieldVal = p.result?.predictions?.yield_kg_ha || p.result?.preds?.yield_kg_ha || 0;
       const actualYieldVal = p.result?.feedback?.actual_yield_kg_ha || null;
       const carbonVal = p.result?.carbon_kg_ha || p.result?.carbon?.co2eq_kg_ha || p.result?.carbon || 0;
       return {
          date: date,
          Yield: yieldVal,
          ActualYield: actualYieldVal,
          Carbon: carbonVal,
       };
    }).filter(d => d.Yield > 0 || d.Carbon > 0);
  }, [predictions]);

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

      {trendData.length > 1 && (
        <div 
          className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-5 sm:p-8 flex flex-col opacity-0 animate-fade-in-up"
          style={{ animationDelay: "350ms" }}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">{activeMetric === "Yield" ? "📈" : "🌍"}</span> Historical {activeMetric === "Yield" ? "yield" : "carbon footprint"} trends
            </h3>
            <div className="flex bg-slate-100 p-1 rounded-lg">
              <button
                onClick={() => setActiveMetric("Yield")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeMetric === "Yield" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Yield (kg/ha)
              </button>
              <button
                onClick={() => setActiveMetric("Carbon")}
                className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                  activeMetric === "Carbon" ? "bg-white text-emerald-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Carbon (kg CO₂)
              </button>
            </div>
          </div>
          <div className="w-full h-[250px] sm:h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trendData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                {activeMetric === "Yield" && (
                  <Line type="monotone" name="Actual Harvest" dataKey="ActualYield" stroke="#3b82f6" strokeWidth={3} strokeDasharray="5 5" activeDot={{ r: 8 }} connectNulls animationDuration={1500} />
                )}
                <Line type="monotone" name={activeMetric === "Yield" ? "Predicted Yield" : "Carbon"} dataKey={activeMetric} stroke={activeMetric === "Yield" ? "#10b981" : "#64748b"} strokeWidth={3} activeDot={{ r: 8 }} animationDuration={1500} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {plots.length > 0 && (
        <div 
          className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-5 sm:p-8 flex flex-col opacity-0 animate-fade-in-up"
          style={{ animationDelay: "375ms" }}
        >
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">🗺️</span> Geographic distribution
            </h3>
          </div>
          <div className="w-full h-[300px] sm:h-[400px] rounded-xl overflow-hidden border border-slate-200 relative z-0">
            <MapContainer center={[17.5, 74.5]} zoom={7} scrollWheelZoom={false} style={{ height: '100%', width: '100%', zIndex: 0 }}>
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {filteredPlots.map(plot => {
                const region = plot.data?.region;
                const coords = REGION_COORDS[region];
                if (!coords) return null;
                
                // Add slight random offset to prevent exact overlapping
                const offsetLat = coords[0] + (Math.random() - 0.5) * 0.08;
                const offsetLng = coords[1] + (Math.random() - 0.5) * 0.08;

                return (
                  <CircleMarker key={plot.id} center={[offsetLat, offsetLng]} radius={8} fillColor="#10b981" color="#047857" weight={2} fillOpacity={0.7}>
                    <Popup className="rounded-xl">
                      <div className="text-sm p-1">
                        <p className="font-bold text-slate-900">{plot.name || plot.data?.crop_type}</p>
                        <p className="text-slate-600 mt-1">Region: <span className="font-medium">{region}</span></p>
                        <p className="text-slate-600">Area: <span className="font-medium">{plot.data?.area_acre} acres</span></p>
                        <button onClick={() => setSearchTerm(plot.name || String(plot.id))} className="mt-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700 transition">Filter below &rarr;</button>
                      </div>
                    </Popup>
                  </CircleMarker>
                );
              })}
            </MapContainer>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <div 
          className="rounded-2xl sm:rounded-3xl bg-white shadow-sm border border-slate-100 p-5 sm:p-8 flex flex-col opacity-0 animate-fade-in-up h-full"
          style={{ animationDelay: "400ms" }}
        >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
              <span className="text-xl">🌍</span> Saved plots
            </h3>
          <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-48">
              <input
                type="text"
                placeholder="Search plots..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-1.5 pl-8 text-sm rounded-lg border border-slate-200 bg-slate-50 focus:bg-white focus:border-emerald-500 focus:outline-none transition-colors"
              />
              <span className="absolute left-2.5 top-1.5 text-slate-400 text-xs">🔍</span>
            </div>
            <div className="flex gap-2">
            <button
              onClick={() => {
                const tmpl = "plot_name,crop_type,soil_type,region,avg_temp,rainfall_mm,crop_duration_days,soil_n,soil_p,soil_k,ph,organic_matter_pct,irrigation_type,area_acre\nField A,Sugarcane,Black,Pune,26,800,365,70,40,150,6.8,2.1,irrigated,5.0";
                const blob = new Blob([tmpl], { type: "text/csv" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "plot_import_template.csv";
                a.click();
              }}
              className="text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition border border-emerald-200"
            >
              Template
            </button>
            <label className={`cursor-pointer text-xs font-semibold text-slate-700 bg-slate-100 border border-slate-200 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition flex items-center gap-1 ${importing ? 'opacity-50 pointer-events-none' : ''}`}>
              {importing ? `Importing ${importProgress.current}/${importProgress.total}...` : "Import CSV"}
              <input type="file" accept=".csv" className="hidden" onChange={handleCsvImport} disabled={importing} />
            </label>
            </div>
          </div>
          </div>
          {status.loading ? (
            <div className="flex-1 flex items-center justify-center p-6"><p className="text-sm text-slate-500 animate-pulse">Loading plots…</p></div>
          ) : plots.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500">Nothing yet. Use “Create Plot” and run a recommendation to persist data.</p>
            </div>
        ) : filteredPlots.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
            <p className="text-sm text-slate-500">No plots match your search for "<span className="font-semibold text-slate-700">{searchTerm}</span>".</p>
          </div>
          ) : (
            <div className="space-y-3 pr-1 max-h-[32rem] overflow-y-auto">
            {filteredPlots.map((plot, idx) => (
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
            {predictions.length > 0 && (
              <button
                onClick={() => {
                  const rows = [["Date", "Plot ID", "Crop", "Yield Predicted (kg/ha)", "Actual Yield (kg/ha)", "Carbon (kg CO2e/ha)", "N (kg/ha)", "P (kg/ha)", "K (kg/ha)"]];
                  predictions.forEach(p => {
                    const plot = plots.find(pl => pl.id === p.plot_id);
                    const crop = plot?.data?.crop_type || "Unknown";
                    const date = new Date(p.created_at).toLocaleDateString();
                    const y_pred = p.result?.predictions?.yield_kg_ha?.toFixed(1) || "";
                    const y_act = p.result?.feedback?.actual_yield_kg_ha || "";
                    const co2 = p.result?.carbon_kg_ha?.toFixed(1) || "";
                    const n = p.result?.predictions?.N_kg_ha?.toFixed(1) || "";
                    const phos = p.result?.predictions?.P_kg_ha?.toFixed(1) || "";
                    const k = p.result?.predictions?.K_kg_ha?.toFixed(1) || "";
                    rows.push([date, p.plot_id, crop, y_pred, y_act, co2, n, phos, k]);
                  });
                  const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
                  const encodedUri = encodeURI(csvContent);
                  const link = document.createElement("a");
                  link.setAttribute("href", encodedUri);
                  link.setAttribute("download", "agronomy_data_export.csv");
                  document.body.appendChild(link);
                  link.click();
                  document.body.removeChild(link);
                }}
                className="text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg transition"
              >
                Export CSV
              </button>
            )}
          </div>
          {status.loading ? (
            <div className="flex-1 flex items-center justify-center p-6"><p className="text-sm text-slate-500 animate-pulse">Loading predictions…</p></div>
          ) : predictions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500">Run the recommender to populate this list.</p>
            </div>
          ) : filteredPredictions.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-200 bg-slate-50 text-center">
              <p className="text-sm text-slate-500">No predictions match your search.</p>
            </div>
          ) : (
            <ul className="space-y-3 max-h-[32rem] overflow-y-auto pr-1">
              {filteredPredictions.map((prediction, idx) => (
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
                    {!prediction.result?.feedback?.actual_yield_kg_ha ? (
                      <button
                        className="text-xs text-blue-700 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100 font-semibold hover:bg-blue-100 transition"
                        onClick={() => handleLogHarvest(prediction.id)}
                      >
                        Log actual yield
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 font-medium">
                        Actual: {prediction.result.feedback.actual_yield_kg_ha} kg/ha
                      </span>
                    )}
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
