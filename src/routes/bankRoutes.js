const express = require('express');
const router  = express.Router();
const { getBankReport, transferToBanque } = require('../controllers/bankController');
const { protect, adminOrGestionnaire }    = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/',          getBankReport);
router.post('/transfer', adminOrGestionnaire, transferToBanque);

module.exports = router;