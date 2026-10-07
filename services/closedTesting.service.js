'use strict';

const { Op } = require('sequelize');
const { ClosedTester, ClosedTesterActivity, User } = require('../models');
const settingsService = require('./settings.service');
const { calendarDate, addCalendarDays, formatDateTime } = require('../utils/timezone');

function shortDayLabel(ymd) {
  const [y, m, d] = String(ymd).slice(0, 10).split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.toLocaleString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function buildDateRange(endYmd, days) {
  const n = Math.max(1, Math.min(60, Number(days) || 14));
  const dates = [];
  for (let i = n - 1; i >= 0; i -= 1) {
    const date = addCalendarDays(endYmd, -i);
    dates.push(date);
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

async function getOverview(days = 14) {
  const timezone = await settingsService.getTimezone();
  const today = calendarDate(timezone);
  const dateKeys = buildDateRange(today, days);
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
  const active14Days = testerRows.filter((t) => t.activeInWindow).length;
  const inactive = invited - active14Days;

  return {
    timezone,
    today,
    days: dateKeys.length,
    dateKeys,
    dayLabels: dateKeys.map(shortDayLabel),
    summary: {
      invited,
      activeToday: activeTodayCount,
      activeInWindow: active14Days,
      inactive,
    },
    daily,
    testers: testerRows,
  };
}

module.exports = {
  recordHeartbeatForUser,
  getOverview,
};
