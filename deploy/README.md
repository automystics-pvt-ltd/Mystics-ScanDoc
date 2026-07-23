# DocScan — Deployment Guide

One-command deploy from Replit to your server at `docscan.automystics.tech`.

---

## First-time setup (do once)

### 1 — Server setup
SSH into the server and run the setup script:
```bash
ssh automystics-docscan@docscan.automystics.tech 'bash -s' < deploy/server-setup.sh
```
This installs **Node.js** (via NVM), **PM2**, and creates the required directory structure.

### 2 — Configure nginx
Upload and enable the nginx virtual host:
```bash
scp deploy/nginx.conf.example automystics-docscan@docscan.automystics.tech:/tmp/docscan.conf
ssh automystics-docscan@docscan.automystics.tech \
  'sudo mv /tmp/docscan.conf /etc/nginx/sites-available/docscan.automystics.tech && \
   sudo ln -sf /etc/nginx/sites-available/docscan.automystics.tech /etc/nginx/sites-enabled/ && \
   sudo nginx -t && sudo systemctl reload nginx'
```

### 3 — TLS certificate (Let's Encrypt)
```bash
ssh automystics-docscan@docscan.automystics.tech \
  'sudo certbot --nginx -d docscan.automystics.tech'
```

### 4 — Server environment variables
```bash
scp deploy/server.env.example automystics-docscan@docscan.automystics.tech:~/app/.env
ssh automystics-docscan@docscan.automystics.tech 'nano ~/app/.env'
```
Fill in at minimum:
| Variable | Description |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `SESSION_SECRET` | Random 64+ char string |
| `JWT_SECRET` | Another random 64+ char string |
| `PORT` | Leave as `3001` |

### 5 — Configure deploy script
Edit `deploy/config.sh`:
```bash
SSH_KEY="$HOME/.ssh/your_key"       # path to your SSH private key
PROD_DATABASE_URL="postgres://..."  # same as DATABASE_URL on the server
```

> **Email note:** The Resend connector works only inside Replit. After first deploy, log into the admin panel and configure SMTP or a direct email provider API key in **Settings → Email**.

---

## Every deploy

```bash
./deploy.sh
```

That's it. The script:

1. Installs npm dependencies
2. Builds the API server (esbuild bundle)
3. Builds the web app (Vite → static files)
4. Pushes DB schema changes to production
5. rsyncs static files → web root
6. rsyncs API bundle → `~/app/api-server/`
7. Installs externalized npm deps on the server
8. Reloads the PM2 process (zero-downtime)
9. Runs a health check against `/api/healthz`

---

## File layout on the server

```
/home/automystics-docscan/
├── htdocs/docscan.automystics.tech/   ← web root (static files)
│   ├── index.html
│   └── assets/
├── app/
│   ├── .env                           ← environment variables
│   ├── ecosystem.config.cjs           ← PM2 config
│   ├── api-server/
│   │   ├── dist/index.mjs             ← compiled API bundle
│   │   └── node_modules/              ← runtime deps (nodemailer)
│   └── uploads/                       ← document uploads
└── logs/
    ├── api-out.log
    └── api-err.log
```

---

## Useful server commands

```bash
# View live logs
ssh automystics-docscan@docscan.automystics.tech 'pm2 logs docscan-api'

# Restart without redeploying
ssh automystics-docscan@docscan.automystics.tech 'pm2 restart docscan-api'

# View process status
ssh automystics-docscan@docscan.automystics.tech 'pm2 status'

# Connect to production DB
ssh automystics-docscan@docscan.automystics.tech \
  'source ~/app/.env && psql "$DATABASE_URL"'
```
