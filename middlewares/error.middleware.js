const { Sequelize } = require('sequelize');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');
const { fail } = require('../helpers/response.helper');

const isProd = process.env.NODE_ENV === 'production';

// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  if (err && err.name === 'MulterError') {
    const message =
      err.code === 'LIMIT_FILE_SIZE'
        ? 'File too large (max 100 MB per file)'
        : err.message || 'Upload failed';
    return fail(res, message, HTTP_STATUS.BAD_REQUEST);
  }

  if (
    err &&
    typeof err.message === 'string' &&
    (err.message.includes('Only PDF') ||
      err.message.includes('Only JPEG') ||
      err.message.includes('Only images') ||
      err.message.includes('Invalid image') ||
      err.message.includes('Unsupported upload field'))
  ) {
    return fail(res, err.message, HTTP_STATUS.BAD_REQUEST);
  }

  if (err && typeof err.message === 'string' && err.message.includes('Not allowed by CORS')) {
    return fail(res, 'Origin not allowed', HTTP_STATUS.FORBIDDEN);
  }

  if (err instanceof AppError) {
    const body = { success: false, message: err.message };
    if (err.errors) body.errors = err.errors;
    if (err.details && typeof err.details === 'object') {
      Object.assign(body, err.details);
    }
    return res.status(err.statusCode).json(body);
  }

  if (err instanceof Sequelize.ValidationError) {
    const errors = err.errors.map((e) => ({ path: e.path, msg: e.message }));
    return fail(res, 'Validation error', HTTP_STATUS.UNPROCESSABLE, errors);
  }

  if (err instanceof Sequelize.ForeignKeyConstraintError) {
    return fail(
      res,
      'Cannot delete: this record is used in other data.',
      HTTP_STATUS.CONFLICT
    );
  }

  if (err instanceof Sequelize.UniqueConstraintError) {
    const hint = `${err.index ?? ''} ${err.parent?.sqlMessage ?? ''}`;
    if (hint.includes('uniq_Depeartment_name_deleted')) {
      return fail(res, MESSAGES.DEPARTMENT_NAME_EXISTS, HTTP_STATUS.UNPROCESSABLE);
    }
    return fail(res, 'Duplicate entry', HTTP_STATUS.CONFLICT);
  }

  if (!isProd) {
    const sqlMsg = err?.parent?.sqlMessage;
    if (sqlMsg) {
      // eslint-disable-next-line no-console
      console.error('Unhandled error (SQL):', sqlMsg);
    }
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err);
  } else {
    // eslint-disable-next-line no-console
    console.error('Unhandled error:', err?.message || err?.name || 'Unknown');
  }
  return fail(res, MESSAGES.INTERNAL, HTTP_STATUS.INTERNAL);
}

function notFoundHandler(req, res) {
  return fail(res, 'Route not found', HTTP_STATUS.NOT_FOUND);
}

module.exports = {
  errorMiddleware,
  notFoundHandler,
};
