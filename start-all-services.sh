#!/bin/bash

# ROBUST SERVICE STARTER FOR HPMS
# This script ensures all services run on the correct ports with proper mapping
# 
# Port mappings:
# - localhost:3000 -> Marketing/Landing page (onehealthsystems.com)
# - localhost:4000 -> Admin dashboard (admin.onehealthsystems.com)  
# - localhost:5000 -> Practice app (app.onehealthsystems.com)

echo "🚀 Starting HPMS Services with correct port mappings..."
echo "=================================================="
echo "📍 Port Mappings:"
echo "   localhost:3000 -> Marketing/Landing page (onehealthsystems.com)"
echo "   localhost:4000 -> Admin dashboard (admin.onehealthsystems.com)"
echo "   localhost:5000 -> Practice app (app.onehealthsystems.com)"
echo "=================================================="

# Kill any existing processes on our ports
echo "🧹 Cleaning up existing processes..."
for port in 3000 4000 5000; do
    if lsof -ti:$port > /dev/null 2>&1; then
        echo "   Killing process on port $port..."
        kill -9 $(lsof -ti:$port) 2>/dev/null
    fi
done

# Wait a moment for ports to be released
sleep 2

# Start services with correct port mappings
echo "🚀 Starting services..."

# Use the corrected npm run dev command
npm run dev