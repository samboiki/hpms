#!/bin/bash

# OneHealth Admin Dashboard (Port 4000) - Next.js App
echo "🎯 Starting OneHealth Admin Dashboard on port 4000..."
echo "=================================================="

# Kill any existing process on port 4000
lsof -ti:4000 | xargs -r kill -9 2>/dev/null
sleep 1

# Change to the OneHealth directory
cd /home/happy/projects/hpms/onehealth

# Clean any corrupted build files
rm -rf .next/cache 2>/dev/null

# Start Next.js development server on port 4000
echo "🎯 OneHealth Admin Dashboard: http://localhost:4000"
echo "   • Will redirect to: http://localhost:4000/auth/login"
echo "   • Login credentials: admin@onehealth.local / [your password]"
echo ""

# Run Next.js with explicit port
npm run dev -- --port 4000