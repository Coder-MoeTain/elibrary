const { AuditLog, Admin } = require('../models');
const { getTimezone } = require('./settings.service');
const { normalizeTimezone, zonedParts } = require('../utils/timezone');

async function resolveActorName(actorId, fallback) {
  if (fallback) return String(fallback).slice(0, 255);
  if (!actorId) return 'system';
  const admin = await Admin.unscoped().findByPk(actorId, {
    attributes: ['adminName'],
  });
  return admin?.adminName ? String(admin.adminName).slice(0, 255) : `admin#${actorId}`;
}

/** Format like `2026-10-20 14:23` in the library timezone. */
function formatAuditWhen(value, timeZone) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  const p = zonedParts(d, normalizeTimezone(timeZone));
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.year}-${pad(p.month)}-${pad(p.day)} ${pad(p.hour)}:${pad(p.minute)}`;
}

/**
 * Append-only audit entry. Never throws to callers — logging must not break the main action.
 */
async function record({
  actorId = null,
  actorName = null,
  action,
  target = null,
  result = 'success',
  details = null,
  ip = null,
} = {}) {
  if (!action) return null;
  try {
    const name = await resolveActorName(actorId, actorName);
    const row = await AuditLog.create({
      actorId: actorId != null ? Number(actorId) : null,
      actorName: name,
      action: String(action).slice(0, 64),
      target: target != null && String(target).trim() ? String(target).slice(0, 255) : null,
      result: String(result || 'success').slice(0, 32),
      details: details != null ? String(details).slice(0, 4000) : null,
      ip: ip != null ? String(ip).slice(0, 64) : null,
    });
    return row;
  } catch (err) {
    console.error('[auditLog] record failed:', err?.message || err);
    return null;
  }
}

function clientIp(req) {
  const forwarded = req?.headers?.['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  return req?.ip || req?.socket?.remoteAddress || null;
}

async function recordFromRequest(req, { action, target, result = 'success', details, actorName } = {}) {
  return record({
    actorId: req?.user?.id ?? null,
    actorName: actorName ?? null,
    action,
    target,
    result,
    details,
    ip: clientIp(req),
  });
}

async function list({ limit = 100, offset = 0 } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  const safeOffset = Math.max(Number(offset) || 0, 0);
  const timezone = await getTimezone();

  const { rows, count } = await AuditLog.findAndCountAll({
    order: [['created_at', 'DESC']],
    limit: safeLimit,
    offset: safeOffset,
  });

  return {
    total: count,
    items: rows.map((row) => ({
      id: row.id,
      actorId: row.actorId,
      actorName: row.actorName,
      action: row.action,
      target: row.target,
      result: row.result || 'success',
      details: row.details,
      ip: row.ip,
      createdAt: formatAuditWhen(row.createdAt ?? row.get?.('created_at'), timezone),
    })),
  };
}

module.exports = {
  record,
  recordFromRequest,
  list,
  clientIp,
};
