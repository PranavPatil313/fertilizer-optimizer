// src/components/Navbar.jsx
import React, { useState, useEffect } from "react";
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
  const [isDark, setIsDark] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const closeMobileMenu = () => setMobileMenuOpen(false);

  useEffect(() => {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      setIsDark(true);
    }
    
    // Initialize PWA Service Worker for Offline Capabilities
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        console.warn('Service Worker registration failed:', err);
      });
    }
  }, []);

  const toggleTheme = () => {
    if (isDark) {
      document.documentElement.classList.remove('dark');
      localStorage.theme = 'light';
      setIsDark(false);
    } else {
      document.documentElement.classList.add('dark');
      localStorage.theme = 'dark';
      setIsDark(true);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/dashboard?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      setMobileMenuOpen(false);
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      {/* Global Dark Mode CSS Overrides */}
      <style>{`
        html.dark body { background-color: #0f172a; color: #f8fafc; }
        html.dark .bg-white { background-color: #1e293b !important; }
        html.dark .text-slate-900 { color: #f8fafc !important; }
        html.dark .text-slate-800 { color: #f1f5f9 !important; }
        html.dark .text-slate-700 { color: #e2e8f0 !important; }
        html.dark .text-slate-600 { color: #cbd5e1 !important; }
        html.dark .text-slate-500 { color: #94a3b8 !important; }
        html.dark .border-slate-100 { border-color: #334155 !important; }
        html.dark .border-slate-200 { border-color: #475569 !important; }
        html.dark .bg-slate-50 { background-color: #0f172a !important; }
        html.dark .bg-slate-100 { background-color: #1e293b !important; }
        html.dark .shadow-sm { box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.5) !important; }
        html.dark input, html.dark select, html.dark textarea { background-color: #0f172a !important; color: #f8fafc !important; border-color: #475569 !important; }
        html.dark header.bg-white\\/90 { background-color: rgba(30, 41, 59, 0.9) !important; }
      `}</style>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:py-4">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2 font-semibold text-slate-900 flex-shrink-0">
          <span className="text-xl sm:text-2xl">🌱</span>
          <div>
            <p className="text-[10px] sm:text-xs uppercase tracking-widest text-emerald-600">Fertilizer</p>
            <p className="-mt-1 text-xs sm:text-lg font-semibold">Optimizer</p>
          </div>
        </Link>

        {/* Desktop/Tablet Navigation (Hidden only on mobile) */}
        <nav className="hidden flex-1 items-center justify-center gap-1 lg:gap-2 md:flex px-2 overflow-hidden">
          {navItems.map((item) => {
            if (item.private && !user) return null;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  [
                    "rounded-full px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium transition min-h-touch flex items-center whitespace-nowrap",
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
                  "rounded-full px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium transition min-h-touch flex items-center whitespace-nowrap",
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
                  "rounded-full px-3 lg:px-4 py-2 text-xs lg:text-sm font-medium transition min-h-touch flex items-center whitespace-nowrap",
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

        {/* Desktop/Tablet User Section */}
        <div className="hidden md:flex items-center gap-2 lg:gap-3 flex-shrink-0">
          <form onSubmit={handleSearch} className="relative hidden lg:block mr-2">
            <input
              type="text"
              placeholder="Search globally..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-40 xl:w-48 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
            />
          </form>
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
          <button
            onClick={toggleTheme}
            className="ml-2 rounded-full p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition flex items-center justify-center min-h-touch min-w-touch"
            aria-label="Toggle Dark Mode"
          >
            <span className="text-lg leading-none">{isDark ? "☀️" : "🌙"}</span>
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden min-h-touch min-w-touch flex items-center justify-center text-slate-600 hover:text-slate-900 transition"
          aria-label="Toggle menu"
        >
          <svg 
            className={`w-6 h-6 transition-all duration-300 ease-in-out ${mobileMenuOpen ? "rotate-90 scale-110" : "rotate-0 scale-100"}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            {mobileMenuOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </div>

      {/* Mobile Menu */}
      <div 
        className={`md:hidden grid transition-all duration-300 ease-in-out bg-white/95 backdrop-blur ${
          mobileMenuOpen ? "grid-rows-[1fr] opacity-100 border-t border-slate-200 shadow-xl" : "grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="overflow-hidden">
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
            <form onSubmit={handleSearch} className="relative mb-3">
              <input
                type="text"
                placeholder="Search globally..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-700 focus:border-emerald-500 focus:bg-white focus:outline-none"
              />
            </form>
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
            <button
              onClick={toggleTheme}
              className="mt-2 w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 transition flex justify-center items-center gap-2"
            >
              {isDark ? "☀️ Switch to Light Mode" : "🌙 Switch to Dark Mode"}
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}