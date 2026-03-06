import axios from 'axios';
import { API_BASE_URL, API_ENDPOINTS, ERROR_CODES, STORAGE_KEYS } from '../utils/constants';
import { storage } from '../utils/storage';

// Create axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Store access token in memory (not localStorage for security)
let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => {
  return accessToken;
};

export const clearAccessToken = () => {
  accessToken = null;
};

// Request interceptor: Add Authorization header
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor: Handle 401 and auto-refresh
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
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
  async (error) => {
    const originalRequest = error.config;

    // Handle 401 errors (token expired)
    if (error.response?.status === 401 && !originalRequest._retry) {
      const errorCode = error.response?.data?.error?.code;

      // Don't retry if it's a login/register request or invalid credentials
      if (
        originalRequest.url === API_ENDPOINTS.LOGIN ||
        originalRequest.url === API_ENDPOINTS.REGISTER ||
        errorCode === ERROR_CODES.INVALID_CREDENTIALS
      ) {
        return Promise.reject(error);
      }

      // Only auto-refresh if token expired
      if (errorCode === ERROR_CODES.TOKEN_EXPIRED) {
        if (isRefreshing) {
          // Queue this request while refresh is in progress
          return new Promise((resolve, reject) => {
            failedQueue.push({ resolve, reject });
          })
            .then((token) => {
              originalRequest.headers.Authorization = `Bearer ${token}`;
              return api(originalRequest);
            })
            .catch((err) => {
              return Promise.reject(err);
            });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        const refreshToken = storage.get(STORAGE_KEYS.REFRESH_TOKEN);

        if (!refreshToken) {
          isRefreshing = false;
          processQueue(new Error('No refresh token'), null);
          // Trigger logout (will be handled by AuthContext)
          window.dispatchEvent(new Event('auth:logout'));
          return Promise.reject(error);
        }

        try {
          // Call refresh endpoint
          const response = await axios.post(
            `${API_BASE_URL}${API_ENDPOINTS.REFRESH}`,
            { refreshToken }
          );

          const { accessToken: newAccessToken, refreshToken: newRefreshToken } = response.data.data;
          setAccessToken(newAccessToken);

          // Save new refresh token if server rotates tokens
          if (newRefreshToken) {
            storage.set(STORAGE_KEYS.REFRESH_TOKEN, newRefreshToken);
          }

          isRefreshing = false;
          processQueue(null, newAccessToken);

          // Retry original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          isRefreshing = false;
          processQueue(refreshError, null);

          // Refresh failed - logout user
          storage.remove(STORAGE_KEYS.REFRESH_TOKEN);
          storage.remove(STORAGE_KEYS.USER);
          clearAccessToken();
          window.dispatchEvent(new Event('auth:logout'));

          return Promise.reject(refreshError);
        }
      }
    }

    return Promise.reject(error);
  }
);

export default api;
