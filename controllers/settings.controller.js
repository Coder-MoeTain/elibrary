const settingsService = require('../services/settings.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../helpers/response.helper');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

const get = asyncHandler(async (req, res) => {
  const data = await settingsService.getPublicSettings();
  return success(res, { data });
});

const updateTimezone = asyncHandler(async (req, res) => {
  const data = await settingsService.updateTimezone(req.body?.timezone);
  return success(res, { data, message: 'Timezone updated' });
});

const updateGoogleJoinApproval = asyncHandler(async (req, res) => {
  const raw = req.body?.googleJoinRequireApproval ?? req.body?.enabled;
  if (typeof raw !== 'boolean') {
    throw new AppError('googleJoinRequireApproval must be true or false.', HTTP_STATUS.BAD_REQUEST);
  }
  const data = await settingsService.updateGoogleJoinRequireApproval(raw);
  return success(res, {
    data,
    message: raw
      ? 'New Google sign-ins will stay pending until approved'
      : 'New Google sign-ins can join immediately',
  });
});

const createBackup = asyncHandler(async (req, res) => {
  const data = await settingsService.createBackup();
  return success(res, { data, message: 'Backup created' });
});

const listBackups = asyncHandler(async (req, res) => {
  const data = await settingsService.listBackups();
  return success(res, { data });
});

const downloadBackup = asyncHandler(async (req, res) => {
  const full = settingsService.backupFilePath(req.params.file);
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
  return res.sendFile(full);
});

const restoreBackup = asyncHandler(async (req, res) => {
  if (req.file?.path) {
    const data = await settingsService.importUploadedSql(req.file.path);
    return success(res, { data, message: 'Database restored from upload' });
  }
  const fileName = req.body?.fileName || req.params.file;
  if (!fileName) {
    throw new AppError('Choose a backup file to restore.', HTTP_STATUS.BAD_REQUEST);
  }
  const data = await settingsService.restoreBackup(fileName);
  return success(res, { data, message: 'Database restored' });
});

const removeBackup = asyncHandler(async (req, res) => {
  const data = await settingsService.deleteBackup(req.params.file);
  return success(res, { data, message: 'Backup deleted' });
});

module.exports = {
  get,
  updateTimezone,
  updateGoogleJoinApproval,
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  removeBackup,
};
