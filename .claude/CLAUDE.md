# ChatterBox - Real-Time Messaging Platform

> A production-ready MVP messaging platform with real-time communication, contact management, and extensible architecture

**Status**: Weeks 1-12 code complete; live at chat.yashswaminathan.com. CI (`.github/workflows/ci.yml`) runs migrations and the server tests against Postgres and Redis, and builds the client, on every PR | 847 server tests

**Goal**: A portfolio visitor can open the site, message the owner, and the owner gets notified.

**Critical path to the goal (~1-2 hours left)**: follow `DEPLOY.md` (Railway project, env vars, owner account, ntfy + Resend, smoke test). Week 12 and the backlog come after launch.

---

## Table of Contents

1. [Week 1-12 Plan](#week-1-12-plan)
2. [Overall Progress Summary](#overall-progress-summary)
3. [Feature Deferral Tracking](#feature-deferral-tracking)
4. [API Design](#api-design)
5. [Database Design](#database-design)
6. [Socket.io Events](#socketio-events)
7. [System Architecture](#system-architecture)
8. [Security Considerations](#security-considerations)
9. [Future Enhancements](#future-enhancements)

---

## Week 1-12 Plan

### Week 1: Project Setup & Authentication (7 hours) - COMPLETED

**Day 1-2: Environment Setup (2 hours)**
- [x] Initialize Node.js project with Express
- [x] Setup PostgreSQL and Redis with Docker
- [x] Configure ESLint, Prettier
- [x] Create project structure and environment variables

**Day 3-4: Database Schema (2 hours)**
- [x] Create database migrations (users, sessions tables)
- [x] Implement migration runner with rollback support
- [x] Test database connections

**Day 5-7: Authentication System (3 hours)**
- [x] Password hashing (bcrypt, 12 salt rounds)
- [x] JWT utilities (access: 15min, refresh: 7 days)
- [x] Registration, login, logout, refresh endpoints
- [x] Auth middleware and rate limiting
- [x] 38 tests passing

**Milestone 1**: Users can register and login

---

### Week 2: User Management (7 hours) - COMPLETED

**Day 1-2: User Profile CRUD (2 hours)**
- [x] GET/PUT /api/users/me endpoints
- [x] Public user profile endpoint
- [x] Input validation middleware

**Day 3-4: User Search (2 hours)**
- [x] User search by username/email with pagination
- [x] Status update endpoint (online/offline/away/busy)

**Day 5-7: Avatar Upload (3 hours)**
- [x] MinIO S3-compatible storage with Docker
- [x] Multer middleware for file uploads
- [x] Avatar upload endpoint with validation
- [x] 165 tests passing

**Milestone 2**: Complete user management system

---

### Week 3: Socket.io Setup & Presence (7 hours) - COMPLETED

**Day 1-2: Socket.io Configuration (2 hours)**
- [x] Socket.io server with Redis adapter
- [x] Graceful shutdown with 30s timeout
- [x] K6 load tests (up to 1000 users)
- [x] 21 integration tests

**Day 3-4: Socket Authentication (2 hours)**
- [x] JWT authentication middleware for sockets
- [x] Multi-device support (multiple connections per user)
- [x] User room creation (`user:${userId}`)
- [x] 35 auth tests

**Day 5-7: Presence System (3 hours)**
- [x] Redis-based presence tracking (TTL: 60s)
- [x] Heartbeat mechanism (refresh every 25s)
- [x] Presence broadcasting to contacts
- [x] Stale connection cleanup (every 5 minutes)
- [x] 46 presence tests, 268 total tests

**Milestone 3**: Real-time connection with presence tracking

---

### Week 4: Basic Messaging (7 hours) - COMPLETED

**Day 1-2: Conversation Setup (2 hours)**
- [x] Conversations and conversation_participants tables
- [x] POST /api/conversations/direct (idempotent)
- [x] GET /api/conversations with pagination
- [x] PostgreSQL advisory locks for race conditions
- [x] 50+ tests

**Day 3-5: Message Sending (3 hours)**
- [x] Messages table with soft delete
- [x] Socket events: message:send, message:edit, message:delete
- [x] Rate limiting (30/min, 5 burst/sec)
- [x] Optimistic updates with tempId
- [x] 80 tests

**Day 6-7: Message Retrieval (2 hours)**
- [x] message_status table (sent/delivered/read)
- [x] Redis caching layer (messageCacheService)
- [x] Socket events: message:delivered, message:read
- [x] GET /api/messages/conversations/:id with pagination
- [x] GET /api/messages/unread

**Milestone 4**: Users can send and receive real-time messages

---

### Week 5: Enhanced Messaging (4 hours) - COMPLETED

**Day 1-2: Message Editing & Deletion (1.5 hours)**
- [x] PUT/DELETE /api/messages/:messageId
- [x] 15-minute edit time limit
- [x] Socket events: message:edit-confirmed, message:delete-confirmed
- [x] Cache invalidation on edit/delete

**Day 3: Read Receipts Enhancement (1 hour)**
- [x] Privacy settings (users.hide_read_status column)
- [x] Privacy-aware broadcasting
- [x] PUT /api/users/me/privacy endpoint

**Day 4-5: Message Search (1.5 hours)**
- [x] PostgreSQL full-text search with GIN index
- [x] GET /api/messages/search?q=query
- [x] Cursor-based pagination
- [x] 423 tests passing

**Milestone 5**: Full-featured messaging with edit/delete, read receipts, and search

---

### Week 6: Contact System Foundation (3 hours) - COMPLETED

**Day 1: Contact CRUD (1.5 hours)**
- [x] contacts table (migration 011)
- [x] POST /api/contacts (idempotent)
- [x] GET /api/contacts with pagination
- [x] PUT/DELETE /api/contacts/:contactId
- [x] 73 tests

**Day 2: Contact Blocking (1 hour)**
- [x] POST /api/contacts/:contactId/block|unblock
- [x] Prevent messaging from blocked users
- [x] Filter blocked users from search
- [x] 51 tests

**Day 3: Contact Discovery (0.5 hours)**
- [x] ?excludeContacts=true filter on user search
- [x] 9 tests, 569 total tests

**Milestone 6**: Complete contact management system

---

### Week 7: Group Messaging Foundations (4 hours) - COMPLETED

**Day 1-2: Group Conversation Creation (2 hours)**
- [x] POST /api/conversations/group (min 3 participants)
- [x] Creator gets role='admin', others get role='member'
- [x] Auto-generate group names if not provided
- [x] GET /api/conversations?type=group filter

**Day 3-4: Group Messaging (2 hours)**
- [x] Message handler already supports groups
- [x] GET /api/conversations/:id/participants
- [x] 17 new tests

**Milestone 7a**: Group conversation foundation complete

---

### Week 8: Group Management & Polish (4 hours) - COMPLETED

**Day 1-2: Add/Remove Participants (2 hours)**
- [x] POST /api/conversations/:id/participants (admin-only)
- [x] DELETE /api/conversations/:id/participants/:userId (admin or self)
- [x] Race condition fix with database transactions
- [x] Last admin protection with auto-promotion
- [x] Socket events: conversation:participant-added, conversation:participant-removed

**Day 3: Group Settings (1 hour)**
- [x] PUT /api/conversations/:id (name/avatar, admin-only)
- [x] PUT /api/conversations/:id/participants/:userId/role (promote/demote)
- [x] 31 tests

**Day 4-5: Group Polish (1 hour)**
- [x] Message mentions (@username) with regex parsing
- [x] Socket event: message:mentioned
- [x] 469 new unit tests, 720 total tests

**Milestone 7b**: Feature-complete group messaging system

---

> **Plan revised 2026-10-08.** Weeks 9-12 below are the critical path to the goal. The original Weeks 11-18 are kept as an optional backlog at the end. Design details: `.claude/Week9_Design.md`.

### Product rules (apply to everything below)

- Everyone can always message the owner. A conversation with the owner is created automatically at signup.
- Nobody can message a stranger. Users other than the owner can only connect by sending a request to an exact username, and can only message after it is accepted (Week 12).
- No browsing or partial search of users for non-owners. Emails are never returned for other users.
- Both sides get notified: the owner on a visitor's message, the visitor by email when the owner replies.
- This is a small portfolio app: no captcha, single server instance.

---

### Week 9: Working Chat UI + Privacy Lockdown (7-8 hours) - COMPLETED

**Day 1-2: React Setup & Authentication** - COMPLETED
- [x] Create React app with Vite; react-router-dom, axios, socket.io-client
- [x] Login/Register pages, AuthContext, Axios interceptor, protected routes

**Day 3: Client fixes (0.5 hours)**
- [x] `AuthContext.jsx`: declare `logout` before `startTokenRefresh` (crash on first render)
- [x] `AuthContext.jsx`: save a rotated refresh token in init and interval paths
- [x] `SocketContext.jsx`: pass `auth` as a function reading the current access token
- [x] `SocketContext.jsx`: emit `heartbeat` every 25s (presence expires after 60s without it)

**Day 4-5: Chat UI (3.5 hours)**
- [x] `conversations.api.js`, `messages.api.js`, `utils/normalize.js`
- [x] `ChatContext` + `useChat`: conversations, active conversation, messages, unread counts
- [x] Sidebar list from GET /api/conversations; selecting a conversation; auto-select when there is only one
- [x] History from GET /api/messages/conversations/:id (reverse newest-first, "Load earlier" button)
- [x] Optimistic send with tempId; handle `message:new`, `message:sent`, `message:error` with retry
- [x] Unread badges (GET /api/messages/unread + live), `message:read` on open
- [x] Reconnect: refetch and merge without dropping pending messages
- [x] Scroll to bottom on new message; visitor-appropriate empty states

**Day 6: Server - live delivery (1 hour)**
- [x] On socket connect, join the socket to all of the user's `conversation:{id}` rooms
- [x] When a conversation is created or a participant added, join that user's online sockets to the room
- [x] Emit `conversation:new` to participants' user rooms so sidebars update live

**Day 7: Server - owner-only lockdown, Phase A (2 hours)**
- [x] `OWNER_USER_ID` + `OWNER_ONLY_MODE` env vars (flag off = current behaviour, existing tests unchanged)
- [x] `ownerService.js`: `isOwner()`, `createAutoConversationWithOwner()`; hook into register (fire-and-forget, idempotent)
- [x] With flag on, for non-owners: user search refused; profile fetch only for self or owner; direct conversation and add-contact only with owner; group creation and add-participants refused
- [x] Remove `email` from participants in GET /api/conversations
- [x] Tests for flag-on paths
- [x] Registration also adds contact rows both ways with the owner (presence is only broadcast to contacts)

**Bugs found and fixed while verifying against a running server** (hidden before because tests mock these)
- [x] `User.findById` did not exist, so POST /api/conversations/direct and POST /api/contacts always returned 500
- [x] The shared Redis client was never connected at startup, so presence, unread counts and the message cache silently did nothing

**Milestone 8**: A visitor registers, lands in a chat with the owner, and both sides see messages live. Visitors cannot see or reach each other.

---

### Week 10: Notifications & Password Reset (5 hours) - COMPLETED (code); owner setup below still to do

**Day 1: Owner notifications (1.5 hours)**
- [x] `notificationService.js` with ntfy.sh push + Resend email (HTML-escaped). Both are plain `fetch` calls, so the `resend` package is not needed
- [x] Env: `NTFY_TOPIC`, `RESEND_API_KEY`, `OWNER_EMAIL`, `EMAIL_FROM`, `APP_URL`
- [x] Hook into `message:send`: notify when a recipient is the owner and the owner is offline or it is the first message of the conversation
- [x] Cap: at most one notification per conversation per 10 minutes, and 30 per hour overall
- [ ] **Owner setup**: install the ntfy app and subscribe to a hard-to-guess topic (`NTFY_TOPIC`); create a Resend account, verify a sender, set `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`. Until then pushes and emails are skipped (in development the password reset link is written to the server log instead)

**Day 2: Owner reminder (1 hour)**
- [x] Redis sorted set `reminders:pending` (score = due time, member = conversationId), added on visitor message
- [x] Removed when the owner replies
- [x] 60s `setInterval` sweep fires due reminders: "You haven't replied to {username} yet - they messaged 90 min ago"

**Day 3: Visitor reply email (1 hour)**
- [x] When the owner sends a message and the recipient has no active socket, email the recipient: "{owner} replied to you" with a link back
- [x] At most one email per conversation per 30 minutes
- [x] `users.email_notifications` column (default true, migration 019) + unsubscribe link in the email (GET /api/users/unsubscribe, signed token, no login)

**Day 4-5: Password reset (1.5 hours)**
- [x] `password_resets` table (migration 020): user_id, token_hash, expires_at (30 min), used_at
- [x] POST /api/auth/forgot-password { email }: always returns 200; rate limited (3/hour per IP and per email); emails a single-use link
- [x] POST /api/auth/reset-password { token, password }: sets password, marks token used, revokes all sessions
- [x] Client: "Forgot password?" link, forgot-password page, reset-password page
- [x] Tests

**Notification Flow**
```
Visitor sends message → recipient is OWNER_USER_ID?
  YES → push + email to owner (within caps)
        add conversation to reminders:pending (due = now + 90min)
              │
        Owner replies within 90min?
          YES → remove from reminders:pending
                visitor offline? → email visitor (max 1 per 30min)
          NO  → 60s sweep finds it due → reminder push + email
```

**Milestone 9**: Owner gets push + email on a visitor's message and a reminder if unanswered; visitors get an email when the owner replies; forgotten passwords can be reset.

---

### Week 11: Polish & Deployment (6 hours) - CODE COMPLETE; deployment itself is the owner's step

**Day 1-2: Polish**
- [x] Online/offline indicator for the other participant (`presence:changed`, `presence:bulk`)
- [x] `lastMessage` in GET /api/conversations so sidebar previews survive a refresh
- [x] Loading and error states; mobile layout (one pane at a time with a back button)
- [ ] Move refresh token from localStorage to httpOnly cookie. Deferred: it changes the auth API (the token must leave the response body to be worth doing) and its tests; do it after launch

**Day 3: Deploy prep**
- [x] Express serves `client/dist` with SPA fallback in production (single service, same origin; no Nginx)
- [x] `config/database.js`: `DATABASE_URL`, optional SSL (`DB_SSL=true`), 10s connect timeout, query text logged only with `LOG_SQL=true`
- [x] `trust proxy` in production so rate limits use the real client IP
- [x] Object storage is optional: the server starts without MinIO (avatar uploads disabled)
- [x] Migrations: runner skips `*_rollback.sql`; migration 021 restores the group fields a lost migration used to add; a clean run on an empty database passes the full test suite
- [x] Redis URL (which contains the password in production) is no longer logged
- [x] Message cache read fixed; socket integration suite uses a free port; favicon added
- [ ] `docker-compose.yml` and `config/storage.js` still carry default local credentials; they are development-only, but set real `MINIO_*` values if avatar uploads are enabled in production

**Day 4-5: Deploy**
- [x] One `Dockerfile` building the client then running the server (migrations run on start); verified locally against an empty database
- [x] `DEPLOY.md`: environment variables, Railway steps, smoke test
- [ ] **Owner**: create the Railway project (app + Postgres + Redis), set the variables, generate the domain
- [ ] **Owner**: register the owner account on the live site, set `OWNER_USER_ID`, redeploy
- [ ] **Owner**: ntfy app + Resend account (`NTFY_TOPIC`, `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL`)
- [ ] **Owner**: smoke test from a phone in a private window: register, send a message, confirm push + email + reminder + visitor reply email + password reset

**Milestone 10**: Live on the internet; the goal is met.

---

### Week 12: Connection Requests, Phase B (4 hours) - COMPLETED

- [x] `contact_requests` table (migration 022): sender_id, recipient_id, status (pending|accepted|rejected), created_at, responded_at; unique per pair
- [x] POST /api/contact-requests { username }: exact username only; same response whether or not the user exists; 10 per day; a rejected request cannot be re-sent for 30 days
- [x] GET /api/contact-requests?type=received|sent; PUT /api/contact-requests/:id/accept|reject
- [x] Accepting creates contact rows both ways and the direct conversation
- [x] Lockdown rule is now "owner or accepted connection" for direct conversations, profiles and group membership (`canReachAll` in `ownerService.js`); user search stays owner-only
- [x] Socket events: `contact-request:received`, `contact-request:accepted`
- [x] Client: "Add by username" field and a requests inbox with accept/reject (`ConnectionRequests.jsx`, bottom of the sidebar)
- [x] Tests (`contactRequestController.spec.js`, plus additions to the owner-only specs)

Behaviour worth knowing:
- If both people ask each other, the second request accepts the first.
- The person who declined can ask the other way straight away; only the declined sender waits 30 days.
- Requests to or from the owner, and between users where either has blocked the other, are silently dropped.
- There is no "disconnect": blocking is how a connection is cut off.

**Milestone 11**: Users can talk to each other, but only by mutual consent.

---

### Optional Backlog (not required for the goal)

Pick from these after launch; each is independent.

| Feature | Notes | Estimate |
|---|---|---|
| Group chats UI | Create-group modal, settings modal, admin-only controls (backend exists) | 2 h |
| Typing indicators | Redis-backed state, "Alice is typing...", aggregate for groups | 2.5 h |
| Read receipt UI | ✓ / ✓✓ icons, privacy toggle, "Read by X" list for groups | 2.5 h |
| Avatars and file attachments | Avatar display, upload endpoint for documents/media, thumbnails, drag and drop | 5 h |
| Edit history | `message_edit_history` table, history endpoint, diff view | 2.5 h |
| Mentions | `message_mentions` table, autocomplete, highlighting | 2 h |
| Reactions, forwarding, pinned messages | New tables and endpoints, emoji picker | 5 h |
| Voice messages | Recorder, upload endpoint, waveform player | 4 h |
| Material-UI restyle | Theme + component swap | 1.5 h |
| Performance | EXPLAIN ANALYZE pass, cache participant lists, K6 at 1000 users, Sentry, log rotation | 5 h |
| Group invite links, group permissions, mute/archive | Remaining Week 18 items (last-admin protection is already done) | 4.5 h |
| One-click guest entry | Skip registration for visitors | 2 h |

---
