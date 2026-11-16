import crypto from "node:crypto";
import { calculateLine } from "./financial.js";

const MAX_BYTES = 5 * 1024 * 1024;
const MAX_ROWS = 5000;

const COMPARABLE_FIELDS = [
  "marketplace",
  "orderId",
  "lineId",
  "orderDate",
  "status",
  "sku",
  "quantity",
  "grossSales",
  "sellerDiscount",
  "refund",
  "unitProductCost",
  "recoverableReturnedProductCost",
  "netCommission",
  "sellerShipping",
  "packaging",
  "returnCost",
  "otherCost"
];

function comparable(record) {
  return JSON.stringify(COMPARABLE_FIELDS.map((field) => [field, record[field] ?? null]));
}

export function transactionsEquivalent(left, right) {
  return comparable(left) === comparable(right);
}

export function transactionKey(line) {
  return `${line.marketplace}::${line.orderId}::${line.lineId}`;
}

export function parseCsv(csvText) {
  if (typeof csvText !== "string") throw new Error("CSV harus berupa teks UTF-8.");
  if (Buffer.byteLength(csvText, "utf8") > MAX_BYTES) throw new Error("Ukuran CSV melebihi 5 MB.");
  // Spreadsheet exports often start with a UTF-8 BOM; strip it so the first header matches the mapping.
  const rows = csvText.replace(/^\uFEFF/, "").split(/\r?\n/).filter((row) => row.trim() !== "");
  if (rows.length === 0) return [];
  if (rows.length - 1 > MAX_ROWS) throw new Error("CSV melebihi 5.000 baris data.");
  const headers = rows[0].split(",").map((header) => header.trim());
  if (headers.every((header) => header === "")) throw new Error("Header CSV tidak boleh kosong.");
  return rows.slice(1).map((row, index) => {
    const values = row.split(",");
    return { ...Object.fromEntries(headers.map((header, column) => [header, values[column]?.trim() ?? ""])), rowNumber: index + 2 };
  });
}

export function mapCsvRows(rows, mapping) {
  if (!mapping || typeof mapping !== "object" || Object.keys(mapping).length === 0) {
    throw new Error("Mapping kolom wajib diisi.");
  }
  return rows.map((row, index) => {
    const mapped = {};
    for (const [source, target] of Object.entries(mapping ?? {})) {
      if (!(source in row)) throw new Error(`Kolom "${source}" tidak ditemukan pada CSV.`);
      const value = row[source];
      if (["quantity", "grossSales", "sellerDiscount", "refund", "unitProductCost", "netCommission", "sellerShipping", "packaging", "returnCost", "otherCost", "recoverableReturnedProductCost", "lineId"].includes(target)) {
        mapped[target] = value === "" ? null : Number(value);
      } else {
        mapped[target] = value === "" ? null : value;
      }
    }
    mapped.sourceRow = row.rowNumber ?? index + 2;
    return mapped;
  });
}

export function previewTransactions(rows, options = {}) {
  return rows.map((row) => {
    const line = calculateLine(row, options);
    return {
      sourceRow: row.sourceRow,
      key: transactionKey(row),
      status: line.validation.status,
      errors: line.validation.errors,
      line
    };
  });
}

export function commitTransactions(store, lines, { approveUpdates = false, reason = "", actor, knownSkus } = {}) {
  if (typeof reason !== "string" || reason.trim() === "") throw new Error("Alasan import wajib diisi.");
  const preview = previewTransactions(lines, { knownSkus });
  const rejected = preview.filter((row) => row.status === "Ditolak");
  if (rejected.length) return { status: "REJECTED", preview, inserted: [], skipped: [], updated: [] };
  const inserted = [];
  const skipped = [];
  const updated = [];
  for (const item of preview) {
    const existingIndex = store.records.findIndex((record) => transactionKey(record) === item.key && record.active !== false);
    if (existingIndex < 0) {
      const record = { ...item.line, id: crypto.randomUUID(), active: true, sourceRow: item.sourceRow, createdBy: actor, createdAt: new Date().toISOString() };
      store.records.push(record);
      inserted.push(record);
    } else if (comparable(store.records[existingIndex]) === comparable(item.line)) {
      skipped.push(store.records[existingIndex]);
    } else if (!approveUpdates) {
      return { status: "APPROVAL_REQUIRED", preview, inserted, skipped, updated: [], updateKey: item.key };
    } else {
      // Keep the previous version instead of overwriting history.
      store.revisions.push({ ...store.records[existingIndex], replacedAt: new Date().toISOString(), replacedBy: actor, reason: reason.trim() });
      const record = { ...item.line, id: store.records[existingIndex].id, active: true, updatedBy: actor, updatedAt: new Date().toISOString(), updateReason: reason };
      store.records[existingIndex] = record;
      updated.push(record);
    }
  }
  store.imports.push({ id: crypto.randomUUID(), actor, reason: reason.trim(), createdAt: new Date().toISOString(), inserted: inserted.length, skipped: skipped.length, updated: updated.length });
  return { status: "COMMITTED", preview, inserted, skipped, updated };
}

export function createAdjustment(store, input, actor) {
  if (!input.sourceReference || !Number.isInteger(input.amount) || input.amount < 0 || !input.note) {
    return { error: { code: "INVALID_INPUT", message: "Referensi sumber, nilai rupiah, dan catatan wajib diisi." } };
  }
  const existing = store.adjustments.find((item) => item.sourceReference === input.sourceReference && item.amount === input.amount);
  if (existing) return { value: existing, duplicate: true };
  const adjustment = { id: crypto.randomUUID(), ...input, actor, createdAt: new Date().toISOString() };
  store.adjustments.push(adjustment);
  return { value: adjustment };
}
