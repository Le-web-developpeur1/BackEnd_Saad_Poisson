const Employee = require('../models/Employee');
const SalaryPayment = require('../models/SalaryPayment');
const Expense = require('../models/Expense');
const { generateSalarySlipPDF } = require('../utils/generateInvoicePDF');


// @desc    Tous les employés
// @route   GET /api/employees
const getEmployees = async (req, res) => {
  try {
    const employees = await Employee.find().sort({ name: 1 });

    // Vérifier qui a été payé ce mois
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const employeesWithStatus = await Promise.all(
      employees.map(async (emp) => {
        const paidThisMonth = await SalaryPayment.findOne({
          employee: emp._id,
          paymentDate: { $gte: startMonth, $lte: endMonth }
        });
        return {
          ...emp.toObject(),
          paidThisMonth: !!paidThisMonth
        };
      })
    );

    res.json(employeesWithStatus);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Un employé + historique paiements
// @route   GET /api/employees/:id
const getEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

    const payments = await SalaryPayment.find({ employee: req.params.id }).sort({ paymentDate: -1 });
    res.json({ employee, payments });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un employé
// @route   POST /api/employees
const createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier un employé
// @route   PUT /api/employees/:id
const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Désactiver un employé
// @route   DELETE /api/employees/:id
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });
    res.json({ message: 'Employé désactivé' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Payer un salaire
// @route   POST /api/employees/:id/pay
const paySalary = async (req, res) => {
  try {
    const { amount, period, daysWorked, note } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

    // Créer la dépense automatiquement
    const expense = await Expense.create({
      title: `Salaire — ${employee.name} (${period})`,
      category: 'salaire',
      amount: Number(amount),
      date: new Date(),
      note: note || `Paiement salaire ${employee.position}`,
      recordedBy: req.user._id
    });

    // Enregistrer le paiement de salaire
    const payment = await SalaryPayment.create({
      employee: employee._id,
      employeeName: employee.name,
      position: employee.position,
      period,
      daysWorked: daysWorked || null,
      amount: Number(amount),
      note,
      paidBy: req.user._id,
      expenseId: expense._id
    });

    res.status(201).json({ message: 'Salaire payé avec succès', payment, expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stats salaires
// @route   GET /api/employees/stats
const getSalaryStats = async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true });
    const now = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const paymentsThisMonth = await SalaryPayment.find({
      paymentDate: { $gte: startMonth, $lte: endMonth }
    });

    const totalPaidThisMonth = paymentsThisMonth.reduce((sum, p) => sum + p.amount, 0);
    const paidEmployeeIds = paymentsThisMonth.map(p => p.employee.toString());
    const unpaidEmployees = employees.filter(e => !paidEmployeeIds.includes(e._id.toString()));

    res.json({
      totalEmployees: employees.length,
      totalPaidThisMonth,
      paidCount: paidEmployeeIds.length,
      unpaidCount: unpaidEmployees.length,
      unpaidEmployees
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadSalarySlip = async (req, res) => {
    try {
      const payment = await SalaryPayment.findById(req.params.paymentId);
      if (!payment) return res.status(404).json({ message: 'Paiement introuvable' });
      const employee = await Employee.findById(payment.employee);
      await generateSalarySlipPDF(payment, employee, res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};
  
module.exports = { getEmployees, getEmployee, createEmployee, updateEmployee, deleteEmployee, paySalary, getSalaryStats, downloadSalarySlip };