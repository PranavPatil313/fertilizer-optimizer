// src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

const tips = [
  "Your login information is encrypted and secure.",
  "Stay signed in automatically during your session.",
  "Access your saved recommendations and reports from any device.",
];

export default function Login() {
  const { login } = useAuth();
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
      await login(email, password);
      navigate("/dashboard");
    } catch (error) {
      setErr(error.response?.data?.detail || error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in to continue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Access dashboards, saved plots, and PDF reports synced via the FastAPI backend.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-5">
        <div>
            <label className="text-sm font-semibold text-slate-700">Email</label>
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
            className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-70"
            disabled={submitting}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
      </form>

        <p className="mt-6 text-sm text-slate-500">
          Don't have an account?{" "}
          <Link to="/signup" className="font-semibold text-emerald-600">
            Create one
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Need elevated access?{" "}
          <Link to="/admin-login" className="font-semibold text-slate-800 underline-offset-2 hover:underline">
            Log in as admin
          </Link>
        </p>
      </div>

      <div className="rounded-3xl border border-dashed border-emerald-200 bg-emerald-50/60 p-8 text-sm text-emerald-900">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Platform notes</p>
        <h2 className="mt-2 text-2xl font-semibold text-emerald-900">
          Get the most out of your account
        </h2>
        <ul className="mt-6 space-y-3">
          {tips.map((tip) => (
            <li key={tip} className="flex gap-3">
              <span className="mt-1 h-2 w-2 rounded-full bg-emerald-500" />
              <span>{tip}</span>
            </li>
          ))}
        </ul>
        <div className="mt-6 rounded-2xl bg-white/80 p-4 text-slate-700 shadow-inner">
          <p className="text-xs uppercase tracking-wide text-emerald-500 font-semibold mb-2">New to the platform?</p>
          <p className="text-sm leading-relaxed">
            Don't have an account yet? No problem!{" "}
            <Link to="/signup" className="font-semibold text-emerald-600 hover:text-emerald-700 underline-offset-2 hover:underline">
              Sign up with any email
            </Link>{" "}
            to get started instantly. If you're using a demo account, check with your administrator for login details.
          </p>
        </div>
      </div>
    </div>
  );
}
// src/pages/Login.jsx