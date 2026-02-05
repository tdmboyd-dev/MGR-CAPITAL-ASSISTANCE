"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import { createContext, useContext, useEffect, ReactNode } from "react";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "FOUNDER" | "ADMIN" | "EMPLOYEE" | "CLIENT";
  tier?: string | null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  theme: "light" | "dark";
  isLoading: boolean;
  error: string | null;
  setTheme: (theme: "light" | "dark") => void;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  clearError: () => void;
}

const getInitialTheme = (): "light" | "dark" => {
  if (typeof window !== "undefined") {
    const saved = localStorage.getItem("auth-storage");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.state?.theme) return parsed.state.theme;
      } catch {}
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return "dark";
};

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      theme: "dark",
      isLoading: false,
      error: null,

      setTheme: (theme) => {
        set({ theme });
        if (typeof document !== "undefined") {
          document.documentElement.setAttribute("data-theme", theme);
        }
      },

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const { data } = await api.post("/auth/login", { email, password });

          if (data.success) {
            localStorage.setItem("accessToken", data.accessToken);
            set({
              user: data.user,
              accessToken: data.accessToken,
              isLoading: false,
              error: null,
            });
            return true;
          } else {
            set({ isLoading: false, error: data.error || "Login failed" });
            return false;
          }
        } catch (err: any) {
          const errorMsg =
            err.response?.data?.error ||
            err.response?.data?.message ||
            "Login failed. Please try again.";
          set({ isLoading: false, error: errorMsg });
          return false;
        }
      },

      logout: async () => {
        try {
          await api.post("/auth/logout");
        } catch {
          // Ignore logout errors
        }
        localStorage.removeItem("accessToken");
        set({ user: null, accessToken: null, error: null });
      },

      refresh: async () => {
        try {
          const { data } = await api.post("/auth/refresh");
          if (data.success) {
            localStorage.setItem("accessToken", data.accessToken);
            set({ accessToken: data.accessToken });
            return true;
          }
          return false;
        } catch {
          set({ user: null, accessToken: null });
          return false;
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({
        accessToken: state.accessToken,
        user: state.user,
        theme: state.theme,
      }),
    }
  )
);

// Context for SSR compatibility
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  // Hydrate theme on mount
  useEffect(() => {
    const theme = store.theme || getInitialTheme();
    document.documentElement.setAttribute("data-theme", theme);
  }, []);

  // Background validation — don't block UI if user is already cached
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // If user is already hydrated from Zustand persist, validate in background
    // If user is null (first visit or cleared), fetch and set user
    const validate = async () => {
      try {
        const { data } = await api.get("/auth/me");
        if (data.success) {
          useAuthStore.setState({ user: data.user });
        } else {
          localStorage.removeItem("accessToken");
          useAuthStore.setState({ user: null, accessToken: null });
        }
      } catch {
        // Only clear auth if we don't have a cached user (avoid logout on network blip)
        if (!useAuthStore.getState().user) {
          localStorage.removeItem("accessToken");
          useAuthStore.setState({ user: null, accessToken: null });
        }
      }
    };

    // If no cached user, fetch immediately
    // If cached user exists, validate after a short delay (non-blocking)
    if (!store.user) {
      validate();
    } else {
      const timer = setTimeout(validate, 2000);
      return () => clearTimeout(timer);
    }
  }, []);

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  const store = useAuthStore();
  return context || store;
}

export default useAuth;
