const express = require('express');
const router = express.Router();
const {
  getClients, getClient, createClient,
  updateClient, deleteClient, restoreClient, getArchivedClients,
  recordClientPayment, getClientCredits,
  downloadCreditPDF, recalculateDebt, checkAllDebtsConsistency, downloadPaymentReceipt,
  getClientHistory, downloadClientRelevePDF
} = require('../controllers/clientController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

// 🆕 ROUTES ADMIN EN PREMIER (avant /:id)
router.get('/admin/check-consistency', adminOnly, checkAllDebtsConsistency);

// 🆕 Routes pour clients archivés
router.get('/archived', adminOnly, getArchivedClients);

router.route('/')
  .get(getClients)
  .post(createClient);

// Routes spécifiques aux paiements (avant /:id)
router.get('/payments/:paymentId/receipt', downloadPaymentReceipt);

// Routes avec :id (DOIVENT ÊTRE À LA FIN)
router.post('/:id/restore', adminOnly, restoreClient);
router.post('/:id/payment', recordClientPayment);
router.get('/:id/credits', getClientCredits);
router.get('/:id/credits/pdf', downloadCreditPDF);
router.post('/:id/recalculate', adminOnly, recalculateDebt);
router.get('/:id/history', getClientHistory);
router.get('/:id/releve/pdf', downloadClientRelevePDF);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

module.exports = router;