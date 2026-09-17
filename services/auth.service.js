const { Op } = require('sequelize');
const { Admin, User } = require('../models');
const { comparePassword } = require('../helpers/password.helper');
const { signToken } = require('../helpers/jwt.helper');
const { verifyGoogleIdToken } = require('../helpers/googleAuth.helper');
const { verifyAppleIdentityToken } = require('../helpers/appleAuth.helper');
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
  const loginId = String(userName || '').trim();
  const user = await User.unscoped().findOne({
    where: {
      isDeleted: false,
      [Op.or]: [{ userName: loginId }, { email: loginId }],
    },
  });
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

async function uniqueUserNameFromProfile({ email, name }) {
  const base =
    String(name || '')
      .trim()
      .replace(/\s+/g, ' ')
      .slice(0, 200) ||
    String(email || '').split('@')[0] ||
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

async function reloadUserWithDepartment(user) {
  try {
    return (
      (await User.unscoped().findByPk(user.usersId, {
        include: [{ association: 'department', required: false }],
      })) || user
    );
  } catch {
    return user;
  }
}

/**
 * Shared Google / Apple member join-or-sign-in flow.
 */
async function socialMemberSignIn({ email, name, appleSub = null }) {
  const settingsService = require('./settings.service');
  const normalizedEmail = email ? String(email).trim().toLowerCase() : null;

  let existing = null;
  if (appleSub) {
    existing = await User.unscoped().findOne({
      where: { appleSub, isDeleted: false },
    });
  }
  if (!existing && normalizedEmail) {
    existing = await User.unscoped().findOne({
      where: { email: normalizedEmail, isDeleted: false },
    });
  }

  if (existing) {
    if (appleSub && !existing.appleSub) {
      await existing.update({ appleSub });
    }

    if (existing.status === USER_STATUS.PENDING) {
      throw new AppError(MESSAGES.USER_NOT_APPROVED, HTTP_STATUS.UNAUTHORIZED, null, {
        status: USER_STATUS.PENDING,
      });
    }
    if (existing.status === USER_STATUS.REJECTED) {
      const requireApproval = await settingsService.getGoogleJoinRequireApproval();
      if (requireApproval) {
        await existing.update({ status: USER_STATUS.PENDING });
        const reapplied = await reloadUserWithDepartment(existing);
        const json = reapplied.toJSON();
        delete json.password;
        return {
          status: USER_STATUS.PENDING,
          user: json,
          reapplied: true,
        };
      }
      await existing.update({ status: USER_STATUS.APPROVED });
      await settingsService.enqueueAutoJoinNotice(existing.usersId);
      return memberTokenPayload(existing);
    }
    return memberTokenPayload(existing);
  }

  if (!normalizedEmail) {
    throw new AppError(
      'Apple account email is required. Please share your email and try again.',
      HTTP_STATUS.UNAUTHORIZED
    );
  }

  const conflict = await User.unscoped().findOne({
    where: {
      [Op.and]: [
        { [Op.or]: [{ email: normalizedEmail }, { userName: normalizedEmail }] },
        { isDeleted: false },
      ],
    },
  });
  if (conflict) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  const requireApproval = await settingsService.getGoogleJoinRequireApproval();
  const status = requireApproval ? USER_STATUS.PENDING : USER_STATUS.APPROVED;

  const userName = await uniqueUserNameFromProfile({
    email: normalizedEmail,
    name,
  });
  const row = await User.create({
    userName,
    email: normalizedEmail,
    password: null,
    dateOfBirth: null,
    department_department_id: null,
    status,
    appleSub: appleSub || null,
  });

  const created = await reloadUserWithDepartment(row);

  if (status === USER_STATUS.APPROVED) {
    await settingsService.enqueueAutoJoinNotice(created.usersId);
    return memberTokenPayload(created);
  }

  const json = created.toJSON();
  delete json.password;

  return {
    status: USER_STATUS.PENDING,
    user: json,
  };
}

/**
 * Google Sign-In for members.
 * - Existing APPROVED → JWT
 * - Existing PENDING → error (awaiting admin)
 * - Existing REJECTED → re-apply: PENDING (if require-approval on) or APPROVED + JWT
 * - New → PENDING (if require-approval on) or APPROVED + JWT
 */
async function googleSignIn({ idToken }) {
  const profile = await verifyGoogleIdToken(idToken);
  return socialMemberSignIn({
    email: profile.email,
    name: profile.name,
  });
}

/**
 * Sign in with Apple for members (same join/approval rules as Google).
 */
async function appleSignIn({ identityToken, nonce, fullName, email }) {
  const profile = await verifyAppleIdentityToken(identityToken, { nonce });
  const resolvedEmail = profile.email || (email ? String(email).trim().toLowerCase() : null);
  const resolvedName =
    String(fullName || '').trim() || String(profile.name || '').trim();

  return socialMemberSignIn({
    email: resolvedEmail,
    name: resolvedName,
    appleSub: profile.sub,
  });
}

module.exports = {
  adminLogin,
  userLogin,
  googleSignIn,
  appleSignIn,
};
