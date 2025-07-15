#!/bin/bash

# Quick Start Script for n8n AI Patient Search
# This script will install and start n8n with the AI workflow

echo "🚀 Starting n8n for AI Patient Search..."
echo ""

# Check if n8n is installed
if ! command -v n8n &> /dev/null; then
    echo "📦 n8n not found. Installing globally..."
    npm install -g n8n
    echo "✅ n8n installed successfully!"
    echo ""
else
    echo "✅ n8n is already installed"
    echo ""
fi

# Check if port 5678 is in use
if lsof -i :5678 &> /dev/null; then
    echo "⚠️  Port 5678 is already in use. Stopping existing process..."
    pkill -f "n8n"
    sleep 2
fi

echo "🔧 Starting n8n with tunnel for webhook support..."
echo ""
echo "📋 After n8n starts:"
echo "   1. Open http://localhost:5678 in your browser"
echo "   2. Import the workflow from: n8n-workflows/ai-patient-search-advanced.json"
echo "   3. Set up these credentials:"
echo "      - Supabase PostgreSQL (your database)"
echo "      - OpenAI API (your OpenAI key)"
echo "      - xAI API (your Grok key as HTTP Header Auth)"
echo "   4. Activate the workflow by toggling the switch"
echo ""
echo "🌐 Starting n8n..."

# Start n8n with tunnel
n8n start --tunnel