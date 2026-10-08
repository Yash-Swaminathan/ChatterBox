# Week 9 Design: Working Chat UI

**Outcome**: a logged-in user sees their conversations, opens one, reads history, and sends and receives messages live.

**Estimate**: 7-8 hours (client ~4 h, live delivery ~1 h, owner-only lockdown ~2 h, manual test ~0.5 h)

---

## 1. What the backend actually returns

The existing components assume shapes the API does not produce. These were read from the server code.

| Source | Shape | Consequence |
|---|---|---|
| `GET /api/conversations` | `{ conversations, pagination }` (no `success`/`data` wrapper). Rows are raw: `id, type, name, avatar_url, updated_at`, plus `participants: [{ userId, username, email, avatarUrl, status }]` (other users only) | Direct chats have `name = null`; display name must come from `participants[0].username`. There is no `lastMessage` or `unreadCount`. |
| `GET /api/messages/conversations/:id` | `{ success, data: { messages, nextCursor, hasMore } }`. Rows are snake_case (`sender_id`, `created_at`), with `sender: { id, username, avatarUrl }`, **newest first** | Must reverse for display and convert field names. |
| Socket `message:new` | camelCase: `id, conversationId, senderId, content, createdAt, sender, tempId` | Different casing from REST, so one normalizer is needed. |
| `GET /api/messages/unread` | `{ success, data: { totalUnread, byConversation } }` | Source for unread badges. |
| `Message.jsx` today | reads `message.senderName[0]` | Crashes on real data; switch to the normalized shape. |

## 2. Blocking problem: recipients do not receive live messages

`message:new` is emitted only to the room `conversation:{id}`. A socket joins that room only when it emits `conversation:join` or sends a message there. On connect it joins just `user:{id}`.

Result: if a visitor messages the owner in a brand-new conversation, the owner's open tab gets nothing until refresh. This breaks the project goal.

**Fix (server)**: keep every socket in the rooms of all its conversations, so every room event (new, edited, deleted, read receipts) reaches it.

- On connect, join the socket to `conversation:{id}` for each conversation the user participates in.
- When a conversation is created or a participant is added, join that user's online sockets with `io.in('user:{id}').socketsJoin('conversation:{id}')`.
- Emit `conversation:new { conversationId }` to the participants' user rooms so their sidebars refetch.

No change to how `message:new` is emitted, so existing emit assertions in tests stay valid.

## 3. Client architecture

One new context owns all chat state; components stay thin.

```
AuthProvider
└─ SocketProvider
   └─ ChatProvider            (new)
      └─ ChatPage
         ├─ Sidebar → ConversationList → ConversationItem
         └─ ChatWindow → MessageList → Message
                       → MessageInput
```

**New files**

| File | Purpose |
|---|---|
| `client/src/api/conversations.api.js` | `list()` |
| `client/src/api/messages.api.js` | `list(conversationId, cursor)`, `unread()` |
| `client/src/utils/normalize.js` | `normalizeConversation`, `normalizeMessage` (both REST and socket shapes in, one shape out) |
| `client/src/contexts/ChatContext.jsx` | state + actions (below) |
| `client/src/hooks/useChat.js` | context accessor, matching `useAuth` / `useSocket` |

**State (`useReducer`)**

```js
{
  conversations: [],            // sorted by last activity
  activeId: null,
  messages: { [conversationId]: { items: [], hasMore, nextCursor, loaded } },
  unread: { [conversationId]: number },
  loading, error
}
```

**Normalized shapes**

```js
conversation: { id, type, name, avatarUrl, otherUser, status, lastMessage, lastActivityAt }
message:      { id, tempId, conversationId, senderId, senderName, senderAvatar,
                content, createdAt, pending, failed }
```

## 4. Flows

**Load**: on mount, fetch conversations and unread counts in parallel. If there is exactly one conversation, select it (this is what a visitor will see once Week 19 lands).

**Open a conversation**: set `activeId`; if not loaded, fetch history, reverse it, store it; emit `message:read { conversationId }`; clear the local badge; scroll to bottom.

**Send**
1. Create `tempId` with `crypto.randomUUID()`, append the message as `pending`.
2. Emit `message:send { conversationId, content, tempId }`.
3. `message:new` with the same `tempId` replaces the pending entry (dedupe by `tempId`, then by `id`).
4. `message:error` with that `tempId` marks it `failed` and shows a retry link. Rate-limit errors show the server's message.

**Receive**: on `message:new`, append to that conversation, move it to the top of the sidebar, update its preview. If it is not the active conversation, increment its badge. If the conversation is unknown, refetch the list.

**Reconnect**: on socket `connect`, refetch conversations and the active conversation's first page, so anything missed while offline appears.

## 5. Fixes included

| Fix | File | Why |
|---|---|---|
| Declare `logout` before `startTokenRefresh` | `AuthContext.jsx` | Its dependency array reads `logout` before the `const` exists, which throws on first render. |
| Save a rotated refresh token in the interval and init paths | `AuthContext.jsx` | Matches what the Axios interceptor already does. |
| `auth: (cb) => cb({ token: getAccessToken() })` | `SocketContext.jsx` | A reconnect after 15 minutes currently reuses the expired token. |
| Emit `heartbeat` every 25 s | `SocketContext.jsx` | The server expires presence after 60 s without it, so users show offline while connected. |
| Visitor-appropriate empty states | `ConversationList.jsx`, `ChatWindow.jsx` | "Start chatting with your contacts!" does not fit. |

## 6. Out of scope for Week 9

Typing indicators, delivery/read ticks, edit/delete UI, group creation, avatar upload, auto-loading older messages on scroll (a "Load earlier" button is included), presence indicators and mobile layout polish (Week 11), notifications and password reset (Week 10), connection requests (Week 12).

## 7. Decisions (settled)

1. **Live delivery**: fixed on the server by joining sockets to their conversation rooms (section 2).
2. **Privacy**: owner-only lockdown behind `OWNER_ONLY_MODE` now; connection requests in Week 12 (section 9). No user search UI.
3. **Sidebar preview text**: shown once a message has loaded or arrived in the session; a `lastMessage` field in the API follows in Week 11.
4. **Empty conversations stay visible** in the owner's sidebar, so the owner can message a new signup first.
5. **No captcha.** Notification caps in Week 10 limit the damage from spam signups.

## 8. Test plan

- Two browsers (normal + incognito): the owner account and a new visitor.
- The visitor registers and lands in a conversation with the owner; the owner's sidebar shows the new conversation without refreshing.
- Both send; order, timestamps and own/other alignment are correct; no duplicates.
- Refresh mid-conversation: session restores, history loads, socket reconnects.
- Stop the server for 30 s, restart: client reconnects and catches up; a message typed while offline is not lost.
- Send 6 messages within a second: the rate-limit error is shown and the failed message can be retried.
- With a visitor token, user search, fetching another visitor's profile, opening a direct chat with another visitor, adding one as a contact and creating a group are all refused.
- `npm run lint` and `npm run build` in `client`; `npm test` in `server`.

## 9. Who can message whom (privacy model)

Today any registered user can discover and message any other user. Hiding things in the UI is not enough, because the endpoints stay callable with a visitor's token.

**Rule**: everyone can always message the owner. Nobody can message a stranger.

### Phase A: owner-only lockdown (this week)

Controlled by two env vars: `OWNER_USER_ID` and `OWNER_ONLY_MODE=true`. With the flag off the server behaves exactly as before, which keeps the existing test suite valid.

With the flag on, for any user who is not the owner:

| Endpoint | Behaviour |
|---|---|
| `GET /api/users/search` | 403 |
| `GET /api/users/:userId` | Allowed only for self or the owner |
| `POST /api/conversations/direct` | Allowed only when the other participant is the owner |
| `POST /api/conversations/group`, `POST /api/conversations/:id/participants` | 403 |
| `POST /api/contacts` | Allowed only when the target is the owner |

Regardless of the flag:

- `GET /api/conversations` no longer returns participants' `email`.
- When `OWNER_USER_ID` is set, registration creates the direct conversation with the owner (fire-and-forget, idempotent, never fails the registration).

Existing conversations are not re-checked on every message; blocking, which is already built, covers cutting someone off.

### Phase B: connection requests (Week 12)

Adds the only path for two non-owner users to talk.

- `contact_requests` table: `sender_id, recipient_id, status (pending|accepted|rejected), created_at, responded_at`; unique per pair.
- `POST /api/contact-requests { username }`: exact username only. There is no lookup endpoint; the response is the same whether or not the username exists, so it cannot be used to probe for accounts. 10 per day; a rejected request cannot be re-sent for 30 days.
- `GET /api/contact-requests?type=received|sent`, `PUT /api/contact-requests/:id/accept|reject`.
- Accepting creates contact rows both ways and the direct conversation.
- The lockdown rule becomes "owner or accepted connection" for direct conversations, profiles and group membership.
- UI: "Add by username" field and a requests inbox with accept/reject.
