class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details; // optional field-level errors: { fieldName: 'message' }
  }
}
module.exports = HttpError;
