/**
 * Seed default admin and regular user accounts.
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
