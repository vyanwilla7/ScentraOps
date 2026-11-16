import crypto from "node:crypto";
import { validateSettingsPatch } from "../../domain/settings.js";

export function createSettingsService({ repository }) {
  return {
    async get() {
      return repository.settings.get();
    },

    async update(input, user) {
      if (typeof input.reason !== "string" || input.reason.trim() === "") {
        return { error: { status: 400, code: "INVALID_INPUT", message: "Alasan perubahan pengaturan wajib diisi." } };
      }

      const { errors, value } = validateSettingsPatch(input);
      if (Object.keys(errors).length > 0) {
        return { error: { status: 400, code: "INVALID_INPUT", message: "Pengaturan tidak valid.", errors } };
      }

      const before = await repository.settings.get();
      const after = { ...before, ...value };
      const changedAt = new Date().toISOString();
      const reason = input.reason.trim();
      const version = {
        id: crypto.randomUUID(),
        before,
        after,
        changedAt,
        changedBy: user.username,
        reason
      };
      const audit = {
        id: crypto.randomUUID(),
        action: "UPDATE",
        entity: "settings",
        entityId: "app_settings",
        actor: user.username,
        reason,
        before,
        after,
        createdAt: changedAt
      };

      const saved = await repository.settings.update({ before, after, version, audit });
      return { value: saved };
    }
  };
}
