import { createMemoryRepository } from "./memory.js";
import { createPostgresRepository } from "./postgres.js";

/**
 * One switch decides whether the application uses PostgreSQL or an in-memory
 * repository. Tests and `npm start` without DATABASE_URL use memory.
 */
export function createRepository({ database, users, masterData, tickets, transactions, settings } = {}) {
  if (database) return createPostgresRepository(database);
  return createMemoryRepository({ users, masterData, tickets, transactions, settings });
}
