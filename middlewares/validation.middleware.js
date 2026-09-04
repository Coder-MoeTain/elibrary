const { validationResult } = require('express-validator');
const { HTTP_STATUS } = require('../constants');
const { fail } = require('../helpers/response.helper');

function validate(req, res, next) {
  const result = validationResult(req);
  if (!result.isEmpty()) {
    return fail(res, 'Validation failed', HTTP_STATUS.UNPROCESSABLE, result.array());
  }
  return next();
}

module.exports = { validate };
