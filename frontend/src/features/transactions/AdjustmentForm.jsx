import { useState } from "react";
import { transactionsApi } from "./api.js";
import { formatRupiah } from "../../shared/lib/format.js";
import { Alert } from "../../shared/ui/Primitives.jsx";

const EMPTY = { sourceReference: "", amount: "", note: "" };

export default function AdjustmentForm({ onUnauthorised }) {
  const [form, setForm] = useState(EMPTY);
  const [state, setState] = useState({ status: "idle" });

  async function submit(event) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isInteger(amount) || amount < 0) {
      setState({ status: "error", message: "Nilai penyesuaian harus bilangan bulat rupiah nol atau lebih." });
      return;
    }
    setState({ status: "loading" });
    try {
      const data = await transactionsApi.adjust({
        sourceReference: form.sourceReference.trim(),
        amount,
        note: form.note.trim()
      });
      setState({ status: "ready", item: data.item, duplicate: Boolean(data.duplicate) });
      setForm(EMPTY);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <section className="card">
      <div className="page-intro">
        <p className="eyebrow">PENYESUAIAN</p>
        <h2>Refund, pemulihan HPP, komisi, atau biaya retur</h2>
        <p className="hint">Gunakan referensi sumber agar nilai yang sama tidak dihitung dua kali. Referensi dan nilai identik dianggap duplikat.</p>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="inline-form">
          <label>Referensi sumber<input value={form.sourceReference} onChange={(event) => setForm({ ...form, sourceReference: event.target.value })} placeholder="RF-001" /></label>
          <label>Nilai (Rp)<input type="number" min="0" step="1" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
          <label>Catatan<input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} placeholder="Retur penuh" /></label>
        </div>
        <button className="button" type="submit" disabled={!form.sourceReference.trim() || !form.amount || !form.note.trim() || state.status === "loading"}>
          {state.status === "loading" ? "Menyimpan…" : "Simpan penyesuaian"}
        </button>
        {state.status === "error" && <Alert>{state.message}</Alert>}
        {state.status === "ready" && (
          <Alert tone={state.duplicate ? "warn" : "ok"}>
            {state.duplicate
              ? `Penyesuaian identik sudah ada; tidak ditambahkan lagi (${formatRupiah(state.item.amount)}).`
              : `Penyesuaian ${formatRupiah(state.item.amount)} tersimpan dengan referensi ${state.item.sourceReference}.`}
          </Alert>
        )}
      </form>
    </section>
  );
}
