import { ChatProvider } from '../contexts/ChatContext';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import '../styles/chat.css';

export function ChatPage() {
  return (
    <ChatProvider>
      <div className="chat-page">
        <Sidebar />
        <ChatWindow />
      </div>
    </ChatProvider>
  );
}
