'use strict';

const DEFAULT_TIMEZONE = 'Asia/Yangon';

const TIMEZONE_GROUPS = [
  { region: 'UTC', zones: ['UTC'] },
  {
    region: 'Asia',
    zones: [
      'Asia/Yangon',
      'Asia/Bangkok',
      'Asia/Jakarta',
      'Asia/Singapore',
      'Asia/Kuala_Lumpur',
      'Asia/Ho_Chi_Minh',
      'Asia/Dhaka',
      'Asia/Kolkata',
      'Asia/Kathmandu',
      'Asia/Karachi',
      'Asia/Dubai',
      'Asia/Shanghai',
      'Asia/Hong_Kong',
      'Asia/Taipei',
      'Asia/Seoul',
      'Asia/Tokyo',
      'Asia/Manila',
    ],
  },
  {
    region: 'Europe',
    zones: [
      'Europe/London',
      'Europe/Paris',
      'Europe/Berlin',
      'Europe/Amsterdam',
      'Europe/Rome',
      'Europe/Madrid',
      'Europe/Warsaw',
      'Europe/Athens',
      'Europe/Istanbul',
      'Europe/Moscow',
    ],
  },
  {
    region: 'Americas',
    zones: [
      'America/New_York',
      'America/Chicago',
      'America/Denver',
      'America/Los_Angeles',
      'America/Toronto',
      'America/Mexico_City',
      'America/Sao_Paulo',
    ],
  },
  {
    region: 'Africa / Pacific',
    zones: ['Africa/Cairo', 'Africa/Johannesburg', 'Australia/Sydney', 'Pacific/Auckland'],
  },
];

const ALLOWED = new Set(TIMEZONE_GROUPS.flatMap((g) => g.zones));

function isValidTimezone(value) {
  const tz = String(value || '').trim();
  if (!tz || !ALLOWED.has(tz)) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function normalizeTimezone(value) {
  const tz = String(value || '').trim();
  return isValidTimezone(tz) ? tz : DEFAULT_TIMEZONE;
}

function zonedParts(date, timeZone) {
  const tz = normalizeTimezone(timeZone);
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const map = {};
  for (const part of dtf.formatToParts(date)) {
    if (part.type !== 'literal') map[part.type] = part.value;
  }
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour === '24' ? 0 : map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function calendarDate(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  const mm = String(p.month).padStart(2, '0');
  const dd = String(p.day).padStart(2, '0');
  return `${p.year}-${mm}-${dd}`;
}

function monthStartDate(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-01`;
}

function monthKey(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}`;
}

function offsetLabel(timeZone, date = new Date()) {
  const tz = normalizeTimezone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'shortOffset',
  }).formatToParts(date);
  const name = parts.find((p) => p.type === 'timeZoneName')?.value || '';
  return name.replace('GMT', 'UTC');
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

function mysqlOffset(timeZone, date = new Date()) {
  const tz = normalizeTimezone(timeZone);
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    timeZoneName: 'longOffset',
  }).formatToParts(date);
  const raw = parts.find((p) => p.type === 'timeZoneName')?.value || 'GMT+00:00';
  const m = raw.match(/([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!m) return '+00:00';
  return `${m[1]}${String(m[2]).padStart(2, '0')}:${m[3] || '00'}`;
}

function addCalendarDays(ymd, days) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + Number(days || 0)));
  return `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}-${pad2(dt.getUTCDate())}`;
}

function rollingTwelveMonths(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const dt = new Date(Date.UTC(p.year, p.month - 1 - i, 1));
    out.push({
      key: `${dt.getUTCFullYear()}-${pad2(dt.getUTCMonth() + 1)}`,
      label: dt.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
    });
  }
  return out;
}

function zonedWallTimeToUtc(timeZone, year, month, day, hour = 0, minute = 0, second = 0) {
  const utc = Date.UTC(year, month - 1, day, hour, minute, second);
  const zoned = zonedParts(new Date(utc), timeZone);
  const zonedAsUtc = Date.UTC(
    zoned.year,
    zoned.month - 1,
    zoned.day,
    zoned.hour,
    zoned.minute,
    zoned.second
  );
  return new Date(utc + (utc - zonedAsUtc));
}

function startOfZonedMonth(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return zonedWallTimeToUtc(timeZone, p.year, p.month, 1, 0, 0, 0);
}

function wallDateTime(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`;
}

function startOfMonthWall(timeZone, date = new Date()) {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${pad2(p.month)}-01 00:00:00`;
}

function formatDateTime(value, timeZone) {
  if (value == null || value === '') return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizeTimezone(timeZone),
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

function formatTime(date, timeZone) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: normalizeTimezone(timeZone),
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date instanceof Date ? date : new Date(date));
}

module.exports = {
  DEFAULT_TIMEZONE,
  TIMEZONE_GROUPS,
  ALLOWED,
  isValidTimezone,
  normalizeTimezone,
  zonedParts,
  calendarDate,
  monthStartDate,
  monthKey,
  offsetLabel,
  mysqlOffset,
  addCalendarDays,
  rollingTwelveMonths,
  zonedWallTimeToUtc,
  startOfZonedMonth,
  wallDateTime,
  startOfMonthWall,
  formatDateTime,
  formatTime,
};
