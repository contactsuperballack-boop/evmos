import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { api } from "../api/client";

const AuthContext = createContext(null);

const STORAGE_KEY = "evmos.auth";

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (raw) {
          const parsed = JSON.parse(raw);
          setToken(parsed.token);
          setUser(parsed.user);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function signIn(newToken, newUser) {
    setToken(newToken);
    setUser(newUser);
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ token: newToken, user: newUser }));
  }

  async function signOut() {
    // Hardening pass: previously this only cleared local storage — the
    // token itself stayed valid server-side forever. Now explicitly
    // revokes it too. Best-effort: if the network call fails (offline,
    // server down), still clear local state so the user isn't stuck
    // "logged in" on this device with no way out.
    if (token) {
      try {
        await api.logout(token);
      } catch (e) {
        // Swallow — local sign-out must proceed regardless.
      }
    }
    setToken(null);
    setUser(null);
    await AsyncStorage.removeItem(STORAGE_KEY);
  }

  return (
    <AuthContext.Provider value={{ token, user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
