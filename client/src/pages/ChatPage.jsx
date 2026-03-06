import { Sidebar } from '../components/chat/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import '../styles/chat.css';

export function ChatPage() {
  return (
    <div className="chat-page">
      <Sidebar />
      <ChatWindow />
    </div>
  );
}
