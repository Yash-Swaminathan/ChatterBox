import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export const conversationsAPI = {
  // Note: this endpoint returns { conversations, pagination } without a data wrapper
  async list({ limit = 50, offset = 0 } = {}) {
    const response = await api.get(API_ENDPOINTS.CONVERSATIONS, { params: { limit, offset } });
    return response.data;
  },
};
