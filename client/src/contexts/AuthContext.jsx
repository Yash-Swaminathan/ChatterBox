import { createContext, useState, useEffect, useCallback, useRef } from 'react';
import { authAPI } from '../api/auth.api';
import { setAccessToken, clearAccessToken } from '../api/axios';
import { storage } from '../utils/storage';
import { STORAGE_KEYS } from '../utils/constants';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const refreshIntervalRef = useRef(null);

  // Initialize: Check for existing refresh token and restore session
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

        if (refreshToken) {
          // Try to refresh and get current user
          const { accessToken } = await authAPI.refreshToken(refreshToken);
          setAccessToken(accessToken);

          const userData = await authAPI.getCurrentUser();
          setUser(userData);

          // Start refresh interval
          startTokenRefresh();
        }
      } catch (err) {
        console.error('Failed to restore session:', err);
        // Clear invalid tokens
        storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
        storage.remove(STORAGE_KEYS.USER);
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();

    // Cleanup
    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, []);

  // Listen for forced logout events (from axios interceptor)
  useEffect(() => {
    const handleForceLogout = () => {
      logout();
    };

    window.addEventListener('auth:logout', handleForceLogout);
    return () => {
      window.removeEventListener('auth:logout', handleForceLogout);
    };
  }, []);

  // Auto-refresh token every 12 minutes (access token expires in 15 min)
  const startTokenRefresh = useCallback(() => {
    // Clear any existing interval
    if (refreshIntervalRef.current) {
      clearInterval(refreshIntervalRef.current);
    }

    refreshIntervalRef.current = setInterval(async () => {
      try {
        const currentRefreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);
        if (!currentRefreshToken) {
          logout();
          return;
        }
        const { accessToken } = await authAPI.refreshToken(currentRefreshToken);
        setAccessToken(accessToken);
      } catch (err) {
        console.error('Failed to refresh token:', err);
        logout();
      }
    }, 12 * 60 * 1000); // 12 minutes
  }, [logout]);

  // Register
  const register = useCallback(async (userData) => {
    try {
      setLoading(true);
      setError(null);

      const { user: newUser, accessToken, refreshToken } = await authAPI.register(userData);

      // Store tokens
      setAccessToken(accessToken);
      storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      storage.set(STORAGE_KEYS.USER, newUser);

      setUser(newUser);
      startTokenRefresh();

      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Registration failed';
      const errorCode = err.response?.data?.error?.code;
      const errorDetails = err.response?.data?.error?.details;

      setError({ message: errorMessage, code: errorCode, details: errorDetails });
      return { success: false, error: { message: errorMessage, code: errorCode, details: errorDetails } };
    } finally {
      setLoading(false);
    }
  }, [startTokenRefresh]);

  // Login
  const login = useCallback(async (credentials) => {
    try {
      setLoading(true);
      setError(null);

      const { user: loggedInUser, accessToken, refreshToken } = await authAPI.login(credentials);

      // Store tokens
      setAccessToken(accessToken);
      storage.set(STORAGE_KEYS.REFRESH_TOKEN, refreshToken);
      storage.set(STORAGE_KEYS.USER, loggedInUser);

      setUser(loggedInUser);
      startTokenRefresh();

      return { success: true };
    } catch (err) {
      const errorMessage = err.response?.data?.error?.message || 'Login failed';
      const errorCode = err.response?.data?.error?.code;

      setError({ message: errorMessage, code: errorCode });
      return { success: false, error: { message: errorMessage, code: errorCode } };
    } finally {
      setLoading(false);
    }
  }, [startTokenRefresh]);

  // Logout
  const logout = useCallback(async () => {
    try {
      const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

      if (refreshToken) {
        await authAPI.logout(refreshToken);
      }
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      // Clear everything regardless of API call success
      clearAccessToken();
      storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
      storage.remove(STORAGE_KEYS.USER);
      setUser(null);

      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
        refreshIntervalRef.current = null;
      }
    }
  }, []);

  const value = {
    user,
    loading,
    error,
    isAuthenticated: !!user,
    register,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
