import { useEffect, useState } from "react";
import { transactionsApi } from "./api.js";
import { formatRupiah } from "../../shared/lib/format.js";
import { Alert, StatusPill } from "../../shared/ui/Primitives.jsx";

const NUMBER_FIELDS = [
  "lineId",
  "quantity",
  "grossSales",
  "sellerDiscount",
  "refund",
  "unitProductCost",
  "recoverableReturnedProductCost",
  "netCommission",
  "sellerShipping",
  "packaging",
  "returnCost",
  "otherCost"
];

function emptyForm() {
  return {
    marketplace: "Shopee",
    orderId: "",
    lineId: "1",
    orderDate: new Date().toISOString().slice(0, 10),
    sku: "",
    quantity: "1",
    grossSales: "",
    sellerDiscount: "",
    refund: "",
    unitProductCost: "",
    recoverableReturnedProductCost: "",
    netCommission: "",
    sellerShipping: "",
    packaging: "",
    returnCost: "",
    otherCost: "",
    reason: ""
  };
}

function numberOrNull(value) {
  return value.trim() === "" ? null : Number(value);
}

export default function ManualEntryForm({ onCommitted, onUnauthorised }) {
  const [form, setForm] = useState(emptyForm);
  const [state, setState] = useState({ status: "idle" });
  const [skus, setSkus] = useState([]);

  useEffect(() => {
    let active = true;
    transactionsApi.catalog()
      .then((data) => {
        if (active) setSkus(data.items.filter((sku) => sku.active));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  async function submit(event) {
    event.preventDefault();
    const payload = {
      marketplace: form.marketplace.trim(),
      orderId: form.orderId.trim(),
      orderDate: form.orderDate,
      status: "selesai",
      sku: form.sku.trim(),
      reason: form.reason.trim()
    };
    for (const field of NUMBER_FIELDS) payload[field] = numberOrNull(form[field]);

    setState({ status: "loading" });
    try {
      const data = await transactionsApi.manual(payload);
      const result = data.preview?.[0];
      setState({
        status: "ready",
        item: data.inserted?.[0] ?? result?.line,
        validation: result?.status
      });
      setForm((current) => ({ ...emptyForm(), marketplace: current.marketplace, orderDate: current.orderDate }));
      onCommitted();
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({
        status: "error",
        message: error.message,
        errors: error.details?.result?.preview?.[0]?.errors ?? {}
      });
    }
  }

  return (
    <section className="card">
      <div className="page-intro">
        <p className="eyebrow">INPUT MANUAL</p>
        <h2>Transaksi manual</h2>
        <p className="hint">
          Gunakan SKU terdaftar. Kosongkan komponen yang belum diketahui (bukan nol) agar baris menjadi Belum lengkap.
          Kosongkan HPP untuk memakai HPP efektif dari master biaya.
        </p>
      </div>
      <form className="stack" onSubmit={submit}>
        <div className="form-grid">
          <label>Marketplace<input value={form.marketplace} onChange={(event) => setForm({ ...form, marketplace: event.target.value })} /></label>
          <label>Order ID<input value={form.orderId} onChange={(event) => setForm({ ...form, orderId: event.target.value })} placeholder="TX-100" /></label>
          <label>Line ID<input type="number" min="1" step="1" value={form.lineId} onChange={(event) => setForm({ ...form, lineId: event.target.value })} /></label>
          <label>Tanggal<input type="date" value={form.orderDate} onChange={(event) => setForm({ ...form, orderDate: event.target.value })} /></label>
          <label>
            SKU terdaftar
            <input list="manual-skus" value={form.sku} onChange={(event) => setForm({ ...form, sku: event.target.value })} placeholder="KRM-AJW-500" />
          </label>
          <label>Kuantitas<input type="number" min="1" step="1" value={form.quantity} onChange={(event) => setForm({ ...form, quantity: event.target.value })} /></label>
          <label>Penjualan bruto (Rp)<input type="number" min="0" step="1" value={form.grossSales} onChange={(event) => setForm({ ...form, grossSales: event.target.value })} /></label>
          <label>Diskon penjual (Rp)<input type="number" min="0" step="1" value={form.sellerDiscount} onChange={(event) => setForm({ ...form, sellerDiscount: event.target.value })} /></label>
          <label>Refund (Rp)<input type="number" min="0" step="1" value={form.refund} onChange={(event) => setForm({ ...form, refund: event.target.value })} /></label>
          <label>HPP per unit (Rp)<input type="number" min="0" step="1" value={form.unitProductCost} onChange={(event) => setForm({ ...form, unitProductCost: event.target.value })} /></label>
          <label>HPP retur layak jual (Rp)<input type="number" min="0" step="1" value={form.recoverableReturnedProductCost} onChange={(event) => setForm({ ...form, recoverableReturnedProductCost: event.target.value })} /></label>
          <label>Komisi bersih (Rp)<input type="number" min="0" step="1" value={form.netCommission} onChange={(event) => setForm({ ...form, netCommission: event.target.value })} /></label>
          <label>Ongkir penjual (Rp)<input type="number" min="0" step="1" value={form.sellerShipping} onChange={(event) => setForm({ ...form, sellerShipping: event.target.value })} /></label>
          <label>Kemasan (Rp)<input type="number" min="0" step="1" value={form.packaging} onChange={(event) => setForm({ ...form, packaging: event.target.value })} /></label>
          <label>Biaya retur (Rp)<input type="number" min="0" step="1" value={form.returnCost} onChange={(event) => setForm({ ...form, returnCost: event.target.value })} /></label>
          <label>Biaya lain (Rp)<input type="number" min="0" step="1" value={form.otherCost} onChange={(event) => setForm({ ...form, otherCost: event.target.value })} /></label>
        </div>
        <datalist id="manual-skus">
          {skus.map((sku) => <option key={sku.id} value={sku.code}>{sku.name}</option>)}
        </datalist>
        <label>Alasan input (wajib)<input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: penjualan manual 16 November" /></label>
        <button className="button" type="submit" disabled={!form.marketplace.trim() || !form.orderId.trim() || !form.sku.trim() || !form.orderDate || !form.reason.trim() || state.status === "loading"}>
          {state.status === "loading" ? "Memproses…" : "Simpan transaksi"}
        </button>
      </form>
      {state.status === "error" && (
        <Alert>
          {state.message}
          {Object.entries(state.errors ?? {}).map(([field, message]) => <span key={field}> {field}: {message}</span>)}
        </Alert>
      )}
      {state.status === "ready" && (
        <Alert tone="ok">
          <span className="summary-line">
            Tersimpan dengan status <StatusPill status={state.validation} /> · Laba kontribusi {formatRupiah(state.item?.contributionProfit)}
          </span>
        </Alert>
      )}
    </section>
  );
}
