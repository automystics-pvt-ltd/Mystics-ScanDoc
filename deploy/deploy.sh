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
SCRIPT="artifacts/api-server/dist/index.mjs"

GREEN='\033[0;32m'; CYAN='\033[0;36m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }
fail() { echo -e "${RED}✗ $1${NC}"; exit 1; }

cd "$APP_DIR"

# ── 1. Pull latest code ───────────────────────────────────────────────────────
step "Pulling latest code"
git stash 2>/dev/null || true
git pull origin main
ok "Code updated to $(git rev-parse --short HEAD)"

# ── 2. Install dependencies ───────────────────────────────────────────────────
step "Installing dependencies"
pnpm install --frozen-lockfile
ok "Dependencies ready"

# ── 3. Build API ──────────────────────────────────────────────────────────────
step "Building API server"
pnpm --filter @workspace/api-server run build
[[ -f "$SCRIPT" ]] || fail "Build output missing: $SCRIPT"
ok "API built → $SCRIPT"

# ── 4. Build frontend ─────────────────────────────────────────────────────────
step "Building frontend"
BASE_PATH=/ pnpm --filter @workspace/docscan run build
ok "Frontend built → artifacts/docscan/dist/public/"

# ── 5. Copy frontend to web root ──────────────────────────────────────────────
step "Deploying frontend to $HTDOCS"
mkdir -p "$HTDOCS"
rsync -a --delete artifacts/docscan/dist/public/ "$HTDOCS/"
ok "Frontend deployed"

# ── 6. Completely clear port $PORT ───────────────────────────────────────────
step "Clearing port $PORT — killing every process on it"
# Kill via fuser (most reliable)
if command -v fuser &>/dev/null; then
  fuser -k "${PORT}/tcp" 2>/dev/null && echo "  fuser: killed processes on $PORT" || true
fi
# Kill via lsof as fallback
if command -v lsof &>/dev/null; then
  PIDS=$(lsof -ti :"$PORT" 2>/dev/null || true)
  if [[ -n "$PIDS" ]]; then
    echo "  lsof: killing PIDs $PIDS"
    kill -9 $PIDS 2>/dev/null || true
  fi
fi
sleep 2
# Verify port is actually free
if command -v fuser &>/dev/null && fuser "${PORT}/tcp" &>/dev/null 2>&1; then
  fail "Port $PORT is still occupied after kill attempt. Check: fuser ${PORT}/tcp"
fi
ok "Port $PORT is free"

# ── 7. Wipe ALL PM2 processes and start fresh ─────────────────────────────────
step "Resetting PM2 and starting DocScan API"
# Delete every saved PM2 process to ensure no stale/conflicting entry survives
pm2 delete all 2>/dev/null || true
sleep 1
pm2 start deploy/ecosystem.config.cjs
pm2 save --force
ok "PM2 started"

# ── 8. Verify the correct script is running ───────────────────────────────────
step "Verifying correct binary is running"
sleep 2
RUNNING_SCRIPT=$(pm2 show docscan-api 2>/dev/null | grep "script path" | awk '{print $NF}' || echo "unknown")
echo "  PM2 script: $RUNNING_SCRIPT"
if [[ "$RUNNING_SCRIPT" != *"$SCRIPT"* && "$RUNNING_SCRIPT" != "unknown" ]]; then
  warn "PM2 is running a different script: $RUNNING_SCRIPT"
fi

# ── 9. Smoke-test: confirm our server responds ─────────────────────────────────
step "Smoke-testing API on port $PORT"
sleep 1
HTTP_CODE=$(curl -s -o /tmp/docscan-health.json -w "%{http_code}" \
  http://127.0.0.1:$PORT/api/health 2>/dev/null || echo "000")
BODY=$(cat /tmp/docscan-health.json 2>/dev/null || echo "(no body)")

echo "  HTTP $HTTP_CODE — $BODY"

if [[ "$HTTP_CODE" == "200" ]]; then
  ok "API responding on port $PORT"
elif [[ "$HTTP_CODE" == "000" ]]; then
  fail "No response on port $PORT — our server likely crashed. Check: pm2 logs docscan-api"
else
  warn "Unexpected HTTP $HTTP_CODE — check: pm2 logs docscan-api"
fi

# ── 10. Reload nginx ──────────────────────────────────────────────────────────
step "Reloading nginx"
nginx -t && systemctl reload nginx
ok "nginx reloaded"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Tail API logs:  pm2 logs docscan-api --lines 50"
echo "  Show process:   pm2 show docscan-api"
echo "  Manual test:    curl http://127.0.0.1:$PORT/api/health"
