#!/usr/bin/env bash
set -euo pipefail

PROJECT_NAME="${FLOWBIT_PROJECT_NAME:-flowbit-portfolio}"

usage() {
  cat <<'EOF'
Flow Bit - one-command setup helper

Usage:
  ./builder.sh up        Build and start (Docker, recommended)
  ./builder.sh down      Stop containers
  ./builder.sh reset     Stop + remove volumes, then start fresh
  ./builder.sh screenshots Capture portfolio screenshots automatically
  ./builder.sh logs      Tail logs
  ./builder.sh status    Show container status
  ./builder.sh local-dev Install deps and run server+web without Docker
EOF
}

need_cmd() {
  local name="$1"
  if ! command -v "$name" >/dev/null 2>&1; then
    echo "Missing dependency: $name" >&2
    return 1
  fi
}

need_docker() {
  need_cmd docker
  # Ensure the Docker daemon is reachable.
  docker info >/dev/null 2>&1 || {
    echo "Docker is installed but not running (or permission denied)." >&2
    echo "Start Docker Desktop / dockerd and try again." >&2
    return 1
  }
}

compose() {
  docker compose -p "$PROJECT_NAME" "$@"
}

cmd="${1:-up}"

case "$cmd" in
  up)
    need_docker
    compose up -d --build
    cat <<EOF

Started Flow Bit.
- Web:  http://127.0.0.1:8080
- API:  http://127.0.0.1:4000/health

Default login:
- Username: admin
- Password: Admin@123
EOF
    ;;
  down)
    need_docker
    compose down
    ;;
  reset)
    need_docker
    compose down -v
    compose up -d --build
    ;;
  screenshots)
    need_docker
    # Ensure services are up so the screenshot runner can navigate the UI.
    compose up -d --build

    docker run --rm \
      --network "${PROJECT_NAME}_default" \
      -e SCREENSHOT_BASE_URL="http://web:5173" \
      -v "$PWD:/repo" \
      -w /repo \
      mcr.microsoft.com/playwright:v1.51.1-jammy \
      node scripts/capture-screenshots.mjs

    echo
    echo "Saved screenshots to docs/screenshots/."
    ;;
  logs)
    need_docker
    compose logs -f --tail=200
    ;;
  status)
    need_docker
    compose ps
    ;;
  local-dev)
    need_cmd node
    need_cmd npm

    if [[ ! -f server/.env ]]; then
      cp server/.env.example server/.env
    fi
    if [[ ! -f web/.env ]]; then
      cp web/.env.example web/.env
    fi

    echo "Installing backend dependencies..."
    (cd server && npm ci)
    echo "Installing frontend dependencies..."
    (cd web && npm ci)

    echo
    echo "Starting backend + frontend (Ctrl+C to stop)..."

    pids=()
    (cd server && npm run dev) & pids+=("$!")
    (cd web && npm run dev) & pids+=("$!")

    cleanup() {
      for pid in "${pids[@]:-}"; do
        kill "$pid" >/dev/null 2>&1 || true
      done
    }
    trap cleanup INT TERM EXIT

    wait
    ;;
  -h|--help|help)
    usage
    ;;
  *)
    echo "Unknown command: $cmd" >&2
    usage
    exit 2
    ;;
esac
