const { Router } = require('express');
const rentController = require('../controllers/rent.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireAdmin, requireAuthPrincipal } = require('../middlewares/auth.middleware');
const rentValidation = require('../validations/rent.validation');

const router = Router();

router.post('/', authenticate, requireAuthPrincipal, rentValidation.borrow, validate, rentController.borrow);
router.patch(
  '/:id/return',
  authenticate,
  requireAuthPrincipal,
  rentValidation.returnBook,
  validate,
  rentController.returnBook
);
router.get('/', authenticate, requireAuthPrincipal, rentController.list);
router.get('/:id', authenticate, requireAuthPrincipal, rentValidation.idParam, validate, rentController.getById);
router.put('/:id', authenticate, requireAdmin, rentValidation.update, validate, rentController.update);
router.delete('/:id', authenticate, requireAdmin, rentValidation.idParam, validate, rentController.remove);

module.exports = router;
