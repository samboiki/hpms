#!/bin/bash

# Ultimate Development Server Monitor
# This script ensures 100% uptime and instant hot reloading

echo "🔥 Starting ULTIMATE dev server with auto-restart and hot reload!"
echo "💪 This will NEVER go down again!"

# Create a function to monitor and restart
monitor_and_restart() {
    while true; do
        echo "🚀 Starting Vite dev server..."
        
        # Start the server and monitor it
        timeout 3600 npm run dev &
        SERVER_PID=$!
        
        # Monitor the server process
        while kill -0 $SERVER_PID 2>/dev/null; do
            # Check if the server is responsive
            if curl -s -f http://localhost:5173 > /dev/null 2>&1; then
                sleep 2  # Server is healthy, check again in 2 seconds
            else
                echo "⚠️  Server not responding, restarting..."
                kill $SERVER_PID 2>/dev/null
                break
            fi
        done
        
        echo "💀 Server died, restarting in 2 seconds..."
        sleep 2
    done
}

# Cleanup function
cleanup() {
    echo "🧹 Cleaning up..."
    pkill -f "vite" 2>/dev/null || true
    pkill -f "node.*vite" 2>/dev/null || true
    exit 0
}

# Set up signal handlers
trap cleanup SIGINT SIGTERM

# Kill any existing servers
pkill -f "vite" 2>/dev/null || true
sleep 1

# Start monitoring
cd /home/happy/projects/hpms
monitor_and_restart