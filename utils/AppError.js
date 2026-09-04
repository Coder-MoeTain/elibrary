class AppError extends Error {
  constructor(message, statusCode = 400, errors = null, details = null) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.errors = errors;
    this.details = details && typeof details === 'object' ? details : null;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
