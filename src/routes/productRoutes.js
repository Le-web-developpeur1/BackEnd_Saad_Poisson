const express = require('express');
const router = express.Router();
const {
  getProducts, getProduct, createProduct,
  updateProduct, deleteProduct, restoreProduct, getArchivedProducts,
  adjustStock, getLowStockProducts
} = require('../controllers/productController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/alerts', getLowStockProducts);
router.get('/archived', adminOnly, getArchivedProducts); 
router.post('/:id/restore', adminOnly, restoreProduct);  

router.route('/')
  .get(getProducts)
  .post(createProduct);

router.route('/:id')
  .get(getProduct)
  .put(updateProduct)
  .delete(adminOnly, deleteProduct);

router.post('/:id/stock', adjustStock);

module.exports = router;