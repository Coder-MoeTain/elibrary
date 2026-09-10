const { Op } = require('sequelize');
const { Admin, User } = require('../models');
const { comparePassword } = require('../helpers/password.helper');
const { signToken } = require('../helpers/jwt.helper');
const { verifyGoogleIdToken } = require('../helpers/googleAuth.helper');
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
  if (!user || !user.password || !(await comparePassword(password, user.password))) {
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

function memberTokenPayload(user) {
  const json = user.toJSON();
  delete json.password;
  return {
    token: signToken({ userId: user.usersId, role: ROLES.MEMBER }),
    user: json,
    status: USER_STATUS.APPROVED,
  };
}

async function uniqueUserNameFromGoogle({ email, name }) {
  const base =
    String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 200) ||
    String(email).split('@')[0] ||
    'member';

  let candidate = base.slice(0, 255);
  for (let i = 0; i < 50; i += 1) {
    const existing = await User.unscoped().findOne({
      where: { userName: candidate, isDeleted: false },
    });
    if (!existing) return candidate;
    const suffix = `-${i + 1}`;
    candidate = `${base.slice(0, 255 - suffix.length)}${suffix}`;
  }
  return `${base.slice(0, 200)}-${Date.now()}`;
}

/**
 * Google Sign-In for members.
 * - Existing APPROVED → JWT
 * - Existing PENDING / REJECTED → error
 * - New → create PENDING (no JWT); department left empty for admin
 */
async function googleSignIn({ idToken }) {
  const profile = await verifyGoogleIdToken(idToken);
  const email = profile.email;

  const existing = await User.unscoped().findOne({
    where: { email, isDeleted: false },
  });

  if (existing) {
    if (existing.status === USER_STATUS.PENDING) {
      throw new AppError(MESSAGES.USER_NOT_APPROVED, HTTP_STATUS.UNAUTHORIZED, null, {
        status: USER_STATUS.PENDING,
      });
    }
    if (existing.status === USER_STATUS.REJECTED) {
      throw new AppError(MESSAGES.USER_REJECTED, HTTP_STATUS.UNAUTHORIZED, null, {
        status: USER_STATUS.REJECTED,
      });
    }
    return memberTokenPayload(existing);
  }

  const conflict = await User.unscoped().findOne({
    where: {
      [Op.and]: [{ [Op.or]: [{ email }, { userName: email }] }, { isDeleted: false }],
    },
  });
  if (conflict) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  const userName = await uniqueUserNameFromGoogle({ email, name: profile.name });
  const row = await User.create({
    userName,
    email,
    password: null,
    dateOfBirth: null,
    department_department_id: null,
    status: USER_STATUS.PENDING,
  });

  const created = await User.findByPk(row.usersId, { include: ['department'] });
  const json = created.toJSON();
  delete json.password;

  return {
    status: USER_STATUS.PENDING,
    user: json,
  };
}

module.exports = {
  adminLogin,
  userLogin,
  googleSignIn,
};
