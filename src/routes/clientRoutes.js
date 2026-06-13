const express = require('express');
const router = express.Router();
const {
  getClients, getClient, createClient,
  updateClient, deleteClient, recordClientPayment, getClientCredits,
  downloadCreditPDF
} = require('../controllers/clientController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

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

module.exports = router;