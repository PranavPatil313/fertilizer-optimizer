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

function StatCard({ label, value, tone = "emerald", delay = "0ms", className = "" }) {
  const toneMap = {
    emerald: "text-emerald-700 bg-emerald-50/50 border-emerald-100",
    indigo: "text-indigo-700 bg-indigo-50/50 border-indigo-100",
    amber: "text-amber-700 bg-amber-50/50 border-amber-100",
    slate: "text-slate-700 bg-slate-50/50 border-slate-100",
  };
  return (
    <div 
      className={`relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5 shadow-sm opacity-0 animate-zoom-in transition-all duration-300 hover:-translate-y-1 hover:shadow-md cursor-default flex flex-col justify-center group ${className} ${toneMap[tone]?.split(' ')[2] || 'border-slate-200'}`}
      style={{ animationDelay: delay }}
    >
      <div className={`absolute top-0 right-0 w-24 h-24 -mr-10 -mt-10 rounded-full ${toneMap[tone]?.split(' ')[1] || 'bg-emerald-50'} blur-xl transition-all duration-500 group-hover:scale-110`}></div>
      <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500 font-bold relative z-10">{label}</p>
      <p className={`mt-1 sm:mt-2 text-2xl sm:text-3xl font-bold ${toneMap[tone]?.split(' ')[0] || 'text-emerald-700'} relative z-10`}>
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
    <>
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
      <div className="max-w-6xl mx-auto w-full px-3 sm:px-6 lg:px-8 space-y-3 sm:space-y-6 pb-10 pt-0 sm:pt-4">

      <div 
        className="relative overflow-hidden rounded-2xl sm:rounded-3xl bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 sm:p-8 text-white shadow-xl opacity-0 animate-fade-in-up animate-gradient transition-all duration-500 hover:shadow-2xl"
        style={{ animationDelay: "0ms" }}
      >
        <div className="relative z-10 flex flex-row items-center sm:items-start justify-between gap-3 sm:gap-4">
          <div>
            <p className="hidden sm:block text-[10px] sm:text-xs uppercase tracking-[0.2em] sm:tracking-[0.3em] text-slate-300">Admin Control</p>
            <h1 className="text-xl sm:text-3xl font-semibold">Operations Console</h1>
            <p className="mt-0.5 sm:mt-2 text-[11px] sm:text-sm text-slate-300 max-w-2xl line-clamp-1 sm:line-clamp-none">
              Manage datasets, trigger ML training jobs, oversee users, plots, and predictions.
            </p>
          </div>
          <button 
            onClick={handleTriggerReports}
            className="rounded-full bg-white/10 hover:bg-white/20 border border-white/20 backdrop-blur p-2 sm:px-4 sm:py-2 text-xs sm:text-sm font-semibold text-white transition-all shadow-sm flex items-center gap-2 shrink-0 self-center sm:self-start"
            title="Send Weekly Reports"
          >
            <span className="text-base sm:text-lg leading-none">📧</span> <span className="hidden sm:inline">Weekly Reports</span>
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

      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-5">
        <StatCard label="Users" value={overview?.users} delay="100ms" />
        <StatCard label="Plots" value={overview?.plots} tone="indigo" delay="150ms" />
        <StatCard label="Predictions" value={overview?.predictions} tone="amber" delay="200ms" />
        <StatCard label="Datasets" value={overview?.datasets} tone="slate" delay="250ms" />
        <StatCard label="Jobs" value={overview?.training_jobs} tone="emerald" delay="300ms" className="col-span-2 md:col-span-1" />
      </div>

      <section 
        className="grid gap-5 sm:gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "400ms" }}
      >
        <div className="rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm border border-slate-100 transition-all duration-500 hover:shadow-md flex flex-col min-w-0 ring-1 ring-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Datasets</h2>
            <label className="cursor-pointer rounded-full bg-slate-50 border border-slate-200 px-4 py-2 sm:px-5 sm:py-2 text-xs sm:text-sm font-semibold text-slate-700 transition-all duration-300 hover:border-emerald-400 hover:bg-emerald-50 hover:text-emerald-700 hover:shadow-sm active:scale-95 flex items-center justify-center gap-2">
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
          <div className="max-h-60 sm:max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50/30 custom-scrollbar">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-100/50 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tl-lg">Select</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Name</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Rows</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {datasets.map((dataset, idx) => (
                  <tr 
                    key={dataset.id} 
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/80 opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 50}ms` }}
                  >
                    <td className="py-3 px-2 sm:px-3">
                      <input
                        type="checkbox"
                        disabled={dataset.status !== "processed" || !dataset.processed_path}
                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                        checked={selectedDatasets.includes(dataset.id)}
                        onChange={() => toggleDatasetSelection(dataset.id)}
                      />
                    </td>
                    <td className="py-3 px-2 sm:px-3 font-semibold text-slate-800 whitespace-nowrap">{dataset.name}</td>
                    <td className="py-3 px-2 sm:px-3 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide border ${
                          dataset.status === "processed"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : dataset.status === "failed"
                            ? "bg-red-50 text-red-700 border-red-200"
                            : "bg-amber-50 text-amber-700 border-amber-200"
                        }`}
                      >
                        {dataset.status}
                      </span>
                    </td>
                    <td className="py-3 px-2 sm:px-3 whitespace-nowrap text-slate-500 text-xs sm:text-sm">
                      {dataset.row_count ? dataset.row_count.toLocaleString() : "—"}
                    </td>
                    <td className="py-3 px-2 sm:px-3 flex gap-2 whitespace-nowrap">
                      <button
                        className="text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition-colors"
                        onClick={() => handleDatasetAction(dataset.id, "reprocess")}
                      >
                        Reprocess
                      </button>
                      <button
                        className="text-[11px] font-semibold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 px-2 py-1 rounded transition-colors"
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

        <div className="rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm border border-slate-100 transition-all duration-500 hover:shadow-md flex flex-col min-w-0 ring-1 ring-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Training Jobs</h2>
              {jobs.filter(j => j.status === "cancelled").length > 0 && (
                <button
                  onClick={() => setShowCancelledJobs(!showCancelledJobs)}
                  className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1 rounded-full transition-colors"
                >
                  {showCancelledJobs ? "Hide cancelled" : `Show cancelled (${jobs.filter(j => j.status === "cancelled").length})`}
                </button>
              )}
            </div>
            <button
              className="rounded-full bg-emerald-600 px-4 py-2 sm:px-5 sm:py-2.5 text-xs sm:text-sm font-semibold text-white transition-all duration-300 hover:bg-emerald-500 hover:-translate-y-0.5 hover:shadow-md active:scale-95 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none"
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
          <div className="max-h-60 sm:max-h-80 overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50/30 custom-scrollbar">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-100/50 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tl-lg">Job</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Datasets</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Updated</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
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
                      <td className="py-3 px-2 sm:px-3 font-bold text-slate-800 whitespace-nowrap">#{job.id}</td>
                      <td className="py-3 px-2 sm:px-3 min-w-[120px] sm:min-w-[140px]">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] sm:text-[11px] font-bold uppercase tracking-wide border ${
                            job.status === "completed"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : job.status === "failed"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : job.status === "cancelled"
                              ? "bg-slate-100 text-slate-600 border-slate-200"
                              : job.status === "running"
                              ? "bg-blue-50 text-blue-700 border-blue-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                          title={job.log}
                        >
                          {job.status}
                        </span>
                        {(job.status === "running" || job.status === "pending") && typeof job.progress === "number" && (
                          <div className="w-full mt-2 min-w-[100px] sm:min-w-[120px]">
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
                          <p className="mt-1 text-[10px] text-red-600 truncate max-w-[150px] sm:max-w-[200px]" title={job.log}>
                            {job.log}
                          </p>
                        )}
                      </td>
                      <td className="py-3 px-2 sm:px-3 text-slate-600 text-[11px] sm:text-xs whitespace-nowrap">
                        {getDatasetNames(job.dataset_ids)}
                      </td>
                      <td className="py-3 px-2 sm:px-3 text-slate-500 text-[11px] sm:text-xs whitespace-nowrap">
                        {job.finished_at || job.started_at || "—"}
                      </td>
                      <td className="py-3 px-2 sm:px-3 flex gap-2 whitespace-nowrap">
                        {(job.status === "running" || job.status === "pending") && (
                          <button
                            onClick={() => handleCancelJob(job.id)}
                            className="rounded bg-amber-50 px-2 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 hover:text-amber-800 transition-colors"
                          >
                            Cancel
                          </button>
                        )}
                        {(job.status === "failed" || job.status === "cancelled" || job.status === "completed") && (
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            className="rounded bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors"
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
        className="grid gap-5 sm:gap-6 lg:grid-cols-2 opacity-0 animate-fade-in-up"
        style={{ animationDelay: "500ms" }}
      >
        <div className="rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm border border-slate-100 transition-all duration-500 hover:shadow-md flex flex-col min-w-0 ring-1 ring-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Users</h2>
            <button
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
              onClick={refreshUsers}
            >
              Refresh
            </button>
          </div>
          <div className="max-h-60 sm:max-h-72 overflow-x-auto overflow-y-auto rounded-xl border border-slate-100 shadow-inner bg-slate-50/30 custom-scrollbar">
            <table className="w-full text-xs sm:text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 bg-slate-100/50 sticky top-0 z-10 backdrop-blur-sm">
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tl-lg">Email</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Role</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap">Status</th>
                  <th className="py-2 px-2 sm:px-3 whitespace-nowrap rounded-tr-lg">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr 
                    key={user.id} 
                    className="border-t border-slate-100 transition-colors duration-200 hover:bg-slate-50/80 opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <td className="py-3 px-2 sm:px-3 font-semibold text-slate-800 whitespace-nowrap text-xs sm:text-sm">{user.email}</td>
                    <td className="py-3 px-2 sm:px-3 whitespace-nowrap">
                      <select
                        className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs sm:text-sm font-medium focus:ring-emerald-500 focus:border-emerald-500"
                        value={user.role}
                        onChange={(e) => handleUserRoleChange(user.id, e.target.value)}
                      >
                        <option value="user">User</option>
                        <option value="admin">Admin</option>
                      </select>
                    </td>
                    <td className="py-3 px-2 sm:px-3 text-[10px] sm:text-xs whitespace-nowrap">
                      {user.is_active ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 font-bold text-emerald-700 uppercase tracking-wide">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 border border-slate-200 px-2.5 py-1 font-bold text-slate-600 uppercase tracking-wide">
                          Inactive
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 sm:px-3 whitespace-nowrap">
                      <button
                        className="rounded bg-red-50 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors"
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

        <div className="rounded-[1.5rem] bg-white p-4 sm:p-6 shadow-sm border border-slate-100 transition-all duration-500 hover:shadow-md flex flex-col min-w-0 ring-1 ring-slate-900/5">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg sm:text-xl font-semibold text-slate-900">Plots & Predictions</h2>
            <button
              className="text-[11px] font-semibold text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-full transition-colors"
              onClick={() => {
                refreshPlots();
                refreshAll();
              }}
            >
              Refresh
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Plots</h3>
              <div className="max-h-48 overflow-y-auto space-y-2 text-xs sm:text-sm pr-1 custom-scrollbar">
                {plots.map((plot, idx) => (
                  <div
                    key={plot.id}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all duration-200 hover:border-emerald-200 hover:shadow-sm opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <div>
                      <p className="font-semibold text-slate-800">#{plot.id}</p>
                      <p className="text-[11px] text-slate-500">{plot.name || "Untitled"}</p>
                    </div>
                    <button
                      className="text-[11px] font-semibold text-red-500 hover:text-red-700 bg-red-50 px-2 py-1 rounded transition-colors"
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
            <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-3 sm:p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-2">Predictions</h3>
              <div className="max-h-48 overflow-y-auto space-y-2 text-xs sm:text-sm pr-1 custom-scrollbar">
                {predictions.map((prediction, idx) => (
                  <div
                    key={prediction.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2.5 transition-all duration-200 hover:border-emerald-200 hover:shadow-sm opacity-0 animate-fade-in-right"
                    style={{ animationDelay: `${idx * 40}ms` }}
                  >
                    <p className="font-semibold text-slate-800">
                      Model {prediction.model_version}
                    </p>
                    <p className="text-[11px] text-slate-500">Plot ID: {prediction.plot_id}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {prediction.created_at ? new Date(prediction.created_at).toLocaleString() : "—"}
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
    </>
  );
}
