const dashboardService = require('../services/dashboard.service');
const asyncHandler = require('../utils/asyncHandler');
const { success } = require('../helpers/response.helper');

const summary = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardSummary();
  return success(res, { data });
});

const stats = asyncHandler(async (req, res) => {
  const data = await dashboardService.getDashboardStats();
  return success(res, { data });
});

const rentalsMonthly = asyncHandler(async (req, res) => {
  const data = await dashboardService.getMonthlyRentalsSeries();
  return success(res, { data });
});

const booksCategories = asyncHandler(async (req, res) => {
  const data = await dashboardService.getBooksByCategory();
  return success(res, { data });
});

const ebooksCategories = asyncHandler(async (req, res) => {
  const data = await dashboardService.getEbooksByCategory();
  return success(res, { data });
});

const booksPopular = asyncHandler(async (req, res) => {
  const data = await dashboardService.getPopularBooks();
  return success(res, { data });
});

const rentalsOverdue = asyncHandler(async (req, res) => {
  const data = await dashboardService.getOverdueRentals();
  return success(res, { data });
});

const usersGrowth = asyncHandler(async (req, res) => {
  const data = await dashboardService.getUserGrowthMonthly();
  return success(res, { data });
});

const ebooksPopular = asyncHandler(async (req, res) => {
  const data = await dashboardService.getPopularEbooks();
  return success(res, { data });
});

module.exports = {
  summary,
  stats,
  rentalsMonthly,
  booksCategories,
  ebooksCategories,
  booksPopular,
  ebooksPopular,
  rentalsOverdue,
  usersGrowth,
};
