# ChatterBox - Real-Time Messaging Platform

> A production-ready MVP messaging platform with real-time communication, contact management, and extensible architecture

**Status**: Week 9 Day 1-2 NEXT | Backend Complete with 720 tests (716 passing, 4 skipped) - 99.4% pass rate

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
- [ ] Create React app with Vite
- [ ] Install: react-router-dom, axios, socket.io-client
- [ ] Login/Register pages
- [ ] AuthContext for token management
- [ ] Axios interceptor for JWT tokens
- [ ] Protected route wrapper

**Day 3-4: Chat Interface Foundation (2.5 hours)**
- [ ] Sidebar with conversation list
- [ ] Chat window with message list + input
- [ ] Socket.io connection in SocketContext
- [ ] Real-time message display
- [ ] Basic styling with plain CSS

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

**Day 4-5: Deployment (1.5 hours)**
- [ ] Docker setup (server + client Dockerfiles)
- [ ] Nginx configuration
- [ ] Deploy to Railway.app ($5/month)
- [ ] SSL certificate setup

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

**Day 6: Last Admin Protection (1 hour)**
- [ ] Prevent removing last admin
- [ ] Auto-promote oldest member

**Milestone 17**: All Week 7-8 deferred features implemented

---

## Overall Progress Summary

### Completed Weeks
| Week | Focus | Status |
|------|-------|--------|
| 1 | Project Setup & Authentication | COMPLETED |
| 2 | User Management | COMPLETED |
| 3 | Socket.io Setup & Presence | COMPLETED |
| 4 | Basic Messaging | COMPLETED |
| 5 | Enhanced Messaging | COMPLETED |
| 6 | Contact System Foundation | COMPLETED |
| 7 | Group Messaging Foundations | COMPLETED |
| 8 | Group Management & Polish | COMPLETED |

### Upcoming Weeks
| Week | Focus | Status |
|------|-------|--------|
| 9 | Minimal Viable Frontend | NEXT |
| 10 | Deployment & Group UI | Pending |
| 11 | Frontend Feature Completion | Pending |
| 12 | Backend Feature Completion | Pending |
| 13 | File Attachments & Mentions | Pending |
| 14-18 | Advanced Features | Pending |

### Stats
- **Total Tests**: 720 (716 passing, 4 skipped) - 99.4% pass rate
- **Code Quality**: 0 ESLint errors, 10 warnings
- **Database Migrations**: 18 applied
- **API Endpoints**: 32+ routes with rate limiting
- **Socket.io Events**: 15+ events

---

## Feature Deferral Tracking

### Features Deferred from Week 5
| Feature | Recovery Week |
|---------|---------------|
| Full Edit History Table | Week 12 |
| Version Rollback | Week 12 |

### Features Deferred from Week 7-8
| Feature | Recovery Week |
|---------|---------------|
| Typing Indicators for Groups | Week 12 |
| Group Read Receipt Aggregation | Week 12 |
| Enhanced Mentions (autocomplete) | Week 13 |
| Mention Persistence Table | Week 13 |
| Group Permissions System | Week 18 |
| Group Invite Links | Week 18 |

### Features Simplified in Week 9
| Feature | Recovery Week |
|---------|---------------|
| Typing Indicators UI | Week 11 |
| Read Receipts UI | Week 11 |
| Avatar Display | Week 11 |
| File Upload UI | Week 11 |
| Material-UI Integration | Week 11 |

---

## API Design

### Authentication Endpoints

```
POST /api/auth/register
Body: { username, email, password }
Response: { user, accessToken, refreshToken }
Rate Limit: 3/hour

POST /api/auth/login
Body: { email, password }
Response: { user, accessToken, refreshToken }
Rate Limit: 5/15min

POST /api/auth/logout
Headers: Authorization: Bearer <token>
Response: { message: "Logged out" }

POST /api/auth/refresh
Body: { refreshToken }
Response: { accessToken, refreshToken }

GET /api/auth/me
Headers: Authorization: Bearer <token>
Response: { user }
```

### User Endpoints

```
GET /api/users/me
Response: { user }

PUT /api/users/me
Body: { displayName?, bio?, status? }
Response: { user }

PUT /api/users/me/avatar
Body: FormData (multipart/form-data)
Response: { avatarUrl }
Rate Limit: 10/hour

PUT /api/users/me/status
Body: { status: "online"|"offline"|"away"|"busy" }
Response: { status }

PUT /api/users/me/privacy
Body: { hideReadStatus: boolean }
Response: { hideReadStatus }
Rate Limit: 10/15min

GET /api/users/search?q={query}&limit={n}&offset={n}&excludeContacts={bool}
Response: { users[], total, hasMore }
Rate Limit: 120/min

GET /api/users/:userId
Response: { user (public fields only) }
```

### Contact Endpoints

```
POST /api/contacts
Body: { userId, nickname? }
Response: { contact, created: boolean }
Rate Limit: 30/15min

GET /api/contacts?limit={n}&offset={n}&includeBlocked={bool}
Response: { contacts[], pagination }
Rate Limit: 120/15min

GET /api/contacts/exists/:userId
Response: { exists, contactId? }

PUT /api/contacts/:contactId
Body: { nickname?, isFavorite? }
Response: { contact }

DELETE /api/contacts/:contactId
Response: { message: "Contact removed" }

POST /api/contacts/:contactId/block
Response: { message: "Contact blocked" }
Rate Limit: 20/15min

POST /api/contacts/:contactId/unblock
Response: { message: "Contact unblocked" }
Rate Limit: 20/15min
```

### Conversation Endpoints

```
POST /api/conversations/direct
Body: { participantId }
Response: { conversation }
Rate Limit: 60/min

POST /api/conversations/group
Body: { participantUserIds[], name?, avatarUrl? }
Response: { conversation }
Rate Limit: 60/min

GET /api/conversations?limit={n}&offset={n}&type={direct|group}
Response: { conversations[], pagination }
Rate Limit: 120/min

GET /api/conversations/:conversationId/participants
Response: { participants[] }
Rate Limit: 120/min

POST /api/conversations/:conversationId/participants (admin-only)
Body: { userIds[] }
Response: { addedParticipants[] }
Rate Limit: 60/min

DELETE /api/conversations/:conversationId/participants/:userId (admin or self)
Response: { message: "Participant removed" }

PUT /api/conversations/:conversationId (admin-only)
Body: { name?, avatarUrl? }
Response: { conversation }

PUT /api/conversations/:conversationId/participants/:userId/role (admin-only)
Body: { role: "admin"|"member" }
Response: { participant }
```

### Message Endpoints

```
GET /api/messages/conversations/:conversationId?cursor={id}&limit={n}
Response: { messages[], nextCursor, hasMore, cached }
Rate Limit: 60/min

GET /api/messages/unread
Response: { totalUnread, byConversation: {} }

GET /api/messages/search?q={query}&conversationId={id?}&cursor={c}&limit={n}
Response: { messages[], nextCursor, hasMore }
Rate Limit: 60/min

PUT /api/messages/:messageId
Body: { content }
Response: { message }
Validation: 15-minute edit window, owner only

DELETE /api/messages/:messageId
Response: { message: "Message deleted" }
Validation: Owner only, soft delete
```

---

## Database Design

### Entity Relationship Diagram

```
┌─────────────────┐
│     USERS       │
│─────────────────│
│ id (PK)         │───┐
│ username        │   │
│ email           │   │
│ password_hash   │   │
│ display_name    │   │
│ avatar_url      │   │
│ status          │   │
│ last_seen       │   │
│ hide_read_status│   │
└─────────────────┘   │
                      │
       ┌──────────────┴─────────────────────┐
       │                                    │
┌──────▼──────────┐              ┌─────────▼────────┐
│    CONTACTS     │              │  CONVERSATIONS   │
│─────────────────│              │──────────────────│
│ id (PK)         │              │ id (PK)          │
│ user_id (FK)    │              │ type             │
│ contact_user_id │              │ name             │
│ nickname        │              │ avatar_url       │
│ is_blocked      │              │ created_by (FK)  │
│ is_favorite     │              │ last_message_at  │
│ added_at        │              └──────────────────┘
└─────────────────┘                       │
                                          │
                           ┌──────────────┼──────────────┐
                           │                             │
                  ┌────────▼────────┐         ┌─────────▼─────────┐
                  │    MESSAGES     │         │  CONVERSATION_    │
                  │─────────────────│         │   PARTICIPANTS    │
                  │ id (PK)         │         │───────────────────│
                  │ conversation_id │         │ conversation_id   │
                  │ sender_id (FK)  │         │ user_id (FK)      │
                  │ content         │         │ role              │
                  │ created_at      │         │ joined_at         │
                  │ updated_at      │         │ left_at           │
                  │ deleted_at      │         │ last_read_at      │
                  └─────────────────┘         │ is_muted          │
                           │                  │ is_archived       │
                  ┌────────▼────────┐         └───────────────────┘
                  │ MESSAGE_STATUS  │
                  │─────────────────│
                  │ message_id (FK) │
                  │ user_id (FK)    │
                  │ status          │
                  │ timestamp       │
                  └─────────────────┘
```

### Tables (Current Schema)

**users** (migration 001, 009)
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'offline',
    last_seen TIMESTAMP,
    hide_read_status BOOLEAN DEFAULT FALSE,  -- migration 009
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE
);
-- Indexes: email, username, phone_number, status, is_active, created_at
-- Partial index: idx_users_privacy_read_status WHERE hide_read_status = TRUE
```

**sessions** (migration 002)
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL UNIQUE,
    device_info TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);
-- Indexes: user_id, refresh_token, expires_at
```

**conversations** (migration 005)
```sql
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,  -- 'direct' or 'group'
    name VARCHAR(100),
    avatar_url VARCHAR(500),
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP
);
-- Indexes: type, updated_at DESC
-- Index for type filter: idx_conversations_type (migration 013)
```

**conversation_participants** (migration 005, 012, 017, 018)
```sql
CREATE TABLE conversation_participants (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member',  -- migration 012
    is_admin BOOLEAN DEFAULT FALSE,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,  -- migration 017
    last_read_at TIMESTAMP,
    is_muted BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    PRIMARY KEY (conversation_id, user_id)
);
-- Indexes: conversation_id, user_id, role
-- Partial indexes: active participants (WHERE left_at IS NULL)
-- Composite index for role lookups (migration 018)
```

**messages** (migration 006)
```sql
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT,
    reply_to_id UUID REFERENCES messages(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP
);
-- Indexes: conversation_id + created_at DESC, sender_id, created_at DESC
-- GIN index for full-text search (migration 010)
```

**message_status** (migration 007, 008)
```sql
CREATE TABLE message_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'delivered', 'read')),
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);
-- Indexes: message_id, user_id
-- Composite index (migration 008)
```

**contacts** (migration 011, 012)
```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100),
    is_blocked BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id),
    CHECK (user_id != contact_user_id)
);
-- Indexes: user_id, contact_user_id, blocked, favorite
-- Optimized blocking search indexes (migration 012)
```

### Applied Migrations
1. 001_create_users_table.sql
2. 002_create_sessions_table.sql
3. 005_create_conversations.sql
4. 006_create_messages.sql
5. 007_create_message_status.sql
6. 008_optimize_message_status_indexes.sql
7. 009_add_privacy_settings.sql
8. 010_add_message_search.sql
9. 011_create_contacts.sql
10. 012_add_role_to_participants.sql
11. 012_optimize_blocking_search.sql
12. 013_add_type_index.sql
13. 017_add_left_at_to_participants.sql
14. 018_add_participant_role_index.sql

---

## Socket.io Events

### Client → Server Events

```javascript
// Messaging
socket.emit('message:send', {
  conversationId: 'uuid',
  content: 'Hello!',
  tempId: 'client-uuid'  // For optimistic updates
});

socket.emit('message:edit', {
  messageId: 'uuid',
  content: 'Updated message'
});

socket.emit('message:delete', {
  messageId: 'uuid'
});

socket.emit('message:delivered', {
  messageIds: ['uuid1', 'uuid2']
});

socket.emit('message:read', {
  conversationId: 'uuid'  // Mark all as read
  // OR
  messageIds: ['uuid1']   // Mark specific messages
});

// Conversations
socket.emit('conversation:join', {
  conversationId: 'uuid'
});

socket.emit('conversation:leave', {
  conversationId: 'uuid'
});

// Presence
socket.emit('presence:update', {
  status: 'online' | 'away' | 'busy' | 'offline'
});

socket.emit('heartbeat');
```

### Server → Client Events

```javascript
// Authentication
socket.on('auth:success', { userId, username });

// Messaging
socket.on('message:new', {
  id, conversationId, senderId, content, tempId, createdAt
});

socket.on('message:sent', {
  tempId, messageId, createdAt
});

socket.on('message:edited', {
  messageId, content, editedAt
});

socket.on('message:edit-confirmed', {
  messageId, content, updatedAt
});

socket.on('message:deleted', {
  messageId, conversationId
});

socket.on('message:delete-confirmed', {
  messageId
});

socket.on('message:mentioned', {
  messageId, conversationId, senderId, content
});

socket.on('message:error', {
  tempId?, code, message
});

// Delivery Status
socket.on('message:delivery-status', {
  messageIds, userId, status, timestamp
});

socket.on('message:delivery-confirmed', {
  messageIds, updatedCount
});

socket.on('message:read-status', {
  userId, status: 'read', timestamp
});

socket.on('message:read-confirmed', {
  updatedCount
});

// Conversations
socket.on('conversation:joined', { conversationId });
socket.on('conversation:left', { conversationId });

// Presence
socket.on('presence:changed', {
  userId, status, lastSeen
});

socket.on('presence:bulk', {
  presences: { [userId]: { status, lastSeen } }
});

socket.on('presence:updated', {
  status
});

// System
socket.on('force:disconnect', { reason });
socket.on('server:shutdown', { message });
socket.on('error', { message });
```

### Socket.io Rooms

```javascript
// User-specific room (personal notifications)
`user:${userId}`

// Conversation room (group messages)
`conversation:${conversationId}`
```

---

## System Architecture

### High-Level Architecture

```
┌────────────────────────────────────────┐
│            CLIENT (React SPA)          │
│  • Socket.io Client                    │
│  • Redux State Management              │
│  • Axios for REST API                  │
└────────────────────────────────────────┘
                    ↕ (WebSocket + HTTPS)
┌────────────────────────────────────────┐
│         LOAD BALANCER (Nginx)          │
│  • SSL Termination                     │
│  • WebSocket Proxy                     │
│  • Static Asset Serving                │
└────────────────────────────────────────┘
                    ↕
┌────────────────────────────────────────┐
│     APPLICATION SERVER (Node.js)       │
│  • Express.js REST API                 │
│  • Socket.io with Redis Adapter        │
│  • JWT Authentication                  │
│  • Rate Limiting                       │
└────────────────────────────────────────┘
          ↕                    ↕
┌──────────────────┐  ┌──────────────────┐
│      REDIS       │  │   PostgreSQL     │
│  • Socket Adapter│  │  • Users         │
│  • Presence Cache│  │  • Messages      │
│  • Message Cache │  │  • Conversations │
│  • Rate Limiting │  │  • Contacts      │
└──────────────────┘  └──────────────────┘
                              ↕
                    ┌──────────────────┐
                    │  MinIO (S3)      │
                    │  • Avatars       │
                    │  • Attachments   │
                    └──────────────────┘
```

### Key Architecture Decisions

1. **Socket.io Redis Adapter**: Enables horizontal scaling across multiple server instances
2. **Cache-Aside Pattern**: Redis caches hot data (messages, presence), PostgreSQL is source of truth
3. **Soft Deletes**: Messages marked as deleted but preserved for audit
4. **UUID Primary Keys**: Better for distributed systems
5. **Cursor-based Pagination**: Efficient for real-time data with frequent inserts

### Technology Stack

| Layer | Technology |
|-------|------------|
| Runtime | Node.js v18+ |
| API Framework | Express.js v4.18+ |
| Real-time | Socket.io v4.8+ with Redis Adapter |
| Database | PostgreSQL v15+ |
| Cache | Redis v7+ |
| Object Storage | MinIO (S3-compatible) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Testing | Jest + Supertest |

---

## Security Considerations

### Authentication Security

```
Password Security:
- Minimum 8 characters with uppercase, lowercase, number
- Bcrypt hashing with 12 salt rounds (4 in test env for speed)
- Rate limiting on login attempts (5/15min per IP)

JWT Tokens:
- Access token: 15 minutes expiry
- Refresh token: 7 days expiry
- Tokens stored in httpOnly cookies (planned)
- Refresh token rotation on use

Session Management:
- Logout invalidates refresh token in database
- Track active sessions per user
- Force logout capability for all user devices
```

### API Security

```
Rate Limiting (express-rate-limit):
- Registration: 3 requests/hour per IP
- Login: 5 requests/15min per IP
- Profile updates: 10 requests/15min per user
- Message sending: 30 messages/min + 5 burst/sec
- Contact operations: 20-30 requests/15min
- Search: 60-120 requests/min

Input Validation:
- All inputs validated with express-validator
- Username: 3-50 chars, alphanumeric + underscore
- Email: Valid format required
- Password: 8-100 chars with complexity
- Message content: Max 10,000 characters
- UUIDs validated on all ID parameters

CORS Configuration:
- Whitelist specific origins (CLIENT_URL env var)
- Credentials: true for cookie support

Helmet.js Middleware:
- Content Security Policy
- X-Frame-Options (clickjacking protection)
- X-Content-Type-Options
- Strict-Transport-Security (HSTS)
```

### Socket.io Security

```
Connection Security:
- JWT authentication required on connection
- Token verified from auth.token, query.token, or Authorization header
- Specific error messages (token required, invalid, expired)
- Unauthorized sockets immediately disconnected

Room Access Control:
- Users join personal room: user:${userId}
- Conversation room join requires participant verification
- Blocked users cannot send messages

Event Rate Limiting:
- Message sending: 30/min window + 5/sec burst
- Presence updates: 1 per 5 seconds
- Typing indicators: Debounced client-side

Message Size Limits:
- Text messages: 10,000 characters max
- Rate limiter prevents spam
```

### Database Security

```
Query Security:
- Parameterized queries prevent SQL injection
- All user inputs escaped via pg library
- No raw SQL concatenation

Data Protection:
- Passwords never stored in plaintext (bcrypt)
- Soft delete for messages (audit trail)
- User data isolated by user_id in queries

Connection Security:
- Connection pooling via pg.Pool
- Environment-based credentials (never committed)
```

### File Upload Security

```
File Validation:
- Whitelist allowed types: jpg, jpeg, png, gif, webp
- File extension validation
- MIME type checking
- Maximum size: 5MB for avatars

Storage Security:
- Files stored in MinIO with unique UUID names
- Original filenames not preserved (prevents path traversal)
- Authenticated access only (presigned URLs planned)
```

### Privacy Features

```
User Control:
- hide_read_status: Prevents read receipts being sent
- Contact blocking: Bidirectional message prevention
- Blocked users filtered from search results
- Soft delete preserves user's message history

Data Minimization:
- Public profiles exclude sensitive data (email, phone)
- Password hashes never returned in API responses
```

---

## Future Enhancements

### Phase 2: Advanced Features (Weeks 14-18)

| Feature | Complexity | Priority | Week |
|---------|-----------|----------|------|
| Performance Monitoring | Medium | High | 14 |
| Message Reactions | Medium | Medium | 15 |
| Message Forwarding | Low | Medium | 15 |
| Pinned Messages | Low | Low | 15 |
| Voice Messages | High | Medium | 16 |
| Group Typing Indicators | Medium | Medium | 17 |
| Read Receipt Aggregation | Medium | Medium | 17 |
| Contact Requests System | Medium | Medium | 18 |
| Group Invite Links | Medium | Medium | 18 |
| Group Permissions | Medium | Low | 18 |

### Phase 3: Cutting-Edge Features (Optional)

| Feature | Hours | Complexity | Impact |
|---------|-------|-----------|--------|
| Video Calls (WebRTC) | 10h | Very High | High |
| End-to-End Encryption | 15h | Very High | Very High |
| Push Notifications | 5h | Medium | Medium |
| Message Threads | 8h | Medium | Medium |
| Voice Calls | 12h | High | High |

### Technical Improvements (Backlog)

```
Performance:
- [ ] Redis-based rate limiting (horizontal scaling)
- [ ] Participant list caching (reduce N+1 queries)
- [ ] Read receipt broadcast batching
- [ ] Distributed locking for cache population
- [ ] Prometheus metrics for monitoring

Database:
- [ ] Read replicas for heavy queries
- [ ] Message archiving (>1 year old)
- [ ] Full-text search optimization
- [ ] Connection pool tuning

Real-time:
- [ ] Typing indicators for groups (Redis ZSET)
- [ ] Presence heartbeat optimization
- [ ] Socket reconnection handling
- [ ] Message delivery acknowledgments

Security:
- [ ] Two-factor authentication (2FA)
- [ ] Login notifications
- [ ] Suspicious activity detection
- [ ] API key authentication for bots

Features:
- [ ] Custom status messages ("In a meeting")
- [ ] Do Not Disturb mode
- [ ] Last seen privacy settings
- [ ] Message scheduling
- [ ] Message translation
```

### Deployment Targets

```
Budget-Conscious ($5/month):
- Railway.app: Backend + PostgreSQL + Redis
- Vercel: Frontend (free tier)
- Cloudflare: CDN + SSL (free tier)

Production-Ready:
- Docker containerization
- Nginx reverse proxy
- SSL termination (Let's Encrypt)
- Health check monitoring
- Error tracking (Sentry free tier)
```

---

*Last Updated: January 2026*
