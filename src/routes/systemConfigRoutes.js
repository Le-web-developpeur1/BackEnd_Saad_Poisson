const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const { getSystemConfig, updateSystemConfig, uploadLogo } = require('../controllers/systemConfigController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// ← memoryStorage au lieu de diskStorage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|webp/;
    const valid = types.test(file.mimetype);
    valid ? cb(null, true) : cb(new Error('Seuls JPG, PNG et WEBP sont acceptés'));
  }
});

router.get('/',      protect, getSystemConfig);
router.put('/',      protect, adminOnly, updateSystemConfig);
router.post('/logo', protect, adminOnly, upload.single('logo'), uploadLogo);

module.exports = router;