import { useEffect, useState } from "react";
import { masterDataApi } from "./api.js";
import { formatDateTime } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading } from "../../shared/ui/Primitives.jsx";

export default function AuditPanel({ onUnauthorised }) {
  const [items, setItems] = useState({ status: "loading", items: [] });

  useEffect(() => {
    let active = true;
    masterDataApi.audit()
      .then((data) => {
        if (active) setItems({ status: "ready", items: data.items });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setItems({ status: "error", message: error.message, items: [] });
      });
    return () => {
      active = false;
    };
  }, [onUnauthorised]);

  return (
    <section className="card">
      <div className="page-intro">
        <p className="eyebrow">AUDIT LOG</p>
        <h2>Riwayat perubahan</h2>
        <p className="hint">Mencatat perubahan master data, HPP, pengetahuan, pengaturan, pembaruan transaksi, dan status tiket.</p>
      </div>
      {items.status === "loading" && <Loading>Memuat audit log…</Loading>}
      {items.status === "error" && <Alert>{items.message}</Alert>}
      {items.status === "ready" && items.items.length === 0 && <EmptyState>Belum ada perubahan tercatat.</EmptyState>}
      {items.status === "ready" && items.items.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Waktu</th><th>Aksi</th><th>Entitas</th><th>Aktor</th><th>Alasan</th><th>Detail</th></tr>
            </thead>
            <tbody>
              {[...items.items].reverse().map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDateTime(entry.createdAt)}</td>
                  <td>{entry.action}</td>
                  <td>{entry.entity}</td>
                  <td>{entry.actor}</td>
                  <td>{entry.reason}</td>
                  <td>
                    {entry.before || entry.after ? (
                      <details>
                        <summary>Lihat</summary>
                        <pre className="audit-details">{JSON.stringify({ before: entry.before, after: entry.after }, null, 2)}</pre>
                      </details>
                    ) : <span className="muted">—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
