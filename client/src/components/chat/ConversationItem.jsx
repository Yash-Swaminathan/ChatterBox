import { formatConversationTime } from '../../utils/formatTime';

export function ConversationItem({ conversation, active = false, unreadCount = 0, onSelect }) {
  const displayName = conversation.name || 'Unknown';

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onSelect?.(conversation.id);
    }
  };

  return (
    <div
      className={`conversation-item ${active ? 'active' : ''}`}
      role="button"
      tabIndex={0}
      aria-current={active ? 'true' : undefined}
      onClick={() => onSelect?.(conversation.id)}
      onKeyDown={handleKeyDown}
    >
      <div className="conversation-avatar avatar">
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
          <span className="timestamp">{formatConversationTime(conversation.lastActivityAt)}</span>
        </div>
        <div className="conversation-preview">
          <p>{conversation.lastMessage || ''}</p>
          {unreadCount > 0 && (
            <span className="unread-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </div>
      </div>
    </div>
  );
}
