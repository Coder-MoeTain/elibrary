const { Router } = require('express');
const departmentController = require('../controllers/department.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middlewares/auth.middleware');
const departmentValidation = require('../validations/department.validation');

const router = Router();

router.get('/public', departmentController.listPublic);
router.get('/', authenticate, departmentController.list);
router.get(
  '/:id/dependencies',
  authenticate,
  requireAdmin,
  departmentValidation.idParam,
  validate,
  departmentController.dependencies
);
router.get('/:id', authenticate, departmentValidation.idParam, validate, departmentController.getById);
router.post('/', authenticate, requireAdmin, departmentValidation.create, validate, departmentController.create);
router.put(
  '/:id/restore',
  authenticate,
  requireAdmin,
  departmentValidation.idParam,
  validate,
  departmentController.restore
);
router.put('/:id', authenticate, requireAdmin, departmentValidation.update, validate, departmentController.update);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  departmentValidation.idParam,
  validate,
  departmentController.remove
);

module.exports = router;
