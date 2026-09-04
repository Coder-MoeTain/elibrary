const { Router } = require('express');

const router = Router();

router.use('/auth', require('./auth.routes'));
router.use('/categories', require('./category.routes'));
router.use('/authors', require('./author.routes'));
router.use('/books', require('./book.routes'));
router.use('/ebooks', require('./ebook.routes'));
router.use('/departments', require('./department.routes'));
router.use('/users', require('./user.routes'));
router.use('/admins', require('./admin.routes'));
router.use('/admin', require('./adminPanel.routes'));
router.use('/dashboard', require('./dashboard.routes'));
router.use('/rent', require('./rent.routes'));
router.use('/favorites', require('./favorite.routes'));

module.exports = router;
