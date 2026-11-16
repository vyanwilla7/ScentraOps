import { useState } from "react";
import { masterDataApi } from "./api.js";
import { formatDateTime } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading, StatusPill } from "../../shared/ui/Primitives.jsx";

function StockEditor({ item, onSaved, onUnauthorised }) {
  const initial = item.stock === null ? "" : String(item.stock);
  const [value, setValue] = useState(initial);
  const [state, setState] = useState({ status: "idle" });

  async function save() {
    const parsed = value.trim() === "" ? null : Number(value);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 0)) {
      setState({ status: "error", message: "Stok harus bilangan bulat nol atau lebih, atau kosong." });
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await masterDataApi.update(item.id, { stock: parsed });
      setState({ status: "saved" });
      onSaved(data.item);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <div>
      <div className="stock-cell">
        <input
          type="number"
          min="0"
          step="1"
          aria-label={`Stok ${item.code}`}
          placeholder="Kosong = belum diketahui"
          value={value}
          onChange={(event) => {
            setValue(event.target.value);
            setState({ status: "idle" });
          }}
        />
        <button type="button" className="button secondary small" onClick={save} disabled={state.status === "loading" || value === initial}>
          Simpan
        </button>
      </div>
      {state.status === "error" && <p className="hint error-text">{state.message}</p>}
    </div>
  );
}

export default function SkuPanel({ skus, canManage, onRefresh, replaceSku, onUnauthorised }) {
  const [form, setForm] = useState({ code: "", name: "", aliases: "", stock: "" });
  const [createState, setCreateState] = useState({ status: "idle" });

  async function createSku(event) {
    event.preventDefault();
    const stock = form.stock.trim() === "" ? null : Number(form.stock);
    if (stock !== null && (!Number.isInteger(stock) || stock < 0)) {
      setCreateState({ status: "error", message: "Stok harus bilangan bulat nol atau lebih, atau kosong." });
      return;
    }
    setCreateState({ status: "loading" });
    try {
      await masterDataApi.create({
        code: form.code.trim(),
        name: form.name.trim(),
        aliases: form.aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
        stock
      });
      setForm({ code: "", name: "", aliases: "", stock: "" });
      setCreateState({ status: "saved" });
      onRefresh();
    } catch (error) {
      if (onUnauthorised(error)) return;
      setCreateState({ status: "error", message: error.message });
    }
  }

  async function toggleActive(item) {
    const nextActive = !item.active;
    if (!window.confirm(nextActive ? `Aktifkan kembali ${item.code}?` : `Nonaktifkan ${item.code}? Data lama tetap disimpan.`)) return;
    try {
      const data = await masterDataApi.update(item.id, { active: nextActive });
      replaceSku(data.item);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setCreateState({ status: "error", message: error.message });
    }
  }

  return (
    <>
      {canManage && (
        <section className="card">
          <p className="eyebrow">MASTER SKU</p>
          <h2>Tambah SKU</h2>
          <form className="stack" onSubmit={createSku}>
            <div className="inline-form">
              <label>Kode<input value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} placeholder="KRM-AJW-500" /></label>
              <label>Nama<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Kurma Ajwa 500gr" /></label>
              <label>Stok (kosong = belum diketahui)<input type="number" min="0" step="1" value={form.stock} onChange={(event) => setForm({ ...form, stock: event.target.value })} /></label>
            </div>
            <label>Alias (pisahkan dengan koma)<input value={form.aliases} onChange={(event) => setForm({ ...form, aliases: event.target.value })} placeholder="kurma ajwa, kurma" /></label>
            <button className="button" type="submit" disabled={!form.code.trim() || !form.name.trim() || createState.status === "loading"}>
              {createState.status === "loading" ? "Menyimpan…" : "Tambah SKU"}
            </button>
            {createState.status === "error" && <Alert>{createState.message}</Alert>}
            {createState.status === "saved" && <Alert tone="ok">SKU tersimpan. Stok 0 berarti habis; kosong berarti belum diketahui.</Alert>}
          </form>
        </section>
      )}

      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">MASTER DATA</p>
          <h2>SKU aktif dan nonaktif</h2>
          <p className="hint">
            Stok 0 berarti habis; kosong berarti belum diketahui. Stok baru diperbarui otomatis mencatat waktu konfirmasi.
            {!canManage && " Peran Anda hanya dapat membaca katalog dan stok."}
          </p>
        </div>
        {skus.status === "loading" && <Loading>Memuat SKU…</Loading>}
        {skus.status === "error" && <Alert>{skus.message}</Alert>}
        {skus.status === "ready" && skus.items.length === 0 && <EmptyState>Belum ada SKU pada master data.</EmptyState>}
        {skus.status === "ready" && skus.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Kode</th><th>Nama</th><th>Alias</th><th>Stok</th><th>Stok diperbarui</th><th>Status</th>{canManage && <th></th>}</tr>
              </thead>
              <tbody>
                {skus.items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.code}</td>
                    <td>{item.name}</td>
                    <td>{item.aliases?.length ? item.aliases.join(", ") : <span className="muted">—</span>}</td>
                    <td>
                      {canManage
                        ? <StockEditor item={item} onSaved={replaceSku} onUnauthorised={onUnauthorised} />
                        : item.stock === null ? <span className="muted">Belum diketahui</span> : item.stock}
                    </td>
                    <td>{item.stockUpdatedAt ? formatDateTime(item.stockUpdatedAt) : <span className="muted">Belum diketahui</span>}</td>
                    <td><StatusPill status={item.active ? "Aktif" : "Nonaktif"} /></td>
                    {canManage && (
                      <td>
                        <button type="button" className="button secondary small" onClick={() => toggleActive(item)}>
                          {item.active ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
