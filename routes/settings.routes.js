const { Router } = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const multer = require('multer');
const settingsController = require('../controllers/settings.controller');
const { authenticate, requireAdmin, requireSuperAdmin } = require('../middlewares/auth.middleware');

const backupUploadDir = path.join(process.cwd(), 'backups', '.incoming');
fs.mkdirSync(backupUploadDir, { recursive: true });

const sqlUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, backupUploadDir),
    filename: (_req, file, cb) => cb(null, `${Date.now()}-${crypto.randomUUID()}.sql`),
  }),
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    if (ext !== '.sql' && file.mimetype !== 'application/sql' && file.mimetype !== 'text/plain' && file.mimetype !== 'application/octet-stream') {
      return cb(new Error('Only .sql backup files are allowed'));
    }
    return cb(null, true);
  },
  limits: { fileSize: 512 * 1024 * 1024, files: 1 },
});

const router = Router();

router.get('/', authenticate, settingsController.get);
router.put('/timezone', authenticate, requireAdmin, settingsController.updateTimezone);
router.put(
  '/google-join-approval',
  authenticate,
  requireAdmin,
  settingsController.updateGoogleJoinApproval
);

router.get('/backups', authenticate, requireSuperAdmin, settingsController.listBackups);
router.post('/backups', authenticate, requireSuperAdmin, settingsController.createBackup);
router.get('/backups/:file', authenticate, requireSuperAdmin, settingsController.downloadBackup);
router.post(
  '/backups/:file/restore',
  authenticate,
  requireSuperAdmin,
  settingsController.restoreBackup
);
router.post(
  '/restore',
  authenticate,
  requireSuperAdmin,
  sqlUpload.single('file'),
  settingsController.restoreBackup
);
router.delete('/backups/:file', authenticate, requireSuperAdmin, settingsController.removeBackup);

module.exports = router;
