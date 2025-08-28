#!/bin/bash

echo "🚀 Starting HPMS Development Environment..."

# Function to kill process on port
kill_port() {
    local port=$1
    echo "🔧 Checking port $port..."
    lsof -ti:$port | xargs kill -9 2>/dev/null || true
    sleep 1
}

# Function to check if port is free
is_port_free() {
    local port=$1
    ! lsof -i:$port >/dev/null 2>&1
}

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
pkill -f "concurrently" 2>/dev/null || true

# Kill processes on specific ports
kill_port 3000
kill_port 4000
kill_port 5000

# Wait a bit for processes to die
sleep 2

# Check if ports are free
echo "🔍 Checking port availability..."
for port in 3000 4000 5000; do
    if ! is_port_free $port; then
        echo "⚠️  Port $port is still in use, killing forcefully..."
        kill_port $port
        sleep 1
    fi
done

# Start the development servers
echo "🎯 Starting development servers..."
npm run dev

echo "✅ Development environment started!"