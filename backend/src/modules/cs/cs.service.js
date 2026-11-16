import crypto from "node:crypto";
import { analyzeMessage } from "../../domain/cs-engine.js";
import { freshness } from "../../domain/master-data.js";
import { DEFAULT_SETTINGS } from "../../domain/settings.js";

/**
 * CS analysis use case: deterministic rules are the source of truth; the LLM may
 * only rewrite the final suggestion from the evidence already computed here.
 */
export function createCsService({ repository, llmAssistant }) {
  return {
    async analyze({ message, user, now, cutoff, bufferMinutes, freshnessLimitHours }) {
      const [skus, knowledgeRows, settings] = await Promise.all([
        repository.masterData.listSkus(),
        repository.masterData.listKnowledge(),
        repository.settings.get()
      ]);
      const values = settings ?? DEFAULT_SETTINGS;
      const effectiveFreshness = Number.isInteger(freshnessLimitHours) ? freshnessLimitHours : values.freshnessLimitHours;
      const effectiveBuffer = Number.isInteger(bufferMinutes) ? bufferMinutes : values.shippingCutoffBufferMinutes;
      const knowledge = knowledgeRows.map((item) => ({ ...item, freshness: freshness(item) }));
      const analysis = analyzeMessage({
        message,
        skus,
        knowledge,
        now,
        cutoff,
        bufferMinutes: effectiveBuffer,
        freshnessLimitHours: effectiveFreshness
      });

      let ticket = null;
      if (analysis.complaint) {
        const createdAt = new Date().toISOString();
        const result = await repository.tickets.create({
          ticket: {
            id: crypto.randomUUID(),
            type: "Keluhan",
            priority: analysis.status === "Usang" || analysis.status === "Belum diketahui" ? "Tinggi" : "Sedang",
            status: "Baru",
            assignee: null,
            originalMessage: message,
            normalizedMessage: analysis.normalized,
            reason: analysis.reason,
            skuId: analysis.candidate?.id ?? null,
            createdBy: user.username,
            createdAt,
            updatedAt: createdAt
          },
          history: {
            id: crypto.randomUUID(),
            action: "CREATED",
            from: null,
            to: "Baru",
            actor: user.username,
            reason: "Analisis pesan diklasifikasikan sebagai keluhan.",
            createdAt
          }
        });
        ticket = result.ticket;
      }

      const draft = llmAssistant
        ? await llmAssistant.draft({ message, analysis })
        : { used: false, reason: "not-configured", suggestion: analysis.suggestion };
      return {
        analysis: {
          ...analysis,
          suggestion: draft.suggestion,
          llm: {
            used: Boolean(draft.used),
            reason: draft.reason,
            provider: draft.provider ?? null,
            model: draft.model ?? null
          }
        },
        ticket
      };
    }
  };
}
