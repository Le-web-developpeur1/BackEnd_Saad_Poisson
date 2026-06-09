const express = require('express');
const router = express.Router();
const { getSales, getSale, createSale } = require('../controllers/saleController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getSales)
  .post(createSale);

router.route('/:id')
  .get(getSale);

module.exports = router;