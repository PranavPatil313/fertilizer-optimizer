// src/pages/Results.jsx
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
import { downloadReport } from "../api/api";
import useAuth from "../auth/useAuth";
import { useMemo, useState } from "react";
import { kgHaToKgAcre } from "../utils/unitConversion";

export default function Results() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const { user } = useAuth();
  const [downloading, setDownloading] = useState(false);

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
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          No recommendation selected
        </h2>
        <p className="text-gray-600">
          Run a recommendation or open one from your dashboard to review the
          production-grade analytics.
        </p>
        <button
          className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-white"
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
      <div className="max-w-3xl mx-auto bg-white p-6 rounded-xl shadow-sm">
        <h2 className="text-2xl font-semibold text-gray-900 mb-2">
          No recommendation selected
        </h2>
        <p className="text-gray-600">
          Run a recommendation or open one from your dashboard to review the
          production-grade analytics.
        </p>
        <button
          className="mt-4 rounded-lg bg-green-700 px-4 py-2 text-white"
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
      value: res.predictions?.N_kg_ha ?? res.predictions?.N ?? 0,
    },
    {
      name: "Phosphorus",
      value: res.predictions?.P_kg_ha ?? res.predictions?.P ?? 0,
    },
    {
      name: "Potassium",
      value: res.predictions?.K_kg_ha ?? res.predictions?.K ?? 0,
    },
    { name: "Yield", value: res.predictions?.yield_kg_ha ?? 0 },
  ];

  async function handleDownloadPDF() {
    setDownloading(true);
    try {
      if (!persistedInput) {
        alert("Original plot input not found. Re-run recommendation to download PDF.");
        return;
      }
      const blob = await downloadReport("/report", persistedInput, user ? localStorage.getItem("access_token") : null);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
      window.open(url, "_blank");
    } catch (err) {
      console.error(err);
      alert("Failed to download PDF.");
    } finally {
      setDownloading(false);
    }
  }

  return (
    <div className="space-y-6">
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
          <div className="flex gap-3">
            <button
              onClick={handleDownloadPDF}
              disabled={downloading}
              className="rounded-full bg-green-700 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-green-800 disabled:opacity-50"
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
            Chart is generated from live backend output and ready for stakeholder reporting.
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
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Soil health</h3>
            <p className="text-4xl font-semibold text-gray-900">
              {res.soil_health?.soil_health_index?.toFixed(2) ?? "—"}
            </p>
            <p className="text-sm text-gray-500">Composite index from backend model</p>
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

          <div className="rounded-3xl bg-white p-6 shadow-sm border border-gray-100 space-y-3">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Carbon & weather impact</h3>
            <p className="text-4xl font-semibold text-gray-900">
              {res.carbon_kg_ha ?? res.carbon ?? "—"}{" "}
              <span className="text-base text-gray-500">kg CO₂e / ha</span>
            </p>
            <p className="text-sm text-gray-500">
              Estimated from backend carbon calculator for this nutrient plan.
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
          />
          <KeyValueCard title="Organic substitute" payload={res.organic_substitute} />
          <BlendCard
            title="Fertilizer Blend Optimizer (Real Market SKU Based)"
            blend={res.fertilizer_blend}
          />
        </div>
        <div className="mt-6">
          <h4 className="text-sm uppercase tracking-wide text-gray-500 mb-2">
            Raw server response
          </h4>
          <pre className="bg-gray-50 rounded-xl p-4 text-xs overflow-auto max-h-72">
            {JSON.stringify(res, null, 2)}
          </pre>
        </div>
      </div>
    </div>
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
        {title} not provided in backend response.
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
        {title} not provided in backend response.
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
                <th className="px-3 py-2 text-right">kg/acre</th>
                <th className="px-3 py-2 text-right">kg/ha</th>
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
                  <td className="px-3 py-2 text-right">{p.rate_kg_ha}</td>
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

function PlanTable({ plan = [], title, notes }) {
  if (!plan || plan.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200 p-4 text-sm text-gray-500">
        {title} not provided in backend response.
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-gray-100 p-4">
      <p className="font-semibold text-gray-900 mb-2">{title}</p>
      <table className="w-full text-sm text-left text-gray-600">
        <thead>
          <tr className="text-xs uppercase text-gray-400">
            <th className="py-1">Stage</th>
            <th className="py-1">Application</th>
            <th className="py-1">N</th>
            <th className="py-1">P</th>
            <th className="py-1">K</th>
          </tr>
        </thead>
        <tbody>
          {plan.map((row, idx) => (
            <tr key={`${row.day}-${idx}`} className="border-t border-gray-100">
              <td className="py-2">{row.day}</td>
              <td>{row.application}</td>
              <td>{row.N_kg_ha ?? "—"}</td>
              <td>{row.P_kg_ha ?? "—"}</td>
              <td>{row.K_kg_ha ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {notes && (
        <p className="mt-3 text-xs text-gray-500">
          {Array.isArray(notes) ? notes.join(" ") : notes}
        </p>
      )}
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

