const express = require('express');
const router = express.Router();
const {
  getSuppliers, getSupplier, createSupplier,
  updateSupplier, deleteSupplier, recordSupplierPayment, recordPurchase
} = require('../controllers/supplierController');
const { protect, adminOrGestionnaire, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(adminOrGestionnaire, createSupplier);

router.route('/:id')
  .get(getSupplier)
  .put(adminOrGestionnaire, updateSupplier)
  .delete(adminOnly, deleteSupplier);

router.post('/:id/payment', recordSupplierPayment);
router.post('/:id/purchase', adminOrGestionnaire, recordPurchase);

module.exports = router;