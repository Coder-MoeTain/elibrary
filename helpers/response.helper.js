const { HTTP_STATUS } = require('../constants');

function success(res, { data = null, message = 'OK', meta = null } = {}, status = HTTP_STATUS.OK) {
  const body = { success: true, message };
  if (data !== null && data !== undefined) body.data = data;
  if (meta) body.meta = meta;
  return res.status(status).json(body);
}

function created(res, data, message = 'Created') {
  return success(res, { data, message }, HTTP_STATUS.CREATED);
}

function noContent(res) {
  return res.status(HTTP_STATUS.NO_CONTENT).send();
}

function fail(res, message, status = HTTP_STATUS.BAD_REQUEST, errors = null) {
  const body = { success: false, message };
  if (errors) body.errors = errors;
  return res.status(status).json(body);
}

module.exports = {
  success,
  created,
  noContent,
  fail,
};
