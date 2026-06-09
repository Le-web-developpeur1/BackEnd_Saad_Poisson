const express = require('express');
const router = express.Router();
const {
  getExpenses, getExpense, createExpense,
  updateExpense, deleteExpense
} = require('../controllers/expenseController');
const { protect, adminOrGestionnaire } = require('../middlewares/authMiddleware');

router.use(protect);

router.route('/')
  .get(getExpenses)
  .post(createExpense);

router.route('/:id')
  .get(getExpense)
  .put(updateExpense)
  .delete(adminOrGestionnaire, deleteExpense);

module.exports = router;