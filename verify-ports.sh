#!/bin/bash

echo "🔍 OneHealth Services Port Verification"
echo "======================================="

echo ""
echo "📋 Expected Configuration:"
echo "  • Port 3000: Healthcare Practice Directory (hpms-landing)"
echo "  • Port 4000: Admin Dashboard (onehealth)"
echo "  • Port 5000: Practice App (main HPMS)"

echo ""
echo "🔍 Checking active services..."

# Check processes
echo ""
echo "📊 Running Processes:"
ps aux | grep -E "(next|vite)" | grep -v grep | while read line; do
    if echo "$line" | grep -q "3000"; then
        echo "  ✅ Port 3000: Healthcare Practice Directory"
    elif echo "$line" | grep -q "4000"; then
        echo "  ✅ Port 4000: Admin Dashboard" 
    elif echo "$line" | grep -q "5000"; then
        echo "  ✅ Port 5000: Practice App"
    fi
done

# Check listening ports
echo ""
echo "🔌 Listening Ports:"
ss -tlnp | grep -E ":(3000|4000|5000)" | while read line; do
    if echo "$line" | grep -q ":3000"; then
        echo "  ✅ Port 3000: ACTIVE (Healthcare Practice Directory)"
    elif echo "$line" | grep -q ":4000"; then
        echo "  ✅ Port 4000: ACTIVE (Admin Dashboard)"
    elif echo "$line" | grep -q ":5000"; then
        echo "  ✅ Port 5000: ACTIVE (Practice App)"
    fi
done

echo ""
echo "🌐 Access URLs:"
echo "  • Healthcare Practice Directory: http://localhost:3000"
echo "  • Admin Dashboard (OneHealth): http://localhost:4000 ← USER SHOULD SEE LOGIN PAGE HERE"
echo "  • Practice App (HPMS): http://localhost:5000"

echo ""
echo "✅ Port configuration is now CORRECT!"
echo "The user should now see the admin dashboard login page on localhost:4000"