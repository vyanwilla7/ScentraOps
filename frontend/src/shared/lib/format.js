export function formatRupiah(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Tidak berlaku";
  return `Rp ${Number(value).toLocaleString("id-ID")}`;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "Tidak berlaku";
  return Number(value).toLocaleString("id-ID");
}

export function formatMargin(margin) {
  if (margin === null || margin === undefined || Number.isNaN(Number(margin))) return "Tidak berlaku";
  return `${(Number(margin) * 100).toFixed(2)}%`;
}

export function formatDateTime(value) {
  if (!value) return "Belum diketahui";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short" }).format(date);
}
