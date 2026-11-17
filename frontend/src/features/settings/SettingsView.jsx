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

  const set = (field) => (event) => setForm({ ...form, [field]: event.target.value });

  return (
    <>
      <section className="card page-intro">
        <h2>Ambang dan batas operasional</h2>
        <p className="muted">
          Batas kesegaran dan penyangga batas jam dipakai analisis CS. Ambang margin dan omzet dipakai sinyal dashboard.
          Semua perubahan dicatat di audit log.
        </p>
        {!canManage && state.status === "ready" && (
          <Alert tone="info">Peran Anda hanya dapat membaca pengaturan. Perubahan dilakukan oleh staf data.</Alert>
        )}
      </section>

      {state.status === "loading" && <section className="card"><Loading>Memuat pengaturan…</Loading></section>}
      {state.status === "error" && <section className="card"><Alert>{state.message}</Alert></section>}

      {state.status === "ready" && form && (
        <form className="settings-form" onSubmit={submit}>
          <section className="card">
            <h3 className="section-title">Asisten CS</h3>
            <p className="hint">Menentukan kapan informasi stok dianggap usang dan cara menangani batas jam pesan.</p>
            <div className="form-grid">
              <label>
                Batas kesegaran (jam)
                <input type="number" min="1" max="168" step="1" value={form.freshnessLimitHours} disabled={!canManage} onChange={set("freshnessLimitHours")} />
                <span className="field-hint">Awal 24 jam. Lebih lama dari ini, stok berstatus Usang.</span>
              </label>
              <label>
                Penyangga batas jam (menit)
                <input type="number" min="0" max="240" step="1" value={form.shippingCutoffBufferMinutes} disabled={!canManage} onChange={set("shippingCutoffBufferMinutes")} />
                <span className="field-hint">Awal 30 menit. Di dalam penyangga, jawaban bersyarat.</span>
              </label>
              <label>
                Zona waktu
                <input value={form.timezone} disabled={!canManage} onChange={set("timezone")} placeholder="Asia/Jakarta" />
                <span className="field-hint">Format IANA, misalnya {state.item.timezone}.</span>
              </label>
            </div>
          </section>

          <section className="card">
            <h3 className="section-title">Sinyal dashboard laba</h3>
            <p className="hint">Dikosongkan berarti belum diatur; dashboard tidak mengarang nilai.</p>
            <div className="form-grid">
              <label>
                Ambang margin rendah (%)
                <input type="number" min="0" max="100" step="1" value={form.lowMarginPercent} disabled={!canManage} onChange={set("lowMarginPercent")} placeholder="Belum diatur" />
                <span className="field-hint">Produk di bawah angka ini ditandai margin rendah.</span>
              </label>
              <label>
                Ambang omzet tinggi (Rp)
                <input type="number" min="0" step="1" value={form.highRevenueThreshold} disabled={!canManage} onChange={set("highRevenueThreshold")} placeholder="Belum diatur" />
                <span className="field-hint">Dipakai untuk sinyal omzet tinggi dengan margin rendah.</span>
              </label>
            </div>
          </section>

          {canManage && (
            <section className="card form-actions">
              <label className="grow">
                Alasan perubahan (wajib)
                <input value={form.reason} onChange={set("reason")} placeholder="Contoh: evaluasi batas kesegaran" />
              </label>
              <button className="button" type="submit" disabled={!form.reason.trim() || save.status === "loading"}>
                {save.status === "loading" ? "Menyimpan…" : "Simpan pengaturan"}
              </button>
            </section>
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

      {state.status === "ready" && (
        <section className="card">
          <h3 className="section-title">Catatan nilai awal</h3>
          <p className="muted">Sesuai proposal: batas kesegaran 24 jam dan penyangga batas jam 30 menit.</p>
          <p className="hint">Pengaturan disimpan pada store in-memory sampai adaptor PostgreSQL diaktifkan.</p>
        </section>
      )}
    </>
  );
}