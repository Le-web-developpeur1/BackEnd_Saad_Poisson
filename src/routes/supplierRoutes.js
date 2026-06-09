const express = require('express');
const router = express.Router();
const {
  getSuppliers, getSupplier, createSupplier,
  updateSupplier, deleteSupplier, recordSupplierPayment, recordPurchase
} = require('../controllers/supplierController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSuppliers)
  .post(adminOrGestionnaire, createSupplier);

router.route('/:id')
  .get(getSupplier)
  .put(adminOrGestionnaire, updateSupplier)
  .delete(adminOrGestionnaire, deleteSupplier);

router.post('/:id/payment', recordSupplierPayment);
router.post('/:id/purchase', adminOrGestionnaire, recordPurchase);

module.exports = router;