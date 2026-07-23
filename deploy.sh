#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# deploy.sh — one-command deploy on the production server.
#
# Usage (run on the server inside the repo directory):
#   bash deploy.sh [pm2-app-name]
#
# pm2-app-name defaults to "docscan-api" (matches ecosystem.config.cjs).
# ---------------------------------------------------------------------------
set -euo pipefail

APP="${1:-docscan-api}"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✔  $*${NC}"; }
info() { echo -e "${CYAN}▶  $*${NC}"; }
warn() { echo -e "${YELLOW}⚠  $*${NC}"; }
fail() { echo -e "${RED}✘  $*${NC}"; exit 1; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WEB_ROOT="/home/automystics-docscan/htdocs/docscan.automystics.tech"

echo -e "${CYAN}═══════════════════════════════════════════${NC}"
echo -e "${CYAN}  Deploying DocScan → $APP              ${NC}"
echo -e "${CYAN}═══════════════════════════════════════════${NC}"

# ── Pre-flight: .env + DATABASE_URL must exist ────────────────────────────────
ENV_FILE="$SCRIPT_DIR/.env"
[[ -f "$ENV_FILE" ]] || fail ".env not found at $ENV_FILE — create it with DATABASE_URL and all required secrets."
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is not set in $ENV_FILE"
ok "Pre-flight checks passed"

# ── Step 1 — Pull latest code ─────────────────────────────────────────────────
info "Step 1/7 — Pull latest code from git"
git fetch origin
git reset --hard origin/main
ok "Code up to date"

# ── Step 2 — Install packages ─────────────────────────────────────────────────
info "Step 2/7 — Install packages"
NODE_ENV=development pnpm install --no-frozen-lockfile --ignore-scripts
ok "Packages up to date"

# ── Step 3 — DB schema push ───────────────────────────────────────────────────
info "Step 3/7 — Push DB schema"
(cd lib/db && pnpm exec drizzle-kit push --force --config ./drizzle.config.ts)
ok "DB schema up to date"

# ── Step 4 — Seed default accounts ───────────────────────────────────────────
info "Step 4/7 — Seed default accounts (skipped if already exist)"
pnpm --filter @workspace/db exec tsx src/seed.ts
ok "Accounts ready"

# ── Step 5 — Build API server ─────────────────────────────────────────────────
info "Step 5/7 — Build API server"
pnpm --filter @workspace/api-server run build
ok "API server built"

# ── Step 6 — Build frontend ───────────────────────────────────────────────────
info "Step 6/7 — Build frontend (Vite)"
NODE_ENV=production BASE_PATH=/ PORT=3000 \
  pnpm --filter @workspace/docscan run build
ok "Frontend built → artifacts/docscan/dist/public/"

# Copy static files to nginx web root
rsync -a --delete artifacts/docscan/dist/public/ "$WEB_ROOT/"
ok "Static files deployed to $WEB_ROOT"

# ── Step 7 — Start / Restart PM2 ─────────────────────────────────────────────
info "Step 7/7 — Start/Restart PM2: $APP"
pm2 startOrRestart ecosystem.config.cjs --update-env || fail "PM2 failed — check: pm2 list"
pm2 save
ok "PM2 process running"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}  Deploy complete!  🚀                     ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "  🌐  https://docscan.automystics.tech"
echo -e "  📋  pm2 logs $APP"
echo ""
