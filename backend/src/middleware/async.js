/**
 * Express 4 does not forward rejected promises to the error handler.
 * Every route that talks to PostgreSQL or the LLM goes through this wrapper.
 */
export function asyncHandler(handler) {
  return (request, response, next) => {
    Promise.resolve(handler(request, response, next)).catch(next);
  };
}
