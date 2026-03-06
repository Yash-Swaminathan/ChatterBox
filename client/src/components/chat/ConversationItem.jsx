export function ConversationItem({ conversation, active = false }) {
  return (
    <div className={`conversation-item ${active ? 'active' : ''}`}>
      <div className="conversation-avatar">
        {conversation.avatarUrl ? (
          <img src={conversation.avatarUrl} alt={conversation.name} />
        ) : (
          <div className="avatar-placeholder">
            {conversation.name[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="conversation-content">
        <div className="conversation-header">
          <h4>{conversation.name}</h4>
          <span className="timestamp">{conversation.timestamp}</span>
        </div>
        <div className="conversation-preview">
          <p>{conversation.lastMessage}</p>
          {conversation.unreadCount > 0 && (
            <span className="unread-badge">{conversation.unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}
