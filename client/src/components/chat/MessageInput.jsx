import { useState } from 'react';
import { useSocket } from '../../hooks/useSocket';

export function MessageInput() {
  const [message, setMessage] = useState('');
  const { emit, connected } = useSocket();

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!message.trim() || !connected) return;

    // TODO: Implement message sending in Week 9 Day 3-4
    // emit('message:send', { conversationId, content: message, tempId: uuid() });

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
        className="message-input"
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
