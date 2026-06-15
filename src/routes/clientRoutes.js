const express = require('express');
const router = express.Router();
const {
  getClients, getClient, createClient,
  updateClient, deleteClient, recordClientPayment, getClientCredits,
  downloadCreditPDF,
  recalculateDebt
} = require('../controllers/clientController');
const { protect, adminOrGestionnaire, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getClients)
  .post(createClient);

router.route('/:id')
  .get(getClient)
  .put(updateClient)
  .delete(adminOrGestionnaire, deleteClient);

router.post('/:id/payment', recordClientPayment);
router.get('/:id/credits', getClientCredits);
router.get('/:id/credits/pdf', downloadCreditPDF);
router.post('/:id/recalculate', protect, adminOnly, recalculateDebt);

module.exports = router;