const express = require('express');
const router  = express.Router();
const {
  getEmployees, getEmployee, createEmployee,
  updateEmployee, deleteEmployee, paySalary, getSalaryStats, downloadSalarySlip
} = require('../controllers/employeeController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/stats', getSalaryStats);
router.route('/')
  .get(getEmployees)
  .post(adminOnly, createEmployee);

router.route('/:id')
  .get(getEmployee)
  .put(adminOnly, updateEmployee)
  .delete(adminOnly, deleteEmployee);

router.post('/:id/pay', adminOnly, paySalary);
router.get('/payments/:paymentId/pdf', downloadSalarySlip);

module.exports = router;