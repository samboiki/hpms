#!/bin/bash

# OneHealth Multi-Practice Management System Startup Script
# =========================================================
# Port Architecture:
# - 3000: OneHealth Marketing Page (with practice-specific pages via query params)
# - 4000: OneHealth Admin Dashboard (system administration)
# - 5000: Practice Portal Dashboard (individual practice management)

echo "🚀 Starting OneHealth Multi-Practice Management System"
echo "=================================================="
echo ""

# Kill any processes on required ports
echo "🔄 Clearing ports 3000, 4000, and 5000..."
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
lsof -ti:4000 | xargs -r kill -9 2>/dev/null
lsof -ti:5000 | xargs -r kill -9 2>/dev/null

sleep 2

echo ""
echo "📊 Starting services:"
echo "  🌐 Marketing Site: http://localhost:3000"
echo "     • OneHealth landing page"
echo "     • Practice-specific pages:"
echo "       - http://localhost:3000/?practice=newcharm-dental"
echo "       - http://localhost:3000/?practice=cityclinic"
echo ""
echo "  🎯 Admin Dashboard: http://localhost:4000"
echo "     • OneHealth system administration"
echo "     • Multi-practice management"
echo ""
echo "  🏥 Practice Portal: http://localhost:5000"
echo "     • Individual practice dashboard"
echo "     • Daily operations management"
echo ""
echo "=================================================="
echo ""

# Start all services
npm run dev