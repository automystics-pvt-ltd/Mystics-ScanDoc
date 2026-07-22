/**
 * Seed an initial admin account.
 * Run: node scripts/seed-admin.mjs
 * Requires DATABASE_URL to be set in the environment.
 */
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const bcrypt = require("/home/runner/workspace/node_modules/.pnpm/bcryptjs@3.0.3/node_modules/bcryptjs/dist/bcrypt.js");
import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const email = process.env.ADMIN_EMAIL ?? "admin@docscan.local";
const password = process.env.ADMIN_PASSWORD ?? "Admin@1234";
const name = process.env.ADMIN_NAME ?? "Admin";

const hash = await bcrypt.hash(password, 12);

const { rows } = await pool.query(
  `INSERT INTO users (name, email, password_hash, role, status)
   VALUES ($1, $2, $3, 'admin', 'active')
   ON CONFLICT (email) DO NOTHING
   RETURNING id, email, role`,
  [name, email, hash]
);

if (rows.length > 0) {
  console.log("Admin seeded:", rows[0]);
} else {
  console.log("Admin already exists, skipping.");
}

await pool.end();
