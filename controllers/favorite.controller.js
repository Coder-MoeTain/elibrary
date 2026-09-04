const asyncHandler = require('../utils/asyncHandler');
const { Favorite, EBook, Author, Category } = require('../models');
const { success } = require('../helpers/response.helper');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');

const toggleFavorite = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const ebookId = Number(req.body.ebookId);
  if (!Number.isInteger(ebookId) || ebookId < 1) {
    throw new AppError('ebookId must be a positive integer', HTTP_STATUS.UNPROCESSABLE);
  }

  const ebook = await EBook.findByPk(ebookId);
  if (!ebook) {
    throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }

  const existing = await Favorite.findOne({
    where: { Users_users_id: userId, Ebooks_ebook_id: ebookId },
  });

  if (existing) {
    await existing.destroy();
    return success(res, { data: { favorited: false }, message: 'Removed from favorites' });
  }

  await Favorite.create({
    Users_users_id: userId,
    Ebooks_ebook_id: ebookId,
  });

  return success(res, { data: { favorited: true }, message: 'Added to favorites' });
});

const getFavorites = asyncHandler(async (req, res) => {
  const userId = req.user.id;
  const list = await Favorite.findAll({
    where: { Users_users_id: userId },
    include: [
      {
        model: EBook,
        as: 'ebook',
        include: [
          { model: Author, as: 'author' },
          { model: Category, as: 'category' },
        ],
      },
    ],
    order: [['favoriteId', 'DESC']],
  });
  return success(res, { data: list });
});

module.exports = {
  toggleFavorite,
  getFavorites,
};

