import crypto from "node:crypto";

const STATUSES = new Set(["Baru", "Diproses", "Selesai"]);
const PRIORITIES = new Set(["Rendah", "Sedang", "Tinggi"]);

export function createComplaintTicket({ message, analysis, user, store }) {
  // Re-running the same analysis must not create a second open ticket for the same message.
  const existing = store.tickets.find((ticket) => ticket.status !== "Selesai" && ticket.createdBy === user.username && ticket.originalMessage === message);
  if (existing) return existing;
  store.sequence += 1;
  const ticket = {
    id: crypto.randomUUID(),
    number: `TKT-${String(store.sequence).padStart(6, "0")}`,
    type: "Keluhan",
    priority: analysis.status === "Usang" || analysis.status === "Belum diketahui" ? "Tinggi" : "Sedang",
    status: "Baru",
    assignee: null,
    originalMessage: message,
    normalizedMessage: analysis.normalized,
    reason: analysis.reason,
    skuId: analysis.candidate?.id ?? null,
    createdBy: user.username,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  store.tickets.push(ticket);
  store.history.push({
    id: crypto.randomUUID(),
    ticketId: ticket.id,
    action: "CREATED",
    from: null,
    to: "Baru",
    actor: user.username,
    reason: "Analisis pesan diklasifikasikan sebagai keluhan.",
    createdAt: ticket.createdAt
  });
  return ticket;
}

export function updateTicket(ticket, input) {
  if (input.status !== undefined && !STATUSES.has(input.status)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Status tiket harus Baru, Diproses, atau Selesai." } };
  }
  if (input.priority !== undefined && !PRIORITIES.has(input.priority)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Prioritas tiket tidak valid." } };
  }
  if (input.assignee !== undefined && input.assignee !== null && (typeof input.assignee !== "string" || input.assignee.trim() === "")) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Assignee harus berupa nama pengguna atau null." } };
  }
  if (typeof input.reason !== "string" || input.reason.trim() === "") {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Alasan perubahan tiket wajib diisi." } };
  }
  return {
    value: {
      ...ticket,
      ...(input.status === undefined ? {} : { status: input.status }),
      ...(input.priority === undefined ? {} : { priority: input.priority }),
      ...(input.assignee === undefined ? {} : { assignee: input.assignee?.trim() ?? null }),
      updatedAt: new Date().toISOString()
    }
  };
}
