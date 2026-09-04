const { Router } = require('express');
const categoryController = require('../controllers/category.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middlewares/auth.middleware');
const categoryValidation = require('../validations/category.validation');

const router = Router();

router.get('/', authenticate, categoryController.list);
router.get('/:id', authenticate, categoryValidation.idParam, validate, categoryController.getById);
router.post('/', authenticate, requireAdmin, categoryValidation.create, validate, categoryController.create);
router.put('/:id', authenticate, requireAdmin, categoryValidation.update, validate, categoryController.update);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  categoryValidation.idParam,
  validate,
  categoryController.remove
);

module.exports = router;
