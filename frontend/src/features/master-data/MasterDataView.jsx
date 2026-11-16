import { useEffect, useState } from "react";
import { can } from "../../shared/lib/permissions.js";
import { masterDataApi } from "./api.js";
import { Alert } from "../../shared/ui/Primitives.jsx";
import SkuPanel from "./SkuPanel.jsx";
import CostsPanel from "./CostsPanel.jsx";
import KnowledgePanel from "./KnowledgePanel.jsx";
import AuditPanel from "./AuditPanel.jsx";

const TABS = [
  { id: "sku", label: "SKU & stok", permission: "catalog:read" },
  { id: "costs", label: "HPP berversi", permission: "costs:read" },
  { id: "knowledge", label: "Pengetahuan", permission: "knowledge:read" },
  { id: "audit", label: "Audit log", permission: "audit:read" }
];

export default function MasterDataView({ user, onUnauthorised }) {
  const tabs = TABS.filter((tab) => can(user, tab.permission));
  const [active, setActive] = useState(tabs[0]?.id ?? "sku");
  const [skus, setSkus] = useState({ status: "loading", items: [] });
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    let alive = true;
    setSkus({ status: "loading", items: [] });
    masterDataApi.list()
      .then((data) => {
        if (alive) setSkus({ status: "ready", items: data.items });
      })
      .catch((error) => {
        if (onUnauthorised(error)) return;
        if (alive) setSkus({ status: "error", message: error.message, items: [] });
      });
    return () => {
      alive = false;
    };
  }, [refresh, onUnauthorised]);

  function replaceSku(updated) {
    setSkus((current) => current.status === "ready"
      ? { ...current, items: current.items.map((item) => item.id === updated.id ? updated : item) }
      : current);
  }

  const current = tabs.some((tab) => tab.id === active) ? active : tabs[0]?.id;

  if (tabs.length === 0) {
    return <Alert>Peran Anda tidak memiliki akses ke master data.</Alert>;
  }

  return (
    <>
      <div className="tab-bar" role="tablist" aria-label="Bagian master data">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={tab.id === current}
            className={`tab${tab.id === current ? " active" : ""}`}
            onClick={() => setActive(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {current === "sku" && (
        <SkuPanel
          skus={skus}
          canManage={can(user, "catalog:manage")}
          onRefresh={() => setRefresh((value) => value + 1)}
          replaceSku={replaceSku}
          onUnauthorised={onUnauthorised}
        />
      )}
      {current === "costs" && (
        <CostsPanel
          skus={skus.items}
          canManage={can(user, "costs:manage")}
          onUnauthorised={onUnauthorised}
        />
      )}
      {current === "knowledge" && (
        <KnowledgePanel canManage={can(user, "knowledge:manage")} onUnauthorised={onUnauthorised} />
      )}
      {current === "audit" && <AuditPanel onUnauthorised={onUnauthorised} />}
    </>
  );
}
