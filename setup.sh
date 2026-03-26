#!/bin/bash

set -e

echo "🚀 Starting GitHub Starred Repositories Application"

echo ""
echo "📋 Prerequisites:"
echo "  - Go 1.21 or later"
echo "  - Node.js 18 or later"
echo "  - GitHub Personal Access Token (optional, for higher rate limits)"

echo ""
echo "🔧 Setting up environment..."

if [ ! -f ".env" ]; then
    echo "Creating .env file..."
    cat > .env << EOL
GITHUB_TOKEN=your_github_token_here
NEXT_PUBLIC_API_URL=http://localhost:8090
EOL
    echo "Please edit .env file with your GitHub token"
fi

echo ""
echo "📦 Installing dependencies..."

if [ ! -d "backend/pb_data" ]; then
    echo "Creating PocketBase data directory..."
    mkdir -p backend/pb_data
fi

cd backend
if [ ! -f "go.sum" ]; then
    echo "Downloading Go dependencies..."
    go mod download
fi
cd ..

cd frontend
if [ ! -d "node_modules" ]; then
    echo "Installing npm dependencies..."
    npm install
fi
cd ..

echo ""
echo "✅ Setup completed!"
echo ""
echo "🚀 To start the application:"
echo "  1. Backend: cd backend && ./github-collector serve"
echo "  2. Frontend: cd frontend && npm run dev"
echo ""
echo "📚 API Documentation: See API.md"
echo "🌐 Frontend will be available at: http://localhost:3000"
echo "🔧 Backend API will be available at: http://localhost:8090"
