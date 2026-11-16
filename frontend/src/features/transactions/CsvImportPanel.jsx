import { useState } from "react";
import { importFields, transactionsApi } from "./api.js";
import { formatRupiah } from "../../shared/lib/format.js";
import { Alert, EmptyState, StatusPill } from "../../shared/ui/Primitives.jsx";

const SAMPLE_CSV = [
  importFields.join(","),
  "Shopee,TX-100,1,2026-11-15,selesai,KRM-AJW-500,1,100000,10000,0,50000,5000,3000,2000,0,0"
].join("\n");

export default function CsvImportPanel({ onCommitted, onUnauthorised }) {
  const [csvText, setCsvText] = useState(SAMPLE_CSV);
  const [preview, setPreview] = useState({ status: "idle" });
  const [reason, setReason] = useState("");
  const [approveUpdates, setApproveUpdates] = useState(false);
  const [commit, setCommit] = useState({ status: "idle" });

  async function runPreview() {
    setPreview({ status: "loading" });
    setCommit({ status: "idle" });
    try {
      const data = await transactionsApi.preview(csvText);
      setPreview({ status: "ready", rows: data.rows });
    } catch (error) {
      if (onUnauthorised(error)) return;
      setPreview({ status: "error", message: error.message });
    }
  }

  async function runCommit() {
    setCommit({ status: "loading" });
    try {
      const data = await transactionsApi.commit({ csvText, reason: reason.trim(), approveUpdates });
      setCommit({ status: "ready", data });
      onCommitted();
    } catch (error) {
      if (onUnauthorised(error)) return;
      if (error.status === 409) setCommit({ status: "approval", message: error.message });
      else setCommit({ status: "error", message: error.message });
    }
  }

  const rows = preview.rows ?? [];
  const rejectedCount = rows.filter((row) => row.status === "Ditolak").length;

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">IMPOR CSV</p>
          <h2>Pratinjau dan commit transaksi</h2>
          <p className="hint">
            CSV UTF-8 maksimal 5 MB dan 5.000 baris. SKU harus terdaftar di master data. Simpan XLSX sebagai CSV UTF-8,
            ID sebagai teks, tanggal YYYY-MM-DD, dan uang sebagai angka tanpa pemisah ribuan.
          </p>
        </div>
        <form className="stack" onSubmit={(event) => { event.preventDefault(); runPreview(); }}>
          <label>
            CSV UTF-8
            <textarea
              rows="6"
              value={csvText}
              onChange={(event) => {
                setCsvText(event.target.value);
                setPreview({ status: "idle" });
                setCommit({ status: "idle" });
              }}
            />
          </label>
          <div className="summary-line">
            <button className="button" type="submit" disabled={!csvText.trim() || preview.status === "loading"}>
              {preview.status === "loading" ? "Memvalidasi…" : "Validasi pratinjau"}
            </button>
            <button className="button secondary" type="button" onClick={() => setCsvText(SAMPLE_CSV)}>Isi contoh CSV</button>
          </div>
        </form>
        {preview.status === "error" && <Alert>{preview.message}</Alert>}
      </section>

      {preview.status === "ready" && (
        <section className="card result">
          <div className="summary-line">
            <h2>Pratinjau {rows.length} baris</h2>
            {rejectedCount > 0 ? <StatusPill status="Ditolak" /> : <StatusPill status="Lengkap" />}
          </div>
          {rows.length === 0 && <EmptyState>Tidak ada baris data pada CSV.</EmptyState>}
          {rows.length > 0 && (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Baris</th><th>Kunci</th><th>Status</th><th>Catatan validasi</th><th className="num">Laba kontribusi</th></tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.sourceRow}-${row.key}`}>
                      <td>{row.sourceRow}</td>
                      <td>{row.key}</td>
                      <td><StatusPill status={row.status} /></td>
                      <td>
                        {Object.keys(row.errors ?? {}).length === 0
                          ? <span className="muted">—</span>
                          : Object.entries(row.errors).map(([field, message]) => <div key={field}><strong>{field}</strong>: {message}</div>)}
                      </td>
                      <td className="num">{formatRupiah(row.line?.contributionProfit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <form className="stack" onSubmit={(event) => { event.preventDefault(); runCommit(); }}>
            <label>
              Alasan import / koreksi (wajib)
              <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Contoh: impor penjualan 15 November" />
            </label>
            <label className="checkbox-row">
              <input type="checkbox" checked={approveUpdates} onChange={(event) => setApproveUpdates(event.target.checked)} />
              Setujui pembaruan untuk baris dengan kunci yang sama (versi lama disimpan)
            </label>
            <button className="button" type="submit" disabled={!reason.trim() || commit.status === "loading" || rejectedCount > 0}>
              {commit.status === "loading" ? "Memproses…" : "Commit transaksi"}
            </button>
            {rejectedCount > 0 && <p className="hint">Perbaiki baris berstatus Ditolak sebelum commit.</p>}
          </form>
          {commit.status === "error" && <Alert>{commit.message}</Alert>}
          {commit.status === "approval" && <Alert tone="warn">{commit.message} Centang "Setujui pembaruan" lalu commit ulang.</Alert>}
          {commit.status === "ready" && (
            <Alert tone="ok">
              Commit selesai: {commit.data.inserted.length} baru, {commit.data.skipped.length} duplikat dilewati, {commit.data.updated.length} diperbarui.
            </Alert>
          )}
        </section>
      )}
    </>
  );
}
