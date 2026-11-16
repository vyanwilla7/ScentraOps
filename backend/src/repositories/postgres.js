import { DEFAULT_SETTINGS } from "../domain/settings.js";

const ZERO_UUID = "00000000-0000-0000-0000-000000000000";

function toIso(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}

function toDateOnly(value) {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
}

function json(value, fallback) {
  if (value === null || value === undefined) return fallback;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch {
      return fallback;
    }
  }
  return value;
}

function actionNumber(value) {
  return value === null || value === undefined ? null : Number(value);
}

function isUuid(value) {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function mapSku(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    aliases: json(row.aliases, []),
    stock: row.stock === null ? null : Number(row.stock),
    stockUpdatedAt: toIso(row.stock_updated_at),
    active: row.active,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    createdBy: row.created_by
  };
}

function mapCost(row) {
  return {
    id: row.id,
    skuId: row.sku_id,
    amount: Number(row.amount),
    effectiveFrom: toDateOnly(row.effective_from),
    reason: row.reason,
    createdAt: toIso(row.created_at),
    createdBy: row.created_by
  };
}

function mapKnowledge(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    source: row.source,
    version: row.version,
    effectiveAt: toIso(row.effective_at),
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
    createdBy: row.created_by
  };
}

function mapAudit(row) {
  return {
    id: row.id,
    action: row.action,
    entity: row.entity,
    entityId: row.entity_ref ?? row.entity_id,
    actor: row.actor,
    reason: row.reason,
    ...(row.before === null || row.before === undefined ? {} : { before: json(row.before, null) }),
    ...(row.after === null || row.after === undefined ? {} : { after: json(row.after, null) }),
    createdAt: toIso(row.created_at)
  };
}

function mapTicket(row) {
  return {
    id: row.id,
    number: row.ticket_number,
    type: row.type,
    priority: row.priority,
    status: row.status,
    assignee: row.assignee,
    originalMessage: row.original_message,
    normalizedMessage: row.normalized_message,
    reason: row.reason,
    skuId: row.sku_id,
    createdBy: row.created_by,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at)
  };
}

function mapHistory(row) {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    action: row.action,
    from: row.previous_value,
    to: row.next_value,
    actor: row.actor,
    reason: row.reason,
    createdAt: toIso(row.created_at)
  };
}

function mapAdjustment(row) {
  return {
    id: row.id,
    sourceReference: row.source_reference,
    amount: Number(row.amount),
    note: row.note,
    actor: row.actor,
    createdAt: toIso(row.created_at)
  };
}

/**
 * PostgreSQL repository. All domain rules stay in services/domain; this layer only
 * translates between their plain objects and the normalized schema.
 */
export function createPostgresRepository(pool) {
  async function withTransaction(work) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function ticketById(client, id) {
    const result = await client.query(
      "SELECT * FROM complaint_tickets WHERE id = $1",
      [id]
    );
    return result.rows[0] ? mapTicket(result.rows[0]) : null;
  }

  async function ticketHistory(client, id) {
    const result = await client.query(
      "SELECT * FROM complaint_ticket_history WHERE ticket_id = $1 ORDER BY created_at, id",
      [id]
    );
    return result.rows.map(mapHistory);
  }

  return {
    async ping() {
      await pool.query("SELECT 1");
      return true;
    },

    users: {
      async list() {
        const result = await pool.query(
          "SELECT id, username, display_name, role, password_hash FROM app_users WHERE active = TRUE ORDER BY id"
        );
        return result.rows.map((row) => ({
          id: row.id,
          username: row.username,
          displayName: row.display_name,
          role: row.role,
          passwordHash: row.password_hash
        }));
      }
    },

    masterData: {
      async listSkus() {
        const result = await pool.query("SELECT * FROM master_skus ORDER BY created_at, id");
        return result.rows.map(mapSku);
      },

      async getSku(id) {
        const result = await pool.query("SELECT * FROM master_skus WHERE id = $1", [id]);
        return result.rows[0] ? mapSku(result.rows[0]) : null;
      },

      async getSkuByCode(code) {
        const result = await pool.query("SELECT * FROM master_skus WHERE code = $1", [code]);
        return result.rows[0] ? mapSku(result.rows[0]) : null;
      },

      async addSku(sku) {
        await pool.query(
          `INSERT INTO master_skus
            (id, code, name, aliases, stock, stock_updated_at, active, created_by, created_at, updated_at)
           VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, $9, $10)`,
          [sku.id, sku.code, sku.name, JSON.stringify(sku.aliases ?? []), sku.stock,
            sku.stockUpdatedAt, sku.active, sku.createdBy, sku.createdAt, sku.updatedAt]
        );
        return sku;
      },

      async saveSku(sku) {
        const result = await pool.query(
          `UPDATE master_skus SET
            name = $2, aliases = $3::jsonb, stock = $4, stock_updated_at = $5,
            active = $6, updated_at = $7
           WHERE id = $1`,
          [sku.id, sku.name, JSON.stringify(sku.aliases ?? []), sku.stock,
            sku.stockUpdatedAt, sku.active, sku.updatedAt]
        );
        if (result.rowCount === 0) throw new Error("SKU tidak ditemukan saat menyimpan.");
        return sku;
      },

      async listCosts(skuId) {
        const result = await pool.query(
          "SELECT * FROM sku_cost_versions WHERE sku_id = $1 ORDER BY effective_from, created_at",
          [skuId]
        );
        return result.rows.map(mapCost);
      },

      async listAllCosts() {
        const result = await pool.query("SELECT * FROM sku_cost_versions ORDER BY effective_from, created_at");
        return result.rows.map(mapCost);
      },

      async addCost(cost) {
        await pool.query(
          `INSERT INTO sku_cost_versions
            (id, sku_id, amount, effective_from, reason, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [cost.id, cost.skuId, cost.amount, cost.effectiveFrom, cost.reason, cost.createdBy, cost.createdAt]
        );
        return cost;
      },

      async listKnowledge() {
        const result = await pool.query("SELECT * FROM knowledge_entries ORDER BY created_at, id");
        return result.rows.map(mapKnowledge);
      },

      async addKnowledge(item) {
        await pool.query(
          `INSERT INTO knowledge_entries
            (id, title, content, source, version, effective_at, expires_at, created_by, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [item.id, item.title, item.content, item.source, item.version,
            item.effectiveAt, item.expiresAt, item.createdBy, item.createdAt]
        );
        return item;
      },

      async listAudit() {
        const result = await pool.query("SELECT * FROM master_data_audit ORDER BY created_at DESC, id");
        return result.rows.map(mapAudit);
      },

      async addAudit(entry) {
        const entityId = isUuid(entry.entityId) ? entry.entityId : ZERO_UUID;
        const entityRef = isUuid(entry.entityId) ? null : String(entry.entityId);
        await pool.query(
          `INSERT INTO master_data_audit
            (id, action, entity, entity_id, entity_ref, actor, reason, before, after, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
          [entry.id, entry.action, entry.entity, entityId, entityRef, entry.actor, entry.reason,
            entry.before === undefined ? null : JSON.stringify(entry.before),
            entry.after === undefined ? null : JSON.stringify(entry.after),
            entry.createdAt]
        );
        return entry;
      }
    },

    tickets: {
      async findOpen(createdBy, originalMessage) {
        const result = await pool.query(
          `SELECT * FROM complaint_tickets
           WHERE status <> 'Selesai' AND created_by = $1 AND original_message = $2
           ORDER BY created_at LIMIT 1`,
          [createdBy, originalMessage]
        );
        return result.rows[0] ? mapTicket(result.rows[0]) : null;
      },

      async create({ ticket, history }) {
        return withTransaction(async (client) => {
          const existing = await client.query(
            `SELECT * FROM complaint_tickets
             WHERE status <> 'Selesai' AND created_by = $1 AND original_message = $2
             ORDER BY created_at LIMIT 1`,
            [ticket.createdBy, ticket.originalMessage]
          );
          if (existing.rows[0]) {
            const found = mapTicket(existing.rows[0]);
            return { ticket: found, history: await ticketHistory(client, found.id), existing: true };
          }

          const sequence = await client.query(
            "UPDATE app_sequences SET value = value + 1 WHERE name = 'ticket' RETURNING value"
          );
          const number = `TKT-${String(sequence.rows[0].value).padStart(6, "0")}`;
          await client.query(
            `INSERT INTO complaint_tickets
              (id, ticket_number, type, priority, status, assignee, original_message,
               normalized_message, reason, sku_id, created_by, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [ticket.id, number, ticket.type, ticket.priority, ticket.status, ticket.assignee,
              ticket.originalMessage, ticket.normalizedMessage, ticket.reason, ticket.skuId,
              ticket.createdBy, ticket.createdAt, ticket.updatedAt]
          );
          await client.query(
            `INSERT INTO complaint_ticket_history
              (id, ticket_id, action, previous_value, next_value, actor, reason, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [history.id, ticket.id, history.action, history.from, history.to, history.actor,
              history.reason, history.createdAt]
          );
          return {
            ticket: { ...ticket, number },
            history: [{ ...history, ticketId: ticket.id }]
          };
        });
      },

      async list(filters = {}) {
        const clauses = [];
        const values = [];
        for (const [column, key] of [["status", "status"], ["priority", "priority"], ["assignee", "assignee"]]) {
          if (filters[key]) {
            values.push(filters[key]);
            clauses.push(`${column} = $${values.length}`);
          }
        }
        const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
        const result = await pool.query(`SELECT * FROM complaint_tickets ${where} ORDER BY created_at DESC, id`, values);
        return result.rows.map(mapTicket);
      },

      async get(id) {
        const result = await pool.query("SELECT * FROM complaint_tickets WHERE id = $1", [id]);
        return result.rows[0] ? mapTicket(result.rows[0]) : null;
      },

      async history(ticketId) {
        const result = await pool.query(
          "SELECT * FROM complaint_ticket_history WHERE ticket_id = $1 ORDER BY created_at, id",
          [ticketId]
        );
        return result.rows.map(mapHistory);
      },

      async update(ticket, historyEntries) {
        return withTransaction(async (client) => {
          const result = await client.query(
            `UPDATE complaint_tickets SET
              status = $2, priority = $3, assignee = $4, updated_at = $5
             WHERE id = $1`,
            [ticket.id, ticket.status, ticket.priority, ticket.assignee, ticket.updatedAt]
          );
          if (result.rowCount === 0) throw new Error("Tiket tidak ditemukan saat menyimpan.");
          for (const entry of historyEntries) {
            await client.query(
              `INSERT INTO complaint_ticket_history
                (id, ticket_id, action, previous_value, next_value, actor, reason, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [entry.id, ticket.id, entry.action, entry.from, entry.to, entry.actor, entry.reason, entry.createdAt]
            );
          }
          return { ticket: await ticketById(client, ticket.id), history: await ticketHistory(client, ticket.id) };
        });
      }
    },

    transactions: {
      async listRecords() {
        const result = await pool.query("SELECT source_data, active FROM transaction_lines ORDER BY created_at, id");
        return result.rows.map((row) => ({ ...json(row.source_data, {}), active: row.active }));
      },

      async getRecord(id) {
        const result = await pool.query(
          "SELECT source_data, active FROM transaction_lines WHERE id = $1",
          [id]
        );
        return result.rows[0] ? { ...json(result.rows[0].source_data, {}), active: result.rows[0].active } : null;
      },

      async findActiveByKey(marketplace, orderId, lineId) {
        const result = await pool.query(
          `SELECT source_data, active FROM transaction_lines
           WHERE marketplace = $1 AND order_id = $2 AND line_id = $3 AND active = TRUE
           ORDER BY created_at LIMIT 1`,
          [marketplace, orderId, String(lineId)]
        );
        return result.rows[0] ? { ...json(result.rows[0].source_data, {}), active: true } : null;
      },

      async commit({ inserts = [], updates = [], revisions = [], importEntry }) {
        return withTransaction(async (client) => {
          for (const record of inserts) {
            await client.query(
              `INSERT INTO transaction_lines
                (id, marketplace, order_id, line_id, order_date, status, sku, quantity,
                 source_data, active, created_by, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12)`,
              [record.id, record.marketplace, record.orderId, String(record.lineId), record.orderDate,
                record.status, record.sku, record.quantity, JSON.stringify(record), record.active,
                record.createdBy, record.createdAt]
            );
          }
          for (const record of updates) {
            await client.query(
              `UPDATE transaction_lines SET
                source_data = $2::jsonb, active = $3, updated_at = $4
               WHERE id = $1`,
              [record.id, JSON.stringify(record), record.active, record.updatedAt]
            );
          }
          for (const revision of revisions) {
            await client.query(
              `INSERT INTO transaction_revisions
                (id, original_id, marketplace, order_id, line_id, payload, replaced_by, reason, replaced_at)
               VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9)`,
              [revision.id, revision.originalId, revision.marketplace, revision.orderId,
                String(revision.lineId), JSON.stringify(revision.payload), revision.replacedBy,
                revision.reason, revision.replacedAt]
            );
          }
          if (importEntry) {
            await client.query(
              `INSERT INTO transaction_imports
                (id, actor, reason, inserted, skipped, updated, created_at)
               VALUES ($1, $2, $3, $4, $5, $6, $7)`,
              [importEntry.id, importEntry.actor, importEntry.reason, importEntry.inserted,
                importEntry.skipped, importEntry.updated, importEntry.createdAt]
            );
          }
          return { inserted: inserts, updated: updates };
        });
      },

      async findAdjustment(sourceReference, amount) {
        const result = await pool.query(
          "SELECT * FROM transaction_adjustments WHERE source_reference = $1 AND amount = $2 LIMIT 1",
          [sourceReference, amount]
        );
        return result.rows[0] ? mapAdjustment(result.rows[0]) : null;
      },

      async addAdjustment(adjustment) {
        await pool.query(
          `INSERT INTO transaction_adjustments
            (id, source_reference, amount, note, actor, created_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [adjustment.id, adjustment.sourceReference, adjustment.amount, adjustment.note,
            adjustment.actor, adjustment.createdAt]
        );
        return adjustment;
      }
    },

    settings: {
      async get() {
        const result = await pool.query("SELECT values FROM app_settings WHERE id = 'default'");
        return result.rows[0] ? { ...DEFAULT_SETTINGS, ...json(result.rows[0].values, {}) } : { ...DEFAULT_SETTINGS };
      },

      async update({ before, after, version, audit }) {
        return withTransaction(async (client) => {
          await client.query(
            `INSERT INTO app_settings(id, values, updated_at)
             VALUES ('default', $1::jsonb, $2)
             ON CONFLICT (id) DO UPDATE SET values = EXCLUDED.values, updated_at = EXCLUDED.updated_at`,
            [JSON.stringify(after), version.changedAt]
          );
          await client.query(
            `INSERT INTO app_settings_versions
              (id, before, after, changed_by, reason, changed_at)
             VALUES ($1, $2::jsonb, $3::jsonb, $4, $5, $6)`,
            [version.id, JSON.stringify(before), JSON.stringify(after), version.changedBy,
              version.reason, version.changedAt]
          );
          await client.query(
            `INSERT INTO master_data_audit
              (id, action, entity, entity_id, entity_ref, actor, reason, before, after, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10)`,
            [audit.id, audit.action, audit.entity, ZERO_UUID, "app_settings", audit.actor,
              audit.reason, JSON.stringify(before), JSON.stringify(after), audit.createdAt]
          );
          return { ...after };
        });
      }
    }
  };
}
