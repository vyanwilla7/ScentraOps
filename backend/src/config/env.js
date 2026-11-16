const DEFAULT_PORT = 3001;
const DEFAULT_CLIENT_ORIGIN = "http://localhost:5173";
const DEFAULT_LLM_BASE = "https://api.z.ai/api/paas/v4";
const DEFAULT_LLM_MODEL = "glm-4-flash";

/**
 * Reads runtime configuration once so the rest of the app never touches process.env.
 */
export function readConfig(env = process.env) {
  const port = Number(env.PORT ?? DEFAULT_PORT);
  const allowedOrigins = (env.CLIENT_ORIGIN ?? env.CORS_ORIGIN ?? DEFAULT_CLIENT_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const auditViewers = (env.AUDIT_VIEWER_USERS ?? "")
    .split(",")
    .map((username) => username.trim())
    .filter(Boolean);

  const apiKey = env.LLM_API_KEY || env.ZAI_API_KEY || null;
  const timeout = Number(env.LLM_TIMEOUT_MS ?? 12000);

  return {
    port: Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT,
    databaseUrl: env.DATABASE_URL || null,
    allowedOrigins,
    auditViewers,
    llm: {
      enabled: Boolean(apiKey) && env.LLM_ENABLED !== "false",
      apiKey,
      baseUrl: env.LLM_API_BASE || env.ZAI_API_BASE || DEFAULT_LLM_BASE,
      model: env.LLM_MODEL || DEFAULT_LLM_MODEL,
      provider: env.LLM_PROVIDER || "z.ai",
      timeoutMs: Number.isInteger(timeout) && timeout >= 1000 ? timeout : 12000
    }
  };
}
