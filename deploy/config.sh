#!/usr/bin/env bash
# =============================================================================
#  DocScan — Deployment Configuration
#  Edit this file once, then just run: ./deploy.sh
# =============================================================================

# ── SSH ───────────────────────────────────────────────────────────────────────
SSH_USER="automystics-docscan"
SSH_HOST="docscan.automystics.tech"
SSH_PORT="22"
SSH_KEY="$HOME/.ssh/id_rsa"          # path to your private key

# ── Remote paths ──────────────────────────────────────────────────────────────
REMOTE_WEB="/home/automystics-docscan/htdocs/docscan.automystics.tech"
REMOTE_APP="/home/automystics-docscan/app"   # API server + .env (outside web root)

# ── API server ────────────────────────────────────────────────────────────────
API_PORT="3001"                      # internal port — nginx proxies to this
APP_NAME="docscan-api"               # PM2 process name

# ── Database ──────────────────────────────────────────────────────────────────
# Set PROD_DATABASE_URL here OR export it in your shell before running deploy.sh
# Example: postgres://user:pass@localhost:5432/docscan_prod
PROD_DATABASE_URL="${PROD_DATABASE_URL:-}"

# ── Build ─────────────────────────────────────────────────────────────────────
# BASE_PATH must be "/" when the app is at the root of the domain.
# Change to "/subfolder" if mounted at a path, e.g. "/app"
VITE_BASE_PATH="/"
