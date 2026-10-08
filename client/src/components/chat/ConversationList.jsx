import { useChat } from '../../hooks/useChat';
import { ConversationItem } from './ConversationItem';

export function ConversationList() {
  const {
    conversations,
    activeConversation,
    unread,
    loading,
    error,
    selectConversation,
    reloadConversations,
  } = useChat();

  if (loading) {
    return <div className="conversation-list-loading">Loading conversations...</div>;
  }

  if (error && conversations.length === 0) {
    return (
      <div className="conversation-list-empty">
        <p>{error}</p>
        <button type="button" className="text-button" onClick={reloadConversations}>
          Try again
        </button>
      </div>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="conversation-list-empty">
        <p>No conversations yet</p>
        <p className="empty-subtitle">New conversations will show up here.</p>
      </div>
    );
  }

  return (
    <div className="conversation-list">
      {conversations.map((conversation) => (
        <ConversationItem
          key={conversation.id}
          conversation={conversation}
          active={conversation.id === activeConversation?.id}
          unreadCount={unread[conversation.id] || 0}
          onSelect={selectConversation}
        />
      ))}
    </div>
  );
}
