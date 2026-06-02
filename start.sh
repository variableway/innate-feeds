#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Innate Hub — One-click Local Starter (SQLite / PostgreSQL / InsForge)
# =============================================================================
# Usage:
#   ./start.sh              # Start backend + frontend (foreground)
#   ./start.sh backend      # Start backend only
#   ./start.sh frontend     # Start frontend only
#   ./start.sh --daemon     # Start in background
#   ./start.sh -d           # Alias for --daemon
#   ./start.sh stop         # Stop all services
#   ./start.sh status       # Check running status
#   ./start.sh logs         # Follow logs
#   ./start.sh build        # Build frontend for production
#   ./start.sh clean        # Remove build artifacts and logs
#   ./start.sh help         # Show help
#
# Database mode is auto-detected from HUB_DB_PATH in .env:
#   - hub.db  (or any non-postgres path) → SQLite mode
#   - postgres://...  → PostgreSQL mode (InsForge, cloud, etc.)
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/backend"
FRONTEND_DIR="$SCRIPT_DIR/frontend"
PID_DIR="$SCRIPT_DIR/.run"
LOG_DIR="$SCRIPT_DIR/.run"

mkdir -p "$PID_DIR" "$LOG_DIR"

BACKEND_PID_FILE="$PID_DIR/backend.pid"
FRONTEND_PID_FILE="$PID_DIR/frontend.pid"
BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

ask() {
    local prompt="$1" default="${2:-}"
    local answer
    if [[ -n "$default" ]]; then
        read -rp "${prompt} [${default}]: " answer
        echo "${answer:-$default}"
    else
        read -rp "${prompt}: " answer
        echo "$answer"
    fi
}

# =============================================================================
# Dependency checks
# =============================================================================

check_go() {
    if ! command -v go &>/dev/null; then
        error "Go is not installed. Please install Go 1.26+ first:"
        error "  https://go.dev/dl/"
        exit 1
    fi
    local ver
    ver=$(go version | grep -oE 'go[0-9]+\.[0-9]+' | head -1 | sed 's/go//')
    local major minor
    major=$(echo "$ver" | cut -d. -f1)
    minor=$(echo "$ver" | cut -d. -f2)
    if [[ "$major" -lt 1 ]] || { [[ "$major" -eq 1 ]] && [[ "$minor" -lt 26 ]]; }; then
        error "Go 1.26+ required, found ${ver}"
        exit 1
    fi
    ok "Go ${ver}"
}

check_node() {
    if ! command -v node &>/dev/null; then
        error "Node.js is not installed. Please install Node.js 20+ first:"
        error "  https://nodejs.org/"
        exit 1
    fi
    local ver
    ver=$(node --version | grep -oE '[0-9]+' | head -1)
    if [[ "$ver" -lt 20 ]]; then
        error "Node.js 20+ required, found $(node --version)"
        exit 1
    fi
    ok "Node.js $(node --version)"
}

check_pnpm() {
    if ! command -v pnpm &>/dev/null; then
        warn "pnpm not found, trying to install via corepack..."
        if command -v corepack &>/dev/null; then
            corepack enable
            corepack prepare pnpm@latest --activate
        else
            error "pnpm is not installed. Please install it:"
            error "  npm install -g pnpm"
            error "  or: corepack enable && corepack prepare pnpm@latest --activate"
            exit 1
        fi
    fi
    ok "pnpm $(pnpm --version)"
}

check_env() {
    local env_file="$SCRIPT_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        warn ".env not found, creating from .env.example"
        cp "$SCRIPT_DIR/.env.example" "$env_file"

        info "Please configure your environment variables"
        local password
        password=$(ask "Enter HUB_PASSWORD" "")
        while [[ -z "$password" ]]; do
            error "HUB_PASSWORD cannot be empty"
            password=$(ask "Enter HUB_PASSWORD" "")
        done

        sed -i.bak "s/^HUB_PASSWORD=.*/HUB_PASSWORD=${password}/" "$env_file" && rm -f "$env_file.bak"

        # Database selection
        local db_choice
        db_choice=$(ask "Database? (sqlite/postgres/insforge)" "sqlite")
        if [[ "$db_choice" == "postgres" ]] || [[ "$db_choice" == "insforge" ]]; then
            local pg_url
            if [[ "$db_choice" == "insforge" ]]; then
                info "Enter your InsForge PostgreSQL connection URL"
                info "Format: postgres://user:password@host:5432/dbname?sslmode=require"
                pg_url=$(ask "PostgreSQL URL" "")
            else
                pg_url=$(ask "PostgreSQL URL" "postgres://hub:hub@localhost:5432/hub?sslmode=disable")
            fi
            sed -i.bak "s|^HUB_DB_PATH=.*|HUB_DB_PATH=${pg_url}|" "$env_file" && rm -f "$env_file.bak"
            ok "Configured PostgreSQL database"
        fi

        local embedder
        embedder=$(ask "Enable semantic search? (openai/ollama/none)" "none")
        if [[ "$embedder" == "openai" ]]; then
            local api_key
            api_key=$(ask "Enter OpenAI API Key" "")
            sed -i.bak 's/^HUB_EMBEDDER_PROVIDER=.*/HUB_EMBEDDER_PROVIDER=openai/' "$env_file"
            sed -i.bak "s/^HUB_EMBEDDER_API_KEY=.*/HUB_EMBEDDER_API_KEY=${api_key}/" "$env_file"
            sed -i.bak 's/^HUB_EMBEDDER_MODEL=.*/HUB_EMBEDDER_MODEL=text-embedding-3-small/' "$env_file"
            rm -f "$env_file.bak"
        elif [[ "$embedder" == "ollama" ]]; then
            local base_url model
            base_url=$(ask "Ollama base URL" "http://localhost:11434")
            model=$(ask "Ollama model" "nomic-embed-text")
            sed -i.bak 's/^HUB_EMBEDDER_PROVIDER=.*/HUB_EMBEDDER_PROVIDER=ollama/' "$env_file"
            sed -i.bak "s|^HUB_EMBEDDER_BASE_URL=.*|HUB_EMBEDDER_BASE_URL=${base_url}|" "$env_file"
            sed -i.bak "s/^HUB_EMBEDDER_MODEL=.*/HUB_EMBEDDER_MODEL=${model}/" "$env_file"
            rm -f "$env_file.bak"
        fi

        ok ".env created and configured"
    fi

    # Show current database mode
    local db_path
    db_path=$(grep -E '^HUB_DB_PATH=' "$env_file" 2>/dev/null | cut -d= -f2- | tr -d ' ' || echo "hub.db")
    if [[ "$db_path" == postgres://* ]] || [[ "$db_path" == postgresql://* ]]; then
        ok "Database mode: PostgreSQL"
    else
        ok "Database mode: SQLite (${db_path})"
    fi
}

# =============================================================================
# Process helpers
# =============================================================================

save_pid() {
    local file="$1" pid="$2"
    echo "$pid" > "$file"
}

get_pid() {
    local file="$1"
    if [[ -f "$file" ]]; then
        cat "$file" 2>/dev/null || echo ""
    else
        echo ""
    fi
}

is_running() {
    local pid="$1"
    [[ -n "$pid" ]] && kill -0 "$pid" 2>/dev/null
}

stop_service() {
    local name="$1" pid_file="$2"
    local pid
    pid=$(get_pid "$pid_file")
    if is_running "$pid"; then
        info "Stopping ${name} (PID: ${pid})..."
        kill "$pid" 2>/dev/null || true
        sleep 1
        if is_running "$pid"; then
            kill -9 "$pid" 2>/dev/null || true
        fi
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
    pid=$(get_pid "$BACKEND_PID_FILE")
    if is_running "$pid"; then
        warn "Backend already running (PID: ${pid})"
        return 0
    fi

    info "Starting backend..."
    cd "$BACKEND_DIR"

    # Source .env
    set -a
    # shellcheck source=/dev/null
    source "$SCRIPT_DIR/.env"
    set +a

    if [[ "$daemon" == "true" ]]; then
        nohup go run ./cmd/hub > "$BACKEND_LOG" 2>&1 &
        pid=$!
        save_pid "$BACKEND_PID_FILE" "$pid"
        info "Backend started in background (PID: ${pid})"
        info "Logs: tail -f ${BACKEND_LOG}"
    else
        info "Backend starting (Ctrl+C to stop)..."
        go run ./cmd/hub &
        pid=$!
        save_pid "$BACKEND_PID_FILE" "$pid"
        wait "$pid" || true
    fi
}

start_frontend() {
    local daemon="${1:-false}"

    local pid
    pid=$(get_pid "$FRONTEND_PID_FILE")
    if is_running "$pid"; then
        warn "Frontend already running (PID: ${pid})"
        return 0
    fi

    info "Starting frontend..."
    cd "$FRONTEND_DIR"

    # Install deps if needed
    if [[ ! -d "node_modules" ]]; then
        info "Installing frontend dependencies (this may take a while)..."
        pnpm install
    fi

    if [[ "$daemon" == "true" ]]; then
        nohup pnpm dev > "$FRONTEND_LOG" 2>&1 &
        pid=$!
        save_pid "$FRONTEND_PID_FILE" "$pid"
        info "Frontend started in background (PID: ${pid})"
        info "Logs: tail -f ${FRONTEND_LOG}"
    else
        info "Frontend starting (Ctrl+C to stop)..."
        pnpm dev &
        pid=$!
        save_pid "$FRONTEND_PID_FILE" "$pid"
        wait "$pid" || true
    fi
}

# =============================================================================
# Commands
# =============================================================================

cmd_all() {
    local daemon="${1:-false}"

    check_go
    check_node
    check_pnpm
    check_env

    # Start backend first
    start_backend "$daemon"

    # Wait a moment for backend to bind port
    if [[ "$daemon" == "true" ]]; then
        sleep 2
        info "Waiting for backend to be ready..."
        local port
        port=$(grep -E '^HUB_PORT=' "$SCRIPT_DIR/.env" | cut -d= -f2 | tr -d ' ' || echo "8080")
        port=${port:-8080}
        local retries=30
        local i
        for ((i=1; i<=retries; i++)); do
            if curl -sf "http://localhost:${port}/api/sessions" &>/dev/null; then
                ok "Backend ready on port ${port}"
                break
            fi
            echo -n "."
            sleep 1
        done
        if [[ $i -gt retries ]]; then
            warn "Backend may not be ready yet. Check logs: tail -f ${BACKEND_LOG}"
        fi
    fi

    # Start frontend
    start_frontend "$daemon"

    if [[ "$daemon" == "true" ]]; then
        sleep 2
        local backend_pid frontend_pid
        backend_pid=$(get_pid "$BACKEND_PID_FILE")
        frontend_pid=$(get_pid "$FRONTEND_PID_FILE")

        echo ""
        echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
        echo -e "${GREEN}║         Innate Hub is running!                        ║${NC}"
        echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
        echo -e "${GREEN}║  API:      http://localhost:${port:-8080}                  ║${NC}"
        echo -e "${GREEN}║  Frontend: http://localhost:5173                       ║${NC}"
        echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
        echo ""
        info "Backend PID:  ${backend_pid:-?}"
        info "Frontend PID: ${frontend_pid:-?}"
        info "Logs: tail -f ${BACKEND_LOG} ${FRONTEND_LOG}"
        info "Stop: ./start.sh stop"
    fi
}

cmd_stop() {
    stop_service "Backend" "$BACKEND_PID_FILE"
    stop_service "Frontend" "$FRONTEND_PID_FILE"
    ok "All services stopped"
}

cmd_status() {
    local backend_pid frontend_pid
    backend_pid=$(get_pid "$BACKEND_PID_FILE")
    frontend_pid=$(get_pid "$FRONTEND_PID_FILE")

    echo ""
    echo -e "${CYAN}Innate Hub Status${NC}"
    echo "─────────────────────────────────────────────"

    if is_running "$backend_pid"; then
        echo -e "Backend:  ${GREEN}running${NC} (PID: ${backend_pid})"
    else
        echo -e "Backend:  ${RED}stopped${NC}"
    fi

    if is_running "$frontend_pid"; then
        echo -e "Frontend: ${GREEN}running${NC} (PID: ${frontend_pid})"
    else
        echo -e "Frontend: ${RED}stopped${NC}"
    fi

    # Check ports
    local port
    port=$(grep -E '^HUB_PORT=' "$SCRIPT_DIR/.env" 2>/dev/null | cut -d= -f2 | tr -d ' ' || echo "8080")
    port=${port:-8080}
    if curl -sf "http://localhost:${port}/api/sessions" &>/dev/null; then
        echo -e "API:      ${GREEN}reachable${NC} http://localhost:${port}"
    else
        echo -e "API:      ${RED}unreachable${NC} http://localhost:${port}"
    fi
    echo ""
}

cmd_logs() {
    local target="${1:-all}"
    case "$target" in
        backend)
            tail -f "$BACKEND_LOG"
            ;;
        frontend)
            tail -f "$FRONTEND_LOG"
            ;;
        all|*)
            tail -f "$BACKEND_LOG" "$FRONTEND_LOG" 2>/dev/null
            ;;
    esac
}

cmd_build() {
    info "Building frontend for production..."
    cd "$FRONTEND_DIR"
    if [[ ! -d "node_modules" ]]; then
        pnpm install
    fi
    pnpm build
    ok "Frontend built to ${FRONTEND_DIR}/dist"
}

cmd_clean() {
    warn "This will remove build artifacts and logs"
    read -rp "Are you sure? [y/N]: " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        rm -rf "$FRONTEND_DIR/dist" "$FRONTEND_DIR/node_modules"
        rm -f "$BACKEND_LOG" "$FRONTEND_LOG"
        rm -f "$BACKEND_PID_FILE" "$FRONTEND_PID_FILE"
        ok "Cleaned"
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

    # Check for --daemon or -d flag anywhere in args
    for arg in "$@"; do
        if [[ "$arg" == "--daemon" ]] || [[ "$arg" == "-d" ]]; then
            daemon="true"
        fi
    done

    # Remove daemon flags from args for command parsing
    local args=()
    for arg in "$@"; do
        if [[ "$arg" != "--daemon" ]] && [[ "$arg" != "-d" ]]; then
            args+=("$arg")
        fi
    done
    cmd="${args[0]:-all}"
    local subcmd="${args[1]:-}"

    case "$cmd" in
        all|start|"")
            cmd_all "$daemon"
            ;;
        backend|be)
            check_go
            check_env
            start_backend "$daemon"
            ;;
        frontend|fe)
            check_node
            check_pnpm
            cd "$FRONTEND_DIR"
            if [[ ! -d "node_modules" ]]; then
                pnpm install
            fi
            start_frontend "$daemon"
            ;;
        stop)
            cmd_stop
            ;;
        status|ps)
            cmd_status
            ;;
        logs|log)
            cmd_logs "$subcmd"
            ;;
        build)
            cmd_build
            ;;
        clean)
            cmd_clean
            ;;
        help|--help|-h)
            echo "Innate Hub Local Starter (SQLite / PostgreSQL / InsForge)"
            echo ""
            echo "Usage:"
            echo "  ./start.sh              Start backend + frontend"
            echo "  ./start.sh backend      Start backend only"
            echo "  ./start.sh frontend     Start frontend only"
            echo "  ./start.sh -d           Start in background (daemon mode)"
            echo "  ./start.sh stop         Stop all services"
            echo "  ./start.sh status       Check running status"
            echo "  ./start.sh logs         Follow all logs"
            echo "  ./start.sh logs backend Follow backend logs only"
            echo "  ./start.sh build        Build frontend for production"
            echo "  ./start.sh clean        Remove build artifacts and logs"
            echo ""
            echo "Database mode (auto-detected from HUB_DB_PATH in .env):"
            echo "  SQLite (default)    : HUB_DB_PATH=hub.db"
            echo "  PostgreSQL          : HUB_DB_PATH=postgres://..."
            echo "  InsForge            : HUB_DB_PATH=postgres://user:pass@insforge.host/..."
            echo ""
            echo "Requirements: Go 1.26+, Node.js 20+, pnpm"
            echo ""
            ;;
        *)
            error "Unknown command: $cmd"
            echo "Run './start.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
