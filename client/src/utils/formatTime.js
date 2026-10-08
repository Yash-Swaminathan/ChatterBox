// Time of day, e.g. "14:05"
export function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Time of day for today, otherwise a short date, e.g. "Oct 8"
export function formatConversationTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';

  const isToday = date.toDateString() === new Date().toDateString();
  if (isToday) {
    return formatMessageTime(date);
  }

  return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
}
