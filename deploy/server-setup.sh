#!/usr/bin/env bash
# =============================================================================
#  DocScan — One-time server setup
#  Run this ONCE on the server via SSH:
#    ssh automystics-docscan@docscan.automystics.tech 'bash -s' < deploy/server-setup.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
step() { echo -e "\n${CYAN}▶ $1${NC}"; }
ok()   { echo -e "${GREEN}✓ $1${NC}"; }
warn() { echo -e "${YELLOW}⚠ $1${NC}"; }

# ── Node.js via NVM ───────────────────────────────────────────────────────────
step "Installing NVM + Node.js LTS"
if [ ! -d "$HOME/.nvm" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
fi

export NVM_DIR="$HOME/.nvm"
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

nvm install --lts
nvm alias default node
ok "Node $(node -v) installed"

# ── PM2 ───────────────────────────────────────────────────────────────────────
step "Installing PM2"
npm install -g pm2
ok "PM2 $(pm2 --version) installed"

# ── Directory structure ───────────────────────────────────────────────────────
step "Creating directory structure"
mkdir -p "$HOME/app/api-server/dist"
mkdir -p "$HOME/app/api-server/node_modules"
mkdir -p "$HOME/app/uploads"
mkdir -p "$HOME/logs"
mkdir -p "$HOME/htdocs/docscan.automystics.tech"
ok "Directories ready"

# ── .env file ─────────────────────────────────────────────────────────────────
step "Environment file"
if [ ! -f "$HOME/app/.env" ]; then
  warn ".env not found — creating from template"
  cat > "$HOME/app/.env" << 'EOF'
NODE_ENV=production
PORT=3001
DATABASE_URL=CHANGE_ME
SESSION_SECRET=CHANGE_ME
EOF
  echo ""
  warn "Edit $HOME/app/.env before the first deploy!"
  warn "  nano $HOME/app/.env"
else
  ok ".env already exists"
fi

# ── PM2 auto-start on reboot ──────────────────────────────────────────────────
step "Configuring PM2 startup"
pm2 startup | tail -1 || warn "Run the startup command shown above with sudo if needed"

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}  Server setup complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "  Next steps:"
echo "  1. Edit $HOME/app/.env with your database URL and secrets"
echo "  2. Configure nginx (see deploy/nginx.conf.example)"
echo "  3. Get TLS: certbot --nginx -d docscan.automystics.tech"
echo "  4. Run ./deploy.sh from Replit"
