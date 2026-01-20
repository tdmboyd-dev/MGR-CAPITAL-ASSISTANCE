import { createContext, useState, ReactNode, useCallback, useEffect } from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "FOUNDER" | "ADMIN" | "EMPLOYEE" | "CLIENT";
  tier?: string | null;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );

  // Restore user from token on mount
  useEffect(() => {
    async function restoreAuth() {
      const savedToken = localStorage.getItem("token");
      if (savedToken) {
        try {
          const response = await api.get<any>("/auth/me");
          if (response.data.success && response.data.user) {
            setUser(response.data.user);
            setToken(savedToken);
          } else {
            // Token invalid, clear it
            localStorage.removeItem("token");
            setToken(null);
          }
        } catch {
          localStorage.removeItem("token");
          setToken(null);
        }
      }
      setIsLoading(false);
    }
    restoreAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post<any>("/auth/login", { email, password });
    if (!response.data.success) {
      throw new Error(response.data.error || "Login failed");
    }
    const { token: newToken, user: userData } = response.data;

    localStorage.setItem("token", newToken);
    setToken(newToken);
    setUser(userData);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isAuthenticated: !!token && !!user,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
