# DocScan Enterprise — Document Scan & Email System

A full-stack web app that lets logged-in users upload/scan documents and email them as attachments to pre-configured recipients. Admins manage users, recipients, SMTP settings, and view all activity logs.

## Stack

| Layer | Tech |
|---|---|
| Frontend | React + Vite + Tailwind CSS + shadcn/ui (`artifacts/docscan`) |
| Backend | Express.js API (`artifacts/api-server`) |
| Database | PostgreSQL via Drizzle ORM (`lib/db`) |
| API contract | OpenAPI → auto-generated client (`lib/api-client-react`, `lib/api-zod`) |
| Package manager | pnpm (monorepo) |

## How to run

Two workflows must be running:
- **artifacts/api-server: API Server** — Express backend on port 8080 (`/api`)
- **artifacts/docscan: web** — Vite dev server (`/`)

```bash
# Install all dependencies (run once)
pnpm install

# Push DB schema (run when schema changes)
pnpm --filter @workspace/db run push
```

## Environment variables

| Variable | Where set | Notes |
|---|---|---|
| `DATABASE_URL` | Runtime-managed (Replit) | Auto-injected, no action needed |
| `JWT_SECRET` | Shared env var | Set during setup |
| `SESSION_SECRET` | Secret | Set during setup |
| `PORT` | Runtime-managed | Auto-assigned per artifact |
| `BASE_PATH` | Runtime-managed | Auto-assigned per artifact |

## Default admin account

Created during initial setup:
- **Email:** `admin@docscan.local`
- **Password:** `Admin@1234`

**Change this password immediately via the Admin panel after first login.**

## SMTP configuration

SMTP is configured via the Admin → Settings panel in the app (stored in the database). No SMTP env vars are required — the admin enters host, port, username, and password through the UI.

## User preferences
