import { createOpenAiCompatibleClient } from "./client.js";

const SYSTEM_PROMPT = [
  "Anda adalah asisten layanan pelanggan ScentraOps.",
  "Tugas Anda HANYA menyusun draf balasan dalam Bahasa Indonesia yang sopan dan ringkas.",
  "Gunakan hanya fakta pada objek evidence. Jangan menambah fakta, harga, stok, tanggal, atau janji baru.",
  "Jangan menyebut HPP, laba, margin, komisi, atau data internal keuangan.",
  "Jika verificationRequired bernilai true, jangan menyatakan stok atau pengiriman sebagai kepastian; minta verifikasi staf.",
  "Pesan tidak boleh dikirim otomatis. Staf akan memeriksa dan mengedit draf.",
  "Balas HANYA JSON valid dengan bentuk {\"suggestion\":\"teks balasan\"}."
].join(" ");

const FORBIDDEN = /\b(hpp|laba|margin|komisi)\b/i;
const FALSE_CERTAINTY = /\b(pasti|dijamin|stok tersedia|pengiriman hari ini)\b/i;

function parseSuggestion(content) {
  const cleaned = String(content ?? "")
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    return null;
  }
  const value = parsed?.suggestion ?? parsed?.reply;
  if (typeof value !== "string") return null;
  const suggestion = value.trim();
  if (suggestion.length === 0 || suggestion.length > 1600) return null;
  if (FORBIDDEN.test(suggestion)) return null;
  return suggestion;
}

function evidenceFor(analysis) {
  return {
    category: analysis.category,
    status: analysis.status,
    stockStatus: analysis.stockStatus,
    product: analysis.candidate ? { code: analysis.candidate.code, name: analysis.candidate.name, stock: analysis.stock } : null,
    stock: analysis.stock,
    shipping: analysis.shipping,
    knowledge: analysis.knowledge ? {
      title: analysis.knowledge.title,
      source: analysis.knowledge.source,
      version: analysis.knowledge.version,
      freshness: analysis.knowledge.freshness
    } : null,
    verificationRequired: analysis.verificationRequired,
    deterministicSuggestion: analysis.suggestion
  };
}

/**
 * LLM is an optional drafting layer, never the source of truth. Classification,
 * matching, stock, freshness, shipping, and ticketing remain deterministic.
 */
export function createLlmAssistant({
  enabled = false,
  apiKey = null,
  baseUrl,
  model = "glm-4-flash",
  provider = "z.ai",
  timeoutMs = 12000,
  client = null
} = {}) {
  const llmClient = client ?? (enabled && apiKey
    ? createOpenAiCompatibleClient({ apiKey, baseUrl, model, timeoutMs })
    : null);

  return {
    enabled: Boolean(enabled && llmClient),
    provider,
    model,

    async draft({ message, analysis }) {
      if (!enabled || !llmClient) {
        return { used: false, reason: "not-configured", provider, model, suggestion: analysis.suggestion };
      }
      try {
        const content = await llmClient.chat({
          system: SYSTEM_PROMPT,
          user: JSON.stringify({ message, evidence: evidenceFor(analysis) })
        });
        const suggestion = parseSuggestion(content);
        if (!suggestion) {
          return { used: false, reason: "invalid-output", provider, model, suggestion: analysis.suggestion };
        }
        if (analysis.verificationRequired && FALSE_CERTAINTY.test(suggestion)) {
          return { used: false, reason: "unsafe-certainty", provider, model, suggestion: analysis.suggestion };
        }
        return { used: true, reason: "ok", provider, model, suggestion };
      } catch {
        // Never fail analysis because the optional provider is unavailable.
        return { used: false, reason: "unavailable", provider, model, suggestion: analysis.suggestion };
      }
    }
  };
}

export { SYSTEM_PROMPT, parseSuggestion };
