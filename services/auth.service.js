const { Admin, User } = require('../models');
const { comparePassword } = require('../helpers/password.helper');
const { signToken } = require('../helpers/jwt.helper');
const { ROLES, MESSAGES, USER_STATUS, ADMIN_TIER } = require('../constants');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

async function adminLogin(adminName, password) {
  const admin = await Admin.unscoped().findOne({ where: { adminName } });
  if (!admin || !(await comparePassword(password, admin.password))) {
    throw new AppError(MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
  }
  const tier = admin.role === ADMIN_TIER.SUPER_ADMIN ? ADMIN_TIER.SUPER_ADMIN : ADMIN_TIER.ADMIN;
  const token = signToken({ userId: admin.adminId, role: ROLES.ADMIN, adminRole: tier });
  const json = admin.toJSON();
  delete json.password;
  return { token, admin: json };
}

async function userLogin(userName, password) {
  const user = await User.unscoped().findOne({ where: { userName, isDeleted: false } });
  if (!user || !(await comparePassword(password, user.password))) {
    throw new AppError(MESSAGES.INVALID_CREDENTIALS, HTTP_STATUS.UNAUTHORIZED);
  }
  if (user.status === USER_STATUS.PENDING) {
    throw new AppError(MESSAGES.USER_NOT_APPROVED, HTTP_STATUS.UNAUTHORIZED);
  }
  if (user.status === USER_STATUS.REJECTED) {
    throw new AppError(MESSAGES.USER_REJECTED, HTTP_STATUS.UNAUTHORIZED);
  }
  const token = signToken({ userId: user.usersId, role: ROLES.MEMBER });
  const json = user.toJSON();
  delete json.password;
  return { token, user: json };
}

module.exports = {
  adminLogin,
  userLogin,
};
