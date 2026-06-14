const express = require('express');
const router = express.Router();
const { getSales, getSale, createSale, updateSale, deleteSale } = require('../controllers/saleController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/:id')
  .get(getSale)
  .put(updateSale)
  .delete(adminOnly, deleteSale);

module.exports = router;