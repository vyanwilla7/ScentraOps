import crypto from "node:crypto";
import { updateTicket as applyTicketUpdate } from "../../domain/tickets.js";

const TRACKED_FIELDS = ["status", "priority", "assignee"];

export function createTicketService(repository) {
  return {
    async list(filters = {}) {
      return repository.tickets.list(filters);
    },

    async get(id) {
      const item = await repository.tickets.get(id);
      if (!item) return null;
      return {
        item,
        history: await repository.tickets.history(item.id)
      };
    },

    async update(id, input, actor) {
      const current = await repository.tickets.get(id);
      if (!current) return { error: { status: 404, code: "NOT_FOUND", message: "Tiket tidak ditemukan." } };

      const result = applyTicketUpdate(current, input);
      if (result.error) return result;

      const historyEntries = [];
      for (const field of TRACKED_FIELDS) {
        if (current[field] === result.value[field]) continue;
        historyEntries.push({
          id: crypto.randomUUID(),
          action: field.toUpperCase(),
          from: current[field],
          to: result.value[field],
          actor,
          reason: input.reason,
          createdAt: result.value.updatedAt
        });
      }

      return repository.tickets.update(result.value, historyEntries);
    }
  };
}
