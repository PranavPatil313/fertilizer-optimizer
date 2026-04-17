// src/components/AdminRoute.jsx
import React from "react";
import { Navigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

export default function AdminRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-6">Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if ((user.role || "").toLowerCase() !== "admin") {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
}

