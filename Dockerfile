# One image serves the React app, the API and the WebSocket from a single origin.

# ---- Build the client
FROM node:22-alpine AS client
WORKDIR /app/client
COPY client/package*.json ./
RUN npm ci
COPY client/ ./
# VITE_API_URL is deliberately unset: the production build talks to its own origin
RUN npm run build

# ---- Run the server
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app/server
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/ ./
COPY --from=client /app/client/dist /app/client/dist

USER node
EXPOSE 3000

# Apply any pending migrations, then start. The platform sets PORT.
CMD ["sh", "-c", "node src/database/migrate.js run && node src/server.js"]
