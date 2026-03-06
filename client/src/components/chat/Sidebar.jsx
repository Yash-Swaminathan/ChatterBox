import { useAuth } from '../../hooks/useAuth';
import { ConversationList } from './ConversationList';

export function Sidebar() {
  const { user, logout } = useAuth();

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
            <span className="status">{user?.status || 'online'}</span>
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
