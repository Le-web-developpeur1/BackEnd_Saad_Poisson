const express = require('express');
const router  = express.Router();
const { addCashIn, addBankIn, getCashIns, getBankIns } = require('../controllers/cashInController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);
router.get('/',      getCashIns);
router.post('/',     adminOrGestionnaire, addCashIn);
router.get('/bank',  getBankIns);
router.post('/bank', adminOrGestionnaire, addBankIn);

module.exports = router;