const { param } = require('express-validator');

const idParam = [param('id').isInt({ min: 1 }).withMessage('id must be a positive integer')];

module.exports = { idParam };
