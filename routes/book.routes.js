const { Router } = require('express');
const { param } = require('express-validator');
const bookController = require('../controllers/book.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middlewares/auth.middleware');
const bookValidation = require('../validations/book.validation');
const upload = require('../middlewares/upload.middleware');

const router = Router();

const idAvailability = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

router.get('/', authenticate, bookController.list);
router.get(
  '/:id/availability',
  authenticate,
  idAvailability,
  validate,
  bookController.availability
);
router.get('/:id', authenticate, bookValidation.idParam, validate, bookController.getById);
router.post(
  '/',
  authenticate,
  requireAdmin,
  upload.fields([{ name: 'cover', maxCount: 1 }]),
  bookValidation.create,
  validate,
  bookController.create
);
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  upload.fields([{ name: 'cover', maxCount: 1 }]),
  bookValidation.update,
  validate,
  bookController.update
);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  bookValidation.idParam,
  validate,
  bookController.remove
);

module.exports = router;
