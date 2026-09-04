const { HTTP_STATUS, MESSAGES } = require('../constants');
const { fail } = require('../helpers/response.helper');

function roleMiddleware(role) {
  return (req, res, next) => {
    if (!req.user || req.user.role !== role) {
      return fail(res, MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
    }
    return next();
  };
}

module.exports = roleMiddleware;

