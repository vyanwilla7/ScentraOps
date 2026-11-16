import { request } from "../../shared/api/client.js";

export const masterDataApi = {
  list: () => request("/master-data/skus"),
  create: (payload) => request("/master-data/skus", { method: "POST", body: payload }),
  update: (id, payload) => request(`/master-data/skus/${id}`, { method: "PATCH", body: payload }),
  costs: (skuId) => request(`/master-data/skus/${skuId}/costs`),
  createCost: (skuId, payload) => request(`/master-data/skus/${skuId}/costs`, { method: "POST", body: payload }),
  knowledge: () => request("/master-data/knowledge"),
  createKnowledge: (payload) => request("/master-data/knowledge", { method: "POST", body: payload }),
  audit: () => request("/master-data/audit")
};
