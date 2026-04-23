// src/pages/AdminPanel.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  fetchAdminOverview,
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  fetchAdminDatasets,
  uploadAdminDataset,
  deleteDataset,
  reprocessDataset,
  fetchTrainingJobs,
  triggerTrainingJob,
  cancelTrainingJob,
  fetchAdminPlots,
  deleteAdminPlot,
  fetchAdminPredictions,
} from "../api/api";

function StatCard({ label, value, tone = "emerald" }) {
  const toneMap = {
    emerald: "text-emerald-600 bg-emerald-50",
    indigo: "text-indigo-600 bg-indigo-50",
    amber: "text-amber-600 bg-amber-50",
    slate: "text-slate-600 bg-slate-50",
  };
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${toneMap[tone] || toneMap.emerald}`}>
        {value ?? "—"}
      </p>
    </div>
  );
}

export default function AdminPanel() {
  const [overview, setOverview] = useState(null);
  const [users, setUsers] = useState([]);
  const [datasets, setDatasets] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [plots, setPlots] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [selectedDatasets, setSelectedDatasets] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [trainingStatus, setTrainingStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setError("");
    try {
      const [ov, us, ds, jb, pl, pr] = await Promise.all([
        fetchAdminOverview(),
        fetchAdminUsers(),
        fetchAdminDatasets(),
        fetchTrainingJobs(),
        fetchAdminPlots(),
        fetchAdminPredictions(),
      ]);
      setOverview(ov);
      setUsers(us);
      setDatasets(ds);
      setJobs(jb);
      setPlots(pl);
      setPredictions(pr);
    } catch (err) {
      console.error("Admin fetch failed", err);
      setError(err.response?.data?.detail || err.message || "Failed to load admin data.");
    }
  }

  async function handleDatasetUpload(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    setUploading(true);
    setError("");
    try {
      for (const file of files) {
        await uploadAdminDataset(file, { name: file.name });
      }
      await refreshDatasets();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Upload failed");
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  }

  async function refreshDatasets() {
    const ds = await fetchAdminDatasets();
    setDatasets(ds);
  }

  function toggleDatasetSelection(id) {
    setSelectedDatasets((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  }

  async function handleTrainingStart() {
    if (selectedDatasets.length === 0) {
      setError("Select at least one processed dataset.");
      return;
    }
    setTrainingStatus("Starting training...");
    setError("");
    try {
      await triggerTrainingJob({
        dataset_ids: selectedDatasets,
        model_name: "ensemble_v1",
      });
      setTrainingStatus("Training job queued.");
      setSelectedDatasets([]);
      await Promise.all([refreshDatasets(), refreshJobs()]);
    } catch (err) {
      setTrainingStatus("");
      setError(err.response?.data?.detail || err.message || "Unable to start training");
    }
  }

  async function refreshJobs() {
    const jb = await fetchTrainingJobs();
    setJobs(jb);
  }

  async function handleCancelJob(jobId) {
    const confirmed = window.confirm("Cancel this training job? This will stop the training process.");
    if (!confirmed) return;
    try {
      await cancelTrainingJob(jobId);
      // Refresh jobs to show updated status
      await refreshJobs();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to cancel job");
    }
  }

  async function handleUserRoleChange(userId, newRole) {
    try {
      await updateAdminUser(userId, { role: newRole });
      await refreshUsers();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to update user");
    }
  }

  async function handleDeleteUser(userId) {
    const confirmed = window.confirm("Delete this user and all associated data? This cannot be undone.");
    if (!confirmed) return;
    try {
      await deleteAdminUser(userId);
      await refreshAll();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to delete user");
    }
  }

  async function refreshUsers() {
    const us = await fetchAdminUsers();
    setUsers(us);
  }

  async function handleDatasetAction(datasetId, action) {
    try {
      if (action === "reprocess") {
        await reprocessDataset(datasetId);
      } else if (action === "delete") {
        await deleteDataset(datasetId);
      }
      await refreshDatasets();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Dataset action failed");
    }
  }

  async function handleDeletePlot(plotId) {
    try {
      await deleteAdminPlot(plotId);
      await refreshPlots();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Failed to delete plot");
    }
  }

  async function refreshPlots() {
    const pl = await fetchAdminPlots();
    setPlots(pl);
  }

  const processedReadyCount = useMemo(
    () => datasets.filter((ds) => ds.status === "processed" && ds.processed_path).length,
    [datasets]
  );

  const getDatasetNames = (datasetIds) => {
    if (!datasetIds || datasetIds.length === 0) return "—";
    const names = datasetIds
      .map((id) => {
        const dataset = datasets.find((d) => d.id === id);
        return dataset ? dataset.name : `ID: ${id}`;
      })
      .filter(Boolean);
    if (names.length === 0) return "—";
    const count = names.length;
    const display = names.length > 2 ? `${names[0]}, ${names[1]}... (+${count - 2})` : names.join(", ");
    return `${count} dataset${count !== 1 ? "s" : ""}: ${display}`;
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Admin Control</p>
        <h1 className="mt-2 text-3xl font-semibold">Operations Console</h1>
        <p className="mt-2 text-sm text-slate-300">
          Manage datasets, trigger ML training jobs, oversee users, plots, and predictions.
        </p>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-5">
        <StatCard label="Users" value={overview?.users} />
        <StatCard label="Plots" value={overview?.plots} tone="indigo" />
        <StatCard label="Predictions" value={overview?.predictions} tone="amber" />
        <StatCard label="Datasets" value={overview?.datasets} tone="slate" />
        <StatCard label="Training Jobs" value={overview?.training_jobs} tone="emerald" />
      </div>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Datasets</h2>
            <label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400">
              {uploading ? "Uploading…" : "Upload CSV"}
              <input
                type="file"
                className="hidden"
                accept=".csv"
                multiple
                onChange={handleDatasetUpload}
                disabled={uploading}
              />
            </label>
          </div>
          <p className="text-xs text-slate-500 mb-3">
            Upload CSV datasets (≤200 MB). Files auto-clean before training eligibility.
          </p>
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Select</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th>Rows</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset) => (
                  <tr key={dataset.id} className="border-t border-slate-100">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        disabled={dataset.status !== "processed" || !dataset.processed_path}
                        checked={selectedDatasets.includes(dataset.id)}
                        onChange={() => toggleDatasetSelection(dataset.id)}
                      />
                    </td>
                    <td className="py-2">{dataset.name}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          dataset.status === "processed"
                            ? "bg-emerald-50 text-emerald-700"
                            : dataset.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {dataset.status}
                      </span>
                    </td>
                    <td className="py-2">
                      {dataset.row_count ? dataset.row_count.toLocaleString() : "—"}
                    </td>
                    <td className="py-2 space-x-2">
                      <button
                        className="text-xs text-emerald-600 hover:underline"
                        onClick={() => handleDatasetAction(dataset.id, "reprocess")}
                      >
                        Reprocess
                      </button>
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleDatasetAction(dataset.id, "delete")}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {datasets.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No datasets uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Training Jobs</h2>
            <button
              className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
              onClick={handleTrainingStart}
              disabled={selectedDatasets.length === 0}
            >
              Train model
            </button>
          </div>
          <p className="text-xs text-slate-500 mb-2">
            Select one or more processed datasets and trigger an automated training pipeline.
          </p>
          <p className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
            Ready datasets: {processedReadyCount}
          </p>
          {trainingStatus && (
            <p className="text-xs text-emerald-600 mb-2">{trainingStatus}</p>
          )}
          <div className="max-h-80 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Job</th>
                  <th>Status</th>
                  <th>Datasets</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} className="border-t border-slate-100">
                    <td className="py-2 font-semibold text-slate-800">#{job.id}</td>
                    <td className="py-2">
                      <span
                        className={`rounded-full px-2 py-1 text-xs font-semibold ${
                          job.status === "completed"
                            ? "bg-emerald-50 text-emerald-700"
                            : job.status === "failed"
                            ? "bg-red-50 text-red-700"
                            : "bg-amber-50 text-amber-700"
                        }`}
                      >
                        {job.status}
                      </span>
                    </td>
                    <td className="py-2 text-slate-600 text-xs">
                      {getDatasetNames(job.dataset_ids)}
                    </td>
                    <td className="py-2 text-slate-500 text-xs">
                      {job.finished_at || job.started_at || "—"}
                    </td>
                    <td className="py-2">
                      {(job.status === "running" || job.status === "pending") && (
                        <button
                          onClick={() => handleCancelJob(job.id)}
                          className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                        >
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      No training jobs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <button
              className="text-sm text-emerald-600 hover:underline"
              onClick={refreshUsers}
            >
              Refresh
            </button>
          </div>
          <div className="max-h-72 overflow-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="py-2">Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t border-slate-100">
                    <td className="py-2">{user.email}</td>
                    <td className="py-2">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        value={user.role}
                        onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-2 text-xs">
                      {user.is_active ? (
                        <span className="rounded-full bg-emerald-50 px-2 py-1 font-semibold text-emerald-700">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-600">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-2">
                      <button
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => handleDeleteUser(user.id)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-4 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Plots & Predictions</h2>
            <button
              className="text-sm text-emerald-600 hover:underline"
              onClick={() => {
                refreshPlots();
                refreshAll();
              }}
            >
              Refresh
            </button>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Plots</h3>
              <div className="max-h-48 overflow-auto space-y-2 text-sm">
                {plots.map((plot) => (
                  <div
                    key={plot.id}
                    className="flex items-center justify-between rounded border border-slate-100 px-2 py-1"
                  >
                    <div>
                      <p className="font-semibold text-slate-800">#{plot.id}</p>
                      <p className="text-xs text-slate-500">{plot.name || "Untitled"}</p>
                    </div>
                    <button
                      className="text-xs text-red-600 hover:underline"
                      onClick={() => handleDeletePlot(plot.id)}
                    >
                      Delete
                    </button>
                  </div>
                ))}
                {plots.length === 0 && (
                  <p className="text-xs text-slate-500">No plots on record.</p>
                )}
              </div>
            </div>
            <div className="rounded-xl border border-slate-100 p-3">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Predictions</h3>
              <div className="max-h-48 overflow-auto space-y-2 text-sm">
                {predictions.map((prediction) => (
                  <div
                    key={prediction.id}
                    className="rounded border border-slate-100 px-2 py-1"
                  >
                    <p className="font-semibold text-slate-800">
                      Model {prediction.model_version}
                    </p>
                    <p className="text-xs text-slate-500">Plot ID {prediction.plot_id}</p>
                    <p className="text-[11px] text-slate-400">
                      {prediction.created_at || "—"}
                    </p>
                  </div>
                ))}
                {predictions.length === 0 && (
                  <p className="text-xs text-slate-500">No predictions recorded.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

