/**
 * API Client - STUB
 */

import axios from 'axios';

// In production, this would be your deployed backend URL
const BASE_URL = __DEV__
  ? 'http://localhost:4000/api'
  : 'https://mgr-backend.onrender.com/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Token is set directly on headers in AuthContext
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized - redirect to login
      // In production, clear stored token and navigate
    }
    return Promise.reject(error);
  }
);
