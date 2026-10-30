"use client";
import { apiFailure } from "@/lib/apiFailure";

import { api,clearBrowserAuthentication } from "@/lib/api";
import { createContext,ReactNode,useContext,useEffect } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface User {
  id: string;
  email: string;
  name: string;
  role: "FOUNDER" | "ADMIN" | "EMPLOYEE" | "CLIENT";
  tier?: string | null;
}

interface AuthState {
  isHydrated: boolean;
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

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      isHydrated: false,
      user: null,
      accessToken: null,
      theme: "dark",
      isLoading: false,
      error: null,

      setTheme: (theme) => {
        set({ theme });

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
        } catch (errUnknown: unknown) {
      const err = apiFailure(errUnknown);
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
        clearBrowserAuthentication();
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
          clearBrowserAuthentication();
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

  useEffect(() => {
    const cleared = () => useAuthStore.setState({ user: null, accessToken: null, error: null });
    const refreshed = (event: Event) => useAuthStore.setState({ accessToken: (event as CustomEvent<string>).detail });
    window.addEventListener('capital-auth-cleared', cleared);
    window.addEventListener('capital-auth-refreshed', refreshed);
    return () => { window.removeEventListener('capital-auth-cleared', cleared); window.removeEventListener('capital-auth-refreshed', refreshed); };
  }, []);

  useEffect(() => {
    const ready=()=>useAuthStore.setState({isHydrated:true});
    const unsubscribe=useAuthStore.persist.onFinishHydration(ready);
    if(useAuthStore.persist.hasHydrated())ready();
    return unsubscribe;
  }, []);

  // next-themes owns the DOM theme. Legacy account preferences must not race it.

  // Background validation — don't block UI if user is already cached
  useEffect(() => {
    const token = localStorage.getItem("accessToken");
    if (!token) return;

    // If user is already hydrated from Zustand persist, validate in background
    // If user is null (first visit or cleared), fetch and set user
    let disposed = false;
    const controller = new AbortController();
    const validate = async () => {
      try {
        const { data } = await api.get("/auth/me", { signal: controller.signal });
        if (disposed || localStorage.getItem("accessToken") !== token) return;
        if (data.success) {
          useAuthStore.setState({ user: data.user });
        } else {
          localStorage.removeItem("accessToken");
          useAuthStore.setState({ user: null, accessToken: null });
        }
      } catch {
        if (disposed || localStorage.getItem("accessToken") !== token) return;
        // Only clear auth if we don't have a cached user (avoid logout on network blip)
        if (!useAuthStore.getState().user) {
          localStorage.removeItem("accessToken");
          useAuthStore.setState({ user: null, accessToken: null });
        }
      }
    };

    // If no cached user, fetch immediately
    // If cached user exists, validate after a short delay (non-blocking)
    const timer = useAuthStore.getState().user ? setTimeout(validate, 2000) : undefined;
    if (!timer) void validate();
    return () => { disposed = true; controller.abort(); if (timer) clearTimeout(timer); };
  }, []);

  return <AuthContext.Provider value={store}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  const store = useAuthStore();
  return context || store;
}

export default useAuth;
