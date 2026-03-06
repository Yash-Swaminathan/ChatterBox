import { createContext, useEffect, useState, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from '../hooks/useAuth';
import { getAccessToken } from '../api/axios';
import { API_BASE_URL } from '../utils/constants';

export const SocketContext = createContext(null);

export function SocketProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState(null);
  const socketRef = useRef(null);

  // Connect to Socket.io when user logs in
  useEffect(() => {
    if (isAuthenticated && user && !socketRef.current) {
      const token = getAccessToken();

      if (!token) {
        console.error('No access token available for Socket.io');
        return;
      }

      const newSocket = io(API_BASE_URL, {
        auth: {
          token,
        },
        transports: ['websocket', 'polling'],
      });

      newSocket.on('connect', () => {
        console.log('Socket.io connected:', newSocket.id);
        setConnected(true);
        setError(null);
      });

      newSocket.on('auth:success', (data) => {
        console.log('Socket.io authenticated:', data);
      });

      newSocket.on('disconnect', (reason) => {
        console.log('Socket.io disconnected:', reason);
        setConnected(false);
      });

      newSocket.on('connect_error', (err) => {
        console.error('Socket.io connection error:', err.message);
        setError(err.message);
        setConnected(false);
      });

      newSocket.on('error', (err) => {
        console.error('Socket.io error:', err);
        setError(err.message || 'Socket error');
      });

      socketRef.current = newSocket;
      setSocket(newSocket);
    }

    // Cleanup on logout
    return () => {
      if (!isAuthenticated && socketRef.current) {
        console.log('Disconnecting socket due to logout');
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocket(null);
        setConnected(false);
      }
    };
  }, [isAuthenticated, user]);

  // Emit event helper
  const emit = useCallback((event, data) => {
    if (socketRef.current && connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }, [connected]);

  // Listen to event helper
  const on = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.on(event, callback);
    }
  }, []);

  // Remove listener helper
  const off = useCallback((event, callback) => {
    if (socketRef.current) {
      socketRef.current.off(event, callback);
    }
  }, []);

  const value = {
    socket,
    connected,
    error,
    emit,
    on,
    off,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}
