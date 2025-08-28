#!/bin/bash

# Ultra-Robust OneHealth Development Server
# ==========================================

# Colors for better visibility
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
PRACTICE_PORT=5000
ADMIN_PORT=4000
MARKETING_PORT=3000

# Function to check if port is in use
check_port() {
    local port=$1
    if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Function to kill process on port
kill_port() {
    local port=$1
    local pid=$(lsof -Pi :$port -sTCP:LISTEN -t 2>/dev/null)
    if [ ! -z "$pid" ]; then
        echo -e "${YELLOW}Killing process $pid on port $port${NC}"
        kill -9 $pid 2>/dev/null
        sleep 1
    fi
}

# Function to wait for port to be available
wait_for_port() {
    local port=$1
    local max_attempts=10
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if ! check_port $port; then
            return 0
        fi
        echo -e "${YELLOW}Waiting for port $port to be free (attempt $((attempt+1))/$max_attempts)...${NC}"
        sleep 1
        attempt=$((attempt+1))
    done
    return 1
}

clear
echo -e "${BOLD}${CYAN}🚀 OneHealth Multi-Practice Management System${NC}"
echo -e "${CYAN}=============================================${NC}\n"

# Step 1: Clean up existing processes
echo -e "${YELLOW}🔄 Cleaning up existing processes...${NC}"

# Kill any existing dev servers
pkill -f "vite" 2>/dev/null
pkill -f "next dev" 2>/dev/null
pkill -f "npm run dev" 2>/dev/null
sleep 1

# Force kill processes on our ports
kill_port $PRACTICE_PORT
kill_port $ADMIN_PORT
kill_port $MARKETING_PORT

# Wait for ports to be available
echo -e "${YELLOW}⏳ Ensuring ports are available...${NC}"
wait_for_port $PRACTICE_PORT
wait_for_port $ADMIN_PORT
wait_for_port $MARKETING_PORT

echo -e "${GREEN}✅ Ports are ready!${NC}\n"

# Step 2: Start all services
echo -e "${BLUE}📊 Starting all services...${NC}\n"

# Create a trap to kill all child processes when script exits
trap 'echo -e "\n${RED}🛑 Shutting down all services...${NC}"; kill $(jobs -p) 2>/dev/null; exit' INT TERM EXIT

# Start Practice Portal (Vite)
echo -e "${MAGENTA}[PRACTICE] Starting on port $PRACTICE_PORT...${NC}"
(
    cd /home/happy/projects/hpms
    # Clear Vite cache for fresh start
    rm -rf node_modules/.vite 2>/dev/null
    npx vite --port $PRACTICE_PORT --host --clearScreen false 2>&1 | while IFS= read -r line; do
        echo -e "${MAGENTA}[🏥PRACTICE]${NC} $line"
    done
) &
PRACTICE_PID=$!

sleep 2

# Start Admin Portal (Next.js)
echo -e "${BLUE}[ADMIN] Starting on port $ADMIN_PORT...${NC}"
(
    cd /home/happy/projects/hpms/onehealth
    npx next dev -H 0.0.0.0 --port $ADMIN_PORT 2>&1 | while IFS= read -r line; do
        echo -e "${BLUE}[🎯ADMIN]${NC} $line"
    done
) &
ADMIN_PID=$!

sleep 2

# Start Marketing Portal (Next.js)
echo -e "${GREEN}[MARKETING] Starting on port $MARKETING_PORT...${NC}"
(
    cd /home/happy/projects/hpms/onehealth
    npx next dev -H 0.0.0.0 --port $MARKETING_PORT 2>&1 | while IFS= read -r line; do
        echo -e "${GREEN}[🌐MARKETING]${NC} $line"
    done
) &
MARKETING_PID=$!

# Wait for services to start
sleep 3

# Function to check if service is running
check_service() {
    local port=$1
    local name=$2
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:$port | grep -q "200\|404\|302"; then
        echo -e "${GREEN}✅ $name is running on port $port${NC}"
        return 0
    else
        echo -e "${RED}❌ $name failed to start on port $port${NC}"
        return 1
    fi
}

# Display status
echo -e "\n${CYAN}==================================================${NC}"
echo -e "${GREEN}${BOLD}✅ All services starting up...${NC}\n"

echo -e "${GREEN}🌐 OneHealth Marketing:${NC} ${BOLD}http://localhost:$MARKETING_PORT${NC}"
echo -e "${BLUE}🎯 OneHealth Admin:${NC} ${BOLD}http://localhost:$ADMIN_PORT${NC} → ${CYAN}http://localhost:$ADMIN_PORT/auth/login${NC}"
echo -e "   ${YELLOW}Login: admin@onehealth.local${NC}"
echo -e "${MAGENTA}🏥 Practice Portal:${NC} ${BOLD}http://localhost:$PRACTICE_PORT${NC}\n"

echo -e "${YELLOW}Press Ctrl+C to stop all services${NC}"
echo -e "${CYAN}==================================================${NC}\n"

# Keep script running and show logs
wait $PRACTICE_PID $ADMIN_PID $MARKETING_PID