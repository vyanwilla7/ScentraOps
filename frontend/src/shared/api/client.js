const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, { status = 0, code = "REQUEST_FAILED", details = null } = {}) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function request(path, { method = "GET", body } = {}) {
  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      credentials: "include",
      headers: body === undefined ? undefined : { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
  } catch {
    throw new ApiError("Backend tidak dapat dihubungi. Pastikan API berjalan di port 3001.");
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(data?.message ?? `Permintaan gagal (${response.status}).`, {
      status: response.status,
      code: data?.code,
      details: data
    });
  }
  return data;
}

export function buildQuery(filters = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value !== "" && value !== null && value !== undefined) params.set(key, value);
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}
