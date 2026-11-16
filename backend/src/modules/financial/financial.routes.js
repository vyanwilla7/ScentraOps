import express from "express";
import { aggregateLines, allocateAmount, calculateLine } from "../../domain/financial.js";

export function createFinancialRouter({ requireSession, requirePermission }) {
  const router = express.Router();
  const canReadProfit = [requireSession, requirePermission("profit:read")];

  router.post("/calculate", ...canReadProfit, (request, response) => {
    return response.json({ line: calculateLine(request.body ?? {}) });
  });

  router.post("/aggregate", ...canReadProfit, (request, response) => {
    if (!Array.isArray(request.body?.lines)) {
      return response.status(400).json({ code: "INVALID_INPUT", message: "lines harus berupa array." });
    }
    return response.json({ summary: aggregateLines(request.body.lines) });
  });

  router.post("/allocate", ...canReadProfit, (request, response) => {
    if (!Array.isArray(request.body?.lines) || typeof request.body.amount !== "number" || typeof request.body.basis !== "string") {
      return response.status(400).json({ code: "INVALID_INPUT", message: "lines, amount, dan basis wajib diisi." });
    }
    try {
      return response.json({ items: allocateAmount(request.body.lines, request.body.amount, request.body.basis) });
    } catch (error) {
      return response.status(400).json({ code: "INVALID_ALLOCATION", message: error.message });
    }
  });

  return router;
}
