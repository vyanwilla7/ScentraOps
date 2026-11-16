import { useEffect, useState } from "react";
import { homeApi } from "./api.js";
import { can } from "../../shared/lib/permissions.js";
import { Alert, Loading } from "../../shared/ui/Primitives.jsx";

const ACCESS = [
  { capability: "Asisten CS dan tiket keluhan", roles: { CS: "Kelola", DATA: "Baca", OWNER: "Baca" } },
  { capability: "Katalog, stok, pengetahuan (tanpa HPP)", roles: { CS: "Baca", DATA: "Kelola", OWNER: "Baca" } },
  { capability: "HPP dan master biaya", roles: { CS: "Tidak ada", DATA: "Kelola", OWNER: "Kelola" } },
  { capability: "Impor dan perbaikan data transaksi", roles: { CS: "Tidak ada", DATA: "Kelola", OWNER: "Baca" } },
  { capability: "Laporan laba, dashboard", roles: { CS: "Tidak ada", DATA: "Baca", OWNER: "Penuh" } },
  { capability: "Pengaturan dan audit log", roles: { CS: "Tidak ada", DATA: "Kelola pengaturan", OWNER: "Baca semua" } }
];

const QUICK_ACTIONS = [
  { id: "cs", label: "Analisis pesan pelanggan", permission: "cs:analyze" },
  { id: "tickets", label: "Buka antrean tiket", permission: "tickets:read" },
  { id: "profit", label: "Tinjau laba kontribusi", permission: "profit:read" },
  { id: "transactions", label: "Transaksi dan impor", permission: "transactions:read" },
  { id: "master", label: "Master data dan pengetahuan", permission: "catalog:read" },
  { id: "settings", label: "Pengaturan operasional", permission: "settings:read" }
];

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

  return (
    <>
      <section className="card page-intro">
        <p className="eyebrow">SESI AKTIF</p>
        <h2>Selamat datang, {user.displayName}</h2>
        <p className="muted">
          Peran Anda <strong>{user.role}</strong>. Menu dan aksi mengikuti Tabel 7 proposal dan diperiksa kembali di server.
        </p>
        <div className="chip-row">
          {QUICK_ACTIONS.filter((action) => can(user, action.permission)).map((action) => (
            <button key={action.id} type="button" className="chip" onClick={() => onNavigate(action.id)}>
              {action.label}
            </button>
          ))}
        </div>
      </section>

      <div className="grid-2">
        <section className="card">
          <p className="eyebrow">BATAS APLIKASI</p>
          <h2>Alat bantu, bukan toko online</h2>
          <p className="muted">
            Tidak ada keranjang, pembayaran, akun pelanggan, atau pengiriman pesan otomatis. Analisis hanya membantu staf memilih respons yang masih dapat diedit.
          </p>
          <p className="hint">Laba kontribusi belum memperhitungkan biaya tetap dan bukan laba bersih usaha.</p>
        </section>
        <section className="card">
          <p className="eyebrow">KONEKSI</p>
          <h2>Status backend</h2>
          {health.status === "loading" && <Loading>Memeriksa API…</Loading>}
          {health.status === "error" && <Alert>{health.message} Jalankan backend pada port 3001.</Alert>}
          {health.status === "ready" && (
            <div className="details">
              <div className="detail-item"><span>Layanan</span><strong>{health.data.service}</strong></div>
              <div className="detail-item"><span>Versi API</span><strong>{health.data.apiVersion}</strong></div>
              <div className="detail-item"><span>Database</span><strong>{health.data.database}</strong></div>
              <div className="detail-item"><span>Data</span><strong>{health.data.simulatedData ? "Sintetis" : "Nyata"}</strong></div>
            </div>
          )}
        </section>
      </div>

      <section className="card">
        <p className="eyebrow">HAK AKSES</p>
        <h2>Matriks peran sesuai proposal</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Akses</th><th>CS</th><th>Staf data</th><th>Pemilik</th></tr>
            </thead>
            <tbody>
              {ACCESS.map((row) => (
                <tr key={row.capability}>
                  <td>{row.capability}</td>
                  <td>{row.roles.CS}</td>
                  <td>{row.roles.DATA}</td>
                  <td>{row.roles.OWNER}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hint">
          DATA hanya melihat audit log jika diizinkan eksplisit lewat <code>AUDIT_VIEWER_USERS</code>. Menu yang tersembunyi bukan batas keamanan; otorisasi tetap di backend.
        </p>
      </section>
    </>
  );
}
