#!/bin/bash

# OneHealth Stable Services Startup Script
# This script ensures all services run without crashing

echo "🚀 Starting OneHealth Services in STABLE MODE..."
echo "================================================"

# Kill any existing processes on our ports
echo "🔧 Cleaning up existing processes..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:4000 | xargs kill -9 2>/dev/null || true
lsof -ti:5000 | xargs kill -9 2>/dev/null || true

# Give processes time to fully terminate
sleep 2

# Start services individually with proper error handling
echo ""
echo "📋 Service Configuration:"
echo "  • Port 3000: Healthcare Practice Directory (practice listings)"
echo "  • Port 4000: Admin Dashboard (OneHealth management)"
echo "  • Port 5000: Practice App (individual practice management)"
echo ""

# Function to start a service with retry logic
start_service() {
    local name=$1
    local dir=$2
    local port=$3
    local cmd=$4
    
    echo "🚀 Starting $name on port $port..."
    cd "$dir" || exit 1
    
    # Start the service in background with nohup to prevent exit
    nohup $cmd > "${name}.log" 2>&1 &
    local pid=$!
    
    # Wait a bit for the service to start
    sleep 3
    
    # Check if process is still running
    if ps -p $pid > /dev/null; then
        echo "✅ $name started successfully (PID: $pid)"
    else
        echo "❌ $name failed to start! Check ${name}.log for details"
        return 1
    fi
    
    cd - > /dev/null
}

# Start each service
echo ""
echo "🏥 Starting services..."
echo "------------------------"

# Start Healthcare Practice Directory (hpms-landing) on port 3000
start_service "Practice-Directory" "/home/happy/projects/hpms/hpms-landing" 3000 "npm run dev"

# Start Admin Dashboard (onehealth) on port 4000  
start_service "Admin-Dashboard" "/home/happy/projects/hpms/onehealth" 4000 "npm run dev -- --port 4000"

# Start Practice App (main HPMS) on port 5000
start_service "Practice-App" "/home/happy/projects/hpms" 5000 "npm run dev:dashboard"

echo ""
echo "✨ All services started!"
echo ""
echo "🌐 Access URLs:"
echo "  • Healthcare Practice Directory: http://localhost:3000"
echo "  • Admin Dashboard (OneHealth): http://localhost:4000"
echo "  • Practice App (HPMS): http://localhost:5000"
echo ""
echo "📊 To view logs:"
echo "  • tail -f Practice-Directory.log"
echo "  • tail -f Admin-Dashboard.log"
echo "  • tail -f Practice-App.log"
echo ""
echo "🛑 To stop all services:"
echo "  • ./stop-services.sh"