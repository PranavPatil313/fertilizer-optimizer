// src/auth/AuthProvider.jsx
import React, { createContext, useState, useEffect } from "react";
import api from "../api/api";

export const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // keep lightweight user payload
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // on mount, try to hydrate from token
    const token = localStorage.getItem("access_token");
    const userJson = localStorage.getItem("user");
    if (token && userJson) {
      try {
        setUser(JSON.parse(userJson));
      } catch {
        setUser(null);
      }
    }
    setLoading(false);
  }, []);

  async function login(email, password) {
    const res = await api.post("/auth/login", { email, password });
    const data = res.data ?? res;
    if (!data.access_token) throw new Error("Login failed: no token");

    localStorage.setItem("access_token", data.access_token);
    const storedUser = data.user ?? { email };
    localStorage.setItem("user", JSON.stringify(storedUser));
    setUser(storedUser);
    return data;
  }

  async function signup(email, password) {
    const res = await api.post("/auth/signup", { email, password });
    return res.data;
  }

  function logout() {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, signup }}>
      {children}
    </AuthContext.Provider>
  );
}