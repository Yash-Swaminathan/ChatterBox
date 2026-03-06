import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export const authAPI = {
  async register(userData) {
    const response = await api.post(API_ENDPOINTS.REGISTER, userData);
    return response.data.data;
  },

  async login(credentials) {
    const response = await api.post(API_ENDPOINTS.LOGIN, credentials);
    return response.data.data;
  },

  async logout(refreshToken) {
    const response = await api.post(API_ENDPOINTS.LOGOUT, { refreshToken });
    return response.data.data;
  },

  async refreshToken(refreshToken) {
    const response = await api.post(API_ENDPOINTS.REFRESH, { refreshToken });
    return response.data.data;
  },

  async getCurrentUser() {
    const response = await api.get(API_ENDPOINTS.ME);
    return response.data.data.user;
  },
};
