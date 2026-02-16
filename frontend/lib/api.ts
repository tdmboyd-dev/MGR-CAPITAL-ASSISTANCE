import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

// Determine API base URL
// In production (browser on capitalmgr.com), use the backend directly
// In development or SSR, use relative path for Next.js rewrites
function getApiBaseUrl(): string {
  // Check for explicit env var first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return `${process.env.NEXT_PUBLIC_API_URL}/api`;
  }

  // In browser, detect production by hostname
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    if (hostname === "capitalmgr.com" || hostname === "www.capitalmgr.com") {
      return "https://api.capitalmgr.com/api";
    }
    if (hostname.includes("vercel.app")) {
      return "https://api.capitalmgr.com/api";
    }
  }

  // Default to relative path (for local dev with Next.js rewrites)
  return "/api";
}

const API_BASE_URL = getApiBaseUrl();

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  withCredentials: true, // Important for cross-origin cookies
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor - add auth token
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    if (typeof window !== "undefined") {
      const token = localStorage.getItem("accessToken");
      if (token && config.headers) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle 401 with refresh
let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // Handle 401 - try refresh token
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            if (originalRequest.headers) {
              originalRequest.headers.Authorization = `Bearer ${token}`;
            }
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Use API_BASE_URL to ensure we hit the backend, not frontend
        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, {
          withCredentials: true,
        });

        const newToken = data.accessToken;
        localStorage.setItem("accessToken", newToken);

        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }

        processQueue(null, newToken);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError as Error, null);
        // Clear auth state and redirect to login
        localStorage.removeItem("accessToken");
        if (typeof window !== "undefined") {
          window.location.href = "/auth/login";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Handle 429 - rate limited, add exponential backoff
    if (error.response?.status === 429) {
      const retryAfter = error.response.headers["retry-after"];
      console.warn(`Rate limited. Retry after: ${retryAfter}s`);
    }

    return Promise.reject(error);
  }
);

export { api };
export default api;
// Trigger redeploy Wed, Feb  4, 2026  4:38:14 AM
