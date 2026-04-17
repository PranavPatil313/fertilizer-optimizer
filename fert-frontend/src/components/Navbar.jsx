// src/components/Navbar.jsx
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import useAuth from "../auth/useAuth";

const navItems = [
  { to: "/", label: "Overview", private: false },
  { to: "/dashboard", label: "Dashboard", private: true },
  { to: "/create-plot", label: "Create Plot", private: true },
  { to: "/recommend", label: "Recommend", private: true },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const isAdmin = (user?.role || "").toLowerCase() === "admin";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900">
          <span className="text-2xl">🌱</span>
          <div>
            <p className="text-sm uppercase tracking-widest text-emerald-600">Fertilizer</p>
            <p className="-mt-1 text-lg font-semibold">Optimizer</p>
          </div>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            if (item.private && !user) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-sm font-medium transition",
                    isActive
                      ? "bg-emerald-100 text-emerald-800"
                      : "text-slate-600 hover:text-emerald-700",
                  ].join(" ")
                }
              >
                {item.label}
              </NavLink>
            );
          })}
          {isAdmin && (
            <NavLink
              to="/admin"
              className={({ isActive }) =>
                [
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-emerald-100 text-emerald-800"
                    : "text-slate-600 hover:text-emerald-700",
                ].join(" ")
              }
            >
              Admin
            </NavLink>
          )}
          {!isAdmin && (
            <NavLink
              to="/admin-login"
              className={({ isActive }) =>
                [
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  isActive
                    ? "bg-slate-900 text-white"
                    : "text-slate-600 hover:text-slate-900",
                ].join(" ")
              }
            >
              Admin Login
            </NavLink>
          )}
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="hidden text-right md:block">
                <p className="text-xs uppercase text-slate-500">Signed in</p>
                <p className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                  {user.email}
                </p>
                {isAdmin && (
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600">
                    Admin
                  </p>
                )}
              </div>
              <button
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                Logout
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}