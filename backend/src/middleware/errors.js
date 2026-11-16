export function notFound(_request, response) {
  response.status(404).json({
    code: "NOT_FOUND",
    message: "Endpoint belum tersedia."
  });
}

export function errorHandler(error, _request, response, next) {
  if (response.headersSent) return next(error);
  console.error(error);
  return response.status(500).json({ code: "INTERNAL_ERROR", message: "Terjadi kesalahan internal. Coba lagi." });
}
