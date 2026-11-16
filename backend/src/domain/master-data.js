import crypto from "node:crypto";

const VALID_ROLES = new Set(["CS", "DATA", "OWNER"]);

function requiredString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function createSku(input, user) {
  if (!requiredString(input.code) || !requiredString(input.name)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Kode dan nama SKU wajib diisi." } };
  }
  if (input.stock !== undefined && input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Stok harus berupa bilangan bulat nol atau lebih, atau null jika belum diketahui." } };
  }
  const stock = input.stock === undefined ? null : input.stock;
  return {
    value: {
      id: crypto.randomUUID(),
      code: input.code.trim(),
      name: input.name.trim(),
      aliases: Array.isArray(input.aliases) ? input.aliases.filter(requiredString).map((alias) => alias.trim()) : [],
      stock,
      // A submitted stock value is already a confirmation; without it the stock stays unknown.
      stockUpdatedAt: input.stockUpdatedAt ?? (stock === null ? null : new Date().toISOString()),
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: user.username
    }
  };
}

export function updateSku(sku, input) {
  if (input.name !== undefined && !requiredString(input.name)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Nama SKU tidak boleh kosong." } };
  }
  if (input.stock !== undefined && input.stock !== null && (!Number.isInteger(input.stock) || input.stock < 0)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Stok harus berupa bilangan bulat nol atau lebih, atau null jika belum diketahui." } };
  }
  if (input.aliases !== undefined && (!Array.isArray(input.aliases) || input.aliases.some((alias) => !requiredString(alias)))) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Alias harus berupa daftar teks yang tidak kosong." } };
  }
  return {
    value: {
      ...sku,
      ...(input.name === undefined ? {} : { name: input.name.trim() }),
      ...(input.aliases === undefined ? {} : { aliases: input.aliases.map((alias) => alias.trim()) }),
      ...(input.stock === undefined ? {} : {
        stock: input.stock,
        stockUpdatedAt: input.stockUpdatedAt ?? (input.stock === null ? null : new Date().toISOString())
      }),
      ...(input.stock === undefined && input.stockUpdatedAt !== undefined ? { stockUpdatedAt: input.stockUpdatedAt } : {}),
      ...(input.active === undefined ? {} : { active: Boolean(input.active) }),
      updatedAt: new Date().toISOString()
    }
  };
}

export function createCost(input, skuId, user) {
  if (!Number.isInteger(input.amount) || input.amount < 0 || !requiredString(input.effectiveFrom) || !requiredString(input.reason)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Nominal biaya, tanggal berlaku, dan alasan wajib valid." } };
  }
  return {
    value: {
      id: crypto.randomUUID(),
      skuId,
      amount: input.amount,
      effectiveFrom: input.effectiveFrom,
      reason: input.reason.trim(),
      createdAt: new Date().toISOString(),
      createdBy: user.username
    }
  };
}

export function createKnowledge(input, user) {
  if (!requiredString(input.title) || !requiredString(input.content) || !requiredString(input.source) || !requiredString(input.version) || !requiredString(input.effectiveAt)) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "Judul, isi, sumber, versi, dan tanggal berlaku knowledge wajib diisi." } };
  }
  if (Number.isNaN(Date.parse(input.effectiveAt))) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "effectiveAt harus berupa tanggal ISO yang valid." } };
  }
  if (input.expiresAt !== undefined && input.expiresAt !== null && Number.isNaN(Date.parse(input.expiresAt))) {
    return { error: { status: 400, code: "INVALID_INPUT", message: "expiresAt harus berupa tanggal ISO yang valid." } };
  }
  return {
    value: {
      id: crypto.randomUUID(),
      title: input.title.trim(),
      content: input.content.trim(),
      source: input.source.trim(),
      version: input.version.trim(),
      effectiveAt: input.effectiveAt,
      expiresAt: input.expiresAt ?? null,
      createdAt: new Date().toISOString(),
      createdBy: user.username
    }
  };
}

export function freshness(item, now = Date.now(), limitHours = 24) {
  const expiresAt = item.expiresAt ? Date.parse(item.expiresAt) : NaN;
  if (!Number.isNaN(expiresAt)) return expiresAt >= now ? "Valid" : "Usang";
  const anchor = item.updatedAt ?? item.createdAt ?? item.effectiveAt;
  if (!anchor) return "Belum diketahui";
  const anchorTime = Date.parse(anchor);
  if (Number.isNaN(anchorTime)) return "Belum diketahui";
  return now - anchorTime <= limitHours * 60 * 60 * 1000 ? "Valid" : "Usang";
}

export function canManageMasterData(role) {
  return VALID_ROLES.has(role) && (role === "DATA" || role === "OWNER");
}
