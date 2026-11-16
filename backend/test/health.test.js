import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";
import { aggregateLines, allocateAmount, calculateLine, referenceFixtures } from "../src/domain/financial.js";

test("health endpoint exposes the versioned backend boundary", async (t) => {
  const app = createApp();
  const server = app.listen(0);
  t.after(() => server.close());
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    service: "scentraops-backend",
    status: "ok",
    database: "not-configured",
    simulatedData: true,
    apiVersion: "v1"
  });
});

async function startTestApp(t, options = {}) {
  const app = createApp(options);
  const server = app.listen(0);
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

test("unauthenticated requests are denied by the backend", async (t) => {
  const baseUrl = await startTestApp(t);
  const response = await fetch(`${baseUrl}/api/v1/auth/session`);
  assert.equal(response.status, 401);
  assert.equal((await response.json()).code, "UNAUTHENTICATED");
});

test("role authorization denies CS access to profit and allows owner", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = async (username) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "demo123" })
    });
    const cookie = response.headers.get("set-cookie").split(";")[0];
    return { response, cookie };
  };
  const cs = await login("cs-demo");
  const denied = await fetch(`${baseUrl}/api/v1/profit`, { headers: { cookie: cs.cookie } });
  assert.equal(denied.status, 403);
  assert.equal((await denied.json()).code, "FORBIDDEN");
  const owner = await login("owner-demo");
  const allowed = await fetch(`${baseUrl}/api/v1/profit`, { headers: { cookie: owner.cookie } });
  assert.equal(allowed.status, 200);
});

test("logout invalidates the server-side session", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const logout = await fetch(`${baseUrl}/api/v1/auth/logout`, { method: "POST", headers: { cookie } });
  assert.equal(logout.status, 200);
  const session = await fetch(`${baseUrl}/api/v1/auth/session`, { headers: { cookie } });
  assert.equal(session.status, 401);
});

test("master data supports nullable and zero stock without physical deletion", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const created = await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "SKU-001", name: "Produk Uji", stock: null })
  });
  assert.equal(created.status, 201);
  const sku = (await created.json()).item;
  assert.equal(sku.stock, null);
  const updated = await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ stock: 0, active: false })
  });
  assert.equal(updated.status, 200);
  const deletion = await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}`, { method: "DELETE", headers: { cookie } });
  assert.equal(deletion.status, 404);
  const listed = await fetch(`${baseUrl}/api/v1/master-data/skus`, { headers: { cookie } });
  assert.equal((await listed.json()).items[0].active, false);
});

test("costs remain versioned and knowledge requires source metadata", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = async (username) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "demo123" })
    });
    return response.headers.get("set-cookie").split(";")[0];
  };
  const dataCookie = await login("data-demo");
  const created = await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST",
    headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "SKU-002", name: "Biaya Uji", stock: 2 })
  });
  const sku = (await created.json()).item;

  const invalidKnowledge = await fetch(`${baseUrl}/api/v1/master-data/knowledge`, {
    method: "POST",
    headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Aturan", content: "Isi", version: "1" })
  });
  assert.equal(invalidKnowledge.status, 400);
  const knowledge = await fetch(`${baseUrl}/api/v1/master-data/knowledge`, {
    method: "POST",
    headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Aturan", content: "Isi", source: "Panduan", version: "1", effectiveAt: "2026-01-01T00:00:00Z", expiresAt: "2020-01-01T00:00:00Z" })
  });
  assert.equal((await knowledge.json()).item.freshness, "Usang");

  const ownerCookie = await login("owner-demo");
  for (const amount of [10000, 12000]) {
    const cost = await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, {
      method: "POST",
      headers: { cookie: ownerCookie, "content-type": "application/json" },
      body: JSON.stringify({ amount, effectiveFrom: "2026-01-01", reason: "Pembaruan pemasok" })
    });
    assert.equal(cost.status, 201);
  }
  const costs = await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, { headers: { cookie: ownerCookie } });
  assert.deepEqual((await costs.json()).items.map((item) => item.amount), [10000, 12000]);
  const audit = await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: ownerCookie } });
  assert.equal((await audit.json()).items.length, 4);
});

test("CS analysis normalizes, prioritizes complaints, and never promises stale stock", async (t) => {
  const baseUrl = await startTestApp(t);
  const dataLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const dataCookie = dataLogin.headers.get("set-cookie").split(";")[0];
  const created = await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST",
    headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({
      code: "PARFUM-A",
      name: "Parfum A",
      aliases: ["parfum aa"],
      stock: 5,
      stockUpdatedAt: "2026-11-13T00:00:00Z"
    })
  });
  assert.equal(created.status, 201);
  const csLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "cs-demo", password: "demo123" })
  });
  const cookie = csLogin.headers.get("set-cookie").split(";")[0];
  const analysis = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      message: "Paket saya blm sampai, stok parfum aa ada gaa?",
      now: "2026-11-15T00:00:00Z"
    })
  });
  assert.equal(analysis.status, 200);
  const result = (await analysis.json()).analysis;
  assert.equal(result.normalized, "paket saya belum sampai stok parfum aa ada tidak?");
  assert.equal(result.category, "Keluhan");
  assert.equal(result.automaticSending, false);
  assert.equal(result.status, "Usang");
});

test("CS analysis requires authentication and applies shipping cutoff boundaries", async (t) => {
  const baseUrl = await startTestApp(t);
  const denied = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ message: "kapan dikirim?" })
  });
  assert.equal(denied.status, 401);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "cs-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const response = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      message: "kapan pengiriman?",
      now: "2026-11-15T10:30:00Z",
      cutoff: "2026-11-15T11:00:00Z",
      bufferMinutes: 30
    })
  });
  assert.equal((await response.json()).analysis.shipping.status, "Usang");
});

test("complaint analysis creates one ticket and preserves ticket history", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "cs-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const analyzed = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ message: "Paket saya belum sampai!" })
  });
  assert.equal(analyzed.status, 200);
  const ticket = (await analyzed.json()).ticket;
  assert.equal(ticket.type, "Keluhan");
  assert.equal(ticket.status, "Baru");
  const queue = await fetch(`${baseUrl}/api/v1/tickets`, { headers: { cookie } });
  assert.equal((await queue.json()).items.length, 1);
  const updated = await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, {
    method: "PATCH",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "Diproses", assignee: "cs-demo", reason: "Mulai verifikasi ke staf data." })
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).history.length, 3);
  const nonComplaint = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ message: "Berapa harga produk ini?" })
  });
  assert.equal((await nonComplaint.json()).ticket, null);
});

test("DATA can read tickets but cannot change ticket status", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = async (username) => {
    const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password: "demo123" })
    });
    return response.headers.get("set-cookie").split(";")[0];
  };
  const csCookie = await login("cs-demo");
  const created = await fetch(`${baseUrl}/api/v1/cs/analyze`, {
    method: "POST",
    headers: { cookie: csCookie, "content-type": "application/json" },
    body: JSON.stringify({ message: "Barang rusak dan bocor." })
  });
  const ticket = (await created.json()).ticket;
  const dataCookie = await login("data-demo");
  const read = await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, { headers: { cookie: dataCookie } });
  assert.equal(read.status, 200);
  const denied = await fetch(`${baseUrl}/api/v1/tickets/${ticket.id}`, {
    method: "PATCH",
    headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({ status: "Selesai", reason: "Tidak berwenang." })
  });
  assert.equal(denied.status, 403);
});

test("financial reference fixtures derive the Appendix C results", () => {
  const d001 = calculateLine(referenceFixtures.D001);
  const d002 = calculateLine(referenceFixtures.D002);
  const d003 = calculateLine(referenceFixtures.D003);
  const d004 = calculateLine(referenceFixtures.D004);
  const d005 = calculateLine(referenceFixtures.D005);
  const d006 = calculateLine(referenceFixtures.D006);
  assert.equal(d001.contributionProfit, 30000);
  assert.equal(d001.margin, 1 / 3);
  assert.equal(d002.contributionProfit, -15000);
  assert.equal(d002.margin, null);
  assert.equal(d003.validation.status, "Belum lengkap");
  assert.equal(d004.contributionProfit, 25000);
  assert.equal(d005.contributionProfit, -75000);
  assert.equal(d006.contributionProfit, -10000);
  assert.equal(d006.margin, -0.2);
  const summary = aggregateLines([d001, d002, d003]);
  assert.deepEqual(summary, {
    completeCount: 2,
    totalCount: 3,
    coverage: 2 / 3,
    netRevenue: 90000,
    contributionProfit: 15000,
    margin: 1 / 6,
    zeroRevenueCount: 1,
    incompleteCount: 1
  });
});

test("financial allocation is exact and independent of input order", () => {
  const valueBased = allocateAmount([
    { lineId: 2, grossSales: 50000 },
    { lineId: 1, grossSales: 100000 }
  ], 10000, "grossSales");
  assert.deepEqual(valueBased, [{ lineId: 1, amount: 6667 }, { lineId: 2, amount: 3333 }]);
  const quantityBased = allocateAmount([
    { lineId: 2, quantity: 2 },
    { lineId: 1, quantity: 1 }
  ], 10000, "quantity");
  assert.deepEqual(quantityBased, [{ lineId: 1, amount: 3333 }, { lineId: 2, amount: 6667 }]);
  assert.deepEqual(allocateAmount([{ lineId: 3, grossSales: 1 }, { lineId: 1, grossSales: 1 }, { lineId: 2, grossSales: 1 }], 10000, "grossSales"), [
    { lineId: 1, amount: 3334 },
    { lineId: 2, amount: 3333 },
    { lineId: 3, amount: 3333 }
  ]);
});

test("financial API is protected and rejects zero allocation basis", async (t) => {
  const baseUrl = await startTestApp(t);
  const unauthenticated = await fetch(`${baseUrl}/api/v1/financial/calculate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(referenceFixtures.D001)
  });
  assert.equal(unauthenticated.status, 401);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const invalid = await fetch(`${baseUrl}/api/v1/financial/allocate`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ lines: [{ lineId: 1, grossSales: 0 }], amount: 100, basis: "grossSales" })
  });
  assert.equal(invalid.status, 400);
  assert.equal((await invalid.json()).code, "INVALID_ALLOCATION");
});

test("DATA can preview and commit CSV rows, skip identical reimports, and require update approval", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const skuResponse = await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "SKU-1", name: "Produk CSV", stock: 5 })
  });
  assert.equal(skuResponse.status, 201);
  const mapping = {
    marketplace: "marketplace", order_id: "orderId", line_id: "lineId", tanggal: "orderDate", status: "status",
    sku: "sku", kuantitas: "quantity", bruto: "grossSales", diskon: "sellerDiscount", refund: "refund",
    hpp: "unitProductCost", komisi: "netCommission", ongkir: "sellerShipping", kemasan: "packaging",
    retur: "returnCost", lain: "otherCost"
  };
  const csvText = "marketplace,order_id,line_id,tanggal,status,sku,kuantitas,bruto,diskon,refund,hpp,komisi,ongkir,kemasan,retur,lain\nShopee,TX-001,1,2026-11-15,selesai,SKU-1,1,100000,10000,0,50000,5000,3000,2000,0,0";
  const preview = await fetch(`${baseUrl}/api/v1/transactions/import/preview`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ csvText, mapping })
  });
  assert.equal(preview.status, 200);
  assert.equal((await preview.json()).rows[0].status, "Lengkap");
  const first = await fetch(`${baseUrl}/api/v1/transactions/import/commit`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ csvText, mapping, reason: "Import awal" })
  });
  assert.equal(first.status, 201);
  const repeated = await fetch(`${baseUrl}/api/v1/transactions/import/commit`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ csvText, mapping, reason: "Import ulang identik" })
  });
  assert.equal((await repeated.json()).skipped.length, 1);
  const changedCsv = csvText.replace("100000", "110000");
  const approval = await fetch(`${baseUrl}/api/v1/transactions/import/commit`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ csvText: changedCsv, mapping, reason: "Koreksi nilai" })
  });
  assert.equal(approval.status, 409);
  const approved = await fetch(`${baseUrl}/api/v1/transactions/import/commit`, {
    method: "POST", headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ csvText: changedCsv, mapping, reason: "Koreksi disetujui", approveUpdates: true })
  });
  assert.equal(approved.status, 201);
  assert.equal((await approved.json()).updated.length, 1);
});

test("CS is denied manual transaction entry and CSV limits are enforced", async (t) => {
  const baseUrl = await startTestApp(t);
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "cs-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const denied = await fetch(`${baseUrl}/api/v1/transactions/manual`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({})
  });
  assert.equal(denied.status, 403);
  const dataLogin = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const dataCookie = dataLogin.headers.get("set-cookie").split(";")[0];
  const oversized = await fetch(`${baseUrl}/api/v1/transactions/import/preview`, {
    method: "POST", headers: { cookie: dataCookie, "content-type": "application/json" },
    body: JSON.stringify({ csvText: "header\n" + "x".repeat(5 * 1024 * 1024), mapping: {} })
  });
  assert.equal(oversized.status, 400);
});

test("profit dashboard filters active complete lines and exposes drill-down", async (t) => {
  const seedLines = [
    { ...calculateLine(referenceFixtures.D001), id: "d001", active: true },
    { ...calculateLine(referenceFixtures.D002), id: "d002", active: true },
    { ...calculateLine(referenceFixtures.D003), id: "d003", active: true },
    { ...calculateLine(referenceFixtures.D006), id: "d006", active: false }
  ];
  const baseUrl = await startTestApp(t, { transactions: { records: seedLines, adjustments: [], imports: [] } });
  const login = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ username: "data-demo", password: "demo123" })
  });
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const dashboard = await fetch(`${baseUrl}/api/v1/profit?marketplace=Shopee`, { headers: { cookie } });
  assert.equal(dashboard.status, 200);
  const report = await dashboard.json();
  assert.equal(report.summary.totalCount, 1);
  assert.equal(report.summary.completeCount, 1);
  assert.equal(report.summary.contributionProfit, 30000);
  assert.equal(report.signals.incomplete, 0);
  assert.equal(report.signals.disclaimer.includes("bukan laba bersih usaha"), true);
  const detail = await fetch(`${baseUrl}/api/v1/profit/${report.items[0].id}`, { headers: { cookie } });
  assert.equal(detail.status, 200);
});
