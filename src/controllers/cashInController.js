const CashIn = require('../models/CashIn');
const BankIn = require('../models/BankIn');

// @desc    Alimenter la caisse
// @route   POST /api/cashin
const addCashIn = async (req, res) => {
  try {
    const { amount, reason, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (!reason) return res.status(400).json({ message: 'Raison obligatoire' });

    const cashIn = await CashIn.create({
      amount:     Number(amount),
      reason,
      note:       note || '',
      recordedBy: req.user._id
    });

    res.status(201).json({ message: 'Caisse alimentée', cashIn });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Alimenter la banque
// @route   POST /api/cashin/bank
const addBankIn = async (req, res) => {
  try {
    const { amount, reason, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (!reason) return res.status(400).json({ message: 'Raison obligatoire' });

    const bankIn = await BankIn.create({
      amount:     Number(amount),
      reason,
      note:       note || '',
      recordedBy: req.user._id
    });

    res.status(201).json({ message: 'Banque alimentée', bankIn });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Historique alimentations caisse
// @route   GET /api/cashin
const getCashIns = async (req, res) => {
  try {
    const cashIns = await CashIn.find().sort({ createdAt: -1 });
    const total = cashIns.reduce((sum, c) => sum + c.amount, 0);
    res.json({ cashIns, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Historique alimentations banque
// @route   GET /api/cashin/bank
const getBankIns = async (req, res) => {
  try {
    const bankIns = await BankIn.find().sort({ createdAt: -1 });
    const total = bankIns.reduce((sum, b) => sum + b.amount, 0);
    res.json({ bankIns, total });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { addCashIn, addBankIn, getCashIns, getBankIns };