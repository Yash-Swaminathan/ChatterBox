import { useState, useEffect, useCallback } from 'react';
import { contactRequestsAPI } from '../../api/contactRequests.api';
import { useSocket } from '../../hooks/useSocket';
import { useChat } from '../../hooks/useChat';

const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,50}$/;

export function ConnectionRequests() {
  const { socket } = useSocket();
  const { reloadConversations } = useChat();
  const [received, setReceived] = useState([]);
  const [sent, setSent] = useState([]);
  const [username, setUsername] = useState('');
  const [sending, setSending] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [notice, setNotice] = useState(null);

  const loadRequests = useCallback(async () => {
    try {
      const [receivedList, sentList] = await Promise.all([
        contactRequestsAPI.list('received'),
        contactRequestsAPI.list('sent'),
      ]);
      setReceived(receivedList);
      setSent(sentList);
    } catch (err) {
      // The inbox is secondary to the chat: stay quiet and try again on the next event
      console.error('Failed to load connection requests:', err);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    if (!socket) return undefined;

    socket.on('contact-request:received', loadRequests);
    socket.on('contact-request:accepted', loadRequests);
    // Requests that arrived while offline
    socket.on('connect', loadRequests);

    return () => {
      socket.off('contact-request:received', loadRequests);
      socket.off('contact-request:accepted', loadRequests);
      socket.off('connect', loadRequests);
    };
  }, [socket, loadRequests]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const target = username.trim();

    if (!USERNAME_PATTERN.test(target)) {
      setNotice({ error: true, text: 'Enter their full username' });
      return;
    }

    setSending(true);
    setNotice(null);
    try {
      await contactRequestsAPI.send(target);
      setUsername('');
      setNotice({ text: 'If that username exists, they will see your request.' });
      await loadRequests();
      // If they had already asked you, the two of you are now connected
      reloadConversations();
    } catch (err) {
      setNotice({
        error: true,
        text: err.response?.data?.error?.message || 'Could not send the request',
      });
    } finally {
      setSending(false);
    }
  };

  const respond = async (requestId, action) => {
    setRespondingId(requestId);
    setNotice(null);
    try {
      await contactRequestsAPI[action](requestId);
      setReceived((current) => current.filter((request) => request.id !== requestId));
      if (action === 'accept') {
        reloadConversations();
      }
    } catch (err) {
      console.error(`Failed to ${action} connection request:`, err);
      setNotice({ error: true, text: 'Could not update the request' });
      loadRequests();
    } finally {
      setRespondingId(null);
    }
  };

  return (
    <div className="connection-requests">
      {received.length > 0 && (
        <ul className="request-list">
          {received.map((request) => (
            <li key={request.id} className="request-item">
              <span className="request-name" title={request.user.username}>
                <strong>{request.user.username}</strong> wants to connect
              </span>
              <span className="request-actions">
                <button
                  type="button"
                  className="request-btn request-btn-accept"
                  disabled={respondingId === request.id}
                  onClick={() => respond(request.id, 'accept')}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="request-btn"
                  disabled={respondingId === request.id}
                  onClick={() => respond(request.id, 'reject')}
                >
                  Decline
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {sent.length > 0 && (
        <p className="request-sent">
          Waiting for {sent.map((request) => request.user.username).join(', ')}
        </p>
      )}

      <form className="request-form" onSubmit={handleSubmit}>
        <input
          type="text"
          className="request-input"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="Add by username"
          aria-label="Add by username"
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          maxLength={50}
          disabled={sending}
        />
        <button type="submit" className="request-btn request-btn-accept" disabled={sending || !username.trim()}>
          {sending ? 'Sending' : 'Send'}
        </button>
      </form>

      {notice && (
        <p className={`request-notice ${notice.error ? 'request-notice-error' : ''}`} role="status">
          {notice.text}
        </p>
      )}
    </div>
  );
}
