const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate } = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');
const { idParam } = require('../validations/common.validation');

const router = Router();

router.use(authenticate, roleMiddleware(ROLES.ADMIN));

router.get('/profile', adminController.profile);
router.put('/profile', adminController.updateProfile);
router.put('/change-password', adminController.changePassword);

router.put(
  '/users/:id/approve',
  idParam,
  validate,
  adminController.approveUser
);
router.put(
  '/users/:id/reject',
  idParam,
  validate,
  adminController.rejectUser
);

module.exports = router;
