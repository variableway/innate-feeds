#!/bin/bash

set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"

# Start both backend and frontend dev servers

echo "🚀 Starting Innate Feeds development servers..."
echo ""

if [ ! -d "$ROOT/backend/node_modules" ]; then
  echo "📦 Installing backend dependencies..."
  (cd "$ROOT/backend" && bun install)
fi

if [ ! -d "$ROOT/frontend/node_modules" ]; then
  echo "📦 Installing frontend dependencies..."
  (cd "$ROOT/frontend" && bun install)
fi

# Start backend in background
echo "📡 Starting backend on port 4000..."
(cd "$ROOT/backend" && bun run dev) &
BACKEND_PID=$!

# Wait for backend to accept connections
echo "⏳ Waiting for backend..."
READY=0
for _ in $(seq 1 30); do
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "❌ Backend exited before becoming ready."
    echo "   Try: cd backend && bun install && bun run dev"
    exit 1
  fi
  if curl -sf "http://localhost:4000/api/feeds/stats" > /dev/null 2>&1; then
    READY=1
    break
  fi
  sleep 1
done

if [ "$READY" -ne 1 ]; then
  echo "❌ Backend did not become ready within 30s."
  kill "$BACKEND_PID" 2>/dev/null || true
  exit 1
fi

echo "✅ Backend ready"

# Start frontend
echo "🎨 Starting frontend on port 3000..."
(cd "$ROOT/frontend" && bun run dev) &
FRONTEND_PID=$!

echo ""
echo "✅ Both servers starting..."
echo "   Backend:  http://localhost:4000"
echo "   Frontend: http://localhost:3000"
echo ""
echo "Press Ctrl+C to stop both servers"

# Handle Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

# Wait for both processes
wait
