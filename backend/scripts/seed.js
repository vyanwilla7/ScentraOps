import "dotenv/config";
import pg from "pg";
import { demoUsers } from "../src/domain/auth.js";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL wajib diisi untuk seed.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  await pool.query("INSERT INTO app_seed_runs(seed_name) VALUES ($1) ON CONFLICT (seed_name) DO NOTHING", ["foundation"]);
  for (const user of demoUsers()) {
    await pool.query(
      "INSERT INTO app_users(id, username, display_name, role, password_hash) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (username) DO NOTHING",
      [user.id, user.username, user.displayName, user.role, user.passwordHash]
    );
  }
  console.log("Seed foundation selesai.");
} finally {
  await pool.end();
}
