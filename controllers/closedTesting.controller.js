'use strict';

const closedTestingService = require('../services/closedTesting.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../helpers/response.helper');

const heartbeat = asyncHandler(async (req, res) => {
  const data = await closedTestingService.recordHeartbeatForUser(req.user.id);
  return success(res, { data, message: data.matched ? 'Activity recorded' : 'Not a closed tester' });
});

const overview = asyncHandler(async (req, res) => {
  const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
  const data = await closedTestingService.getOverview({ startDate });
  return success(res, { data });
});

module.exports = {
  heartbeat,
  overview,
};
