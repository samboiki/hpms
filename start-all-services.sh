#!/bin/bash

echo "🚀 Starting All HPMS Services..."
echo ""

# Kill any existing processes
pkill -f "next dev" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true

# Start HPMS Dashboard (Vite)
echo "🏥 Starting HPMS Practice Dashboard on port 5000..."
cd /home/happy/projects/hpms
nohup npm run dev:dashboard-only > dashboard.log 2>&1 &
DASH_PID=$!

# Start Practice Landing Pages (Next.js)
echo "🌐 Starting Practice Landing Pages on port 3000..."
cd /home/happy/projects/hpms/hpms-landing
nohup npm run dev -- --port 3000 > ../landing.log 2>&1 &
LAND_PID=$!

# Start OneHealth Admin Portal (Next.js)
echo "⚡ Starting OneHealth Admin Portal on port 4000..."
cd /home/happy/projects/hpms/onehealth
nohup npm run dev -- --port 4000 > ../admin.log 2>&1 &
ADMIN_PID=$!

# Wait for services to start
echo ""
echo "⏳ Waiting for services to initialize..."
sleep 10

# Check status
cd /home/happy/projects/hpms
echo ""
node check-services-status.js

echo ""
echo "🔗 Quick Access Links:"
echo "   🌐 Practice Landing Pages: http://localhost:3000"
echo "      • NewCharm Dental: http://localhost:3000?practice=newcharm-dental"
echo "      • Dr. Polina: http://localhost:3000?practice=dr-polina-aesthetics"
echo ""
echo "   ⚡ OneHealth Admin Portal: http://localhost:4000"
echo "      • Login: http://localhost:4000/auth/login"
echo "      • Dashboard: http://localhost:4000/dashboard"
echo ""
echo "   🏥 HPMS Practice Dashboard: http://localhost:5000"
echo "      • Login and manage practice operations"
echo ""
echo "📝 Service PIDs: Dashboard=$DASH_PID, Landing=$LAND_PID, Admin=$ADMIN_PID"
echo "📊 To check status: npm run services:status"
echo "🛑 To stop all: pkill -f 'next dev|vite'"