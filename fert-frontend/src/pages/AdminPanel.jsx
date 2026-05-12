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
  deleteTrainingJob,
  fetchAdminPlots,
  deleteAdminPlot,
  fetchAdminPredictions,
} from "../api/api";

function StatCard({ label, value, tone = "emerald", delay = "0ms" }) {
  const toneMap = {
    emerald: "text-emerald-600 bg-emerald-50",
    indigo: "text-indigo-600 bg-indigo-50",
    amber: "text-amber-600 bg-amber-50",
    slate: "text-slate-600 bg-slate-50",
  };
  return (
    <div 
      className="rounded-2xl border border-slate-200 bg-white p-3 sm:p-4 shadow-sm opacity-0 animate-zoom-in transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:border-slate-300 cursor-default flex flex-col justify-center"
      style={{ animationDelay: delay }}
    >
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-semibold ${toneMap[tone] || toneMap.emerald}`}>
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
  const [showCancelledJobs, setShowCancelledJobs] = useState(false);

  useEffect(() => {
    refreshAll();
  }, []);

  async function refreshAll() {
    setError("");
    try {
      const results = await Promise.allSettled([
        fetchAdminOverview(),
        fetchAdminUsers(),
        fetchAdminDatasets(),
        fetchTrainingJobs(),
        fetchAdminPlots(),
        fetchAdminPredictions(),
      ]);
      
      if (results[0].status === "fulfilled") setOverview(results[0].value);
      if (results[1].status === "fulfilled") setUsers(results[1].value);
      if (results[2].status === "fulfilled") setDatasets(results[2].value);
      if (results[3].status === "fulfilled") setJobs(results[3].value);
      if (results[4].status === "fulfilled") setPlots(results[4].value);
      if (results[5].status === "fulfilled") setPredictions(results[5].value);

      const failures = results.filter((r) => r.status === "rejected");
      if (failures.length > 0) {
        console.error("Some admin fetches failed:", failures.map((f) => f.reason));
        const firstError = failures[0].reason;
        setError(firstError?.response?.data?.detail || firstError?.message || "Failed to load some admin data.");
      }
    } catch (err) {
      console.error("Admin fetch failed", err);
      setError(err.response?.data?.detail || err.message || "Failed to load admin data.");
    }
  }

  // Auto-poll if there are any active training jobs
  useEffect(() => {
    const hasActiveJobs = jobs.some((j) => j.status === "pending" || j.status === "running");
    if (!hasActiveJobs) return;
    
    const intervalId = setInterval(() => {
      refreshJobs();
    }, 2000); // 2-second polling for smooth progress
    return () => clearInterval(intervalId);
  }, [jobs]);

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

  async function handleDeleteJob(jobId) {
    const confirmed = window.confirm("Delete this training job history? This cannot be undone.");
    if (!confirmed) return;
    try {
      await deleteTrainingJob(jobId);
      await refreshJobs();
    } catch (err) {
      setError(err.response?.data?.detail || err.message || "Unable to delete job");
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

  async function handleTriggerReports() {
    const confirmed = window.confirm("Send weekly summary emails to all active users?");
    if (!confirmed) return;
    try {
      const token = localStorage.getItem("access_token");
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await fetch(`${apiBase}/admin/trigger-weekly-reports`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || "Failed to trigger reports");
      }
      alert("Weekly reports triggered successfully! Check server logs for the email stubs.");
    } catch (err) {
      setError(err.message);
    }
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
    <div className="max-w-6xl mx-auto w-full space-y-6 sm:space-y-8 pb-10 pt-4 sm:pt-6">
      <style>{`
        @keyframes fadeInUp {
          0% { opacity: 0; transform: translateY(20px) scale(0.98); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes fadeInRight {
          0% { opacity: 0; transform: translateX(-10px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        .animate-fade-in-right {
          animation: fadeInRight 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes zoomIn {
          0% { opacity: 0; transform: scale(0.95); }
          100% { opacity: 1; transform: scale(1); }
        }
        .animate-zoom-in {
          animation: zoomIn 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-gradient {
          background-size: 200% 200%;
          animation: gradientShift 8s ease infinite;
        }
      `}</style>

      <div 
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6 sm:p-8 text-white shadow-xl opacity-0 animate-fade-in-up animate-gradient transition-all duration-500 hover:shadow-2xl"
        style={{ animationDelay: "0ms" }}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-slate-300">Admin Control</p>
        <h1 className="mt-2 text-2xl sm:text-3xl font-semibold">Operations Console</h1>
        <p className="mt-2 text-sm text-slate-300 max-w-2xl">
          Manage datasets, trigger ML training jobs, oversee users, plots, and predictions.
        </p>
        <div className="absolute top-6 right-6 sm:top-8 sm:right-8 z-10">
          <button 
            onClick={handleTriggerReports}
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur px-4 py-2 text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-2"
          >
            <span className="text-lg">📧</span> <span className="hidden sm:inline">Send Weekly Reports</span>
          </button>
        </div>
        {/* Subtle decorative glow */}
        <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-emerald-500/10 blur-3xl"></div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:gap-4 sm:grid-cols-3 md:grid-cols-5">
        <StatCard label="Users" value={overview?.users} delay="100ms" />
        <StatCard label="Plots" value={overview?.plots} tone="indigo" delay="150ms" />
        <StatCard label="Predictions" value={overview?.predictions} tone="amber" delay="200ms" />
        <StatCard label="Datasets" value={overview?.datasets} tone="slate" delay="250ms" />
        <StatCard label="Training Jobs" value={overview?.training_jobs} tone="emerald" delay="300ms" />
      </div>

      <section 
        className="grid gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "400ms" }}
      >
        <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-lg flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-lg font-semibold text-slate-900">Datasets</h2>
            <label className="cursor-pointer rounded-full border border-slate-300 px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-slate-700 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-md active:scale-95 flex items-center justify-center gap-2">
              {uploading ? (
                <>
                  <svg className="animate-spin h-4 w-4 text-emerald-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"></path>
                  </svg>
                  Uploading…
                </>
              ) : "Upload CSV"}
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
          <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-slate-50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="py-2 px-3 whitespace-nowrap rounded-tl-lg">Select</th>
                  <th className="py-2 px-3 whitespace-nowrap">Name</th>
                  <th className="py-2 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-3 whitespace-nowrap">Rows</th>
                  <th className="py-2 px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset, idx) => (
                  <tr 
                    key={dataset.id} 
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/80 opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="py-3 px-3">
                      <input
                        type="checkbox"
                        disabled={dataset.status !== "processed" || !dataset.processed_path}
                        checked={selectedDatasets.includes(dataset.id)}
                        onChange={() => toggleDatasetSelection(dataset.id)}
                      />
                    </td>
                    <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">{dataset.name}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
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
                    <td className="py-3 px-3 whitespace-nowrap text-slate-500">
                      {dataset.row_count ? dataset.row_count.toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-3 space-x-3 whitespace-nowrap">
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
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      No datasets uploaded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-lg flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg font-semibold text-slate-900">Training Jobs</h2>
              {jobs.filter(j => j.status === "cancelled").length > 0 && (
                <button
                  onClick={() => setShowCancelledJobs(!showCancelledJobs)}
                  className="text-xs text-slate-500 hover:text-slate-700 bg-slate-100 px-2 py-1 rounded-full transition-colors"
                >
                  {showCancelledJobs ? "Hide cancelled" : `Show cancelled (${jobs.filter(j => j.status === "cancelled").length})`}
                </button>
              )}
            </div>
            <button
              className="rounded-full bg-emerald-600 px-4 py-2 sm:px-5 sm:py-2.5 text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-500 hover:-translate-y-0.5 hover:shadow-lg active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
          <div className="max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-slate-50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="py-2 px-3 whitespace-nowrap rounded-tl-lg">Job</th>
                  <th className="py-2 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-3 whitespace-nowrap">Datasets</th>
                  <th className="py-2 px-3 whitespace-nowrap">Updated</th>
                  <th className="py-2 px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {jobs
                  .filter(job => showCancelledJobs || job.status !== "cancelled")
                  .map((job, idx) => (
                    <tr 
                      key={job.id} 
                      className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/80 opacity-0 animate-fade-in-right"
                      style={{ animationDelay: `${idx * 50}ms` }}
                    >
                      <td className="py-3 px-3 font-semibold text-slate-800 whitespace-nowrap">#{job.id}</td>
                      <td className="py-3 px-3 min-w-[140px]">
                        <span
                          className={`rounded-full px-2 py-1 text-xs font-semibold ${
                            job.status === "completed"
                              ? "bg-emerald-50 text-emerald-700"
                              : job.status === "failed"
                              ? "bg-red-50 text-red-700"
                              : job.status === "cancelled"
                              ? "bg-slate-100 text-slate-600"
                              : job.status === "running"
                              ? "bg-blue-50 text-blue-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                          title={job.log}
                        >
                          {job.status}
                        </span>
                        {(job.status === "running" || job.status === "pending") && typeof job.progress === "number" && (
                          <div className="w-full mt-2 min-w-[120px]">
                            <div className="flex justify-between text-[10px] mb-1 text-slate-500 font-medium">
                              <span>Progress</span>
                              <span>{job.progress}%</span>
                            </div>
                            <div className="w-full bg-slate-200 rounded-full h-1.5 overflow-hidden relative">
                              <div 
                                className="bg-emerald-500 h-1.5 rounded-full transition-all duration-700 ease-out"
                                style={{ width: `${job.progress}%` }}
                              >
                                {/* Animated pulse overlay when running */}
                                {job.status === "running" && (
                                  <div className="absolute inset-0 bg-white/30 animate-pulse rounded-full" style={{ width: `${job.progress}%` }}></div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}
                        {job.status === "failed" && job.log && (
                          <p className="mt-1 text-[10px] text-red-600 truncate max-w-[200px]" title={job.log}>
                            {job.log}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-3 text-slate-600 text-xs whitespace-nowrap">
                        {getDatasetNames(job.dataset_ids)}
                      </td>
                      <td className="py-3 px-3 text-slate-500 text-xs whitespace-nowrap">
                        {job.finished_at || job.started_at || "—"}
                      </td>
                      <td className="py-3 px-3 space-x-2 whitespace-nowrap">
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                          >
                            Cancel
                          </button>
                        )}
                        {(job.status === "failed" || job.status === "cancelled" || job.status === "completed") && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-100"
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                {jobs.filter(job => showCancelledJobs || job.status !== "cancelled").length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500">
                      {showCancelledJobs ? "No training jobs (including cancelled)." : "No active training jobs."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section 
        className="grid gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "500ms" }}
      >
        <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-lg">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Users</h2>
            <button
              className="text-sm text-emerald-600 hover:underline px-2 py-1"
              onClick={refreshUsers}
            >
              Refresh
            </button>
          </div>
          <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-xl border border-slate-50">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 bg-slate-50">
                  <th className="py-2 px-3 whitespace-nowrap rounded-tl-lg">Email</th>
                  <th className="py-2 px-3 whitespace-nowrap">Role</th>
                  <th className="py-2 px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr 
                    key={user.id} 
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/80 opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="py-3 px-3 font-medium text-slate-700 whitespace-nowrap">{user.email}</td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <select
                        className="rounded border border-slate-300 px-2 py-1 text-sm"
                        value={user.role}
                        onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-3 text-xs whitespace-nowrap">
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
                    <td className="py-3 px-3 whitespace-nowrap">
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
                    <td colSpan={4} className="py-8 text-center text-slate-500">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 transition-all duration-500 hover:shadow-lg flex flex-col">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg font-semibold text-slate-900">Plots & Predictions</h2>
            <button
              className="text-sm text-emerald-600 hover:underline px-2 py-1"
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
              <div className="max-h-48 overflow-y-auto space-y-2 text-sm pr-1">
                {plots.map((plot, idx) => (
                  <div
                    key={plot.id}
                    className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-2 transition-all duration-200 hover:bg-slate-50 hover:shadow-sm opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
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
              <div className="max-h-48 overflow-y-auto space-y-2 text-sm pr-1">
                {predictions.map((prediction, idx) => (
                  <div
                    key={prediction.id}
                    className="rounded-lg border border-slate-100 px-3 py-2 transition-all duration-200 hover:bg-slate-50 hover:shadow-sm opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
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
