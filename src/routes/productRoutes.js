const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct,
  updateProduct, deleteProduct, adjustStock, getLowStockProducts
} = require('../controllers/productController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/alerts', getLowStockProducts);
router.route('/')
  .get(getProducts)
  .post(adminOrGestionnaire, createProduct);

router.route('/:id')
  .get(getProduct)
  .put(adminOrGestionnaire, updateProduct)
  .delete(adminOrGestionnaire, deleteProduct);

router.post('/:id/stock', adminOrGestionnaire, adjustStock);

module.exports = router;