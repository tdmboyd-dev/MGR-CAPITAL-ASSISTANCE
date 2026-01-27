/**
 * Auth Context — MGR CAPITAL ASSISTANCE Mobile
 *
 * Authentication state management with:
 * - Secure token storage
 * - Auto-login on app start
 * - API token management
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import api from '../lib/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
  phone?: string;
  createdAt?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const TOKEN_KEY = 'mgr_auth_token';
const USER_KEY = 'mgr_user_data';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for stored token on app start
  useEffect(() => {
    checkStoredAuth();
  }, []);

  const checkStoredAuth = async () => {
    try {
      const token = await SecureStore.getItemAsync(TOKEN_KEY);
      const userData = await SecureStore.getItemAsync(USER_KEY);

      if (token && userData) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        setUser(JSON.parse(userData));

        // Optionally verify token is still valid
        try {
          const response = await api.get('/auth/me');
          if (response.data.user) {
            setUser(response.data.user);
            await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.data.user));
          }
        } catch (err) {
          // Token expired or invalid, clear stored data
          await clearAuth();
        }
      }
    } catch (error) {
      console.log('Error checking stored auth:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const clearAuth = async () => {
    try {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      await SecureStore.deleteItemAsync(USER_KEY);
    } catch (error) {
      console.log('Error clearing auth:', error);
    }
    delete api.defaults.headers.common['Authorization'];
    setUser(null);
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const response = await api.post('/auth/login', { email, password });
      const { user: userData, accessToken, token } = response.data;
      const authToken = accessToken || token;

      if (!authToken || !userData) {
        throw new Error('Invalid response from server');
      }

      // Store token securely
      await SecureStore.setItemAsync(TOKEN_KEY, authToken);
      await SecureStore.setItemAsync(USER_KEY, JSON.stringify(userData));

      // Set token in API client
      api.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;

      setUser(userData);
      return true;
    } catch (error: any) {
      console.log('Login error:', error.response?.data || error.message);
      throw new Error(error.response?.data?.message || 'Login failed');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      // Call logout endpoint if available
      await api.post('/auth/logout').catch(() => {});
    } catch (error) {
      // Ignore logout API errors
    }
    await clearAuth();
  };

  const refreshUser = async () => {
    try {
      const response = await api.get('/auth/me');
      if (response.data.user) {
        setUser(response.data.user);
        await SecureStore.setItemAsync(USER_KEY, JSON.stringify(response.data.user));
      }
    } catch (error) {
      console.log('Error refreshing user:', error);
    }
  };

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    refreshUser,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
