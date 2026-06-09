import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { storage } from "@/src/utils/storage";

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || "";
const TOKEN_KEY = "ans_auth_token";

export type User = {
  id: string;
  username: string;
  full_name: string;
  role: "admin" | "employee";
  created_at: string;
};

type AuthState = {
  loading: boolean;
  token: string | null;
  user: User | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  apiFetch: (path: string, opts?: RequestInit) => Promise<Response>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const apiFetch = useCallback(
    async (path: string, opts: RequestInit = {}) => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...((opts.headers as Record<string, string>) || {}),
      };
      if (token) headers.Authorization = `Bearer ${token}`;
      return fetch(`${BACKEND}${path}`, { ...opts, headers });
    },
    [token]
  );

  useEffect(() => {
    (async () => {
      try {
        const saved = await storage.secureGet<string>(TOKEN_KEY, "");
        if (saved) {
          const res = await fetch(`${BACKEND}/api/auth/me`, {
            headers: { Authorization: `Bearer ${saved}` },
          });
          if (res.ok) {
            const u = (await res.json()) as User;
            setToken(saved);
            setUser(u);
          } else {
            await storage.secureRemove(TOKEN_KEY);
          }
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    const res = await fetch(`${BACKEND}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail || "فشل تسجيل الدخول");
    }
    const data = await res.json();
    await storage.secureSet(TOKEN_KEY, data.access_token);
    setToken(data.access_token);
    setUser(data.user);
  }, []);

  const signOut = useCallback(async () => {
    await storage.secureRemove(TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, token, user, signIn, signOut, apiFetch }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
