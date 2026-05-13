// src/pages/Login.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";
import axios from "axios";

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
  
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotMsg, setForgotMsg] = useState("");

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

  async function onForgotSubmit(e) {
    e.preventDefault();
    setForgotMsg("");
    setErr("");
    try {
      // Using raw axios to bypass auth interceptors
      const apiBase = (import.meta.env.VITE_API_URL || "http://localhost:8000").replace(/\/$/, "");
      const res = await axios.post(`${apiBase}/auth/forgot-password`, { email: forgotEmail });
      setForgotMsg(res.data.message);
      setTimeout(() => setShowForgot(false), 5000);
    } catch (error) {
      setErr(error.response?.data?.detail || "Failed to send reset link.");
    }
  }

  return (
    <div className="max-w-6xl mx-auto w-full grid gap-6 lg:grid-cols-2 pb-10 pt-6 sm:pt-10 items-start">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Welcome back</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Sign in to continue</h1>
        <p className="text-sm text-slate-500 mt-1">
          Access dashboards, saved plots, and PDF reports synced securely to your account.
        </p>

        {showForgot ? (
          <form onSubmit={onForgotSubmit} className="mt-8 space-y-5">
            <p className="text-sm font-semibold text-slate-800">Reset your password</p>
            <div>
              <label className="text-sm font-semibold text-slate-700">Account Email</label>
              <input
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                type="email"
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
            {forgotMsg && <p className="text-sm text-emerald-600 font-medium">{forgotMsg}</p>}
            {err && <p className="text-sm text-red-600 font-medium">{err}</p>}
            <div className="flex gap-3">
              <button
                type="submit"
                className="flex-1 rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500"
              >
                Send Reset Link
              </button>
              <button
                type="button"
                onClick={() => setShowForgot(false)}
                className="flex-1 rounded-2xl bg-slate-100 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
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
            <div className="flex items-center justify-between">
              <label className="text-sm font-semibold text-slate-700">Password</label>
              <a 
                href="#" 
                onClick={(e) => { e.preventDefault(); setShowForgot(true); }} 
                className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:underline">
                Forgot password?
              </a>
            </div>
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
        )}

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