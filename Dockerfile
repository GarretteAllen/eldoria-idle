FROM node:22-alpine AS builder

# Install build dependencies for native C++ addons (better-sqlite3)
RUN apk add --no-cache python3 make g++

WORKDIR /app

# Copy root configurations and workspace definitions
COPY package*.json ./
COPY tsconfig.base.json ./
COPY packages/shared/package*.json ./packages/shared/
COPY packages/server/package*.json ./packages/server/
COPY packages/client/package*.json ./packages/client/

# Install all dependencies across workspaces and compile native bindings
RUN npm install

# Copy source code
COPY packages/shared ./packages/shared
COPY packages/client ./packages/client
COPY packages/server ./packages/server

# Build all packages (shared -> client -> server)
RUN npm run build

# --- Production Runner ---
FROM node:22-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Copy built artifacts and compiled node_modules directly from builder
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/shared/package*.json ./packages/shared/
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/packages/server/package*.json ./packages/server/
COPY --from=builder /app/packages/server/dist ./packages/server/dist
COPY --from=builder /app/packages/client/dist ./packages/client/dist

# Persistent data directory for player saves and SQLite database
RUN mkdir -p /app/data
VOLUME /app/data

EXPOSE 3000

CMD ["node", "packages/server/dist/index.js"]
