#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# Innate Hub — One-click Docker Starter
# =============================================================================
# Usage:
#   ./docker-start.sh          # Start with SQLite (default)
#   ./docker-start.sh sqlite   # Start with SQLite
#   ./docker-start.sh postgres # Start with PostgreSQL
#   ./docker-start.sh stop     # Stop all services
#   ./docker-start.sh down     # Stop and remove volumes
#   ./docker-start.sh logs     # Follow logs
#   ./docker-start.sh update   # Pull latest images and restart
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helpers
# =============================================================================

info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
ok()    { echo -e "${GREEN}[OK]${NC} $*"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
error() { echo -e "${RED}[ERROR]${NC} $*" >&2; }

ask() {
    local prompt="$1"
    local default="${2:-}"
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
# Pre-flight checks
# =============================================================================

check_docker() {
    if ! command -v docker &>/dev/null; then
        error "Docker is not installed. Please install Docker first:"
        error "  https://docs.docker.com/get-docker/"
        exit 1
    fi

    if ! docker info &>/dev/null; then
        error "Docker daemon is not running. Please start Docker first."
        exit 1
    fi

    local compose_cmd
    compose_cmd=$(docker compose version &>/dev/null && echo "docker compose" || true)
    if [[ -z "$compose_cmd" ]] && command -v docker-compose &>/dev/null; then
        compose_cmd="docker-compose"
    fi
    if [[ -z "$compose_cmd" ]]; then
        error "Docker Compose is not available. Please install it:"
        error "  https://docs.docker.com/compose/install/"
        exit 1
    fi
    echo "$compose_cmd"
}

check_env() {
    if [[ ! -f ".env" ]]; then
        warn ".env not found, creating from .env.example"
        cp .env.example .env

        info "Please configure your environment variables in .env"
        info "At minimum, you MUST set HUB_PASSWORD"
        echo ""

        local password
        password=$(ask "Enter HUB_PASSWORD" "")
        while [[ -z "$password" ]]; do
            error "HUB_PASSWORD cannot be empty"
            password=$(ask "Enter HUB_PASSWORD" "")
        done

        sed -i.bak "s/^HUB_PASSWORD=.*/HUB_PASSWORD=${password}/" .env && rm -f .env.bak

        local embedder
        embedder=$(ask "Enable semantic search? (openai/ollama/none)" "none")
        if [[ "$embedder" == "openai" ]]; then
            local api_key
            api_key=$(ask "Enter OpenAI API Key" "")
            sed -i.bak 's/^HUB_EMBEDDER_PROVIDER=.*/HUB_EMBEDDER_PROVIDER=openai/' .env
            sed -i.bak "s/^HUB_EMBEDDER_API_KEY=.*/HUB_EMBEDDER_API_KEY=${api_key}/" .env
            sed -i.bak 's/^HUB_EMBEDDER_MODEL=.*/HUB_EMBEDDER_MODEL=text-embedding-3-small/' .env
            rm -f .env.bak
        elif [[ "$embedder" == "ollama" ]]; then
            local base_url model
            base_url=$(ask "Ollama base URL" "http://host.docker.internal:11434")
            model=$(ask "Ollama model" "nomic-embed-text")
            sed -i.bak 's/^HUB_EMBEDDER_PROVIDER=.*/HUB_EMBEDDER_PROVIDER=ollama/' .env
            sed -i.bak "s|^HUB_EMBEDDER_BASE_URL=.*|HUB_EMBEDDER_BASE_URL=${base_url}|" .env
            sed -i.bak "s/^HUB_EMBEDDER_MODEL=.*/HUB_EMBEDDER_MODEL=${model}/" .env
            rm -f .env.bak
        fi

        ok ".env created and configured"
    fi
}

check_trendradar() {
    if [[ -d "TrendRadar/output/news" ]]; then
        info "TrendRadar data found at TrendRadar/output/news"
        local count
        count=$(find TrendRadar/output/news -name "*.db" 2>/dev/null | wc -l)
        ok "Found ${count} TrendRadar database files"
    else
        warn "TrendRadar data not found at TrendRadar/output/news"
        warn "TrendRadar adapter will be registered but no data will be available"
        warn "To enable: clone/generate TrendRadar data first"
    fi
}

# =============================================================================
# Actions
# =============================================================================

cmd_start() {
    local profile="${1:-sqlite}"
    local compose_cmd
    compose_cmd=$(check_docker)

    info "Starting Innate Hub with ${CYAN}${profile}${NC} profile..."

    check_env
    check_trendradar

    info "Building images (this may take a while)..."
    $compose_cmd --profile "$profile" build

    info "Starting services..."
    $compose_cmd --profile "$profile" up -d

    info "Waiting for health check..."
    local retries=30
    local i
    for ((i=1; i<=retries; i++)); do
        if docker ps --filter "name=innate-hub" --format "{{.Status}}" | grep -q "healthy"; then
            ok "Innate Hub is healthy and ready!"
            break
        fi
        echo -n "."
        sleep 2
    done

    if [[ $i -gt retries ]]; then
        warn "Health check timeout. The container may still be starting..."
    fi

    local port
    port=$(grep -E '^HUB_PORT=' .env | cut -d= -f2 | tr -d ' ' || echo "8080")
    port=${port:-8080}

    echo ""
    echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║         Innate Hub is running!                        ║${NC}"
    echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
    echo -e "${GREEN}║  Web UI:   http://localhost:${port}                      ║${NC}"
    echo -e "${GREEN}║  API:      http://localhost:${port}/api                  ║${NC}"
    echo -e "${GREEN}║  Profile:  ${profile}                                    ║${NC}"
    echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
    echo ""
    info "Logs:    $compose_cmd --profile $profile logs -f"
    info "Stop:    ./docker-start.sh stop"
    info "Restart: ./docker-start.sh ${profile}"
}

cmd_stop() {
    local compose_cmd
    compose_cmd=$(check_docker)
    info "Stopping Innate Hub..."
    $compose_cmd --profile sqlite --profile postgres down
    ok "Stopped"
}

cmd_down() {
    local compose_cmd
    compose_cmd=$(check_docker)
    warn "This will stop services AND remove volumes (data will be lost!)"
    read -rp "Are you sure? [y/N]: " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        $compose_cmd --profile sqlite --profile postgres down -v
        ok "Stopped and volumes removed"
    else
        info "Cancelled"
    fi
}

cmd_logs() {
    local compose_cmd
    compose_cmd=$(check_docker)
    $compose_cmd --profile sqlite --profile postgres logs -f
}

cmd_update() {
    local profile="${1:-sqlite}"
    local compose_cmd
    compose_cmd=$(check_docker)
    info "Updating Innate Hub (${profile} profile)..."
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
        sqlite|postgres)
            cmd_start "$cmd"
            ;;
        stop)
            cmd_stop
            ;;
        down)
            cmd_down
            ;;
        logs)
            cmd_logs
            ;;
        update)
            cmd_update "${2:-sqlite}"
            ;;
        help|--help|-h)
            echo "Innate Hub Docker Starter"
            echo ""
            echo "Usage:"
            echo "  ./docker-start.sh          Start with SQLite (default)"
            echo "  ./docker-start.sh sqlite   Start with SQLite"
            echo "  ./docker-start.sh postgres Start with PostgreSQL"
            echo "  ./docker-start.sh stop     Stop all services"
            echo "  ./docker-start.sh down     Stop and remove volumes"
            echo "  ./docker-start.sh logs     Follow logs"
            echo "  ./docker-start.sh update   Rebuild and restart"
            echo ""
            ;;
        *)
            error "Unknown command: $cmd"
            echo "Run './docker-start.sh help' for usage"
            exit 1
            ;;
    esac
}

main "$@"
