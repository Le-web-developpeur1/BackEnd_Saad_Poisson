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
router.get('/archived', getArchivedEmployees); // 🆕
router.get('/payments/:paymentId/pdf', downloadSalarySlip);

router.route('/')
  .get(getEmployees)
  .post(createEmployee);

// Routes avec :id À LA FIN
router.post('/:id/restore', restoreEmployee); // 🆕
router.post('/:id/pay', paySalary);
router.post('/:id/advance', giveAdvance);
router.get('/:id/advances', getAdvances);

router.route('/:id')
  .get(getEmployee)
  .put(updateEmployee)
  .delete(deleteEmployee);

module.exports = router;