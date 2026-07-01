const express = require('express');
const router = express.Router();
const {
  getDailyReport, getMonthlyReport, getStockReport, getDebtReport, getSupplierReport,
  exportDailyReport, exportMonthlyReport, exportStockReport, exportDebtReport, 
  exportSupplierReport, getCaisseReport,getCapitalReport,getCaisseMovements,getBankMovements,
  exportCaisseReport,
  exportBankReport,
} = require('../controllers/reportController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/daily', getDailyReport);
router.get('/monthly', getMonthlyReport);
router.get('/stock', getStockReport);
router.get('/debts', getDebtReport);
router.get('/suppliers', getSupplierReport);

router.get('/daily/export', exportDailyReport);
router.get('/monthly/export', exportMonthlyReport);
router.get('/stock/export', exportStockReport);
router.get('/debts/export', exportDebtReport);
router.get('/suppliers/export', exportSupplierReport);
router.get('/caisse', getCaisseReport);
router.get('/capital', getCapitalReport);

router.get('/caisse-movements', getCaisseMovements);
router.get('/bank-movements', getBankMovements);
router.get('/export/caisse', exportCaisseReport);
router.get('/export/banque', exportBankReport);


module.exports = router;