import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';

export function ChatWindow() {
  // TODO: Get active conversation from state in Week 9 Day 3-4
  const activeConversation = null;

  if (!activeConversation) {
    return (
      <div className="chat-window-empty">
        <div className="empty-state">
          <h2>Welcome to ChatterBox</h2>
          <p>Select a conversation to start chatting</p>
        </div>
      </div>
    );
  }

  return (
    <div className="chat-window">
      <div className="chat-header">
        <div className="chat-header-info">
          <h3>{activeConversation.name}</h3>
          <span className="chat-status">online</span>
        </div>
      </div>

      <MessageList />
      <MessageInput />
    </div>
  );
}
