const { Router } = require('express');
const ebookController = require('../controllers/ebook.controller');
const summarizeController = require('../controllers/summarizeController');
const { validate } = require('../middlewares/validation.middleware');
const {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  requireUser,
  requireAuthPrincipal,
} = require('../middlewares/auth.middleware');
const { summarizeLimiter } = require('../middlewares/rateLimit.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');
const ebookValidation = require('../validations/ebook.validation');
const upload = require('../middlewares/upload.middleware');

const router = Router();

router.get('/', authenticate, ebookController.list);
router.get(
  '/recommended',
  authenticate,
  roleMiddleware(ROLES.MEMBER),
  requireUser,
  ebookController.recommended
);
router.get('/most-popular', authenticate, ebookController.mostPopular);
router.get('/new-uploads', authenticate, ebookController.newUploads);
router.get(
  '/:id/pdf',
  authenticate,
  requireAuthPrincipal,
  ebookValidation.idParam,
  validate,
  ebookController.downloadPdf
);
router.get(
  '/:id/summary',
  authenticate,
  requireAuthPrincipal,
  summarizeLimiter,
  ebookValidation.summarize,
  validate,
  summarizeController.summarizePDF
);
router.get('/:id', authenticate, ebookValidation.idParam, validate, ebookController.getById);
router.post(
  '/:id/read',
  authenticate,
  requireAuthPrincipal,
  ebookValidation.idParam,
  validate,
  ebookController.trackRead
);
router.post(
  '/:id/summarize',
  authenticate,
  requireAuthPrincipal,
  summarizeLimiter,
  ebookValidation.summarize,
  validate,
  summarizeController.summarizePDF
);
router.post(
  '/',
  authenticate,
  requireAdmin,
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  ebookValidation.create,
  validate,
  ebookController.create
);
router.put(
  '/:id',
  authenticate,
  requireAdmin,
  upload.fields([
    { name: 'pdf', maxCount: 1 },
    { name: 'cover', maxCount: 1 },
  ]),
  ebookValidation.update,
  validate,
  ebookController.update
);
router.delete(
  '/:id',
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  ebookValidation.idParam,
  validate,
  ebookController.remove
);

module.exports = router;
