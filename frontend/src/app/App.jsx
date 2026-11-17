import { useCallback, useEffect, useState } from "react";
import { authApi } from "../features/auth/api.js";
import LoginView from "../features/auth/LoginView.jsx";
import HomeView from "../features/home/HomeView.jsx";
import CsView from "../features/cs/CsView.jsx";
import TicketsView from "../features/tickets/TicketsView.jsx";
import MasterDataView from "../features/master-data/MasterDataView.jsx";
import TransactionsView from "../features/transactions/TransactionsView.jsx";
import ProfitView from "../features/profit/ProfitView.jsx";
import SettingsView from "../features/settings/SettingsView.jsx";
import { Icon } from "../shared/ui/Icons.jsx";
import { ROLE_LABELS, viewsForUser } from "./navigation.js";

export default function App() {
  const [session, setSession] = useState({ status: "loading", user: null });
  const [loginNotice, setLoginNotice] = useState(null);
  const [view, setView] = useState("home");

  const onUnauthorised = useCallback((error) => {
    if (error?.status !== 401) return false;
    setSession({ status: "ready", user: null });
    setLoginNotice("Sesi Anda berakhir. Silakan masuk kembali.");
    setView("home");
    return true;
  }, []);

  useEffect(() => {
    let active = true;
    authApi.session()
      .then((data) => {
        if (active) setSession({ status: "ready", user: data.user });
      })
      .catch(() => {
        if (active) setSession({ status: "ready", user: null });
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    try {
      await authApi.logout();
    } catch {
      // Clearing local state is enough if the session already expired.
    }
    setSession({ status: "ready", user: null });
    setView("home");
  }

  function handleLogin(user) {
    setSession({ status: "ready", user });
    setLoginNotice(null);
    setView("home");
  }

  if (session.status === "loading") {
    return (
      <div className="splash">
        <div className="spinner" aria-hidden="true" />
        <p className="muted">Memuat sesi…</p>
      </div>
    );
  }

  if (!session.user) {
    return <LoginView notice={loginNotice} onLogin={handleLogin} />;
  }

  const user = session.user;
  const views = viewsForUser(user);
  const current = views.find((item) => item.id === view) ?? views[0];
  const shared = { user, onUnauthorised };
  const content = {
    home: <HomeView {...shared} onNavigate={setView} />,
    cs: <CsView {...shared} />,
    tickets: <TicketsView {...shared} />,
    profit: <ProfitView {...shared} />,
    transactions: <TransactionsView {...shared} />,
    master: <MasterDataView {...shared} />,
    settings: <SettingsView {...shared} />
  }[current.id];
  const initial = (user.displayName || user.username || "?").trim().charAt(0).toUpperCase();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">S</span>
          <div>
            <strong>ScentraOps</strong>
            <span>Alat bantu operasional</span>
          </div>
        </div>
        <nav className="nav" aria-label="Navigasi utama">
          {views.map((item) => (
            <button
              key={item.id}
              type="button"
              className={`nav-item${item.id === current.id ? " active" : ""}`}
              aria-current={item.id === current.id ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              <Icon name={item.id} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="account">
          <div className="account-row">
            <span className="avatar" aria-hidden="true">{initial}</span>
            <div className="account-info">
              <strong>{user.displayName}</strong>
              <span>{ROLE_LABELS[user.role] ?? user.role}</span>
            </div>
          </div>
          <button type="button" className="button ghost small logout" onClick={handleLogout}>
            <Icon name="logout" size={15} />
            Keluar
          </button>
        </div>
      </aside>
      <div className="workspace">
        <header className="page-head">
          <div>
            <p className="crumb">Scentra Parfume</p>
            <h1>{current.label}</h1>
          </div>
          <span className="pill pill-info pill-dot">Data sintetis</span>
        </header>
        <main className="page-body" key={current.id}>{content}</main>
      </div>
    </div>
  );
}