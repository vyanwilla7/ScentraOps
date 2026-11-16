import { request } from "../../shared/api/client.js";

export const csApi = {
  analyze: (message) => request("/cs/analyze", { method: "POST", body: { message } })
};
