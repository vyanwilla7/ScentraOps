export const CAPABILITIES = Object.freeze({
  CS_ANALYZE: "cs:analyze",
  TICKETS_READ: "tickets:read",
  TICKETS_MANAGE: "tickets:manage",
  CATALOG_READ: "catalog:read",
  CATALOG_MANAGE: "catalog:manage",
  COSTS_READ: "costs:read",
  COSTS_MANAGE: "costs:manage",
  KNOWLEDGE_READ: "knowledge:read",
  KNOWLEDGE_MANAGE: "knowledge:manage",
  TRANSACTIONS_READ: "transactions:read",
  TRANSACTIONS_MANAGE: "transactions:manage",
  PROFIT_READ: "profit:read",
  SETTINGS_READ: "settings:read",
  SETTINGS_MANAGE: "settings:manage",
  AUDIT_READ: "audit:read"
});

const C = CAPABILITIES;

/**
 * Proposal Tabel 7 (Akses): CS, staf data, pemilik.
 * DATA only gets audit access when explicitly listed by the operator.
 */
const ROLE_PERMISSIONS = Object.freeze({
  CS: Object.freeze([
    C.CS_ANALYZE,
    C.TICKETS_READ,
    C.TICKETS_MANAGE,
    C.CATALOG_READ,
    C.KNOWLEDGE_READ
  ]),
  DATA: Object.freeze([
    C.CS_ANALYZE,
    C.TICKETS_READ,
    C.CATALOG_READ,
    C.CATALOG_MANAGE,
    C.COSTS_READ,
    C.COSTS_MANAGE,
    C.KNOWLEDGE_READ,
    C.KNOWLEDGE_MANAGE,
    C.TRANSACTIONS_READ,
    C.TRANSACTIONS_MANAGE,
    C.PROFIT_READ,
    C.SETTINGS_READ,
    C.SETTINGS_MANAGE
  ]),
  OWNER: Object.freeze([
    C.CS_ANALYZE,
    C.TICKETS_READ,
    C.CATALOG_READ,
    C.COSTS_READ,
    C.COSTS_MANAGE,
    C.KNOWLEDGE_READ,
    C.TRANSACTIONS_READ,
    C.PROFIT_READ,
    C.SETTINGS_READ,
    C.AUDIT_READ
  ])
});

export function permissionsFor(role, { auditViewers = [], username } = {}) {
  const permissions = [...(ROLE_PERMISSIONS[role] ?? [])];
  if (role === "DATA" && username && auditViewers.includes(username) && !permissions.includes(C.AUDIT_READ)) {
    permissions.push(C.AUDIT_READ);
  }
  return permissions;
}

export function hasPermission(permissions, capability) {
  return Array.isArray(permissions) && permissions.includes(capability);
}
