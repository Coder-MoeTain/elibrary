const { Op, QueryTypes } = require('sequelize');
const { sequelize, User, RentList, Department } = require('../models');
const { hashPassword, comparePassword } = require('../helpers/password.helper');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES, USER_STATUS } = require('../constants');

/**
 * LEFT JOIN department without Department.defaultScope forcing an INNER JOIN
 * (which drops Google pending users that have no department yet).
 */
function departmentInclude() {
  return {
    model: Department.unscoped(),
    as: 'department',
    required: false,
  };
}

async function activeRentalCountsByUserIds(ids) {
  if (!ids.length) return {};
  const rows = await sequelize.query(
    `
    SELECT Users_users_id AS userId, COUNT(*) AS cnt
    FROM rent_list
    WHERE return_date IS NULL AND Users_users_id IN (:ids)
    GROUP BY Users_users_id
  `,
    { replacements: { ids }, type: QueryTypes.SELECT }
  );
  return Object.fromEntries(rows.map((r) => [Number(r.userId), Number(r.cnt) || 0]));
}

async function registerUser(body) {
  const departmentId = Number.parseInt(String(body.department_id), 10);
  if (!Number.isInteger(departmentId) || departmentId < 1) {
    throw new AppError(MESSAGES.INVALID_DEPARTMENT, HTTP_STATUS.BAD_REQUEST);
  }

  const userName = body.user_name;
  const email = body.email;
  const existing = await User.unscoped().findOne({
    where: {
      [Op.and]: [{ [Op.or]: [{ userName }, { email }] }, { isDeleted: false }],
    },
  });
  if (existing) {
    throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  const row = await User.create({
    userName,
    email,
    password: await hashPassword(body.password),
    dateOfBirth: body.date_of_birth,
    department_department_id: departmentId,
    status: USER_STATUS.PENDING,
  });

  return User.findByPk(row.usersId, { include: [departmentInclude()] });
}

async function approveUser(id) {
  const row = await findById(id);
  await row.update({ status: USER_STATUS.APPROVED });
  return (
    (await User.unscoped().findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [departmentInclude()],
    })) || row
  );
}

async function rejectUser(id) {
  const row = await findById(id);
  await row.update({ status: USER_STATUS.REJECTED });
  return (
    (await User.unscoped().findByPk(id, {
      attributes: { exclude: ['password'] },
      include: [departmentInclude()],
    })) || row
  );
}

async function create(body) {
  const raw = {
    userName: body.userName,
    dateOfBirth: body.dateOfBirth ?? null,
    email: body.email ?? null,
    department_department_id: body.departmentId,
    password: body.password ? await hashPassword(body.password) : null,
    status: USER_STATUS.APPROVED,
  };
  return User.create(raw);
}

async function findAll({ includeDeleted = false } = {}) {
  // Do not JOIN department here — Sequelize + Department.defaultScope can drop
  // users with NULL department_department_id (Google Sign-In pending/approved).
  const rows = includeDeleted
    ? await User.unscoped().findAll({
        attributes: { exclude: ['password'] },
        order: [['usersId', 'ASC']],
      })
    : await User.findAll({
        order: [['usersId', 'ASC']],
      });

  const deptIds = [
    ...new Set(
      rows
        .map((r) => r.department_department_id)
        .filter((id) => id != null && Number(id) > 0)
        .map((id) => Number(id))
    ),
  ];

  const deptRows = deptIds.length
    ? await Department.unscoped().findAll({
        where: { departmentId: { [Op.in]: deptIds } },
      })
    : [];
  const deptMap = Object.fromEntries(deptRows.map((d) => [d.departmentId, d]));

  const ids = rows.map((r) => r.usersId);
  const rentalMap = await activeRentalCountsByUserIds(ids);

  return rows.map((row) => {
    const j = row.toJSON();
    const deptId = j.department_department_id != null ? Number(j.department_department_id) : null;
    const dept = deptId != null ? deptMap[deptId] : null;
    j.department = dept ? dept.toJSON() : null;
    j.activeRentalCount = rentalMap[row.usersId] ?? 0;
    return j;
  });
}

async function findById(id) {
  const row = await User.unscoped().findByPk(id, {
    attributes: { exclude: ['password'] },
    include: [departmentInclude()],
  });
  if (!row || row.isDeleted) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function findMe(userId) {
  return findById(userId);
}

async function updateMe(userId, body) {
  const row = await User.unscoped().findOne({
    where: { usersId: userId, isDeleted: false },
  });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const nextUserName = String(body.userName ?? '').trim();
  if (!nextUserName) {
    throw new AppError('Username is required', HTTP_STATUS.BAD_REQUEST);
  }

  if (nextUserName !== row.userName) {
    const dupName = await User.unscoped().findOne({
      where: {
        isDeleted: false,
        usersId: { [Op.ne]: userId },
        userName: nextUserName,
      },
    });
    if (dupName) throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  let nextEmail = row.email;
  if (body.email !== undefined) {
    nextEmail =
      body.email === null || String(body.email).trim() === '' ? null : String(body.email).trim();
  }
  if (nextEmail && nextEmail !== row.email) {
    const dupEmail = await User.unscoped().findOne({
      where: {
        isDeleted: false,
        usersId: { [Op.ne]: userId },
        email: nextEmail,
      },
    });
    if (dupEmail) throw new AppError(MESSAGES.USER_ALREADY_EXISTS, HTTP_STATUS.CONFLICT);
  }

  const departmentId = Number(body.departmentId);
  if (!Number.isInteger(departmentId) || departmentId < 1) {
    throw new AppError(MESSAGES.INVALID_DEPARTMENT, HTTP_STATUS.BAD_REQUEST);
  }
  const department = await Department.findByPk(departmentId);
  if (!department) {
    throw new AppError(MESSAGES.INVALID_DEPARTMENT, HTTP_STATUS.BAD_REQUEST);
  }

  await row.update({
    userName: nextUserName,
    email: nextEmail,
    dateOfBirth: body.dateOfBirth !== undefined ? body.dateOfBirth || null : row.dateOfBirth,
    department_department_id: departmentId,
  });

  return User.findByPk(userId, { include: [departmentInclude()] });
}

async function changeMyPassword(userId, currentPassword, newPassword) {
  if (!newPassword || String(newPassword).length < 6) {
    throw new AppError('New password must be at least 6 characters', HTTP_STATUS.BAD_REQUEST);
  }

  const row = await User.unscoped().findOne({
    where: { usersId: userId, isDeleted: false },
  });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const ok = await comparePassword(currentPassword, row.password);
  if (!ok) {
    throw new AppError('Current password is wrong', HTTP_STATUS.BAD_REQUEST);
  }

  await row.update({ password: await hashPassword(newPassword) });
}

async function update(id, body) {
  const row = await User.unscoped().findOne({
    where: { usersId: id, isDeleted: false },
  });
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const fields = {
    userName: body.userName ?? row.userName,
    dateOfBirth: body.dateOfBirth !== undefined ? body.dateOfBirth : row.dateOfBirth,
    email: body.email !== undefined ? body.email : row.email,
    department_department_id: body.departmentId ?? row.department_department_id,
  };
  if (body.password) {
    fields.password = await hashPassword(body.password);
  }
  await row.update(fields);
  return User.findByPk(id, { include: [departmentInclude()] });
}

async function remove(id) {
  const row = await findById(id);
  const activeRentals = await RentList.count({
    where: { Users_users_id: row.usersId, returnDate: null },
  });
  if (activeRentals > 0) {
    throw new AppError(
      `This user has ${activeRentals} active rental(s) and cannot be archived.`,
      HTTP_STATUS.CONFLICT,
      null,
      { activeRentalCount: activeRentals }
    );
  }
  await row.update({ isDeleted: true });
  return true;
}

module.exports = {
  registerUser,
  approveUser,
  rejectUser,
  create,
  findAll,
  findById,
  findMe,
  updateMe,
  changeMyPassword,
  update,
  remove,
};
