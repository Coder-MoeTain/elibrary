const { Admin } = require('../models');
const { hashPassword, comparePassword } = require('../helpers/password.helper');
const AppError = require('../utils/AppError');
const { HTTP_STATUS, MESSAGES, ADMIN_TIER } = require('../constants');

function normalizeTier(value) {
  if (value === ADMIN_TIER.SUPER_ADMIN) return ADMIN_TIER.SUPER_ADMIN;
  return ADMIN_TIER.ADMIN;
}

async function countSuperAdmins() {
  return Admin.count({ where: { role: ADMIN_TIER.SUPER_ADMIN } });
}

async function create(body) {
  const tier = normalizeTier(body.role) === ADMIN_TIER.SUPER_ADMIN ? ADMIN_TIER.SUPER_ADMIN : ADMIN_TIER.ADMIN;
  return Admin.create({
    adminName: body.adminName,
    password: await hashPassword(body.password),
    role: tier,
  });
}

async function findAll() {
  return Admin.findAll({ order: [['adminId', 'ASC']] });
}

async function findById(id) {
  const row = await Admin.findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  return row;
}

async function update(id, body) {
  const row = await Admin.unscoped().findByPk(id);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const fields = { adminName: body.adminName ?? row.adminName };
  if (body.password) {
    fields.password = await hashPassword(body.password);
  }

  if (body.role !== undefined) {
    const next = normalizeTier(body.role);
    if (row.role === ADMIN_TIER.SUPER_ADMIN && next === ADMIN_TIER.ADMIN) {
      const supers = await countSuperAdmins();
      if (supers <= 1) {
        throw new AppError(MESSAGES.CANNOT_DEMOTE_LAST_SUPER_ADMIN, HTTP_STATUS.CONFLICT);
      }
    }
    fields.role = next;
  }

  await row.update(fields);
  return Admin.findByPk(id);
}

async function remove(id, actor) {
  const parsed = Number(id);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  }
  if (actor && parsed === Number(actor.id)) {
    throw new AppError(MESSAGES.CANNOT_DELETE_SELF, HTTP_STATUS.BAD_REQUEST);
  }

  const row = await findById(parsed);
  if (row.role === ADMIN_TIER.SUPER_ADMIN) {
    const supers = await countSuperAdmins();
    if (supers <= 1) {
      throw new AppError(MESSAGES.CANNOT_DELETE_LAST_SUPER_ADMIN, HTTP_STATUS.CONFLICT);
    }
  }

  await row.destroy();
  return true;
}

async function getProfile(adminId) {
  const row = await Admin.unscoped().findByPk(adminId);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  const json = row.toJSON();
  delete json.password;
  return {
    adminId: json.adminId,
    userName: String(json.adminName ?? ''),
    email: typeof json.email === 'string' ? json.email : '',
    role: json.role === ADMIN_TIER.SUPER_ADMIN ? ADMIN_TIER.SUPER_ADMIN : ADMIN_TIER.ADMIN,
  };
}

async function updateProfile(adminId, body) {
  const row = await Admin.unscoped().findByPk(adminId);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);

  const userName = String(body.userName ?? body.adminName ?? '').trim();
  if (!userName) {
    throw new AppError('Username is required', HTTP_STATUS.BAD_REQUEST);
  }

  const payload = { adminName: userName };
  const hasEmailField = Object.prototype.hasOwnProperty.call(Admin.rawAttributes || {}, 'email');
  if (hasEmailField && body.email !== undefined) {
    payload.email = String(body.email ?? '').trim();
  }
  await row.update(payload);
  return getProfile(adminId);
}

async function changePassword(adminId, currentPassword, newPassword) {
  const row = await Admin.unscoped().findByPk(adminId);
  if (!row) throw new AppError(MESSAGES.NOT_FOUND, HTTP_STATUS.NOT_FOUND);
  if (!newPassword || String(newPassword).length < 6) {
    throw new AppError('New password must be at least 6 characters', HTTP_STATUS.BAD_REQUEST);
  }
  const ok = await comparePassword(currentPassword, row.password);
  if (!ok) {
    throw new AppError('Current password is incorrect', HTTP_STATUS.BAD_REQUEST);
  }
  await row.update({ password: await hashPassword(String(newPassword)) });
  return true;
}

module.exports = {
  create,
  findAll,
  findById,
  update,
  remove,
  getProfile,
  updateProfile,
  changePassword,
};
