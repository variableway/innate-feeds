#!/bin/bash

set -e

echo "🚀 Building GitHub Starred Repositories Application"

echo ""
echo "📦 Building Backend (PocketBase)"
echo "=================================="

cd backend

if [ ! -f "go.mod" ]; then
    echo "Initializing Go module..."
    go mod init github-collectors
    go mod tidy
fi

echo "Downloading dependencies..."
go mod download

echo "Building backend binary..."
go build -o github-collector .

cd ..

echo ""
echo "🎨 Building Frontend (Next.js)"
echo "==============================="

cd frontend

if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "Building frontend..."
npm run build

cd ..

echo ""
echo "✅ Build completed successfully!"
echo ""
echo "Binaries:"
echo "  - Backend: backend/github-collector"
echo "  - Frontend: frontend/.next/"
