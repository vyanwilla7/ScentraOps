import { useEffect, useState } from "react";
import { can } from "../../shared/lib/permissions.js";
import { ticketsApi } from "./api.js";
import { formatDateTime } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading, StatusPill } from "../../shared/ui/Primitives.jsx";

const STATUS_OPTIONS = ["Baru", "Diproses", "Selesai"];
const PRIORITY_OPTIONS = ["Rendah", "Sedang", "Tinggi"];

export default function TicketsView({ user, onUnauthorised }) {
  const canManage = can(user, "tickets:manage");
  const [filters, setFilters] = useState({ status: "", priority: "" });
  const [list, setList] = useState({ status: "loading", items: [] });
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState({ status: "idle" });
  const [form, setForm] = useState({ status: "Baru", priority: "Sedang", assignee: "", reason: "" });
  const [save, setSave] = useState({ status: "idle" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setList({ status: "loading", items: [] });
    ticketsApi.list(filters)
      .then((data) => {
        if (active) setList({ status: "ready", items: data.items });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setList({ status: "error", message: error.message, items: [] });
      });
    return () => {
      active = false;
    };
  }, [filters, refresh, onUnauthorised]);

  async function openTicket(id) {
    setSelectedId(id);
    setDetail({ status: "loading" });
    try {
      const data = await ticketsApi.get(id);
      setDetail({ status: "ready", item: data.item, history: data.history });
      setForm({
        status: data.item.status,
        priority: data.item.priority,
        assignee: data.item.assignee ?? "",
        reason: ""
      });
      setSave({ status: "idle" });
    } catch (error) {
      if (onUnauthorised(error)) return;
      setDetail({ status: "error", message: error.message });
    }
  }

  async function submitUpdate(event) {
    event.preventDefault();
    setSave({ status: "loading" });
    try {
      await ticketsApi.update(selectedId, {
        status: form.status,
        priority: form.priority,
        assignee: form.assignee.trim() === "" ? null : form.assignee.trim(),
        reason: form.reason.trim()
      });
      setSave({ status: "saved" });
      setRefresh((value) => value + 1);
      await openTicket(selectedId);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setSave({ status: "error", message: error.message });
    }
  }

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">ANTREAN KELUHAN</p>
          <h2>Tiket operasional</h2>
          <p className="hint">Satu analisis keluhan menghasilkan paling banyak satu tiket terbuka. Riwayat perubahan disimpan.</p>
        </div>
        <div className="toolbar">
          <label>
            Status
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Semua</option>
              {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
            </select>
          </label>
          <label>
            Prioritas
            <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value })}>
              <option value="">Semua</option>
              {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
            </select>
          </label>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => setFilters({ status: "", priority: "" })}>Reset filter</button>
          </div>
        </div>

        {list.status === "loading" && <Loading>Memuat tiket…</Loading>}
        {list.status === "error" && <Alert>{list.message}</Alert>}
        {list.status === "ready" && list.items.length === 0 && <EmptyState>Belum ada tiket yang cocok dengan filter ini.</EmptyState>}
        {list.status === "ready" && list.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Nomor</th><th>Prioritas</th><th>Status</th><th>Assignee</th><th>Masuk</th><th></th></tr>
              </thead>
              <tbody>
                {list.items.map((item) => (
                  <tr key={item.id} className={item.id === selectedId ? "selected" : undefined}>
                    <td>{item.number}</td>
                    <td>{item.priority}</td>
                    <td><StatusPill status={item.status} /></td>
                    <td>{item.assignee ?? <span className="muted">Belum ditugaskan</span>}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                    <td><button type="button" className="button secondary small" onClick={() => openTicket(item.id)}>Lihat</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {detail.status === "loading" && <section className="card"><Loading>Memuat detail tiket…</Loading></section>}
      {detail.status === "error" && <Alert>{detail.message}</Alert>}
      {detail.status === "ready" && (
        <section className="card result">
          <div className="summary-line">
            <h2>{detail.item.number}</h2>
            <StatusPill status={detail.item.status} />
            <span className="muted">Prioritas {detail.item.priority}</span>
          </div>
          <p className="muted">{detail.item.originalMessage}</p>
          <div className="details">
            <div className="detail-item"><span>Jenis</span><strong>{detail.item.type}</strong></div>
            <div className="detail-item"><span>Assignee</span><strong>{detail.item.assignee ?? "Belum ditugaskan"}</strong></div>
            <div className="detail-item"><span>Dibuat oleh</span><strong>{detail.item.createdBy}</strong></div>
            <div className="detail-item"><span>Diperbarui</span><strong>{formatDateTime(detail.item.updatedAt)}</strong></div>
            <div className="detail-item"><span>Alasan klasifikasi</span><strong>{detail.item.reason}</strong></div>
          </div>

          <h3>Riwayat</h3>
          <ul className="timeline">
            {detail.history.map((entry) => (
              <li key={entry.id}>
                <strong>{entry.action} {entry.from !== null ? `${entry.from} → ${entry.to}` : `→ ${entry.to}`}</strong>
                <span>{entry.actor} · {formatDateTime(entry.createdAt)} · {entry.reason ?? "Tanpa alasan"}</span>
              </li>
            ))}
          </ul>

          {canManage ? (
            <form className="stack" onSubmit={submitUpdate} style={{ marginTop: "1.25rem" }}>
              <h3 style={{ margin: 0 }}>Ubah tiket</h3>
              <div className="inline-form">
                <label>
                  Status
                  <select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>
                    {STATUS_OPTIONS.map((status) => <option key={status} value={status}>{status}</option>)}
                  </select>
                </label>
                <label>
                  Prioritas
                  <select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}>
                    {PRIORITY_OPTIONS.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                  </select>
                </label>
                <label>
                  Assignee
                  <input value={form.assignee} onChange={(event) => setForm({ ...form, assignee: event.target.value })} placeholder="Nama pengguna atau kosong" />
                </label>
              </div>
              <label>
                Alasan perubahan (wajib)
                <textarea rows="2" value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: diverifikasi ke staf data" />
              </label>
              <button className="button" type="submit" disabled={!form.reason.trim() || save.status === "loading"}>
                {save.status === "loading" ? "Menyimpan…" : "Simpan perubahan"}
              </button>
              {save.status === "error" && <Alert>{save.message}</Alert>}
              {save.status === "saved" && <Alert tone="ok">Perubahan tiket tersimpan dan diaudit.</Alert>}
            </form>
          ) : (
            <p className="hint">Peran Anda hanya dapat membaca tiket. Perubahan status dilakukan oleh CS.</p>
          )}
        </section>
      )}
    </>
  );
}
