import { useState, useEffect } from 'react';
import { ConversationItem } from './ConversationItem';

export function ConversationList() {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);

  // TODO: Fetch conversations from API in Week 9 Day 3-4
  useEffect(() => {
    // Placeholder for now
    setLoading(false);
  }, []);

  if (loading) {
    return <div className="conversation-list-loading">Loading conversations...</div>;
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list-empty">
        <p>No conversations yet</p>
        <p className="empty-subtitle">Start chatting with your contacts!</p>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <ConversationItem key={conversation.id} conversation={conversation} />
      ))}
    </div>
  );
}
