import { request } from "../../shared/api/client.js";

export const importFields = [
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
  "netCommission",
  "sellerShipping",
  "packaging",
  "returnCost",
  "otherCost"
];

const importMapping = Object.fromEntries(importFields.map((field) => [field, field]));

export const transactionsApi = {
  list: () => request("/transactions"),
  catalog: () => request("/catalog"),
  manual: (payload) => request("/transactions/manual", { method: "POST", body: payload }),
  preview: (csvText) => request("/transactions/import/preview", { method: "POST", body: { csvText, mapping: importMapping } }),
  commit: ({ csvText, reason, approveUpdates }) => request("/transactions/import/commit", {
    method: "POST",
    body: { csvText, mapping: importMapping, reason, approveUpdates }
  }),
  adjust: (payload) => request("/transactions/adjustments", { method: "POST", body: payload })
};
