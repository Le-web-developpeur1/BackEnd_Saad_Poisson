const express = require('express');
const router  = express.Router();
const { getDamages, createDamage, deleteDamage, getDamageStats } = require('../controllers/damageController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/stats', getDamageStats);
router.route('/')
  .get(getDamages)
  .post(createDamage);
router.delete('/:id', adminOrGestionnaire, deleteDamage);

module.exports = router;