#!/bin/bash

echo "🛑 Stopping OneHealth Services..."
echo "================================"

# Kill processes on all ports
echo "Stopping services on ports 3000, 4000, 5000..."

lsof -ti:3000 | xargs kill -9 2>/dev/null && echo "✅ Stopped port 3000" || echo "⏭️  Port 3000 already free"
lsof -ti:4000 | xargs kill -9 2>/dev/null && echo "✅ Stopped port 4000" || echo "⏭️  Port 4000 already free"
lsof -ti:5000 | xargs kill -9 2>/dev/null && echo "✅ Stopped port 5000" || echo "⏭️  Port 5000 already free"

echo ""
echo "✨ All services stopped!"