const { QueryTypes, fn, col, where } = require('sequelize');
const { sequelize, Department, User } = require('../models');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES } = require('../constants');

function normalizedDepartmentName(value) {
  const name = value != null ? String(value).trim() : '';
  return { name, key: name.toLowerCase() };
}

async function findDepartmentByNameCaseInsensitive(nameKey) {
  return Department.unscoped().findOne({
    where: where(fn('LOWER', col('department_name')), nameKey),
  });
}

async function userCountsByDepartmentIds(ids) {
  if (!ids.length) return {};
  const rows = await sequelize.query(
    `
    SELECT department_department_id AS deptId, COUNT(*) AS cnt
    FROM users
    WHERE is_deleted = 0 AND department_department_id IN (:ids)
    GROUP BY department_department_id
  `,
    { replacements: { ids }, type: QueryTypes.SELECT }
  );
  return Object.fromEntries(rows.map((r) => [Number(r.deptId), Number(r.cnt) || 0]));
}

async function create(data) {
  const { name, key } = normalizedDepartmentName(data.departmentName);
  if (!name) {
    throw new AppError('Department name is required', HTTP_STATUS.BAD_REQUEST);
  }

  const existing = await findDepartmentByNameCaseInsensitive(key);
  if (existing) {
    if (existing.isDeleted) {
      await existing.update({ isDeleted: false, departmentName: name });
      await existing.reload();
      return { department: existing, restored: true };
    }
    throw new AppError(MESSAGES.DEPARTMENT_NAME_EXISTS, HTTP_STATUS.UNPROCESSABLE);
  }

  const row = await Department.create({ departmentName: name });
  return { department: row, restored: false };
}

async function findAll({ includeDeleted = false } = {}) {
  const q = { order: [['departmentId', 'ASC']] };
  const rows = includeDeleted
    ? await Department.unscoped().findAll(q)
    : await Department.findAll(q);

  const ids = rows.map((r) => r.departmentId);
  const countMap = await userCountsByDepartmentIds(ids);

  return rows.map((row) => {
    const j = row.toJSON();
    j.userDependencyCount = countMap[row.departmentId] ?? 0;
    return j;
  });
}

function parseDepartmentId(id) {
  const n = Number.parseInt(String(id), 10);
  if (!Number.isInteger(n) || n < 1) {
    throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  return n;
}

async function findById(id) {
  const pk = parseDepartmentId(id);
  const row = await Department.findByPk(pk);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function update(id, data) {
  const row = await findById(id);
  const payload = { ...data };
  if (data.departmentName !== undefined) {
    const { name, key } = normalizedDepartmentName(data.departmentName);
    if (!name) {
      throw new AppError('Department name is required', HTTP_STATUS.BAD_REQUEST);
    }
    const clash = await findDepartmentByNameCaseInsensitive(key);
    if (clash && clash.departmentId !== row.departmentId && !clash.isDeleted) {
      throw new AppError(MESSAGES.DEPARTMENT_NAME_EXISTS, HTTP_STATUS.UNPROCESSABLE);
    }
    payload.departmentName = name;
  }
  await row.update(payload);
  return row.reload();
}

async function restore(id) {
  const pk = parseDepartmentId(id);
  const row = await Department.unscoped().findByPk(pk);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (!row.isDeleted) {
    throw new AppError('Department is not archived.', HTTP_STATUS.BAD_REQUEST);
  }
  const { key } = normalizedDepartmentName(row.departmentName);
  if (key) {
    const activeSameName = await Department.findOne({
      where: where(fn('LOWER', col('department_name')), key),
    });
    if (activeSameName && activeSameName.departmentId !== row.departmentId) {
      throw new AppError(MESSAGES.DEPARTMENT_NAME_EXISTS, HTTP_STATUS.UNPROCESSABLE);
    }
  }
  await row.update({ isDeleted: false });
  await row.reload();
  return row;
}

async function getDependencyCounts(rawId) {
  const pk = parseDepartmentId(rawId);
  const row = await Department.unscoped().findByPk(pk);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const users = await User.unscoped().count({
    where: { department_department_id: pk, isDeleted: false },
  });
  return { users, books: 0 };
}

async function remove(id) {
  const row = await findById(id);
  const count = await User.unscoped().count({
    where: {
      department_department_id: row.departmentId,
      isDeleted: false,
    },
  });
  if (count > 0) {
    throw new AppError(
      `Department is used by ${count} user(s) and cannot be archived.`,
      HTTP_STATUS.CONFLICT,
      null,
      { dependencyCount: count }
    );
  }
  await row.update({ isDeleted: true });
  return true;
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  restore,
  getDependencyCounts,
  remove,
};
