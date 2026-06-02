#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# innate-feeds — Docker Compose starter
# =============================================================================
# Starts the full stack via docker compose. Available profiles:
#   sqlite    (default)   SQLite, single container
#   postgres              PostgreSQL + pgvector, two containers
#   insforge              InsForge self-host stack (postgres + studio)
#   stack                 innate-hub + Fusion UI side-by-side
#
# Usage:
#   ./docker-start.sh                # sqlite (default)
#   ./docker-start.sh sqlite
#   ./docker-start.sh postgres
#   ./docker-start.sh insforge
#   ./docker-start.sh stack
#   ./docker-start.sh stop
#   ./docker-start.sh down           # also wipes volumes
#   ./docker-start.sh logs
#   ./docker-start.sh ps
#   ./docker-start.sh help
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

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
# Pre-flight
# =============================================================================

detect_compose() {
    if docker compose version &>/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose &>/dev/null; then
        echo "docker-compose"
    else
        err "Docker Compose is not installed."
        err "Install it from https://docs.docker.com/compose/install/"
        exit 1
    fi
}

check_docker() {
    if ! command -v docker &>/dev/null; then
        err "Docker is not installed. Get it from https://docs.docker.com/get-docker/"
        exit 1
    fi
    if ! docker info &>/dev/null; then
        err "Docker daemon is not running. Start Docker Desktop (or systemd) first."
        exit 1
    fi
    ok "Docker ready"
}

# =============================================================================
# .env bootstrap
# =============================================================================

ensure_env() {
    local env_file="$SCRIPT_DIR/.env"
    if [[ ! -f "$env_file" ]]; then
        warn ".env not found — creating from .env.example"
        cp "$SCRIPT_DIR/.env.example" "$env_file"
        interactive_configure "$env_file"
    fi

    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
}

set_env() {
    local env_file="$1" key="$2" value="$3"
    local escaped
    escaped=$(printf '%s\n' "$value" | sed 's/[\/&]/\\&/g')
    if grep -qE "^${key}=" "$env_file"; then
        sed -i.bak "s|^${key}=.*|${key}=${escaped}|" "$env_file"
        rm -f "$env_file.bak"
    else
        printf '\n%s=%s\n' "$key" "$value" >> "$env_file"
    fi
}

interactive_configure() {
    local env_file="$1"
    echo ""
    echo -e "${BOLD}Welcome to innate-feeds (docker mode)!${NC}"
    echo ""

    local password
    password=$(ask "Set a password for the web UI (FUSION_PASSWORD)")
    while [[ -z "$password" ]]; do
        password=$(ask "Password cannot be empty. Try again")
    done
    set_env "$env_file" "FUSION_PASSWORD" "$password"

    # Note: in docker mode the database choice is the compose profile,
    # so we don't ask here. The compose file picks the right FUSION_DB_PATH.

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
            ollama_url=$(ask "Ollama base URL" "http://host.docker.internal:11434")
            set_env "$env_file" "HUB_EMBEDDER_BASE_URL" "$ollama_url"
            local model
            model=$(ask "Ollama model" "nomic-embed-text")
            set_env "$env_file" "HUB_EMBEDDER_MODEL" "$model"
            ;;
    esac

    echo ""
    ok "Configuration saved to .env"
}

# =============================================================================
# Profile actions
# =============================================================================

start_profile() {
    local profile="$1"
    local compose_cmd
    compose_cmd=$(detect_compose)

    title "Starting profile: ${CYAN}${profile}${NC}"
    check_docker
    ensure_env

    info "Building images (first run takes a while)..."
    $compose_cmd --profile "$profile" build

    info "Bringing services up..."
    $compose_cmd --profile "$profile" up -d

    wait_healthy "$compose_cmd" "$profile"

    show_status_box "$compose_cmd" "$profile"
}

wait_healthy() {
    local compose_cmd="$1" profile="$2"
    info "Waiting for the hub to be healthy (up to 60s)..."
    local i
    for i in $(seq 1 30); do
        if $compose_cmd ps --format json 2>/dev/null | grep -q '"Health":"healthy"'; then
            ok "Hub is healthy"
            return 0
        fi
        sleep 2
    done
    warn "Hub did not become healthy in 60s. Check logs: $compose_cmd --profile $profile logs"
    return 1
}

show_status_box() {
    local compose_cmd="$1" profile="$2"
    local port="${FUSION_PORT:-8080}"
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║        innate-feeds is running!                      ║${NC}"
    echo -e "${GREEN}╠══════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Profile:  ${profile}                                    ║${NC}"
    case "$profile" in
        postgres)
            echo -e "${GREEN}║  Hub:      http://localhost:${port}                     ║${NC}"
            echo -e "${GREEN}║  Postgres: localhost:5432 (hub/hub)                 ║${NC}"
            ;;
        insforge)
            echo -e "${GREEN}║  Hub:      http://localhost:${port}                     ║${NC}"
            echo -e "${GREEN}║  InsForge: see InsForge Studio on its port         ║${NC}"
            ;;
        stack)
            echo -e "${GREEN}║  Hub:      http://localhost:${port}                     ║${NC}"
            echo -e "${GREEN}║  Fusion:   http://localhost:8081                    ║${NC}"
            ;;
        *)
            echo -e "${GREEN}║  Hub:      http://localhost:${port}                     ║${NC}"
            ;;
    esac
    echo -e "${GREEN}╚══════════════════════════════════════════════════════╝${NC}"
    echo ""
    info "Stop:    $compose_cmd --profile $profile down"
    info "Logs:    $compose_cmd --profile $profile logs -f"
    info "Status:  ./docker-start.sh ps"
}

cmd_stop() {
    local compose_cmd
    compose_cmd=$(detect_compose)
    title "Stopping all services"
    $compose_cmd --profile sqlite --profile postgres --profile insforge --profile stack down
    ok "Stopped"
}

cmd_down() {
    local compose_cmd
    compose_cmd=$(detect_compose)
    warn "This stops services AND removes volumes (data is lost)."
    read -rp "$(echo -e "${YELLOW}Are you sure?${NC} [y/N]: ")" confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        $compose_cmd --profile sqlite --profile postgres --profile insforge --profile stack down -v
        ok "Stopped, volumes removed"
    else
        info "Cancelled"
    fi
}

cmd_logs() {
    local compose_cmd
    compose_cmd=$(detect_compose)
    $compose_cmd --profile sqlite --profile postgres --profile insforge --profile stack logs -f
}

cmd_ps() {
    local compose_cmd
    compose_cmd=$(detect_compose)
    $compose_cmd --profile sqlite --profile postgres --profile insforge --profile stack ps
}

cmd_update() {
    local profile="${1:-sqlite}"
    local compose_cmd
    compose_cmd=$(detect_compose)
    title "Updating profile: ${profile}"
    $compose_cmd --profile "$profile" pull 2>/dev/null || true
    $compose_cmd --profile "$profile" build --no-cache
    $compose_cmd --profile "$profile" up -d --force-recreate
    ok "Updated and restarted"
}

# =============================================================================
# Main
# =============================================================================

main() {
    local cmd="${1:-sqlite}"

    case "$cmd" in
        sqlite|postgres|insforge|stack)  start_profile "$cmd" ;;
        stop)                            cmd_stop ;;
        down)                            cmd_down ;;
        logs)                            cmd_logs ;;
        ps)                              cmd_ps ;;
        update)                          cmd_update "${2:-sqlite}" ;;
        help|--help|-h)                  show_help ;;
        *)                               err "Unknown command: $cmd"; show_help; exit 1 ;;
    esac
}

show_help() {
    cat <<EOF
innate-feeds — Docker Compose starter

Usage:
  ./docker-start.sh                Start SQLite (default)
  ./docker-start.sh sqlite         Single container, SQLite
  ./docker-start.sh postgres       PostgreSQL + pgvector
  ./docker-start.sh insforge       Self-host InsForge for the database
  ./docker-start.sh stack          innate-hub + Fusion UI side-by-side
  ./docker-start.sh stop           Stop all
  ./docker-start.sh down           Stop all and remove volumes
  ./docker-start.sh ps             Show running services
  ./docker-start.sh logs           Tail all logs
  ./docker-start.sh update         Rebuild and restart the default profile

Profiles:
  sqlite     Zero-config, file-backed DB. Best for development.
  postgres   Uses pgvector/pgvector:pg16 for native vector search.
  insforge   Spins up the InsForge self-host stack (Postgres + Studio).
  stack      Runs innate-hub + Fusion as separate services.

After first start, the Hub will be on http://localhost:8080 (login with
FUSION_PASSWORD from .env).
EOF
}

main "$@"
