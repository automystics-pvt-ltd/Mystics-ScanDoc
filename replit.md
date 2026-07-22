# DocScan — Document Scan & Email System

A corporate-grade document scan and email system. Users upload/scan documents (PDF, JPG, PNG) and send them to pre-configured recipients via email. Admins manage users, recipients, SMTP settings, and view full audit trails.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080, proxied at /api)
- `pnpm --filter @workspace/docscan run dev` — run the frontend (port 23025, proxied at /)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string, `SESSION_SECRET` — JWT signing secret

## Default Credentials

- **Admin:** admin@docscan.com / password
- **User:** jane@example.com / password
- **User:** bob@example.com / password

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, wouter routing, shadcn/ui, TanStack Query, Tailwind CSS
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Auth: JWT (jsonwebtoken) + bcryptjs
- File upload: multer (local disk /uploads)
- Email: nodemailer (configurable SMTP; simulated if unconfigured)
- Validation: Zod (zod/v4), drizzle-zod
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `lib/api-spec/openapi.yaml` — OpenAPI spec (source of truth for all contracts)
- `lib/db/src/schema/` — Drizzle table definitions (users, documents, email_logs, recipients, settings, audit_logs)
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/middlewares/auth.ts` — JWT auth middleware + requireAuth/requireAdmin guards
- `artifacts/docscan/src/` — React frontend (pages, components, auth context)
- `artifacts/docscan/uploads/` — uploaded document files (local disk)

## Architecture decisions

- **No self-registration** — Admin creates all user accounts. Only admin role can POST /api/admin/users.
- **Recipients pre-configured by Admin** — Users cannot choose where to send; Admin sets up global or per-user recipients (up to 5).
- **JWT stored in localStorage** — Token key: `docscan_token`. Injected as Bearer header via the custom-fetch.ts mutator.
- **SMTP optional** — If no SMTP is configured in settings, sends are marked "sent" (demo/dev mode). Configure real SMTP in Admin > Settings.
- **File storage** — Local disk at `artifacts/api-server/uploads/`. For production, replace multer disk storage with S3-compatible object storage.
- **Role-based routing** — Admin redirects to /dashboard; users redirect to /upload on login.

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- After any OpenAPI spec change, always re-run codegen before modifying routes or frontend.
- bcrypt is replaced with bcryptjs (pure JS) because pnpm blocks native build scripts for bcrypt.
- The /documents/upload endpoint is multipart/form-data (not in the OpenAPI spec); it's called manually with raw fetch in the Upload page.
- JWT secret falls back to SESSION_SECRET env var, then a hardcoded dev default. Always set SESSION_SECRET in production.
