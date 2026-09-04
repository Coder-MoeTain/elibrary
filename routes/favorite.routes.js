const { Router } = require('express');
const favoriteController = require('../controllers/favorite.controller');
const { authenticate } = require('../middlewares/auth.middleware');
const roleMiddleware = require('../middlewares/role.middleware');
const { ROLES } = require('../constants');

const router = Router();

router.use(authenticate, roleMiddleware(ROLES.MEMBER));
router.post('/toggle', favoriteController.toggleFavorite);
router.get('/', favoriteController.getFavorites);

module.exports = router;

