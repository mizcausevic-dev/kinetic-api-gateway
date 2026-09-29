function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || err.status || 500;

  if (res.headersSent) {
    return next(err);
  }

  const isInvalidJson = err.type === "entity.parse.failed";
  const code = statusCode >= 500
    ? "internal_error"
    : isInvalidJson
      ? "bad_request"
      : err.code || (statusCode === 404 ? "not_found" : "bad_request");
  const message = statusCode >= 500
    ? "An unexpected error occurred."
    : isInvalidJson
      ? "Request body must contain valid JSON."
      : err.message || "The request could not be processed.";

  return res.status(statusCode).json({
    error: { code, message }
  });
}

module.exports = {
  errorHandler
};
