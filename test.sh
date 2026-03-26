#!/bin/bash

echo "🧪 Running tests for GitHub Starred Repositories"

echo ""
echo "Backend Tests"
echo "=============="

cd backend

if [ -f "go.mod" ]; then
    echo "Running Go tests..."
    go test -v ./...
else
    echo "No Go tests found"
fi

cd ..

echo ""
echo "Frontend Tests"
echo "==============="

cd frontend

if [ -f "package.json" ]; then
    echo "Running linting..."
    npm run lint || true
    
    echo ""
    echo "Running type checking..."
    npm run type-check || true
else
    echo "No frontend tests found"
fi

cd ..

echo ""
echo "✅ Tests completed!"
