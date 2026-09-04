const { Router } = require('express');
const authorController = require('../controllers/author.controller');
const { validate } = require('../middlewares/validation.middleware');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');
const authorValidation = require('../validations/author.validation');

const router = Router();

router.get('/', authenticate, authorController.list);
router.get('/:id', authenticate, authorValidation.idParam, validate, authorController.getById);
router.post('/', authenticate, requireAdmin, authorValidation.create, validate, authorController.create);
router.put('/:id', authenticate, requireAdmin, authorValidation.update, validate, authorController.update);
router.delete('/:id', authenticate, requireAdmin, authorValidation.idParam, validate, authorController.remove);

module.exports = router;
