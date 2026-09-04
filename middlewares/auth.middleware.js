const { verifyToken } = require('../helpers/jwt.helper');
const { Admin, User } = require('../models');
const { HTTP_STATUS, MESSAGES, ROLES, ADMIN_TIER, USER_STATUS } = require('../constants');
const { fail } = require('../helpers/response.helper');

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const [type, token] = header.split(' ');
    if (type !== 'Bearer' || !token) {
      return fail(res, MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    const decoded = verifyToken(token);
    const userId = Number(decoded.userId ?? decoded.sub);
    if (!Number.isInteger(userId) || userId < 1) {
      return fail(res, MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }

    if (decoded.role === ROLES.ADMIN) {
      const admin = await Admin.unscoped().findByPk(userId);
      if (!admin) {
        return fail(res, MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
      }
      const tier =
        admin.role === ADMIN_TIER.SUPER_ADMIN ? ADMIN_TIER.SUPER_ADMIN : ADMIN_TIER.ADMIN;
      req.user = {
        id: admin.adminId,
        role: ROLES.ADMIN,
        adminRole: tier,
      };
      return next();
    }

    const user = await User.unscoped().findOne({
      where: { usersId: userId, isDeleted: false },
    });
    if (!user) {
      return fail(res, MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
    }
    if (user.status === USER_STATUS.PENDING) {
      return fail(res, MESSAGES.USER_NOT_APPROVED, HTTP_STATUS.UNAUTHORIZED);
    }
    if (user.status === USER_STATUS.REJECTED) {
      return fail(res, MESSAGES.USER_REJECTED, HTTP_STATUS.UNAUTHORIZED);
    }

    req.user = {
      id: user.usersId,
      role: ROLES.MEMBER,
      adminRole: null,
    };
    return next();
  } catch {
    return fail(res, MESSAGES.AUTH_REQUIRED, HTTP_STATUS.UNAUTHORIZED);
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== ROLES.ADMIN) {
    return fail(res, MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
  return next();
}

function requireUser(req, res, next) {
  if (!req.user || (req.user.role !== ROLES.USER && req.user.role !== ROLES.MEMBER)) {
    return fail(res, MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
  return next();
}

/** Admin or authenticated user (any logged-in principal). */
function requireAuthPrincipal(req, res, next) {
  if (!req.user || ![ROLES.ADMIN, ROLES.USER, ROLES.MEMBER].includes(req.user.role)) {
    return fail(res, MESSAGES.FORBIDDEN, HTTP_STATUS.FORBIDDEN);
  }
  return next();
}

function requireSuperAdmin(req, res, next) {
  if (!req.user || req.user.role !== ROLES.ADMIN || req.user.adminRole !== ADMIN_TIER.SUPER_ADMIN) {
    return fail(res, MESSAGES.SUPER_ADMIN_ONLY, HTTP_STATUS.FORBIDDEN);
  }
  return next();
}

module.exports = {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  requireUser,
  requireAuthPrincipal,
};
