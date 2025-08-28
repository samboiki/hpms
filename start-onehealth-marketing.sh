#!/bin/bash

# OneHealth Marketing Site (Port 3000) - Next.js App
echo "🌐 Starting OneHealth Marketing Site on port 3000..."
echo "=================================================="

# Kill any existing process on port 3000
lsof -ti:3000 | xargs -r kill -9 2>/dev/null
sleep 1

# Change to the OneHealth directory
cd /home/happy/projects/hpms/onehealth

# Clean any corrupted build files
rm -rf .next/cache 2>/dev/null

# Start Next.js development server on port 3000
echo "🌐 OneHealth Marketing Site: http://localhost:3000"
echo "   • Practice-specific pages:"
echo "     - http://localhost:3000/?practice=newcharm-dental"
echo "     - http://localhost:3000/?practice=cityclinic"
echo ""

# Run Next.js with explicit port
npm run dev -- --port 3000