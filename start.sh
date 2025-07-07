#!/bin/bash

echo "🚀 Starting HPMS Development Server"
echo "📍 Location: /home/happy/projects/hpms"
echo "🌐 URL: http://localhost:5173"
echo "🔄 Hot reload: ENABLED"
echo ""

cd /home/happy/projects/hpms

# Clear any cached issues
rm -rf node_modules/.vite 2>/dev/null
rm -rf dist 2>/dev/null

# Start the server
echo "✨ Launching Vite..."
npm run dev

echo "✅ Server started successfully!"
echo "🌐 Open: http://localhost:5173"