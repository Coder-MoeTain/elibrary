'use strict';

/** Mutable MySQL session offset applied on each pooled connection (`SET time_zone`). */
let mysqlOffsetValue = '+06:30';

function getMysqlOffset() {
  return mysqlOffsetValue;
}

function setMysqlOffset(offset) {
  const next = String(offset || '').trim();
  if (/^[+-]\d{2}:\d{2}$/.test(next)) {
    mysqlOffsetValue = next;
  }
}

module.exports = {
  getMysqlOffset,
  setMysqlOffset,
};
