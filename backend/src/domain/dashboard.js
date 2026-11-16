import { aggregateLines } from "./financial.js";

function matches(line, filters) {
  if (filters.marketplace && line.marketplace !== filters.marketplace) return false;
  if (filters.sku && line.sku !== filters.sku) return false;
  if (filters.status && line.validation?.status !== filters.status) return false;
  if (filters.from && line.orderDate < filters.from) return false;
  if (filters.to && line.orderDate > filters.to) return false;
  return true;
}

function groupBy(lines, field) {
  const groups = new Map();
  for (const line of lines) {
    const key = line[field] ?? "Tidak diketahui";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(line);
  }
  return [...groups.entries()]
    .map(([key, group]) => ({ key, ...aggregateLines(group) }))
    .sort((left, right) => right.contributionProfit - left.contributionProfit);
}

export function buildDashboard(records, filters = {}, options = {}) {
  // Only the active version of each transaction key is reportable.
  const activeRecords = records.filter((line) => line.active !== false);
  const filtered = activeRecords.filter((line) => matches(line, filters));
  const summary = aggregateLines(filtered);
  const complete = filtered.filter((line) => line.validation?.status === "Lengkap");
  const lowMarginPercent = Number.isFinite(options.lowMarginPercent) ? options.lowMarginPercent : null;
  return {
    filters,
    summary,
    signals: {
      losses: complete.filter((line) => line.contributionProfit < 0).length,
      zeroRevenue: complete.filter((line) => line.netRevenue === 0).length,
      incomplete: filtered.filter((line) => line.validation?.status !== "Lengkap").length,
      lowMargin: lowMarginPercent === null
        ? null
        : complete.filter((line) => line.netRevenue > 0 && line.margin !== null && line.margin * 100 < lowMarginPercent).length,
      lowMarginThreshold: lowMarginPercent,
      disclaimer: "Laba kontribusi belum memperhitungkan biaya tetap dan bukan laba bersih usaha."
    },
    byMarketplace: groupBy(filtered, "marketplace"),
    bySku: groupBy(filtered, "sku"),
    items: filtered
  };
}
