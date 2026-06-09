const express = require('express');
const router = express.Router();
const { getSettings, updateSettings, resetSettings } = require('../controllers/settingsController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSettings)
  .put(updateSettings);

router.delete('/reset', resetSettings);

module.exports = router;