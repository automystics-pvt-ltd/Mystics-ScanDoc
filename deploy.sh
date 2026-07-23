#!/usr/bin/env bash
# =============================================================================
#  DocScan — One-command deploy
#  Usage: ./deploy.sh
#
#  First time? Run this on the server once:
#    ssh automystics-docscan@docscan.automystics.tech 'bash -s' < deploy/server-setup.sh
#
#  Then edit deploy/config.sh with your SSH key path + database URL.
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# ── Load config ───────────────────────────────────────────────────────────────
# shellcheck source=deploy/config.sh
source deploy/config.sh

# ── Colours & helpers ─────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; NC='\033[0m'

step()  { echo -e "\n${CYAN}${BOLD}▶  $1${NC}"; }
ok()    { echo -e "   ${GREEN}✓${NC}  $1"; }
warn()  { echo -e "   ${YELLOW}⚠${NC}  $1"; }
die()   { echo -e "\n${RED}✗  $1${NC}\n" >&2; exit 1; }
info()  { echo -e "   ${BOLD}→${NC}  $1"; }

# SSH/rsync shortcuts
SSH_OPTS="-o StrictHostKeyChecking=accept-new -o ConnectTimeout=10 -p ${SSH_PORT} -i ${SSH_KEY}"
REMOTE="${SSH_USER}@${SSH_HOST}"

remote() { ssh $SSH_OPTS "$REMOTE" "$@"; }
rsup()   {   # rsup <local> <remote_path>
  rsync -az --checksum --progress \
    -e "ssh $SSH_OPTS" \
    "$1" "${REMOTE}:$2"
}

# ── Banner ────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${BOLD}║   DocScan — Production Deploy                ║${NC}"
echo -e "${BOLD}║   Target: ${SSH_HOST}  ${NC}${BOLD}              ║${NC}"
echo -e "${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo -e "   $(date '+%Y-%m-%d %H:%M:%S %Z')"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 1 — Pre-flight checks
# ══════════════════════════════════════════════════════════════════════════════
step "Pre-flight checks"

command -v rsync >/dev/null 2>&1 || die "rsync not found — install it first"
command -v pnpm  >/dev/null 2>&1 || die "pnpm not found — run: npm i -g pnpm"
command -v ssh   >/dev/null 2>&1 || die "ssh not found"

[[ -f "$SSH_KEY" ]] || die "SSH key not found: $SSH_KEY\n   Set SSH_KEY in deploy/config.sh"

[[ -n "$PROD_DATABASE_URL" ]] || \
  die "PROD_DATABASE_URL is empty.\n   Set it in deploy/config.sh or export before running:\n   export PROD_DATABASE_URL=postgres://user:pass@host:5432/dbname"

# Test SSH connection
ssh $SSH_OPTS "$REMOTE" "echo ok" >/dev/null 2>&1 \
  || die "Cannot connect to ${REMOTE}\n   Check SSH_KEY / SSH_HOST / SSH_PORT in deploy/config.sh"

ok "SSH connection to ${SSH_HOST} OK"
ok "pnpm $(pnpm --version)"

# Ensure server .env exists
remote "test -f ${REMOTE_APP}/.env" 2>/dev/null || {
  warn ".env not found on server — uploading example template"
  remote "mkdir -p ${REMOTE_APP}"
  rsup deploy/server.env.example "${REMOTE_APP}/.env"
  echo ""
  die "Fill in ${REMOTE_APP}/.env on the server, then re-run deploy.sh\n   ssh ${REMOTE} 'nano ${REMOTE_APP}/.env'"
}
ok "Server .env present"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 2 — Install & build (local)
# ══════════════════════════════════════════════════════════════════════════════
step "Installing dependencies"
pnpm install --frozen-lockfile 2>&1 | tail -3
ok "Dependencies up to date"

step "Building API server"
pnpm --filter @workspace/api-server run build 2>&1 | tail -5
ok "API server built → artifacts/api-server/dist/"

step "Building web app"
NODE_ENV=production \
  BASE_PATH="${VITE_BASE_PATH}" \
  PORT=3000 \
  pnpm --filter @workspace/docscan run build 2>&1 | tail -5
ok "Web app built → artifacts/docscan/dist/public/"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 3 — Database migrations
# ══════════════════════════════════════════════════════════════════════════════
step "Running database migrations"
info "Pushing schema to ${PROD_DATABASE_URL%%@*}@…"
DATABASE_URL="$PROD_DATABASE_URL" \
  pnpm --filter @workspace/db run push-force 2>&1 | tail -8
ok "Schema up to date"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 4 — Deploy web app (static files)
# ══════════════════════════════════════════════════════════════════════════════
step "Deploying web app → ${REMOTE_WEB}"
info "Syncing static files…"
rsync -az --checksum --delete --progress \
  -e "ssh $SSH_OPTS" \
  artifacts/docscan/dist/public/ \
  "${REMOTE}:${REMOTE_WEB}/"
ok "Web app deployed"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 5 — Deploy API server
# ══════════════════════════════════════════════════════════════════════════════
step "Deploying API server → ${REMOTE_APP}/api-server"
remote "mkdir -p ${REMOTE_APP}/api-server/dist ${REMOTE_APP}/api-server/node_modules"

# Upload compiled bundle
info "Uploading bundle…"
rsync -az --checksum --delete --progress \
  -e "ssh $SSH_OPTS" \
  artifacts/api-server/dist/ \
  "${REMOTE}:${REMOTE_APP}/api-server/dist/"

# Upload production package.json (lists externalized deps like nodemailer)
rsup deploy/package.server.json "${REMOTE_APP}/api-server/package.json"

# Upload PM2 ecosystem config
rsup deploy/ecosystem.config.cjs "${REMOTE_APP}/ecosystem.config.cjs"

# Install externalized runtime dependencies on the server
info "Installing server-side npm dependencies (nodemailer etc.)…"
remote "
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
  cd ${REMOTE_APP}/api-server
  npm install --production --silent 2>&1 | tail -3
"
ok "API server deployed"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 6 — Restart via PM2
# ══════════════════════════════════════════════════════════════════════════════
step "Restarting API server (PM2: ${APP_NAME})"
remote "
  export NVM_DIR=\"\$HOME/.nvm\"
  [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"

  cd ${REMOTE_APP}

  if pm2 list 2>/dev/null | grep -q '${APP_NAME}'; then
    echo 'Reloading existing process…'
    pm2 reload ${APP_NAME} --update-env
  else
    echo 'Starting new process…'
    pm2 start ecosystem.config.cjs
    pm2 save
  fi
"
ok "PM2 process running"

# ══════════════════════════════════════════════════════════════════════════════
#  STEP 7 — Health check
# ══════════════════════════════════════════════════════════════════════════════
step "Health check"
info "Waiting 3 s for process to settle…"
sleep 3

HTTP_STATUS=$(curl -sk -o /dev/null -w "%{http_code}" \
  "https://${SSH_HOST}/api/healthz" 2>/dev/null || echo "000")

if [[ "$HTTP_STATUS" == "200" ]]; then
  ok "https://${SSH_HOST}/api/healthz → HTTP 200"
elif [[ "$HTTP_STATUS" == "000" ]]; then
  warn "Could not reach https://${SSH_HOST}/api/healthz"
  warn "If nginx is not yet configured, that's expected."
  warn "Check PM2 on the server:  ssh ${REMOTE} 'pm2 logs ${APP_NAME} --lines 20'"
else
  warn "Health check returned HTTP ${HTTP_STATUS} — check logs below"
  remote "
    export NVM_DIR=\"\$HOME/.nvm\"
    [ -s \"\$NVM_DIR/nvm.sh\" ] && source \"\$NVM_DIR/nvm.sh\"
    pm2 logs ${APP_NAME} --lines 20 --nostream 2>/dev/null || true
  "
fi

# ══════════════════════════════════════════════════════════════════════════════
#  Done
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo -e "${GREEN}${BOLD}╔══════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}${BOLD}║   ✓  Deploy complete                         ║${NC}"
echo -e "${GREEN}${BOLD}╚══════════════════════════════════════════════╝${NC}"
echo ""
echo -e "   🌐  Web:   https://${SSH_HOST}"
echo -e "   🔌  API:   https://${SSH_HOST}/api/healthz"
echo ""
echo -e "   Useful commands on the server:"
echo -e "   ${CYAN}ssh ${REMOTE} 'pm2 status'${NC}"
echo -e "   ${CYAN}ssh ${REMOTE} 'pm2 logs ${APP_NAME}'${NC}"
echo -e "   ${CYAN}ssh ${REMOTE} 'pm2 restart ${APP_NAME}'${NC}"
echo ""
