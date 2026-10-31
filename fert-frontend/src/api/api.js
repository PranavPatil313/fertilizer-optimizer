// src/api/api.js
import axios from "axios";

export const API_URL =
  (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
// VITE_* variables are public client configuration, never privileged secrets.
const API_KEY = import.meta.env.VITE_API_KEY || "";

export function getToken() {
  return (
    localStorage.getItem("access_token") ||
    localStorage.getItem("token") ||
    null
  );
}

export function buildHeaders({
  includeAuth = true,
  includeApiKey = false,
  contentType = "application/json",
} = {}) {
  const headers = {};
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  if (includeAuth) {
    const tok = getToken();
    if (tok) headers["Authorization"] = `Bearer ${tok}`;
  }
  if (includeApiKey && API_KEY) {
    headers["x-api-key"] = API_KEY;
  }
  return headers;
}

const instance = axios.create({
  baseURL: API_URL,
});

// Add response interceptor to handle 401 errors (token expiration)
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid
      const errorMessage = error.response?.data?.detail || "Token expired";
      
      // Clear expired token and user data
      localStorage.removeItem("access_token");
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      
      // Dispatch a custom event that components can listen to
      window.dispatchEvent(new CustomEvent("auth:token-expired", { 
        detail: { message: errorMessage } 
      }));
      
      // Update error message to be more user-friendly
      error.message = errorMessage;
    }
    return Promise.reject(error);
  }
);

export async function postJSON(
  path,
  body = {},
  { includeAuth = true, includeApiKey = false } = {}
) {
  return instance.post(path, body, {
    headers: buildHeaders({ includeAuth, includeApiKey }),
  });
}

export async function postBlob(
  path,
  body = {},
  { includeAuth = true, includeApiKey = false } = {}
) {
  return instance.post(path, body, {
    headers: buildHeaders({ includeAuth, includeApiKey }),
    responseType: "blob",
  });
}

export async function downloadReport(path, data, token = null) {
  const headers = buildHeaders({ includeAuth: false, includeApiKey: true });
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const response = await instance.post(path, data, {
    headers,
    responseType: "blob",
  });
  return response.data;
}

export async function recommend(input) {
  const response = await instance.post("/recommend", input, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function generateReport(data) {
  const response = await instance.post("/report", data, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
    responseType: "blob",
  });
  return response.data;
}

export async function predictNpk(payload) {
  // These endpoints don't require auth, but we'll include it if available
  const response = await instance.post("/predict", payload, {
    headers: buildHeaders({ includeAuth: false, includeApiKey: false }),
  });
  return response.data;
}

export async function fetchSoilHealth(payload) {
  // These endpoints don't require auth, but we'll include it if available
  const response = await instance.post("/soil-health", payload, {
    headers: buildHeaders({ includeAuth: false, includeApiKey: false }),
  });
  return response.data;
}

export async function fetchCarbonEstimate(payload) {
  // These endpoints don't require auth, but we'll include it if available
  const response = await instance.post("/carbon", payload, {
    headers: buildHeaders({ includeAuth: false, includeApiKey: false }),
  });
  return response.data;
}

export async function askAgronomist(payload) {
  const response = await instance.post("/chat", payload, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function explainPrediction(payload) {
  const response = await instance.post("/explain", payload, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function analyzeCropImage(file, plotData) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("plot_data", JSON.stringify(plotData || {}));
  
  const response = await instance.post("/analyze-image", formData, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true, contentType: null }),
  });
  return response.data;
}

export async function analyzeRoi(payload) {
  const response = await instance.post("/analyze-roi", payload, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function generateSmsSummary(payload) {
  const response = await instance.post("/sms-summary", payload, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function generateOrganicPlan(payload) {
  const response = await instance.post("/organic-plan", payload, {
    headers: buildHeaders({ includeAuth: true, includeApiKey: true }),
  });
  return response.data;
}

export async function fetchWeatherPreview({ region, lat, lon } = {}) {
  const params = {};
  if (lat != null && lon != null) {
    params.lat = lat;
    params.lon = lon;
  } else if (region) {
    params.region = region;
  }
  const response = await instance.get("/weather/preview", {
    params,
    headers: buildHeaders({ includeAuth: false, includeApiKey: false }),
  });
  return response.data;
}

export async function fetchPlots() {
  const response = await instance.get("/api/plots", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data?.plots ?? [];
}

export async function fetchPredictions() {
  const response = await instance.get("/api/predictions", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data?.predictions ?? [];
}

export async function deletePlot(plotId) {
  await instance.delete(`/api/plots/${plotId}`, {
    headers: buildHeaders({ includeAuth: true }),
  });
}

// --------------------------
// Admin APIs
// --------------------------

export async function fetchAdminOverview() {
  const response = await instance.get("/admin/overview", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchAdminUsers() {
  const response = await instance.get("/admin/users", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function updateAdminUser(userId, payload) {
  const response = await instance.patch(`/admin/users/${userId}`, payload, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function deleteAdminUser(userId) {
  const response = await instance.delete(`/admin/users/${userId}`, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchAdminPlots() {
  const response = await instance.get("/admin/plots", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function deleteAdminPlot(plotId) {
  const response = await instance.delete(`/admin/plots/${plotId}`, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchAdminPredictions() {
  const response = await instance.get("/admin/predictions", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchAdminDatasets() {
  const response = await instance.get("/admin/datasets", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function uploadAdminDataset(file, { name, description } = {}) {
  const formData = new FormData();
  formData.append("file", file);
  if (name) formData.append("name", name);
  if (description) formData.append("description", description);
  const response = await instance.post("/admin/datasets", formData, {
    headers: buildHeaders({ includeAuth: true, contentType: null }),
  });
  return response.data;
}

export async function reprocessDataset(datasetId) {
  const response = await instance.post(`/admin/datasets/${datasetId}/reprocess`, null, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function deleteDataset(datasetId) {
  const response = await instance.delete(`/admin/datasets/${datasetId}`, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchTrainingJobs() {
  const response = await instance.get("/admin/training-jobs", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function triggerTrainingJob(payload) {
  const response = await instance.post("/admin/train", payload, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function cancelTrainingJob(jobId) {
  const response = await instance.post(`/admin/training-jobs/${jobId}/cancel`, null, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function deleteTrainingJob(jobId) {
  const response = await instance.delete(`/admin/training-jobs/${jobId}`, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchAdminSettings() {
  const response = await instance.get("/admin/settings", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function saveAdminSettings(payload) {
  const response = await instance.post("/admin/settings", payload, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function clearAdminCache() {
  const response = await instance.post("/admin/clear-cache", null, {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function fetchSystemHealth() {
  const response = await instance.get("/admin/health", {
    headers: buildHeaders({ includeAuth: true }),
  });
  return response.data;
}

export async function downloadDatabaseBackup() {
  const response = await instance.get("/admin/backup", {
    headers: buildHeaders({ includeAuth: true }),
    responseType: "blob",
  });
  return response.data;
}

// Default export is the axios instance for convenience (api.post, api.get, etc.)
export default instance;
