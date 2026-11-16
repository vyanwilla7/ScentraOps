import { useEffect, useMemo, useState } from "react";
import { profitApi } from "./api.js";
import { formatMargin, formatNumber, formatRupiah } from "../../shared/lib/format.js";
import { Alert, EmptyState, Loading, StatusPill } from "../../shared/ui/Primitives.jsx";

const EMPTY_FILTERS = { from: "", to: "", marketplace: "", sku: "", status: "" };

export default function ProfitView({ onUnauthorised }) {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [report, setReport] = useState({ status: "loading" });
  const [detail, setDetail] = useState({ status: "idle" });

  useEffect(() => {
    let active = true;
    setReport({ status: "loading" });
    profitApi.dashboard(filters)
      .then((data) => {
        if (active) setReport({ status: "ready", data });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setReport({ status: "error", message: error.message });
      });
    return () => {
      active = false;
    };
  }, [filters, onUnauthorised]);

  const options = useMemo(() => {
    if (report.status !== "ready") return { marketplaces: [], skus: [] };
    return {
      marketplaces: [...new Set(report.data.items.map((item) => item.marketplace))].sort(),
      skus: [...new Set(report.data.items.map((item) => item.sku))].sort()
    };
  }, [report]);

  async function openDetail(id) {
    setDetail({ status: "loading" });
    try {
      const data = await profitApi.detail(id);
      setDetail({ status: "ready", item: data.item });
    } catch (error) {
      if (onUnauthorised(error)) return;
      setDetail({ status: "error", message: error.message });
    }
  }

  const data = report.data;

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">LABA KONTRIBUSI</p>
          <h2>Dashboard laba</h2>
          <p className="hint">Hanya transaksi aktif dan baris lengkap yang diagregasi. Filter diterapkan di server.</p>
        </div>
        <form className="toolbar" onSubmit={(event) => event.preventDefault()}>
          <label>Dari tanggal<input type="date" value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.target.value })} /></label>
          <label>Sampai tanggal<input type="date" value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.target.value })} /></label>
          <label>
            Marketplace
            <input list="profit-marketplaces" value={filters.marketplace} onChange={(event) => setFilters({ ...filters, marketplace: event.target.value })} placeholder="Semua" />
          </label>
          <label>
            SKU
            <input list="profit-skus" value={filters.sku} onChange={(event) => setFilters({ ...filters, sku: event.target.value })} placeholder="Semua" />
          </label>
          <label>
            Status data
            <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
              <option value="">Semua</option>
              <option value="Lengkap">Lengkap</option>
              <option value="Belum lengkap">Belum lengkap</option>
              <option value="Ditolak">Ditolak</option>
            </select>
          </label>
          <div className="actions">
            <button type="button" className="button secondary" onClick={() => setFilters(EMPTY_FILTERS)}>Reset</button>
          </div>
        </form>
        <datalist id="profit-marketplaces">
          {options.marketplaces.map((marketplace) => <option key={marketplace} value={marketplace} />)}
        </datalist>
        <datalist id="profit-skus">
          {options.skus.map((sku) => <option key={sku} value={sku} />)}
        </datalist>

        {report.status === "loading" && <Loading>Memuat dashboard…</Loading>}
        {report.status === "error" && <Alert>{report.message}</Alert>}
        {report.status === "ready" && data.summary.totalCount === 0 && <EmptyState>Tidak ada transaksi aktif untuk filter ini.</EmptyState>}
        {report.status === "ready" && data.summary.totalCount > 0 && (
          <>
            <div className="summary-grid" style={{ marginTop: "1rem" }}>
              <div className="stat"><strong>{formatRupiah(data.summary.netRevenue)}</strong><span>Pendapatan bersih</span></div>
              <div className="stat"><strong>{formatRupiah(data.summary.contributionProfit)}</strong><span>Laba kontribusi</span></div>
              <div className="stat"><strong>{formatMargin(data.summary.margin)}</strong><span>Margin agregat</span></div>
              <div className="stat"><strong>{data.summary.completeCount}/{data.summary.totalCount}</strong><span>Cakupan baris ({data.summary.coverage === null ? "—" : `${Math.round(data.summary.coverage * 100)}%`})</span></div>
              <div className={`stat ${data.signals.losses > 0 ? "danger" : ""}`}><strong>{data.signals.losses}</strong><span>Baris rugi</span></div>
              <div className="stat"><strong>{data.signals.zeroRevenue}</strong><span>Pendapatan nol</span></div>
              <div className={`stat ${data.signals.lowMargin > 0 ? "warn" : ""}`}>
                <strong>{data.signals.lowMargin === null ? "Belum diatur" : data.signals.lowMargin}</strong>
                <span>Margin rendah{data.signals.lowMarginThreshold === null ? " (atur di Pengaturan)" : ` (< ${data.signals.lowMarginThreshold}%)`}</span>
              </div>
              <div className={`stat ${data.signals.incomplete > 0 ? "warn" : ""}`}><strong>{data.signals.incomplete}</strong><span>Baris tidak lengkap</span></div>
            </div>
            <p className="hint" style={{ marginTop: "1rem" }}>{data.signals.disclaimer}</p>

            <h3>Per marketplace</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Marketplace</th><th className="num">Lengkap</th><th className="num">Pendapatan</th><th className="num">Laba</th><th className="num">Margin</th><th></th></tr>
                </thead>
                <tbody>
                  {data.byMarketplace.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td className="num">{row.completeCount}/{row.totalCount}</td>
                      <td className="num">{formatRupiah(row.netRevenue)}</td>
                      <td className="num">{formatRupiah(row.contributionProfit)}</td>
                      <td className="num">{formatMargin(row.margin)}</td>
                      <td><button type="button" className="button secondary small" onClick={() => setFilters((current) => ({ ...current, marketplace: row.key }))}>Filter</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Per SKU</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>SKU</th><th className="num">Lengkap</th><th className="num">Pendapatan</th><th className="num">Laba</th><th className="num">Margin</th><th></th></tr>
                </thead>
                <tbody>
                  {data.bySku.map((row) => (
                    <tr key={row.key}>
                      <td>{row.key}</td>
                      <td className="num">{row.completeCount}/{row.totalCount}</td>
                      <td className="num">{formatRupiah(row.netRevenue)}</td>
                      <td className="num">{formatRupiah(row.contributionProfit)}</td>
                      <td className="num">{formatMargin(row.margin)}</td>
                      <td><button type="button" className="button secondary small" onClick={() => setFilters((current) => ({ ...current, sku: row.key }))}>Filter</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h3>Drill-down transaksi aktif</h3>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr><th>Order</th><th>Marketplace</th><th>SKU</th><th>Tanggal</th><th>Status data</th><th className="num">Pendapatan</th><th className="num">Laba</th><th></th></tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className={detail.item?.id === item.id ? "selected" : undefined}>
                      <td>{item.orderId}-{item.lineId}</td>
                      <td>{item.marketplace}</td>
                      <td>{item.sku}</td>
                      <td>{item.orderDate}</td>
                      <td><StatusPill status={item.validation?.status} /></td>
                      <td className="num">{formatRupiah(item.netRevenue)}</td>
                      <td className="num">{formatRupiah(item.contributionProfit)}</td>
                      <td><button type="button" className="button secondary small" onClick={() => openDetail(item.id)}>Detail</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {detail.status === "loading" && <section className="card"><Loading>Memuat detail transaksi…</Loading></section>}
      {detail.status === "error" && <Alert>{detail.message}</Alert>}
      {detail.status === "ready" && (
        <section className="card result">
          <div className="summary-line">
            <h2>Detail {detail.item.marketplace} · {detail.item.orderId}-{detail.item.lineId}</h2>
            <StatusPill status={detail.item.validation?.status} />
            <button type="button" className="button secondary small" onClick={() => setDetail({ status: "idle" })}>Tutup</button>
          </div>
          <div className="details" style={{ marginTop: "1rem" }}>
            <div className="detail-item"><span>Penjualan bruto</span><strong>{formatRupiah(detail.item.grossSales)}</strong></div>
            <div className="detail-item"><span>Diskon penjual</span><strong>{formatRupiah(detail.item.sellerDiscount)}</strong></div>
            <div className="detail-item"><span>Refund</span><strong>{formatRupiah(detail.item.refund)}</strong></div>
            <div className="detail-item"><span>Pendapatan bersih</span><strong>{formatRupiah(detail.item.netRevenue)}</strong></div>
            <div className="detail-item"><span>Kuantitas</span><strong>{formatNumber(detail.item.quantity)}</strong></div>
            <div className="detail-item"><span>HPP per unit</span><strong>{formatRupiah(detail.item.unitProductCost)}</strong></div>
            <div className="detail-item"><span>HPP dipulihkan</span><strong>{formatRupiah(detail.item.recoverableReturnedProductCost)}</strong></div>
            <div className="detail-item"><span>HPP bersih</span><strong>{formatRupiah(detail.item.netProductCost)}</strong></div>
            <div className="detail-item"><span>Komisi</span><strong>{formatRupiah(detail.item.netCommission)}</strong></div>
            <div className="detail-item"><span>Ongkir penjual</span><strong>{formatRupiah(detail.item.sellerShipping)}</strong></div>
            <div className="detail-item"><span>Kemasan</span><strong>{formatRupiah(detail.item.packaging)}</strong></div>
            <div className="detail-item"><span>Biaya retur</span><strong>{formatRupiah(detail.item.returnCost)}</strong></div>
            <div className="detail-item"><span>Biaya lain</span><strong>{formatRupiah(detail.item.otherCost)}</strong></div>
            <div className="detail-item"><span>Laba kontribusi</span><strong>{formatRupiah(detail.item.contributionProfit)}</strong></div>
          </div>
          {Object.keys(detail.item.validation?.errors ?? {}).length > 0 && (
            <Alert tone="warn">
              {Object.entries(detail.item.validation.errors).map(([field, message]) => <span key={field}>{field}: {message} </span>)}
            </Alert>
          )}
          <p className="hint" style={{ marginTop: ".75rem" }}>{data?.signals.disclaimer ?? "Laba kontribusi belum memperhitungkan biaya tetap dan bukan laba bersih usaha."}</p>
        </section>
      )}
    </>
  );
}
