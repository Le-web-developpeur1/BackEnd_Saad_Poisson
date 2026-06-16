const express = require('express');
const router = express.Router();
const {
  getExpenses, getExpense, createExpense,
  updateExpense, deleteExpense
} = require('../controllers/expenseController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.route('/:id')
  .get(getExpense)
  .put(updateExpense)
  .delete(adminOnly, deleteExpense);

module.exports = router;