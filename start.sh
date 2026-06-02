#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# innate-feeds — One-command local starter
# =============================================================================
# Starts the Go backend and the React frontend. Database is auto-detected
# from FUSION_DB_PATH in .env:
#   - hub.db (or any non-postgres:// path)  → SQLite (default, zero-config)
#   - postgres://user:pass@host:port/db     → PostgreSQL
#   - postgres://...insforge...             → InsForge (self-host or cloud)
#
# Usage:
#   ./start.sh                  Start backend + frontend (foreground)
#   ./start.sh backend          Backend only
#   ./start.sh frontend         Frontend only
#   ./start.sh -d               Start in background (daemon mode)
#   ./start.sh stop             Stop all
#   ./start.sh status           Show what's running
#   ./start.sh logs [target]    Tail logs (target: backend|frontend|all)
#   ./start.sh doctor           Sanity-check the install
#   ./start.sh build            Build frontend for production
#   ./start.sh reset            Wipe the database (asks for confirmation)
#   ./start.sh help             This message
#
# Requirements: Go 1.22+, Node.js 20+, pnpm (auto-installed via corepack).
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
RUN_DIR="$SCRIPT_DIR/.run"
mkdir -p "$RUN_DIR"

BACKEND_PID="$RUN_DIR/backend.pid"
FRONTEND_PID="$RUN_DIR/frontend.pid"
BACKEND_LOG="$RUN_DIR/backend.log"
FRONTEND_LOG="$RUN_DIR/frontend.log"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
err()   { echo -e "${RED}[ERR]${NC}   $*" >&2; }
title() { echo -e "\n${BOLD}${CYAN}==> $*${NC}"; }
ask() {
    local prompt="$1" default="${2:-}"
    if [[ -n "$default" ]]; then
        read -rp "$(echo -e "${BLUE}${prompt}${NC} [${default}]: ")" reply
        echo "${reply:-$default}"
    else
        read -rp "$(echo -e "${BLUE}${prompt}${NC}: ")" reply
        echo "$reply"
    fi
}

# =============================================================================
# Dependency checks
# =============================================================================

check_go() {
    if ! command -v go &>/dev/null; then
        err "Go is not installed. Install Go 1.22+ from https://go.dev/dl/"
        exit 1
    fi
    local ver
    ver=$(go version | grep -oE 'go[0-9]+\.[0-9]+(\.[0-9]+)?' | head -1)
    local major minor
    major=$(echo "$ver" | sed -E 's/go([0-9]+).*/\1/')
    minor=$(echo "$ver" | sed -E 's/go[0-9]+\.([0-9]+).*/\1/')
    if [[ "$major" -lt 1 ]] || { [[ "$major" -eq 1 ]] && [[ "$minor" -lt 22 ]]; }; then
        err "Go 1.22+ required, found ${ver}"
        exit 1
    fi
    ok "Go ${ver}"
}

check_node() {
    if ! command -v node &>/dev/null; then
        err "Node.js is not installed. Install Node 20+ from https://nodejs.org/"
        exit 1
    fi
    local ver
    ver=$(node --version | grep -oE '[0-9]+' | head -1)
    if [[ "$ver" -lt 20 ]]; then
        err "Node.js 20+ required, found $(node --version)"
        exit 1
    fi
    ok "Node.js $(node --version)"
}

check_pnpm() {
    if ! command -v pnpm &>/dev/null; then
        if command -v corepack &>/dev/null; then
            info "Installing pnpm via corepack..."
            corepack enable
            corepack prepare pnpm@latest --activate
        else
            err "pnpm is not installed. Install it with: npm install -g pnpm"
            exit 1
        fi
    fi
    ok "pnpm $(pnpm --version)"
}

# =============================================================================
# Environment setup
# =============================================================================

# Detect database mode from FUSION_DB_PATH
detect_db_mode() {
    local db_path="${FUSION_DB_PATH:-${HUB_DB_PATH:-hub.db}}"
    case "$db_path" in
        postgres://*|postgresql://*) echo "postgres" ;;
        *) echo "sqlite" ;;
    esac
}

ensure_env() {
    local env_file="$SCRIPT_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        warn ".env not found — creating from .env.example"
        cp "$SCRIPT_DIR/.env.example" "$env_file"
        interactive_configure "$env_file"
    fi

    # Re-source to pick up the new file
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a

    # Always export these so the Go server can read them
    export FUSION_DB_PATH="${FUSION_DB_PATH:-hub.db}"
    export FUSION_PORT="${FUSION_PORT:-8080}"

    local mode
    mode=$(detect_db_mode)
    if [[ "$mode" == "postgres" ]]; then
        ok "Database: PostgreSQL (${FUSION_DB_PATH%%@*}@...)"
    else
        ok "Database: SQLite (${FUSION_DB_PATH})"
    fi
}

interactive_configure() {
    local env_file="$1"
    echo ""
    echo -e "${BOLD}Welcome to innate-feeds!${NC}"
    echo "Let's set up a few things. Press Enter to accept defaults."
    echo ""

    # Password
    local password
    password=$(ask "Set a password for the web UI (FUSION_PASSWORD)")
    while [[ -z "$password" ]]; do
        password=$(ask "Password cannot be empty. Try again")
    done
    set_env "$env_file" "FUSION_PASSWORD" "$password"

    # Database
    local db_choice
    db_choice=$(ask "Database" "sqlite")
    case "$db_choice" in
        postgres|postgresql)
            local pg_url
            pg_url=$(ask "PostgreSQL URL" "postgres://hub:hub@localhost:5432/hub?sslmode=disable")
            set_env "$env_file" "FUSION_DB_PATH" "$pg_url"
            ;;
        insforge)
            local insforge_url
            insforge_url=$(ask "InsForge PostgreSQL URL" "postgres://postgres:postgres@localhost:5432/postgres")
            set_env "$env_file" "FUSION_DB_PATH" "$insforge_url"
            info "Tip: if you don't have InsForge yet, run: ./docker-start.sh insforge"
            ;;
        *)
            set_env "$env_file" "FUSION_DB_PATH" "hub.db"
            ;;
    esac

    # Embedder
    local embedder
    embedder=$(ask "Enable semantic search" "none")
    case "$embedder" in
        openai)
            set_env "$env_file" "HUB_EMBEDDER_PROVIDER" "openai"
            set_env "$env_file" "HUB_EMBEDDER_MODEL"   "text-embedding-3-small"
            local api_key
            api_key=$(ask "OpenAI API Key")
            set_env "$env_file" "HUB_EMBEDDER_API_KEY" "$api_key"
            ;;
        ollama)
            set_env "$env_file" "HUB_EMBEDDER_PROVIDER" "ollama"
            local ollama_url
            ollama_url=$(ask "Ollama base URL" "http://localhost:11434")
            set_env "$env_file" "HUB_EMBEDDER_BASE_URL" "$ollama_url"
            local model
            model=$(ask "Ollama model" "nomic-embed-text")
            set_env "$env_file" "HUB_EMBEDDER_MODEL" "$model"
            ;;
        *)
            set_env "$env_file" "HUB_EMBEDDER_PROVIDER" ""
            ;;
    esac

    echo ""
    ok "Configuration saved to .env"
    info "Edit .env later to change anything."
}

# set_env KEY VALUE — replaces KEY=... in .env (preserves quoting)
set_env() {
    local env_file="$1" key="$2" value="$3"
    # Escape any slashes for sed
    local escaped
    escaped=$(printf '%s\n' "$value" | sed 's/[\/&]/\\&/g')
    if grep -qE "^${key}=" "$env_file"; then
        sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$env_file"
        rm -f "$env_file.bak"
    else
        printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
    fi
}

# =============================================================================
# Process management
# =============================================================================

is_running() {
    local pid="${1:-}"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

read_pid() {
    local file="$1"
    [[ -f "$file" ]] && cat "$file" 2>/dev/null || echo ""
}

stop_service() {
    local name="$1" pid_file="$2"
    local pid
    pid=$(read_pid "$pid_file")
    if is_running "$pid"; then
        info "Stopping ${name} (PID ${pid})"
        kill "$pid" 2>/dev/null || true
        local i
        for i in 1 2 3 4 5; do
            is_running "$pid" || break
            sleep 0.5
        done
        is_running "$pid" && kill -9 "$pid" 2>/dev/null || true
        rm -f "$pid_file"
        ok "${name} stopped"
    else
        rm -f "$pid_file"
    fi
}

# =============================================================================
# Start services
# =============================================================================

start_backend() {
    local daemon="${1:-false}"
    local pid
    pid=$(read_pid "$BACKEND_PID")
    if is_running "$pid"; then
        warn "Backend already running (PID ${pid})"
        return 0
    fi

    title "Starting backend"
    cd "$BACKEND_DIR"

    # Build a one-shot binary for faster startup / fewer "go run" races
    info "Building hub binary..."
    local bin="$RUN_DIR/hub"
    if ! go build -o "$bin" ./cmd/hub 2>&1 | tee "$BACKEND_LOG.build"; then
        err "Backend build failed. See $BACKEND_LOG.build"
        return 1
    fi

    if [[ "$daemon" == "true" ]]; then
        nohup "$bin" > "$BACKEND_LOG" 2>&1 &
        local bgpid=$!
        echo "$bgpid" > "$BACKEND_PID"
        info "Backend PID ${bgpid} — logs: $BACKEND_LOG"
        wait_ready
    else
        info "Ctrl+C to stop"
        "$bin" &
        local fgpid=$!
        echo "$fgpid" > "$BACKEND_PID"
        wait "$fgpid" || true
        rm -f "$BACKEND_PID"
    fi
}

start_frontend() {
    local daemon="${1:-false}"
    local pid
    pid=$(read_pid "$FRONTEND_PID")
    if is_running "$pid"; then
        warn "Frontend already running (PID ${pid})"
        return 0
    fi

    title "Starting frontend"
    cd "$FRONTEND_DIR"
    if [[ ! -d "node_modules" ]]; then
        info "Installing dependencies (first run, may take a minute)..."
        pnpm install --silent
    fi

    if [[ "$daemon" == "true" ]]; then
        nohup pnpm dev > "$FRONTEND_LOG" 2>&1 &
        local bgpid=$!
        echo "$bgpid" > "$FRONTEND_PID"
        info "Frontend PID ${bgpid} — logs: $FRONTEND_LOG"
    else
        info "Ctrl+C to stop"
        pnpm dev &
        local fgpid=$!
        echo "$fgpid" > "$FRONTEND_PID"
        wait "$fgpid" || true
        rm -f "$FRONTEND_PID"
    fi
}

wait_ready() {
    local port="${FUSION_PORT:-8080}"
    info "Waiting for backend on :${port} (up to 30s)..."
    local i
    for i in $(seq 1 30); do
        if curl -sf -o /dev/null "http://localhost:${port}/api/sessions" 2>/dev/null; then
            ok "Backend ready"
            return 0
        fi
        sleep 1
    done
    warn "Backend didn't respond on :${port} within 30s — check $BACKEND_LOG"
    return 1
}

# =============================================================================
# Commands
# =============================================================================

cmd_all() {
    local daemon="${1:-false}"
    check_go
    check_node
    check_pnpm
    ensure_env

    start_backend "$daemon"

    if [[ "$daemon" == "true" ]]; then
        start_frontend "$daemon"
        echo ""
        echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║        innate-feeds is running!                      ║${NC}"
        echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
        echo -e "${GREEN}║  Backend:  http://localhost:${FUSION_PORT:-8080}             ║${NC}"
        echo -e "${GREEN}║  Frontend: http://localhost:5173                    ║${NC}"
        echo -e "${GREEN}║  Database: $(detect_db_mode | tr '[:lower:]' '[:upper:]')                                ║${NC}"
        echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
        echo ""
        info "Stop:    ./start.sh stop"
        info "Logs:    ./start.sh logs"
    fi
}

cmd_stop() {
    title "Stopping"
    stop_service "Backend"  "$BACKEND_PID"
    stop_service "Frontend" "$FRONTEND_PID"
    ok "All services stopped"
}

cmd_status() {
    local bpid fpid
    bpid=$(read_pid "$BACKEND_PID")
    fpid=$(read_pid "$FRONTEND_PID")
    local port="${FUSION_PORT:-8080}"
    [[ -f "$SCRIPT_DIR/.env" ]] && set -a && source "$SCRIPT_DIR/.env" && set +a
    port="${FUSION_PORT:-${HUB_PORT:-8080}}"

    echo ""
    echo -e "${CYAN}${BOLD}innate-feeds status${NC}"
    echo "─────────────────────────────"
    if is_running "$bpid"; then
        echo -e "Backend:  ${GREEN}running${NC} (PID ${bpid})"
    else
        echo -e "Backend:  ${RED}stopped${NC}"
    fi
    if is_running "$fpid"; then
        echo -e "Frontend: ${GREEN}running${NC} (PID ${fpid})"
    else
        echo -e "Frontend: ${RED}stopped${NC}"
    fi
    if curl -sf -o /dev/null "http://localhost:${port}/api/sessions" 2>/dev/null; then
        echo -e "API:      ${GREEN}reachable${NC} http://localhost:${port}"
    else
        echo -e "API:      ${RED}unreachable${NC} http://localhost:${port}"
    fi
    if [[ -f "$SCRIPT_DIR/.env" ]]; then
        echo "Database: $(detect_db_mode)"
    fi
    echo ""
}

cmd_logs() {
    local target="${1:-all}"
    case "$target" in
        backend)  tail -n 50 -f "$BACKEND_LOG" ;;
        frontend) tail -n 50 -f "$FRONTEND_LOG" ;;
        all|*)    tail -n 50 -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null ;;
    esac
}

cmd_build() {
    title "Building frontend for production"
    cd "$FRONTEND_DIR"
    [[ -d node_modules ]] || pnpm install --silent
    pnpm build
    ok "Built to $FRONTEND_DIR/dist"
}

cmd_doctor() {
    title "Running diagnostics"
    check_go    || true
    check_node  || true
    check_pnpm  || true

    echo ""
    info "Environment:"
    [[ -f "$SCRIPT_DIR/.env" ]] && ok ".env present" || warn ".env missing — run ./start.sh to create"
    [[ -d "$BACKEND_DIR" ]]     && ok "backend/ present" || err "backend/ missing"
    [[ -d "$FRONTEND_DIR" ]]    && ok "frontend/ present" || err "frontend/ missing"
    [[ -d "TrendRadar" ]]       && ok "TrendRadar/ present" || warn "TrendRadar/ missing (optional)"

    echo ""
    info "Network:"
    local port="${FUSION_PORT:-${HUB_PORT:-8080}}"
    if curl -sf -o /dev/null "http://localhost:${port}/api/sessions" 2>/dev/null; then
        ok "Backend reachable on :${port}"
    else
        warn "Backend not reachable on :${port}"
    fi
    echo ""
}

cmd_reset() {
    warn "This will DELETE the local database and rebuild from scratch."
    read -rp "$(echo -e "${YELLOW}Are you sure?${NC} [y/N]: ")" confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        local db="${FUSION_DB_PATH:-hub.db}"
        rm -f "$db" "$db-journal" "$db-wal" "$db-shm"
        ok "Database wiped. Restart with: ./start.sh"
    else
        info "Cancelled"
    fi
}

# =============================================================================
# Main
# =============================================================================

main() {
    local cmd="${1:-all}"
    local daemon="false"
    local args=()
    for arg in "$@"; do
        case "$arg" in
            -d|--daemon) daemon="true" ;;
            *) args+=("$arg") ;;
        esac
    done
    cmd="${args[0]:-all}"
    local subcmd="${args[1]:-}"

    case "$cmd" in
        all|start|"")           cmd_all "$daemon" ;;
        backend|be)             check_go; ensure_env; start_backend "$daemon" ;;
        frontend|fe)            check_node; check_pnpm; start_frontend "$daemon" ;;
        stop)                   cmd_stop ;;
        status|ps)              cmd_status ;;
        logs|log)               cmd_logs "$subcmd" ;;
        build)                  cmd_build ;;
        doctor)                 cmd_doctor ;;
        reset)                  cmd_reset ;;
        help|--help|-h)         show_help ;;
        *)                      err "Unknown command: $cmd"; show_help; exit 1 ;;
    esac
}

show_help() {
    cat <<EOF
innate-feeds — local starter

Usage:
  ./start.sh                  Start backend + frontend
  ./start.sh backend          Backend only
  ./start.sh frontend         Frontend only
  ./start.sh -d               Daemon mode (run in background)
  ./start.sh stop             Stop all
  ./start.sh status           Show what's running
  ./start.sh logs [target]    Tail logs (target: backend|frontend|all)
  ./start.sh doctor           Sanity-check the install
  ./start.sh build            Build frontend for production
  ./start.sh reset            Wipe the local database (asks first)
  ./start.sh help             This message

Database is auto-detected from FUSION_DB_PATH in .env:
  hub.db (default)            SQLite
  postgres://...              PostgreSQL (local or cloud)
  postgres://...insforge...   InsForge (self-host or managed)

Requirements: Go 1.22+, Node.js 20+, pnpm.
EOF
}

main "$@"
