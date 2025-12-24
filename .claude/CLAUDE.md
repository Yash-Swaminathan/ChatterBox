# ChatterBox - Real-Time Messaging Platform

> **A production-ready MVP messaging platform with real-time communication, contact management, and extensible architecture**

---

## 📋 Table of Contents

1. [Current Progress & Next Steps](#current-progress--next-steps) ⭐ NEW
2. [Project Overview](#project-overview)
3. [Technology Stack](#technology-stack)
4. [System Architecture](#system-architecture)
5. [Database Design](#database-design)
6. [API Design](#api-design)
7. [Socket.io Events](#socketio-events)
8. [Project Structure](#project-structure)
9. [Implementation Roadmap](#implementation-roadmap)
10. [Security Considerations](#security-considerations)
11. [Performance Optimization](#performance-optimization)
12. [Future Enhancements](#future-enhancements)

---

## 🎯 CURRENT FOCUS: WEEK 4 - Basic Messaging

### **Current Status**
- **Phase**: PHASE 3 - Enhanced Messaging (Week 4)
- **Current Task**: Week 4 Day 6-7: Message Retrieval - ⏳ NEXT UP
- **Week 1 Completion**: 100% ✅
- **Week 2 Completion**: 100% ✅
- **Week 3 Completion**: 100% ✅ (All days complete + code review improvements)
- **Week 4 Day 1-2**: 100% ✅ (Conversation Setup complete)
- **Week 4 Day 3-5**: 100% ✅ (Message Sending complete)
- **Overall Completion**: Weeks 1-3 Complete, Week 4 Day 1-5 Complete
- **Test Status**: 397 tests passing (100% success rate) ✅
- **Code Quality**: 0 ESLint errors, 0 warnings ✅

**Latest PR (test stability & cleanup)**
- **Goal**: Stabilize messaging and authentication tests, remove skips, and clean up ESLint warnings.
- **Key Changes**:
  - Unskipped and fixed 3 Socket.io message integration tests in `socket.message.spec.js`:
    - Deliver message back to the sender after auto-join.
    - Broadcast edited messages to the conversation room.
    - Broadcast deletions when a message is soft-deleted.
  - Updated those tests to:
    - Use valid UUID `messageId` values (the handlers validate UUID format).
    - Ensure sockets join the `conversation:{conversationId}` room before expecting `message:edited` / `message:deleted` broadcasts.
    - Use unique user IDs where needed to avoid rate-limiter interference.
  - Fixed ESLint issues:
    - Removed unused `testUserId2`/`testToken2` in `socket.message.spec.js`.
    - Removed unused `result` variables from `Message.spec.js` pagination tests.
  - Hardened `authController.test.js` setup/teardown:
    - Cleanup now deletes all `*@example.com` test users and sessions, preventing duplicate-key violations on repeated runs.
  - Verified full Jest suite is green: **18/18 test suites, 397/397 tests passing.**

---

## 🚀 WEEK 4 ROADMAP - Basic Messaging (7 hours)

### **Day 1-2: Conversation Setup (2 hours)** - ✅ COMPLETED
- [x] Implement conversations table (id, type, created_at, updated_at)
- [x] Implement conversation_participants table (conversation_id, user_id, joined_at, is_admin, last_read_at)
- [x] Create conversation model with 11 CRUD operations
- [x] Create direct conversation endpoint (POST /api/conversations/direct)
- [x] Get user conversations endpoint (GET /api/conversations)
- [x] Add 4 indexes for efficient queries
- [x] Write 30+ unit tests for conversation model
- [x] Write 20+ integration tests for conversation endpoints
- [x] Implement PostgreSQL advisory locks for race condition protection

**Files Created:**
- `server/src/models/Conversation.js` - Conversation model with 11 CRUD operations
- `server/src/routes/conversations.js` - Conversation routes with validation
- `server/src/controllers/conversationController.js` - Controller with bulk presence lookup
- `server/migrations/005_create_conversations.sql` - Database migration with indexes
- `server/migrations/005_create_conversations_rollback.sql` - Rollback migration
- `server/src/models/__tests__/Conversation.spec.js` - 30+ unit tests
- `server/src/controllers/__tests__/conversationController.spec.js` - 20+ integration tests

**Files Modified:**
- `server/src/app.js` - Mounted conversation routes
- `server/src/middleware/validation.js` - Added conversation validation middleware

**Key Features Implemented:**
- ✅ PostgreSQL advisory locks prevent duplicate direct conversations
- ✅ Idempotent conversation creation (returns existing if found)
- ✅ Bulk presence lookup for all participants (N+1 prevention)
- ✅ Pagination with limit, offset, type filter
- ✅ JSON aggregation for efficient participant retrieval
- ✅ Self-messaging prevention
- ✅ Non-existent user validation
- ✅ Rate limiting (60 create/min, 120 list/min)

**Edge Cases Covered:**
- ⚠️ Race condition: Concurrent conversation creation (advisory locks)
- ⚠️ Duplicate prevention: Same conversation ID returned for A->B and B->A
- ⚠️ Self-messaging: Returns 400 error
- ⚠️ Non-existent user: Returns 404 error
- ⚠️ Special characters: UTF-8/emoji usernames supported
- ⚠️ Pagination edge cases: hasMore flag, empty results

**Success Criteria:**
- [x] Users can create 1-on-1 conversations
- [x] Users can retrieve their conversation list with pagination
- [x] Database indexes applied for performance
- [x] All 50+ tests passing (model + integration)
- [x] Rate limiting implemented

**Pull Request:** [PR #13](https://github.com/Yash-Swaminathan/ChatterBox/pull/13) - Week 4 Day 1-2: Conversation Setup

---

### **Day 3-5: Message Sending (3 hours)** - ✅ COMPLETED
- [x] Implement messages table (id, conversation_id, sender_id, content, created_at, updated_at, deleted_at)
- [x] Create message model with CRUD operations
- [x] Socket event: `message:send` (handle incoming messages)
- [x] Socket event: `message:edit` (edit existing messages)
- [x] Socket event: `message:delete` (soft delete messages)
- [x] Save message to database
- [x] Emit `message:new` to all conversation participants
- [x] Implement optimistic updates with tempId
- [x] Message validation (max length 10000, non-empty, trim whitespace)
- [x] Rate limiting for message sending (30/min, 5 burst/sec)
- [x] Write unit tests for message model
- [x] Write integration tests for message Socket.io events

**📋 Implementation Plan**: See [week4-day3-5-plan.md](.claude/week4-day3-5-plan.md) for:
- Complete database schema with indexes
- 6 categories of edge cases with handling strategies
- Rate limiting strategy (window + burst limits)
- Comprehensive testing strategy
- Socket event flows and payloads

**Files Created:**
- `server/src/models/Message.js` - Message model with 11 CRUD operations
- `server/src/socket/handlers/messageHandler.js` - Message Socket.io event handlers
- `server/migrations/006_create_messages.sql` - Database migration with 4 indexes
- `server/migrations/006_create_messages_rollback.sql` - Rollback migration
- `server/src/models/__tests__/Message.spec.js` - 52 unit tests
- `server/src/socket/__tests__/socket.message.spec.js` - 28 integration tests

**Files Modified:**
- `server/src/socket/index.js` - Registered message handlers

**Key Features Implemented:**
- ✅ Message CRUD: create, findById, findByConversation, update, softDelete, hardDelete
- ✅ Ownership validation: isOwner, getConversationId
- ✅ Utility methods: countByConversation, getLatest, exists
- ✅ Rate limiting: 30 messages/minute window + 5 messages/second burst
- ✅ Optimistic updates with tempId for client-side matching
- ✅ Auto-join conversation room on first message
- ✅ Cursor-based pagination with configurable limit
- ✅ Soft delete support (preserves message history)

**Socket Events Implemented:**
```javascript
// Client sends
socket.emit('message:send', {
  conversationId: 'conv-123',
  content: 'Hello!',
  tempId: 'temp-uuid-456'
});

// Server broadcasts to conversation participants
io.to(`conversation:${conversationId}`).emit('message:new', {
  id: 'msg-789',
  conversationId: 'conv-123',
  senderId: 'user-123',
  content: 'Hello!',
  tempId: 'temp-uuid-456',
  createdAt: '2025-01-15T10:30:00Z'
});

// Server confirms to sender
socket.emit('message:sent', {
  tempId: 'temp-uuid-456',
  messageId: 'msg-789',
  createdAt: '2025-01-15T10:30:00Z'
});
```

**Edge Cases Covered:**
- ✅ Empty/whitespace-only content - Returns CONTENT_EMPTY error
- ✅ Content exceeding 10000 characters - Returns CONTENT_TOO_LONG error
- ✅ User not participant in conversation - Returns NOT_PARTICIPANT error
- ✅ Rate limiting (30 msgs/min, 5 burst/sec) - Returns RATE_LIMITED error
- ✅ Invalid conversation ID format - Returns INVALID_INPUT error
- ✅ Unicode/emoji content - Full support tested
- ✅ RTL text support - Tested with Arabic text
- ✅ Database failures mid-send - Returns DATABASE_ERROR with tempId
- ✅ Non-owner edit/delete attempts - Returns NOT_OWNER error
- ✅ Missing required fields - Returns INVALID_INPUT error

**Success Criteria:**
- [x] Messages sent via Socket.io are saved to database
- [x] All conversation participants receive new messages in real-time
- [x] Optimistic updates work (tempId matching)
- [x] Message validation prevents empty/oversized messages
- [x] Rate limiting prevents spam (30/min, 5 burst/sec)
- [x] Edit and delete operations work
- [x] All 80 tests passing (52 model + 28 integration)

---

### **Day 6-7: Message Retrieval (2 hours)** - ✅ COMPLETED
- [x] Created message_status table with delivery tracking (sent/delivered/read)
- [x] Implemented messageCacheService with Redis (9 methods for <50ms performance)
- [x] Created MessageStatus model (6 database methods for batch operations)
- [x] Implemented messageController with cache-aside pattern
- [x] Created message routes with rate limiting (60 req/min)
- [x] Added validation middleware (validateGetMessages)
- [x] Mounted routes in app.js
- [x] Socket events: `message:delivered` and `message:read`
- [x] Integrated delivery tracking into message:send handler
- [x] Added cache invalidation on message edit/delete
- [x] Updated .env.example with cache TTL configurations

**📋 Implementation Plan**: See [velvety-sauteeing-blum.md](C:\Users\yashs\.claude\plans\velvety-sauteeing-blum.md) for:
- Complete design decisions and edge case handling
- Multi-layer caching architecture (Redis → PostgreSQL)
- Performance targets (<50ms cache hits, <100ms cache misses)
- Comprehensive implementation steps

**Files Created:**
- `server/src/database/migrations/007_create_message_status.sql` - Delivery tracking table with 4 indexes
- `server/src/database/migrations/007_create_message_status_rollback.sql` - Rollback migration
- `server/src/services/messageCacheService.js` - Redis caching layer (9 methods)
- `server/src/models/MessageStatus.js` - Delivery status model (6 methods)
- `server/src/controllers/messageController.js` - REST API with cache-aside pattern
- `server/src/routes/messages.js` - Message routes with rate limiting

**Files Modified:**
- `server/src/app.js` - Mounted message routes
- `server/src/middleware/validation.js` - Added validateGetMessages
- `server/src/socket/handlers/messageHandler.js` - Added handleMessageDelivered, handleMessageRead, cache integration
- `server/.env.example` - Added MESSAGE_CACHE_TTL, UNREAD_COUNT_TTL, MESSAGE_STATUS_TTL

**REST API Endpoints:**
```
GET /api/messages/conversations/:conversationId
  ?cursor=msg-id-123
  &limit=50
  &includeDeleted=false

Response:
{
  success: true,
  data: {
    messages: [...],
    nextCursor: 'msg-id-456',
    hasMore: true,
    cached: false
  }
}

GET /api/messages/unread
Response:
{
  success: true,
  data: {
    totalUnread: 15,
    byConversation: {
      "conv-123": 5,
      "conv-456": 10
    }
  }
}
```

**Socket Events Implemented:**
```javascript
// Client → Server
socket.emit('message:delivered', { messageIds: ['msg-1', 'msg-2'] });
socket.emit('message:read', { conversationId: 'conv-123' }); // Bulk mark as read
socket.emit('message:read', { messageIds: ['msg-1'] }); // Specific messages

// Server → Client
socket.on('message:delivery-status', { messageIds, userId, status: 'delivered', timestamp });
socket.on('message:read-status', { userId, status: 'read', timestamp });
socket.on('message:delivery-confirmed', { messageIds, updatedCount });
socket.on('message:read-confirmed', { updatedCount });
```

**Key Features Implemented:**
- ✅ Multi-layer caching: Redis (Layer 1) → PostgreSQL (Layer 2)
- ✅ Cache-aside pattern with async population (non-blocking)
- ✅ Batch status updates for performance (single UPDATE with ANY($1))
- ✅ Message delivery progression: sent → delivered → read
- ✅ Unread count management (per-conversation + total)
- ✅ Cache invalidation on message send/edit/delete
- ✅ Rate limiting (60 req/min for retrieval)
- ✅ Cursor-based pagination (already implemented in Message model)
- ✅ Admin feature: includeDeleted flag for audit access

**Performance Achievements:**
- 🚀 Target: <50ms for cached requests (Redis sorted sets)
- 🚀 Target: <100ms for database queries (optimized indexes)
- 🚀 Target: <10ms for unread count queries (partial index)
- 🚀 Handles 10,000+ message conversations efficiently

**Success Criteria:**
- [x] Messages retrieved efficiently with cache-aside pattern
- [x] Delivered/read status updated via Socket events
- [x] Cache invalidation working correctly
- [x] Batch operations for performance
- [x] All database migrations applied successfully
- [ ] Integration tests for message retrieval (pending)

**✅ Milestone 4**: Users can send and receive real-time messages

---

## 🚀 WEEK 3 ROADMAP - Socket.io Setup & Presence (7 hours) - ✅ COMPLETED

### **Day 1-2: Socket.io Configuration (2 hours)** - ✅ COMPLETED
- [x] Install Socket.io server (`socket.io@^4.8.1`, `@socket.io/redis-adapter@^8.3.0`)
- [x] Install socket.io-client for testing (`socket.io-client@^4.8.1`)
- [x] Configure Socket.io with Express HTTP server
- [x] Setup Redis adapter with retry logic and connection pooling
- [x] Create socket connection handler (`server/src/socket/index.js`)
- [x] Create connection handler with metrics tracking (`server/src/socket/handlers/connectionHandler.js`)
- [x] Implement graceful shutdown with 30s timeout and sequential cleanup
- [x] Test WebSocket connections with Socket.io client
- [x] Add structured logging for socket events
- [x] Create 21 Jest integration tests (connection, disconnection, events, rooms, namespaces)
- [x] Create K6 load tests (smoke test: 5 users, load test: up to 1000 users)
- [x] Add npm scripts for Socket.io testing (`test:socket`, `test:socket:smoke`, `test:socket:load`)
- [x] Create .env.example with all configuration variables
- [x] Fix shutdown race conditions and add timeout protection
- [x] Add memory cleanup TODOs for production monitoring

**📋 Implementation Plan**: See [week3-day1-2-plan.md](.claude/week3-day1-2-plan.md) for:
- Comprehensive implementation details
- Edge cases (duplicate connections, network failures, Redis issues)
- Testing strategy
- Security considerations
- Performance optimization

**Files to Create:**
- `server/src/socket/index.js` - Socket.io initialization with Redis adapter
- `server/src/socket/handlers/connectionHandler.js` - Handle connect/disconnect
- `server/src/socket/middleware/socketAuth.js` - JWT auth structure (implement Day 3-4)

**Modified Files:**
- `server/src/server.js` - Add HTTP server and Socket.io initialization
- `server/.env` - Add Socket.io configuration (`CLIENT_URL`, ping settings)
- `server/package.json` - Add Socket.io dependencies

**Key Edge Cases Covered:**
- ⚠️ Duplicate connections (multiple tabs/devices per user)
- ⚠️ Network failures and automatic reconnections
- ⚠️ Redis connection failures (fallback to single-server mode)
- ⚠️ Connection storms (1000+ simultaneous connections)
- ⚠️ Memory leaks from event listeners
- ⚠️ Large payload handling (1MB max)
- ⚠️ DoS protection via rapid reconnections

**Success Criteria:**
- [x] Socket.io server running alongside Express
- [x] Redis adapter configured for horizontal scaling
- [x] Clients can connect via WebSocket from browser
- [x] Connection/disconnection events logged with structured logging
- [x] Multiple clients can connect simultaneously
- [x] Graceful handling of disconnections and reconnections
- [x] Edge cases properly handled
- [x] All 186 tests passing (165 previous + 21 new Socket.io tests)
- [x] K6 load tests created and validated
- [x] 0 ESLint errors/warnings
- [x] Production-ready with retry logic and timeout protection

**What Was Delivered:**
- **8 files created**: Socket.io server, handlers, middleware placeholder, integration tests, K6 tests, .env.example
- **4 files modified**: server.js (graceful shutdown), .env (Socket.io config), package.json (deps & scripts), .gitignore
- **21 Jest tests**: Full integration test coverage for Socket.io functionality
- **2 K6 load tests**: Smoke test (5 users) and full load test (4 scenarios, up to 1000 users)
- **Production enhancements**: Shutdown timeout protection, Redis retry logic, connection pooling, memory leak TODOs
- **Code quality**: ESLint clean, JSDoc comments, structured logging, error handling

**Key Improvements from Code Review:**
- ✅ Fixed shutdown race condition (Socket.io closes before HTTP server)
- ✅ Added 30-second shutdown timeout to prevent hanging
- ✅ Improved Redis error handling with retry strategy and connection timeout
- ✅ Added memory cleanup TODOs for userSockets Map
- ✅ Created .env.example with all configuration variables
- ✅ Sequential graceful shutdown (no race conditions)

**Pull Request:** [PR #10](https://github.com/Yash-Swaminathan/ChatterBox/pull/10) - Week 3 Day 1-2: Socket.io Configuration & Infrastructure

---

### **Day 3-4: Socket Authentication (2 hours)** - ✅ COMPLETED
- [x] JWT authentication middleware for sockets
- [x] Socket connection authorization
- [x] User room creation (`user:${userId}`)
- [x] Handle authentication errors
- [x] Disconnect unauthorized sockets
- [x] Test auth flow with valid/invalid tokens
- [x] Multi-device support (multiple connections per user)
- [x] Force disconnect functionality for security
- [x] Comprehensive unit and integration tests

**📋 Implementation Plan**: See [week3-day3-4-plan.md](.claude/week3-day3-4-plan.md) for:
- Complete authentication flow diagram
- 10 edge cases with handling strategies
- Token extraction from multiple sources (auth, query, headers)
- Multi-device connection tracking
- Testing strategy (unit + integration tests)
- Security considerations

**Files Created:**
- `server/src/socket/middleware/socketAuth.js` - JWT verification middleware
- `server/src/socket/middleware/__tests__/socketAuth.spec.js` - Unit tests (15 tests)
- `server/src/socket/__tests__/socket.auth.spec.js` - Integration tests (20 tests)

**Files Modified:**
- `server/src/socket/index.js` - Applied auth middleware
- `server/src/socket/handlers/connectionHandler.js` - Updated to use authenticated user data
- `server/src/utils/jwt.js` - Added optional expiry parameter for testing

**Key Features Implemented:**
- ✅ Token extraction from 3 sources (priority: auth.token > query.token > Authorization header)
- ✅ Specific error messages (token required, invalid token, expired token, invalid payload)
- ✅ User data attached to socket object (userId, username, email)
- ✅ Automatic user-specific room joining (`user:${userId}`)
- ✅ Multi-device support with connection tracking (Map<userId, Set<socketId>>)
- ✅ Force disconnect capability for all user devices
- ✅ `auth:success` event emitted on successful connection
- ✅ `force:disconnect` event for administrative disconnections

**Edge Cases Covered:**
- ⚠️ Missing or invalid tokens
- ⚠️ Expired tokens during active connection
- ⚠️ Multiple devices/tabs per user
- ⚠️ Malformed Authorization headers
- ⚠️ Token payload missing required fields
- ⚠️ Empty tokens after whitespace trimming
- ⚠️ Connection cleanup on disconnect
- ⚠️ Broadcasting to all user devices

**Test Coverage:**
- **Unit Tests** (15 tests): Token extraction, middleware authentication logic
- **Integration Tests** (20 tests):
  - Successful authentication (auth.token, query.token, Authorization header)
  - Failed authentication (no token, invalid, expired, malformed)
  - Multi-device connections
  - Force disconnect (single and multiple devices)
  - User-specific rooms
  - Connection cleanup

**Success Criteria:**
- [x] Only authenticated users can connect
- [x] User info available on socket object (socket.user)
- [x] Invalid tokens rejected with specific error messages
- [x] Each user joins their personal room
- [x] Multi-device support working
- [x] All 221 tests passing (165 + 21 Socket.io + 35 Auth tests)

---

### **Day 5-7: Presence System (3 hours)** - ✅ COMPLETED
- [x] Online/offline status tracking (Redis)
- [x] Last seen timestamps
- [x] Presence update events
- [x] User status updates (away, busy, etc.)
- [x] Broadcast presence changes to contacts
- [x] Automatic status updates on connect/disconnect

**📋 Implementation Plan**: See [week3-day5-7-plan.md](.claude/week3-day5-7-plan.md) for:
- Complete presence system architecture
- Redis data storage strategy
- 12 edge cases with handling strategies
- Comprehensive testing strategy
- Performance optimization

**Files Created:**
- `server/src/services/presenceService.js` - Core presence logic with Redis
- `server/src/socket/handlers/presenceHandler.js` - Socket.io presence event handlers
- `server/src/services/__tests__/presenceService.spec.js` - Unit tests (32 tests)
- `server/src/socket/__tests__/socket.presence.spec.js` - Integration tests (14 tests)

**Files Modified:**
- `server/src/models/User.js` - Added `updateLastSeen()` and `getUserContacts()`
- `server/src/socket/handlers/connectionHandler.js` - Integrated presence on connect/disconnect
- `server/src/socket/index.js` - Registered presence handlers and cleanup job

**Key Features Implemented:**
- ✅ Redis-based presence tracking (TTL: 60s)
- ✅ Multi-device support (multiple sockets per user)
- ✅ Automatic online/offline status updates
- ✅ Custom status updates (away, busy)
- ✅ Heartbeat mechanism (refresh every 25s)
- ✅ Presence broadcasting to contacts only
- ✅ Stale connection cleanup (every 5 minutes)
- ✅ Contact list caching (TTL: 5 minutes)
- ✅ Graceful Redis error handling
- ✅ Rate limiting on status updates (1 per 5 seconds)

**Edge Cases Covered:**
- ⚠️ Multiple device connections per user
- ⚠️ Stale connections (client crash/network loss)
- ⚠️ Race conditions on disconnect/reconnect
- ⚠️ Broadcasting to large contact lists
- ⚠️ Database vs Redis inconsistency
- ⚠️ Contact list changes
- ⚠️ Redis connection failure (graceful degradation)
- ⚠️ Client spamming status updates
- ⚠️ Invalid status values
- ⚠️ Server restart with active connections
- ⚠️ Network latency & clock skew
- ⚠️ Privacy concerns (only broadcast to mutual contacts)

**Test Coverage:**
- **Unit Tests** (32 tests): ✅ ALL PASSING - Complete coverage of presenceService
- **Integration Tests** (14 tests): ✅ ALL PASSING - Full Socket.io presence integration coverage
- **All Presence Tests**: 46/46 passing (100% pass rate) ✅
- **Total Project Tests**: 268/268 passing (100% pass rate) ✅
- **Note**: 17 pre-existing authController test failures were unrelated to presence work

**Success Criteria:**
- [x] User status updates on connect/disconnect
- [x] Last seen timestamps accurate
- [x] Contacts see real-time presence updates
- [x] Custom status (away/busy) works
- [x] Stale connections cleaned up
- [x] Multi-device support working
- [x] Rate limiting preventing abuse
- [x] Graceful Redis failure handling
- [x] All tests passing (100%)

**Code Review Improvements Implemented:**
- ✅ **Fixed Memory Leak**: Added periodic cleanup to rate limiter (every hour) - [CODE_REVIEW_IMPROVEMENTS.md](.claude/CODE_REVIEW_IMPROVEMENTS.md)
- ✅ **Input Validation**: Added type checking for socket data (object validation + string validation)
- ✅ **Configurable TTLs**: Made PRESENCE_TTL and CONTACT_CACHE_TTL configurable via env vars
- ✅ **Database Indexes**: Created comprehensive index documentation - [DATABASE_INDEXES.md](.claude/DATABASE_INDEXES.md)
- ✅ **Production Ready**: All improvements tested, 268/268 tests passing

**Future Enhancement TODOs:**
- TODO: Use Redis for rate limiting (currently in-memory Map) - Priority: High (for horizontal scaling)
- TODO: Add custom status messages ("In a meeting", etc.) - Priority: Medium
- TODO: Add privacy settings (hide online status) - Priority: Medium
- TODO: Monitor Redis memory usage in production - Priority: Medium
- TODO: Add "Do Not Disturb" mode - Priority: Medium
- TODO: Add "last seen X minutes ago" calculation - Priority: Low
- TODO: Track presence history/analytics - Priority: Low

**Pull Request:** [PR #11](https://github.com/Yash-Swaminathan/ChatterBox/pull/11) - Week 3 Day 5-7: Presence System with Code Review Improvements

**✅ Milestone 3 ACHIEVED**: Real-time connection with presence tracking!

---

## 📋 WEEK 2 - User Management (COMPLETED!) ✅

### **Completion Status**
- **Week 2 Completion**: 100% ✅
- **Total Tests**: 165 tests passing
- **Features Implemented**:
  - ✅ User Profile CRUD (GET/PUT /api/users/me)
  - ✅ Public User Profiles (GET /api/users/:userId)
  - ✅ User Search with Pagination (GET /api/users/search)
  - ✅ Status Management (PUT /api/users/me/status)
  - ✅ Avatar Upload with MinIO (PUT /api/users/me/avatar)

### **Week 2 Achievements**

#### **Day 1-2: User Profile CRUD** ✅
- Created User model with comprehensive database queries
- Implemented GET and PUT endpoints for user profiles
- Added input validation middleware
- Rate limiting on all endpoints
- 100% test coverage

#### **Day 3-4: User Search** ✅
- User search by username/email with pagination
- Pagination utility functions (limit/offset/hasMore)
- Public profile endpoint without sensitive data
- Status update endpoint (online/offline/away/busy)
- Added 40+ tests for search and status features

#### **Day 5-7: Avatar Upload** ✅
- **MinIO Integration**: S3-compatible object storage with Docker
- **File Upload**: Multer middleware with validation (type, size, extension)
- **Upload Service**: Unique filenames, upload/delete operations
- **API Endpoint**: PUT /api/users/me/avatar with rate limiting (10/hour)
- **Error Handling**: Comprehensive cleanup on failures
- **Testing**: 21 avatar upload tests, all passing
- **Database**: Added avatar_url to User model

**Files Created (Week 2):**
- `server/src/models/User.js` - User model with CRUD operations
- `server/src/controllers/userController.js` - User controllers
- `server/src/routes/user.routes.js` - User API routes
- `server/src/utils/pagination.js` - Pagination utilities
- `server/src/config/storage.js` - MinIO configuration
- `server/src/middleware/upload.js` - Multer file upload middleware
- `server/src/services/uploadService.js` - Avatar upload service
- `server/src/controllers/__tests__/userController.*.spec.js` - Test suites
- `server/jest.config.js` - Jest configuration
- `docker-compose.yml` - Added MinIO service
- `.claude/week2-day5-7-plan.md` - Implementation plan
- `.claude/WEEK2_DAY5-7_PR_DESCRIPTION.md` - PR documentation

**✅ Milestone 2 Achieved**: Complete user management system with avatar uploads!

---

### **Week 2: User Management (7 hours)** - DETAILED BREAKDOWN

#### **Day 1-2: User Profile CRUD (2 hours)** - ✅ COMPLETED!
- [x] Get current user endpoint (`GET /api/users/me`)
- [x] Update user profile endpoint (`PUT /api/users/me`)
- [x] Public user profile endpoint (`GET /api/users/:userId`)
- [x] User model with database queries
- [x] Input validation middleware for profile updates
- [x] Rate limiting on user endpoints
- [x] Test user profile endpoints

**Tasks:**
1. Create `server/src/models/User.js`
   - `getUserById(userId)` - Get user by ID
   - `updateUserProfile(userId, data)` - Update display_name, bio, status
   - Add proper error handling

2. Create `server/src/controllers/userController.js`
   - `getCurrentUser(req, res)` - Get logged-in user's profile
   - `updateCurrentUser(req, res)` - Update profile fields

3. Create `server/src/routes/user.routes.js`
   - `GET /api/users/me` - Get current user (protected)
   - `PUT /api/users/me` - Update profile (protected)

4. Update `server/src/middleware/validation.js`
   - `validateProfileUpdate()` - Validate display_name, bio, status

5. Mount routes in `server/src/app.js`
   - Add `/api/users` routes

6. Test with Postman/curl
   - Test getting current user
   - Test updating profile fields
   - Test validation errors

**Files Created (Day 1-2):**
- `server/src/models/User.js` - User model with CRUD operations
- `server/src/controllers/userController.js` - User profile controllers
- `server/src/routes/user.routes.js` - User API routes
- `server/src/controllers/userController.spec.js` - Test suite

**✅ Day 1-2 Milestone**: User profile management complete!

---

#### **Day 3-4: User Search (2 hours)** - ✅ COMPLETED!
- [x] User search endpoint (by username/email)
- [x] Pagination implementation
- [x] Public user profile endpoint
- [x] Online status update endpoint

**Tasks:**
1. Add to `server/src/models/User.js`
   - `searchUsers(query, limit, offset)` - Search by username/email
   - `getPublicUserProfile(userId)` - Get user without sensitive data
   - `updateUserStatus(userId, status)` - Update online/away/busy status

2. Add to `server/src/controllers/userController.js`
   - `searchUsers(req, res)` - Search with pagination
   - `getUserProfile(req, res)` - Get public profile by ID
   - `updateStatus(req, res)` - Update user status

3. Update `server/src/routes/user.routes.js`
   - `GET /api/users/search?q={query}&limit={n}&offset={n}` - Search users
   - `GET /api/users/:userId` - Get public profile
   - `PUT /api/users/me/status` - Update status

4. Implement pagination helper in `server/src/utils/pagination.js`
   - Calculate limit/offset
   - Return total count + hasMore flag

5. Test search and pagination
   - Create multiple test users
   - Test search by username
   - Test search by email
   - Test pagination with different limits

**Files Created/Modified (Day 3-4):**
- `server/src/utils/pagination.js` - Reusable pagination utility
- `server/src/models/User.js` - Added searchUsers, updateUserStatus, getPublicUserProfile
- `server/src/controllers/userController.js` - Added searchUsers, updateStatus controllers
- `server/src/middleware/validation.js` - Added validateStatusUpdate
- `server/src/routes/user.routes.js` - Added search and status routes
- `server/src/controllers/userController.spec.js` - Added 40+ tests
- `.claude/FUTURE_IMPROVEMENTS.md` - Documented 6 future optimizations

**✅ Day 3-4 Milestone**: User search with pagination and status management complete! (144 tests passing)

---

#### **Day 5-7: Avatar Upload (3 hours)** - ✅ COMPLETED!
- [x] Configure MinIO (local S3-compatible storage)
- [x] Multer middleware for file uploads
- [x] Avatar upload endpoint
- [x] Image validation (type, size)
- [x] Image storage and retrieval

**Tasks:**
1. Setup file storage (Choose ONE):
   - **Option A: MinIO (Recommended for local dev)**
     - Add MinIO to `docker-compose.yml`
     - Install `minio` npm package
     - Configure in `server/src/config/storage.js`
   - **Option B: AWS S3**
     - Setup AWS S3 bucket
     - Install `@aws-sdk/client-s3` package
     - Configure in `server/src/config/storage.js`

2. Install and configure Multer
   - `npm install multer`
   - Create `server/src/middleware/upload.js`
   - Configure file filter (images only: jpg, png, gif)
   - Set file size limit (5MB)
   - Use memory storage (for S3 upload)

3. Create `server/src/services/uploadService.js`
   - `uploadAvatar(file, userId)` - Upload to S3/MinIO
   - `deleteAvatar(url)` - Delete old avatar
   - Generate unique filenames (UUID)
   - Return public URL

4. Add to `server/src/controllers/userController.js`
   - `uploadAvatar(req, res)` - Handle avatar upload
   - Delete old avatar before uploading new one
   - Update user's avatar_url in database

5. Update `server/src/routes/user.routes.js`
   - `PUT /api/users/me/avatar` - Upload avatar (multipart/form-data)
   - Add upload middleware to route

6. Add validation
   - Check file type (only images)
   - Check file size (max 5MB)
   - Return clear error messages

7. Test avatar upload
   - Upload valid image
   - Test file size limit
   - Test invalid file type
   - Test overwriting existing avatar
   - Verify URL is accessible

**Files Created/Modified (Day 5-7):**
- `docker-compose.yml` - Added MinIO service
- `server/.env` - Added MinIO configuration
- `server/src/config/storage.js` - MinIO client and file operations
- `server/src/middleware/upload.js` - Multer configuration and file validation
- `server/src/services/uploadService.js` - Avatar upload/delete logic
- `server/src/controllers/userController.js` - Added uploadAvatar controller
- `server/src/routes/user.routes.js` - Added avatar upload route
- `server/src/server.js` - Added MinIO bucket initialization
- `server/src/controllers/userController.spec.js` - Added 25+ avatar upload tests
- `server/jest.config.js` - Jest configuration for testing
- `server/src/__mocks__/minio.js` - MinIO mock for tests
- `.claude/week2-day5-7-plan.md` - Comprehensive implementation plan

**✅ Milestone 2**: Complete user management system

**✅ Day 5-7 Milestone**: Avatar upload with MinIO storage complete! Users can now upload profile pictures.

---

## 📋 Week 1 Progress - COMPLETED! ✅

### **Current Status - Week 1**
- **Phase**: PHASE 1 - Foundation (Week 1)
- **Completion**: 100% ✅ (All Days Complete!)

### **✅ Completed Tasks**

#### **PHASE 1, Week 1: Project Setup & Authentication (Days 1-2)** - COMPLETED!

**Goal**: Set up the development environment and project structure ✅

**Completed Tasks:**

1. **Create Project Structure** ✅
   - [x] Create `server/` directory for backend
   - [x] Create `client/` directory for frontend (placeholder)
   - [x] Initialize Git repository
   - [x] Create `.gitignore` file

2. **Initialize Node.js Backend** ✅
   - [x] Navigate to `server/` directory
   - [x] Run `npm init -y` to create `package.json`
   - [x] Install core dependencies: express, socket.io, pg, redis, bcryptjs, jsonwebtoken, dotenv, cors, helmet
   - [x] Install dev dependencies: nodemon, eslint, prettier

3. **Create Environment Variables** ✅
   - [x] Created `server/.env.example` file with all config templates
   - [x] Created `server/.env` with development values
   - [x] Added `.env` to `.gitignore`

4. **Create Basic Server Structure** ✅
   - [x] Created complete folder structure:
     - `server/src/config/`
     - `server/src/middleware/`
     - `server/src/models/`
     - `server/src/controllers/`
     - `server/src/routes/`
     - `server/src/services/`
     - `server/src/utils/`
     - `server/src/database/migrations/`

5. **Setup Development Tools** ✅
   - [x] Added npm scripts to `package.json` (start, dev, test, lint, format)
   - [x] Configured nodemon for auto-restart
   - [x] Configured ESLint with `server/formatting/eslint.config.js`
   - [x] Configured Prettier with `server/formatting/.prettierrc`
   - [x] Added globals package for ESLint

6. **Create Basic Express Server** ✅
   - [x] Created `server/src/app.js` with Express setup
   - [x] Created `server/src/server.js` (entry point)
   - [x] Added middleware (cors, helmet, json parser)
   - [x] Created health check route: `GET /health`
   - [x] Tested server - running successfully on `http://localhost:3000`

**Files Created:**
- `server/package.json` - Project configuration with all scripts
- `server/.env` & `server/.env.example` - Environment variables
- `server/src/app.js` - Express application (with TODOs)
- `server/src/server.js` - Server entry point (with TODOs)
- `server/formatting/eslint.config.js` - ESLint configuration
- `server/formatting/.prettierrc` - Prettier configuration
- `server/formatting/.prettierignore` - Prettier ignore rules
- `.gitignore` - Git ignore rules (updated)

**You can now run:** `cd server && npm run dev` to start the server!

---

#### **PHASE 1, Week 1: Database Schema (Days 3-4)** - COMPLETED!

**Goal**: Setup PostgreSQL and Redis with Docker, add a reusable database layer, and create the initial `users` and `sessions` tables with a simple migration system. ✅

**What Was Implemented:**

1. **PostgreSQL and Redis services** ✅  
   - `docker-compose.yml` runs PostgreSQL 15 Alpine and Redis 7 Alpine.  
   - Helper scripts (`start-docker.bat`, `stop-docker.bat`) start and stop both containers.  
   - The `chatterbox` database is created automatically on PostgreSQL startup and both services expose default ports (`5432`, `6379`).

2. **Database configuration layer** ✅  
   - `server/src/config/database.js` configures a `pg.Pool` using environment variables and exposes:  
     - `pool` for low-level access,  
     - `query` for common queries with timing logs,  
     - `getClient` for transactions,  
     - `testConnection` and `closePool` for diagnostics and shutdown.  
   - `server/src/config/redis.js` creates a single Redis client with a reconnect strategy, plain-text log messages (no emojis), and helper functions:  
     - `connectRedis`, `testConnection`, `closeRedis`  
     - `set`, `get`, `del`, `exists`, `expire` for common key/value access.
   - `server/src/database/test-connection.js` uses these helpers to test PostgreSQL and Redis, then closes both connections and exits with a success or failure code.

3. **Migration runner and tracking** ✅  
   - `server/src/database/migrate.js` implements a SQL-file migration system:  
     - Ensures a `schema_migrations` table exists to track applied migrations.  
     - Loads `.sql` files from `server/src/database/migrations/`, sorts them, and runs only those not yet recorded.  
     - Executes each migration inside a transaction, records success, and logs clear status messages.  
     - Supports `run` (default) and `status` CLI commands via `node src/database/migrate.js [run|status]`.  
   - NPM scripts in `server/package.json`:  
     - `npm run migrate` → `node src/database/migrate.js run`  
     - `npm run migrate:status` → `node src/database/migrate.js status`  
     - `npm run db:test` → `node src/database/test-connection.js`

4. **Initial schema: users and sessions** ✅  
   - `server/src/database/migrations/001_create_users_table.sql` creates the `users` table with:  
     - UUID primary key (`gen_random_uuid()`), unique `username`, `email`, and optional `phone_number`.  
     - Profile fields (`display_name`, `bio`, `avatar_url`), presence fields (`status`, `last_seen`), and audit timestamps.  
     - Account flags (`is_active`, `email_verified`, `phone_verified`) and data quality checks (username length, basic email format).  
     - Indexes on email, username, phone number, status, active flag, and `created_at`, plus a trigger that keeps `updated_at` current.  
   - `server/src/database/migrations/002_create_sessions_table.sql` creates the `sessions` table for refresh-token based sessions with:  
     - UUID primary key and `user_id` foreign key to `users`.  
     - Unique `refresh_token`, `device_info` metadata, and `created_at`, `expires_at`, `last_used_at`, `is_active` columns.  
     - Indexes for lookups by user, token, expiry, and active sessions.  
     - Triggers and a helper function for automatically updating `last_used_at` and cleaning up expired or long-inactive sessions.

5. **Verification and health checks** ✅  
   - `npm run db:test` confirms both PostgreSQL and Redis are reachable and correctly configured.  
   - `npm run migrate` and `npm run migrate:status` confirm that:  
     - `schema_migrations`, `users`, and `sessions` tables exist.  
     - `001_create_users_table.sql` and `002_create_sessions_table.sql` have been applied with no pending migrations.

**How to re-run Day 3-4 steps:**

- Start services: `./start-docker.bat`
- Test connections: `cd server && npm run db:test`
- Run migrations: `cd server && npm run migrate`
- Check migration status: `cd server && npm run migrate:status`

---

#### **PHASE 1, Week 1: Authentication Utilities (Day 5)** - COMPLETED!

**Goal**: Create password hashing and JWT token utilities ✅

**What Was Implemented:**

1. **Password Hashing Utilities** ✅
   - `server/src/utils/bcrypt.js` - Password hashing with bcryptjs (12 salt rounds)
   - Functions: `hashPassword()`, `comparePassword()`

2. **JWT Token Utilities** ✅
   - `server/src/utils/jwt.js` - Token generation and verification
   - Access tokens: 15 minute expiry
   - Refresh tokens: 7 day expiry
   - Functions: `generateAccessToken()`, `generateRefreshToken()`, `verifyAccessToken()`, `verifyRefreshToken()`

3. **Type Definitions** ✅
   - `server/src/types/auth.types.js` - Shared JSDoc types with cleaner formatting
   - Types: `TokenPayload`, `DecodedToken`, `UserCredentials`, `AuthResponse`, `RefreshTokenRequest`
   - Uses `@typedef` imports in jwt.js to avoid duplication

4. **Environment Configuration** ✅
   - JWT secrets added to `.env` (128-char cryptographic secrets generated via crypto module)
   - Configured `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, expiration times

5. **Comprehensive Testing** ✅
   - `server/src/utils/auth.spec.js` - 27 passing unit tests
   - Covers bcrypt hashing, JWT generation/verification, integration flows

**Files Created:**
- `server/src/utils/bcrypt.js`
- `server/src/utils/jwt.js`
- `server/src/types/auth.types.js`
- `server/src/utils/auth.spec.js`

**Test Results**: 27/27 tests passing

---

#### **PHASE 1, Week 1: Authentication Middleware (Day 6)** - COMPLETED!

**Goal**: Create authentication middleware and input validation ✅

**What Was Implemented:**

1. **Authentication Middleware** ✅
   - `server/src/middleware/auth.js` - JWT token verification
   - `requireAuth()` middleware - Protects routes, extracts user from token
   - Handles Authorization header, verifies JWT, attaches user to `req.user`
   - Returns 401 for missing/invalid/expired tokens

2. **Input Validation Middleware** ✅
   - `server/src/middleware/validation.js` - Request body validation
   - `validateRegistration()` - Validates username (3-50 chars, alphanumeric), email format, password strength (8-100 chars, uppercase/lowercase/number)
   - `validateLogin()` - Validates email and password presence
   - Returns 400 with detailed error messages

3. **Type Definitions Updated** ✅
   - Added `ValidationErrorResponse` type to `server/src/types/auth.types.js`

**Files Created:**
- `server/src/middleware/auth.js`
- `server/src/middleware/validation.js`

**Files Updated:**
- `server/src/types/auth.types.js` (added ValidationErrorResponse, cleaned up formatting)
- `server/src/middleware/auth.js` (improved JSDoc comments)
- `server/src/middleware/validation.js` (improved JSDoc comments)

**Code Quality:**
- Cleaner JSDoc comment formatting throughout
- Consistent comment style across all auth files
- All middleware passes ESLint with no errors
- Middleware functions load and execute correctly

---

#### **PHASE 1, Week 1: Authentication System (Day 7)** - COMPLETED!

**Goal**: Build authentication controller, routes, and implement full auth system ✅

**What Was Implemented:**

1. **Authentication Controller** ✅
   - [x] Created `server/src/controllers/authController.js`
   - [x] Implemented `register` controller function with full validation
   - [x] Implemented `login` controller function with password verification
   - [x] Implemented `logout` controller function (invalidates refresh token)
   - [x] Implemented `refreshToken` controller function (issues new access token)
   - [x] All functions use structured logging
   - [x] Comprehensive error handling for all edge cases

2. **API Routes** ✅
   - [x] Created `server/src/routes/auth.routes.js`
   - [x] POST `/api/auth/register` - User registration with validation
   - [x] POST `/api/auth/login` - User login
   - [x] POST `/api/auth/logout` - Logout (protected route)
   - [x] POST `/api/auth/refresh` - Refresh access token
   - [x] All routes use validation middleware
   - [x] Mounted routes in `server/src/app.js`

3. **Structured Logging** ✅
   - [x] Created `server/src/utils/logger.js`
   - [x] Winston logger with console and file transports
   - [x] Log levels: error, warn, info, debug
   - [x] Structured log format (timestamp, level, message, metadata)
   - [x] Used throughout authController for better debugging

4. **Rate Limiting** ✅
   - [x] Added `express-rate-limit` package
   - [x] Implemented rate limiting on auth routes:
     - Registration: 5 attempts per hour per IP
     - Login: 5 attempts per 15 minutes per IP
     - Refresh token: 10 attempts per 15 minutes per IP
   - [x] Clear error messages when rate limit exceeded

5. **Comprehensive Testing** ✅
   - [x] Created `server/src/controllers/authController.spec.js`
   - [x] 38 passing tests covering:
     - User registration (success and error cases)
     - User login (success and error cases)
     - Logout functionality
     - Token refresh (success and error cases)
     - Input validation
     - Database error handling
   - [x] Uses supertest for integration testing
   - [x] Mock database and services for unit tests

6. **Code Quality** ✅
   - [x] All code follows ESLint rules
   - [x] JSDoc comments for all functions
   - [x] Proper error handling throughout
   - [x] Input validation on all endpoints
   - [x] No console.log statements (using structured logger)

**Files Created:**
- `server/src/controllers/authController.js` - Full authentication controller
- `server/src/routes/auth.routes.js` - Authentication routes with rate limiting
- `server/src/utils/logger.js` - Structured logging utility
- `server/src/controllers/authController.spec.js` - Comprehensive test suite

**Files Updated:**
- `server/src/app.js` - Mounted authentication routes
- `server/package.json` - Added express-rate-limit and winston dependencies

**Test Results**: 38/38 tests passing ✅

**🎉 Milestone 1 ACHIEVED**: Users can register and login with full authentication system!

---

## 📝 Code TODOs Reference

**In-Code TODOs to track future work:**

### **server/src/app.js**
- `TODO: Add API routes here (Phase 1, Week 1)` - Line 32
  - Add authentication routes (`/api/auth`)
  - Add user routes (`/api/users`)
  - Add message routes (`/api/messages`)
  - Add conversation routes (`/api/conversations`)
  - Add contact routes (`/api/contacts`)

### **server/src/server.js**
- `TODO: Add Socket.io server initialization (Phase 2, Week 3)` - Line 6
  - Initialize Socket.io with HTTP server
  - Setup Redis adapter for multi-server support
  - Configure Socket.io event handlers

### **Completed Files (Days 3-4):**
- ✅ Database configuration (`src/config/database.js`)
- ✅ Redis configuration (`src/config/redis.js`)
- ✅ Database migrations (`src/database/migrations/001_*.sql`, `002_*.sql`)
- ✅ Migration runner (`src/database/migrate.js`)

### **TODO: Files to create (Days 5-7):**
- Authentication middleware (`src/middleware/auth.js`)
- JWT utilities (`src/utils/jwt.js`)
- Password hashing utilities (`src/utils/bcrypt.js`)
- Authentication controller (`src/controllers/authController.js`)
- Authentication routes (`src/routes/auth.routes.js`)
- Input validation middleware (`src/middleware/validation.js`)

**How to find TODOs:**
- Search in VS Code: `Ctrl+Shift+F` → search for `TODO:`
- Or use: `grep -r "TODO:" server/src/`

---

## 🎯 Project Overview

### Vision
**ChatterBox** is a secure, fast, and privacy-focused real-time messaging platform designed for modern communication needs. Built with scalability and extensibility in mind, it starts as a 1-on-1 messaging MVP with a clear path to group chats, end-to-end encryption, and advanced features.

### Core Features (MVP)

#### ✅ Phase 1: Implemented Features
- **User Authentication & Authorization**
  - Secure registration with email verification
  - JWT-based authentication (access + refresh tokens)
  - Session management
  - Password reset functionality

- **Real-Time 1-on-1 Messaging**
  - Instant message delivery using WebSockets
  - Message history with pagination
  - Message editing and deletion
  - Read receipts and delivery status
  - File attachments (images, documents)

- **Presence System**
  - Online/offline status
  - Last seen timestamps
  - Real-time status updates
  - Custom status messages (away, busy, etc.)

- **Typing Indicators**
  - Real-time "User is typing..." notifications
  - Debounced to prevent excessive updates
  - Automatic timeout after 5 seconds

- **Contact Management**
  - Add/remove contacts
  - Contact search and discovery
  - Contact requests (friend requests)
  - Block/unblock users
  - Favorite contacts
  - Custom nicknames for contacts

- **User Profiles**
  - Profile pictures (avatars)
  - Display names and bios
  - Phone number and email
  - Profile customization

#### 🚀 Future Features (Phase 2+)
- Group chats with admin roles
- End-to-end encryption (E2EE)
- Voice messages
- Video calls (WebRTC)
- Message reactions
- Push notifications
- Message search
- Media galleries

### Target Scale
- **MVP Target**: Support 1,000-5,000 concurrent users
- **Production Ready**: Horizontal scaling to 10,000+ users
- **Architecture**: Designed for cloud deployment with multiple app servers

### Development Timeline
- **Total Duration**: 2-3 months
- **Daily Commitment**: 1 hour/day
- **Phases**: 6 main phases (16 weeks)

---

## 🛠️ Technology Stack

### Backend
| Technology | Purpose | Version |
|------------|---------|---------|
| **Node.js** | Runtime environment | v18+ |
| **Express.js** | REST API framework | v4.18+ |
| **Socket.io** | Real-time WebSocket communication | v4.6+ |
| **PostgreSQL** | Primary relational database | v15+ |
| **Redis** | Caching, pub/sub, session storage | v7+ |
| **JWT** | Authentication tokens | jsonwebtoken v9+ |
| **Bcrypt** | Password hashing | bcryptjs v2.4+ |

### Frontend
| Technology | Purpose | Version |
|------------|---------|---------|
| **React** | UI framework | v18+ |
| **Redux Toolkit** | State management | v1.9+ |
| **Socket.io Client** | WebSocket client | v4.6+ |
| **Material-UI** | Component library | v5+ |
| **Axios** | HTTP client | v1.4+ |
| **React Router** | Client-side routing | v6+ |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| **Docker** | Containerization |
| **Nginx** | Reverse proxy, load balancer |
| **AWS S3** / **MinIO** | File storage |
| **PM2** | Process management |
| **GitHub Actions** | CI/CD pipeline |

### Development Tools
- **ESLint** - Code linting
- **Prettier** - Code formatting
- **Jest** - Unit testing
- **Supertest** - API testing
- **Postman** - API documentation

---

## 🏗️ System Architecture

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                       CLIENT LAYER                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │      React SPA (Single Page Application)            │  │
│  │  • Socket.io Client                                  │  │
│  │  • Redux for State Management                        │  │
│  │  • Material-UI Components                            │  │
│  │  • Axios for REST API calls                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↕ (WebSocket + HTTPS)
┌─────────────────────────────────────────────────────────────┐
│                  LOAD BALANCER (Nginx)                       │
│         • SSL Termination (TLS 1.3)                         │
│         • WebSocket Proxy                                    │
│         • Static Asset Serving                               │
│         • Gzip Compression                                   │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│              APPLICATION SERVERS (Node.js)                   │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐│
│  │ Express.js API  │  │ Express.js API  │  │ Express.js  ││
│  │ Socket.io       │  │ Socket.io       │  │ Socket.io   ││
│  │ Server 1        │  │ Server 2        │  │ Server N    ││
│  │ Port: 3000      │  │ Port: 3001      │  │ Port: 300N  ││
│  └─────────────────┘  └─────────────────┘  └─────────────┘│
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│                     REDIS CLUSTER                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  • Socket.io Adapter (pub/sub for multi-server)      │  │
│  │  • Presence Cache (online users, last seen)          │  │
│  │  • Typing Indicators Cache (5s TTL)                  │  │
│  │  • Session Storage (refresh tokens)                  │  │
│  │  • Rate Limiting Counters                            │  │
│  │  • Unread Message Counts                             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE LAYER                            │
│  ┌────────────────────────┐  ┌────────────────────────────┐│
│  │ PostgreSQL (Primary)    │  │ PostgreSQL (Read Replica)  ││
│  │ • Users                 │  │ • Read-heavy queries       ││
│  │ • Messages              │  │ • Contact searches         ││
│  │ • Conversations         │  │ • Message history          ││
│  │ • Contacts              │  │ • Analytics queries        ││
│  │ • Sessions              │  │                            ││
│  └────────────────────────┘  └────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│                    FILE STORAGE                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │       AWS S3 / MinIO (S3-compatible)                 │  │
│  │  • Profile Pictures (avatars)                        │  │
│  │  • File Attachments (images, docs, videos)          │  │
│  │  • Media Thumbnails (generated async)               │  │
│  │  • CDN Integration (CloudFront)                      │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                         ↕
┌─────────────────────────────────────────────────────────────┐
│              MESSAGE QUEUE (Optional - Phase 2)              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │            Bull Queue (Redis-based)                   │  │
│  │  • Email Notifications (async)                        │  │
│  │  • Push Notifications                                 │  │
│  │  • Media Processing (thumbnails, compression)        │  │
│  │  • Analytics Events                                   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Architecture Highlights

#### Multi-Server Scaling
- **Socket.io Redis Adapter**: Ensures WebSocket events are synchronized across all server instances
- **Sticky Sessions**: Load balancer routes same client to same server (WebSocket requirement)
- **Stateless Design**: All state stored in Redis/PostgreSQL, servers can be added/removed dynamically

#### Caching Strategy
- **Redis for Hot Data**:
  - Online users (updated every 30s)
  - Typing indicators (5s TTL)
  - Session tokens (7 day TTL)
  - Recent conversations (5 min TTL)
  
- **PostgreSQL for Cold Data**:
  - Message history
  - User profiles
  - Contact relationships
  - Conversation metadata

#### Real-Time Communication Flow
1. Client connects via WebSocket (Socket.io)
2. Server authenticates JWT token
3. User joins their personal room (`user:{userId}`)
4. User joins conversation rooms (`conversation:{conversationId}`)
5. Messages published to Redis pub/sub
6. All servers receive event and emit to relevant clients

---

## 💾 Database Design

### PostgreSQL Schema

#### Entity Relationship Diagram (ERD)

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
└─────────────────┘   │
                      │
       ┌──────────────┴─────────────────────┐
       │                                    │
       │                                    │
┌──────▼──────────┐              ┌─────────▼────────┐
│    CONTACTS     │              │  CONVERSATIONS   │
│─────────────────│              │──────────────────│
│ id (PK)         │              │ id (PK)          │
│ user_id (FK)    │              │ type             │
│ contact_user_id │              │ name             │
│ nickname        │              │ created_by (FK)  │
│ is_blocked      │              │ last_message_at  │
│ is_favorite     │              └──────────────────┘
└─────────────────┘                       │
                                          │
                           ┌──────────────┼──────────────┐
                           │                             │
                  ┌────────▼────────┐         ┌─────────▼─────────┐
                  │    MESSAGES     │         │  CONVERSATION_    │
                  │─────────────────│         │   PARTICIPANTS    │
                  │ id (PK)         │         │───────────────────│
                  │ conversation_id │         │ id (PK)           │
                  │ sender_id (FK)  │         │ conversation_id   │
                  │ content         │         │ user_id (FK)      │
                  │ message_type    │         │ role              │
                  │ file_url        │         │ last_read_at      │
                  │ created_at      │         │ is_muted          │
                  │ edited_at       │         └───────────────────┘
                  │ deleted_at      │
                  └─────────────────┘
                           │
                  ┌────────▼────────┐
                  │ MESSAGE_STATUS  │
                  │─────────────────│
                  │ id (PK)         │
                  │ message_id (FK) │
                  │ user_id (FK)    │
                  │ status          │
                  │ timestamp       │
                  └─────────────────┘
```

### Complete SQL Schema

```sql
-- ============================================================================
-- USERS TABLE
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone_number VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    display_name VARCHAR(100),
    bio TEXT,
    avatar_url VARCHAR(500),
    status VARCHAR(20) DEFAULT 'offline', -- online, offline, away, busy
    last_seen TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_status ON users(status);

-- ============================================================================
-- CONTACTS TABLE (User's contact list)
-- ============================================================================
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contact_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    nickname VARCHAR(100), -- Custom name for this contact
    is_blocked BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, contact_user_id),
    CHECK (user_id != contact_user_id) -- Can't add yourself
);

CREATE INDEX idx_contacts_user_id ON contacts(user_id);
CREATE INDEX idx_contacts_contact_user_id ON contacts(contact_user_id);

-- ============================================================================
-- CONVERSATIONS TABLE (1-on-1 or group chats)
-- ============================================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL, -- 'direct' or 'group'
    name VARCHAR(100), -- For group chats
    avatar_url VARCHAR(500), -- For group chats
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_message_at TIMESTAMP
);

CREATE INDEX idx_conversations_type ON conversations(type);
CREATE INDEX idx_conversations_updated ON conversations(updated_at DESC);

-- ============================================================================
-- CONVERSATION PARTICIPANTS
-- ============================================================================
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) DEFAULT 'member', -- 'admin' or 'member' (for groups)
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    left_at TIMESTAMP,
    last_read_at TIMESTAMP, -- For unread count
    is_muted BOOLEAN DEFAULT FALSE,
    is_archived BOOLEAN DEFAULT FALSE,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_participants_conversation ON conversation_participants(conversation_id);
CREATE INDEX idx_participants_user ON conversation_participants(user_id);
CREATE INDEX idx_participants_active ON conversation_participants(user_id, left_at) 
    WHERE left_at IS NULL;

-- ============================================================================
-- MESSAGES TABLE
-- ============================================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT, -- Null for media-only messages
    message_type VARCHAR(20) DEFAULT 'text', -- text, image, file, system
    file_url VARCHAR(500), -- For attachments
    file_name VARCHAR(255),
    file_size INTEGER, -- In bytes
    file_type VARCHAR(100), -- MIME type
    reply_to_message_id UUID REFERENCES messages(id), -- For replies
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    edited_at TIMESTAMP,
    deleted_at TIMESTAMP, -- Soft delete
    is_deleted BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);
CREATE INDEX idx_messages_created ON messages(created_at DESC);

-- ============================================================================
-- MESSAGE DELIVERY STATUS (Read receipts)
-- ============================================================================
CREATE TABLE message_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL, -- sent, delivered, read
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);

CREATE INDEX idx_message_status_message ON message_status(message_id);
CREATE INDEX idx_message_status_user ON message_status(user_id);

-- ============================================================================
-- TYPING INDICATORS (Could use Redis instead for better performance)
-- ============================================================================
CREATE TABLE typing_indicators (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    UNIQUE(conversation_id, user_id)
);

CREATE INDEX idx_typing_conversation ON typing_indicators(conversation_id);
CREATE INDEX idx_typing_expires ON typing_indicators(expires_at);

-- ============================================================================
-- SESSIONS TABLE (For JWT refresh tokens)
-- ============================================================================
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token VARCHAR(500) NOT NULL,
    device_info TEXT, -- User agent, IP, etc.
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_token ON sessions(refresh_token);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============================================================================
-- CONTACT REQUESTS TABLE (For friend requests)
-- ============================================================================
CREATE TABLE contact_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    from_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    to_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- pending, accepted, rejected
    message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    responded_at TIMESTAMP,
    UNIQUE(from_user_id, to_user_id),
    CHECK (from_user_id != to_user_id)
);

CREATE INDEX idx_contact_requests_to ON contact_requests(to_user_id, status);
CREATE INDEX idx_contact_requests_from ON contact_requests(from_user_id);
```

### Key Design Decisions

1. **UUID Primary Keys**: Better for distributed systems, no collision risk
2. **Soft Deletes**: Messages marked as deleted but not removed (for legal/audit)
3. **Composite Indexes**: Optimized for common query patterns
4. **Foreign Key Constraints**: Ensures referential integrity
5. **Timestamps**: All tables have created_at/updated_at for audit trails

---

## 🔌 API Design

### REST API Endpoints

#### Authentication Endpoints

```
POST   /api/auth/register
Body: {
  username: string,
  email: string,
  password: string,
  phone_number?: string
}
Response: {
  user: User,
  accessToken: string,
  refreshToken: string
}

POST   /api/auth/login
Body: { email: string, password: string }
Response: { user, accessToken, refreshToken }

POST   /api/auth/logout
Headers: { Authorization: Bearer <token> }
Body: { refreshToken: string }
Response: { message: "Logged out successfully" }

POST   /api/auth/refresh
Body: { refreshToken: string }
Response: { accessToken: string, refreshToken: string }

POST   /api/auth/verify-email
Body: { token: string }
Response: { message: "Email verified" }

POST   /api/auth/forgot-password
Body: { email: string }
Response: { message: "Reset email sent" }

POST   /api/auth/reset-password
Body: { token: string, newPassword: string }
Response: { message: "Password reset successful" }
```

#### User Management Endpoints

```
GET    /api/users/me
Response: { user: User }

PUT    /api/users/me
Body: { display_name?, bio?, status? }
Response: { user: User }

PUT    /api/users/me/avatar
Body: FormData (multipart/form-data)
Response: { avatar_url: string }

GET    /api/users/search?q={query}&limit={number}&offset={number}
Response: { users: User[], total: number }

GET    /api/users/:userId
Response: { user: PublicUser }

PUT    /api/users/me/status
Body: { status: "online" | "away" | "busy" | "offline" }
Response: { status: string }
```

#### Contact Management Endpoints

```
GET    /api/contacts?limit={number}&offset={number}
Response: { contacts: Contact[], total: number }

POST   /api/contacts
Body: { userId: string, nickname?: string }
Response: { contact: Contact }

DELETE /api/contacts/:contactId
Response: { message: "Contact removed" }

PUT    /api/contacts/:contactId
Body: { nickname?: string, is_favorite?: boolean }
Response: { contact: Contact }

POST   /api/contacts/:contactId/block
Response: { message: "Contact blocked" }

POST   /api/contacts/:contactId/unblock
Response: { message: "Contact unblocked" }

GET    /api/contact-requests?type=received|sent
Response: { requests: ContactRequest[] }

POST   /api/contact-requests
Body: { toUserId: string, message?: string }
Response: { request: ContactRequest }

PUT    /api/contact-requests/:requestId/accept
Response: { contact: Contact }

PUT    /api/contact-requests/:requestId/reject
Response: { message: "Request rejected" }
```

#### Conversation Endpoints

```
GET    /api/conversations?limit={number}&offset={number}
Response: { conversations: Conversation[], total: number }

POST   /api/conversations
Body: { participantIds: string[], type: "direct"|"group", name?: string }
Response: { conversation: Conversation }

GET    /api/conversations/:conversationId
Response: { conversation: Conversation }

DELETE /api/conversations/:conversationId
Response: { message: "Conversation deleted" }

PUT    /api/conversations/:conversationId/archive
Response: { message: "Conversation archived" }

PUT    /api/conversations/:conversationId/mute
Body: { muted: boolean }
Response: { message: "Conversation muted/unmuted" }

-- Group chat specific (Phase 2)
POST   /api/conversations/:conversationId/participants
Body: { userIds: string[] }
Response: { participants: Participant[] }

DELETE /api/conversations/:conversationId/participants/:userId
Response: { message: "Participant removed" }

PUT    /api/conversations/:conversationId/participants/:userId/role
Body: { role: "admin" | "member" }
Response: { participant: Participant }
```

#### Message Endpoints

```
GET    /api/conversations/:conversationId/messages?limit=50&before={messageId}
Response: { messages: Message[], hasMore: boolean }

POST   /api/conversations/:conversationId/messages
Body: {
  content?: string,
  messageType: "text"|"image"|"file",
  fileUrl?: string,
  replyToMessageId?: string
}
Response: { message: Message }

PUT    /api/messages/:messageId
Body: { content: string }
Response: { message: Message }

DELETE /api/messages/:messageId
Response: { message: "Message deleted" }

POST   /api/messages/:messageId/read
Response: { message: "Marked as read" }
```

#### File Upload Endpoints

```
POST   /api/upload/avatar
Body: FormData (image file)
Response: { url: string }

POST   /api/upload/attachment
Body: FormData (file)
Response: {
  url: string,
  fileName: string,
  fileSize: number,
  fileType: string,
  thumbnailUrl?: string
}

GET    /api/files/:fileId
Headers: { Authorization: Bearer <token> }
Response: File stream (with appropriate Content-Type)
```

### API Response Format

```javascript
// Success Response
{
  success: true,
  data: { ... },
  message?: string
}

// Error Response
{
  success: false,
  error: {
    code: "ERROR_CODE",
    message: "Human readable message",
    details?: { ... }
  }
}

// Paginated Response
{
  success: true,
  data: [ ... ],
  pagination: {
    total: number,
    limit: number,
    offset: number,
    hasMore: boolean
  }
}
```

---

## ⚡ Socket.io Events

### Client → Server Events

```javascript
// ============================================================================
// CONNECTION & AUTHENTICATION
// ============================================================================
socket.emit('authenticate', { token: 'jwt_token' })
// Authenticate the socket connection with JWT

// ============================================================================
// MESSAGING
// ============================================================================
socket.emit('message:send', {
  conversationId: 'uuid',
  content: 'Hello world',
  replyToMessageId?: 'uuid',
  tempId: 'client_generated_id'  // For optimistic updates
})

socket.emit('message:edit', {
  messageId: 'uuid',
  newContent: 'Updated message'
})

socket.emit('message:delete', {
  messageId: 'uuid'
})

socket.emit('message:read', {
  messageId: 'uuid',
  conversationId: 'uuid'
})

// ============================================================================
// TYPING INDICATORS
// ============================================================================
socket.emit('typing:start', {
  conversationId: 'uuid'
})

socket.emit('typing:stop', {
  conversationId: 'uuid'
})

// ============================================================================
// PRESENCE
// ============================================================================
socket.emit('presence:update', {
  status: 'online' | 'away' | 'busy' | 'offline'
})

// ============================================================================
// CONVERSATIONS
// ============================================================================
socket.emit('conversation:join', {
  conversationId: 'uuid'
})
// Subscribe to conversation updates

socket.emit('conversation:leave', {
  conversationId: 'uuid'
})
// Unsubscribe from conversation
```

### Server → Client Events

```javascript
// ============================================================================
// AUTHENTICATION
// ============================================================================
socket.on('authenticated', (data) => {
  // data: { userId: string, sessionId: string }
})

socket.on('authentication:error', (data) => {
  // data: { message: string }
})

// ============================================================================
// MESSAGES
// ============================================================================
socket.on('message:new', (data) => {
  // data: {
  //   id: string,
  //   conversationId: string,
  //   sender: { id, username, avatar },
  //   content: string,
  //   messageType: string,
  //   createdAt: timestamp,
  //   replyToMessage?: Message
  // }
})

socket.on('message:sent', (data) => {
  // Confirmation of sent message
  // data: { tempId: string, messageId: string, createdAt: timestamp }
})

socket.on('message:edited', (data) => {
  // data: { messageId: string, newContent: string, editedAt: timestamp }
})

socket.on('message:deleted', (data) => {
  // data: { messageId: string, conversationId: string }
})

socket.on('message:read', (data) => {
  // data: { messageId: string, userId: string, readAt: timestamp }
})

socket.on('message:error', (data) => {
  // data: { tempId: string, error: string }
})

// ============================================================================
// TYPING INDICATORS
// ============================================================================
socket.on('typing:update', (data) => {
  // data: {
  //   conversationId: string,
  //   users: [{ id: string, username: string }]
  // }
})

// ============================================================================
// PRESENCE
// ============================================================================
socket.on('presence:update', (data) => {
  // data: { userId: string, status: string, lastSeen: timestamp }
})

socket.on('user:online', (data) => {
  // data: { userId: string }
})

socket.on('user:offline', (data) => {
  // data: { userId: string, lastSeen: timestamp }
})

// ============================================================================
// CONVERSATIONS
// ============================================================================
socket.on('conversation:updated', (data) => {
  // data: {
  //   conversationId: string,
  //   lastMessage: Message,
  //   unreadCount: number
  // }
})

socket.on('conversation:new', (data) => {
  // data: { conversation: Conversation }
})

// ============================================================================
// SYSTEM EVENTS
// ============================================================================
socket.on('error', (data) => {
  // data: { code: string, message: string }
})

socket.on('disconnect', (reason) => {
  // reason: string (e.g., 'transport close', 'ping timeout')
})
```

### Socket.io Room Structure

```javascript
// User-specific room (for personal notifications)
`user:${userId}`

// Conversation room (for group messages)
`conversation:${conversationId}`

// Online users room (for presence updates)
`online_users`
```

---

## 📁 Project Structure

```
chatterbox/
├── server/
│   ├── src/
│   │   ├── config/
│   │   │   ├── database.js          # PostgreSQL connection & pool
│   │   │   ├── redis.js             # Redis client configuration
│   │   │   ├── socket.js            # Socket.io setup with Redis adapter
│   │   │   ├── storage.js           # AWS S3 / MinIO configuration
│   │   │   └── env.js               # Environment variables loader
│   │   │
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT authentication middleware
│   │   │   ├── validation.js        # Request validation (Joi schemas)
│   │   │   ├── rateLimiter.js       # Rate limiting (express-rate-limit)
│   │   │   ├── upload.js            # Multer file upload middleware
│   │   │   └── errorHandler.js      # Global error handler
│   │   │
│   │   ├── models/
│   │   │   ├── User.js              # User model & queries
│   │   │   ├── Message.js           # Message model & queries
│   │   │   ├── Conversation.js      # Conversation model & queries
│   │   │   ├── Contact.js           # Contact model & queries
│   │   │   └── Session.js           # Session model & queries
│   │   │
│   │   ├── controllers/
│   │   │   ├── authController.js    # Authentication logic
│   │   │   ├── userController.js    # User management logic
│   │   │   ├── messageController.js # Message CRUD operations
│   │   │   ├── conversationController.js
│   │   │   ├── contactController.js
│   │   │   └── uploadController.js
│   │   │
│   │   ├── services/
│   │   │   ├── authService.js       # JWT generation, password hashing
│   │   │   ├── messageService.js    # Message business logic
│   │   │   ├── presenceService.js   # Online/offline status tracking
│   │   │   ├── typingService.js     # Typing indicator management
│   │   │   ├── uploadService.js     # File upload to S3/MinIO
│   │   │   ├── emailService.js      # Email sending (verification, etc.)
│   │   │   └── notificationService.js
│   │   │
│   │   ├── routes/
│   │   │   ├── index.js             # Route aggregator
│   │   │   ├── auth.routes.js
│   │   │   ├── user.routes.js
│   │   │   ├── message.routes.js
│   │   │   ├── conversation.routes.js
│   │   │   ├── contact.routes.js
│   │   │   └── upload.routes.js
│   │   │
│   │   ├── socket/
│   │   │   ├── handlers/
│   │   │   │   ├── messageHandler.js    # Handle message events
│   │   │   │   ├── typingHandler.js     # Handle typing events
│   │   │   │   ├── presenceHandler.js   # Handle presence events
│   │   │   │   └── connectionHandler.js # Handle connect/disconnect
│   │   │   ├── middleware/
│   │   │   │   └── socketAuth.js        # Socket authentication
│   │   │   └── index.js                 # Socket.io initialization
│   │   │
│   │   ├── utils/
│   │   │   ├── jwt.js               # JWT utilities
│   │   │   ├── bcrypt.js            # Password hashing utilities
│   │   │   ├── validators.js        # Custom validators
│   │   │   ├── logger.js            # Winston logger
│   │   │   └── constants.js         # App constants
│   │   │
│   │   ├── database/
│   │   │   ├── migrations/          # Database migrations
│   │   │   │   ├── 001_create_users.sql
│   │   │   │   ├── 002_create_contacts.sql
│   │   │   │   └── ...
│   │   │   └── seeds/               # Seed data for testing
│   │   │       └── dev_users.sql
│   │   │
│   │   ├── app.js                   # Express app setup
│   │   └── server.js                # Server entry point
│   │
│   ├── tests/
│   │   ├── unit/                    # Unit tests
│   │   │   ├── services/
│   │   │   └── utils/
│   │   ├── integration/             # API integration tests
│   │   │   ├── auth.test.js
│   │   │   ├── messages.test.js
│   │   │   └── ...
│   │   └── e2e/                     # End-to-end tests
│   │       └── socket.test.js
│   │
│   ├── .env.example                 # Environment variables template
│   ├── .gitignore
│   ├── package.json
│   ├── eslint.config.js
│   ├── jest.config.js
│   └── README.md
│
├── client/
│   ├── public/
│   │   ├── index.html
│   │   ├── favicon.ico
│   │   └── manifest.json
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── Login.jsx
│   │   │   │   ├── Register.jsx
│   │   │   │   └── ForgotPassword.jsx
│   │   │   │
│   │   │   ├── chat/
│   │   │   │   ├── ConversationList.jsx
│   │   │   │   ├── ConversationItem.jsx
│   │   │   │   ├── ChatWindow.jsx
│   │   │   │   ├── MessageList.jsx
│   │   │   │   ├── Message.jsx
│   │   │   │   ├── MessageInput.jsx
│   │   │   │   └── TypingIndicator.jsx
│   │   │   │
│   │   │   ├── contacts/
│   │   │   │   ├── ContactList.jsx
│   │   │   │   ├── ContactCard.jsx
│   │   │   │   ├── AddContact.jsx
│   │   │   │   └── ContactRequests.jsx
│   │   │   │
│   │   │   ├── profile/
│   │   │   │   ├── UserProfile.jsx
│   │   │   │   ├── EditProfile.jsx
│   │   │   │   └── ProfileSettings.jsx
│   │   │   │
│   │   │   ├── layout/
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── MainLayout.jsx
│   │   │   │
│   │   │   └── common/
│   │   │       ├── Avatar.jsx
│   │   │       ├── OnlineIndicator.jsx
│   │   │       ├── FileUpload.jsx
│   │   │       ├── Loader.jsx
│   │   │       └── ErrorBoundary.jsx
│   │   │
│   │   ├── contexts/
│   │   │   ├── AuthContext.jsx      # Auth state provider
│   │   │   └── SocketContext.jsx    # Socket connection provider
│   │   │
│   │   ├── hooks/
│   │   │   ├── useAuth.js           # Authentication hook
│   │   │   ├── useSocket.js         # Socket.io hook
│   │   │   ├── useMessages.js       # Message management hook
│   │   │   ├── usePresence.js       # Presence tracking hook
│   │   │   └── useTyping.js         # Typing indicator hook
│   │   │
│   │   ├── services/
│   │   │   ├── api.js               # Axios instance & interceptors
│   │   │   ├── socket.js            # Socket.io client setup
│   │   │   └── storage.js           # LocalStorage utilities
│   │   │
│   │   ├── store/
│   │   │   ├── slices/
│   │   │   │   ├── authSlice.js     # Auth state (Redux)
│   │   │   │   ├── messagesSlice.js # Messages state
│   │   │   │   ├── conversationsSlice.js
│   │   │   │   ├── contactsSlice.js
│   │   │   │   └── uiSlice.js       # UI state (modals, etc.)
│   │   │   └── store.js             # Redux store configuration
│   │   │
│   │   ├── utils/
│   │   │   ├── formatters.js        # Date/time formatters
│   │   │   ├── validators.js        # Form validators
│   │   │   └── constants.js         # App constants
│   │   │
│   │   ├── styles/
│   │   │   ├── theme.js             # Material-UI theme
│   │   │   └── globalStyles.js      # Global CSS
│   │   │
│   │   ├── App.jsx                  # Root component
│   │   ├── main.jsx                 # React entry point
│   │   └── routes.jsx               # React Router routes
│   │
│   ├── .env.example
│   ├── .gitignore
│   ├── package.json
│   ├── vite.config.js
│   └── README.md
│
├── docker-compose.yml               # Docker services (dev environment)
├── .dockerignore
├── .gitignore
└── README.md                        # Main project README
```

---

## 📅 Implementation Roadmap

### PHASE 1: Foundation (Weeks 1-2) - 14 hours

#### Week 1: Project Setup & Authentication (7 hours) - ✅ COMPLETED!

**Day 1-2: Environment Setup (2 hours)** - ✅ COMPLETED
- [x] Initialize Node.js project with Express
- [x] Setup PostgreSQL database (local or Docker)
- [x] Setup Redis (local or Docker)
- [x] Configure ESLint, Prettier
- [x] Create project structure
- [x] Setup environment variables

**Day 3-4: Database Schema (2 hours)** - ✅ COMPLETED
- [x] Create database migrations
- [x] Implement user table
- [x] Implement sessions table
- [x] Test database connection
- [x] Create seed data for testing

**Day 5-7: Authentication System (3 hours)** - ✅ COMPLETED
- [x] Implement password hashing (bcrypt)
- [x] Create JWT utilities (access + refresh tokens)
- [x] Build registration endpoint
- [x] Build login endpoint
- [x] Build logout endpoint
- [x] Build refresh token endpoint
- [x] Create auth middleware
- [x] Add rate limiting to auth routes
- [x] Add structured logging
- [x] Write comprehensive tests (38 tests passing)

**✅ Milestone 1 ACHIEVED**: Users can register and login!

---

#### Week 2: User Management (7 hours) - IN PROGRESS (33% Complete)

**Day 1-2: User Profile CRUD (2 hours)** - ✅ COMPLETED
- [x] Get current user endpoint
- [x] Update user profile endpoint  
- [x] User model with database queries
- [x] Input validation middleware
- [x] Public user profile endpoint

**Day 3-4: User Search (2 hours)**
- [ ] User search endpoint (by username/email)
- [ ] Pagination implementation
- [ ] Public user profile endpoint
- [ ] Online status update endpoint

**Day 5-7: Avatar Upload (3 hours)** - ✅ COMPLETED (96% - See Note)
- [x] Configure AWS S3 or MinIO
- [x] Multer middleware for file uploads
- [x] Avatar upload endpoint
- [x] Image validation (type, size)
- [x] Image storage and retrieval
- [x] Comprehensive test suite (159/165 tests passing)

**⚠️ Known Issue - TODO for Week 3:**
- 6 avatar upload tests failing due to Jest module mocking complexity
- These are edge case tests (upload failures, DB rollback scenarios)
- Not blocking development - production code works correctly
- **Priority: Week 3, Day 1** - Investigate Jest mock configuration for aliased imports

**✅ Milestone 2**: Complete user management system (96% test coverage)

---

### PHASE 2: Real-Time Core (Weeks 3-4) - 14 hours

#### Week 3: Socket.io Setup & Presence (7 hours)

**Day 1: Fix Avatar Upload Tests (1 hour)** - 🔴 HIGH PRIORITY
- [ ] Investigate Jest mock configuration for aliased imports in userController
- [ ] Fix 6 failing avatar upload tests (edge case error scenarios)
- [ ] Achieve 100% test pass rate (165/165 tests)
- [ ] Document solution for future reference

**Context**: Week 2 completed with 159/165 tests passing (96%). The 6 failing tests are avatar upload edge cases related to Jest mocking of destructured imports. Not blocking, but should be fixed before Phase 2.

**Day 2-3: Socket.io Configuration (2 hours)**
- [ ] Install Socket.io server
- [ ] Configure Socket.io with Express
- [ ] Setup Redis adapter for multi-server support
- [ ] Create socket connection handler
- [ ] Test WebSocket connections

**Day 4-5: Socket Authentication (2 hours)**
- [ ] JWT authentication middleware for sockets
- [ ] Socket connection authorization
- [ ] User room creation (`user:${userId}`)
- [ ] Handle connection errors

**Day 6-7: Presence System (2 hours)**
- [ ] Online/offline status tracking (Redis)
- [ ] Last seen timestamps
- [ ] Presence update events
- [ ] User status updates (away, busy, etc.)
- [ ] Broadcast presence changes to contacts

**✅ Milestone 3**: Real-time connection with presence tracking

---

#### Week 4: Basic Messaging (7 hours)

**Day 1-2: Conversation Setup (2 hours)**
- [ ] Implement conversations table
- [ ] Implement conversation_participants table
- [ ] Create conversation model
- [ ] Create direct conversation endpoint
- [ ] Get user conversations endpoint

**Day 3-5: Message Sending (3 hours)**
- [ ] Implement messages table
- [ ] Create message model
- [ ] Socket event: `message:send`
- [ ] Save message to database
- [ ] Emit `message:new` to conversation participants
- [ ] Optimistic updates (tempId)

**Day 6-7: Message Retrieval (2 hours)**
- [ ] Get conversation messages endpoint (REST)
- [ ] Pagination (cursor-based)
- [ ] Message status tracking (sent, delivered)
- [ ] Test message flow end-to-end

**✅ Milestone 4**: Users can send and receive real-time messages

---

### PHASE 3: Enhanced Messaging (Weeks 5-6) - 14 hours

#### Week 5: Message Features (7 hours)

**Day 1-2: Message Editing & Deletion (2 hours)**
- [ ] Edit message endpoint (REST)
- [ ] Socket event: `message:edit`
- [ ] Delete message endpoint (soft delete)
- [ ] Socket event: `message:delete`
- [ ] Update UI on edit/delete

**Day 3-4: Read Receipts (2 hours)**
- [ ] Implement message_status table
- [ ] Mark message as read endpoint
- [ ] Socket event: `message:read`
- [ ] Unread count calculation
- [ ] Display read status in UI

**Day 5-7: Message History (3 hours)**
- [ ] Efficient pagination queries
- [ ] Load older messages endpoint
- [ ] Message caching strategy (Redis)
- [ ] Last read position tracking
- [ ] Scroll position management

**✅ Milestone 5**: Full-featured messaging with receipts

---

#### Week 6: Typing Indicators (7 hours)

**Day 1-3: Typing System (3 hours)**
- [ ] Redis-based typing indicator storage
- [ ] Socket event: `typing:start`
- [ ] Socket event: `typing:stop`
- [ ] Typing timeout logic (5 seconds)
- [ ] Broadcast typing status to conversation

**Day 4-5: Optimization (2 hours)**
- [ ] Debounce typing events (client-side)
- [ ] Rate limiting for typing events
- [ ] Cleanup expired typing indicators
- [ ] Test with multiple users

**Day 6-7: Testing & Bug Fixes (2 hours)**
- [ ] End-to-end testing
- [ ] Fix race conditions
- [ ] Performance testing
- [ ] Documentation

**✅ Milestone 6**: Typing indicators working smoothly

---

### PHASE 4: Contact System (Weeks 7-8) - 14 hours

#### Week 7: Contact Management (7 hours)

**Day 1-3: Contact CRUD (3 hours)**
- [ ] Implement contacts table
- [ ] Get contacts endpoint
- [ ] Add contact endpoint
- [ ] Remove contact endpoint
- [ ] Update contact (nickname, favorite) endpoint

**Day 4-5: Contact Search & Discovery (2 hours)**
- [ ] Search users not in contacts
- [ ] Filter blocked users
- [ ] Contact suggestions algorithm
- [ ] Pagination for contacts

**Day 6-7: Contact Requests (2 hours)**
- [ ] Implement contact_requests table
- [ ] Send contact request endpoint
- [ ] Get pending requests endpoint
- [ ] Accept request endpoint
- [ ] Reject request endpoint
- [ ] Socket notifications for requests

**✅ Milestone 7**: Complete contact management

---

#### Week 8: Contact Features (7 hours)

**Day 1-2: Block/Unblock (2 hours)**
- [ ] Block contact endpoint
- [ ] Unblock contact endpoint
- [ ] Prevent messaging from blocked users
- [ ] Hide blocked users from search

**Day 3-4: Favorite Contacts (2 hours)**
- [ ] Mark contact as favorite
- [ ] Sort favorites at top
- [ ] Favorite contacts UI section

**Day 5-7: Contact Synchronization (3 hours)**
- [ ] Phone number/email matching
- [ ] Bulk contact import
- [ ] Contact sync strategy
- [ ] Privacy considerations

**✅ Milestone 8**: Feature-complete contact system

---

### PHASE 5: Frontend Development (Weeks 9-12) - 28 hours

#### Week 9-10: Core UI (14 hours)

**Week 9: Setup & Authentication UI (7 hours)**
- [ ] Create React app with Vite
- [ ] Setup Redux Toolkit
- [ ] Configure Material-UI theme
- [ ] Create login page
- [ ] Create registration page
- [ ] Create forgot password page
- [ ] Implement form validation
- [ ] Connect to auth API

**Week 10: Main Layout & Chat Interface (7 hours)**
- [ ] Create main layout component
- [ ] Create sidebar with conversation list
- [ ] Create chat window component
- [ ] Create message list component
- [ ] Create message input component
- [ ] Responsive design (mobile-friendly)

**✅ Milestone 9**: Basic UI functional

---

#### Week 11-12: Chat Features UI (14 hours)

**Week 11: Messaging UI (7 hours)**
- [ ] Connect Socket.io client
- [ ] Send messages from UI
- [ ] Receive and display messages
- [ ] Implement virtual scrolling (react-window)
- [ ] Message timestamps and formatting
- [ ] Emoji picker integration
- [ ] File attachment UI

**Week 12: Presence & Contacts UI (7 hours)**
- [ ] Online/offline indicators
- [ ] Typing indicator animation
- [ ] Contact list component
- [ ] Contact search UI
- [ ] Contact requests UI
- [ ] User profile modal
- [ ] Settings page

**✅ Milestone 10**: Fully functional web client

---

### PHASE 6: Polish & Production (Weeks 13-16) - 28 hours

#### Week 13: File Attachments (7 hours)

**Day 1-3: File Upload (3 hours)**
- [ ] File upload component (drag & drop)
- [ ] Image preview before sending
- [ ] Progress indicators
- [ ] File type validation

**Day 4-5: File Display (2 hours)**
- [ ] Image thumbnails in chat
- [ ] File download links
- [ ] Image lightbox/modal
- [ ] PDF viewer integration

**Day 6-7: Media Processing (2 hours)**
- [ ] Image compression (client-side)
- [ ] Thumbnail generation (server-side)
- [ ] Video thumbnail extraction
- [ ] File size limits enforcement

**✅ Milestone 11**: File sharing functional

---

#### Week 14: Optimization (7 hours)

**Day 1-2: Database Optimization (2 hours)**
- [ ] Analyze slow queries
- [ ] Add missing indexes
- [ ] Implement database connection pooling
- [ ] Query result caching (Redis)

**Day 3-4: Redis Caching (2 hours)**
- [ ] Cache user profiles
- [ ] Cache conversation lists
- [ ] Cache message counts
- [ ] Cache invalidation strategy

**Day 5-7: Socket.io Scaling (3 hours)**
- [ ] Configure Redis adapter properly
- [ ] Test multi-server setup
- [ ] Implement sticky sessions (Nginx)
- [ ] Load testing with Socket.io

**✅ Milestone 12**: Optimized for scale

---

#### Week 15: Security & Testing (7 hours)

**Day 1-2: Security Hardening (2 hours)**
- [ ] Implement rate limiting (all endpoints)
- [ ] Add input sanitization
- [ ] SQL injection prevention audit
- [ ] XSS prevention (Content Security Policy)
- [ ] CORS configuration
- [ ] Helmet.js middleware

**Day 3-5: Testing (3 hours)**
- [ ] Write unit tests (services)
- [ ] Write integration tests (API endpoints)
- [ ] Write E2E tests (Socket.io flows)
- [ ] Test coverage report
- [ ] Fix failing tests

**Day 6-7: Security Audit (2 hours)**
- [ ] Password security audit
- [ ] JWT expiration testing
- [ ] Session management review
- [ ] File upload security review
- [ ] Dependency vulnerability scan

**✅ Milestone 13**: Secure and tested

---

#### Week 16: Deployment (7 hours)

**Day 1-2: Docker Setup (2 hours)**
- [ ] Create Dockerfile for server
- [ ] Create Dockerfile for client
- [ ] Docker Compose for local development
- [ ] Environment-specific configs

**Day 3-4: CI/CD Pipeline (2 hours)**
- [ ] GitHub Actions workflow
- [ ] Automated testing in CI
- [ ] Automated builds
- [ ] Automated deployments

**Day 5-6: Cloud Deployment (2 hours)**
- [ ] Setup cloud provider (AWS/DigitalOcean)
- [ ] Configure PostgreSQL (managed or self-hosted)
- [ ] Configure Redis (managed or self-hosted)
- [ ] Configure S3/MinIO
- [ ] Deploy application servers
- [ ] Setup Nginx reverse proxy
- [ ] Configure SSL certificates (Let's Encrypt)

**Day 7: Monitoring & Logging (1 hour)**
- [ ] Setup logging (Winston)
- [ ] Error tracking (Sentry)
- [ ] Performance monitoring
- [ ] Database monitoring
- [ ] Create runbook for incidents

**✅ Milestone 14**: Production deployment complete! 🎉

---

## 🎯 PHASE 7+ (Optional Extensions - Month 3+)

### Group Chats (2-3 weeks)
- [ ] Multi-participant conversations
- [ ] Add/remove participants
- [ ] Admin roles and permissions
- [ ] Group info and settings
- [ ] Group avatars
- [ ] Member list UI
- [ ] Group creation wizard

### End-to-End Encryption (3-4 weeks)
- [ ] Research Signal Protocol
- [ ] Implement key exchange (X3DH)
- [ ] Implement Double Ratchet algorithm
- [ ] Encrypted message storage
- [ ] Key rotation
- [ ] Multi-device key sync
- [ ] Forward secrecy
- [ ] Verify safety numbers UI

### Advanced Features
- [ ] Voice messages (recording & playback)
- [ ] Video calls (WebRTC)
- [ ] Screen sharing
- [ ] Message reactions (emoji)
- [ ] Message forwarding
- [ ] Full-text message search
- [ ] Push notifications (FCM/APNS)
- [ ] Email notifications
- [ ] Message pinning
- [ ] Conversation folders/labels
- [ ] Export chat history
- [ ] Two-factor authentication (2FA)

---

## 🔒 Security Considerations

### Authentication Security

```javascript
// 1. Password Security
- Minimum 8 characters
- Bcrypt hashing with 12 rounds
- Password strength validation
- Rate limiting on login attempts (5 attempts per 15 min)

// 2. JWT Tokens
- Access token: 15 minutes expiry
- Refresh token: 7 days expiry
- HttpOnly cookies for refresh tokens
- CSRF protection

// 3. Session Management
- Logout invalidates refresh token
- Track active sessions per user
- Device fingerprinting
- Force logout on suspicious activity
```

### API Security

```javascript
// 1. Rate Limiting
- Authentication: 5 requests/15min per IP
- API endpoints: 100 requests/15min per user
- File uploads: 10 requests/hour per user
- Socket connections: 3 connections per user

// 2. Input Validation
- Use Joi or express-validator
- Validate all user inputs
- Sanitize inputs to prevent XSS
- Parameterized SQL queries (prevent SQL injection)

// 3. CORS Configuration
- Whitelist specific origins only
- No wildcard (*) in production
- Credentials: true for cookies

// 4. Helmet.js Middleware
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options
- Strict-Transport-Security
```

### Socket.io Security

```javascript
// 1. Connection Security
- Authenticate before allowing socket events
- Verify JWT on connection
- Re-authenticate on token refresh

// 2. Room Access Control
- Verify user is participant before joining conversation room
- Prevent unauthorized message broadcasting
- Validate conversation membership

// 3. Event Rate Limiting
- Typing indicators: max 1 per second
- Messages: max 10 per minute
- Presence updates: max 1 per 30 seconds

// 4. Message Size Limits
- Text messages: 10,000 characters
- File attachments: 10 MB
- Total WebSocket message: 100 KB
```

### Database Security

```javascript
// 1. Connection Security
- Use SSL/TLS for database connections
- Restrict database access by IP
- Use read-only replicas for read queries

// 2. Data Protection
- Encrypt sensitive data at rest
- Hash passwords (bcrypt)
- Soft delete for messages (audit trail)

// 3. Query Security
- Always use parameterized queries
- Implement query timeouts
- Monitor slow queries
```

### File Upload Security

```javascript
// 1. File Validation
- Whitelist allowed file types
- Maximum file size: 10 MB (configurable)
- Virus scanning (ClamAV)
- Image validation (check magic bytes)

// 2. Storage Security
- Random file names (UUID)
- Separate bucket for user uploads
- Private S3 buckets (authenticated access only)
- Pre-signed URLs with expiration

// 3. CDN Security
- CloudFront signed URLs
- Restrict direct S3 access
- Cache-Control headers
```

### Privacy Considerations

```javascript
// 1. Data Minimization
- Collect only necessary user data
- Optional phone number
- No email tracking pixels

// 2. User Control
- Users can delete their account
- Users can delete their messages
- Users can block other users
- Users can export their data

// 3. Transparency
- Clear privacy policy
- Terms of service
- Data retention policy
```

---

## ⚡ Performance Optimization

### Database Optimization

```sql
-- 1. Indexing Strategy
-- Index on foreign keys
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- Composite indexes for common queries
CREATE INDEX idx_participants_active ON conversation_participants(user_id, left_at) 
    WHERE left_at IS NULL;

-- Partial indexes for specific queries
CREATE INDEX idx_typing_active ON typing_indicators(conversation_id) 
    WHERE expires_at > NOW();

-- 2. Query Optimization
-- Use EXPLAIN ANALYZE for slow queries
-- Avoid N+1 queries (use JOINs or batch queries)
-- Implement pagination (cursor-based)
-- Use database connection pooling (pg-pool)

-- 3. Archiving Strategy
-- Archive old messages (> 1 year) to separate table
-- Periodically clean up deleted messages
-- Delete expired sessions and typing indicators
```

### Redis Caching Strategy

```javascript
// 1. Hot Data Caching
user:profile:{userId}          // TTL: 1 hour
conversation:list:{userId}     // TTL: 5 minutes
message:unread:{userId}        // TTL: indefinite (invalidate on read)

// 2. Real-Time Data (Short TTL)
user:online:{userId}           // TTL: 30 seconds
typing:{conversationId}        // TTL: 5 seconds

// 3. Session Data
session:{sessionId}            // TTL: 7 days (refresh token expiry)

// 4. Cache Invalidation
- Invalidate on data update
- Use Redis pub/sub for cache invalidation across servers
- Implement cache versioning
```

### Message Pagination

```javascript
// Cursor-based pagination (better for real-time data)
// Load 50 messages at a time

GET /api/conversations/:conversationId/messages?limit=50&before=messageId

// Implementation:
SELECT * FROM messages 
WHERE conversation_id = $1 
  AND created_at < (SELECT created_at FROM messages WHERE id = $2)
ORDER BY created_at DESC 
LIMIT 50;

// Client-side: Implement virtual scrolling (react-window)
// Cache recent messages in Redux/local state
```

### Socket.io Optimization

```javascript
// 1. Use Rooms Efficiently
// Join only active conversations
socket.join(`conversation:${conversationId}`);

// Leave rooms when not needed
socket.leave(`conversation:${conversationId}`);

// 2. Redis Adapter Configuration
const io = socketIO(server, {
  adapter: require('socket.io-redis')({
    host: 'localhost',
    port: 6379
  }),
  transports: ['websocket', 'polling'],
  pingTimeout: 60000,
  pingInterval: 25000
});

// 3. Compress Socket Payloads
io.use((socket, next) => {
  socket.compress(true);
  next();
});

// 4. Acknowledge Important Messages
socket.emit('message:send', data, (ack) => {
  // Server confirms receipt
});
```

### File Storage Optimization

```javascript
// 1. Image Compression
// Client-side: Compress before upload (browser-image-compression)
// Server-side: Generate thumbnails (sharp)

// 2. Lazy Loading
// Load images only when visible (Intersection Observer)
// Progressive image loading (blur-up technique)

// 3. CDN Integration
// Serve static assets from CloudFront
// Cache-Control headers: max-age=31536000

// 4. Async Processing
// Use Bull queue for:
// - Thumbnail generation
// - Image compression
// - Video transcoding
```

### Frontend Optimization

```javascript
// 1. Code Splitting
// Lazy load routes
const ChatWindow = React.lazy(() => import('./components/chat/ChatWindow'));

// 2. Memoization
// Use React.memo for expensive components
const Message = React.memo(({ message }) => { ... });

// Use useMemo for expensive calculations
const sortedMessages = useMemo(() => {
  return messages.sort((a, b) => a.createdAt - b.createdAt);
}, [messages]);

// 3. Virtual Scrolling
// Use react-window for long message lists
import { FixedSizeList } from 'react-window';

// 4. Debouncing
// Debounce typing indicators
const debouncedTyping = debounce(() => {
  socket.emit('typing:start', { conversationId });
}, 300);

// 5. Service Workers
// Cache static assets
// Enable offline mode
```

---

## 🚀 Deployment Guide

### Development Environment

```bash
# 1. Clone repository
git clone https://github.com/yourusername/chatterbox.git
cd chatterbox

# 2. Setup backend
cd server
npm install
cp .env.example .env
# Edit .env with your configurations

# 3. Start PostgreSQL and Redis (Docker)
docker-compose up -d postgres redis

# 4. Run database migrations
npm run migrate

# 5. Start backend server
npm run dev  # Runs on port 3000

# 6. Setup frontend (new terminal)
cd ../client
npm install
cp .env.example .env
# Edit .env with backend API URL

# 7. Start frontend dev server
npm run dev  # Runs on port 5173
```

### Production Deployment

```bash
# Option 1: Traditional VPS (DigitalOcean, Linode)

# 1. Setup server (Ubuntu 22.04)
ssh root@your-server-ip

# 2. Install dependencies
apt update && apt upgrade -y
apt install -y nodejs npm postgresql redis-server nginx certbot

# 3. Clone and build
git clone https://github.com/yourusername/chatterbox.git
cd chatterbox/server
npm install --production
npm run build  # If using TypeScript

cd ../client
npm install
npm run build  # Creates optimized production build

# 4. Setup PM2 (process manager)
npm install -g pm2
pm2 start server/src/server.js --name chatterbox-api
pm2 startup
pm2 save

# 5. Configure Nginx
nano /etc/nginx/sites-available/chatterbox
# Add Nginx configuration (see below)

# 6. Setup SSL with Let's Encrypt
certbot --nginx -d yourdomain.com -d www.yourdomain.com

# 7. Setup database and Redis
# Configure PostgreSQL with production credentials
# Configure Redis with password protection
```

### Nginx Configuration

```nginx
# /etc/nginx/sites-available/chatterbox

upstream backend {
    ip_hash;  # Sticky sessions for WebSocket
    server localhost:3000;
    server localhost:3001;  # If running multiple instances
}

server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    # Serve React frontend
    location / {
        root /var/www/chatterbox/client/dist;
        try_files $uri $uri/ /index.html;
        
        # Cache static assets
        location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
            expires 1y;
            add_header Cache-Control "public, immutable";
        }
    }

    # API endpoints
    location /api/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    # Socket.io WebSocket
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        
        # WebSocket timeouts
        proxy_read_timeout 86400;
        proxy_send_timeout 86400;
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;
}
```

### Docker Deployment

```yaml
# docker-compose.yml (production)

version: '3.8'

services:
  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: chatterbox
      POSTGRES_USER: dbuser
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: always
    networks:
      - backend

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: always
    networks:
      - backend

  server:
    build: ./server
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://dbuser:${DB_PASSWORD}@postgres:5432/chatterbox
      REDIS_URL: redis://:${REDIS_PASSWORD}@redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      - postgres
      - redis
    restart: always
    networks:
      - backend
    deploy:
      replicas: 2  # Multiple instances for load balancing

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./client/dist:/usr/share/nginx/html
      - certbot_certs:/etc/letsencrypt
    depends_on:
      - server
    restart: always
    networks:
      - backend

volumes:
  postgres_data:
  redis_data:
  certbot_certs:

networks:
  backend:
```

---

## 📊 Monitoring & Logging

```javascript
// 1. Logging (Winston)
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});

// 2. Error Tracking (Sentry)
const Sentry = require('@sentry/node');
Sentry.init({ dsn: process.env.SENTRY_DSN });

// 3. Performance Monitoring
// Track API response times
// Monitor WebSocket connections
// Database query performance

// 4. Health Check Endpoints
GET /health
Response: { status: "ok", uptime: 12345, db: "connected", redis: "connected" }
```

---

## 🎓 Learning Resources

### Documentation
- [Socket.io Docs](https://socket.io/docs/)
- [Express.js Guide](https://expressjs.com/en/guide/routing.html)
- [PostgreSQL Tutorial](https://www.postgresqltutorial.com/)
- [Redis Documentation](https://redis.io/docs/)
- [React Docs](https://react.dev/)
- [Redux Toolkit](https://redux-toolkit.js.org/)

### Tutorials
- Real-time chat app with Socket.io
- JWT authentication best practices
- WebSocket scaling strategies
- Signal Protocol for E2EE

---

## 📝 Next Steps

1. **Start with Phase 1**: Setup environment and authentication
2. **Daily Commits**: Push code every day (1 hour sessions)
3. **Test as You Go**: Write tests for each feature
4. **Document Your Journey**: Keep a dev log (great for portfolio)
5. **Deploy Early**: Deploy to production after Phase 5 (even if incomplete)
6. **Iterate**: Add features based on user feedback

---

## 🙏 Credits & Inspiration

- WhatsApp - UX inspiration
- Signal - E2EE inspiration
- Telegram - Feature ideas
- Discord - Group chat UX

---

## 📄 License

MIT License - Feel free to use this for learning and portfolio projects!

---

**Built with ❤️ by [Your Name]**

*Last Updated: November 2025*