// src/components/Navbar.jsx
import React, { useState } from "react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const closeMobileMenu = () => setMobileMenuOpen(false);

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900 flex-shrink-0">
          <span className="text-xl sm:text-2xl">🌱</span>
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-emerald-600">Fertilizer</p>
            <p className="-mt-1 text-xs sm:text-lg font-semibold">Optimizer</p>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            if (item.private && !user) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-4 py-2 text-sm font-medium transition min-h-touch flex items-center",
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
                  "rounded-full px-4 py-2 text-sm font-medium transition min-h-touch flex items-center",
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
                  "rounded-full px-4 py-2 text-sm font-medium transition min-h-touch flex items-center",
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

        {/* Desktop User Section */}
        <div className="hidden md:flex items-center gap-3">
          {user ? (
            <>
              <div className="text-right">
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
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 min-h-touch"
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
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 min-h-touch flex items-center"
              >
                Login
              </Link>
              <Link
                to="/signup"
                className="rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 min-h-touch flex items-center"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden min-h-touch min-w-touch flex items-center justify-center text-slate-600 hover:text-slate-900 transition"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile Menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white">
          <nav className="flex flex-col divide-y divide-slate-100 px-4 py-2">
            {navItems.map((item) => {
              if (item.private && !user) return null;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    [
                      "px-4 py-3 text-sm font-medium transition block w-full text-left",
                      isActive
                        ? "bg-emerald-50 text-emerald-700 font-semibold"
                        : "text-slate-700 hover:bg-slate-50",
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
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "px-4 py-3 text-sm font-medium transition block w-full text-left",
                    isActive
                      ? "bg-emerald-50 text-emerald-700 font-semibold"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")
                }
              >
                Admin
              </NavLink>
            )}
            {!isAdmin && user && (
              <NavLink
                to="/admin-login"
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  [
                    "px-4 py-3 text-sm font-medium transition block w-full text-left",
                    isActive
                      ? "bg-slate-900 text-white font-semibold"
                      : "text-slate-700 hover:bg-slate-50",
                  ].join(" ")
                }
              >
                Admin Login
              </NavLink>
            )}
          </nav>

          {/* Mobile User Section */}
          <div className="border-t border-slate-100 px-4 py-3 space-y-2">
            {user ? (
              <>
                <div className="text-sm mb-3 pb-3 border-b border-slate-100">
                  <p className="text-xs uppercase text-slate-500">Signed in as</p>
                  <p className="font-semibold text-slate-900 break-all">{user.email}</p>
                  {isAdmin && (
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-emerald-600 mt-1">
                      Admin
                    </p>
                  )}
                </div>
                <button
                  className="w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition"
                  onClick={() => {
                    logout();
                    navigate("/login");
                    closeMobileMenu();
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={closeMobileMenu}
                  className="block w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:border-emerald-400 hover:text-emerald-700 transition text-center"
                >
                  Login
                </Link>
                <Link
                  to="/signup"
                  onClick={closeMobileMenu}
                  className="block w-full rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-500 transition text-center"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}