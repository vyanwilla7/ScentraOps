import express from "express";
import { sessionCookie } from "../../domain/auth.js";
import { asyncHandler } from "../../middleware/async.js";
import { createAuthService, toPublicUser } from "./auth.service.js";

export function createAuthRouter({ repository, sessions, auditViewers = [], requireSession }) {
  const router = express.Router();
  const auth = createAuthService({ repository, sessions, auditViewers });

  router.post("/login", asyncHandler(async (request, response) => {
    const { username, password } = request.body ?? {};
    if (typeof username !== "string" || typeof password !== "string") {
      return response.status(400).json({ code: "INVALID_INPUT", message: "Nama pengguna dan kata sandi wajib diisi." });
    }

    const result = await auth.login(username, password);
    if (result.error) return response.status(result.error.status).json(result.error);

    response.setHeader("Set-Cookie", sessionCookie(result.token));
    return response.status(200).json({ user: result.user });
  }));

  router.post("/logout", requireSession, (request, response) => {
    auth.logout(request.sessionToken);
    response.setHeader("Set-Cookie", sessionCookie("", 0));
    return response.status(200).json({ ok: true });
  });

  router.get("/session", requireSession, (request, response) => {
    return response.json({ user: toPublicUser(request.user, auditViewers) });
  });

  return router;
}
