import { useAuth } from '../../hooks/useAuth';
import { formatMessageTime } from '../../utils/formatTime';

export function Message({ message, onRetry }) {
  const { user } = useAuth();
  const isOwn = message.senderId === user?.id;
  const senderName = message.senderName || 'Unknown';

  const stateClass = message.failed ? 'message-failed' : message.pending ? 'message-pending' : '';

  return (
    <div className={`message ${isOwn ? 'message-own' : 'message-other'} ${stateClass}`}>
      {!isOwn && (
        <div className="message-avatar avatar">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={senderName} />
          ) : (
            <div className="avatar-placeholder">
              {senderName[0].toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="message-content">
        {!isOwn && <span className="message-sender">{senderName}</span>}
        <div className="message-bubble">
          <p>{message.content}</p>
        </div>
        {message.failed ? (
          <span className="message-timestamp message-error">
            {message.error || 'Message was not sent'}
            {' · '}
            <button type="button" className="text-button" onClick={() => onRetry?.(message.tempId)}>
              Retry
            </button>
          </span>
        ) : (
          <span className="message-timestamp">
            {message.pending ? 'Sending...' : formatMessageTime(message.createdAt)}
          </span>
        )}
      </div>
    </div>
  );
}
