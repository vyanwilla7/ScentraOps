import { useState } from "react";
import { csApi } from "./api.js";
import { formatDateTime } from "../../shared/lib/format.js";
import { Alert, StatusPill } from "../../shared/ui/Primitives.jsx";

const CONFIDENCE_LABELS = { high: "Tinggi", low: "Rendah", none: "Tidak ada" };
const MATCH_LABELS = { exact: "Kata kunci persis", fuzzy: "Mirip (Damerau–Levenshtein)", none: "Tidak cocok" };

export default function CsView({ onUnauthorised }) {
  const [message, setMessage] = useState("");
  const [state, setState] = useState({ status: "idle" });
  const [suggestion, setSuggestion] = useState("");
  const [copied, setCopied] = useState(false);

  async function analyze(event) {
    if (event) event.preventDefault();
    if (!message.trim()) return;
    setState({ status: "loading" });
    setCopied(false);
    try {
      const data = await csApi.analyze(message.trim());
      setState({ status: "ready", analysis: data.analysis, ticket: data.ticket });
      setSuggestion(data.analysis.suggestion);
    } catch (error) {
      if (onUnauthorised(error)) return;
      setState({ status: "error", message: error.message });
    }
  }

  async function copySuggestion() {
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  const analysis = state.analysis;

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">PESAN SINTETIS</p>
          <h2>Analisis pesan pelanggan</h2>
          <p className="hint">Tempel pesan dummy. Sistem tidak pernah mengirim pesan secara otomatis.</p>
        </div>
        <form className="stack" onSubmit={analyze}>
          <label>
            Pesan pelanggan
            <textarea
              rows="5"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Contoh: kurma ajva 500g ada gk?"
            />
          </label>
          <div className="summary-line">
            <button className="button" type="submit" disabled={!message.trim() || state.status === "loading"}>
              {state.status === "loading" ? "Menganalisis…" : "Analisis"}
            </button>
            <button className="button secondary" type="button" disabled={!message.trim() || state.status === "loading"} onClick={analyze}>
              Analisis ulang
            </button>
          </div>
        </form>
        {state.status === "error" && <Alert>{state.message}</Alert>}
      </section>

      {state.status === "ready" && analysis && (
        <div className="split result">
          <section className="card">
            <div className="summary-line">
              <h2>Hasil klasifikasi</h2>
              <StatusPill status={analysis.status} />
            </div>
            <div className="details">
              <div className="detail-item"><span>Kategori</span><strong>{analysis.category}</strong></div>
              <div className="detail-item"><span>Multi-intent</span><strong>{analysis.multiIntent ? "Ya" : "Tidak"}</strong></div>
              <div className="detail-item"><span>Kandidat produk</span><strong>{analysis.candidate ? `${analysis.candidate.code} · ${analysis.candidate.name}` : "Tidak dipilih otomatis"}</strong></div>
              <div className="detail-item"><span>Metode pencocokan</span><strong>{MATCH_LABELS[analysis.matching.method] ?? analysis.matching.method}</strong></div>
              <div className="detail-item"><span>Skor & keyakinan</span><strong>{Math.round((analysis.matching.score ?? 0) * 100)}% · {CONFIDENCE_LABELS[analysis.matching.confidence] ?? analysis.matching.confidence}</strong></div>
              <div className="detail-item"><span>Stok tercatat</span><strong>{analysis.stock === null ? "Belum diketahui" : analysis.stock === 0 ? "0 (habis)" : `${analysis.stock} unit`}</strong></div>
            </div>
            <p className="muted" style={{ marginTop: "1rem" }}>{analysis.reason}</p>
            <div className="evidence">
              <p className="eyebrow">TEKS TERNORMALISASI</p>
              <p>{analysis.normalized || "—"}</p>
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">BUKTI & SUMBER</p>
            <h2>Informasi yang dipakai</h2>
            <div className="facts">
              <div className="fact"><span>Status informasi</span><strong><StatusPill status={analysis.status} /></strong></div>
              <div className="fact"><span>Sumber</span><strong>{analysis.source ?? "Belum ada sumber relevan"}</strong></div>
              <div className="fact"><span>Versi</span><strong>{analysis.version ?? "Belum diketahui"}</strong></div>
              <div className="fact"><span>Diperbarui</span><strong>{formatDateTime(analysis.updatedAt)}</strong></div>
            </div>
            {analysis.knowledge && (
              <p className="hint" style={{ marginTop: ".75rem" }}>
                {analysis.knowledge.title} · status sumber {analysis.knowledge.freshness}.
              </p>
            )}
            {analysis.shipping && (
              <div className="notice" style={{ marginTop: ".75rem" }}>
                <p className="eyebrow">PENGIRIMAN</p>
                <div className="summary-line"><StatusPill status={analysis.shipping.status} /><span className="muted">{analysis.shipping.reason}</span></div>
              </div>
            )}
            {analysis.matching.candidates?.length > 0 && (
              <>
                <h3>Kandidat lain</h3>
                <ul className="timeline">
                  {analysis.matching.candidates.map((candidate) => (
                    <li key={`${candidate.skuId}-${candidate.term}`}>
                      <strong>{candidate.code} · {candidate.term}</strong>
                      <span>{candidate.method} · {Math.round(candidate.score * 100)}%</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
            <div className="evidence">
              <p className="eyebrow">SARAN RESPONS (DAPAT DIEDIT)</p>
              <textarea rows="4" value={suggestion} onChange={(event) => setSuggestion(event.target.value)} />
              <div className="summary-line">
                <button type="button" className="button secondary" onClick={copySuggestion} disabled={!suggestion.trim()}>Salin saran</button>
                {copied && <span className="hint">Tersalin ke clipboard.</span>}
              </div>
              <p className="hint">
                {analysis.verificationRequired
                  ? "Verifikasi staf diperlukan sebelum memberi kepastian kepada pelanggan."
                  : "Informasi masih segar, tetapi tetap periksa sebelum dikirim."}
              </p>
            </div>
            {state.ticket ? (
              <div className="notice" style={{ marginTop: ".75rem" }}>
                <p className="eyebrow">TIKET DIBUAT</p>
                <div className="summary-line">
                  <strong>{state.ticket.number}</strong>
                  <StatusPill status={state.ticket.status} />
                  <span className="muted">Prioritas {state.ticket.priority}</span>
                </div>
              </div>
            ) : (
              <p className="hint" style={{ marginTop: ".75rem" }}>Pesan tidak diklasifikasikan sebagai keluhan, sehingga tidak ada tiket baru.</p>
            )}
          </section>
        </div>
      )}
    </>
  );
}
