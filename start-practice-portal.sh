#!/bin/bash

# Practice Portal (Port 5000) - Vite React App
echo "🏥 Starting Practice Portal on port 5000..."
echo "=================================================="

# Kill any existing process on port 5000
lsof -ti:5000 | xargs -r kill -9 2>/dev/null
sleep 1

# Change to the root HPMS directory
cd /home/happy/projects/hpms

# Start Vite development server
echo "📊 Practice Portal Dashboard: http://localhost:5000"
echo ""

# Run Vite with explicit configuration
npx vite --host 0.0.0.0 --port 5000 --force