import { buildQuery, request } from "../../shared/api/client.js";

export const ticketsApi = {
  list: (filters) => request(`/tickets${buildQuery(filters)}`),
  get: (id) => request(`/tickets/${id}`),
  update: (id, payload) => request(`/tickets/${id}`, { method: "PATCH", body: payload })
};
