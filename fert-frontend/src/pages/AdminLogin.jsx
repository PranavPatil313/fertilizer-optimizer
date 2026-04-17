// src/pages/AdminLogin.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

export default function AdminLogin() {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    setSubmitting(true);
    try {
      const result = await login(email, password);
      const role = (result?.user?.role || "").toLowerCase();
      if (role !== "admin") {
        setErr("Admin access only. Please use an authorized admin account.");
        logout();
        return;
      }
      navigate("/admin");
    } catch (error) {
      setErr(error.response?.data?.detail || error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Administrator</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in with admin credentials</h1>
        <p className="text-sm text-slate-500 mt-1">
          This portal grants access to dataset uploads, training jobs, and user management.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <div>
            <label className="text-sm font-semibold text-slate-700">Admin email</label>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              type="email"
              required
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          <div>
            <label className="text-sm font-semibold text-slate-700">Password</label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type="password"
              required
              className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
            />
          </div>
          {err && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-600">
              {err}
            </div>
          )}
          <button
            className="w-full rounded-2xl bg-slate-900 py-3 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? "Validating…" : "Enter admin console"}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Need a regular account instead?{" "}
          <Link to="/login" className="font-semibold text-emerald-600">
            Go to user login
          </Link>
        </p>
      </div>

      <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50/60 p-8 text-sm text-slate-800">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Admin capabilities</p>
        <h2 className="mt-2 text-2xl font-semibold text-slate-900">What you can manage</h2>
        <ul className="mt-6 space-y-3">
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
            <span>Upload & preprocess training datasets up to 200 MB each.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
            <span>Trigger automated retraining jobs and monitor model artifacts.</span>
          </li>
          <li className="flex gap-3">
            <span className="mt-1 h-2 w-2 rounded-full bg-slate-500" />
            <span>Manage users, plots, predictions, and overall platform activity.</span>
          </li>
        </ul>
        <div className="mt-6 rounded-2xl bg-white/80 p-4 text-slate-700 shadow-inner">
          <p className="text-xs uppercase tracking-wide text-slate-500">Security reminder</p>
          <p>
            Only share admin credentials with trusted team members. All actions are logged via the
            admin API endpoints.
          </p>
        </div>
      </div>
    </div>
  );
}

