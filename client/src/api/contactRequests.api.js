import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export const contactRequestsAPI = {
  // The response is the same whether or not the username exists
  async send(username) {
    const response = await api.post(API_ENDPOINTS.CONTACT_REQUESTS, { username });
    return response.data;
  },

  async list(type) {
    const response = await api.get(API_ENDPOINTS.CONTACT_REQUESTS, { params: { type } });
    return response.data.data.requests;
  },

  async accept(requestId) {
    const response = await api.put(`${API_ENDPOINTS.CONTACT_REQUESTS}/${requestId}/accept`);
    return response.data.data;
  },

  async reject(requestId) {
    const response = await api.put(`${API_ENDPOINTS.CONTACT_REQUESTS}/${requestId}/reject`);
    return response.data.data;
  },
};
