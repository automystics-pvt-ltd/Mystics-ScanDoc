/**
 * Seed default admin and regular user accounts.
 * Invoked by deploy.sh after drizzle-kit push.
 */
import { createRequire } from "module";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Resolve packages from api-server's node_modules by anchoring to a
// (real or fictional) file inside that package directory.
const apiServerBase = path.resolve(__dirname, "../artifacts/api-server/__seed__.js");
const require = createRequire(apiServerBase);

const { Pool } = require("pg");

let bcrypt;
try {
  bcrypt = require("bcryptjs");
} catch {
  // pnpm content-addressable fallback
  const candidates = [
    path.resolve(__dirname, "../node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs"),
    path.resolve(__dirname, "../artifacts/api-server/node_modules/bcryptjs"),
  ];
  for (const c of candidates) {
    try { bcrypt = require(c); break; } catch { /* try next */ }
  }
  if (!bcrypt) throw new Error("bcryptjs not found — run pnpm install");
}

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const users = [
  {
    name:     process.env.ADMIN_NAME     ?? "Admin",
    email:    process.env.ADMIN_EMAIL    ?? "admin@automystics.tech",
    password: process.env.ADMIN_PASSWORD ?? "Admin@2026$",
    role:     "admin",
  },
  {
    name:     process.env.USER_NAME     ?? "User",
    email:    process.env.USER_EMAIL    ?? "user@automystics.tech",
    password: process.env.USER_PASSWORD ?? "User@2026$",
    role:     "user",
  },
];

for (const u of users) {
  const hash = await bcrypt.hash(u.password, 12);
  const { rows } = await pool.query(
    `INSERT INTO users (name, email, password_hash, role, status)
     VALUES ($1, $2, $3, $4, 'active')
     ON CONFLICT (email) DO NOTHING
     RETURNING id, email, role`,
    [u.name, u.email, hash, u.role],
  );

  if (rows.length > 0) {
    console.log(`✓ Seeded ${rows[0].role}: ${rows[0].email}`);
  } else {
    console.log(`— Skipped (already exists): ${u.email}`);
  }
}

await pool.end();
