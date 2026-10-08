import api from './axios';
import { API_ENDPOINTS } from '../utils/constants';

export const messagesAPI = {
  // Returns { messages (newest first), nextCursor, hasMore }
  async list(conversationId, { cursor = null, limit = 50 } = {}) {
    const params = { limit };
    if (cursor) {
      params.cursor = cursor;
    }

    const response = await api.get(`${API_ENDPOINTS.CONVERSATION_MESSAGES}/${conversationId}`, {
      params,
    });
    return response.data.data;
  },

  // Returns { totalUnread, byConversation: { [conversationId]: count } }
  async unread() {
    const response = await api.get(API_ENDPOINTS.UNREAD);
    return response.data.data;
  },
};
