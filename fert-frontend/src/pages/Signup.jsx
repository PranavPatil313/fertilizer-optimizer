// src/pages/Signup.jsx
import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState("");

  async function onSubmit(e) {
    e.preventDefault();
    setErr("");
    if (password !== confirm) {
      setErr("Passwords must match.");
      return;
    }
    setSubmitting(true);
    try {
      await signup(email, password);
      navigate("/login");
    } catch (error) {
      setErr(error.response?.data?.detail || error.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-3xl bg-white p-8 shadow-sm border border-slate-100">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-600">Get started</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-900">Create your account</h1>
        <p className="text-sm text-slate-500 mt-1">
          Create your account to save your plots, access recommendations, and download reports. Use a valid email address to get started.
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
          <div className="grid gap-4 md:grid-cols-2">
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
        <div>
              <label className="text-sm font-semibold text-slate-700">Confirm password</label>
              <input
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                type="password"
                required
                className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </div>
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
            {submitting ? "Creating…" : "Create account"}
          </button>
      </form>

        <p className="mt-6 text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-emerald-600">
            Sign in
          </Link>
        </p>
        <p className="mt-2 text-xs text-slate-500">
          Platform operator?{" "}
          <Link to="/admin-login" className="font-semibold text-slate-800 underline-offset-2 hover:underline">
            Log in as admin
          </Link>
          .
        </p>
      </div>

      <div className="rounded-3xl border border-slate-100 bg-gradient-to-b from-emerald-600 to-emerald-700 p-8 text-white">
        <p className="text-xs uppercase tracking-[0.3em] text-emerald-100">Why create an account?</p>
        <h2 className="mt-2 text-2xl font-semibold">Everything you need in one place</h2>
        <ul className="mt-6 space-y-4 text-sm text-emerald-50">
          <li>
            <span className="font-semibold text-white">Secure access</span> – Your account is protected with industry-standard security, so your data stays safe.
          </li>
          <li>
            <span className="font-semibold text-white">Saved history</span> – All your recommendations and plots are automatically saved and easy to find later.
          </li>
          <li>
            <span className="font-semibold text-white">PDF reports</span> – Generate and download professional reports to share with your team.
          </li>
        </ul>
        <div className="mt-8 rounded-2xl bg-white/10 p-4 text-sm text-emerald-50">
          <p className="text-xs uppercase tracking-wide text-emerald-100 font-semibold mb-2">Get started in seconds</p>
          <p>
            Creating an account takes less than a minute. Just enter your email and password, and you'll be ready to start optimizing your fertilizer plans right away.
          </p>
        </div>
      </div>
    </div>
  );
}
// src/pages/Signup.jsx