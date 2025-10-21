#!/bin/bash

# Evidence-Based Development Server Setup for WSL2
# Based on research for Next.js 15.4.4, Vite 5.4.2, Node 22.16.0

echo "🚀 Starting Evidence-Based Development Servers for WSL2..."
echo "📋 Configuration Summary:"
echo "   • React Practice Portal: http://localhost:7000 (Vite 5.4.2)"
echo "   • React Admin Portal: http://localhost:8000 (Vite 5.4.2)"
echo "   • Next.js Marketing + Client Pages: http://localhost:9000 (Next.js 15.4.4)"
echo ""

# Clear any existing cache and build artifacts
echo "🧹 Cleaning build artifacts..."
rm -rf .next/cache 2>/dev/null
rm -rf onehealth/.next/cache 2>/dev/null
rm -rf onehealth-admin/.next/cache 2>/dev/null
rm -rf dist 2>/dev/null
rm -rf onehealth-admin/dist 2>/dev/null

echo "🔌 Checking and clearing conflicting ports..."
# Kill any processes on our target ports
for port in 7000 7001 8000 8001 9000 9001; do
    pid=$(lsof -ti:$port 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo "   Killing process $pid on port $port"
        kill -9 $pid 2>/dev/null
    fi
done

echo "⏰ Starting servers with 2-second delays..."

# Start React Practice Portal (Vite)
echo "🏥 Starting React Practice Portal on port 7000..."
cd .
nohup npm run dev:practice-only > practice.log 2>&1 &
PRACTICE_PID=$!
sleep 2

# Start React Admin Portal (Vite)
echo "🎯 Starting React Admin Portal on port 8000..."
cd ./onehealth-admin
nohup npm run dev > admin.log 2>&1 &
ADMIN_PID=$!
sleep 2

# Start Next.js Marketing (port 9000)
echo "🌐 Starting Next.js Marketing on port 9000..."
cd ../onehealth
nohup npm run dev > marketing.log 2>&1 &
MARKETING_PID=$!
sleep 2

# Client Landing Pages are integrated into Next.js Marketing (port 9000)
echo "✨ Client Landing Pages integrated into Next.js Marketing on port 9000"
CLIENTS_PID="integrated"

echo "✅ All servers started!"
echo ""
echo "📊 Process Information:"
echo "   Practice Portal PID: $PRACTICE_PID"
echo "   Admin Portal PID: $ADMIN_PID"
echo "   Marketing Portal PID: $MARKETING_PID"
echo "   Client Landing PID: $CLIENTS_PID"
echo ""
echo "🌐 Access URLs (copy into your browser):"
echo "   React Practice Portal: http://localhost:7000"
echo "   React Admin Portal: http://localhost:8000"
echo "   Next.js Marketing: http://localhost:9000"
echo ""
echo "🏥 Client Landing Page Quick Access:"
echo "   NewCharm Dental: http://localhost:9000/?practice=newcharm"
echo "   Dr. Polina: http://localhost:9000/?practice=polina"
echo "   CityClinic: http://localhost:9000/?practice=cityclinic"
echo "   CoastalMed: http://localhost:9000/?practice=coastalmed"
echo ""
echo "📝 Log files created:"
echo "   Practice: ./practice.log"
echo "   Admin: ./onehealth-admin/admin.log"
echo "   Marketing: ./onehealth/marketing.log"
echo ""
echo "🔍 To check server status: ps aux | grep -E '(vite|next)'"
echo "🛑 To stop all servers: pkill -f 'vite|next'"