# ChatterBox - Real-Time Messaging Platform

> A production-ready MVP messaging platform with real-time communication, contact management, and extensible architecture

**Status**: Week 9 Day 3-4 NEXT (auth pages written, chat UI still placeholders) | Backend Complete with 720 tests (716 passing, 4 skipped) - 99.4% pass rate

**Goal**: A portfolio visitor can open the site, message the owner, and the owner gets notified.

**Critical path to the goal (~12-15 hours)**: Week 9 → Week 19 → Week 10. Weeks 11-18 are optional extras and do not block launch.

---

## Table of Contents

1. [Week 1-18 Plan](#week-1-18-plan)
2. [Overall Progress Summary](#overall-progress-summary)
3. [Feature Deferral Tracking](#feature-deferral-tracking)
4. [API Design](#api-design)
5. [Database Design](#database-design)
6. [Socket.io Events](#socketio-events)
7. [System Architecture](#system-architecture)
8. [Security Considerations](#security-considerations)
9. [Future Enhancements](#future-enhancements)

---

## Week 1-18 Plan

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

### Week 9: Minimal Viable Frontend (5 hours) - NEXT

**Day 1-2: React Setup & Authentication (2.5 hours)**
- [x] Create React app with Vite
- [x] Install: react-router-dom, axios, socket.io-client
- [x] Login/Register pages
- [x] AuthContext for token management
- [x] Axios interceptor for JWT tokens
- [x] Protected route wrapper
- [ ] Fix: `AuthContext.jsx` uses `logout` in `startTokenRefresh` deps (line 85) before it is declared (line 145) - move `logout` above it
- [ ] Fix: AuthContext refresh paths should save a rotated refresh token like the Axios interceptor does

**Day 3-4: Chat Interface Foundation (2.5 hours)**
- [ ] Sidebar with conversation list (fetch GET /api/conversations; currently a placeholder)
- [ ] Active-conversation state shared by Sidebar and ChatWindow
- [ ] Chat window with message list + input (load history, emit `conversation:join`)
- [x] Socket.io connection in SocketContext
- [ ] Send with `message:send` + tempId; handle `message:sent`, `message:new`, `message:error`
- [ ] Real-time message display
- [ ] Fix: pass socket `auth` as a function reading the current access token (reconnect after 15 min fails with the stale one)
- [ ] Fix: empty-state copy "Start chatting with your contacts!" does not fit a visitor
- [x] Basic styling with plain CSS

**Milestone 8**: Basic UI functional

---

### Week 10: Frontend Completion & Deployment (5 hours) - PENDING

**Day 1-2: Group Chats UI (2 hours)**
- [ ] "Create Group" button + modal
- [ ] Group settings modal (add/remove members)
- [ ] Admin-only UI elements

**Day 3: Polish & Bug Fixes (1.5 hours)**
- [ ] Message timestamps + online/offline indicators
- [ ] Scroll to bottom on new message
- [ ] Loading states + error messages
- [ ] Mobile responsive (basic)
- [ ] Fix: stale refresh token in AuthContext interval (read from storage each tick)
- [ ] Fix: SocketContext cleanup should disconnect unconditionally on unmount
- [ ] Fix: move refresh token from localStorage to httpOnly cookie (XSS mitigation)

**Day 4-5: Deployment (1.5 hours)**
Deploy prep (code changes):
- [ ] Express serves `client/dist` with SPA fallback (single service, same origin - replaces Nginx + separate client Dockerfile)
- [ ] `config/database.js`: support `DATABASE_URL` + SSL, raise 2s connect timeout, stop logging every query text
- [ ] `app.set('trust proxy', 1)` so rate limits use the real client IP (register limit is 3/hour per IP)
- [ ] Make MinIO optional: `initializeBucket()` failure must not exit the server
- [ ] Migrations: runner must skip `*_rollback.sql` files; resolve missing 003, 004, 014-016; verify a clean run on an empty database
- [ ] Remove hardcoded credentials from `docker-compose.yml` for anything production-facing

Deploy:
- [ ] One Dockerfile (or Nixpacks) building client then running server
- [ ] Railway.app: app service + Postgres plugin + Redis plugin (~$5/month); HTTPS is provided, no SSL setup needed
- [ ] Env vars: `NODE_ENV`, `DATABASE_URL`, `REDIS_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CLIENT_URL`, `OWNER_USER_ID`, `NTFY_TOPIC`, `RESEND_API_KEY`, `OWNER_EMAIL`
- [ ] Run `npm run migrate` as release command
- [ ] Register owner account on the live site, set `OWNER_USER_ID`, redeploy
- [ ] Smoke test from a phone in incognito: register, send message, confirm push + email + reminder

**Milestone 9**: Production deployment complete

---

### Week 11: Frontend Feature Completion (5 hours) - PENDING

**Day 1-2: Typing Indicators & Read Receipts UI (2 hours)**
- [ ] "User is typing..." display with animation
- [ ] Message status icons: ✓ (sent), ✓✓ (delivered/read)
- [ ] Privacy settings toggle

**Day 3: Avatar & File Upload UI (1.5 hours)**
- [ ] Display user avatars in conversation/message lists
- [ ] File attachment button with preview
- [ ] Progress indicators

**Day 4-5: Material-UI Integration (1.5 hours)**
- [ ] Install @mui/material
- [ ] Theme file with color palette
- [ ] Replace components with MUI
- [ ] Responsive layout

**Milestone 10**: Feature-complete frontend

---

### Week 12: Backend Feature Completion (5 hours) - PENDING

**Day 1-2: Full Edit History (2 hours)**
- [ ] Create message_edit_history table
- [ ] Store previous content before editing
- [ ] GET /api/messages/:messageId/history endpoint

**Day 3: Enhanced Typing for Groups (1.5 hours)**
- [ ] Redis-based typing state
- [ ] Aggregate: "Alice, Bob, and 2 others are typing..."
- [ ] Batch typing updates

**Day 4-5: Group Read Receipts (1.5 hours)**
- [ ] GET /api/messages/:messageId/read-by endpoint
- [ ] Aggregate read receipts for groups
- [ ] "Read by Alice, Bob, and 3 others" UI

**Milestone 11**: All deferred backend features implemented

---

### Week 13: File Attachments & Mentions (5 hours) - PENDING

**Day 1-2: File Attachments Backend (2.5 hours)**
- [ ] Extend Multer for documents, videos, audio
- [ ] POST /api/upload/attachment endpoint
- [ ] Server-side thumbnail generation (sharp, ffmpeg)
- [ ] GET /api/files/:fileId (authenticated download)

**Day 3: File Attachments Frontend (1 hour)**
- [ ] Drag & drop file upload
- [ ] Image thumbnails and lightbox
- [ ] File download links

**Day 4-5: Enhanced Message Mentions (1.5 hours)**
- [ ] Create message_mentions table
- [ ] GET /api/messages/mentions endpoint
- [ ] Mention autocomplete UI
- [ ] Mention highlighting

**Milestone 12**: Full-featured messaging with files and enhanced mentions

---

### Week 14: Performance Optimization (5 hours) - PENDING

**Day 1-2: Database Optimization (2 hours)**
- [ ] Analyze slow queries with EXPLAIN ANALYZE
- [ ] Add missing indexes
- [ ] Query result caching expansion

**Day 3: Redis Caching Expansion (1.5 hours)**
- [ ] Cache conversation participant lists
- [ ] Cache warming on server startup
- [ ] Monitor cache hit rate (>80% target)

**Day 4-5: Load Testing & Monitoring (1.5 hours)**
- [ ] K6 load tests (1000 concurrent users)
- [ ] Sentry free tier for error tracking
- [ ] Winston logs with daily rotation

**Milestone 13**: Performance optimization complete

---

### Week 15: Message Reactions & Forwarding (5 hours) - PENDING

**Day 1-2: Message Reactions (2.5 hours)**
- [ ] Create message_reactions table
- [ ] POST /api/messages/:messageId/reactions
- [ ] Socket event: message:reaction-added
- [ ] Emoji picker UI

**Day 3: Message Forwarding (1.5 hours)**
- [ ] POST /api/messages/:messageId/forward
- [ ] Forward to multiple conversations

**Day 4-5: Pinned Messages (1 hour)**
- [ ] PUT /api/conversations/:id/pin/:messageId
- [ ] Pinned messages banner UI

**Milestone 14**: Advanced messaging features complete

---

### Week 16: Voice Messages (5 hours) - PENDING

**Day 1-2: Voice Recording Infrastructure (2.5 hours)**
- [ ] Voice recording component (max 2 minutes)
- [ ] Client-side audio compression
- [ ] POST /api/upload/voice endpoint
- [ ] Server-side waveform generation

**Day 3: Voice Playback (1.5 hours)**
- [ ] Voice message player component
- [ ] Waveform visualization
- [ ] Speed control (1x, 1.5x, 2x)

**Day 4-5: Final Polish (1 hour)**
- [ ] Bug fixes from production
- [ ] Update README and documentation
- [ ] Portfolio preparation

**Milestone 15**: Week 16 feature-complete

---

### Week 17: Group Enhancements (7 hours) - PENDING

> Note: overlaps Week 12 (edit history, group typing, read receipts) and Week 13 Day 4-5 (mentions). Only the items not finished there remain: diff view, ZSET typing, expandable "Read by X" list.

**Day 1-2: Full Edit History (2.5 hours)**
- [ ] message_edit_history table and UI
- [ ] Diff view for changes

**Day 3: Enhanced Typing for Groups (1.5 hours)**
- [ ] Redis-based typing with ZSET
- [ ] "Several people are typing" when >5 users

**Day 4: Group Read Receipts Aggregation (1.5 hours)**
- [ ] GET /api/messages/:messageId/read-by
- [ ] "Read by X" expandable list

**Day 5-7: Enhanced Message Mentions (1.5 hours)**
- [ ] message_mentions table
- [ ] Mention autocomplete and highlighting

**Milestone 16**: Group messaging feature-complete

---

### Week 18: Contact Requests & Permissions (8 hours) - PENDING

**Day 1: Contact Request Model (1 hour)**
- [ ] contact_requests table
- [ ] ContactRequest.js model (8 methods)

**Day 2: Contact Request Endpoints (1.5 hours)**
- [ ] POST /api/contact-requests
- [ ] GET /api/contact-requests?type=received|sent
- [ ] PUT /api/contact-requests/:id/accept|reject
- [ ] Socket events for notifications

**Day 3: Group Invite Links (2 hours)**
- [ ] group_invites table
- [ ] POST /api/conversations/:id/invites
- [ ] POST /api/invites/:code/join

**Day 4: Group Permissions (1.5 hours)**
- [ ] group_permissions table
- [ ] PUT /api/conversations/:id/permissions
- [ ] checkGroupPermission() middleware

**Day 5: Muting & Archiving (1 hour)**
- [ ] PUT /api/conversations/:id/mute|archive
- [ ] GET /api/conversations?archived=true

**Day 6: Last Admin Protection (1 hour)** - already done in Week 8 Day 1-2
- [x] Prevent removing last admin
- [x] Auto-promote oldest member

**Milestone 17**: All Week 7-8 deferred features implemented

---

### Week 19: Owner Notification System (3 hours) - PENDING - DO RIGHT AFTER WEEK 9, BEFORE DEPLOYING

> Not started: only the design doc `.claude/New_Feature.md` exists. No `ownerService.js` or `notificationService.js` in the code yet.

**Day 1: Auto-Conversation on Registration (1 hour)**
- [ ] Create `src/services/ownerService.js` with `createAutoConversationWithOwner()`
- [ ] Hook into `POST /api/auth/register` (fire-and-forget, idempotent)
- [ ] Add `OWNER_USER_ID` to `.env`
- [ ] New user sees owner in sidebar immediately after signup, with that conversation auto-selected
- [ ] Also add contact rows both ways on registration (presence only broadcasts to contacts, so visitors would never see the owner online)
- [ ] Decide: keep full registration for visitors, or add a one-click guest entry (~2 hours extra)

**Day 2: Push & Email Notifications (1 hour)**
- [ ] Install `resend` package (`npm install resend`)
- [ ] Create `src/services/notificationService.js` with ntfy.sh push + Resend email
- [ ] Add `NTFY_TOPIC`, `RESEND_API_KEY`, `OWNER_EMAIL` to `.env`
- [ ] Hook into `message:send` socket handler — notify only when recipient is owner
- [ ] Only fire on first message per conversation (configurable)
- [ ] Set up ntfy app on phone + Resend account (free tier, 3k emails/month)
- [ ] Schedule follow-up reminder if owner hasn't replied within 90 minutes
  - [ ] Store pending reminder in a Redis sorted set (`reminders:pending`, score = due time, member = conversationId)
  - [ ] On owner reply, cancel the reminder (remove from the sorted set)
  - [ ] Sweep the set every 60s with `setInterval` and fire due reminders (a Redis TTL expiring triggers nothing by itself, and `setTimeout` is lost on every redeploy)
  - [ ] Reminder notification: "You haven't replied to {username} yet — they messaged 90 min ago"

**Notification Flow**
```
Guest sends message → Is recipient OWNER_USER_ID?
  NO  → skip
  YES → Fire ntfy push + Resend email immediately
        Add to Redis sorted set reminders:pending (due = now + 90min)
              │
        Owner replies within 90min?
          YES → remove from sorted set (no reminder)
          NO  → 60s sweep finds it due → fire reminder push + email
```

**Milestone 18**: Owner gets instant push + email when a portfolio visitor messages them, plus a follow-up reminder if unanswered after 90 minutes

---