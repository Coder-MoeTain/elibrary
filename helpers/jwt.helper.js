const jwt = require('jsonwebtoken');
const appConfig = require('../config');

const JWT_ALGORITHM = 'HS256';

function signToken(payload) {
  return jwt.sign(payload, appConfig.jwt.secret, {
    expiresIn: appConfig.jwt.expiresIn,
    algorithm: JWT_ALGORITHM,
  });
}

function verifyToken(token) {
  return jwt.verify(token, appConfig.jwt.secret, { algorithms: [JWT_ALGORITHM] });
}

module.exports = {
  signToken,
  verifyToken,
};
