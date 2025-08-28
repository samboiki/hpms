#!/bin/bash

# Persistent Vite Development Server Script
# This script ensures the dev server stays alive and auto-restarts on crashes

PROJECT_DIR="/home/happy/projects/hpms"
PORT=5173
MAX_RETRIES=10
RETRY_COUNT=0

echo "🚀 Starting persistent Vite development server..."
echo "📁 Project: $PROJECT_DIR"
echo "🌐 Port: $PORT"
echo "🔄 Auto-restart enabled"

cd "$PROJECT_DIR"

# Function to check if port is in use
check_port() {
    lsof -i :$PORT > /dev/null 2>&1
}

# Function to kill existing processes
cleanup() {
    echo "🧹 Cleaning up existing processes..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "node.*vite" 2>/dev/null || true
    sleep 2
}

# Function to start the server
start_server() {
    echo "🎯 Starting Vite server (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)..."
    
    # Start vite in background and capture PID
    npm run dev &
    SERVER_PID=$!
    
    # Wait a moment for server to start
    sleep 3
    
    # Check if server is running
    if kill -0 $SERVER_PID 2>/dev/null; then
        echo "✅ Server started successfully (PID: $SERVER_PID)"
        return 0
    else
        echo "❌ Server failed to start"
        return 1
    fi
}

# Function to monitor server health
monitor_server() {
    while true; do
        if ! kill -0 $SERVER_PID 2>/dev/null; then
            echo "💀 Server died! Attempting restart..."
            return 1
        fi
        
        # Check if port is still accessible
        if ! check_port; then
            echo "🔌 Port $PORT no longer accessible! Restarting..."
            kill $SERVER_PID 2>/dev/null || true
            return 1
        fi
        
        sleep 5
    done
}

# Main execution loop
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    cleanup
    
    if start_server; then
        echo "🎉 Server is running at http://localhost:$PORT"
        echo "📝 Logs will appear below. Press Ctrl+C to stop."
        echo "----------------------------------------"
        
        # Monitor the server
        if monitor_server; then
            echo "✨ Server is running smoothly!"
            break
        fi
    fi
    
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo "🔄 Retrying in 3 seconds... ($RETRY_COUNT/$MAX_RETRIES)"
    sleep 3
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "❌ Failed to start server after $MAX_RETRIES attempts"
    echo "🔧 Please check your configuration and try again"
    exit 1
fi

# Keep the script running
wait $SERVER_PID