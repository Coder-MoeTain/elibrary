const { Router } = require('express');
const authController = require('../controllers/auth.controller');
const { validate } = require('../middlewares/validation.middleware');
const authValidation = require('../validations/auth.validation');
const { authLimiter } = require('../middlewares/rateLimit.middleware');
const { authenticate, requireAdmin } = require('../middlewares/auth.middleware');

const router = Router();

router.use(authLimiter);

router.post('/admin/login', authValidation.adminLogin, validate, authController.adminLogin);
router.post('/admin/logout', authenticate, requireAdmin, authController.adminLogout);
router.post('/user/login', authValidation.userLogin, validate, authController.userLogin);
router.post('/register', authValidation.register, validate, authController.register);
router.post('/google', authValidation.googleSignIn, validate, authController.googleSignIn);
router.post('/apple', authValidation.appleSignIn, validate, authController.appleSignIn);

module.exports = router;
