import "dotenv/config";
import fs from "node:fs/promises";
import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL wajib diisi untuk migrasi.");
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  for (const migration of [
    "001_foundation.sql",
    "002_master_data.sql",
    "003_tickets.sql",
    "004_transactions.sql",
    "005_persistence.sql"
  ]) {
    const sql = await fs.readFile(new URL(`../db/migrations/${migration}`, import.meta.url), "utf8");
    await pool.query(sql);
  }
  console.log("Migrasi foundation, master data, tiket, transaksi, dan persistence selesai.");
} finally {
  await pool.end();
}
