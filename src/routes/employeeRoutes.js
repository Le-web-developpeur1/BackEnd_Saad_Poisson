const express = require('express');
const router  = express.Router();
const {
  getEmployees, getEmployee, createEmployee,
  updateEmployee, deleteEmployee, restoreEmployee, getArchivedEmployees,
  paySalary, getSalaryStats, 
  downloadSalarySlip, giveAdvance, getAdvances
} = require('../controllers/employeeController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.use(protect);

// Routes spéciales EN PREMIER (avant /:id)
router.get('/stats', getSalaryStats);
router.get('/archived', adminOnly, getArchivedEmployees); // 🆕
router.get('/payments/:paymentId/pdf', downloadSalarySlip);

router.route('/')
  .get(getEmployees)
  .post(adminOnly, createEmployee);

// Routes avec :id À LA FIN
router.post('/:id/restore', adminOnly, restoreEmployee); // 🆕
router.post('/:id/pay', adminOnly, paySalary);
router.post('/:id/advance', adminOnly, giveAdvance);
router.get('/:id/advances', getAdvances);

router.route('/:id')
  .get(getEmployee)
  .put(adminOnly, updateEmployee)
  .delete(adminOnly, deleteEmployee);

module.exports = router;