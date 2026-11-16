import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createTransactionService } from "./transactions.service.js";

function respondCommit(response, result) {
  if (result.status === "REJECTED") {
    return response.status(400).json({
      code: "VALIDATION_FAILED",
      message: "Baris transaksi ditolak. Periksa kolom dan nilai yang ditandai.",
      result
    });
  }
  if (result.status === "APPROVAL_REQUIRED") {
    return response.status(409).json({
      code: "UPDATE_APPROVAL_REQUIRED",
      message: "Baris dengan kunci yang sama memiliki nilai berbeda. Setujui pembaruan untuk melanjutkan.",
      result
    });
  }
  return response.status(201).json(result);
}

export function createTransactionsRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();
  const transactionService = createTransactionService(repository);
  const canManage = [requireSession, requirePermission("transactions:manage")];

  router.get("/", requireSession, requirePermission("transactions:read"), asyncHandler(async (_request, response) => {
    return response.json({ items: await transactionService.list() });
  }));

  router.post("/manual", ...canManage, asyncHandler(async (request, response) => {
    try {
      return respondCommit(response, await transactionService.manual(request.body ?? {}, request.user.username));
    } catch (error) {
      return response.status(400).json({ code: "INVALID_INPUT", message: error.message });
    }
  }));

  router.post("/import/preview", ...canManage, asyncHandler(async (request, response) => {
    try {
      return response.json(await transactionService.preview(request.body?.csvText, request.body?.mapping));
    } catch (error) {
      return response.status(400).json({ code: "CSV_INVALID", message: error.message });
    }
  }));

  router.post("/import/commit", ...canManage, asyncHandler(async (request, response) => {
    try {
      return respondCommit(response, await transactionService.commit(request.body ?? {}, request.user.username));
    } catch (error) {
      return response.status(400).json({ code: "IMPORT_INVALID", message: error.message });
    }
  }));

  router.post("/adjustments", ...canManage, asyncHandler(async (request, response) => {
    const result = await transactionService.adjust(request.body ?? {}, request.user.username);
    if (result.error) return response.status(400).json(result);
    return response.status(result.duplicate ? 200 : 201).json({ item: result.value, duplicate: Boolean(result.duplicate) });
  }));

  return router;
}
