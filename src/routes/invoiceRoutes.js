const express = require('express');
const router = express.Router();
const {
  getInvoices, getInvoice, createInvoice,
  saveClientSignature, deleteInvoice, downloadInvoicePDF 
} = require('../controllers/invoiceController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getInvoices)
  .post(createInvoice);

router.route('/:id')
  .get(getInvoice)
  .delete(adminOrGestionnaire, deleteInvoice);

router.put('/:id/signature', saveClientSignature);
router.get('/:id/pdf', downloadInvoicePDF);

module.exports = router;