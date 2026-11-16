import { request } from "../../shared/api/client.js";

export const homeApi = {
  health: () => request("/health")
};
