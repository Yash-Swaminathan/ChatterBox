import { useAuth } from '../../hooks/useAuth';

export function Message({ message }) {
  const { user } = useAuth();
  const isOwn = message.senderId === user?.id;

  return (
    <div className={`message ${isOwn ? 'message-own' : 'message-other'}`}>
      {!isOwn && (
        <div className="message-avatar">
          {message.senderAvatar ? (
            <img src={message.senderAvatar} alt={message.senderName} />
          ) : (
            <div className="avatar-placeholder">
              {message.senderName[0].toUpperCase()}
            </div>
          )}
        </div>
      )}

      <div className="message-content">
        {!isOwn && <span className="message-sender">{message.senderName}</span>}
        <div className="message-bubble">
          <p>{message.content}</p>
        </div>
        <span className="message-timestamp">
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </span>
      </div>
    </div>
  );
}
