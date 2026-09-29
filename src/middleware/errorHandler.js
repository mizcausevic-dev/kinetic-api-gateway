function errorHandler(err, req, res, next) {
  const statusCode = err.type === "entity.too.large" ? 413 : err.statusCode || err.status || 500;

  if (res.headersSent) {
    return next(err);
  }

  const isInvalidJson = err.type === "entity.parse.failed";
  const isLarge = err.type === "entity.too.large";
  const code = err.publicCode || (statusCode >= 500
    ? "internal_error"
    : isInvalidJson
      ? "bad_request"
      : isLarge ? "payload_too_large" : err.code || (statusCode === 404 ? "not_found" : "bad_request"));
  const message = err.publicMessage || (statusCode >= 500
    ? "An unexpected error occurred."
    : isInvalidJson
      ? "Request body must contain valid JSON."
      : isLarge ? "Request body is too large." : err.message || "The request could not be processed.");

  return res.status(statusCode).json({
    error: { code, message }
  });
}

module.exports = {
  errorHandler
};
