# ---- Build stage ----
FROM oven/bun:1 AS build

WORKDIR /app

# Copy workspace files
COPY package.json bun.lock ./
COPY backend/package.json ./backend/
COPY frontend/package.json ./frontend/

# Install dependencies
RUN bun install
RUN cd backend && bun install
RUN cd frontend && bun install

# Copy source
COPY . .

# Build frontend
RUN cd frontend && bun run build

# ---- Production stage ----
FROM oven/bun:1-slim AS production

WORKDIR /app

# Copy built frontend
COPY --from=build /app/frontend/dist ./frontend/dist

# Copy backend
COPY --from=build /app/backend/package.json ./backend/package.json
COPY --from=build /app/backend/tsconfig.json ./backend/tsconfig.json
COPY --from=build /app/backend/src ./backend/src
COPY --from=build /app/backend/node_modules ./backend/node_modules

# Copy root node_modules for shared deps
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

ENV NODE_ENV=production
ENV PORT=4000
ENV DB_PATH=/data/feeds.db

# Create data directory for SQLite
RUN mkdir -p /data

EXPOSE 4000

# Start backend server (serves API on :4000)
WORKDIR /app/backend
CMD ["bun", "run", "start"]
