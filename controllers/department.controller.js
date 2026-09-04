const departmentService = require('../services/department.service');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, HTTP_STATUS } = require('../constants');
const { success, created } = require('../helpers/response.helper');

const create = asyncHandler(async (req, res) => {
  try {
    const { department, restored } = await departmentService.create(req.body);
    if (restored) {
      return success(
        res,
        { data: department, message: 'Department restored successfully', meta: { restored: true } },
        HTTP_STATUS.OK
      );
    }
    return created(res, department, 'Department created successfully');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Department create error:', err);
    throw err;
  }
});

const list = asyncHandler(async (req, res) => {
  const includeDeleted =
    req.user?.role === ROLES.ADMIN && String(req.query.includeDeleted).toLowerCase() === 'true';
  const rows = await departmentService.findAll({ includeDeleted });
  return success(res, { data: rows });
});

/** Public list for member registration (no auth). */
const listPublic = asyncHandler(async (req, res) => {
  const rows = await departmentService.findAll();
  return success(res, { data: rows });
});

const dependencies = asyncHandler(async (req, res) => {
  const data = await departmentService.getDependencyCounts(req.params.id);
  return success(res, { data });
});

const getById = asyncHandler(async (req, res) => {
  const row = await departmentService.findById(req.params.id);
  return success(res, { data: row });
});

const update = asyncHandler(async (req, res) => {
  const row = await departmentService.update(req.params.id, req.body);
  return success(res, { data: row, message: 'Updated' });
});

const remove = asyncHandler(async (req, res) => {
  await departmentService.remove(req.params.id);
  return success(res, { message: 'Department archived successfully' });
});

const restore = asyncHandler(async (req, res) => {
  const row = await departmentService.restore(req.params.id);
  return success(res, { data: row, message: 'Department restored successfully', meta: { restored: true } });
});

module.exports = {
  create,
  list,
  listPublic,
  dependencies,
  getById,
  update,
  remove,
  restore,
};
