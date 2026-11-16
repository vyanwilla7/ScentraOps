/**
 * In-memory repository used by tests and by local runs without DATABASE_URL.
 * The method contract intentionally matches repositories/postgres.js.
 */
export function createMemoryRepository({ users = [], masterData, tickets, transactions, settings }) {
  return {
    users: {
      async list() {
        return users;
      }
    },

    masterData: {
      async listSkus() {
        return masterData.skus;
      },

      async getSku(id) {
        return masterData.skus.find((sku) => sku.id === id) ?? null;
      },

      async getSkuByCode(code) {
        return masterData.skus.find((sku) => sku.code === code) ?? null;
      },

      async addSku(sku) {
        masterData.skus.push(sku);
        return sku;
      },

      async saveSku(sku) {
        const index = masterData.skus.findIndex((item) => item.id === sku.id);
        if (index < 0) throw new Error("SKU tidak ditemukan saat menyimpan.");
        masterData.skus[index] = sku;
        return sku;
      },

      async listCosts(skuId) {
        return masterData.costs.filter((cost) => cost.skuId === skuId);
      },

      async listAllCosts() {
        return masterData.costs;
      },

      async addCost(cost) {
        masterData.costs.push(cost);
        return cost;
      },

      async listKnowledge() {
        return masterData.knowledge;
      },

      async addKnowledge(item) {
        masterData.knowledge.push(item);
        return item;
      },

      async listAudit() {
        return [...masterData.audit].reverse();
      },

      async addAudit(entry) {
        masterData.audit.push(entry);
        return entry;
      }
    },

    tickets: {
      async findOpen(createdBy, originalMessage) {
        return tickets.tickets.find((ticket) => ticket.status !== "Selesai"
          && ticket.createdBy === createdBy
          && ticket.originalMessage === originalMessage) ?? null;
      },

      async create({ ticket, history }) {
        // Re-check here so two concurrent analyses cannot create duplicate open tickets.
        const existing = tickets.tickets.find((item) => item.status !== "Selesai"
          && item.createdBy === ticket.createdBy
          && item.originalMessage === ticket.originalMessage);
        if (existing) {
          return { ticket: existing, history: tickets.history.filter((entry) => entry.ticketId === existing.id), existing: true };
        }
        tickets.sequence += 1;
        const item = { ...ticket, number: `TKT-${String(tickets.sequence).padStart(6, "0")}` };
        const event = { ...history, ticketId: item.id };
        tickets.tickets.push(item);
        tickets.history.push(event);
        return { ticket: item, history: [event] };
      },

      async list(filters = {}) {
        return tickets.tickets.filter((ticket) => {
          if (filters.status && ticket.status !== filters.status) return false;
          if (filters.priority && ticket.priority !== filters.priority) return false;
          if (filters.assignee && ticket.assignee !== filters.assignee) return false;
          return true;
        });
      },

      async get(id) {
        return tickets.tickets.find((ticket) => ticket.id === id) ?? null;
      },

      async history(ticketId) {
        return tickets.history.filter((entry) => entry.ticketId === ticketId);
      },

      async update(ticket, historyEntries) {
        const index = tickets.tickets.findIndex((item) => item.id === ticket.id);
        if (index < 0) throw new Error("Tiket tidak ditemukan saat menyimpan.");
        tickets.tickets[index] = ticket;
        for (const entry of historyEntries) {
          tickets.history.push({ ...entry, ticketId: ticket.id });
        }
        return {
          ticket,
          history: tickets.history.filter((entry) => entry.ticketId === ticket.id)
        };
      }
    },

    transactions: {
      async listRecords() {
        return transactions.records;
      },

      async getRecord(id) {
        return transactions.records.find((line) => line.id === id) ?? null;
      },

      async findActiveByKey(marketplace, orderId, lineId) {
        return transactions.records.find((line) => line.marketplace === marketplace
          && line.orderId === orderId
          && String(line.lineId) === String(lineId)
          && line.active !== false) ?? null;
      },

      async commit({ inserts = [], updates = [], revisions = [], importEntry }) {
        for (const record of inserts) transactions.records.push(record);
        for (const record of updates) {
          const index = transactions.records.findIndex((line) => line.id === record.id);
          if (index < 0) throw new Error("Baris transaksi tidak ditemukan saat diperbarui.");
          transactions.records[index] = record;
        }
        for (const revision of revisions) transactions.revisions.push(revision);
        if (importEntry) transactions.imports.push(importEntry);
        return { inserted: inserts, updated: updates };
      },

      async findAdjustment(sourceReference, amount) {
        return transactions.adjustments.find((item) => item.sourceReference === sourceReference && item.amount === amount) ?? null;
      },

      async addAdjustment(adjustment) {
        transactions.adjustments.push(adjustment);
        return adjustment;
      }
    },

    settings: {
      async get() {
        return { ...settings.values };
      },

      async update({ before, after, version, audit }) {
        settings.values = { ...after };
        settings.versions.push(version);
        masterData.audit.push(audit);
        return { ...settings.values };
      }
    }
  };
}
