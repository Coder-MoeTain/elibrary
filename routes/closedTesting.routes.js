'use strict';

const { Router } = require('express');
const closedTestingController = require('../controllers/closedTesting.controller');
const {
  authenticate,
  requireAdmin,
  requireUser,
} = require('../middlewares/auth.middleware');

const router = Router();

router.post('/heartbeat', authenticate, requireUser, closedTestingController.heartbeat);
router.get('/overview', authenticate, requireAdmin, closedTestingController.overview);

module.exports = router;
