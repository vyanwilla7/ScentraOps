import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../src/app.js";

async function startTestApp(t, options = {}) {
  const app = createApp(options);
  const server = app.listen(0);
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}`;
}

async function login(baseUrl, username) {
  const response = await fetch(`${baseUrl}/api/v1/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password: "demo123" })
  });
  const cookie = response.headers.get("set-cookie").split(";")[0];
  const body = await response.json();
  return { cookie, user: body.user };
}

async function createSku(baseUrl, cookie, code = "ROLE-SKU") {
  const response = await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({ code, name: "Produk Peran", stock: 3 })
  });
  assert.equal(response.status, 201);
  return (await response.json()).item;
}

test("session returns proposal permissions per role", async (t) => {
  const baseUrl = await startTestApp(t);
  const cs = await login(baseUrl, "cs-demo");
  const data = await login(baseUrl, "data-demo");
  const owner = await login(baseUrl, "owner-demo");

  assert.ok(cs.user.permissions.includes("tickets:manage"));
  assert.equal(cs.user.permissions.includes("costs:read"), false);
  assert.equal(cs.user.permissions.includes("profit:read"), false);
  assert.equal(cs.user.permissions.includes("settings:read"), false);

  assert.ok(data.user.permissions.includes("catalog:manage"));
  assert.ok(data.user.permissions.includes("costs:manage"));
  assert.ok(data.user.permissions.includes("settings:manage"));
  assert.ok(data.user.permissions.includes("transactions:manage"));
  assert.equal(data.user.permissions.includes("audit:read"), false);

  assert.ok(owner.user.permissions.includes("costs:manage"));
  assert.ok(owner.user.permissions.includes("audit:read"));
  assert.ok(owner.user.permissions.includes("settings:read"));
  assert.equal(owner.user.permissions.includes("catalog:manage"), false);
  assert.equal(owner.user.permissions.includes("settings:manage"), false);
  assert.equal(owner.user.permissions.includes("transactions:manage"), false);
});

test("role matrix denies and allows the endpoints from proposal Tabel 7", async (t) => {
  const baseUrl = await startTestApp(t);
  const cs = await login(baseUrl, "cs-demo");
  const data = await login(baseUrl, "data-demo");
  const owner = await login(baseUrl, "owner-demo");
  const sku = await createSku(baseUrl, data.cookie);

  // OWNER reads catalog/stock/knowledge but does not manage them.
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus`, { headers: { cookie: owner.cookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus`, {
    method: "POST", headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ code: "OWNER-SKU", name: "Tidak Boleh" })
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}`, {
    method: "PATCH", headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ stock: 1 })
  })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/knowledge`, {
    method: "POST", headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ title: "Aturan", content: "Isi", source: "Sumber", version: "1", effectiveAt: "2026-01-01T00:00:00Z" })
  })).status, 403);

  // OWNER and DATA manage HPP; CS has no access at all.
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, {
    method: "POST", headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ amount: 50000, effectiveFrom: "2026-01-01", reason: "HPP pemilik" })
  })).status, 201);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, {
    method: "POST", headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ amount: 51000, effectiveFrom: "2026-02-01", reason: "HPP data" })
  })).status, 201);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, { headers: { cookie: cs.cookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, { headers: { cookie: owner.cookie } })).status, 200);

  // CS reads knowledge but not audit/settings/profit/transactions.
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/knowledge`, { headers: { cookie: cs.cookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: cs.cookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/settings`, { headers: { cookie: cs.cookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/profit`, { headers: { cookie: cs.cookie } })).status, 403);
  assert.equal((await fetch(`${baseUrl}/api/v1/transactions`, { headers: { cookie: cs.cookie } })).status, 403);

  // DATA manages settings but cannot read audit without explicit authorization.
  assert.equal((await fetch(`${baseUrl}/api/v1/settings`, { headers: { cookie: data.cookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: data.cookie } })).status, 403);

  // OWNER reads settings and audit, but does not manage settings.
  assert.equal((await fetch(`${baseUrl}/api/v1/settings`, { headers: { cookie: owner.cookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: owner.cookie } })).status, 200);
  assert.equal((await fetch(`${baseUrl}/api/v1/settings`, {
    method: "PATCH", headers: { cookie: owner.cookie, "content-type": "application/json" },
    body: JSON.stringify({ freshnessLimitHours: 10, reason: "Tidak berwenang" })
  })).status, 403);
});

test("DATA manages settings with audit trail and validation", async (t) => {
  const baseUrl = await startTestApp(t);
  const data = await login(baseUrl, "data-demo");
  const owner = await login(baseUrl, "owner-demo");

  const initial = await fetch(`${baseUrl}/api/v1/settings`, { headers: { cookie: data.cookie } });
  assert.equal(initial.status, 200);
  const defaults = (await initial.json()).item;
  assert.equal(defaults.freshnessLimitHours, 24);
  assert.equal(defaults.shippingCutoffBufferMinutes, 30);

  const updated = await fetch(`${baseUrl}/api/v1/settings`, {
    method: "PATCH",
    headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ freshnessLimitHours: 12, lowMarginPercent: 15, reason: "Evaluasi uji internal" })
  });
  assert.equal(updated.status, 200);
  assert.equal((await updated.json()).item.freshnessLimitHours, 12);

  const invalid = await fetch(`${baseUrl}/api/v1/settings`, {
    method: "PATCH",
    headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ freshnessLimitHours: 0, reason: "Nilai salah" })
  });
  assert.equal(invalid.status, 400);

  const audit = await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: owner.cookie } });
  const entries = (await audit.json()).items;
  assert.equal(entries[0].entity, "settings");
  assert.equal(entries[0].actor, "data-demo");
  assert.equal(entries[0].after.freshnessLimitHours, 12);
});

test("DATA audit access requires explicit authorization", async (t) => {
  const baseUrl = await startTestApp(t, {
    config: { allowedOrigins: ["http://localhost:5173"], auditViewers: ["data-demo"] }
  });
  const data = await login(baseUrl, "data-demo");
  assert.ok(data.user.permissions.includes("audit:read"));
  const audit = await fetch(`${baseUrl}/api/v1/master-data/audit`, { headers: { cookie: data.cookie } });
  assert.equal(audit.status, 200);
});

test("transactions reject unknown SKUs and resolve effective HPP", async (t) => {
  const baseUrl = await startTestApp(t);
  const data = await login(baseUrl, "data-demo");
  const sku = await createSku(baseUrl, data.cookie, "KRM-COST");

  await fetch(`${baseUrl}/api/v1/master-data/skus/${sku.id}/costs`, {
    method: "POST", headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ amount: 45000, effectiveFrom: "2026-01-01", reason: "HPP uji" })
  });

  const base = {
    marketplace: "Shopee", orderId: "TX-ROLE-1", lineId: 1, orderDate: "2026-11-15", status: "selesai",
    sku: "KRM-COST", quantity: 1, grossSales: 100000, sellerDiscount: 0, refund: 0,
    recoverableReturnedProductCost: 0, netCommission: 5000, sellerShipping: 3000,
    packaging: 2000, returnCost: 0, otherCost: 0
  };

  const resolved = await fetch(`${baseUrl}/api/v1/transactions/manual`, {
    method: "POST", headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ ...base, reason: "HPP dari master" })
  });
  assert.equal(resolved.status, 201);
  const resolvedBody = await resolved.json();
  assert.equal(resolvedBody.inserted[0].unitProductCost, 45000);

  const unknown = await fetch(`${baseUrl}/api/v1/transactions/manual`, {
    method: "POST", headers: { cookie: data.cookie, "content-type": "application/json" },
    body: JSON.stringify({ ...base, orderId: "TX-ROLE-2", sku: "TIDAK-ADA", reason: "SKU salah" })
  });
  assert.equal(unknown.status, 400);
  const rejected = await unknown.json();
  assert.equal(rejected.result.preview[0].errors.sku, "SKU tidak dikenal pada master data aktif.");
});

test("Swagger UI and the OpenAPI contract are served", async (t) => {
  const baseUrl = await startTestApp(t);
  const specResponse = await fetch(`${baseUrl}/api/v1/openapi.json`);
  assert.equal(specResponse.status, 200);
  const spec = await specResponse.json();
  assert.match(spec.openapi, /^3\./);
  assert.equal(spec.servers[0].url, "/api/v1");

  const expectedPaths = [
    "/health", "/auth/login", "/auth/session", "/auth/logout", "/catalog",
    "/master-data/skus", "/master-data/skus/{id}", "/master-data/skus/{id}/costs",
    "/master-data/knowledge", "/master-data/audit", "/cs/analyze", "/tickets",
    "/tickets/{id}", "/financial/calculate", "/financial/aggregate", "/financial/allocate",
    "/transactions", "/transactions/manual", "/transactions/import/preview",
    "/transactions/import/commit", "/transactions/adjustments", "/profit", "/profit/{id}",
    "/settings"
  ];
  for (const path of expectedPaths) assert.ok(spec.paths[path], `missing ${path}`);

  const docs = await fetch(`${baseUrl}/api/v1/docs/`);
  assert.equal(docs.status, 200);
  assert.match(docs.headers.get("content-type") ?? "", /text\/html/);
});
