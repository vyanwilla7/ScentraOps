import cors from "cors";

/**
 * CORS is restricted to configured origins; requests without an Origin header stay allowed.
 */
export function createCorsMiddleware(allowedOrigins) {
  return cors({
    origin: (origin, callback) => callback(null, !origin || allowedOrigins.includes(origin)),
    credentials: true
  });
}

export function securityHeaders(_request, response, next) {
  response.setHeader("X-Content-Type-Options", "nosniff");
  next();
}
