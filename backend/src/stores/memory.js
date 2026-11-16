import { DEFAULT_SETTINGS } from "../domain/settings.js";

export function createMasterDataStore(initial = {}) {
  return {
    skus: initial.skus ?? [],
    costs: initial.costs ?? [],
    knowledge: initial.knowledge ?? [],
    audit: initial.audit ?? []
  };
}

export function createTicketStore(initial = {}) {
  return {
    tickets: initial.tickets ?? [],
    history: initial.history ?? [],
    sequence: initial.sequence ?? 0
  };
}

export function createTransactionStore(initial = {}) {
  return {
    records: initial.records ?? [],
    revisions: initial.revisions ?? [],
    adjustments: initial.adjustments ?? [],
    imports: initial.imports ?? []
  };
}

export function createSettingsStore(initial = {}) {
  return {
    values: { ...DEFAULT_SETTINGS, ...(initial.values ?? {}) },
    versions: initial.versions ?? []
  };
}
