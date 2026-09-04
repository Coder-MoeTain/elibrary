const { Op, QueryTypes } = require('sequelize');
const { sequelize, Book, EBook, User, RentList } = require('../models');
const { USER_STATUS } = require('../constants');
const { importedClause } = require('./ebook.service');

/** YYYY-MM-DD in local calendar (avoid UTC shift from toISOString on DATEONLY filters). */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Dashboard analytics use `ebook_reads`; if migrations were skipped, MySQL throws and would 500 the whole summary. */
async function selectOrEmptyEbookReads(sql, options = {}) {
  try {
    return await sequelize.query(sql, { ...options, type: QueryTypes.SELECT });
  } catch (err) {
    const sqlMsg = err?.parent?.sqlMessage || err?.message || '';
    if (/ebook_reads/i.test(sqlMsg) && /doesn't exist|Unknown table/i.test(sqlMsg)) {
      // eslint-disable-next-line no-console
      console.warn('[dashboard] ebook_reads table missing; run: npx sequelize-cli db:migrate —', sqlMsg);
      return [];
    }
    throw err;
  }
}

async function getDashboardSummary() {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);

  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);

  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalBooks, totalEbooks, totalUsers, activeRentals, importedPapers, dailyRentCount, weeklyRentCount, monthlyRentCount, monthlyNewUsers] = await Promise.all([
    Book.count(),
    EBook.count(),
    User.count(),
    RentList.count({ where: { returnDate: null } }),
    EBook.count({ where: importedClause() }),
    RentList.count({ where: { rentDate: { [Op.gte]: formatDate(dayStart) } } }),
    RentList.count({ where: { rentDate: { [Op.gte]: formatDate(weekStart) } } }),
    RentList.count({ where: { rentDate: { [Op.gte]: formatDate(monthStart) } } }),
    User.count({ where: { created_at: { [Op.gte]: monthStart } } }),
  ]);

  const [
    popularBooks,
    activeUsers,
    monthlyRentals,
    booksByCategory,
    ebooksByCategory,
    overdueRentals,
    userGrowthMonthly,
    popularEbooks,
  ] = await Promise.all([
    sequelize.query(
      `
      SELECT
        b.book_id AS bookId,
        b.book_name AS bookName,
        COUNT(r.rent_list_id) AS rentCount
      FROM rent_list r
      INNER JOIN books b ON b.book_id = r.Books_book_id
      GROUP BY b.book_id, b.book_name
      ORDER BY rentCount DESC
      LIMIT 5
    `,
      { type: QueryTypes.SELECT }
    ),
    selectOrEmptyEbookReads(
      `
      SELECT
        u.users_id AS userId,
        u.user_name AS userName,
        u.email AS email,
        COUNT(er.id) AS readCount
      FROM ebook_reads er
      INNER JOIN users u ON u.users_id = er.user_id AND u.is_deleted = 0
      GROUP BY u.users_id, u.user_name, u.email
      ORDER BY readCount DESC
      LIMIT 5
    `
    ),
    getMonthlyRentalsSeries(),
    getBooksByCategory(),
    getEbooksByCategory(),
    getOverdueRentals(),
    getUserGrowthMonthly(),
    getPopularEbooks(),
  ]);

  const analyticsPopularBooks = popularBooks.map((r) => ({
    book_name: String(r.bookName ?? ''),
    rent_count: Number(r.rentCount) || 0,
  }));

  return {
    stats: {
      totalBooks,
      totalEbooks,
      totalUsers,
      activeRentals,
      importedPapers,
    },
    charts: {
      rentals: {
        dailyRentCount,
        weeklyRentCount,
        monthlyRentCount,
      },
      users: {
        monthlyNewUsers,
      },
    },
    topBooks: popularBooks,
    activeUsers,
    analytics: {
      monthlyRentals,
      categories: booksByCategory,
      ebooksCategories: ebooksByCategory,
      popularBooks: analyticsPopularBooks,
      popularEbooks,
      overdue: overdueRentals,
      userGrowth: userGrowthMonthly,
    },
  };
}

/** Flat stats for admin dashboard cards (approved users = active members). */
async function getDashboardStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [totalBooks, totalEbooks, totalUsers, monthlyRentals, importedPapers] = await Promise.all([
    Book.count(),
    EBook.count(),
    User.count({ where: { status: USER_STATUS.APPROVED } }),
    RentList.count({ where: { rentDate: { [Op.gte]: formatDate(monthStart) } } }),
    EBook.count({ where: importedClause() }),
  ]);

  return {
    totalBooks,
    totalEbooks,
    totalUsers,
    monthlyRentals,
    importedPapers,
  };
}

function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Last 12 calendar months as { key, label } for merging SQL aggregates. */
function rollingTwelveMonths(now = new Date()) {
  const out = [];
  for (let i = 11; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({
      key: monthKeyFromDate(d),
      label: d.toLocaleString('en-US', { month: 'short' }),
    });
  }
  return out;
}

/** GET /dashboard/rentals/monthly — [{ month, total }] */
async function getMonthlyRentalsSeries() {
  const now = new Date();
  const startDate = formatDate(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const months = rollingTwelveMonths(now);

  const rows = await sequelize.query(
    `
      SELECT DATE_FORMAT(rent_date, '%Y-%m') AS ym, COUNT(*) AS total
      FROM rent_list
      WHERE rent_date >= :startDate
      GROUP BY DATE_FORMAT(rent_date, '%Y-%m')
      ORDER BY ym ASC
    `,
    { replacements: { startDate }, type: QueryTypes.SELECT }
  );

  const map = Object.fromEntries(rows.map((r) => [r.ym, Number(r.total) || 0]));
  return months.map((m) => ({ month: m.label, total: map[m.key] ?? 0 }));
}

/** GET /dashboard/books/categories — [{ name, value }] */
async function getBooksByCategory() {
  const rows = await sequelize.query(
    `
      SELECT c.category_name AS name, COUNT(b.book_id) AS value
      FROM books b
      INNER JOIN category c ON c.category_id = b.Category_category_id
      GROUP BY c.category_id, c.category_name
      ORDER BY value DESC
    `,
    { type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({ name: String(r.name ?? 'Unknown'), value: Number(r.value) || 0 }));
}

/** GET /dashboard/ebooks/categories — [{ name, value }] */
async function getEbooksByCategory() {
  const rows = await sequelize.query(
    `
      SELECT c.category_name AS name, COUNT(e.eBooks_id) AS value
      FROM ebooks e
      INNER JOIN category c ON c.category_id = e.Category_category_id
      GROUP BY c.category_id, c.category_name
      ORDER BY value DESC
    `,
    { type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({ name: String(r.name ?? 'Unknown'), value: Number(r.value) || 0 }));
}

/** GET /dashboard/books/popular — [{ book_name, rent_count }] */
async function getPopularBooks() {
  const rows = await sequelize.query(
    `
      SELECT b.book_name AS bookName, COUNT(r.rent_list_id) AS rentCount
      FROM rent_list r
      INNER JOIN books b ON b.book_id = r.Books_book_id
      GROUP BY b.book_id, b.book_name
      ORDER BY rentCount DESC
      LIMIT 5
    `,
    { type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({
    book_name: String(r.bookName ?? ''),
    rent_count: Number(r.rentCount) || 0,
  }));
}

/** GET /dashboard/rentals/overdue — active loans past due_date */
async function getOverdueRentals() {
  const rows = await sequelize.query(
    `
      SELECT
        u.user_name AS userName,
        b.book_name AS bookName,
        DATE_FORMAT(r.due_date, '%Y-%m-%d') AS dueDate
      FROM rent_list r
      INNER JOIN users u ON u.users_id = r.Users_users_id AND u.is_deleted = 0
      INNER JOIN books b ON b.book_id = r.Books_book_id
      WHERE r.return_date IS NULL AND r.due_date < CURDATE()
      ORDER BY r.due_date ASC
    `,
    { type: QueryTypes.SELECT }
  );
  return rows.map((r) => ({
    user_name: String(r.userName ?? ''),
    book_name: String(r.bookName ?? ''),
    due_date: String(r.dueDate ?? ''),
  }));
}

/** GET /dashboard/ebooks/popular — top eBooks by read events */
async function getPopularEbooks() {
  const rows = await selectOrEmptyEbookReads(
    `
      SELECT e.eBook_name AS ebookName, COUNT(er.id) AS readCount
      FROM ebook_reads er
      INNER JOIN ebooks e ON e.eBooks_id = er.ebook_id
      GROUP BY e.eBooks_id, e.eBook_name
      ORDER BY readCount DESC
      LIMIT 5
    `
  );
  return rows.map((r) => ({
    ebook_name: String(r.ebookName ?? ''),
    read_count: Number(r.readCount) || 0,
  }));
}

/** GET /dashboard/users/growth — new registrations per month (last 12 months) */
async function getUserGrowthMonthly() {
  const now = new Date();
  const startDate = formatDate(new Date(now.getFullYear(), now.getMonth() - 11, 1));
  const months = rollingTwelveMonths(now);

  const rows = await sequelize.query(
    `
      SELECT DATE_FORMAT(created_at, '%Y-%m') AS ym, COUNT(*) AS total
      FROM users
      WHERE created_at >= :startDate AND is_deleted = 0
      GROUP BY DATE_FORMAT(created_at, '%Y-%m')
      ORDER BY ym ASC
    `,
    { replacements: { startDate }, type: QueryTypes.SELECT }
  );

  const map = Object.fromEntries(rows.map((r) => [r.ym, Number(r.total) || 0]));
  return months.map((m) => ({ month: m.label, total: map[m.key] ?? 0 }));
}

module.exports = {
  getDashboardSummary,
  getDashboardStats,
  getMonthlyRentalsSeries,
  getBooksByCategory,
  getEbooksByCategory,
  getPopularBooks,
  getPopularEbooks,
  getOverdueRentals,
  getUserGrowthMonthly,
};
