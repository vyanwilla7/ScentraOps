import { request } from "../../shared/api/client.js";

export const authApi = {
  session: () => request("/auth/session"),
  login: (username, password) => request("/auth/login", { method: "POST", body: { username, password } }),
  logout: () => request("/auth/logout", { method: "POST" })
};
