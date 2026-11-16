import express from "express";
import { asyncHandler } from "../../middleware/async.js";
import { createTicketService } from "./tickets.service.js";

export function createTicketsRouter({ repository, requireSession, requirePermission }) {
  const router = express.Router();
  const ticketService = createTicketService(repository);

  router.get("/", requireSession, requirePermission("tickets:read"), asyncHandler(async (request, response) => {
    return response.json({ items: await ticketService.list(request.query) });
  }));

  router.get("/:id", requireSession, requirePermission("tickets:read"), asyncHandler(async (request, response) => {
    const detail = await ticketService.get(request.params.id);
    if (!detail) return response.status(404).json({ code: "NOT_FOUND", message: "Tiket tidak ditemukan." });
    return response.json(detail);
  }));

  router.patch("/:id", requireSession, requirePermission("tickets:manage"), asyncHandler(async (request, response) => {
    const result = await ticketService.update(request.params.id, request.body ?? {}, request.user.username);
    if (result.error) return response.status(result.error.status).json(result.error);
    return response.json(result);
  }));

  return router;
}
