'use strict';

const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');
const { spawn } = require('child_process');
const { AppSetting, sequelize } = require('../models');
const dbConfig = require('../config/database');
const { setMysqlOffset } = require('../utils/tzState');
const {
  DEFAULT_TIMEZONE,
  TIMEZONE_GROUPS,
  normalizeTimezone,
  isValidTimezone,
  calendarDate,
  offsetLabel,
  formatDateTime,
  mysqlOffset,
  zonedParts,
} = require('../utils/timezone');
const AppError = require('../utils/AppError');
const { HTTP_STATUS } = require('../constants');

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const MAX_BACKUPS = 30;
/** When true, new Google Sign-In users are PENDING until admin Accept. When false, they join as APPROVED. */
const GOOGLE_JOIN_REQUIRE_APPROVAL_KEY = 'google_join_require_approval';
const GOOGLE_JOIN_REQUIRE_APPROVAL_DEFAULT = true;
/** JSON array of user IDs that auto-joined (mode OFF) and have not been acknowledged by admin. */
const UNSEEN_AUTO_JOIN_IDS_KEY = 'unseen_auto_join_user_ids';
const MAX_UNSEEN_AUTO_JOINS = 200;

function currentDb() {
  const env = (process.env.NODE_ENV || 'development').trim();
  return dbConfig[env] || dbConfig.development;
}

async function getSetting(key, fallback = '') {
  try {
    const row = await AppSetting.findByPk(key);
    if (!row) return fallback;
    return String(row.settingValue || fallback);
  } catch {
    return fallback;
  }
}

async function setSetting(key, value) {
  const [row] = await AppSetting.findOrCreate({
    where: { settingKey: key },
    defaults: { settingKey: key, settingValue: String(value) },
  });
  if (row.settingValue !== String(value)) {
    await row.update({ settingValue: String(value) });
  }
  return row;
}

async function getTimezone() {
  return normalizeTimezone(await getSetting('timezone', DEFAULT_TIMEZONE));
}

function parseBoolSetting(raw, fallback) {
  const value = String(raw ?? '').trim().toLowerCase();
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') return true;
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') return false;
  return fallback;
}

async function getGoogleJoinRequireApproval() {
  const raw = await getSetting(
    GOOGLE_JOIN_REQUIRE_APPROVAL_KEY,
    GOOGLE_JOIN_REQUIRE_APPROVAL_DEFAULT ? 'true' : 'false'
  );
  return parseBoolSetting(raw, GOOGLE_JOIN_REQUIRE_APPROVAL_DEFAULT);
}

async function updateGoogleJoinRequireApproval(enabled) {
  const next = Boolean(enabled);
  await setSetting(GOOGLE_JOIN_REQUIRE_APPROVAL_KEY, next ? 'true' : 'false');
  return getPublicSettings();
}

function parseIdList(raw) {
  try {
    const parsed = JSON.parse(String(raw || '[]'));
    if (!Array.isArray(parsed)) return [];
    return [
      ...new Set(
        parsed
          .map((id) => Number(id))
          .filter((id) => Number.isFinite(id) && id > 0),
      ),
    ];
  } catch {
    return [];
  }
}

async function getUnseenAutoJoinIds() {
  return parseIdList(await getSetting(UNSEEN_AUTO_JOIN_IDS_KEY, '[]'));
}

async function enqueueAutoJoinNotice(userId) {
  const id = Number(userId);
  if (!Number.isFinite(id) || id < 1) return getUnseenAutoJoinIds();
  const ids = await getUnseenAutoJoinIds();
  if (!ids.includes(id)) ids.push(id);
  const trimmed = ids.slice(-MAX_UNSEEN_AUTO_JOINS);
  await setSetting(UNSEEN_AUTO_JOIN_IDS_KEY, JSON.stringify(trimmed));
  return trimmed;
}

async function clearUnseenAutoJoinNotices() {
  await setSetting(UNSEEN_AUTO_JOIN_IDS_KEY, '[]');
  return getPublicSettings();
}

async function getPublicSettings() {
  const timezone = await getTimezone();
  const googleJoinRequireApproval = await getGoogleJoinRequireApproval();
  const unseenAutoJoinIds = await getUnseenAutoJoinIds();
  return {
    timezone,
    offset: offsetLabel(timezone),
    now: formatDateTime(new Date(), timezone),
    today: calendarDate(timezone),
    groups: TIMEZONE_GROUPS,
    googleJoinRequireApproval,
    unseenAutoJoinIds,
    unseenAutoJoinCount: unseenAutoJoinIds.length,
  };
}

async function syncMysqlTimezone(explicitTz) {
  const timezone = normalizeTimezone(explicitTz || (await getTimezone()));
  const offset = mysqlOffset(timezone);
  setMysqlOffset(offset);
  try {
    await sequelize.query('SET time_zone = :offset', { replacements: { offset } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[settings] SET time_zone failed:', err.message);
  }
  return { timezone, offset };
}

async function updateTimezone(raw) {
  if (!isValidTimezone(raw)) {
    throw new AppError('Choose a valid timezone from the list.', HTTP_STATUS.UNPROCESSABLE);
  }
  const timezone = normalizeTimezone(raw);
  await setSetting('timezone', timezone);
  await syncMysqlTimezone(timezone);
  return getPublicSettings();
}

function backupDir() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  return BACKUP_DIR;
}

function safeBackupName(name) {
  const base = path.basename(String(name || ''));
  if (!/^elibrary-\d{8}-\d{6}\.sql$/.test(base)) return '';
  return base;
}

function runCommand(command, args, { env, stdinPath, stdoutPath } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: { ...process.env, ...(env || {}) },
      windowsHide: true,
      stdio: [stdinPath ? 'pipe' : 'ignore', stdoutPath ? 'pipe' : 'ignore', 'pipe'],
    });
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
      if (stderr.length > 8000) stderr = stderr.slice(-8000);
    });
    child.on('error', (err) => {
      reject(new Error(`${command} failed to start: ${err.message}`));
    });

    if (stdoutPath) {
      const out = fs.createWriteStream(stdoutPath);
      child.stdout.pipe(out);
      out.on('error', reject);
    }
    if (stdinPath) {
      const input = fs.createReadStream(stdinPath);
      input.pipe(child.stdin);
      input.on('error', reject);
    }

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr.trim() || `${command} exited with code ${code}`));
    });
  });
}

function stampName(timezone) {
  const parts = zonedParts(new Date(), timezone);
  const y = String(parts.year);
  const m = String(parts.month).padStart(2, '0');
  const d = String(parts.day).padStart(2, '0');
  const hh = String(parts.hour).padStart(2, '0');
  const mm = String(parts.minute).padStart(2, '0');
  const ss = String(parts.second).padStart(2, '0');
  return `elibrary-${y}${m}${d}-${hh}${mm}${ss}.sql`;
}

async function pruneOldBackups() {
  const dir = backupDir();
  const files = (await fsPromises.readdir(dir))
    .filter((name) => name.endsWith('.sql'))
    .map((name) => ({ name, full: path.join(dir, name) }));
  files.sort((a, b) => fs.statSync(b.full).mtimeMs - fs.statSync(a.full).mtimeMs);
  for (const extra of files.slice(MAX_BACKUPS)) {
    await fsPromises.rm(extra.full, { force: true });
  }
}

async function createBackup() {
  const db = currentDb();
  if (!db?.database || !db?.username) {
    throw new AppError('Database is not configured.', HTTP_STATUS.INTERNAL);
  }
  const timezone = await getTimezone();
  const fileName = stampName(timezone);
  const dest = path.join(backupDir(), fileName);
  const args = [
    `-h${db.host}`,
    `-P${db.port || 3306}`,
    `-u${db.username}`,
    '--single-transaction',
    '--routines',
    '--triggers',
    '--default-character-set=utf8mb4',
    db.database,
  ];
  try {
    await runCommand('mysqldump', args, {
      env: { MYSQL_PWD: db.password || '' },
      stdoutPath: dest,
    });
  } catch (err) {
    await fsPromises.rm(dest, { force: true });
    throw new AppError(
      `Backup failed. Install mysql-client (mysqldump) on the server. ${err.message}`,
      HTTP_STATUS.BAD_GATEWAY
    );
  }
  await pruneOldBackups();
  const stat = await fsPromises.stat(dest);
  return {
    fileName,
    size: stat.size,
    createdAt: formatDateTime(stat.mtime, timezone),
  };
}

async function listBackups() {
  const timezone = await getTimezone();
  const dir = backupDir();
  const names = await fsPromises.readdir(dir).catch(() => []);
  const rows = [];
  for (const name of names) {
    if (!safeBackupName(name)) continue;
    const full = path.join(dir, name);
    const stat = await fsPromises.stat(full);
    rows.push({
      fileName: name,
      size: stat.size,
      createdAt: formatDateTime(stat.mtime, timezone),
      createdAtMs: stat.mtimeMs,
    });
  }
  rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
  return rows.map(({ createdAtMs, ...rest }) => rest);
}

function backupFilePath(fileName) {
  const safe = safeBackupName(decodeURIComponent(String(fileName || '')));
  if (!safe) throw new AppError('Invalid backup file name.', HTTP_STATUS.BAD_REQUEST);
  const full = path.join(backupDir(), safe);
  if (!fs.existsSync(full)) throw new AppError('Backup not found.', HTTP_STATUS.NOT_FOUND);
  return full;
}

async function restoreBackup(fileName) {
  const db = currentDb();
  const full = backupFilePath(fileName);
  const args = [
    `-h${db.host}`,
    `-P${db.port || 3306}`,
    `-u${db.username}`,
    db.database,
  ];
  try {
    await runCommand('mysql', args, {
      env: { MYSQL_PWD: db.password || '' },
      stdinPath: full,
    });
  } catch (err) {
    throw new AppError(
      `Restore failed. Install mysql-client on the server. ${err.message}`,
      HTTP_STATUS.BAD_GATEWAY
    );
  }
  return { fileName: path.basename(full), restored: true };
}

async function importUploadedSql(tempPath) {
  const timezone = await getTimezone();
  const dest = path.join(backupDir(), stampName(timezone));
  await fsPromises.copyFile(tempPath, dest);
  await fsPromises.rm(tempPath, { force: true });
  await restoreBackup(path.basename(dest));
  await pruneOldBackups();
  return { fileName: path.basename(dest), restored: true };
}

async function deleteBackup(fileName) {
  const full = backupFilePath(fileName);
  await fsPromises.rm(full, { force: true });
  return { deleted: true };
}

module.exports = {
  getTimezone,
  getPublicSettings,
  updateTimezone,
  getGoogleJoinRequireApproval,
  updateGoogleJoinRequireApproval,
  getUnseenAutoJoinIds,
  enqueueAutoJoinNotice,
  clearUnseenAutoJoinNotices,
  syncMysqlTimezone,
  createBackup,
  listBackups,
  backupFilePath,
  restoreBackup,
  importUploadedSql,
  deleteBackup,
  BACKUP_DIR,
};
