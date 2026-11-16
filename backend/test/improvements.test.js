import test from "node:test";
import assert from "node:assert/strict";
import { aggregateLines, allocateAmount, calculateLine, referenceFixtures, validateTransaction } from "../src/domain/financial.js";
import { analyzeMessage } from "../src/domain/cs-engine.js";
import { buildDashboard } from "../src/domain/dashboard.js";
import { createSku } from "../src/domain/master-data.js";
import { createComplaintTicket } from "../src/domain/tickets.js";
import { createAdjustment } from "../src/domain/transactions.js";
import { createTicketStore, createTransactionStore } from "../src/stores/memory.js";

test("missing required cost fields are incomplete instead of silently complete", () => {
  const missingCommission = { ...referenceFixtures.D001 };
  delete missingCommission.netCommission;
  assert.equal(validateTransaction(missingCommission).status, "Belum lengkap");
  const line = calculateLine(missingCommission);
  assert.equal(line.contributionProfit, null);
  assert.equal(line.margin, null);

  const missingRevenue = { ...referenceFixtures.D001 };
  delete missingRevenue.grossSales;
  assert.equal(validateTransaction(missingRevenue).status, "Ditolak");
});

test("refunds above net gross sales are rejected", () => {
  const excessive = { ...referenceFixtures.D001, refund: 95000 };
  const validation = validateTransaction(excessive);
  assert.equal(validation.status, "Ditolak");
  assert.ok(validation.errors.refund);

  const boundary = { ...referenceFixtures.D001, refund: 90000 };
  assert.equal(validateTransaction(boundary).status, "Lengkap");
});

test("complaint keywords survive negated clauses and conjunctions", () => {
  const shortage = analyzeMessage({ message: "barang tidak rusak, cuma kurang 1 pack", skus: [], knowledge: [], now: "2026-11-16T00:00:00Z" });
  assert.equal(shortage.category, "Keluhan");
  assert.equal(shortage.complaint, true);

  const noComplaint = analyzeMessage({ message: "barang tidak rusak ya", skus: [], knowledge: [], now: "2026-11-16T00:00:00Z" });
  assert.equal(noComplaint.complaint, false);

  const notArrived = analyzeMessage({ message: "belum sampai kak sudah 5 hari", skus: [], knowledge: [], now: "2026-11-16T00:00:00Z" });
  assert.equal(notArrived.category, "Keluhan");
});

test("CS analysis picks topic-relevant knowledge and answers verified questions", () => {
  const skus = [{
    id: "sku-1",
    code: "KRM-AJW-500",
    name: "Kurma Ajwa 500gr",
    aliases: ["kurma ajwa"],
    stock: 3,
    stockUpdatedAt: "2026-11-15T23:00:00Z",
    active: true
  }];
  const knowledge = [
    { id: "k1", title: "Aturan pengiriman", content: "Pengiriman memakai JNE.", source: "Panduan A", version: "1", effectiveAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T00:00:00Z" },
    { id: "k2", title: "Stok kurma ajwa", content: "Kurma ajwa 500gr dikemas ulang.", source: "Panduan B", version: "2", effectiveAt: "2026-01-01T00:00:00Z", expiresAt: "2026-12-31T00:00:00Z" }
  ];
  const analysis = analyzeMessage({ message: "stok kurma ajwa berapa?", skus, knowledge, now: "2026-11-16T00:00:00Z" });
  assert.equal(analysis.candidate.code, "KRM-AJW-500");
  assert.equal(analysis.source, "Panduan B");
  assert.equal(analysis.category, "Pertanyaan umum");
  assert.equal(analysis.status, "Valid");
  assert.equal(analysis.verificationRequired, false);
});

test("fuzzy product matching tolerates one-character typos", () => {
  const skus = [{ id: "sku-1", code: "KRM-AJW-500", name: "Kurma Ajwa 500gr", aliases: [], stock: 3, stockUpdatedAt: "2026-11-15T23:00:00Z", active: true }];
  const analysis = analyzeMessage({ message: "kurma ajva 500g ada gk?", skus, knowledge: [], now: "2026-11-16T00:00:00Z" });
  assert.equal(analysis.candidate?.code, "KRM-AJW-500");
  assert.equal(analysis.matching.method, "fuzzy");
});

test("ambiguous product candidates are not chosen automatically", () => {
  const skus = [
    { id: "sku-1", code: "KRM-AJW-500", name: "Kurma Ajwa 500gr", aliases: ["kurma"], stock: 3, stockUpdatedAt: "2026-11-16T00:00:00Z", active: true },
    { id: "sku-2", code: "KRM-AJW-1KG", name: "Kurma Ajwa 1kg", aliases: ["kurma"], stock: 2, stockUpdatedAt: "2026-11-16T00:00:00Z", active: true }
  ];
  const analysis = analyzeMessage({ message: "yang ready kurma atau kacang?", skus, knowledge: [], now: "2026-11-16T00:00:00Z" });
  assert.equal(analysis.candidate, null);
  assert.equal(analysis.category, "Informasi belum pasti");
});

test("dashboard excludes inactive transaction versions everywhere", () => {
  const records = [
    { ...calculateLine(referenceFixtures.D001), id: "active-1", active: true },
    { ...calculateLine(referenceFixtures.D006), id: "old-version", active: false }
  ];
  const report = buildDashboard(records, {});
  assert.equal(report.summary.totalCount, 1);
  assert.equal(report.summary.contributionProfit, 30000);
  assert.equal(report.items.length, 1);
  assert.equal(report.items[0].id, "active-1");
});

test("confirming stock records its freshness timestamp", () => {
  const created = createSku({ code: "SKU-NEW", name: "Produk Baru", stock: 0 }, { username: "data-demo" }).value;
  assert.equal(created.stock, 0);
  assert.ok(created.stockUpdatedAt);
  const withoutStock = createSku({ code: "SKU-UNKNOWN", name: "Produk Tanpa Stok" }, { username: "data-demo" }).value;
  assert.equal(withoutStock.stock, null);
  assert.equal(withoutStock.stockUpdatedAt, null);
});

test("re-analysing the same complaint reuses the open ticket", () => {
  const store = createTicketStore();
  const analysis = analyzeMessage({ message: "Paket saya belum sampai", skus: [], knowledge: [], now: "2026-11-16T00:00:00Z" });
  const user = { username: "cs-demo" };
  const first = createComplaintTicket({ message: "Paket saya belum sampai", analysis, user, store });
  const second = createComplaintTicket({ message: "Paket saya belum sampai", analysis, user, store });
  assert.equal(second.id, first.id);
  assert.equal(store.tickets.length, 1);
});

test("identical adjustments are treated as duplicates", () => {
  const store = createTransactionStore();
  const first = createAdjustment(store, { sourceReference: "REF-1", amount: 5000, note: "Koreksi ongkir" }, "data-demo");
  const second = createAdjustment(store, { sourceReference: "REF-1", amount: 5000, note: "Koreksi ongkir" }, "data-demo");
  assert.equal(second.duplicate, true);
  assert.equal(store.adjustments.length, 1);
  assert.equal(first.value.amount, 5000);
});

test("allocation includes every rupiah and ignores input order", () => {
  const first = aggregateLines([]);
  assert.equal(first.coverage, null);
  const lines = [{ lineId: "b", quantity: 1 }, { lineId: "a", quantity: 1 }, { lineId: "c", quantity: 1 }];
  const allocation = allocateAmount(lines, 100, "quantity");
  assert.equal(allocation.reduce((sum, part) => sum + part.amount, 0), 100);
  assert.deepEqual(allocation.map((part) => part.lineId), ["a", "b", "c"]);
});
