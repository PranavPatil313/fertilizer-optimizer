// src/utils/workspaceEvents.js
const EVENT_NAME = "fert-workspace-update";
const VERSION_KEY = "fert_workspace_version";

export function getWorkspaceVersion() {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(VERSION_KEY);
  return raw ? Number(raw) || 0 : 0;
}

export function emitWorkspaceUpdate(detail = {}) {
  if (typeof window === "undefined") return;
  const version = Date.now();
  window.sessionStorage.setItem(VERSION_KEY, String(version));
  window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: { ...detail, version } }));
}

export function subscribeWorkspaceUpdate(handler) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(EVENT_NAME, handler);
  return () => window.removeEventListener(EVENT_NAME, handler);
}

