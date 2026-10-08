// The REST API returns raw database rows (snake_case) while socket events use
// camelCase. These helpers turn either into the single shape the UI works with.

export function normalizeMessage(raw) {
  const sender = raw.sender || {};

  return {
    id: raw.id ?? null,
    tempId: raw.tempId ?? null,
    conversationId: raw.conversationId ?? raw.conversation_id,
    senderId: raw.senderId ?? raw.sender_id ?? sender.id ?? null,
    senderName: sender.username || 'Unknown',
    senderAvatar: sender.avatarUrl || null,
    content: raw.content ?? '',
    createdAt: raw.createdAt ?? raw.created_at,
    pending: false,
    failed: false,
    error: null,
  };
}

export function normalizeConversation(raw) {
  // participants only contains the other people in the conversation
  const participants = raw.participants || [];
  const isGroup = raw.type === 'group';
  const otherUser = isGroup ? null : participants[0] || null;

  const fallbackName = isGroup
    ? participants.map((p) => p.username).join(', ')
    : otherUser?.username;

  return {
    id: raw.id,
    type: raw.type,
    name: raw.name || fallbackName || 'Unknown',
    avatarUrl: raw.avatar_url ?? raw.avatarUrl ?? otherUser?.avatarUrl ?? null,
    otherUser,
    status: otherUser?.status ?? null,
    lastMessage: raw.lastMessage?.content ?? null,
    lastActivityAt: raw.updated_at ?? raw.updatedAt ?? raw.created_at ?? null,
  };
}

export function sortByCreatedAt(messages) {
  return [...messages].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

export function sortByLastActivity(conversations) {
  return [...conversations].sort(
    (a, b) => new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0)
  );
}
