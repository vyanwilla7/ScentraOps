import crypto from "node:crypto";
import { verifyPassword } from "../../domain/auth.js";
import { permissionsFor } from "../../domain/permissions.js";
import { SESSION_TTL_MS } from "../../middleware/auth.js";

export function toPublicUser(session, auditViewers = []) {
  const { id, username, displayName, role } = session;
  return {
    id,
    username,
    displayName,
    role,
    permissions: permissionsFor(role, { auditViewers, username })
  };
}

export function createAuthService({ repository, sessions, auditViewers = [] }) {
  return {
    async login(username, password) {
      const users = await repository.users.list();
      const user = users.find((candidate) => candidate.username === username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return { error: { status: 401, code: "INVALID_CREDENTIALS", message: "Nama pengguna atau kata sandi salah." } };
      }

      for (const [token, session] of sessions) {
        if (session.expiresAt <= Date.now()) sessions.delete(token);
      }

      const token = crypto.randomBytes(32).toString("hex");
      const session = {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        role: user.role,
        expiresAt: Date.now() + SESSION_TTL_MS
      };
      sessions.set(token, session);
      return { token, user: toPublicUser(session, auditViewers) };
    },

    logout(token) {
      sessions.delete(token);
    }
  };
}
