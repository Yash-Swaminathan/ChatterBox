import { Message } from './Message';

export function MessageList() {
  const messages = []; // TODO: Fetch from API in Week 9 Day 3-4

  if (messages.length === 0) {
    return (
      <div className="message-list-empty">
        <p>No messages yet. Start the conversation!</p>
      </div>
    );
  }

  return (
    <div className="message-list">
      {messages.map((message) => (
        <Message key={message.id} message={message} />
      ))}
    </div>
  );
}
