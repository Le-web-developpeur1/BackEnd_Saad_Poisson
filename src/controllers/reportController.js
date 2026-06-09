const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const { exportPDF, exportWord, exportCSV } = require('../utils/exportReport');

const getDailyReport = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(targetDate.setHours(0, 0, 0, 0));
    const end = new Date(targetDate.setHours(23, 59, 59, 999));

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalCash = sales.filter(s => s.paymentType === 'comptant').reduce((sum, s) => sum + s.amountPaid, 0);
    const totalCredit = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      date: start,
      totalSales,
      totalCash,
      totalCredit,
      totalExpenses,
      netProfit: totalSales - totalExpenses,
      salesCount: sales.length,
      sales,
      expenses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getMonthlyReport = async (req, res) => {
  try {
    const { month, year } = req.query;
    const m = month ? parseInt(month) - 1 : new Date().getMonth();
    const y = year ? parseInt(year) : new Date().getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });

    const totalSales = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    res.json({
      month: m + 1, year: y, totalSales, totalExpenses,
      netProfit: totalSales - totalExpenses,
      salesCount: sales.length, expensesCount: expenses.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getStockReport = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true });
    const lowStock = products.filter(p => p.stockCartons <= p.alertThreshold);
    const movements = await StockMovement.find().sort({ createdAt: -1 }).limit(50).populate('product', 'name');
    res.json({ products, lowStock, movements });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getDebtReport = async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true, currentDebt: { $gt: 0 } }).sort({ currentDebt: -1 });
    const totalDebt = clients.reduce((sum, c) => sum + c.currentDebt, 0);
    res.json({ clients, totalDebt });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSupplierReport = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ balance: -1 });
    const totalOwed = suppliers.reduce((sum, s) => sum + s.balance, 0);
    res.json({ suppliers, totalOwed });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// ── EXPORTS ───────────────────────────────────────────

const exportDailyReport = async (req, res) => {
  try {
    const { format, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
    const end = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });

    const title = `Rapport Journalier — ${start.toLocaleDateString('fr-FR')}`;
    const headers = ['N° Vente', 'Client', 'Montant', 'Type', 'Statut', 'Date'];
    const rows = sales.map(s => [
      s.saleNumber, s.clientName,
      `${s.totalAmount.toLocaleString('fr-FR')} GNF`,
      s.paymentType, s.status,
      new Date(s.createdAt).toLocaleDateString('fr-FR')
    ]);

    if (format === 'pdf') return exportPDF(title, headers, rows, res, `rapport-journalier-${start.toISOString().split('T')[0]}`);
    if (format === 'word') return await exportWord(title, headers, rows, res, `rapport-journalier-${start.toISOString().split('T')[0]}`);
    if (format === 'csv') return await exportCSV(headers, rows, res, `rapport-journalier-${start.toISOString().split('T')[0]}`);

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportMonthlyReport = async (req, res) => {
  try {
    const { format, month, year } = req.query;
    const m = month ? parseInt(month) - 1 : new Date().getMonth();
    const y = year ? parseInt(year) : new Date().getFullYear();
    const start = new Date(y, m, 1);
    const end = new Date(y, m + 1, 0, 23, 59, 59);

    const sales = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const title = `Rapport Mensuel — ${m + 1}/${y}`;
    const headers = ['N° Vente', 'Client', 'Montant', 'Type', 'Statut', 'Date'];
    const rows = sales.map(s => [
      s.saleNumber, s.clientName,
      `${s.totalAmount.toLocaleString('fr-FR')} GNF`,
      s.paymentType, s.status,
      new Date(s.createdAt).toLocaleDateString('fr-FR')
    ]);

    if (format === 'pdf') return exportPDF(title, headers, rows, res, `rapport-mensuel-${m + 1}-${y}`);
    if (format === 'word') return await exportWord(title, headers, rows, res, `rapport-mensuel-${m + 1}-${y}`);
    if (format === 'csv') return await exportCSV(headers, rows, res, `rapport-mensuel-${m + 1}-${y}`);

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportStockReport = async (req, res) => {
  try {
    const { format } = req.query;
    const products = await Product.find({ isActive: true });
    const title = 'Rapport des Stocks';
    const headers = ['Produit', 'Catégorie', 'Stock Cartons', 'Stock Kg', 'Prix/Carton', 'Prix/Kg', 'Alerte'];
    const rows = products.map(p => [
      p.name, p.category,
      p.stockCartons, p.stockKg,
      `${p.pricePerCarton.toLocaleString('fr-FR')} GNF`,
      `${p.pricePerKg.toLocaleString('fr-FR')} GNF`,
      p.stockCartons <= p.alertThreshold ? '⚠️ Stock bas' : '✅ OK'
    ]);

    if (format === 'pdf') return exportPDF(title, headers, rows, res, 'rapport-stocks');
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-stocks');
    if (format === 'csv') return await exportCSV(headers, rows, res, 'rapport-stocks');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportDebtReport = async (req, res) => {
  try {
    const { format } = req.query;
    const clients = await Client.find({ isActive: true, currentDebt: { $gt: 0 } }).sort({ currentDebt: -1 });
    const title = 'Rapport des Dettes Clients';
    const headers = ['Client', 'Téléphone', 'Plafond', 'Dette Actuelle', 'Statut'];
    const rows = clients.map(c => [
      c.name, c.phone || '—',
      `${c.creditLimit.toLocaleString('fr-FR')} GNF`,
      `${c.currentDebt.toLocaleString('fr-FR')} GNF`,
      c.isBlocked ? '🔴 Bloqué' : '🟢 Actif'
    ]);

    if (format === 'pdf') return exportPDF(title, headers, rows, res, 'rapport-dettes');
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-dettes');
    if (format === 'csv') return await exportCSV(headers, rows, res, 'rapport-dettes');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportSupplierReport = async (req, res) => {
  try {
    const { format } = req.query;
    const suppliers = await Supplier.find({ isActive: true });
    const title = 'Rapport des Fournisseurs';
    const headers = ['Fournisseur', 'Téléphone', 'Total Achats', 'Total Payé', 'Solde Restant'];
    const rows = suppliers.map(s => [
      s.name, s.phone || '—',
      `${s.totalPurchases.toLocaleString('fr-FR')} GNF`,
      `${s.totalPaid.toLocaleString('fr-FR')} GNF`,
      `${s.balance.toLocaleString('fr-FR')} GNF`
    ]);

    if (format === 'pdf') return exportPDF(title, headers, rows, res, 'rapport-fournisseurs');
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-fournisseurs');
    if (format === 'csv') return await exportCSV(headers, rows, res, 'rapport-fournisseurs');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getDailyReport, getMonthlyReport, getStockReport, getDebtReport, getSupplierReport,
  exportDailyReport, exportMonthlyReport, exportStockReport, exportDebtReport, exportSupplierReport
};