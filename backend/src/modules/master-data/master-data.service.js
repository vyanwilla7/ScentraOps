import crypto from "node:crypto";
import {
  createCost as buildCost,
  createKnowledge as buildKnowledge,
  createSku as buildSku,
  freshness,
  updateSku as buildSkuUpdate
} from "../../domain/master-data.js";

function nowIso() {
  return new Date().toISOString();
}

/**
 * Master data use cases. The service owns audit writes so every transport shares the same behavior.
 */
export function createMasterDataService(repository) {
  const store = repository.masterData;

  async function recordAudit(actor, action, entity, entityId, reason, before, after) {
    return store.addAudit({
      id: crypto.randomUUID(),
      action,
      entity,
      entityId,
      actor,
      reason: reason ?? "Perubahan master data",
      ...(before === undefined ? {} : { before }),
      ...(after === undefined ? {} : { after }),
      createdAt: nowIso()
    });
  }

  return {
    async listSkus() {
      return store.listSkus();
    },

    async createSku(input, user) {
      const result = buildSku(input, user);
      if (result.error) return result;
      if (await store.getSkuByCode(result.value.code)) {
        return { error: { status: 409, code: "DUPLICATE_SKU", message: "Kode SKU sudah digunakan." } };
      }
      await store.addSku(result.value);
      await recordAudit(user.username, "CREATE", "sku", result.value.id, input.reason, undefined, result.value);
      return result;
    },

    async updateSku(id, input, user) {
      const current = await store.getSku(id);
      if (!current) return { error: { status: 404, code: "NOT_FOUND", message: "SKU tidak ditemukan." } };
      const result = buildSkuUpdate(current, input);
      if (result.error) return result;
      await store.saveSku(result.value);
      await recordAudit(user.username, "UPDATE", "sku", result.value.id, input.reason, current, result.value);
      return result;
    },

    async listCosts(skuId) {
      return store.listCosts(skuId);
    },

    async createCost(skuId, input, user) {
      if (!(await store.getSku(skuId))) {
        return { error: { status: 404, code: "NOT_FOUND", message: "SKU tidak ditemukan." } };
      }
      const result = buildCost(input, skuId, user);
      if (result.error) return result;
      await store.addCost(result.value);
      await recordAudit(user.username, "CREATE", "cost", result.value.id, input.reason, undefined, result.value);
      return result;
    },

    async listKnowledge() {
      const items = await store.listKnowledge();
      return items.map((item) => ({ ...item, freshness: freshness(item) }));
    },

    async createKnowledge(input, user) {
      const result = buildKnowledge(input, user);
      if (result.error) return result;
      await store.addKnowledge(result.value);
      await recordAudit(user.username, "CREATE", "knowledge", result.value.id, input.reason, undefined, result.value);
      return { value: { ...result.value, freshness: freshness(result.value) } };
    },

    async listAudit() {
      return store.listAudit();
    }
  };
}
