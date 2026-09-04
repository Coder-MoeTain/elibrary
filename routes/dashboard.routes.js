const { Router } = require('express');
const dashboardController = require('../controllers/dashboard.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');

const router = Router();

router.use(authenticate, roleMiddleware(ROLES.ADMIN));

router.get('/summary', dashboardController.summary);
router.get('/stats', dashboardController.stats);

router.get('/rentals/monthly', dashboardController.rentalsMonthly);
router.get('/rentals/overdue', dashboardController.rentalsOverdue);
router.get('/books/categories', dashboardController.booksCategories);
router.get('/ebooks/categories', dashboardController.ebooksCategories);
router.get('/books/popular', dashboardController.booksPopular);
router.get('/ebooks/popular', dashboardController.ebooksPopular);
router.get('/users/growth', dashboardController.usersGrowth);

module.exports = router;
