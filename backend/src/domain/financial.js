const TEXT_FIELDS = ["marketplace", "orderId", "lineId", "orderDate", "status", "sku"];
const NUMERIC_FIELDS = [
  "quantity",
  "grossSales",
  "sellerDiscount",
  "refund",
  "unitProductCost",
  "netCommission",
  "sellerShipping",
  "packaging",
  "returnCost",
  "otherCost"
];
const REQUIRED_FIELDS = [...TEXT_FIELDS, ...NUMERIC_FIELDS];
const STRUCTURAL_NUMERIC_FIELDS = new Set(["quantity", "grossSales"]);

function isIntegerOrNull(value) {
  return value === null || (Number.isInteger(value) && value >= 0);
}

export function validateTransaction(input, { knownSkus } = {}) {
  const value = input ?? {};
  const errors = {};

  for (const field of TEXT_FIELDS) {
    if (value[field] === undefined) errors[field] = "Kolom wajib tidak tersedia.";
    else if (value[field] === null || String(value[field]).trim() === "") errors[field] = "Kolom wajib tidak boleh kosong.";
  }
  if (!errors.orderDate && !/^\d{4}-\d{2}-\d{2}$/.test(String(value.orderDate))) {
    errors.orderDate = "Tanggal harus berformat YYYY-MM-DD.";
  }

  for (const field of NUMERIC_FIELDS) {
    if (value[field] === undefined) {
      if (STRUCTURAL_NUMERIC_FIELDS.has(field)) errors[field] = "Kolom wajib tidak tersedia.";
    } else if (!isIntegerOrNull(value[field])) {
      errors[field] = "Nilai harus bilangan bulat rupiah atau NULL.";
    }
  }

  if (value.quantity !== undefined && (!Number.isInteger(value.quantity) || value.quantity <= 0)) {
    errors.quantity = "Kuantitas harus bilangan bulat lebih besar dari nol.";
  }
  if (value.status !== undefined && value.status !== "selesai") {
    errors.status = "Hanya transaksi selesai yang dapat dihitung.";
  }
  if (knownSkus && value.sku !== undefined && value.sku !== null && !knownSkus.has(String(value.sku))) {
    errors.sku = "SKU tidak dikenal pada master data aktif.";
  }
  if (Number.isInteger(value.refund) && Number.isInteger(value.grossSales) && Number.isInteger(value.sellerDiscount)
    && value.refund > value.grossSales - value.sellerDiscount) {
    errors.refund = "Refund tidak boleh melebihi penjualan bruto setelah diskon.";
  }
  if (value.recoverableReturnedProductCost !== undefined && !isIntegerOrNull(value.recoverableReturnedProductCost)) {
    errors.recoverableReturnedProductCost = "Nilai harus bilangan bulat rupiah atau NULL.";
  }
  if (Number.isInteger(value.recoverableReturnedProductCost) && Number.isInteger(value.unitProductCost) && Number.isInteger(value.quantity)
    && value.recoverableReturnedProductCost > value.quantity * value.unitProductCost) {
    errors.recoverableReturnedProductCost = "Pemulihan HPP tidak boleh melebihi HPP awal.";
  }

  const rejected = Object.keys(errors).length > 0;
  const incomplete = !rejected
    && NUMERIC_FIELDS.filter((field) => field !== "quantity")
      .some((field) => value[field] === null || value[field] === undefined);
  return {
    status: rejected ? "Ditolak" : incomplete ? "Belum lengkap" : "Lengkap",
    errors
  };
}

export function calculateLine(input, options = {}) {
  const validation = validateTransaction(input, options);
  if (validation.status !== "Lengkap") {
    return { ...input, validation, netRevenue: null, netProductCost: null, contributionProfit: null, margin: null };
  }
  const returnedProductCost = input.recoverableReturnedProductCost ?? 0;
  const netRevenue = input.grossSales - input.sellerDiscount - input.refund;
  const netProductCost = input.quantity * input.unitProductCost - returnedProductCost;
  const contributionProfit = netRevenue - netProductCost - input.netCommission - input.sellerShipping - input.packaging - input.returnCost - input.otherCost;
  return {
    ...input,
    validation,
    netRevenue,
    netProductCost,
    contributionProfit,
    margin: netRevenue > 0 ? contributionProfit / netRevenue : null
  };
}

export function aggregateLines(lines) {
  const complete = lines.filter((line) => line.active !== false
    && line.validation?.status === "Lengkap"
    && Number.isFinite(line.netRevenue)
    && Number.isFinite(line.contributionProfit));
  const netRevenue = complete.reduce((sum, line) => sum + line.netRevenue, 0);
  const contributionProfit = complete.reduce((sum, line) => sum + line.contributionProfit, 0);
  return {
    completeCount: complete.length,
    totalCount: lines.length,
    coverage: lines.length ? complete.length / lines.length : null,
    netRevenue,
    contributionProfit,
    margin: netRevenue > 0 ? contributionProfit / netRevenue : null,
    zeroRevenueCount: complete.filter((line) => line.netRevenue === 0).length,
    incompleteCount: lines.length - complete.length
  };
}

function compareLineIds(left, right) {
  const leftNumber = Number(left);
  const rightNumber = Number(right);
  if (Number.isFinite(leftNumber) && Number.isFinite(rightNumber)) return leftNumber - rightNumber;
  return String(left).localeCompare(String(right), undefined, { numeric: true });
}

export function allocateAmount(lines, amount, basis) {
  if (!Number.isInteger(amount) || amount < 0) throw new Error("Alokasi harus bilangan bulat nol atau lebih.");
  if (!Array.isArray(lines) || lines.length === 0) throw new Error("Baris alokasi wajib diisi.");
  const basisValues = lines.map((line) => line[basis] ?? 0);
  if (basisValues.some((value) => !Number.isInteger(value) || value < 0)) {
    throw new Error("Basis alokasi harus bilangan bulat nol atau lebih.");
  }
  const totalBasis = basisValues.reduce((sum, value) => sum + value, 0);
  if (totalBasis <= 0) throw new Error("Basis alokasi harus lebih besar dari nol.");

  // Integer arithmetic keeps allocations exact and independent of row order.
  const parts = lines.map((line, index) => {
    const numerator = amount * basisValues[index];
    const floor = Math.floor(numerator / totalBasis);
    return { lineId: line.lineId, amount: floor, remainder: numerator - floor * totalBasis };
  });
  let remainder = amount - parts.reduce((sum, part) => sum + part.amount, 0);
  const ordered = [...parts].sort((left, right) => right.remainder - left.remainder || compareLineIds(left.lineId, right.lineId));
  for (let index = 0; index < ordered.length && remainder > 0; index += 1, remainder -= 1) ordered[index].amount += 1;
  return parts
    .sort((left, right) => compareLineIds(left.lineId, right.lineId))
    .map(({ lineId, amount: value }) => ({ lineId, amount: value }));
}

export const referenceFixtures = {
  D001: { marketplace: "Shopee", orderId: "D001", lineId: 1, orderDate: "2026-11-12", status: "selesai", sku: "KRM-AJW-500", quantity: 1, grossSales: 100000, sellerDiscount: 10000, refund: 0, unitProductCost: 50000, recoverableReturnedProductCost: 0, netCommission: 5000, sellerShipping: 3000, packaging: 2000, returnCost: 0, otherCost: 0 },
  D002: { marketplace: "TikTok Shop", orderId: "D002", lineId: 1, orderDate: "2026-11-12", status: "selesai", sku: "KCG-ARB-250", quantity: 1, grossSales: 150000, sellerDiscount: 0, refund: 150000, unitProductCost: 70000, recoverableReturnedProductCost: 70000, netCommission: 0, sellerShipping: 5000, packaging: 2000, returnCost: 8000, otherCost: 0 },
  D003: { marketplace: "Lazada", orderId: "D003", lineId: 1, orderDate: "2026-11-13", status: "selesai", sku: "KRM-AJW-500", quantity: 1, grossSales: 100000, sellerDiscount: 0, refund: 0, unitProductCost: 50000, recoverableReturnedProductCost: 0, netCommission: null, sellerShipping: 3000, packaging: 2000, returnCost: 0, otherCost: 0 },
  D004: { marketplace: "Shopee", orderId: "D004", lineId: 1, orderDate: "2026-11-13", status: "selesai", sku: "KCG-ARB-250", quantity: 2, grossSales: 200000, sellerDiscount: 0, refund: 100000, unitProductCost: 50000, recoverableReturnedProductCost: 50000, netCommission: 8000, sellerShipping: 6000, packaging: 4000, returnCost: 7000, otherCost: 0 },
  D005: { marketplace: "Lazada", orderId: "D005", lineId: 1, orderDate: "2026-11-13", status: "selesai", sku: "CKL-TUR-200", quantity: 1, grossSales: 120000, sellerDiscount: 0, refund: 120000, unitProductCost: 60000, recoverableReturnedProductCost: 0, netCommission: 0, sellerShipping: 4000, packaging: 2000, returnCost: 9000, otherCost: 0 },
  D006: { marketplace: "Shopee", orderId: "D006", lineId: 1, orderDate: "2026-11-13", status: "selesai", sku: "SWK-005", quantity: 1, grossSales: 50000, sellerDiscount: 0, refund: 0, unitProductCost: 45000, recoverableReturnedProductCost: 0, netCommission: 5000, sellerShipping: 8000, packaging: 2000, returnCost: 0, otherCost: 0 }
};
