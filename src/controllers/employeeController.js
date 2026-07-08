const Employee = require('../models/Employee');
const SalaryPayment = require('../models/SalaryPayment');
const SalaryAdvance = require('../models/SalaryAdvance');
const Expense = require('../models/Expense');
const { generateSalarySlipPDF } = require('../utils/generateInvoicePDF');


// @desc    Tous les employés
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
const createEmployee = async (req, res) => {
  try {
    const employee = await Employee.create(req.body);
    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier un employé
const updateEmployee = async (req, res) => {
  try {
    const employee = await Employee.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });
    res.json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimé un employé
const deleteEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

    // 🆕 VÉRIFICATION 1 : Avances en attente
    const pendingAdvances = await SalaryAdvance.countDocuments({
      employee: employee._id,
      status: 'en_attente'
    });

    if (pendingAdvances > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer cet employé : ${pendingAdvances} avance(s) en attente non déduite(s).`,
        pendingAdvances
      });
    }

    // 🆕 VÉRIFICATION 2 : Vérifier l'historique
    const paymentsCount = await SalaryPayment.countDocuments({ employee: employee._id });
    const advancesCount = await SalaryAdvance.countDocuments({ employee: employee._id });
    const StockMovement = require('../models/StockMovement');
    const movementsCount = await StockMovement.countDocuments({ recordedBy: employee._id });
    
    const hasActivity = paymentsCount > 0 || advancesCount > 0 || movementsCount > 0;

    if (hasActivity) {
      // 🆕 Soft delete pour préserver l'historique
      employee.isActive = false;
      employee.name = `[ARCHIVÉ] ${employee.name}`;
      await employee.save();

      return res.json({ 
        message: 'Employé archivé avec succès (historique préservé)',
        employee,
        archived: true,
        stats: {
          paymentsCount,
          advancesCount,
          movementsCount
        }
      });
    } else {
      // Hard delete si aucune activité
      await Employee.findByIdAndDelete(req.params.id);
      
      return res.json({ 
        message: 'Employé supprimé définitivement (aucune activité)',
        deleted: true
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 RÉACTIVER UN EMPLOYÉ ARCHIVÉ
const restoreEmployee = async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

    if (employee.isActive) {
      return res.status(400).json({ message: 'Cet employé est déjà actif' });
    }

    // Retirer le préfixe [ARCHIVÉ]
    if (employee.name.startsWith('[ARCHIVÉ] ')) {
      employee.name = employee.name.replace('[ARCHIVÉ] ', '');
    }

    employee.isActive = true;
    await employee.save();

    res.json({ 
      message: 'Employé réactivé avec succès',
      employee
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 LISTER LES EMPLOYÉS ARCHIVÉS
const getArchivedEmployees = async (req, res) => {
  try {
    const archivedEmployees = await Employee.find({ isActive: false }).sort({ name: 1 });
    res.json(archivedEmployees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Payer un salaire
const paySalary = async (req, res) => {
  try {
    const { amount, period, daysWorked, note } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });

    // Récupérer les avances en attente
    const advancesEnAttente = await SalaryAdvance.find({
      employee: employee._id,
      status:   'en_attente'
    });
    const totalAvances = advancesEnAttente.reduce((sum, a) => sum + a.amount, 0);

    // Montant net à payer = salaire - avances
    const montantBrut = Number(amount);
    const montantNet  = Math.max(0, montantBrut - totalAvances);

    // Créer la dépense pour le net payé
    const expense = await Expense.create({
      title:      `Salaire — ${employee.name} (${period})`,
      category:   'salaire',
      amount:     montantNet,
      date:       new Date(),
      note:       note || `Paiement salaire ${employee.position} — Brut: ${montantBrut} GNF, Avances déduites: ${totalAvances} GNF`,
      recordedBy: req.user._id
    });

    // Enregistrer le paiement
    const payment = await SalaryPayment.create({
      employee:     employee._id,
      employeeName: employee.name,
      position:     employee.position,
      period,
      daysWorked:   daysWorked || null,
      amount:       montantNet,
      note,
      paidBy:       req.user._id,
      expenseId:    expense._id
    });

    // Marquer les avances comme déduites
    await SalaryAdvance.updateMany(
      { employee: employee._id, status: 'en_attente' },
      { status: 'déduit', deductedFrom: payment._id }
    );

    res.status(201).json({
      message:      'Salaire payé avec succès',
      payment,
      expense,
      montantBrut,
      totalAvances,
      montantNet
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stats salaires
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

// @desc    Accorder une avance sur salaire
// @route   POST /api/employees/:id/advance
const giveAdvance = async (req, res) => {
  try {
    const { amount, reason } = req.body;
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employé introuvable' });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Montant invalide' });

    // Créer une dépense automatiquement
    const expense = await Expense.create({
      title:      `Avance sur salaire — ${employee.name}`,
      category:   'salaire',
      amount:     Number(amount),
      date:       new Date(),
      note:       reason || `Avance sur salaire de ${employee.position}`,
      recordedBy: req.user._id
    });

    // Enregistrer l'avance
    const advance = await SalaryAdvance.create({
      employee:     employee._id,
      employeeName: employee.name,
      amount:       Number(amount),
      reason:       reason || '',
      status:       'en_attente',
      paidBy:       req.user._id,
      expenseId:    expense._id
    });

    res.status(201).json({ message: 'Avance enregistrée', advance, expense });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Historique des avances d'un employé
// @route   GET /api/employees/:id/advances
const getAdvances = async (req, res) => {
  try {
    const advances = await SalaryAdvance.find({ employee: req.params.id })
      .sort({ createdAt: -1 });
    const totalEnAttente = advances
      .filter(a => a.status === 'en_attente')
      .reduce((sum, a) => sum + a.amount, 0);
    res.json({ advances, totalEnAttente });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
module.exports = {
  getEmployees, getEmployee, createEmployee, updateEmployee,
  deleteEmployee, restoreEmployee, getArchivedEmployees,
  paySalary, getSalaryStats,
  downloadSalarySlip, giveAdvance, getAdvances
};