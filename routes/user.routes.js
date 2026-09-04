const { Router } = require('express');
const userController = require('../controllers/user.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireUser, requireSuperAdmin } = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');
const userValidation = require('../validations/user.validation');

const router = Router();

/** Member self-service — must be registered before /:id and before admin-only middleware */
router.get('/me', authenticate, requireUser, userController.getMe);
router.put('/me', authenticate, requireUser, userValidation.updateMe, validate, userController.updateMe);
router.put(
  '/me/password',
  authenticate,
  requireUser,
  userValidation.changeMyPassword,
  validate,
  userController.changeMyPassword
);

router.use(authenticate, roleMiddleware(ROLES.ADMIN));

router.get('/', userController.list);
router.get('/:id', userValidation.idParam, validate, userController.getById);
router.post('/', userValidation.create, validate, userController.create);
router.put('/:id', userValidation.update, validate, userController.update);
router.delete('/:id', requireSuperAdmin, userValidation.idParam, validate, userController.remove);

module.exports = router;
