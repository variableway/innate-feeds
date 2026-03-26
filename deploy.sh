#!/bin/bash

set -e

echo "🚀 Deploying GitHub Starred Repositories Application"

BACKEND_PORT=${BACKEND_PORT:-8090}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

echo ""
echo "📦 Building application..."
./build.sh

echo ""
echo "🐳 Creating Docker images..."

if command -v docker &> /dev/null; then
    echo "Building backend Docker image..."
    docker build -t github-starred-backend:latest -f Dockerfile.backend .
    
    echo "Building frontend Docker image..."
    docker build -t github-starred-frontend:latest -f Dockerfile.frontend .
    
    echo ""
    echo "✅ Docker images created!"
    echo ""
    echo "🚀 Starting containers..."
    
    docker network create github-starred-network 2>/dev/null || true
    
    docker run -d \
        --name github-starred-backend \
        --network github-starred-network \
        -p $BACKEND_PORT:8090 \
        -v $(pwd)/backend/pb_data:/app/pb_data \
        -e GITHUB_TOKEN=${GITHUB_TOKEN} \
        github-starred-backend:latest
    
    docker run -d \
        --name github-starred-frontend \
        --network github-starred-network \
        -p $FRONTEND_PORT:3000 \
        -e NEXT_PUBLIC_API_URL=http://localhost:$BACKEND_PORT \
        github-starred-frontend:latest
    
    echo ""
    echo "✅ Deployment completed!"
    echo ""
    echo "🌐 Frontend: http://localhost:$FRONTEND_PORT"
    echo "🔧 Backend API: http://localhost:$BACKEND_PORT"
    echo ""
    echo "To view logs:"
    echo "  Backend: docker logs github-starred-backend"
    echo "  Frontend: docker logs github-starred-frontend"
else
    echo "⚠️  Docker not found. Please install Docker or use the manual deployment method."
    echo ""
    echo "Manual deployment:"
    echo "  1. Backend: cd backend && ./github-collector serve"
    echo "  2. Frontend: cd frontend && npm start"
fi
