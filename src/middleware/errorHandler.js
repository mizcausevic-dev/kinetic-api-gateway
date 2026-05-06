function errorHandler(err, req, res, next) {
  const statusCode = err.statusCode || 500;

  if (res.headersSent) {
    return next(err);
  }

  return res.status(statusCode).json({
    error: {
      code: err.code || (statusCode === 404 ? "not_found" : "internal_error"),
      message: err.message || "An unexpected error occurred."
    }
  });
}

module.exports = {
  errorHandler
};
