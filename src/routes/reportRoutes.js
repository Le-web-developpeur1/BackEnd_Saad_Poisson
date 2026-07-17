const express = require('express');
const router = express.Router();
const {
  getDailyReport, getMonthlyReport, getStockReport, getDebtReport, getSupplierReport,
  exportDailyReport, exportMonthlyReport, exportStockReport, exportDebtReport, 
  exportSupplierReport, getCaisseReport,getCapitalReport,getCaisseMovements,getBankMovements,
  exportCaisseReport,
  exportBankReport, createOrUpdateDailySnapshot
} = require('../controllers/reportController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/daily', getDailyReport);
router.get('/monthly', getMonthlyReport);
router.get('/stock', getStockReport);
router.get('/debts', getDebtReport);
router.get('/suppliers', getSupplierReport);
// 🧪 Route de test pour créer un snapshot
// ✅ APRÈS (CORRECT)
router.get('/test-snapshot', async (req, res) => {
  try {
    const { date } = req.query;
    
    // Si date est fournie, l'utiliser, sinon aujourd'hui
    const targetDate = date ? new Date(date) : new Date();
    
    console.log('🧪 Test snapshot avec date:', date, '→', targetDate.toISOString());
    
    const snapshot = await createOrUpdateDailySnapshot(targetDate);
    
    res.json({
      success: true,
      message: 'Snapshot créé avec succès',
      snapshot
    });
  } catch (error) {
    console.error('❌ Erreur test snapshot:', error);
    res.status(500).json({ 
      success: false,
      message: error.message 
    });
  }
});



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