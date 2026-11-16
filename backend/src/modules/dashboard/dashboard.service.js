import { buildDashboard } from "../../domain/dashboard.js";

export function createDashboardService(repository) {
  return {
    async report(filters) {
      const [records, settings] = await Promise.all([
        repository.transactions.listRecords(),
        repository.settings.get()
      ]);
      const lowMarginPercent = Number.isFinite(settings?.lowMarginPercent)
        ? settings.lowMarginPercent
        : null;
      return buildDashboard(records, filters, { lowMarginPercent });
    },

    async findLine(id) {
      return repository.transactions.getRecord(id);
    }
  };
}
