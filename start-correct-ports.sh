#!/bin/bash

echo "🚀 Starting OneHealth Services with CORRECT Port Assignments"
echo "============================================================"

# Kill any existing processes
echo "🧹 Cleaning up existing processes..."
pkill -f "next" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 3

echo "📋 Correct Port Assignment:"
echo "  • Port 3000: Healthcare Practice Directory (hpms-landing)"
echo "  • Port 4000: Admin Dashboard (onehealth)"  
echo "  • Port 5000: Practice App (main HPMS)"
echo ""

# Start each service in the background
echo "🚀 Starting Healthcare Practice Directory on port 3000..."
cd /home/happy/projects/hpms/hpms-landing
nohup npm run dev > ../practice-directory-3000.log 2>&1 &
PRACTICE_DIR_PID=$!

echo "🚀 Starting Admin Dashboard on port 4000..."
cd /home/happy/projects/hpms/onehealth
nohup npm run dev -- --port 4000 > ../admin-dashboard-4000.log 2>&1 &
ADMIN_PID=$!

echo "🚀 Starting Practice App on port 5000..."
cd /home/happy/projects/hpms
nohup npm run dev:dashboard > practice-app-5000.log 2>&1 &
PRACTICE_APP_PID=$!

echo ""
echo "⏳ Waiting for services to start..."
sleep 10

echo ""
echo "✅ Services started with PIDs:"
echo "  • Practice Directory (3000): $PRACTICE_DIR_PID"
echo "  • Admin Dashboard (4000): $ADMIN_PID"
echo "  • Practice App (5000): $PRACTICE_APP_PID"

echo ""
echo "🌐 Access URLs:"
echo "  • Healthcare Practice Directory: http://localhost:3000"
echo "  • Admin Dashboard (OneHealth): http://localhost:4000" 
echo "  • Practice App (HPMS): http://localhost:5000"

echo ""
echo "📊 To view logs:"
echo "  • tail -f practice-directory-3000.log"
echo "  • tail -f admin-dashboard-4000.log"
echo "  • tail -f practice-app-5000.log"

echo ""  
echo "🛑 To stop all services: pkill -f 'next|vite'"