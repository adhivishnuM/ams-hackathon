#!/bin/bash

# --- AgroTalk Assist Startup Script (Mac/Linux) ---

# Get the directory where the script is located
PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

echo "==================================================="
echo "  🌱 Starting AgroTalk Assist (Full Stack)         "
echo "==================================================="

# --- 0. CLEANUP (Fix port/process conflicts) ---
echo "[INFO] Cleaning up stale processes and locks..."

# Function to kill process on port and wait
kill_port() {
    local port=$1
    local pids=$(lsof -ti:$port)
    if [ ! -z "$pids" ]; then
        echo "  - Clearing port $port (PIDs: $pids)"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    fi
}

# Kill known processes by pattern
pkill -9 -f "node backend/whatsapp_bridge.js" 2>/dev/null || true
pkill -9 -f "python3 main.py" 2>/dev/null || true
pkill -9 -f "node server.js" 2>/dev/null || true
pkill -9 -f "Google Chrome" 2>/dev/null || true # WhatsApp bridge browser

# Kill by port
kill_port 3001
kill_port 8000
kill_port 8080

# Remove WhatsApp Singleton lock if it exists
# This prevents the "browser is already running" error
find .whatsapp_session -name "SingletonLock" -delete 2>/dev/null || true

echo "[INFO] Cleanup complete."
echo ""

# 1. Check if Node dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "[INFO] Installing Frontend/Root dependencies..."
    npm install
fi

if [ ! -d "backend/node_modules" ]; then
    echo "[INFO] Installing Node Backend dependencies..."
    cd backend && npm install && cd ..
fi

# 2. Start the application
echo "[INFO] Launching all services (Frontend, Node, Python)..."
echo "[INFO] Press Ctrl+C to stop all services."
echo ""

# Use the dev:full:wa command we added to package.json
# This uses 'concurrently' to show all outputs in one window, including WhatsApp
npm run dev:full:wa

# Fallback in case dev:full:wa isn't used or fails
if [ $? -ne 0 ]; then
    echo "[ERROR] Failed to start services. Checking manual launch..."
    # Manual concurrent execution if needed
    npx concurrently "npm run dev:backend" "npm run dev" "npm run dev:python" "npm run dev:whatsapp"
fi
