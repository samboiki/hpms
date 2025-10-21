#!/bin/bash

# Client Landing Page Quick Access
# Easy shortcuts to open client landing pages in browser

echo "🦷 Client Landing Page Quick Access"
echo "=================================="
echo ""
echo "Your client landing pages are accessible via:"
echo ""
echo "🌐 Base URL: http://localhost:9000"
echo ""
echo "📋 Available Client Landing Pages:"
echo "   • NewCharm Dental: http://localhost:9000/?practice=newcharm"
echo "   • Polina Practice: http://localhost:9000/?practice=polina"
echo "   • City Practice: http://localhost:9000/?practice=city"
echo "   • Custom Practice: http://localhost:9000/?practice=[practice-name]"
echo ""
echo "🚀 Quick Actions:"
echo "   [1] Test NewCharm Dental"
echo "   [2] Test Polina Practice"
echo "   [3] Test City Practice"
echo "   [4] Open base landing page"
echo "   [5] Show current server status"
echo ""

read -p "Choose an action (1-5): " choice

case $choice in
    1)
        echo "🦷 Testing NewCharm Dental..."
        curl -s "http://localhost:9000/?practice=newcharm" | grep -o '<title>.*</title>' || echo "❌ Failed to connect"
        echo "🌐 URL: http://localhost:9000/?practice=newcharm"
        ;;
    2)
        echo "🦷 Testing Polina Practice..."
        curl -s "http://localhost:9000/?practice=polina" | grep -o '<title>.*</title>' || echo "❌ Failed to connect"
        echo "🌐 URL: http://localhost:9000/?practice=polina"
        ;;
    3)
        echo "🦷 Testing City Practice..."
        curl -s "http://localhost:9000/?practice=city" | grep -o '<title>.*</title>' || echo "❌ Failed to connect"
        echo "🌐 URL: http://localhost:9000/?practice=city"
        ;;
    4)
        echo "🌐 Testing base landing page..."
        curl -s "http://localhost:9000" | grep -o '<title>.*</title>' || echo "❌ Failed to connect"
        echo "🌐 URL: http://localhost:9000"
        ;;
    5)
        echo "📊 Server Status:"
        echo "   Port 9000 (Next.js Marketing + Client Pages):"
        ss -tulpn | grep :9000 && echo "   ✅ Running" || echo "   ❌ Not running"
        echo ""
        echo "📋 All Active Servers:"
        ss -tulpn | grep -E ":(7000|8000|9000)" | awk '{print "   • Port " $5 " - Active"}'
        ;;
    *)
        echo "❌ Invalid choice"
        ;;
esac

echo ""
echo "💡 Tip: Copy these URLs directly into your browser:"
echo "   http://localhost:9000/?practice=newcharm"
echo "   http://localhost:9000/?practice=polina"
echo "   http://localhost:9000/?practice=city"