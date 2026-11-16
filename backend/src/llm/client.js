export class LlmRequestError extends Error {
  constructor(message) {
    super(message);
    this.name = "LlmRequestError";
  }
}

/**
 * Minimal OpenAI-compatible client. Z.ai exposes this shape, so no SDK is needed.
 */
export function createOpenAiCompatibleClient({
  apiKey,
  baseUrl = "https://api.z.ai/api/paas/v4",
  model = "glm-4-flash",
  timeoutMs = 12000,
  fetchImpl = globalThis.fetch
} = {}) {
  return {
    async chat({ system, user, temperature = 0.2 }) {
      if (!apiKey) throw new LlmRequestError("LLM API key belum dikonfigurasi.");
      const response = await fetchImpl(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: system },
            { role: "user", content: user }
          ]
        }),
        signal: AbortSignal.timeout(timeoutMs)
      });
      if (!response.ok) {
        throw new LlmRequestError(`LLM menolak permintaan dengan status ${response.status}.`);
      }
      const data = await response.json();
      const content = data?.choices?.[0]?.message?.content;
      if (typeof content !== "string" || content.trim() === "") {
        throw new LlmRequestError("LLM mengembalikan respons kosong.");
      }
      return content;
    }
  };
}
