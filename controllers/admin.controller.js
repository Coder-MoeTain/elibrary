const adminService = require('../services/admin.service');
const userService = require('../services/user.service');
const { sendApprovalEmail } = require('../services/mail.service');
const asyncHandler = require('../utils/asyncHandler');
const { success, created, noContent } = require('../helpers/response.helper');

const create = asyncHandler(async (req, res) => {
  const row = await adminService.create(req.body);
  return created(res, row);
});

const list = asyncHandler(async (req, res) => {
  const rows = await adminService.findAll();
  return success(res, { data: rows });
});

const getById = asyncHandler(async (req, res) => {
  const row = await adminService.findById(req.params.id);
  return success(res, { data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await adminService.update(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await adminService.remove(req.params.id, req.user);
  return noContent(res);
});

const approveUser = asyncHandler(async (req, res) => {
  const row = await userService.approveUser(req.params.id);
  const payload = row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  try {
    if (payload?.email) {
      await sendApprovalEmail(payload.email, payload.userName);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Approval notification email failed:', err?.message || err);
  }
  return success(res, { data: payload, message: 'User approved' });
});

const rejectUser = asyncHandler(async (req, res) => {
  const row = await userService.rejectUser(req.params.id);
  const payload = row && typeof row.toJSON === 'function' ? row.toJSON() : row;
  return success(res, { data: payload, message: 'User rejected' });
});

const profile = asyncHandler(async (req, res) => {
  const data = await adminService.getProfile(req.user.id);
  return success(res, { data });
});

const updateProfile = asyncHandler(async (req, res) => {
  const data = await adminService.updateProfile(req.user.id, req.body);
  return success(res, { data, message: 'Profile updated' });
});

const changePassword = asyncHandler(async (req, res) => {
  const currentPassword = String(req.body.currentPassword ?? '');
  const newPassword = String(req.body.newPassword ?? '');
  await adminService.changePassword(req.user.id, currentPassword, newPassword);
  return success(res, { message: 'Password updated' });
});

module.exports = {
  create,
  list,
  getById,
  update,
  remove,
  approveUser,
  rejectUser,
  profile,
  updateProfile,
  changePassword,
};
