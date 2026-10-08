import { useEffect, useRef } from 'react';
import { useChat } from '../../hooks/useChat';
import { Message } from './Message';

export function MessageList() {
  const { activeConversation, activeThread, loadEarlier, retryMessage } = useChat();
  const { items, hasMore, loaded, loading, error } = activeThread;
  const listRef = useRef(null);

  // Follow the conversation: jump to the bottom when the newest message changes.
  // Loading earlier messages leaves the newest one unchanged, so the view stays put.
  const newest = items[items.length - 1];
  const newestKey = newest ? newest.tempId || newest.id : null;

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [newestKey, activeConversation?.id]);

  if (!loaded && loading) {
    return <div className="message-list-empty">Loading messages...</div>;
  }

  if (!loaded && error) {
    return <div className="message-list-empty">{error}</div>;
  }

  if (items.length === 0) {
    return (
      <div className="message-list-empty">
        <p>No messages yet. Say hello!</p>
      </div>
    );
  }

  return (
    <div className="message-list" ref={listRef}>
      {hasMore && (
        <button type="button" className="load-earlier" onClick={loadEarlier} disabled={loading}>
          {loading ? 'Loading...' : 'Load earlier messages'}
        </button>
      )}

      {items.map((message) => (
        <Message key={message.tempId || message.id} message={message} onRetry={retryMessage} />
      ))}
    </div>
  );
}
