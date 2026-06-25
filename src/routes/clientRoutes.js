const express = require('express');
const router = express.Router();
const {
  getClients, getClient, createClient,
  updateClient, deleteClient, recordClientPayment, getClientCredits,
  downloadCreditPDF, recalculateDebt, downloadPaymentReceipt,
  getClientHistory, downloadClientRelevePDF
} = require('../controllers/clientController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(deleteClient);

router.post('/:id/payment', recordClientPayment);
router.get('/:id/credits', getClientCredits);
router.get('/:id/credits/pdf', downloadCreditPDF);
router.post('/:id/recalculate', adminOnly, recalculateDebt);
router.get('/payments/:paymentId/receipt', downloadPaymentReceipt);
router.get('/:id/history', getClientHistory);
router.get('/:id/releve/pdf', downloadClientRelevePDF);

module.exports = router;