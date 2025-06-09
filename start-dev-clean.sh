#!/bin/bash

echo "🧹 Cleaning up existing processes..."

# Kill any existing processes on our ports
sudo lsof -ti:3000 | xargs sudo kill -9 2>/dev/null || true
sudo lsof -ti:4000 | xargs sudo kill -9 2>/dev/null || true
sudo lsof -ti:5000 | xargs sudo kill -9 2>/dev/null || true
sudo lsof -ti:5001 | xargs sudo kill -9 2>/dev/null || true

# Kill any node processes that might be hanging
pkill -f "next dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Wait a moment for processes to fully terminate
sleep 2

echo "✅ Cleanup complete!"
echo "🚀 Starting development servers..."

# Start the development servers with concurrently
npm run dev