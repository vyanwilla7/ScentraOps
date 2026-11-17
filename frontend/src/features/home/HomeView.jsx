import { useEffect, useState } from "react";
import { homeApi } from "./api.js";
import { can } from "../../shared/lib/permissions.js";
import { Alert, Loading } from "../../shared/ui/Primitives.jsx";
import { Icon } from "../../shared/ui/Icons.jsx";
import { ROLE_LABELS } from "../../app/navigation.js";

const ACCESS = [
  { capability: "Asisten CS dan tiket keluhan", roles: { CS: "Kelola", DATA: "Baca", OWNER: "Baca" } },
  { capability: "Katalog, stok, pengetahuan (tanpa HPP)", roles: { CS: "Baca", DATA: "Kelola", OWNER: "Baca" } },
  { capability: "HPP dan master biaya", roles: { CS: "Tidak ada", DATA: "Kelola", OWNER: "Kelola" } },
  { capability: "Impor dan perbaikan data transaksi", roles: { CS: "Tidak ada", DATA: "Kelola", OWNER: "Baca" } },
  { capability: "Laporan laba, dashboard", roles: { CS: "Tidak ada", DATA: "Baca", OWNER: "Penuh" } },
  { capability: "Pengaturan dan audit log", roles: { CS: "Tidak ada", DATA: "Kelola pengaturan", OWNER: "Baca semua" } }
];

const ROLE_COLUMNS = [
  { key: "CS", label: "CS" },
  { key: "DATA", label: "Staf data" },
  { key: "OWNER", label: "Pemilik" }
];

const QUICK_ACTIONS = [
  { id: "cs", label: "Analisis pesan pelanggan", hint: "Kenali jenis pesan dan saran jawaban", permission: "cs:analyze" },
  { id: "tickets", label: "Antrean tiket", hint: "Tindak lanjuti keluhan pelanggan", permission: "tickets:read" },
  { id: "profit", label: "Laba kontribusi", hint: "Tinjau laba per produk dan marketplace", permission: "profit:read" },
  { id: "transactions", label: "Transaksi dan impor", hint: "Impor CSV dan perbaiki baris", permission: "transactions:read" },
  { id: "master", label: "Master data", hint: "Katalog, stok, HPP, pengetahuan", permission: "catalog:read" },
  { id: "settings", label: "Pengaturan", hint: "Ambang dan batas operasional", permission: "settings:read" }
];

function accessTone(value) {
  if (value === "Tidak ada") return "pill-neutral";
  if (value.startsWith("Baca")) return "pill-info";
  return "pill-ok";
}

export default function HomeView({ user, onUnauthorised, onNavigate }) {
  const [health, setHealth] = useState({ status: "loading" });

  useEffect(() => {
    let active = true;
    homeApi.health()
      .then((data) => {
        if (active) setHealth({ status: "ready", data });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setHealth({ status: "error", message: error.message });
      });
    return () => {
      active = false;
    };
  }, [onUnauthorised]);

  const actions = QUICK_ACTIONS.filter((action) => can(user, action.permission));

  return (
    <>
      <section className="card hero">
        <div className="summary-line">
          <span className="pill pill-info">{ROLE_LABELS[user.role] ?? user.role}</span>
        </div>
        <h2>Selamat datang, {user.displayName}</h2>
        <p className="muted">
          Menu dan aksi di bawah mengikuti peran Anda (Tabel 7 proposal) dan diperiksa kembali di server.
        </p>
        <div className="action-grid">
          {actions.map((action) => (
            <button key={action.id} type="button" className="action-card" onClick={() => onNavigate(action.id)}>
              <span className="action-icon"><Icon name={action.id} size={20} /></span>
              <span className="action-text">
                <strong>{action.label}</strong>
                <span>{action.hint}</span>
              </span>
              <Icon name="arrow" size={16} />
            </button>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <h2>Status backend</h2>
          <p className="hint">Koneksi antarmuka ke API aplikasi.</p>
          {health.status === "loading" && <Loading>Memeriksa API…</Loading>}
          {health.status === "error" && <Alert>{health.message} Jalankan backend pada port 3001.</Alert>}
          {health.status === "ready" && (
            <>
              <p className="status-line"><span className="status-dot ok" aria-hidden="true" />Backend terhubung</p>
              <div className="details">
                <div className="detail-item"><span>Layanan</span><strong>{health.data.service}</strong></div>
                <div className="detail-item"><span>Versi API</span><strong>{health.data.apiVersion}</strong></div>
                <div className="detail-item"><span>Database</span><strong>{health.data.database}</strong></div>
                <div className="detail-item"><span>Data</span><strong>{health.data.simulatedData ? "Sintetis" : "Nyata"}</strong></div>
              </div>
            </>
          )}
        </section>
        <section className="card">
          <h2>Alat bantu, bukan toko online</h2>
          <p className="muted">
            Tidak ada keranjang, pembayaran, akun pelanggan, atau pengiriman pesan otomatis. Analisis hanya membantu staf memilih respons yang masih dapat diedit.
          </p>
          <Alert tone="info">Laba kontribusi belum memperhitungkan biaya tetap dan bukan laba bersih usaha.</Alert>
        </section>
      </div>

      <section className="card">
        <h2>Hak akses per peran</h2>
        <p className="hint">Kolom peran Anda ditandai.</p>
        <div className="table-wrap">
          <table className="access-table">
            <thead>
              <tr>
                <th>Akses</th>
                {ROLE_COLUMNS.map((col) => (
                  <th key={col.key} className={col.key === user.role ? "mine" : undefined}>{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ACCESS.map((row) => (
                <tr key={row.capability}>
                  <td>{row.capability}</td>
                  {ROLE_COLUMNS.map((col) => (
                    <td key={col.key} className={col.key === user.role ? "mine" : undefined}>
                      <span className={`pill ${accessTone(row.roles[col.key])}`}>{row.roles[col.key]}</span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          Staf data hanya melihat audit log jika diizinkan eksplisit lewat <code>AUDIT_VIEWER_USERS</code>. Menu yang tersembunyi bukan batas keamanan; otorisasi tetap di backend.
        </p>
      </section>
    </>
  );
}