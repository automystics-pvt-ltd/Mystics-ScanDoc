/**
 * Seed default admin and user accounts.
 * Run via: pnpm --filter @workspace/db exec tsx src/seed.ts
 */
import bcrypt from "bcryptjs";
import { pool } from "./index.js";

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
