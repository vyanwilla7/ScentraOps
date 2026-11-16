import { buildQuery, request } from "../../shared/api/client.js";

export const profitApi = {
  dashboard: (filters) => request(`/profit${buildQuery(filters)}`),
  detail: (id) => request(`/profit/${id}`)
};
