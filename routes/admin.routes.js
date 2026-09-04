/**
 * Admin **accounts** CRUD — mounted at `/api/admins`.
 * Library **member** approve/reject — see `adminPanel.routes.js` (`/api/admin/users/...`).
 */
const { Router } = require('express');
const adminController = require('../controllers/admin.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireSuperAdmin } = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');
const adminValidation = require('../validations/admin.validation');

const router = Router();

router.use(authenticate, roleMiddleware(ROLES.ADMIN), requireSuperAdmin);

router.get('/', adminController.list);
router.get('/:id', adminValidation.idParam, validate, adminController.getById);
router.post('/', adminValidation.create, validate, adminController.create);
router.put('/:id', adminValidation.update, validate, adminController.update);
router.delete('/:id', adminValidation.idParam, validate, adminController.remove);

module.exports = router;
