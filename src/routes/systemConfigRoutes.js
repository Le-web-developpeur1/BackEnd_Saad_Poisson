const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const { getSystemConfig, updateSystemConfig, uploadLogo } = require('../controllers/systemConfigController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

// Config multer pour le logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'src/uploads/logos/');
  },
  filename: (req, file, cb) => {
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
  fileFilter: (req, file, cb) => {
    const types = /jpeg|jpg|png|webp/;
    const valid = types.test(path.extname(file.originalname).toLowerCase());
    valid ? cb(null, true) : cb(new Error('Seuls les formats JPG, PNG et WEBP sont acceptés'));
  }
});

router.get('/', protect, getSystemConfig);
router.put('/', protect, adminOnly, updateSystemConfig);
router.post('/logo', protect, adminOnly, upload.single('logo'), uploadLogo);

module.exports = router;