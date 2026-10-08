import { useAuth } from '../../hooks/useAuth';
import { useSocket } from '../../hooks/useSocket';
import { ConversationList } from './ConversationList';

export function Sidebar() {
  const { user, logout } = useAuth();
  const { connected } = useSocket();

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="user-info">
          <div className="avatar">
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.displayName || user.username} />
            ) : (
              <div className="avatar-placeholder">
                {(user?.displayName || user?.username || 'U')[0].toUpperCase()}
              </div>
            )}
          </div>
          <div className="user-details">
            <h3>{user?.displayName || user?.username}</h3>
            <span className={`status ${connected ? '' : 'status-offline'}`}>
              {connected ? 'Online' : 'Connecting...'}
            </span>
          </div>
        </div>
        <button onClick={logout} className="logout-btn" title="Logout">
          Logout
        </button>
      </div>

      <ConversationList />
    </div>
  );
}
