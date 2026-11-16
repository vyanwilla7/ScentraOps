import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createMasterDataService } from "./master-data.service.js";

export function createMasterDataRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();
  const masterDataService = createMasterDataService(repository);

  router.get("/skus", requireSession, requirePermission("catalog:read"), asyncHandler(async (_request, response) => {
    response.json({ items: await masterDataService.listSkus() });
  }));

  router.post("/skus", requireSession, requirePermission("catalog:manage"), asyncHandler(async (request, response) => {
    const result = await masterDataService.createSku(request.body ?? {}, request.user);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.status(201).json({ item: result.value });
  }));

  router.patch("/skus/:id", requireSession, requirePermission("catalog:manage"), asyncHandler(async (request, response) => {
    const result = await masterDataService.updateSku(request.params.id, request.body ?? {}, request.user);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.json({ item: result.value });
  }));

  router.get("/skus/:id/costs", requireSession, requirePermission("costs:read"), asyncHandler(async (request, response) => {
    response.json({ items: await masterDataService.listCosts(request.params.id) });
  }));

  router.post("/skus/:id/costs", requireSession, requirePermission("costs:manage"), asyncHandler(async (request, response) => {
    const result = await masterDataService.createCost(request.params.id, request.body ?? {}, request.user);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.status(201).json({ item: result.value });
  }));

  router.get("/knowledge", requireSession, requirePermission("knowledge:read"), asyncHandler(async (_request, response) => {
    response.json({ items: await masterDataService.listKnowledge() });
  }));

  router.post("/knowledge", requireSession, requirePermission("knowledge:manage"), asyncHandler(async (request, response) => {
    const result = await masterDataService.createKnowledge(request.body ?? {}, request.user);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.status(201).json({ item: result.value });
  }));

  router.get("/audit", requireSession, requirePermission("audit:read"), asyncHandler(async (_request, response) => {
    response.json({ items: await masterDataService.listAudit() });
  }));

  return router;
}

export function createCatalogRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();

  router.get("/", requireSession, requirePermission("catalog:read"), asyncHandler(async (_request, response) => {
    response.json({ items: await repository.masterData.listSkus() });
  }));

  return router;
}
