import { useEffect, useState } from "react";
import { masterDataApi } from "./api.js";
import { formatDateTime } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading, StatusPill } from "../../shared/ui/Primitives.jsx";

const EMPTY_FORM = {
  title: "",
  content: "",
  source: "",
  version: "1",
  effectiveAt: new Date().toISOString().slice(0, 10),
  expiresAt: "",
  reason: ""
};

export default function KnowledgePanel({ canManage, onUnauthorised }) {
  const [items, setItems] = useState({ status: "loading", items: [] });
  const [form, setForm] = useState(EMPTY_FORM);
  const [state, setState] = useState({ status: "idle" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setItems({ status: "loading", items: [] });
    masterDataApi.knowledge()
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
  }, [refresh, onUnauthorised]);

  async function submit(event) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      await masterDataApi.createKnowledge({
        title: form.title.trim(),
        content: form.content.trim(),
        source: form.source.trim(),
        version: form.version.trim(),
        effectiveAt: form.effectiveAt,
        expiresAt: form.expiresAt || null,
        reason: form.reason.trim() || undefined
      });
      setForm(EMPTY_FORM);
      setState({ status: "saved" });
      setRefresh((value) => value + 1);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">PENGETAHUAN CS</p>
          <h2>Aturan dan sumber jawaban</h2>
          <p className="hint">
            Setiap informasi wajib memiliki sumber, versi, dan tanggal berlaku. Status Valid, Usang, atau Belum diketahui dihitung dari batas kesegaran.
            {!canManage && " Peran Anda hanya dapat membaca pengetahuan."}
          </p>
        </div>
        {items.status === "loading" && <Loading>Memuat pengetahuan…</Loading>}
        {items.status === "error" && <Alert>{items.message}</Alert>}
        {items.status === "ready" && items.items.length === 0 && <EmptyState>Belum ada pengetahuan.</EmptyState>}
        {items.status === "ready" && items.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Topik</th><th>Versi</th><th>Sumber</th><th>Status</th><th>Berlaku</th><th>Diperbarui</th></tr>
              </thead>
              <tbody>
                {items.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.title}</strong>
                      <div className="hint">{item.content}</div>
                    </td>
                    <td>{item.version}</td>
                    <td>{item.source}</td>
                    <td><StatusPill status={item.freshness} /></td>
                    <td>{item.effectiveAt}{item.expiresAt ? ` → ${item.expiresAt}` : ""}</td>
                    <td>{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && (
        <section className="card">
          <p className="eyebrow">VERSI BARU</p>
          <h2>Tambah pengetahuan</h2>
          <form className="stack" onSubmit={submit}>
            <div className="form-grid">
              <label>Topik<input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="Aturan pengiriman" /></label>
              <label>Sumber<input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Panduan operasional" /></label>
              <label>Versi<input value={form.version} onChange={(event) => setForm({ ...form, version: event.target.value })} /></label>
              <label>Berlaku dari<input type="date" value={form.effectiveAt} onChange={(event) => setForm({ ...form, effectiveAt: event.target.value })} /></label>
              <label>Kedaluwarsa (opsional)<input type="date" value={form.expiresAt} onChange={(event) => setForm({ ...form, expiresAt: event.target.value })} /></label>
              <label>Alasan (opsional)<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} /></label>
            </div>
            <label>Isi aturan<textarea rows="3" value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} /></label>
            <button className="button" type="submit" disabled={!form.title.trim() || !form.content.trim() || !form.source.trim() || !form.version.trim() || !form.effectiveAt || state.status === "loading"}>
              {state.status === "loading" ? "Menyimpan…" : "Tambah pengetahuan"}
            </button>
            {state.status === "error" && <Alert>{state.message}</Alert>}
            {state.status === "saved" && <Alert tone="ok">Pengetahuan baru tersimpan dan dicatat pada audit log.</Alert>}
          </form>
        </section>
      )}
    </>
  );
}
