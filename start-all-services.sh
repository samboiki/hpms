#!/bin/bash

# OneHealth Complete System Startup Script (Fixed Version)
# =========================================================
# This script starts all services with proper isolation to prevent
# cross-service file watching issues
#
# Port Architecture:
# - 3000: Practice Landing Pages (Next.js)
# - 4000: OneHealth Admin Dashboard (Next.js) → auto-redirects to /auth/login
# - 5000: HPMS Practice Portal Dashboard (Vite)
# =========================================================

echo "🚀 Starting All HPMS Services (Fixed Version)"
echo "=================================================="
echo ""

# Function to kill processes on a port
kill_port() {
    local port=$1
    echo "   🔄 Clearing port $port..."
    lsof -ti:$port | xargs -r kill -9 2>/dev/null
    sleep 0.5
}

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "next dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
kill_port 3000
kill_port 4000
kill_port 5000
echo "✅ Cleanup complete"
echo ""

# Clean build caches to prevent file watching conflicts
echo "🗑️  Cleaning build caches..."
rm -rf /home/happy/projects/hpms/onehealth/.next/cache 2>/dev/null
rm -rf /home/happy/projects/hpms/hpms-landing/.next/cache 2>/dev/null
echo "✅ Caches cleaned"
echo ""

# Start HPMS Dashboard (Vite) - Practice Portal
echo "🏥 [1/3] Starting HPMS Practice Dashboard on port 5000..."
cd /home/happy/projects/hpms
nohup npm run dev > dashboard.log 2>&1 &
DASH_PID=$!
sleep 2

# Start Practice Landing Pages (Next.js)
echo "🌐 [2/3] Starting Practice Landing Pages on port 3000..."
cd /home/happy/projects/hpms/hpms-landing
nohup npm run dev -- --port 3000 > ../landing.log 2>&1 &
LAND_PID=$!
sleep 2

# Start OneHealth Admin Portal (Next.js)
echo "🎯 [3/3] Starting OneHealth Admin Portal on port 4000..."
echo "         → Will auto-redirect to /auth/login"
cd /home/happy/projects/hpms/onehealth
nohup npm run dev -- --port 4000 > ../admin.log 2>&1 &
ADMIN_PID=$!

# Wait for services to start
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 8

# Check if services are running
echo ""
echo "📊 Service Status:"
ps -p $DASH_PID > /dev/null && echo "   ✅ Practice Dashboard (PID: $DASH_PID)" || echo "   ❌ Practice Dashboard failed to start"
ps -p $LAND_PID > /dev/null && echo "   ✅ Landing Pages (PID: $LAND_PID)" || echo "   ❌ Landing Pages failed to start"
ps -p $ADMIN_PID > /dev/null && echo "   ✅ Admin Portal (PID: $ADMIN_PID)" || echo "   ❌ Admin Portal failed to start"

echo ""
echo "=================================================="
echo "🔗 Quick Access Links:"
echo ""
echo "   🌐 Practice Landing Pages: http://localhost:3000"
echo "      • NewCharm Dental: http://localhost:3000?practice=newcharm-dental"
echo "      • Dr. Polina: http://localhost:3000?practice=dr-polina-aesthetics"
echo ""
echo "   🎯 OneHealth Admin Portal: http://localhost:4000"
echo "      • Auto-redirects to: http://localhost:4000/auth/login"
echo "      • Login: admin@onehealth.local"
echo ""
echo "   🏥 HPMS Practice Dashboard: http://localhost:5000"
echo "      • Login and manage practice operations"
echo ""
echo "=================================================="
echo "📝 Service PIDs: Dashboard=$DASH_PID, Landing=$LAND_PID, Admin=$ADMIN_PID"
echo "📋 Logs: dashboard.log, landing.log, admin.log"
echo "🛑 To stop all: pkill -f 'next dev|vite' or press Ctrl+C"
echo "=================================================="