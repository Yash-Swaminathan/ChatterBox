import { useState } from 'react';
import { useChat } from '../../hooks/useChat';

// Matches the server-side limit on message length
const MAX_MESSAGE_LENGTH = 10000;

export function MessageInput() {
  const [message, setMessage] = useState('');
  const { sendMessage, connected } = useChat();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message.trim() || !connected) return;

    sendMessage(message);
    setMessage('');
  };

  return (
    <form onSubmit={handleSubmit} className="message-input-form">
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={connected ? "Type a message..." : "Connecting..."}
        disabled={!connected}
        maxLength={MAX_MESSAGE_LENGTH}
        className="message-input"
        autoFocus
      />
      <button
        type="submit"
        disabled={!message.trim() || !connected}
        className="send-button"
      >
        Send
      </button>
    </form>
  );
}
