import crypto from "node:crypto";
import {
  mapCsvRows,
  parseCsv,
  previewTransactions,
  transactionKey,
  transactionsEquivalent
} from "../../domain/transactions.js";

export function createTransactionService(repository) {
  async function loadMasterData() {
    const [skus, costs] = await Promise.all([
      repository.masterData.listSkus(),
      repository.masterData.listAllCosts()
    ]);
    return { skus, costs };
  }

  function prepare(lines, { skus, costs }) {
    const skuByCode = new Map(skus.map((sku) => [sku.code, sku]));
    const prepared = lines.map((line) => {
      if (line.unitProductCost !== undefined && line.unitProductCost !== null) return line;
      const sku = skuByCode.get(line.sku);
      if (!sku) return line;
      const effective = costs
        .filter((cost) => cost.skuId === sku.id && (!line.orderDate || cost.effectiveFrom <= line.orderDate))
        .sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom)))[0];
      return effective ? { ...line, unitProductCost: effective.amount } : line;
    });
    return {
      lines: prepared,
      knownSkus: new Set(skus.filter((sku) => sku.active).map((sku) => sku.code))
    };
  }

  async function commitLines(lines, { approveUpdates = false, reason = "", actor }) {
    if (typeof reason !== "string" || reason.trim() === "") throw new Error("Alasan import wajib diisi.");
    const prepared = prepare(lines, await loadMasterData());
    const preview = previewTransactions(prepared.lines, { knownSkus: prepared.knownSkus });
    const rejected = preview.filter((row) => row.status === "Ditolak");
    if (rejected.length) {
      return { status: "REJECTED", preview, inserted: [], skipped: [], updated: [] };
    }

    const existing = await Promise.all(preview.map((item) => repository.transactions.findActiveByKey(
      item.line.marketplace,
      item.line.orderId,
      item.line.lineId
    )));
    const inserts = [];
    const skipped = [];
    const updates = [];
    const revisions = [];
    const now = new Date().toISOString();

    for (let index = 0; index < preview.length; index += 1) {
      const item = preview[index];
      const current = existing[index];
      if (!current) {
        inserts.push({
          ...item.line,
          id: crypto.randomUUID(),
          active: true,
          sourceRow: item.sourceRow,
          createdBy: actor,
          createdAt: now
        });
        continue;
      }
      if (transactionsEquivalent(current, item.line)) {
        skipped.push(current);
        continue;
      }
      if (!approveUpdates) {
        return {
          status: "APPROVAL_REQUIRED",
          preview,
          inserted: [],
          skipped,
          updated: [],
          updateKey: transactionKey(item.line)
        };
      }
      const updated = {
        ...item.line,
        id: current.id,
        active: true,
        updatedBy: actor,
        updatedAt: now,
        updateReason: reason
      };
      revisions.push({
        id: crypto.randomUUID(),
        originalId: current.id,
        marketplace: current.marketplace,
        orderId: current.orderId,
        lineId: current.lineId,
        payload: current,
        replacedBy: actor,
        reason: reason.trim(),
        replacedAt: now
      });
      updates.push(updated);
    }

    const importEntry = {
      id: crypto.randomUUID(),
      actor,
      reason: reason.trim(),
      createdAt: now,
      inserted: inserts.length,
      skipped: skipped.length,
      updated: updates.length
    };
    await repository.transactions.commit({ inserts, updates, revisions, importEntry });
    return { status: "COMMITTED", preview, inserted: inserts, skipped, updated: updates };
  }

  return {
    async list() {
      return repository.transactions.listRecords();
    },

    async preview(csvText, mapping) {
      const rows = mapCsvRows(parseCsv(csvText), mapping);
      const prepared = prepare(rows, await loadMasterData());
      return { rows: previewTransactions(prepared.lines, { knownSkus: prepared.knownSkus }), rowCount: rows.length };
    },

    async commit(payload, actor) {
      const lines = Array.isArray(payload.lines)
        ? payload.lines
        : mapCsvRows(parseCsv(payload.csvText), payload.mapping);
      return commitLines(lines, {
        approveUpdates: payload.approveUpdates === true,
        reason: payload.reason,
        actor
      });
    },

    async manual(input, actor) {
      return commitLines([input], { approveUpdates: false, reason: input.reason, actor });
    },

    async adjust(input, actor) {
      if (!input.sourceReference || !Number.isInteger(input.amount) || input.amount < 0 || !input.note) {
        return { error: { code: "INVALID_INPUT", message: "Referensi sumber, nilai rupiah, dan catatan wajib diisi." } };
      }
      const existing = await repository.transactions.findAdjustment(input.sourceReference, input.amount);
      if (existing) return { value: existing, duplicate: true };
      const adjustment = {
        id: crypto.randomUUID(),
        sourceReference: input.sourceReference,
        amount: input.amount,
        note: input.note,
        actor,
        createdAt: new Date().toISOString()
      };
      await repository.transactions.addAdjustment(adjustment);
      return { value: adjustment };
    }
  };
}
