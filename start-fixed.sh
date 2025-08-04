#!/bin/bash
echo "Starting OneHealth Services - CORRECT PORTS"
echo "============================================"
pkill -f "next" 2>/dev/null || true
pkill -f "vite" 2>/dev/null || true
sleep 3
echo "Port 3000: Healthcare Practice Directory"
echo "Port 4000: Admin Dashboard (OneHealth)"
echo "Port 5000: Practice App (HPMS)"
cd /home/happy/projects/hpms/hpms-landing && nohup npm run dev > ../logs-3000.log 2>&1 &
cd /home/happy/projects/hpms/onehealth && nohup npm run dev -- --port 4000 > ../logs-4000.log 2>&1 &
cd /home/happy/projects/hpms && nohup npm run dev:dashboard > logs-5000.log 2>&1 &
sleep 8
echo "Services started successfully!"
echo "Access URLs:"
echo "  localhost:3000 - Healthcare Practice Directory"
echo "  localhost:4000 - Admin Dashboard (LOGIN PAGE)"
echo "  localhost:5000 - Practice App"