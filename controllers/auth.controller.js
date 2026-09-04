const validator = require('validator');
const authService = require('../services/auth.service');
const userService = require('../services/user.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created } = require('../helpers/response.helper');
const { MESSAGES, HTTP_STATUS } = require('../constants');
const { Department } = require('../models');
const AppError = require('../utils/AppError');

const BLOCKED_EMAIL_DOMAINS = ['tempmail.com', 'mailinator.com'];

const adminLogin = asyncHandler(async (req, res) => {
  const result = await authService.adminLogin(req.body.adminName, req.body.password);
  return success(res, { data: result, message: 'Admin signed in' });
});

const userLogin = asyncHandler(async (req, res) => {
  const result = await authService.userLogin(req.body.userName, req.body.password);
  return success(res, { data: result, message: 'User signed in' });
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
  return created(res, user, MESSAGES.REGISTRATION_SUBMITTED);
});

module.exports = {
  adminLogin,
  userLogin,
  register,
};
