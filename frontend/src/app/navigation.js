import { can } from "../shared/lib/permissions.js";

export const ROLE_LABELS = {
  CS: "Customer Service",
  DATA: "Staf Data",
  OWNER: "Pemilik"
};

export const VIEWS = [
  { id: "home", label: "Beranda" },
  { id: "cs", label: "Asisten CS", permission: "cs:analyze" },
  { id: "tickets", label: "Tiket keluhan", permission: "tickets:read" },
  { id: "profit", label: "Analisis laba", permission: "profit:read" },
  { id: "transactions", label: "Transaksi", permission: "transactions:read" },
  { id: "master", label: "Master data", permission: "catalog:read" },
  { id: "settings", label: "Pengaturan", permission: "settings:read" }
];

export function viewsForUser(user) {
  return VIEWS.filter((view) => !view.permission || can(user, view.permission));
}
