import "dotenv/config";
import pg from "pg";
import { createApp } from "./app.js";
import { readConfig } from "./config/env.js";
import { createPostgresRepository } from "./repositories/postgres.js";

const config = readConfig();
const database = config.databaseUrl
  ? new pg.Pool({ connectionString: config.databaseUrl })
  : null;

let repository = null;
if (database) {
  repository = createPostgresRepository(database);
  try {
    await database.query("SELECT 1 FROM app_users LIMIT 1");
    await database.query("SELECT 1 FROM app_settings LIMIT 1");
  } catch (error) {
    console.error("Database terhubung tetapi skema belum siap. Jalankan `npm run db:migrate` lalu `npm run db:seed`.");
    await database.end();
    throw error;
  }
} else {
  console.warn("DATABASE_URL tidak diisi: memakai repository in-memory. Data akan hilang saat server berhenti.");
}

const app = createApp({ config, database, repository });

const server = app.listen(config.port, () => {
  console.log(`ScentraOps backend berjalan di http://localhost:${config.port}`);
  if (config.llm.enabled) {
    console.log(`LLM aktif: ${config.llm.provider} / ${config.llm.model}`);
  } else {
    console.log("LLM belum dikonfigurasi: saran CS memakai mesin deterministik.");
  }
});

function shutdown() {
  server.close(async () => {
    if (database) await database.end();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
