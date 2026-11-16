import { useEffect, useState } from "react";
import { can } from "../../shared/lib/permissions.js";
import { transactionsApi } from "./api.js";
import { formatRupiah } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading, StatusPill } from "../../shared/ui/Primitives.jsx";
import ManualEntryForm from "./ManualEntryForm.jsx";
import CsvImportPanel from "./CsvImportPanel.jsx";
import AdjustmentForm from "./AdjustmentForm.jsx";

export default function TransactionsView({ user, onUnauthorised }) {
  const canManage = can(user, "transactions:manage");
  const [records, setRecords] = useState({ status: "loading", items: [] });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    setRecords({ status: "loading", items: [] });
    transactionsApi.list()
      .then((data) => {
        if (active) setRecords({ status: "ready", items: data.items });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setRecords({ status: "error", message: error.message, items: [] });
      });
    return () => {
      active = false;
    };
  }, [refresh, onUnauthorised]);

  const refreshRecords = () => setRefresh((value) => value + 1);

  return (
    <>
      {canManage ? (
        <>
          <ManualEntryForm onCommitted={refreshRecords} onUnauthorised={onUnauthorised} />
          <CsvImportPanel onCommitted={refreshRecords} onUnauthorised={onUnauthorised} />
          <AdjustmentForm onUnauthorised={onUnauthorised} />
        </>
      ) : (
        <Alert tone="info">Peran Anda memiliki akses baca ke transaksi. Input, impor, dan penyesuaian dilakukan oleh staf data.</Alert>
      )}

      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">TRANSAKSI AKTIF</p>
          <h2>Baris tersimpan</h2>
          <p className="hint">Hanya versi aktif yang ditampilkan. Baris Belum lengkap tetap terlihat tetapi tidak dihitung pada agregasi.</p>
        </div>
        {records.status === "loading" && <Loading>Memuat transaksi…</Loading>}
        {records.status === "error" && <Alert>{records.message}</Alert>}
        {records.status === "ready" && records.items.length === 0 && <EmptyState>Belum ada transaksi aktif.</EmptyState>}
        {records.status === "ready" && records.items.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>Order</th><th>Marketplace</th><th>SKU</th><th>Tanggal</th><th>Status</th><th className="num">Laba kontribusi</th></tr>
              </thead>
              <tbody>
                {records.items.filter((item) => item.active !== false).map((item) => (
                  <tr key={item.id}>
                    <td>{item.orderId}-{item.lineId}</td>
                    <td>{item.marketplace}</td>
                    <td>{item.sku}</td>
                    <td>{item.orderDate}</td>
                    <td><StatusPill status={item.validation?.status} /></td>
                    <td className="num">{formatRupiah(item.contributionProfit)}</td>
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
