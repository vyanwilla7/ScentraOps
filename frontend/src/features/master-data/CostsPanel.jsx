import { useEffect, useState } from "react";
import { masterDataApi } from "./api.js";
import { formatDateTime, formatRupiah } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading } from "../../shared/ui/Primitives.jsx";

export default function CostsPanel({ skus, canManage, onUnauthorised }) {
  const [selectedId, setSelectedId] = useState(skus[0]?.id ?? "");
  const [costs, setCosts] = useState({ status: "idle", items: [] });
  const [form, setForm] = useState({
    amount: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
    reason: ""
  });
  const [state, setState] = useState({ status: "idle" });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (skus.length > 0 && !skus.some((sku) => sku.id === selectedId)) setSelectedId(skus[0].id);
    if (skus.length === 0) setSelectedId("");
  }, [skus, selectedId]);

  useEffect(() => {
    if (!selectedId) {
      setCosts({ status: "idle", items: [] });
      return;
    }
    let active = true;
    setCosts({ status: "loading", items: [] });
    masterDataApi.costs(selectedId)
      .then((data) => {
        if (active) setCosts({ status: "ready", items: data.items });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setCosts({ status: "error", message: error.message, items: [] });
      });
    return () => {
      active = false;
    };
  }, [selectedId, refresh, onUnauthorised]);

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 0) {
      setState({ status: "error", message: "HPP harus bilangan bulat rupiah nol atau lebih." });
      return;
    }
    setState({ status: "loading" });
    try {
      await masterDataApi.createCost(selectedId, { amount, effectiveFrom: form.effectiveFrom, reason: form.reason.trim() });
      setForm((current) => ({ ...current, amount: "", reason: "" }));
      setState({ status: "saved" });
      setRefresh((value) => value + 1);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({ status: "error", message: error.message });
    }
  }

  const selected = skus.find((sku) => sku.id === selectedId);

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">HPP BERVERSI</p>
          <h2>Harga pokok per SKU</h2>
          <p className="hint">Setiap perubahan membuat versi baru. Versi lama tetap tersimpan dan transaksi lama tidak berubah.</p>
        </div>
        {skus.length === 0 ? (
          <EmptyState>Belum ada SKU. Tambahkan SKU pada tab SKU & stok terlebih dahulu.</EmptyState>
        ) : (
          <div className="toolbar">
            <label>
              SKU
              <select value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                {skus.map((sku) => <option key={sku.id} value={sku.id}>{sku.code} · {sku.name}</option>)}
              </select>
            </label>
          </div>
        )}

        {costs.status === "loading" && <Loading>Memuat riwayat HPP…</Loading>}
        {costs.status === "error" && <Alert>{costs.message}</Alert>}
        {costs.status === "ready" && costs.items.length === 0 && <EmptyState>Belum ada HPP untuk {selected?.code ?? "SKU ini"}.</EmptyState>}
        {costs.status === "ready" && costs.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Berlaku dari</th><th className="num">HPP</th><th>Alasan</th><th>Dibuat oleh</th><th>Waktu</th></tr>
              </thead>
              <tbody>
                {[...costs.items].sort((left, right) => String(right.effectiveFrom).localeCompare(String(left.effectiveFrom))).map((cost) => (
                  <tr key={cost.id}>
                    <td>{cost.effectiveFrom}</td>
                    <td className="num">{formatRupiah(cost.amount)}</td>
                    <td>{cost.reason}</td>
                    <td>{cost.createdBy}</td>
                    <td>{formatDateTime(cost.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canManage && selectedId && (
        <section className="card">
          <p className="eyebrow">VERSI BARU</p>
          <h2>Tambah HPP untuk {selected?.code}</h2>
          <form className="stack" onSubmit={submit}>
            <div className="inline-form">
              <label>HPP per unit (Rp)<input type="number" min="0" step="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              <label>Berlaku dari<input type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>
              <label>Alasan (wajib)<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: harga pemasok naik" /></label>
            </div>
            <button className="button" type="submit" disabled={!form.amount || !form.effectiveFrom || !form.reason.trim() || state.status === "loading"}>
              {state.status === "loading" ? "Menyimpan…" : "Tambah versi HPP"}
            </button>
            {state.status === "error" && <Alert>{state.message}</Alert>}
            {state.status === "saved" && <Alert tone="ok">Versi HPP baru tersimpan dan dicatat pada audit log.</Alert>}
          </form>
        </section>
      )}
    </>
  );
}
