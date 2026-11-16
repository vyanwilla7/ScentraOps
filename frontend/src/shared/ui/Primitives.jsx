const TONE_BY_STATUS = {
  Valid: "ok",
  Lengkap: "ok",
  Selesai: "ok",
  Aktif: "ok",
  COMMITTED: "ok",
  Usang: "warn",
  "Belum lengkap": "warn",
  Diproses: "warn",
  Baru: "warn",
  Ditolak: "danger",
  "Belum diketahui": "danger",
  Nonaktif: "danger"
};

export function StatusPill({ status }) {
  const tone = TONE_BY_STATUS[status] ?? "neutral";
  return <span className={`pill pill-${tone}`}>{status ?? "Tidak diketahui"}</span>;
}

export function Loading({ children = "Memuat data…" }) {
  return <p className="muted" role="status">{children}</p>;
}

export function EmptyState({ children }) {
  return <p className="empty">{children}</p>;
}

export function Alert({ tone = "danger", children }) {
  return (
    <p className={`alert alert-${tone}`} role={tone === "danger" ? "alert" : "status"}>
      {children}
    </p>
  );
}
