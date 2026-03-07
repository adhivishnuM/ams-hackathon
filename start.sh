#!/bin/bash

# ════════════════════════════════════════════════════════════════
#  AgroTalk Assist — Startup Script (Node.js Consolidated Backend)
#  Usage:
#    ./start.sh          → Start backend only
#    ./start.sh wa       → Start backend + WhatsApp bridge
#    ./start.sh stop     → Stop all running processes
#    ./start.sh status   → Check process status
#    ./start.sh deploy   → Build + deploy frontend to Firebase
# ════════════════════════════════════════════════════════════════

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_PID_FILE="$PROJECT_DIR/.backend.pid"
WHATSAPP_PID_FILE="$PROJECT_DIR/.whatsapp.pid"
LOG_DIR="$PROJECT_DIR/logs"
BACKEND_LOG="$LOG_DIR/backend.log"
WHATSAPP_LOG="$LOG_DIR/whatsapp.log"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
BOLD='\033[1m'
RESET='\033[0m'

print_banner() {
  echo ""
  echo -e "${GREEN}${BOLD}  🌿 AgroTalk Assist — Production Server${RESET}"
  echo -e "${BLUE}  ════════════════════════════════════════${RESET}"
  echo ""
}

print_status() { echo -e "  ${GREEN}✅${RESET} $1"; }
print_warn()   { echo -e "  ${YELLOW}⚠️ ${RESET} $1"; }
print_error()  { echo -e "  ${RED}❌${RESET} $1"; }
print_info()   { echo -e "  ${BLUE}ℹ️ ${RESET} $1"; }

# ── Check .env ───────────────────────────────────────────────────
check_env() {
  local ENV_FILE="$PROJECT_DIR/.env"
  if [ ! -f "$ENV_FILE" ]; then
    print_error ".env file not found at $ENV_FILE"
    echo ""
    echo "  Copy .env.example and fill in your API keys:"
    echo "  cp .env.example .env"
    exit 1
  fi

  local MISSING=0
  while IFS= read -r line; do
    # Skip comments and empty lines
    [[ "$line" =~ ^#.*$ || -z "$line" ]] && continue
    local KEY="${line%%=*}"
    local VAL="${line#*=}"
    if [[ -z "$VAL" || "$VAL" == "your_"* || "$VAL" == "REPLACE"* ]]; then
      print_warn "Missing value for: $KEY"
      MISSING=1
    fi
  done < "$ENV_FILE"

  if [ "$MISSING" -eq 1 ]; then
    echo ""
    print_warn "Some .env values are empty. The server will still start but some features may fail."
    echo ""
  fi
}

# ── Start backend ───────────────────────────────────────────────
start_backend() {
  mkdir -p "$LOG_DIR"

  if [ -f "$BACKEND_PID_FILE" ]; then
    local PID
    PID=$(cat "$BACKEND_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      print_warn "Backend already running (PID $PID)"
      return
    fi
  fi

  print_info "Starting Node.js backend..."
  nohup node "$PROJECT_DIR/backend/server.js" >> "$BACKEND_LOG" 2>&1 &
  echo $! > "$BACKEND_PID_FILE"
  sleep 1

  local PID
  PID=$(cat "$BACKEND_PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    print_status "Backend running — PID $PID — Port 3001"
    print_info  "Logs → $BACKEND_LOG"
  else
    print_error "Backend failed to start. Check $BACKEND_LOG"
    exit 1
  fi
}

# ── Start WhatsApp bridge ────────────────────────────────────────
start_whatsapp() {
  mkdir -p "$LOG_DIR"

  if [ -f "$WHATSAPP_PID_FILE" ]; then
    local PID
    PID=$(cat "$WHATSAPP_PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
      print_warn "WhatsApp bridge already running (PID $PID)"
      return
    fi
  fi

  print_info "Starting WhatsApp bridge..."
  nohup node "$PROJECT_DIR/backend/whatsapp_bridge.js" >> "$WHATSAPP_LOG" 2>&1 &
  echo $! > "$WHATSAPP_PID_FILE"
  sleep 1

  local PID
  PID=$(cat "$WHATSAPP_PID_FILE")
  if kill -0 "$PID" 2>/dev/null; then
    print_status "WhatsApp bridge running — PID $PID"
    print_info  "Logs → $WHATSAPP_LOG"
    print_info  "Tap the WhatsApp icon in the app to scan the QR code"
  else
    print_error "WhatsApp bridge failed to start. Check $WHATSAPP_LOG"
  fi
}

# ── Stop all ─────────────────────────────────────────────────────
stop_all() {
  print_info "Stopping all AgroTalk processes..."

  for PIDFILE in "$BACKEND_PID_FILE" "$WHATSAPP_PID_FILE"; do
    if [ -f "$PIDFILE" ]; then
      local PID
      PID=$(cat "$PIDFILE")
      local NAME
      NAME=$([ "$PIDFILE" = "$BACKEND_PID_FILE" ] && echo "Backend" || echo "WhatsApp")
      if kill -0 "$PID" 2>/dev/null; then
        kill "$PID"
        print_status "$NAME stopped (PID $PID)"
      else
        print_warn "$NAME was not running"
      fi
      rm -f "$PIDFILE"
    fi
  done
  echo ""
}

# ── Status ───────────────────────────────────────────────────────
show_status() {
  echo ""
  echo -e "  ${BOLD}Process Status${RESET}"
  echo "  ─────────────────────────────"

  for ENTRY in "Backend:$BACKEND_PID_FILE:3001" "WhatsApp:$WHATSAPP_PID_FILE:"; do
    local NAME="${ENTRY%%:*}"
    local PIDFILE="${ENTRY#*:}"; PIDFILE="${PIDFILE%%:*}"
    local PORT="${ENTRY##*:}"

    if [ -f "$PIDFILE" ]; then
      local PID
      PID=$(cat "$PIDFILE")
      if kill -0 "$PID" 2>/dev/null; then
        local PORT_TEXT=""
        [ -n "$PORT" ] && PORT_TEXT=" → http://localhost:$PORT"
        echo -e "  ${GREEN}●${RESET} $NAME   PID $PID$PORT_TEXT"
      else
        echo -e "  ${RED}●${RESET} $NAME   ${RED}(crashed / stopped)${RESET}"
        rm -f "$PIDFILE"
      fi
    else
      echo -e "  ${YELLOW}●${RESET} $NAME   ${YELLOW}not started${RESET}"
    fi
  done
  echo ""
}

# ── Deploy ───────────────────────────────────────────────────────
deploy_frontend() {
  print_info "Building frontend..."
  cd "$PROJECT_DIR"
  npm run build

  print_info "Deploying to Firebase Hosting..."
  npx firebase-tools deploy --only hosting

  print_status "Frontend deployed to Firebase Hosting!"
}

# ── Router ───────────────────────────────────────────────────────
print_banner
check_env

case "${1:-}" in
  wa|whatsapp)
    start_backend
    start_whatsapp
    ;;
  stop)
    stop_all
    ;;
  status)
    show_status
    ;;
  deploy)
    deploy_frontend
    ;;
  ""| backend)
    start_backend
    ;;
  *)
    echo "  Usage: ./start.sh [wa|stop|status|deploy]"
    echo ""
    echo "    (no args)  → Start backend only"
    echo "    wa         → Start backend + WhatsApp bridge"
    echo "    stop       → Stop all running processes"
    echo "    status     → Show running processes"
    echo "    deploy     → Build + deploy frontend to Firebase"
    echo ""
    exit 1
    ;;
esac

echo ""
print_info "Tunnel tip: Run 'ngrok http 3001' and set VITE_API_URL to the ngrok URL"
echo ""
