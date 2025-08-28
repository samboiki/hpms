#!/bin/bash

# Farmaris Event Registration App (Port 3000)
echo "🌾 Starting Farmaris on port 3000..."
echo "=================================================="

# Kill any existing process on port 3000
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
sleep 1

# Change to the Farmaris directory
cd /home/happy/projects/hpms/farmaris

# Start Vite development server on port 3000
echo "🌾 Farmaris Event Registration: http://localhost:3000"
echo "   • Main page: http://localhost:3000"
echo "   • Drinks menu: http://localhost:3000/drinks"
echo "   • Admin panel: http://localhost:3000/admin"
echo ""

# Run Vite dev server
npm run dev