#!/bin/bash
# ╔══════════════════════════════════════════════════════════╗
# ║           AgroTalk — Full Stack Launcher                 ║
# ╚══════════════════════════════════════════════════════════╝

PROJECT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$PROJECT_DIR"

# ── Colors ──────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'

LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

ok()   { echo -e "  ${GREEN}✔${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠${RESET}  $1"; }
err()  { echo -e "  ${RED}✘${RESET}  $1"; }
info() { echo -e "  ${CYAN}→${RESET}  $1"; }
step() { echo -e "\n${BOLD}${BLUE}▸ $1${RESET}"; }

# ── Banner ───────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  🌱  AgroTalk Assistant — Starting All Services          ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""

# ── Port helpers ─────────────────────────────────────────────
kill_port() {
    local port=$1
    local pids
    pids=$(lsof -ti:"$port" 2>/dev/null)
    if [ -n "$pids" ]; then
        warn "Port $port in use (PID $pids) — freeing..."
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 0.5
    fi
}

wait_for_port() {
    local port=$1 label=$2 tries=0 max=30
    while ! lsof -ti:"$port" >/dev/null 2>&1; do
        sleep 1; tries=$((tries+1))
        if [ $tries -ge $max ]; then
            err "$label failed to start on port $port after ${max}s"
            return 1
        fi
    done
    ok "$label is up  (port $port)  [${tries}s]"
}

# ── Step 1: Cleanup ──────────────────────────────────────────
step "Cleanup — killing stale processes"

pkill -9 -f "node backend/server.js"     2>/dev/null && ok "Killed old Node backend"     || true
pkill -9 -f "uvicorn"                    2>/dev/null && ok "Killed old Python backend"    || true
pkill -9 -f "node backend/whatsapp"      2>/dev/null && ok "Killed old WhatsApp bridge"   || true
pkill -9 -f "vite"                       2>/dev/null && ok "Killed old Vite dev server"   || true

kill_port 3001
kill_port 8000
kill_port 8080

find .whatsapp_session -name "SingletonLock" -delete 2>/dev/null || true
ok "Cleanup done"

# ── Step 2: Dependencies ─────────────────────────────────────
step "Dependencies"

if [ ! -d "node_modules" ]; then
    info "Installing root npm dependencies..."
    npm install --silent && ok "Root deps installed" || { err "Root npm install failed"; exit 1; }
else
    ok "Root node_modules present"
fi

if [ ! -d "backend/node_modules" ]; then
    info "Installing backend npm dependencies..."
    (cd backend && npm install --silent) && ok "Backend deps installed" || { err "Backend npm install failed"; exit 1; }
else
    ok "Backend node_modules present"
fi

if ! python3 -c "import fastapi, uvicorn" 2>/dev/null; then
    warn "Python deps missing — running pip install (may take a moment)..."
    pip3 install -r backend_py/requirements.txt -q --break-system-packages 2>&1 | tail -3 \
        && ok "Python deps installed" || warn "Some Python deps failed — continuing anyway"
else
    ok "Python deps present"
fi

# ── Step 3: Environment check ────────────────────────────────
step "Environment"

ENV_FILE=""
[ -f ".env" ] && ENV_FILE=".env" || { [ -f "backend/.env" ] && ENV_FILE="backend/.env"; }

if [ -n "$ENV_FILE" ]; then
    ok "Loading $ENV_FILE"
    set -a; source "$ENV_FILE"; set +a

    check_key() {
        local varname=$1 label=$2
        if [ -n "${!varname}" ]; then
            ok "$label  (${varname})"
        else
            warn "$label missing  (${varname} not set)"
        fi
    }

    check_key OPENROUTER_API_KEY   "OpenRouter AI"
    check_key NVIDIA_VISION_KEY    "NVIDIA Vision"
    check_key NVIDIA_TTS_KEY       "NVIDIA TTS"
    check_key NVIDIA_STT_KEY       "NVIDIA STT"
    check_key VITE_MANDI_API_KEY   "Mandi Market"
    ok "Weather (Open-Meteo — no key required)"
else
    warn "No .env file found — services may fail to authenticate"
fi

# ── Step 4: Start services ───────────────────────────────────
step "Starting services"

# Python backend (NVIDIA TTS / STT / Vision)
info "Starting Python backend  (port 8000) ..."
cd backend_py
python3 -u main.py > "$LOG_DIR/python.log" 2>&1 &
PYTHON_PID=$!
cd "$PROJECT_DIR"

# Node backend (AI chat, market, weather)
info "Starting Node backend    (port 3001) ..."
cd backend
node server.js > "$LOG_DIR/node.log" 2>&1 &
NODE_PID=$!
cd "$PROJECT_DIR"

# Wait for both backends before launching frontend (parallel, only these PIDs)
wait_for_port 8000 "Python backend" & PW1=$!
wait_for_port 3001 "Node backend"   & PW2=$!
wait $PW1 $PW2

# Vite frontend
info "Starting Vite frontend   (port 8080) ..."
npx vite > "$LOG_DIR/vite.log" 2>&1 &
VITE_PID=$!

wait_for_port 8080 "Vite frontend" & PW3=$!
wait $PW3

# ── Step 5: Summary ──────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}╔══════════════════════════════════════════════════════════╗${RESET}"
echo -e "${BOLD}${GREEN}║  ✅  All services running                                ║${RESET}"
echo -e "${BOLD}${GREEN}╚══════════════════════════════════════════════════════════╝${RESET}"
echo ""
echo -e "  ${BOLD}Frontend${RESET}         http://localhost:8080"
echo -e "  ${BOLD}Node backend${RESET}     http://localhost:3001/health"
echo -e "  ${BOLD}Python backend${RESET}   http://localhost:8000"
echo ""
echo -e "  ${CYAN}Logs${RESET}  .logs/node.log  |  .logs/python.log  |  .logs/vite.log"
echo ""
echo -e "  ${YELLOW}Press Ctrl+C to stop all services${RESET}"
echo ""

# Open browser
sleep 2 && open http://localhost:8080 &

# ── Tail logs + trap Ctrl+C ──────────────────────────────────
cleanup() {
    echo ""
    step "Shutting down..."
    kill $PYTHON_PID $NODE_PID $VITE_PID 2>/dev/null
    kill_port 3001; kill_port 8000; kill_port 8080
    ok "All services stopped. Bye!"
    exit 0
}
trap cleanup SIGINT SIGTERM

# Live tail all three logs with colored prefixes
tail -f "$LOG_DIR/python.log" | sed "s/^/  ${BLUE}[python]${RESET} /" &
tail -f "$LOG_DIR/node.log"   | sed "s/^/  ${GREEN}[node]  ${RESET} /" &
tail -f "$LOG_DIR/vite.log"   | sed "s/^/  ${CYAN}[vite]  ${RESET} /" &

wait $PYTHON_PID $NODE_PID $VITE_PID
