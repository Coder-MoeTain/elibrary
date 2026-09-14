/**
 * Creates / updates the Play Store reviewer member account.
 *
 * Usage (from Librarybackend):
 *   node scripts/seed-review-user.js
 */
require('dotenv').config();

const { User } = require('../models');
const { hashPassword } = require('../helpers/password.helper');
const { USER_STATUS } = require('../constants');

const REVIEW_EMAIL = 'mmelibrary.review@gmail.com';
const REVIEW_USERNAME = 'mmelibrary.review';
const REVIEW_PASSWORD = 'mmelibrary55432';

async function main() {
  const passwordHash = await hashPassword(REVIEW_PASSWORD);

  const existing = await User.unscoped().findOne({
    where: { email: REVIEW_EMAIL, isDeleted: false },
  });

  if (existing) {
    await existing.update({
      userName: REVIEW_USERNAME,
      password: passwordHash,
      status: USER_STATUS.APPROVED,
      isDeleted: false,
    });
    console.log(`Updated review user id=${existing.usersId} (${REVIEW_EMAIL})`);
  } else {
    const byName = await User.unscoped().findOne({
      where: { userName: REVIEW_USERNAME, isDeleted: false },
    });
    if (byName) {
      await byName.update({
        email: REVIEW_EMAIL,
        password: passwordHash,
        status: USER_STATUS.APPROVED,
      });
      console.log(`Updated review user id=${byName.usersId} (${REVIEW_USERNAME})`);
    } else {
      const created = await User.create({
        userName: REVIEW_USERNAME,
        email: REVIEW_EMAIL,
        password: passwordHash,
        status: USER_STATUS.APPROVED,
        isDeleted: false,
      });
      console.log(`Created review user id=${created.usersId} (${REVIEW_EMAIL})`);
    }
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
