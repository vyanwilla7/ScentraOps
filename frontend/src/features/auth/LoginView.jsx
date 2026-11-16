import { useState } from "react";
import { authApi } from "./api.js";
import { Alert } from "../../shared/ui/Primitives.jsx";

const DEMO_ACCOUNTS = [
  { username: "cs-demo", role: "Customer Service" },
  { username: "data-demo", role: "Staf Data" },
  { username: "owner-demo", role: "Pemilik" }
];

export default function LoginView({ notice, onLogin }) {
  const [form, setForm] = useState({ username: "cs-demo", password: "demo123" });
  const [state, setState] = useState({ status: "idle" });

  async function submit(event) {
    event.preventDefault();
    setState({ status: "loading" });
    try {
      const data = await authApi.login(form.username.trim(), form.password);
      onLogin(data.user);
    } catch (error) {
      setState({ status: "error", message: error.message });
    }
  }

  return (
    <div className="login-shell">
      <main className="login-card">
        <p className="eyebrow">SCENTRA PARFUME · SIMULASI</p>
        <h1>Masuk ke ScentraOps</h1>
        <p className="muted">Asisten CS dan analisis laba kontribusi untuk tim operasional.</p>
        {notice && <Alert tone="warn">{notice}</Alert>}
        <form className="stack" onSubmit={submit}>
          <label>
            Nama pengguna
            <input autoComplete="username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} />
          </label>
          <label>
            Kata sandi
            <input type="password" autoComplete="current-password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
          </label>
          <button className="button" type="submit" disabled={state.status === "loading" || !form.username.trim() || !form.password}>
            {state.status === "loading" ? "Memeriksa…" : "Masuk"}
          </button>
        </form>
        {state.status === "error" && <Alert>{state.message}</Alert>}
        <div className="demo-accounts">
          <p className="eyebrow">AKUN DEMO LOKAL</p>
          <div className="chip-row">
            {DEMO_ACCOUNTS.map((account) => (
              <button key={account.username} type="button" className="chip" onClick={() => setForm({ username: account.username, password: "demo123" })}>
                {account.username}
                <span>{account.role}</span>
              </button>
            ))}
          </div>
          <p className="hint">Semua akun demo memakai kata sandi <code>demo123</code>. Tidak untuk lingkungan nyata.</p>
        </div>
      </main>
    </div>
  );
}
