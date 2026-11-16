import express from "express";
import swaggerUi from "swagger-ui-express";
import { readConfig } from "./config/env.js";
import { demoUsers } from "./domain/auth.js";
import { createMasterDataStore, createSettingsStore, createTicketStore, createTransactionStore } from "./stores/memory.js";
import { createRepository } from "./repositories/index.js";
import { createLlmAssistant } from "./llm/assistant.js";
import { createAuthGuards } from "./middleware/auth.js";
import { createCorsMiddleware, securityHeaders } from "./middleware/security.js";
import { errorHandler, notFound } from "./middleware/errors.js";
import { openapiDocument } from "./docs/openapi.js";
import { createHealthRouter } from "./modules/health/health.routes.js";
import { createAuthRouter } from "./modules/auth/auth.routes.js";
import { createCatalogRouter, createMasterDataRouter } from "./modules/master-data/master-data.routes.js";
import { createCsRouter } from "./modules/cs/cs.routes.js";
import { createTicketsRouter } from "./modules/tickets/tickets.routes.js";
import { createFinancialRouter } from "./modules/financial/financial.routes.js";
import { createTransactionsRouter } from "./modules/transactions/transactions.routes.js";
import { createDashboardRouter } from "./modules/dashboard/dashboard.routes.js";
import { createSettingsRouter } from "./modules/settings/settings.routes.js";

/**
 * Composition root: build the Express app from config, guards, feature routers,
 * the selected repository (PostgreSQL or memory), and the optional LLM assistant.
 */
export function createApp({
  config = readConfig(),
  database = null,
  repository = null,
  llmAssistant = null,
  users = demoUsers(),
  sessions = new Map(),
  masterData = createMasterDataStore(),
  tickets = createTicketStore(),
  transactions = createTransactionStore(),
  settings = createSettingsStore()
} = {}) {
  const app = express();
  app.disable("x-powered-by");
  app.use(createCorsMiddleware(config.allowedOrigins));
  app.use(securityHeaders);
  app.use(express.json({ limit: "6mb" }));

  app.get("/api/v1/openapi.json", (_request, response) => response.json(openapiDocument));
  app.use("/api/v1/docs", swaggerUi.serve, swaggerUi.setup(openapiDocument, {
    customSiteTitle: "ScentraOps API",
    swaggerOptions: { persistAuthorization: true }
  }));

  const data = repository ?? createRepository({ database, users, masterData, tickets, transactions, settings });
  const assistant = llmAssistant ?? createLlmAssistant(config.llm ?? { enabled: false });
  const guards = createAuthGuards(sessions, { auditViewers: config.auditViewers ?? [] });
  const dependencies = {
    database,
    repository: data,
    llmAssistant: assistant,
    users,
    sessions,
    settings,
    auditViewers: config.auditViewers ?? [],
    ...guards
  };

  app.use("/api/v1", createHealthRouter(dependencies));
  app.use("/api/v1/catalog", createCatalogRouter(dependencies));
  app.use("/api/v1/auth", createAuthRouter(dependencies));
  app.use("/api/v1/master-data", createMasterDataRouter(dependencies));
  app.use("/api/v1/cs", createCsRouter(dependencies));
  app.use("/api/v1/tickets", createTicketsRouter(dependencies));
  app.use("/api/v1/financial", createFinancialRouter(dependencies));
  app.use("/api/v1/transactions", createTransactionsRouter(dependencies));
  app.use("/api/v1", createDashboardRouter(dependencies));
  app.use("/api/v1/settings", createSettingsRouter(dependencies));

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
