# ChatterBox

A real-time messaging app. Anyone who signs up lands in a live chat with me, and I get notified when they write.

**Live: https://chat.yashswaminathan.com**

## What it does

- **Real-time chat.** Messages are delivered over WebSockets, with optimistic sending, retry on failure, unread counts, and an online indicator.
- **A conversation with the owner from the start.** Signing up creates a direct conversation with the site owner, so a visitor never sees an empty app.
- **Private by default.** Visitors cannot search for or browse each other. Two visitors can only talk after one sends a request to the other's exact username and it is accepted. Other users' email addresses are never returned by the API.
- **Notifications both ways.** The owner gets an email (and optionally a phone push) when a visitor writes, plus a reminder if a message goes unanswered for 90 minutes. Visitors can choose at signup to get an email when the owner replies while they are away, and every email has an unsubscribe link.
- **Accounts.** Registration, login, short-lived access tokens with rotating refresh tokens, and password reset by emailed single-use link.
- **Works on a phone.** One pane at a time with a back button on small screens.

The server also has APIs for group conversations, contacts and blocking, message editing and deletion, read receipts, and full-text message search. These are tested but do not have a UI yet.

## Tech stack

| Layer | Tools |
|---|---|
| Server | Node.js, Express 5, Socket.io (Redis adapter) |
| Data | PostgreSQL, Redis (presence, caching, rate limits, reminders) |
| Client | React 19, Vite, React Router, Axios, socket.io-client |
| Auth | JWT (15-minute access token, 7-day refresh token), bcrypt |
| Notifications | Resend (email), ntfy (push) |
| Hosting | One Docker image on Railway serving the client, API and WebSocket from a single origin |
| Tests | Jest and Supertest (about 800 server tests), k6 load scripts |

## Project structure

```
ChatterBox/
├── client/                 React app
│   └── src/
│       ├── api/            HTTP calls
│       ├── components/     auth, chat, common UI
│       ├── contexts/       auth, socket and chat state
│       ├── hooks/
│       ├── pages/
│       └── styles/
├── server/
│   └── src/
│       ├── config/         database, Redis, storage
│       ├── controllers/
│       ├── database/       migration runner and SQL migrations
│       ├── middleware/     auth, validation, rate limits, owner-only rules
│       ├── models/
│       ├── routes/
│       ├── services/       notifications, presence, caching, owner logic
│       ├── socket/         Socket.io setup and event handlers
│       ├── app.js
│       └── server.js
├── docker-compose.yml      local PostgreSQL, Redis and MinIO
├── Dockerfile              production image
└── DEPLOY.md               deployment guide
```

## Run it locally

You need Node.js (the production image uses version 22) and Docker.

**1. Start the databases**

```bash
docker-compose up -d
```

**2. Configure the server.** Create `server/.env`:

```
DB_PASSWORD=password123
JWT_ACCESS_SECRET=<any long random string>
JWT_REFRESH_SECRET=<a different long random string>
```

`DB_PASSWORD` matches the local database in `docker-compose.yml`. Everything else has a local default.

**3. Install, migrate and start the server**

```bash
cd server
npm install
npm run migrate
npm run dev          # http://localhost:3000
```

**4. Start the client** in a second terminal

```bash
cd client
npm install
npm run dev          # http://localhost:5173
```

Open http://localhost:5173 and register an account.

### Try owner-only mode locally

1. Register the account that will be the owner.
2. Copy its `id` from the browser's Local Storage (`chatterbox_user`).
3. Add these to `server/.env` and restart the server:

   ```
   OWNER_USER_ID=<that id>
   OWNER_ONLY_MODE=true
   ```

4. Register a second account in a private window. It lands in a chat with the owner.

Without email configured, password reset links are written to the server log in development.

## Environment variables

Only the three in step 2 are needed locally. The rest are optional or for production; `DEPLOY.md` has the full table.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Used instead of the `DB_*` variables when set |
| `REDIS_URL` | Redis connection string. Defaults to `redis://localhost:6379` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | Token signing secrets. The server will not start without them |
| `CLIENT_URL` | Allowed browser origin. Defaults to `http://localhost:5173` |
| `APP_URL` | Public address, used for links in emails |
| `OWNER_USER_ID`, `OWNER_ONLY_MODE` | Who the owner is, and whether visitors are limited to talking to the owner |
| `RESEND_API_KEY`, `EMAIL_FROM`, `OWNER_EMAIL` | Email sending. Emails are skipped when unset |
| `NTFY_TOPIC` | Push notifications to the owner's phone. Skipped when unset |
| `VITE_API_URL` (client) | API address. Defaults to `http://localhost:3000` in development and the same origin in production |

## Scripts

Run from `server/`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the server with auto-restart |
| `npm start` | Start the server |
| `npm test` | Run the test suite (needs the local PostgreSQL running and migrated) |
| `npm run migrate` | Apply pending database migrations |
| `npm run migrate:status` | Show which migrations have been applied |
| `npm run lint` / `npm run format` | ESLint and Prettier |

Run from `client/`:

| Command | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Build the production bundle |
| `npm run lint` | ESLint |

## API overview

All routes are under `/api` and, apart from the auth routes, need an access token.

| Area | Routes |
|---|---|
| Auth | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`; `GET /auth/me` |
| Users | `GET/PUT /users/me`, `GET /users/search`, `GET /users/:id`, avatar upload, privacy settings |
| Conversations | `GET /conversations`, `POST /conversations/direct`, `POST /conversations/group`, participants and group settings |
| Messages | `GET /messages/conversations/:id`, `GET /messages/unread`, `GET /messages/search`, `PUT/DELETE /messages/:id` |
| Contacts | `GET/POST /contacts`, update, delete, block, unblock |
| Connection requests | `POST /contact-requests` (exact username), `GET /contact-requests`, accept, reject |

Real-time events (Socket.io): `message:send`, `message:new`, `message:sent`, `message:edit`, `message:delete`, `message:delivered`, `message:read`, `presence:update`, `presence:changed`, `conversation:new`, `contact-request:received`, `contact-request:accepted`, and `heartbeat`.

## Continuous integration

Every pull request runs the database migrations and the full server test suite against PostgreSQL and Redis, and builds the client ([`.github/workflows/ci.yml`](.github/workflows/ci.yml)).

## Deployment

The production image builds the client, serves it alongside the API, and applies database migrations on start. See [`DEPLOY.md`](DEPLOY.md) for the environment variables, the Railway steps, and a smoke test.

## What's next

- UI for group conversations, typing indicators and read receipts
- Moving the refresh token to an httpOnly cookie

## License

MIT

---

Built by Yash Swaminathan
