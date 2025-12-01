# ChatterBox - Real-Time Messaging Platform

> **A production-ready MVP messaging platform with real-time communication, contact management, and extensible architecture**

---

## Quick Start Commands

### Development Workflow

```bash
# 1. Start Database Services (PostgreSQL & Redis)
./start-docker.bat          # Windows
# OR
docker-compose up -d        # All platforms

# 2. Test Database Connections
cd server
npm run db:test            # Verify PostgreSQL and Redis are working

# 3. Run Database Migrations
npm run migrate            # Apply all pending migrations
npm run migrate:status     # Check which migrations are applied

# 4. Start Development Server
npm run dev                # Starts server with nodemon on port 3000

# 5. Stop Database Services (when done)
./stop-docker.bat          # Windows
# OR
docker-compose down        # All platforms
```

### Available NPM Scripts

```bash
# Server Management
npm start                  # Start production server
npm run dev               # Start development server (auto-restart)

# Database Operations
npm run db:test           # Test PostgreSQL & Redis connections
npm run migrate           # Run all pending migrations
npm run migrate:status    # Show migration status

# Code Quality
npm run lint              # Run ESLint
npm run format            # Format code with Prettier
```

---

## Current Progress & Status

### **Project Status: PHASE 1 - Days 1-4 COMPLETE! (50%)**

**Next Up:** Authentication System (Days 5-7)

---

## What Has Been Completed (Days 1-4)

### **Day 1-2: Project Setup & Environment**

#### Created Project Structure
```
ChatterBox/
├── server/                    # Backend application
│   ├── src/
│   │   ├── config/           # Configuration files
│   │   ├── controllers/      # Route controllers (empty - ready for Day 5)
│   │   ├── database/         # Database migrations & scripts
│   │   ├── middleware/       # Express middleware (empty - ready for Day 5)
│   │   ├── models/           # Database models (empty - ready for Day 5)
│   │   ├── routes/           # API routes (empty - ready for Day 5)
│   │   ├── services/         # Business logic (empty - ready for Day 5)
│   │   ├── utils/            # Utility functions (empty - ready for Day 5)
│   │   ├── app.js           # Express application setup
│   │   └── server.js        # Server entry point
│   ├── formatting/          # Linting & formatting configs
│   ├── .env                 # Environment variables (not in git)
│   ├── .env.example        # Environment template
│   └── package.json        # Node dependencies & scripts
├── client/                  # Frontend (placeholder for Phase 5)
├── docker-compose.yml      # PostgreSQL & Redis containers
├── start-docker.bat        # Quick start script
├── stop-docker.bat         # Quick stop script
└── README.MD              # This file
```

#### Installed Dependencies
**Core Backend:**
- `express` - Web framework
- `socket.io` - Real-time communication (will use in Week 3)
- `pg` - PostgreSQL client
- `redis` - Redis client
- `bcryptjs` - Password hashing (will use in Days 5-7)
- `jsonwebtoken` - JWT authentication (will use in Days 5-7)
- `dotenv` - Environment variables
- `cors` - CORS middleware
- `helmet` - Security headers

**Development:**
- `nodemon` - Auto-restart on file changes
- `eslint` - Code linting
- `prettier` - Code formatting
- `globals` - ESLint globals

#### Environment Configuration
The `.env` file has been configured with all necessary settings. See `.env.example` for the template.

#### Basic Express Server
**Features:**
- Express app with security middleware (helmet, cors)
- JSON body parsing
- Health check endpoint: `GET http://localhost:3000/health`
- Global error handling
- Clean logging without emojis
- Ready for route mounting (TODOs in place)

**Test it:**
```bash
cd server
npm run dev
# Visit http://localhost:3000/health
```

---

### **Day 3-4: Database Layer & Migrations**

#### Docker Services (PostgreSQL 15 & Redis 7)
**docker-compose.yml** provides:
- **PostgreSQL 15 Alpine** on port 5432
  - Database: `chatterbox` (auto-created)
  - Credentials configured via environment variables
  - TODO: Move to .env file for security
- **Redis 7 Alpine** on port 6379
  - No password (development only)
  - TODO: Add password for production

**Helper Scripts:**
- `start-docker.bat` - Starts both services
- `stop-docker.bat` - Stops both services

#### Database Configuration Layer

**File: [server/src/config/database.js](server/src/config/database.js)**
- PostgreSQL connection pool using `pg`
- Exported functions:
  - `pool` - Direct pool access
  - `query(text, params)` - Execute queries with timing logs
  - `getClient()` - Get client for transactions
  - `testConnection()` - Verify database connectivity
  - `closePool()` - Graceful shutdown

**File: [server/src/config/redis.js](server/src/config/redis.js)**
- Redis client with reconnection strategy
- Exported functions:
  - `connectRedis()` - Initialize connection
  - `testConnection()` - Verify Redis connectivity
  - `closeRedis()` - Graceful shutdown
  - `set(key, value, expiry)` - Store key-value pairs
  - `get(key)` - Retrieve values
  - `del(key)` - Delete keys
  - `exists(key)` - Check key existence
  - `expire(key, seconds)` - Set expiration
- TODO: Add REDIS_URL for authentication/TLS in production

#### Migration System

**File: [server/src/database/migrate.js](server/src/database/migrate.js)**
- Tracks applied migrations in `schema_migrations` table
- Loads `.sql` files from `server/src/database/migrations/`
- Runs migrations in alphabetical order
- Each migration wrapped in a transaction
- Supports two commands:
  - `npm run migrate` - Apply pending migrations
  - `npm run migrate:status` - Show migration status

#### Database Schema (Implemented)

**Migration: [001_create_users_table.sql](server/src/database/migrations/001_create_users_table.sql)**
```sql
users (
    id UUID PRIMARY KEY (auto-generated)
    username VARCHAR(50) UNIQUE NOT NULL
    email VARCHAR(255) UNIQUE NOT NULL
    phone_number VARCHAR(20) UNIQUE (optional)
    password_hash VARCHAR(255) NOT NULL
    display_name VARCHAR(100)
    bio TEXT
    avatar_url VARCHAR(500)
    status VARCHAR(20) DEFAULT 'offline'  -- online, offline, away, busy
    last_seen TIMESTAMP
    created_at TIMESTAMP DEFAULT NOW()
    updated_at TIMESTAMP DEFAULT NOW()
    is_active BOOLEAN DEFAULT TRUE
    email_verified BOOLEAN DEFAULT FALSE
    phone_verified BOOLEAN DEFAULT FALSE
)
```
**Features:**
- UUID primary keys
- Unique constraints on username, email, phone
- Profile fields (display_name, bio, avatar_url)
- Presence tracking (status, last_seen)
- Account flags (is_active, email_verified, phone_verified)
- Auto-updating `updated_at` trigger
- Indexes on email, username, phone, status, is_active, created_at

**Migration: [002_create_sessions_table.sql](server/src/database/migrations/002_create_sessions_table.sql)**
```sql
sessions (
    id UUID PRIMARY KEY (auto-generated)
    user_id UUID REFERENCES users(id) ON DELETE CASCADE
    refresh_token VARCHAR(500) UNIQUE NOT NULL
    device_info TEXT
    created_at TIMESTAMP DEFAULT NOW()
    expires_at TIMESTAMP NOT NULL
    last_used_at TIMESTAMP DEFAULT NOW()
    is_active BOOLEAN DEFAULT TRUE
)
```
**Features:**
- Stores JWT refresh tokens
- Tracks device information
- Automatic cleanup of expired sessions (trigger)
- Auto-updates `last_used_at` on token usage
- Indexes for fast lookups by user, token, expiry

#### Database Testing
**File: [server/src/database/test-connection.js](server/src/database/test-connection.js)**
- Tests PostgreSQL connection
- Tests Redis connection
- Exits with success/failure code
- Usage: `npm run db:test`

---

## What's Next: Days 5-7 (Authentication System)

### **Goal:** Build complete JWT-based authentication

### Tasks to Complete:

#### 1. Password Hashing Utilities
**Create:** `server/src/utils/bcrypt.js`
```javascript
// Functions needed:
- hashPassword(password) -> hash
- comparePassword(password, hash) -> boolean
```

#### 2. JWT Token Utilities
**Create:** `server/src/utils/jwt.js`
```javascript
// Functions needed:
- generateAccessToken(payload) -> token (15 min expiry)
- generateRefreshToken(payload) -> token (7 day expiry)
- verifyToken(token) -> payload or error
```

#### 3. Authentication Middleware
**Create:** `server/src/middleware/auth.js`
```javascript
// Middleware needed:
- requireAuth(req, res, next) -> verifies JWT, adds user to req.user
```

#### 4. Input Validation Middleware
**Create:** `server/src/middleware/validation.js`
```javascript
// Validators needed:
- validateRegistration(req, res, next)
- validateLogin(req, res, next)
```

#### 5. Authentication Controller
**Create:** `server/src/controllers/authController.js`
```javascript
// Controller functions:
- register(req, res) -> { user, accessToken, refreshToken }
- login(req, res) -> { user, accessToken, refreshToken }
- logout(req, res) -> { message }
- refreshToken(req, res) -> { accessToken }
```

#### 6. Authentication Routes
**Create:** `server/src/routes/auth.routes.js`
```javascript
// Routes:
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout (protected)
POST /api/auth/refresh
```

**Update:** [server/src/app.js](server/src/app.js#L32)
```javascript
// Mount routes:
app.use('/api/auth', authRoutes);
```

### Testing Checklist (Day 7)
- [ ] Register new user -> returns tokens
- [ ] Login with credentials -> returns tokens
- [ ] Access protected route with valid token -> success
- [ ] Access protected route with invalid token -> 401 error
- [ ] Access protected route with expired token -> 401 error
- [ ] Refresh access token -> returns new access token
- [ ] Logout -> invalidates refresh token
- [ ] Try duplicate username -> 400 error
- [ ] Try duplicate email -> 400 error

---

## Code TODOs (In-Code Markers)

### Current TODOs in Codebase:

**[server/src/app.js:32](server/src/app.js#L32)**
```javascript
// TODO: Add API routes here (Phase 1, Week 1)
// Will add:
// - app.use('/api/auth', authRoutes);
// - app.use('/api/users', userRoutes);  (Week 2)
// - app.use('/api/contacts', contactRoutes);  (Week 7)
// - app.use('/api/conversations', conversationRoutes);  (Week 3)
// - app.use('/api/messages', messageRoutes);  (Week 4)
```

**[server/src/server.js:6](server/src/server.js#L6)**
```javascript
// TODO: Add Socket.io server initialization (Phase 2, Week 3)
// Will add:
// - const io = require('socket.io')(httpServer);
// - Redis adapter configuration
// - Socket event handlers
```

**[docker-compose.yml](docker-compose.yml)**
```yaml
# TODO: Move database credentials to .env file for security
# TODO: Add Redis password (requirepass) for production
```

**[server/src/config/redis.js](server/src/config/redis.js)**
```javascript
// TODO: Configure REDIS_URL for authentication and TLS in production
```

---

## Implementation Roadmap Overview

### **PHASE 1: Foundation (Weeks 1-2) - 14 hours**
- [x] Week 1, Days 1-2: Project Setup (2 hours) - COMPLETE
- [x] Week 1, Days 3-4: Database Schema (2 hours) - COMPLETE
- [ ] Week 1, Days 5-7: Authentication System (3 hours) - NEXT
- [ ] Week 2, Days 1-2: User Profile CRUD (2 hours)
- [ ] Week 2, Days 3-4: User Search (2 hours)
- [ ] Week 2, Days 5-7: Avatar Upload (3 hours)

### **PHASE 2: Real-Time Core (Weeks 3-4) - 14 hours**
- Week 3: Socket.io setup & presence system
- Week 4: Basic 1-on-1 messaging

### **PHASE 3: Enhanced Messaging (Weeks 5-6) - 14 hours**
- Week 5: Message editing, deletion, read receipts
- Week 6: Typing indicators

### **PHASE 4: Contact System (Weeks 7-8) - 14 hours**
- Week 7: Contact CRUD & friend requests
- Week 8: Block/favorite features

### **PHASE 5: Frontend Development (Weeks 9-12) - 28 hours**
- Weeks 9-10: React setup, auth UI, chat UI
- Weeks 11-12: Real-time features, presence, contacts

### **PHASE 6: Polish & Production (Weeks 13-16) - 28 hours**
- Week 13: File attachments
- Week 14: Optimization (caching, indexing)
- Week 15: Security & testing
- Week 16: Deployment (Docker, CI/CD, monitoring)

---

## Technology Stack

### **Backend (Implemented)**
- [x] Node.js v18+ (Runtime)
- [x] Express.js v4.18+ (REST API)
- [x] PostgreSQL 15 (Database)
- [x] Redis 7 (Caching & pub/sub)
- [x] Docker & Docker Compose (Containerization)
- [ ] Socket.io v4.6+ (Will use in Week 3)
- [ ] JWT (jsonwebtoken) (Will use in Days 5-7)
- [ ] Bcrypt (bcryptjs) (Will use in Days 5-7)

### **Frontend (Coming in Phase 5)**
- React v18
- Redux Toolkit
- Socket.io Client
- Material-UI v5
- Axios

### **Development Tools (Configured)**
- [x] ESLint (Code linting)
- [x] Prettier (Code formatting)
- [x] Nodemon (Auto-restart)

---

## How to Find Things

### Find TODO Comments
```bash
# Search all TODOs in codebase
grep -r "TODO:" server/src/

# In VS Code:
Ctrl+Shift+F -> search for "TODO:"
```

### Project File Locations
```
Created:
server/src/app.js                          # Express setup
server/src/server.js                       # Server entry point
server/src/config/database.js              # PostgreSQL config
server/src/config/redis.js                 # Redis config
server/src/database/migrate.js             # Migration runner
server/src/database/test-connection.js     # DB test script
server/src/database/migrations/001_*.sql   # Users table
server/src/database/migrations/002_*.sql   # Sessions table
server/formatting/eslint.config.js         # ESLint config
server/formatting/.prettierrc              # Prettier config
server/package.json                        # Dependencies & scripts
server/.env                                # Environment variables
docker-compose.yml                         # PostgreSQL & Redis

Empty (Ready for Days 5-7):
server/src/controllers/
server/src/middleware/
server/src/models/
server/src/routes/
server/src/services/
server/src/utils/
```

---

## Full Project Documentation

For the complete project specification including:
- Complete database schema (all tables)
- Full API endpoint documentation
- Socket.io event specifications
- System architecture diagrams
- Security considerations
- Performance optimization strategies
- Deployment guides

Please see: [.claude/instructions.md](.claude/instructions.md)

---

## Getting Started (New Developer)

### Prerequisites
- Node.js v18+
- Docker Desktop (for PostgreSQL & Redis)
- Git
- Code editor (VS Code recommended)

### First Time Setup
```bash
# 1. Clone repository
git clone <your-repo-url>
cd ChatterBox

# 2. Install server dependencies
cd server
npm install

# 3. Create environment file
cp .env.example .env
# Edit .env with your settings

# 4. Start database services
cd ..
./start-docker.bat  # Windows
# OR
docker-compose up -d  # Mac/Linux

# 5. Test database connections
cd server
npm run db:test

# 6. Run migrations
npm run migrate

# 7. Start development server
npm run dev
# Server should start on http://localhost:3000

# 8. Test health endpoint
# Visit http://localhost:3000/health
```

### Daily Workflow
```bash
# Start services
./start-docker.bat

# Start dev server
cd server
npm run dev

# When done for the day
./stop-docker.bat
```

---

## Troubleshooting

### Port Already in Use
```bash
# PostgreSQL (5432) or Redis (6379) or Server (3000)
# Windows:
netstat -ano | findstr :5432
netstat -ano | findstr :6379
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Mac/Linux:
lsof -ti:5432 | xargs kill
lsof -ti:6379 | xargs kill
lsof -ti:3000 | xargs kill
```

### Docker Issues
```bash
# Check if containers are running
docker ps

# View container logs
docker logs chatterbox-postgres
docker logs chatterbox-redis

# Restart containers
docker-compose restart

# Complete reset (WARNING: deletes data)
docker-compose down -v
docker-compose up -d
```

### Migration Issues
```bash
# Check migration status
npm run migrate:status

# If migrations are stuck, manually reset (development only)
# Connect to PostgreSQL:
docker exec -it chatterbox-postgres psql -U postgres -d chatterbox

# Drop migrations table:
DROP TABLE IF EXISTS schema_migrations CASCADE;

# Exit psql:
\q

# Re-run migrations:
npm run migrate
```

---

## Current Statistics

- **Lines of Code (Backend):** ~500 lines
- **Database Tables:** 2 (users, sessions)
- **Migrations:** 2 applied
- **Dependencies:** 11 production, 4 dev
- **API Endpoints:** 1 (health check)
- **Test Coverage:** Not yet implemented
- **Completion:** 50% of PHASE 1 (Days 1-4 of Week 1)

---

## Immediate Next Steps

1. **Start Day 5:** Create password hashing utilities (`server/src/utils/bcrypt.js`)
2. **Day 6:** Create JWT utilities and auth middleware
3. **Day 7:** Build registration and login endpoints

### Ready to Code?
```bash
# Start here:
cd server/src/utils
# Create bcrypt.js and jwt.js

cd ../middleware
# Create auth.js and validation.js

cd ../controllers
# Create authController.js

cd ../routes
# Create auth.routes.js
```

---

## Git Commit History (Recent)
```
3d34668 - Update database connection configuration and enhance migration status checks
ed6d7d2 - Added TODO comments (docker-compose.yml, redis.js)
177527c - Add database initialization and migration scripts
f607252 - Add database migration script
a84dfb4 - Refactor server startup logs for improved readability
```

---

## License

MIT License - Free for learning and portfolio projects!

---

**Project Started:** November 2024
**Last Updated:** December 2024
**Status:** Active Development - PHASE 1 (Days 5-7 Next)

---

**Built by Yash Swaminathan**
*Daily 1-hour coding sessions - Building a complete messaging platform from scratch*
