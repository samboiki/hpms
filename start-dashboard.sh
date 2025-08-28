#!/bin/bash

echo "🏥 Starting HPMS Dashboard Only..."

# Kill any existing processes on port 5000
echo "🧹 Cleaning up port 5000..."
lsof -ti:5000 | xargs kill -9 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 2

# Start only the dashboard
echo "🎯 Starting dashboard on port 5000..."
npm run dev:dashboard