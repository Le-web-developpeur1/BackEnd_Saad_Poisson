const express = require('express');
const router  = express.Router();
const {
  getSuppliers, getSupplier, createSupplier,
  updateSupplier, deleteSupplier, recordSupplierPayment, 
  recordPurchase, getSupplierHistory
} = require('../controllers/supplierController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(createSupplier);

router.route('/:id')
  .get(getSupplier)
  .put(updateSupplier)
  .delete(adminOnly, deleteSupplier);

router.post('/:id/payment', recordSupplierPayment);
router.post('/:id/purchase', recordPurchase);
router.get('/:id/history', getSupplierHistory);

module.exports = router;