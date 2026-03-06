export function ConversationItem({ conversation, active = false }) {
  const displayName = conversation.name || 'Unknown';

  return (
    <div className={`conversation-item ${active ? 'active' : ''}`}>
      <div className="conversation-avatar">
        {conversation.avatarUrl ? (
          <img src={conversation.avatarUrl} alt={displayName} />
        ) : (
          <div className="avatar-placeholder">
            {displayName[0].toUpperCase()}
          </div>
        )}
      </div>

      <div className="conversation-content">
        <div className="conversation-header">
          <h4>{displayName}</h4>
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
