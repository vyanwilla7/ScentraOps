import { parseCookies } from "../domain/auth.js";
import { hasPermission, permissionsFor } from "../domain/permissions.js";

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

/**
 * Session and capability guards are built per app instance so tests can inject sessions and audit viewers.
 */
export function createAuthGuards(sessions, { auditViewers = [] } = {}) {
  function requireSession(request, response, next) {
    const token = parseCookies(request.headers.cookie).scentra_session;
    const session = token ? sessions.get(token) : null;
    if (!session || session.expiresAt <= Date.now()) {
      if (token) sessions.delete(token);
      return response.status(401).json({ code: "UNAUTHENTICATED", message: "Sesi tidak valid atau sudah berakhir." });
    }
    request.user = session;
    request.sessionToken = token;
    request.permissions = permissionsFor(session.role, { auditViewers, username: session.username });
    return next();
  }

  function requirePermission(capability) {
    return (request, response, next) => {
      if (!hasPermission(request.permissions, capability)) {
        return response.status(403).json({ code: "FORBIDDEN", message: "Peran Anda tidak memiliki akses ke fitur ini." });
      }
      return next();
    };
  }

  return { requireSession, requirePermission };
}

export { SESSION_TTL_MS };
