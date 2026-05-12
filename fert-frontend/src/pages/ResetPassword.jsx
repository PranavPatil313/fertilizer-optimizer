// src/pages/ResetPassword.jsx
import React, { useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import axios from "axios";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");
  
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState("");
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
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:8000";
      const res = await axios.post(`${apiBase}/auth/reset-password`, { token, new_password: password });
      setMsg(res.data.message);
      setTimeout(() => navigate("/login"), 3000);
    } catch (error) {
      setErr(error.response?.data?.detail || "Failed to reset password. The link might be expired.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) return <div className="p-10 text-center text-red-600 font-semibold mt-10">Invalid or missing password reset link.</div>;

  return (
    <div className="max-w-md mx-auto mt-20 p-8 rounded-3xl bg-white shadow-sm border border-slate-100">
      <h1 className="text-2xl font-semibold text-slate-900 mb-6">Create New Password</h1>
      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="text-sm font-semibold text-slate-700">New Password</label>
          <input value={password} onChange={(e) => setPassword(e.target.value)} type="password" required className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-sm font-semibold text-slate-700">Confirm Password</label>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} type="password" required className="mt-1 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:border-emerald-500 focus:outline-none" />
        </div>
        {err && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{err}</div>}
        {msg && <div className="p-3 bg-emerald-50 text-emerald-600 text-sm rounded-xl">{msg}</div>}
        
        <button className="w-full rounded-2xl bg-emerald-600 py-3 text-sm font-semibold text-white shadow-sm hover:bg-emerald-500 disabled:opacity-70" disabled={submitting}>{submitting ? "Saving..." : "Reset Password"}</button>
      </form>
    </div>
  );
}