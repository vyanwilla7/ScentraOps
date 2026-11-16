import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createDashboardService } from "./dashboard.service.js";

export function createDashboardRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();
  const dashboardService = createDashboardService(repository);
  const canReadProfit = [requireSession, requirePermission("profit:read")];

  router.get("/profit", ...canReadProfit, asyncHandler(async (request, response) => {
    return response.json(await dashboardService.report(request.query));
  }));

  router.get("/profit/:id", ...canReadProfit, asyncHandler(async (request, response) => {
    const item = await dashboardService.findLine(request.params.id);
    if (!item) return response.status(404).json({ code: "NOT_FOUND", message: "Baris transaksi tidak ditemukan." });
    return response.json({ item });
  }));

  return router;
}
