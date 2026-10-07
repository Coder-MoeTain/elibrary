require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const http = require('http');
const { Admin, sequelize } = require('../models');
const { signToken } = require('../helpers/jwt.helper');
const { ROLES, ADMIN_TIER } = require('../constants');

(async () => {
  try {
    const admin = await Admin.findOne({ order: [['adminId', 'ASC']] });
    if (!admin) throw new Error('no admin');
    console.log('admin', admin.adminId, admin.username, admin.role);

    const token = signToken({
      userId: admin.adminId,
      role: ROLES.ADMIN,
      adminRole: admin.role === ADMIN_TIER.SUPER_ADMIN ? ADMIN_TIER.SUPER_ADMIN : ADMIN_TIER.ADMIN,
    });

    const fetchPath = (path) =>
      new Promise((resolve, reject) => {
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port: Number(process.env.PORT || 3000),
            path,
            headers: { Authorization: `Bearer ${token}` },
          },
          (res) => {
            let body = '';
            res.on('data', (c) => (body += c));
            res.on('end', () => resolve({ status: res.statusCode, body }));
          }
        );
        req.on('error', reject);
      });

    const noCounts = await fetchPath('/api/categories');
    const withCounts = await fetchPath('/api/categories?counts=true');
    const a = JSON.parse(noCounts.body);
    const b = JSON.parse(withCounts.body);
    console.log('noCounts', noCounts.status, 'len', Array.isArray(a.data) ? a.data.length : a.message || a);
    console.log('noCounts sample', Array.isArray(a.data) ? a.data[0] : null);
    console.log('withCounts', withCounts.status, 'len', Array.isArray(b.data) ? b.data.length : b.message || b);
    console.log('withCounts sample', Array.isArray(b.data) ? b.data[0] : null);
    if (Array.isArray(b.data)) {
      const nonzero = b.data.filter(
        (r) =>
          Number(r.bookCount || r.book_count || 0) > 0 ||
          Number(r.ebookCount || r.ebook_count || 0) > 0 ||
          Number(r.paperCount || r.paper_count || 0) > 0
      );
      console.log('nonzero in api', nonzero.length);
    }
  } catch (e) {
    console.error('ERR', e.message);
    console.error(e.stack);
  } finally {
    await sequelize.close();
  }
})();
