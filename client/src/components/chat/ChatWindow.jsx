import { useChat } from '../../hooks/useChat';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatWindow() {
  const { activeConversation, conversations, loading, connected } = useChat();

  if (!activeConversation) {
    return (
      <div className="chat-window-empty">
        <div className="empty-state">
          <h2>Welcome to ChatterBox</h2>
          <p>
            {loading || conversations.length > 0
              ? 'Select a conversation to start chatting'
              : 'Your conversations will appear here'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{activeConversation.name}</h3>
          {!connected && <span className="chat-connection">Reconnecting...</span>}
        </div>
      </div>

      <MessageList />
      <MessageInput />
    </div>
  );
}
