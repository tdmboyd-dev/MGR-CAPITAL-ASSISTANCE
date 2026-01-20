import { createContext, useState, ReactNode, useCallback } from "react";
import { api } from "../lib/api";

interface User {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "EMPLOYEE" | "CLIENT";
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType | null>(null);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem("token")
  );

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.post("/auth/login", { email, password });
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
        isAuthenticated: !!token,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
