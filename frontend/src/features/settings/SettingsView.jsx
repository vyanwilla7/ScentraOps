import { useEffect, useState } from "react";
import { can } from "../../shared/lib/permissions.js";
import { settingsApi } from "./api.js";
import { Alert, Loading } from "../../shared/ui/Primitives.jsx";

function toNullableNumber(value) {
  return value.trim() === "" ? null : Number(value);
}

export default function SettingsView({ user, onUnauthorised }) {
  const canManage = can(user, "settings:manage");
  const [state, setState] = useState({ status: "loading" });
  const [form, setForm] = useState(null);
  const [save, setSave] = useState({ status: "idle" });

  useEffect(() => {
    let active = true;
    settingsApi.get()
      .then((data) => {
        if (!active) return;
        setState({ status: "ready", item: data.item });
        setForm({
          freshnessLimitHours: String(data.item.freshnessLimitHours),
          shippingCutoffBufferMinutes: String(data.item.shippingCutoffBufferMinutes),
          timezone: data.item.timezone,
          lowMarginPercent: data.item.lowMarginPercent === null ? "" : String(data.item.lowMarginPercent),
          highRevenueThreshold: data.item.highRevenueThreshold === null ? "" : String(data.item.highRevenueThreshold),
          reason: ""
        });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (active) setState({ status: "error", message: error.message });
      });
    return () => {
      active = false;
    };
  }, [onUnauthorised]);

  async function submit(event) {
    event.preventDefault();
    setSave({ status: "loading" });
    try {
      const data = await settingsApi.update({
        freshnessLimitHours: Number(form.freshnessLimitHours),
        shippingCutoffBufferMinutes: Number(form.shippingCutoffBufferMinutes),
        timezone: form.timezone.trim(),
        lowMarginPercent: toNullableNumber(form.lowMarginPercent),
        highRevenueThreshold: toNullableNumber(form.highRevenueThreshold),
        reason: form.reason.trim()
      });
      setState({ status: "ready", item: data.item });
      setForm((current) => ({ ...current, reason: "" }));
      setSave({ status: "saved" });
    } catch (error) {
      if (onUnauthorised(error)) return;
      const fieldErrors = error.details?.errors ?? {};
      setSave({ status: "error", message: error.message, errors: fieldErrors });
    }
  }

  return (
    <>
      <section className="card">
        <div className="page-intro">
          <p className="eyebrow">PENGATURAN</p>
          <h2>Ambang dan batas operasional</h2>
          <p className="hint">
            Batas kesegaran dan penyangga batas jam dipakai oleh analisis CS. Ambang margin rendah dipakai sinyal dashboard.
            Semua perubahan dicatat di audit log.
          </p>
        </div>
        {state.status === "loading" && <Loading>Memuat pengaturan…</Loading>}
        {state.status === "error" && <Alert>{state.message}</Alert>}
        {state.status === "ready" && form && (
          <form className="stack" onSubmit={submit}>
            <div className="form-grid">
              <label>
                Batas kesegaran (jam)
                <input type="number" min="1" max="168" step="1" value={form.freshnessLimitHours} disabled={!canManage} onChange={(event) => setForm({ ...form, freshnessLimitHours: event.target.value })} />
              </label>
              <label>
                Penyangga batas jam (menit)
                <input type="number" min="0" max="240" step="1" value={form.shippingCutoffBufferMinutes} disabled={!canManage} onChange={(event) => setForm({ ...form, shippingCutoffBufferMinutes: event.target.value })} />
              </label>
              <label>
                Zona waktu
                <input value={form.timezone} disabled={!canManage} onChange={(event) => setForm({ ...form, timezone: event.target.value })} placeholder="Asia/Jakarta" />
              </label>
              <label>
                Ambang margin rendah (%)
                <input type="number" min="0" max="100" step="1" value={form.lowMarginPercent} disabled={!canManage} onChange={(event) => setForm({ ...form, lowMarginPercent: event.target.value })} placeholder="Kosong = belum diatur" />
              </label>
              <label>
                Ambang omzet tinggi (Rp)
                <input type="number" min="0" step="1" value={form.highRevenueThreshold} disabled={!canManage} onChange={(event) => setForm({ ...form, highRevenueThreshold: event.target.value })} placeholder="Kosong = belum diatur" />
              </label>
            </div>

            {canManage ? (
              <>
                <label>
                  Alasan perubahan (wajib)
                  <input value={form.reason} onChange={(event) => setForm({ ...form, reason: event.target.value })} placeholder="Contoh: evaluasi batas kesegaran" />
                </label>
                <button className="button" type="submit" disabled={!form.reason.trim() || save.status === "loading"}>
                  {save.status === "loading" ? "Menyimpan…" : "Simpan pengaturan"}
                </button>
              </>
            ) : (
              <Alert tone="info">Peran Anda hanya dapat membaca pengaturan. Perubahan dilakukan oleh staf data.</Alert>
            )}

            {save.status === "error" && (
              <Alert>
                {save.message}
                {Object.entries(save.errors ?? {}).map(([field, message]) => <span key={field}> {field}: {message}</span>)}
              </Alert>
            )}
            {save.status === "saved" && <Alert tone="ok">Pengaturan tersimpan dan tercatat pada audit log.</Alert>}
          </form>
        )}
      </section>

      {state.status === "ready" && (
        <section className="card">
          <p className="eyebrow">CATATAN</p>
          <h2>Nilai awal sesuai proposal</h2>
          <p className="muted">Batas kesegaran awal 24 jam dan penyangga batas jam 30 menit. Ambang margin/omzet kosong berarti belum diatur; dashboard tidak mengarang nilai.</p>
          <p className="hint">Zona waktu awal {state.item.timezone}. Pengaturan disimpan pada store in-memory sampai adaptor PostgreSQL diaktifkan.</p>
        </section>
      )}
    </>
  );
}
