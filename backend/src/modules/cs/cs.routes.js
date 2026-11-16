import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createCsService } from "./cs.service.js";

export function createCsRouter({ repository, llmAssistant, requireSession, requirePermission }) {
  const router = express.Router();
  const csService = createCsService({ repository, llmAssistant });

  router.post("/analyze", requireSession, requirePermission("cs:analyze"), asyncHandler(async (request, response) => {
    if (typeof request.body?.message !== "string" || request.body.message.trim().length === 0) {
      return response.status(400).json({ code: "INVALID_INPUT", message: "Pesan pelanggan wajib diisi." });
    }

    const result = await csService.analyze({
      message: request.body.message,
      user: request.user,
      now: request.body.now,
      cutoff: request.body.cutoff,
      bufferMinutes: request.body.bufferMinutes,
      freshnessLimitHours: request.body.freshnessLimitHours
    });
    return response.json(result);
  }));

  return router;
}
