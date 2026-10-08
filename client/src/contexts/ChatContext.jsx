import { createContext, useReducer, useEffect, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useSocket } from '../hooks/useSocket';
import { conversationsAPI } from '../api/conversations.api';
import { messagesAPI } from '../api/messages.api';
import {
  normalizeConversation,
  normalizeMessage,
  sortByCreatedAt,
  sortByLastActivity,
} from '../utils/normalize';

export const ChatContext = createContext(null);

// How long to wait for the server to acknowledge a sent message
const SEND_TIMEOUT_MS = 10000;

const initialState = {
  conversations: [],
  activeId: null,
  messages: {}, // { [conversationId]: thread }
  unread: {}, // { [conversationId]: count }
  mobilePane: 'list', // On narrow screens only one of 'list' | 'chat' is visible
  loading: true,
  error: null,
};

const emptyThread = {
  items: [],
  hasMore: false,
  nextCursor: null,
  loaded: false,
  loading: false,
  error: null,
};

function getThread(state, conversationId) {
  return state.messages[conversationId] || emptyThread;
}

function setThread(state, conversationId, thread) {
  return { ...state, messages: { ...state.messages, [conversationId]: thread } };
}

// Show a message as the conversation's preview and move the conversation to the top
function withLatestMessage(conversations, message) {
  return sortByLastActivity(
    conversations.map((c) =>
      c.id === message.conversationId
        ? { ...c, lastMessage: message.content, lastActivityAt: message.createdAt }
        : c
    )
  );
}

// Apply a change to the message with the given tempId, whichever thread it is in
function updateByTempId(state, tempId, change) {
  for (const [conversationId, thread] of Object.entries(state.messages)) {
    const index = thread.items.findIndex((m) => m.tempId === tempId);
    if (index !== -1) {
      const updated = change(thread.items[index]);
      if (updated === thread.items[index]) {
        return state;
      }
      const items = [...thread.items];
      items[index] = updated;
      return setThread(state, conversationId, { ...thread, items });
    }
  }
  return state;
}

// A local unsent message whose send actually reached the server (the acknowledgement
// was lost, e.g. during a disconnect) shows up again in fetched history
function wasDelivered(local, serverMessages) {
  const sentAt = new Date(local.createdAt).getTime();
  return serverMessages.some(
    (m) =>
      m.senderId === local.senderId &&
      m.content === local.content &&
      new Date(m.createdAt).getTime() >= sentAt - 5000
  );
}

function mergeMessages(existing, fetched) {
  const fetchedIds = new Set(fetched.map((m) => m.id));
  const kept = existing.filter((m) =>
    m.id ? !fetchedIds.has(m.id) : !wasDelivered(m, fetched)
  );
  return sortByCreatedAt([...kept, ...fetched]);
}

function chatReducer(state, action) {
  switch (action.type) {
    case 'CONVERSATIONS_LOADED': {
      const previous = new Map(state.conversations.map((c) => [c.id, c]));
      const conversations = sortByLastActivity(
        action.conversations.map((c) => ({
          ...c,
          lastMessage: c.lastMessage ?? previous.get(c.id)?.lastMessage ?? null,
        }))
      );

      let activeId = state.activeId;
      if (!conversations.some((c) => c.id === activeId)) {
        // A visitor has a single conversation (with the site owner), so open it for them
        activeId = conversations.length === 1 ? conversations[0].id : null;
      }

      // Someone with a single conversation goes straight to it; otherwise show the list first
      const mobilePane = state.loading ? (activeId ? 'chat' : 'list') : state.mobilePane;

      const unread = { ...(action.unread || state.unread) };
      if (activeId) {
        unread[activeId] = 0;
      }

      return {
        ...state,
        conversations,
        activeId,
        unread,
        mobilePane,
        loading: false,
        error: null,
      };
    }

    case 'CONVERSATIONS_FAILED':
      return { ...state, loading: false, error: action.error };

    case 'CONVERSATION_SELECTED':
      return {
        ...state,
        activeId: action.conversationId,
        mobilePane: 'chat',
        unread: { ...state.unread, [action.conversationId]: 0 },
      };

    case 'LIST_SHOWN':
      return { ...state, mobilePane: 'list' };

    case 'PRESENCE_CHANGED':
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.otherUser?.userId === action.userId ? { ...c, status: action.status } : c
        ),
      };

    case 'PRESENCE_SYNCED':
      // Sent on connect, and only covers contacts who are not offline. People missing
      // from it keep the status from the conversation list, which is fetched on every connect.
      return {
        ...state,
        conversations: state.conversations.map((c) => {
          const presence = c.otherUser && action.presences[c.otherUser.userId];
          return presence ? { ...c, status: presence.status } : c;
        }),
      };

    case 'MESSAGES_LOADING': {
      const thread = getThread(state, action.conversationId);
      return setThread(state, action.conversationId, { ...thread, loading: true, error: null });
    }

    case 'MESSAGES_FAILED': {
      const thread = getThread(state, action.conversationId);
      return setThread(state, action.conversationId, {
        ...thread,
        loading: false,
        error: action.error,
      });
    }

    case 'MESSAGES_LOADED': {
      const thread = getThread(state, action.conversationId);
      const items = mergeMessages(thread.items, action.messages);

      // A refresh of the newest page must not reset how far back we have paged
      const keepCursor = thread.loaded && !action.older;

      const next = setThread(state, action.conversationId, {
        items,
        hasMore: keepCursor ? thread.hasMore : action.hasMore,
        nextCursor: keepCursor ? thread.nextCursor : action.nextCursor,
        loaded: true,
        loading: false,
        error: null,
      });

      const latest = items[items.length - 1];
      if (!latest) {
        return next;
      }
      return {
        ...next,
        conversations: next.conversations.map((c) =>
          c.id === action.conversationId ? { ...c, lastMessage: latest.content } : c
        ),
      };
    }

    case 'MESSAGE_QUEUED': {
      const { message } = action;
      const thread = getThread(state, message.conversationId);
      const next = setThread(state, message.conversationId, {
        ...thread,
        items: [...thread.items, message],
      });
      return { ...next, conversations: withLatestMessage(next.conversations, message) };
    }

    case 'MESSAGE_RECEIVED': {
      const { message, currentUserId } = action;
      const thread = getThread(state, message.conversationId);

      const optimisticIndex = message.tempId
        ? thread.items.findIndex((m) => m.tempId === message.tempId)
        : -1;

      let items;
      if (optimisticIndex !== -1) {
        // Our own message coming back from the server: replace the optimistic copy
        items = [...thread.items];
        items[optimisticIndex] = message;
      } else if (thread.items.some((m) => m.id === message.id)) {
        return state;
      } else {
        items = sortByCreatedAt([...thread.items, message]);
      }

      const next = setThread(state, message.conversationId, { ...thread, items });
      const isUnread =
        message.conversationId !== state.activeId && message.senderId !== currentUserId;

      return {
        ...next,
        conversations: withLatestMessage(next.conversations, message),
        unread: isUnread
          ? {
              ...next.unread,
              [message.conversationId]: (next.unread[message.conversationId] || 0) + 1,
            }
          : next.unread,
      };
    }

    case 'MESSAGE_CONFIRMED':
      return updateByTempId(state, action.tempId, (m) => ({
        ...m,
        id: m.id || action.messageId,
        createdAt: action.createdAt || m.createdAt,
        pending: false,
        failed: false,
        error: null,
      }));

    case 'MESSAGE_FAILED':
      return updateByTempId(state, action.tempId, (m) => ({
        ...m,
        pending: false,
        failed: true,
        error: action.error,
      }));

    case 'MESSAGE_TIMED_OUT':
      // Only fail it if nothing has come back from the server in the meantime
      return updateByTempId(state, action.tempId, (m) =>
        m.pending ? { ...m, pending: false, failed: true, error: 'Message was not sent' } : m
      );

    case 'MESSAGE_RETRIED':
      return updateByTempId(state, action.tempId, (m) => ({
        ...m,
        pending: true,
        failed: false,
        error: null,
        createdAt: new Date().toISOString(),
      }));

    default:
      return state;
  }
}

function createTempId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function errorMessage(err, fallback) {
  return err.response?.data?.error?.message || err.response?.data?.message || fallback;
}

export function ChatProvider({ children }) {
  const { user } = useAuth();
  const { socket, connected } = useSocket();
  const [state, dispatch] = useReducer(chatReducer, initialState);
  const userId = user?.id;

  // Lets socket handlers and callbacks read the latest state without re-subscribing
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const loadConversations = useCallback(async () => {
    try {
      const [list, unread] = await Promise.all([
        conversationsAPI.list(),
        // Badges are a nicety: do not fail the whole list if counts are unavailable
        messagesAPI.unread().catch(() => null),
      ]);

      dispatch({
        type: 'CONVERSATIONS_LOADED',
        conversations: (list.conversations || []).map(normalizeConversation),
        unread: unread?.byConversation || null,
      });
    } catch (err) {
      console.error('Failed to load conversations:', err);
      dispatch({
        type: 'CONVERSATIONS_FAILED',
        error: errorMessage(err, 'Could not load conversations'),
      });
    }
  }, []);

  const loadMessages = useCallback(async (conversationId, { older = false } = {}) => {
    const thread = getThread(stateRef.current, conversationId);
    if (older && !thread.nextCursor) {
      return;
    }

    dispatch({ type: 'MESSAGES_LOADING', conversationId });

    try {
      const data = await messagesAPI.list(conversationId, {
        cursor: older ? thread.nextCursor : null,
      });

      dispatch({
        type: 'MESSAGES_LOADED',
        conversationId,
        messages: (data.messages || []).map(normalizeMessage),
        hasMore: Boolean(data.hasMore),
        nextCursor: data.nextCursor || null,
        older,
      });
    } catch (err) {
      console.error('Failed to load messages:', err);
      dispatch({
        type: 'MESSAGES_FAILED',
        conversationId,
        error: errorMessage(err, 'Could not load messages'),
      });
    }
  }, []);

  const markRead = useCallback(
    (conversationId) => {
      if (socket?.connected) {
        socket.emit('message:read', { conversationId });
      }
    },
    [socket]
  );

  // Initial load
  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  // Opening a conversation: load its history once and mark it read
  useEffect(() => {
    if (!state.activeId) {
      return;
    }
    if (!getThread(stateRef.current, state.activeId).loaded) {
      loadMessages(state.activeId);
    }
    markRead(state.activeId);
  }, [state.activeId, loadMessages, markRead]);

  // Real-time events
  useEffect(() => {
    if (!socket) {
      return undefined;
    }

    const handleNewMessage = (raw) => {
      const message = normalizeMessage(raw);
      const current = stateRef.current;

      dispatch({ type: 'MESSAGE_RECEIVED', message, currentUserId: userId });

      if (!current.conversations.some((c) => c.id === message.conversationId)) {
        loadConversations();
      }
      if (message.conversationId === current.activeId && message.senderId !== userId) {
        socket.emit('message:read', { conversationId: message.conversationId });
      }
    };

    const handleSent = ({ tempId, messageId, createdAt }) => {
      dispatch({ type: 'MESSAGE_CONFIRMED', tempId, messageId, createdAt });
    };

    const handleMessageError = ({ tempId, message }) => {
      if (tempId) {
        dispatch({ type: 'MESSAGE_FAILED', tempId, error: message || 'Message was not sent' });
      }
    };

    // Fires on the first connection and on every reconnect: catch up on anything missed
    const handleConnect = () => {
      loadConversations();
      const { activeId } = stateRef.current;
      if (activeId) {
        loadMessages(activeId);
        socket.emit('message:read', { conversationId: activeId });
      }
    };

    const handlePresenceChanged = ({ userId: changedUserId, status }) => {
      dispatch({ type: 'PRESENCE_CHANGED', userId: changedUserId, status });
    };

    const handlePresenceBulk = ({ presences }) => {
      dispatch({ type: 'PRESENCE_SYNCED', presences: presences || {} });
    };

    socket.on('message:new', handleNewMessage);
    socket.on('presence:changed', handlePresenceChanged);
    socket.on('presence:bulk', handlePresenceBulk);
    socket.on('message:sent', handleSent);
    socket.on('message:error', handleMessageError);
    socket.on('conversation:new', loadConversations);
    socket.on('connect', handleConnect);

    return () => {
      socket.off('message:new', handleNewMessage);
      socket.off('presence:changed', handlePresenceChanged);
      socket.off('presence:bulk', handlePresenceBulk);
      socket.off('message:sent', handleSent);
      socket.off('message:error', handleMessageError);
      socket.off('conversation:new', loadConversations);
      socket.off('connect', handleConnect);
    };
  }, [socket, userId, loadConversations, loadMessages]);

  const selectConversation = useCallback((conversationId) => {
    dispatch({ type: 'CONVERSATION_SELECTED', conversationId });
  }, []);

  const showList = useCallback(() => {
    dispatch({ type: 'LIST_SHOWN' });
  }, []);

  const deliver = useCallback(
    (message) => {
      if (!socket?.connected) {
        dispatch({ type: 'MESSAGE_FAILED', tempId: message.tempId, error: 'Not connected' });
        return;
      }

      socket.emit('message:send', {
        conversationId: message.conversationId,
        content: message.content,
        tempId: message.tempId,
      });

      setTimeout(() => {
        dispatch({ type: 'MESSAGE_TIMED_OUT', tempId: message.tempId });
      }, SEND_TIMEOUT_MS);
    },
    [socket]
  );

  const sendMessage = useCallback(
    (content) => {
      const trimmed = content.trim();
      const conversationId = stateRef.current.activeId;
      if (!trimmed || !conversationId) {
        return;
      }

      // Shown immediately; replaced by the server's copy when it comes back
      const message = {
        id: null,
        tempId: createTempId(),
        conversationId,
        senderId: userId,
        senderName: user?.username || 'You',
        senderAvatar: user?.avatarUrl || null,
        content: trimmed,
        createdAt: new Date().toISOString(),
        pending: true,
        failed: false,
        error: null,
      };

      dispatch({ type: 'MESSAGE_QUEUED', message });
      deliver(message);
    },
    [userId, user, deliver]
  );

  const retryMessage = useCallback(
    (tempId) => {
      const threads = Object.values(stateRef.current.messages);
      const message = threads.flatMap((t) => t.items).find((m) => m.tempId === tempId);
      if (!message || !message.failed) {
        return;
      }

      dispatch({ type: 'MESSAGE_RETRIED', tempId });
      deliver(message);
    },
    [deliver]
  );

  const loadEarlier = useCallback(() => {
    const { activeId } = stateRef.current;
    if (activeId) {
      loadMessages(activeId, { older: true });
    }
  }, [loadMessages]);

  const value = useMemo(() => {
    const activeConversation = state.conversations.find((c) => c.id === state.activeId) || null;

    return {
      conversations: state.conversations,
      activeConversation,
      activeThread: activeConversation ? getThread(state, activeConversation.id) : emptyThread,
      unread: state.unread,
      mobilePane: state.mobilePane,
      loading: state.loading,
      error: state.error,
      connected,
      selectConversation,
      showList,
      sendMessage,
      retryMessage,
      loadEarlier,
      reloadConversations: loadConversations,
    };
  }, [
    state,
    connected,
    selectConversation,
    showList,
    sendMessage,
    retryMessage,
    loadEarlier,
    loadConversations,
  ]);

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
