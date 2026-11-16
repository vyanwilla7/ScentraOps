import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createSettingsService } from "./settings.service.js";

export function createSettingsRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();
  const settingsService = createSettingsService({ repository });

  router.get("/", requireSession, requirePermission("settings:read"), asyncHandler(async (_request, response) => {
    return response.json({ item: await settingsService.get() });
  }));

  router.patch("/", requireSession, requirePermission("settings:manage"), asyncHandler(async (request, response) => {
    const result = await settingsService.update(request.body ?? {}, request.user);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.json({ item: result.value });
  }));

  return router;
}
