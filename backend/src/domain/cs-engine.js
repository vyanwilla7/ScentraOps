import { freshness } from "./master-data.js";

const ABBREVIATIONS = new Map([
  ["brp", "berapa"],
  ["bgt", "banget"],
  ["ga", "tidak"],
  ["gaa", "tidak"],
  ["gak", "tidak"],
  ["gk", "tidak"],
  ["nggak", "tidak"],
  ["ongkir", "ongkos kirim"],
  ["kpn", "kapan"],
  ["udh", "sudah"],
  ["blm", "belum"],
  ["sblm", "sebelum"],
  ["rdy", "siap"],
  ["bisa", "dapat"]
]);

const COMPLAINT_KEYWORDS = [
  "kecewa",
  "komplain",
  "complaint",
  "keluhan",
  "rusak",
  "salah",
  "pecah",
  "bocor",
  "refund",
  "pengembalian",
  "kurang",
  "tidak lengkap",
  "tidak sesuai",
  "belum sampai",
  "belum diterima",
  "tidak datang",
  "tidak sampai"
];
const NEGATION_WORDS = new Set(["tidak", "bukan", "jangan", "tanpa"]);
const CLAUSE_WORDS = new Set(["cuma", "tapi", "tetapi", "hanya", "namun", "sedangkan", "melainkan", "padahal"]);
const GENERAL_PATTERNS = [/\b(hai|halo|terima kasih|makasih|selamat)\b/];
const INFORMATION_PATTERNS = [
  /\b(stok|tersedia|siap|ready|ada|harga|berapa|kapan|kirim|pengiriman|ongkos kirim|ongkir)\b/
];

export function normalizeMessage(message) {
  const lowered = String(message ?? "").toLowerCase().normalize("NFKC");
  const withoutEmoji = lowered.replace(/[^\p{L}\p{N}\s!?]/gu, " ");
  const reduced = withoutEmoji.replace(/([a-z])\1{2,}/g, "$1$1");
  const words = reduced.split(/\s+/).filter(Boolean).map((word) => {
    const bareWord = word.replace(/[!?]/g, "");
    const replacement = ABBREVIATIONS.get(bareWord) ?? bareWord;
    return `${replacement}${word.slice(bareWord.length)}`;
  });
  return words.join(" ").replace(/\s+([!?])/g, "$1").trim();
}

export function damerauLevenshtein(left, right, limit = 2) {
  if (Math.abs(left.length - right.length) > limit) return limit + 1;
  const rows = Array.from({ length: left.length + 1 }, () => Array(right.length + 1).fill(0));
  for (let row = 0; row <= left.length; row += 1) rows[row][0] = row;
  for (let column = 0; column <= right.length; column += 1) rows[0][column] = column;
  for (let row = 1; row <= left.length; row += 1) {
    for (let column = 1; column <= right.length; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      rows[row][column] = Math.min(
        rows[row - 1][column] + 1,
        rows[row][column - 1] + 1,
        rows[row - 1][column - 1] + cost
      );
      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        rows[row][column] = Math.min(rows[row][column], rows[row - 2][column - 2] + cost);
      }
    }
  }
  return rows[left.length][right.length];
}

function isNegated(tokens, index) {
  // A conjunction ends the negation scope: "tidak rusak, cuma kurang" is still a shortage complaint.
  for (let cursor = index - 1; cursor >= Math.max(0, index - 3); cursor -= 1) {
    if (CLAUSE_WORDS.has(tokens[cursor])) return false;
    if (NEGATION_WORDS.has(tokens[cursor])) return true;
  }
  return false;
}

function phraseIndexes(tokens, phraseTokens) {
  const indexes = [];
  for (let index = 0; index + phraseTokens.length <= tokens.length; index += 1) {
    let matches = true;
    for (let offset = 0; offset < phraseTokens.length; offset += 1) {
      if (tokens[index + offset] !== phraseTokens[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) indexes.push(index);
  }
  return indexes;
}

function complaintSignal(normalized) {
  const tokens = normalized.replace(/[!?]/g, " ").split(/\s+/).filter(Boolean);
  for (const keyword of COMPLAINT_KEYWORDS) {
    const parts = keyword.split(" ");
    for (const index of phraseIndexes(tokens, parts)) {
      // "belum sampai" and "tidak datang" are complaints even though they start with a negation word.
      if (parts[0] === "belum" || NEGATION_WORDS.has(parts[0])) return keyword;
      if (!isNegated(tokens, index)) return keyword;
    }
  }
  return null;
}

export function classifyMessage(normalized) {
  const signal = complaintSignal(normalized);
  const information = INFORMATION_PATTERNS.some((pattern) => pattern.test(normalized));
  const general = GENERAL_PATTERNS.some((pattern) => pattern.test(normalized));
  if (signal) {
    return {
      category: "Keluhan",
      intent: "complaint",
      reason: `Sinyal keluhan "${signal}" memiliki prioritas atas intent lain.`,
      multiIntent: information || general,
      complaint: true
    };
  }
  if (information) {
    return {
      category: "Informasi belum pasti",
      intent: "information",
      reason: "Pesan meminta informasi yang harus diverifikasi terhadap master data.",
      multiIntent: general,
      complaint: false
    };
  }
  return {
    category: "Pertanyaan umum",
    intent: "general",
    reason: general ? "Pesan sapaan atau percakapan umum." : "Tidak ada sinyal domain yang cukup untuk jawaban definitif.",
    multiIntent: false,
    complaint: false
  };
}

function productTerms(sku) {
  return [sku.code, sku.name, ...(sku.aliases ?? [])].map(normalizeMessage).filter(Boolean);
}

function fuzzyLimit(token) {
  return token.length <= 5 ? 1 : 2;
}

function termScore(words, term) {
  const termTokens = term.split(/\s+/).filter(Boolean);
  if (termTokens.length === 0) return null;
  let matched = 0;
  for (const token of termTokens) {
    if (words.includes(token)) {
      matched += 1;
      continue;
    }
    // Very short tokens are too ambiguous for fuzzy matching.
    if (token.length < 4) continue;
    const limit = fuzzyLimit(token);
    let best = limit + 1;
    for (const word of words) {
      if (word.length < 3) continue;
      best = Math.min(best, damerauLevenshtein(word, token, limit));
      if (best === 0) break;
    }
    if (best <= limit) matched += 1 - best / token.length;
  }
  return matched / termTokens.length;
}

function containsTerm(normalized, words, term) {
  if (term.includes(" ")) return ` ${normalized} `.includes(` ${term} `);
  return words.includes(term);
}

export function matchProduct(normalized, skus) {
  const words = normalized.split(/\s+/).filter(Boolean);
  const candidates = [];
  for (const sku of skus.filter((item) => item.active)) {
    let best = null;
    for (const term of productTerms(sku)) {
      if (containsTerm(normalized, words, term)) {
        best = { score: 1, method: "exact", term };
        break;
      }
      const score = termScore(words, term);
      if (score === null) continue;
      const rounded = Math.round(score * 100) / 100;
      if (rounded > (best?.score ?? 0)) best = { score: rounded, method: "fuzzy", term };
    }
    if (best && best.score >= 0.66) candidates.push({ sku, ...best });
  }
  candidates.sort((left, right) => right.score - left.score || left.sku.code.localeCompare(right.sku.code));
  if (!candidates.length) return { candidate: null, candidates: [], confidence: "none" };
  const tied = candidates.filter((candidate) => candidate.score === candidates[0].score);
  return {
    candidate: tied.length === 1 ? candidates[0] : null,
    candidates: candidates.slice(0, 5).map(({ sku, method, score, term }) => ({ skuId: sku.id, code: sku.code, method, score, term })),
    confidence: tied.length === 1 && candidates[0].score >= 0.75 ? "high" : "low"
  };
}

function selectKnowledge(knowledge, normalized, nowTime, limitHours) {
  const tokens = new Set(normalized.split(/\s+/).filter((token) => token.length >= 3));
  return knowledge
    .filter((item) => {
      const effective = item.effectiveAt ? Date.parse(item.effectiveAt) : NaN;
      return Number.isNaN(effective) || effective <= nowTime;
    })
    .map((item) => {
      const text = normalizeMessage(`${item.title ?? ""} ${item.content ?? ""}`);
      const overlap = text.split(/\s+/).filter((token) => token.length >= 3 && tokens.has(token)).length;
      return { item, overlap, freshness: freshness(item, nowTime, limitHours) };
    })
    .filter((entry) => entry.overlap > 0)
    .sort((left, right) => right.overlap - left.overlap)[0] ?? null;
}

function shippingOutcome({ now, cutoff, bufferMinutes = 30 }) {
  if (!cutoff) return { status: "Belum diketahui", state: "unknown", reason: "Batas waktu pengiriman belum dikonfigurasi." };
  const current = Number(now);
  const cutoffTime = Date.parse(cutoff);
  const buffer = Number.isFinite(bufferMinutes) ? bufferMinutes : 30;
  if (Number.isNaN(current) || Number.isNaN(cutoffTime)) {
    return { status: "Belum diketahui", state: "unknown", reason: "Waktu pengiriman tidak valid." };
  }
  const bufferStart = cutoffTime - buffer * 60 * 1000;
  if (current < bufferStart) {
    return { status: "Valid", state: "before-cutoff", reason: "Pertanyaan berada sebelum batas buffer pengiriman." };
  }
  if (current <= cutoffTime) {
    return { status: "Usang", state: "buffer", reason: "Waktu berada dalam buffer; perlu verifikasi staf." };
  }
  return { status: "Usang", state: "after-cutoff", reason: "Batas waktu pengiriman telah lewat; jangan menjanjikan pengiriman hari ini." };
}

function shippingRequested(normalized) {
  return normalized.includes("kirim") || normalized.includes("pengiriman") || normalized.includes("ongkos kirim");
}

function buildSuggestion({ classification, candidate, stockStatus, shipping, knowledge, knowledgeFreshness }) {
  const parts = [];
  if (classification.complaint) {
    parts.push("Kami mohon maaf atas kendala yang Anda alami. Keluhan ini sudah dicatat dan akan diverifikasi oleh staf terkait.");
  }
  if (shipping?.state === "before-cutoff") {
    parts.push("Pesanan yang dikonfirmasi sebelum batas waktu masih dapat diproses hari ini.");
  } else if (shipping?.state === "buffer") {
    parts.push("Waktu pengiriman mendekati batas. Mohon tunggu verifikasi staf sebelum kami menjanjikan pengiriman hari ini.");
  } else if (shipping?.state === "after-cutoff") {
    parts.push("Batas pengiriman hari ini sudah lewat sehingga kami belum dapat menjanjikan pengiriman hari ini.");
  }
  if (candidate && stockStatus === "Valid") {
    parts.push(`Informasi ${candidate.sku.name}: stok ${candidate.sku.stock === 0 ? "habis" : "tersedia"}.`);
  }
  if (!candidate && knowledge && knowledgeFreshness === "Valid") {
    parts.push(knowledge.content);
  }
  if (!parts.length) {
    parts.push("Mohon tunggu, kami perlu memverifikasi informasi terbaru sebelum memberikan kepastian.");
  }
  if (!classification.complaint && candidate && stockStatus !== "Valid") {
    parts.push("Mohon konfirmasi ketersediaan terbaru sebelum menjanjikan stok kepada pelanggan.");
  }
  return parts.join(" ");
}

export function analyzeMessage({ message, skus = [], knowledge = [], now = new Date().toISOString(), cutoff, bufferMinutes = 30, freshnessLimitHours = 24 }) {
  const parsedNow = Date.parse(now);
  const nowTime = Number.isNaN(parsedNow) ? Date.now() : parsedNow;
  const normalized = normalizeMessage(message);
  const classification = classifyMessage(normalized);
  const product = matchProduct(normalized, skus);
  const knowledgeMatch = selectKnowledge(knowledge, normalized, nowTime, freshnessLimitHours);
  const knowledgeItem = knowledgeMatch?.item ?? null;
  const knowledgeFreshness = knowledgeMatch?.freshness ?? null;

  const stockUpdatedAt = product.candidate?.sku.stockUpdatedAt ? Date.parse(product.candidate.sku.stockUpdatedAt) : NaN;
  const stockStatus = !product.candidate || product.candidate.sku.stock === null || Number.isNaN(stockUpdatedAt)
    ? "Belum diketahui"
    : nowTime - stockUpdatedAt > freshnessLimitHours * 60 * 60 * 1000 ? "Usang" : "Valid";

  const shipping = shippingRequested(normalized) ? shippingOutcome({ now: nowTime, cutoff, bufferMinutes }) : null;
  const evidence = [];
  if (product.candidate) evidence.push(stockStatus);
  if (knowledgeFreshness) evidence.push(knowledgeFreshness);
  if (shipping) evidence.push(shipping.status);
  const status = evidence.length === 0
    ? "Belum diketahui"
    : evidence.includes("Belum diketahui") ? "Belum diketahui" : evidence.includes("Usang") ? "Usang" : "Valid";

  const answeredFromEvidence = classification.intent === "information" && status === "Valid" && Boolean(product.candidate);
  const category = answeredFromEvidence ? "Pertanyaan umum" : classification.category;
  const reason = answeredFromEvidence
    ? "Produk teridentifikasi jelas dan sumber informasi masih segar, sehingga pertanyaan dapat dijawab."
    : classification.reason;

  return {
    category,
    reason,
    normalized,
    candidate: product.candidate
      ? { id: product.candidate.sku.id, code: product.candidate.sku.code, name: product.candidate.sku.name, stock: product.candidate.sku.stock }
      : null,
    stock: product.candidate?.sku.stock ?? null,
    matching: {
      method: product.candidate?.method ?? "none",
      score: product.candidate?.score ?? 0,
      confidence: product.confidence,
      candidates: product.candidates
    },
    multiIntent: classification.multiIntent,
    status,
    stockStatus,
    knowledgeStatus: knowledgeFreshness,
    source: knowledgeItem?.source ?? null,
    version: knowledgeItem?.version ?? null,
    updatedAt: knowledgeItem?.updatedAt ?? knowledgeItem?.createdAt ?? knowledgeItem?.effectiveAt ?? null,
    knowledge: knowledgeItem
      ? {
        id: knowledgeItem.id,
        title: knowledgeItem.title,
        source: knowledgeItem.source,
        version: knowledgeItem.version,
        freshness: knowledgeFreshness,
        updatedAt: knowledgeItem.updatedAt ?? knowledgeItem.createdAt ?? knowledgeItem.effectiveAt ?? null
      }
      : null,
    shipping,
    suggestion: buildSuggestion({ classification, candidate: product.candidate, stockStatus, shipping, knowledge: knowledgeItem, knowledgeFreshness }),
    verificationRequired: status !== "Valid" || (!product.candidate && !knowledgeItem),
    complaint: classification.complaint,
    automaticSending: false
  };
}
