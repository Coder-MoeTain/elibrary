'use strict';

const { Op } = require('sequelize');
const { ClosedTester, ClosedTesterActivity, User } = require('../models');
const settingsService = require('./settings.service');
const { calendarDate, addCalendarDays, formatDateTime } = require('../utils/timezone');

/** Closed testing timeline starts here and grows forward to today (no fixed end). */
const DEFAULT_START_DATE = '2026-10-07';
/** Safety cap so the grid cannot grow without bound if left for years. */
const MAX_DAYS = 730;

function shortDayLabel(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function resolveStartDate(explicit) {
  const fromEnv = String(process.env.CLOSED_TESTING_START_DATE || '').trim();
  const raw = String(explicit || fromEnv || DEFAULT_START_DATE).trim().slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  return DEFAULT_START_DATE;
}

/** Inclusive range from startYmd → endYmd (forward). */
function buildForwardRange(startYmd, endYmd) {
  let start = startYmd;
  let end = endYmd;
  if (start > end) {
    // Before start day: show only today once it arrives; until then show start alone.
    return [start];
  }

  const dates = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < MAX_DAYS) {
    dates.push(cursor);
    cursor = addCalendarDays(cursor, 1);
    guard += 1;
  }
  return dates;
}

async function recordHeartbeatForUser(userId) {
  const user = await User.unscoped().findOne({
    where: { usersId: userId, isDeleted: false },
    attributes: ['usersId', 'email'],
  });
  const email = String(user?.email || '')
    .trim()
    .toLowerCase();
  if (!email) {
    return { matched: false, reason: 'no_email' };
  }

  const tester = await ClosedTester.findOne({ where: { email } });
  if (!tester) {
    return { matched: false, reason: 'not_tester' };
  }

  const timezone = await settingsService.getTimezone();
  const today = calendarDate(timezone);
  const now = new Date();

  tester.lastActiveAt = now;
  tester.status = 'active';
  await tester.save();

  const [activity, created] = await ClosedTesterActivity.findOrCreate({
    where: { closedTesterId: tester.id, activeDate: today },
    defaults: { closedTesterId: tester.id, activeDate: today },
  });

  return {
    matched: true,
    shortName: tester.shortName,
    email: tester.email,
    activeDate: today,
    firstActivityToday: created,
    activityId: activity.id,
  };
}

async function getOverview(options = {}) {
  const timezone = await settingsService.getTimezone();
  const today = calendarDate(timezone);
  const startDate = resolveStartDate(options.startDate);
  const dateKeys = buildForwardRange(startDate, today);
  const rangeStart = dateKeys[0];

  const testers = await ClosedTester.findAll({
    order: [
      ['shortName', 'ASC'],
      ['email', 'ASC'],
    ],
  });

  const activities = await ClosedTesterActivity.findAll({
    where: {
      activeDate: { [Op.between]: [rangeStart, today] },
    },
    attributes: ['closedTesterId', 'activeDate'],
  });

  const activeByTester = new Map();
  for (const row of activities) {
    const tid = row.closedTesterId;
    if (!activeByTester.has(tid)) activeByTester.set(tid, new Set());
    activeByTester.get(tid).add(String(row.activeDate).slice(0, 10));
  }

  const dailyCounts = Object.fromEntries(dateKeys.map((d) => [d, 0]));
  const testerRows = testers.map((t) => {
    const set = activeByTester.get(t.id) || new Set();
    const dayFlags = dateKeys.map((d) => set.has(d));
    for (const d of dateKeys) {
      if (set.has(d)) dailyCounts[d] += 1;
    }
    const activeToday = set.has(today);
    const activeInWindow = dayFlags.some(Boolean);
    return {
      id: t.id,
      email: t.email,
      shortName: t.shortName,
      status: t.status,
      lastActiveAt: t.lastActiveAt,
      lastActiveLabel: t.lastActiveAt ? formatDateTime(t.lastActiveAt, timezone) : null,
      activeToday,
      activeInWindow,
      days: dayFlags,
    };
  });

  const daily = dateKeys.map((date) => ({
    date,
    label: shortDayLabel(date),
    active: dailyCounts[date] || 0,
  }));

  const invited = testers.length;
  const activeTodayCount = testerRows.filter((t) => t.activeToday).length;
  const activeSinceStart = testerRows.filter((t) => t.activeInWindow).length;
  const inactive = invited - activeSinceStart;

  return {
    timezone,
    today,
    startDate,
    days: dateKeys.length,
    dateKeys,
    dayLabels: dateKeys.map(shortDayLabel),
    summary: {
      invited,
      activeToday: activeTodayCount,
      activeInWindow: activeSinceStart,
      inactive,
    },
    daily,
    testers: testerRows,
  };
}

module.exports = {
  recordHeartbeatForUser,
  getOverview,
  DEFAULT_START_DATE,
};
