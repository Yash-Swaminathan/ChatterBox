import { ChatProvider } from '../contexts/ChatContext';
import { useChat } from '../hooks/useChat';
import { Sidebar } from '../components/chat/Sidebar';
import { ChatWindow } from '../components/chat/ChatWindow';
import '../styles/chat.css';

function ChatLayout() {
  const { mobilePane } = useChat();

  return (
    <div className={`chat-page pane-${mobilePane}`}>
      <Sidebar />
      <ChatWindow />
    </div>
  );
}

export function ChatPage() {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
}
