# Deploying ChatterBox

One Docker image serves the React app, the API and the WebSocket from a single origin. It needs PostgreSQL and Redis. Object storage (MinIO/S3) is optional and only backs avatar uploads.

On start the container applies pending database migrations, then starts the server.

## Environment variables

| Variable | Required | Value |
|---|---|---|
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `REDIS_URL` | yes | Redis connection string |
| `JWT_ACCESS_SECRET` | yes | Long random string (`openssl rand -hex 32`) |
| `JWT_REFRESH_SECRET` | yes | A different long random string |
| `APP_URL` | yes | Public URL of the site, e.g. `https://chat.example.com`. Used in email links |
| `CLIENT_URL` | yes | Same value as `APP_URL` |
| `OWNER_USER_ID` | after first login | Your user ID (see step 5) |
| `OWNER_ONLY_MODE` | yes | `true`: visitors can only see and message the owner |
| `NTFY_TOPIC` | for push | A hard-to-guess topic name; anyone who knows it can read your notifications |
| `RESEND_API_KEY` | for email | API key from resend.com |
| `EMAIL_FROM` | for email | A sender on a domain verified in Resend, e.g. `ChatterBox <chat@example.com>` |
| `OWNER_EMAIL` | for email | Where your notifications are sent |
| `DB_SSL` | no | `true` if the database is reached over the public internet |
| `NODE_ENV` | no | The image sets `production` |
| `PORT` | no | Set by the platform; defaults to 3000 |

Without `NTFY_TOPIC` pushes are skipped, and without `RESEND_API_KEY` + `EMAIL_FROM` emails are skipped (including password reset emails). Nothing else is affected.

## Railway

1. **New Project → Deploy from GitHub repo** and pick this repository. Railway finds the `Dockerfile` at the repository root.
2. In the project, **New → Database → PostgreSQL**, then **New → Database → Redis**.
3. On the app service, open **Variables** and add the table above. For the two connection strings use references so they follow the databases: `DATABASE_URL=${{Postgres.DATABASE_URL}}` and `REDIS_URL=${{Redis.REDIS_URL}}`. Leave `OWNER_USER_ID` out for now.
4. On the app service, **Settings → Networking → Generate Domain**. Put that URL in `APP_URL` and `CLIENT_URL`, and let it redeploy. HTTPS is provided.
5. Open the site and register your own account. Then find your user ID: in the browser's developer tools go to **Application → Local Storage**, open `chatterbox_user`, and copy `id`. Set `OWNER_USER_ID` to it and let the service redeploy.
6. Install the **ntfy** app on your phone and subscribe to the topic you chose for `NTFY_TOPIC`.

From then on every new signup lands in a conversation with you.

## Check it works

In a private browser window, ideally on your phone:

1. Register a new account. You should land in a chat with the owner.
2. Send a message. The owner's phone should get a push, and the owner's inbox an email.
3. As the owner, reply while the visitor's tab is closed. The visitor should get an email.
4. On the login page use **Forgot password?** and complete the reset from the email.

## Run the image locally

```bash
docker build -t chatterbox .
docker run --rm -p 3000:3000 \
  -e DATABASE_URL=postgres://postgres:<password>@host.docker.internal:5432/chatterbox \
  -e REDIS_URL=redis://host.docker.internal:6379 \
  -e JWT_ACCESS_SECRET=<random> -e JWT_REFRESH_SECRET=<random> \
  -e APP_URL=http://localhost:3000 -e CLIENT_URL=http://localhost:3000 \
  chatterbox
```

## Notes

- **One instance only.** Message rate limits, the "is this user connected" check behind notifications, and the reminder sweep all assume a single server process.
- **Rate limits use the client IP** from the platform's proxy header (`trust proxy` is 1 in production). If the app sits behind more than one proxy, set `TRUST_PROXY` to the number of proxies.
- **Migrations** live in `server/src/database/migrations` and run in filename order. Files ending in `_rollback.sql` are skipped.
