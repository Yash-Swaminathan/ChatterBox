
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
| 19 | Owner Notification System | Pending |

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
