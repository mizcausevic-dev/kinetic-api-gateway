class GatewayError extends Error {
  constructor(statusCode, code, message) {
    super(message);
    this.name = "GatewayError";
    this.statusCode = statusCode;
    this.publicCode = code;
    this.publicMessage = message;
  }
}

module.exports = { GatewayError };
