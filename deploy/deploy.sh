#!/usr/bin/env bash
# =============================================================================
#  DocScan — Deploy script
#  Run on the server after every git pull:
#    cd /home/automystics-docscan/app && bash deploy/deploy.sh
# =============================================================================
set -euo pipefail

APP_DIR="/home/automystics-docscan/app"
HTDOCS="/home/automystics-docscan/htdocs/docscan.automystics.tech"
PORT=3010

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

cd "$APP_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
step "Pulling latest code"
git stash 2>/dev/null || true
git pull origin main
ok "Code updated"

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
pnpm install --frozen-lockfile
ok "Dependencies ready"

# ── 3. Build API ──────────────────────────────────────────────────────────────
step "Building API server"
pnpm --filter @workspace/api-server run build
ok "API built → artifacts/api-server/dist/index.mjs"

# ── 4. Build frontend ─────────────────────────────────────────────────────────
step "Building frontend"
BASE_PATH=/ pnpm --filter @workspace/docscan run build
ok "Frontend built → artifacts/docscan/dist/public/"

# ── 5. Copy frontend to web root ──────────────────────────────────────────────
step "Deploying frontend to $HTDOCS"
mkdir -p "$HTDOCS"
rsync -a --delete artifacts/docscan/dist/public/ "$HTDOCS/"
ok "Frontend deployed"

# ── 6. Kill anything already on the API port ──────────────────────────────────
step "Clearing port $PORT"
if fuser "$PORT/tcp" &>/dev/null 2>&1; then
  echo "  Something is on port $PORT — killing it"
  fuser -k "$PORT/tcp" || true
  sleep 1
fi
ok "Port $PORT is free"

# ── 7. (Re)start PM2 with the correct config ──────────────────────────────────
step "Starting API via PM2"
# Delete any stale process regardless of name, then start fresh from config
pm2 delete docscan-api 2>/dev/null || true
pm2 start deploy/ecosystem.config.cjs
pm2 save
ok "PM2 started"

# ── 8. Smoke-test the API ─────────────────────────────────────────────────────
step "Smoke-testing API"
sleep 2
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://127.0.0.1:$PORT/api/health 2>/dev/null || echo "000")
if [[ "$RESPONSE" == "200" ]]; then
  ok "API responding on port $PORT (HTTP 200)"
else
  fail "API not responding — HTTP $RESPONSE. Check: pm2 logs docscan-api"
fi

# ── 9. Reload nginx ───────────────────────────────────────────────────────────
step "Reloading nginx"
nginx -t && systemctl reload nginx
ok "nginx reloaded"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  API logs:  pm2 logs docscan-api"
echo "  API info:  pm2 show docscan-api"
