const validator = require('validator');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const auditLogService = require('../services/auditLog.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../helpers/response.helper');
const { MESSAGES, HTTP_STATUS } = require('../constants');
const { Department } = require('../models');
const AppError = require('../utils/AppError');

const BLOCKED_EMAIL_DOMAINS = ['tempmail.com', 'mailinator.com'];

function userDisplayName(user, fallback = 'Member') {
  if (!user) return fallback;
  const name = String(user.userName || user.user_name || '').trim();
  const email = String(user.email || '').trim();
  return name || email || fallback;
}

const adminLogin = asyncHandler(async (req, res) => {
  const adminName = String(req.body.adminName || '').trim();
  try {
    const result = await authService.adminLogin(adminName, req.body.password);
    await auditLogService.record({
      actorId: result?.admin?.adminId ?? result?.admin?.admin_id ?? null,
      actorName: result?.admin?.adminName || adminName || 'Administrator',
      actorKind: 'admin',
      action: 'login_success',
      result: 'success',
      ip: auditLogService.clientIp(req),
    });
    return success(res, { data: result, message: 'Admin signed in' });
  } catch (err) {
    await auditLogService.record({
      actorName: adminName || 'unknown',
      actorKind: 'admin',
      action: 'login_failure',
      result: 'failure',
      details: err?.message || 'Invalid credentials',
      ip: auditLogService.clientIp(req),
    });
    throw err;
  }
});

const userLogin = asyncHandler(async (req, res) => {
  const loginId = String(req.body.userName || '').trim();
  try {
    const result = await authService.userLogin(loginId, req.body.password);
    await auditLogService.record({
      actorId: result?.user?.usersId ?? result?.user?.users_id ?? null,
      actorName: userDisplayName(result?.user, loginId),
      actorKind: 'user',
      action: 'login_success',
      result: 'success',
      ip: auditLogService.clientIp(req),
    });
    return success(res, { data: result, message: 'User signed in' });
  } catch (err) {
    await auditLogService.record({
      actorName: loginId || 'unknown',
      actorKind: 'user',
      action: 'login_failure',
      result: 'failure',
      details: err?.message || 'Invalid credentials',
      ip: auditLogService.clientIp(req),
    });
    throw err;
  }
});

/** Admin or member logout — records who signed out. */
const logout = asyncHandler(async (req, res) => {
  await auditLogService.recordFromRequest(req, {
    action: 'logout',
    result: 'success',
  });
  return success(res, { data: null, message: 'Signed out' });
});

const register = asyncHandler(async (req, res) => {
  const departmentId = Number.parseInt(String(req.body.department_id), 10);
  if (!Number.isInteger(departmentId) || departmentId < 1) {
    throw new AppError(MESSAGES.INVALID_DEPARTMENT, HTTP_STATUS.BAD_REQUEST);
  }
  const department = await Department.findByPk(departmentId);
  if (!department) {
    throw new AppError(MESSAGES.INVALID_DEPARTMENT, HTTP_STATUS.BAD_REQUEST);
  }

  const email = String(req.body.email ?? '').trim().toLowerCase();
  if (!email) {
    throw new AppError('Invalid email format', HTTP_STATUS.UNPROCESSABLE);
  }
  if (!validator.isEmail(email)) {
    throw new AppError('Invalid email format', HTTP_STATUS.UNPROCESSABLE);
  }
  const domain = email.split('@')[1]?.toLowerCase();
  if (domain && BLOCKED_EMAIL_DOMAINS.includes(domain)) {
    throw new AppError('Temporary email is not allowed', HTTP_STATUS.UNPROCESSABLE);
  }
  req.body.email = email;

  const user = await userService.registerUser(req.body);
  await auditLogService.record({
    actorId: user?.usersId ?? user?.users_id ?? null,
    actorName: userDisplayName(user, email),
    actorKind: 'user',
    action: 'register',
    result: 'success',
    details: 'Member registration submitted',
    ip: auditLogService.clientIp(req),
  });
  return created(res, user, MESSAGES.REGISTRATION_SUBMITTED);
});

const googleSignIn = asyncHandler(async (req, res) => {
  const result = await authService.googleSignIn({
    idToken: req.body.idToken,
  });

  if (result.status === 'PENDING') {
    await auditLogService.record({
      actorId: result?.user?.usersId ?? result?.usersId ?? null,
      actorName: userDisplayName(result?.user, result?.email || 'Google user'),
      actorKind: 'user',
      action: 'google_join_pending',
      result: 'success',
      details: result.reapplied ? 'Re-applied for approval' : 'Pending admin approval',
      ip: auditLogService.clientIp(req),
    });
    const message = result.reapplied
      ? 'Your join request was submitted again. Please wait for admin approval.'
      : MESSAGES.REGISTRATION_SUBMITTED;
    return created(res, result, message);
  }

  await auditLogService.record({
    actorId: result?.user?.usersId ?? result?.user?.users_id ?? null,
    actorName: userDisplayName(result?.user, 'Google user'),
    actorKind: 'user',
    action: 'login_success',
    result: 'success',
    details: 'Google Sign-In',
    ip: auditLogService.clientIp(req),
  });
  return success(res, { data: result, message: 'User signed in' });
});

const appleSignIn = asyncHandler(async (req, res) => {
  const result = await authService.appleSignIn({
    identityToken: req.body.identityToken,
    nonce: req.body.nonce,
    fullName: req.body.fullName,
    email: req.body.email,
  });

  if (result.status === 'PENDING') {
    await auditLogService.record({
      actorId: result?.user?.usersId ?? result?.usersId ?? null,
      actorName: userDisplayName(result?.user, result?.email || 'Apple user'),
      actorKind: 'user',
      action: 'apple_join_pending',
      result: 'success',
      details: result.reapplied ? 'Re-applied for approval' : 'Pending admin approval',
      ip: auditLogService.clientIp(req),
    });
    const message = result.reapplied
      ? 'Your join request was submitted again. Please wait for admin approval.'
      : MESSAGES.REGISTRATION_SUBMITTED;
    return created(res, result, message);
  }

  await auditLogService.record({
    actorId: result?.user?.usersId ?? result?.user?.users_id ?? null,
    actorName: userDisplayName(result?.user, 'Apple user'),
    actorKind: 'user',
    action: 'login_success',
    result: 'success',
    details: 'Apple Sign-In',
    ip: auditLogService.clientIp(req),
  });
  return success(res, { data: result, message: 'User signed in' });
});

module.exports = {
  adminLogin,
  userLogin,
  logout,
  /** @deprecated use logout */
  adminLogout: logout,
  register,
  googleSignIn,
  appleSignIn,
};
