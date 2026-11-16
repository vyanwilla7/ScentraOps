import { request } from "../../shared/api/client.js";

export const settingsApi = {
  get: () => request("/settings"),
  update: (payload) => request("/settings", { method: "PATCH", body: payload })
};
