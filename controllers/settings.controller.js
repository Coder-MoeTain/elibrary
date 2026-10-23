const settingsService = require('../services/settings.service');
const auditLogService = require('../services/auditLog.service');
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
  await auditLogService.recordFromRequest(req, {
    action: 'timezone_update',
    target: data?.timezone || req.body?.timezone,
    result: 'success',
    details: `Library timezone set to ${data?.timezone || req.body?.timezone}`,
  });
  return success(res, { data, message: 'Timezone updated' });
});

const updateGoogleJoinApproval = asyncHandler(async (req, res) => {
  const raw = req.body?.googleJoinRequireApproval ?? req.body?.enabled;
  if (typeof raw !== 'boolean') {
    throw new AppError('googleJoinRequireApproval must be true or false.', HTTP_STATUS.BAD_REQUEST);
  }
  const data = await settingsService.updateGoogleJoinRequireApproval(raw);
  await auditLogService.recordFromRequest(req, {
    action: 'google_join_approval_update',
    target: 'googleJoinRequireApproval',
    result: 'success',
    details: raw
      ? 'Google sign-ins require admin approval'
      : 'Google sign-ins join immediately',
  });
  return success(res, {
    data,
    message: raw
      ? 'New Google sign-ins will stay pending until approved'
      : 'New Google sign-ins can join immediately',
  });
});

const updateEbooksEnabled = asyncHandler(async (req, res) => {
  const raw = req.body?.ebooksEnabled ?? req.body?.enabled;
  if (typeof raw !== 'boolean') {
    throw new AppError('ebooksEnabled must be true or false.', HTTP_STATUS.BAD_REQUEST);
  }
  const data = await settingsService.updateEbooksEnabled(raw);
  await auditLogService.recordFromRequest(req, {
    action: 'ebooks_enabled_update',
    target: 'ebooksEnabled',
    result: 'success',
    details: raw ? 'Mobile E-Books catalog enabled' : 'Mobile E-Books set to Coming Soon',
  });
  return success(res, {
    data,
    message: raw
      ? 'Mobile app will show the E-Books catalog'
      : 'Mobile app will show E-Books as Coming Soon',
  });
});

const clearUserJoinNotices = asyncHandler(async (req, res) => {
  const data = await settingsService.clearUnseenAutoJoinNotices();
  return success(res, { data, message: 'Join notifications cleared' });
});

const createBackup = asyncHandler(async (req, res) => {
  const data = await settingsService.createBackup();
  await auditLogService.recordFromRequest(req, {
    action: 'backup_create',
    target: data?.fileName,
    result: 'success',
    details: `Created database backup ${data?.fileName}`,
  });
  return success(res, { data, message: 'Backup created' });
});

const listBackups = asyncHandler(async (req, res) => {
  const data = await settingsService.listBackups();
  return success(res, { data });
});

const downloadBackup = asyncHandler(async (req, res) => {
  const full = settingsService.backupFilePath(req.params.file);
  await auditLogService.recordFromRequest(req, {
    action: 'backup_download',
    target: req.params.file,
    result: 'success',
    details: `Downloaded backup ${req.params.file}`,
  });
  res.setHeader('Content-Type', 'application/sql');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.file}"`);
  return res.sendFile(full);
});

const restoreBackup = asyncHandler(async (req, res) => {
  if (req.file?.path) {
    const data = await settingsService.importUploadedSql(req.file.path);
    await auditLogService.recordFromRequest(req, {
      action: 'backup_restore',
      target: req.file.originalname || 'upload',
      result: 'success',
      details: 'Restored database from uploaded .sql file',
    });
    return success(res, { data, message: 'Database restored from upload' });
  }
  const fileName = req.body?.fileName || req.params.file;
  if (!fileName) {
    throw new AppError('Choose a backup file to restore.', HTTP_STATUS.BAD_REQUEST);
  }
  const data = await settingsService.restoreBackup(fileName);
  await auditLogService.recordFromRequest(req, {
    action: 'backup_restore',
    target: fileName,
    result: 'success',
    details: `Restored database from ${fileName}`,
  });
  return success(res, { data, message: 'Database restored' });
});

const removeBackup = asyncHandler(async (req, res) => {
  const data = await settingsService.deleteBackup(req.params.file);
  await auditLogService.recordFromRequest(req, {
    action: 'backup_delete',
    target: req.params.file,
    result: 'success',
    details: `Deleted backup ${req.params.file}`,
  });
  return success(res, { data, message: 'Backup deleted' });
});

const listAuditLogs = asyncHandler(async (req, res) => {
  const data = await auditLogService.list({
    limit: req.query?.limit,
    offset: req.query?.offset,
  });
  return success(res, { data });
});

module.exports = {
  get,
  updateTimezone,
  updateGoogleJoinApproval,
  updateEbooksEnabled,
  clearUserJoinNotices,
  createBackup,
  listBackups,
  downloadBackup,
  restoreBackup,
  removeBackup,
  listAuditLogs,
};
