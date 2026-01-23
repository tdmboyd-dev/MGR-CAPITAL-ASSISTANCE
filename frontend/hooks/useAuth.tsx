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
  isLoading: boolean;
  error: string | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refresh: () => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      isLoading: false,
      error: null,

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
      }),
    }
  )
);

// Context for SSR compatibility
const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const store = useAuthStore();

  // Hydrate from localStorage on mount
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (token && !store.user) {
      // Try to get user info
      api
        .get("/auth/me")
        .then(({ data }) => {
          if (data.success) {
            useAuthStore.setState({ user: data.user });
          }
        })
        .catch(() => {
          // Token invalid, clear it
          localStorage.removeItem("accessToken");
          useAuthStore.setState({ user: null, accessToken: null });
        });
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
