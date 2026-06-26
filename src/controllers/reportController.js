const Sale = require('../models/Sale');
const Expense = require('../models/Expense');
const Product = require('../models/Product');
const Client = require('../models/Client');
const Supplier = require('../models/Supplier');
const StockMovement = require('../models/StockMovement');
const SystemConfig = require('../models/SystemConfig');
const Damage = require('../models/Damage');
const ClientPayment = require('../models/ClientPayment');
const { exportPDF, exportWord, exportCSV } = require('../utils/exportReport');

const formatAmount = (amount) => {
  if (amount === undefined || amount === null || isNaN(amount)) return '0';
  return Number(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
};

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

const exportDailyReport = async (req, res) => {
  try {
    const { format, date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const start = new Date(new Date(targetDate).setHours(0, 0, 0, 0));
    const end   = new Date(new Date(targetDate).setHours(23, 59, 59, 999));

    const sales    = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });
    const config   = await SystemConfig.findOne();

    const totalVentes   = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalEncaisse = sales.reduce((sum, s) => sum + s.amountPaid, 0);
    const totalDepenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const benefice      = totalEncaisse - totalDepenses;

    const title   = `Rapport Journalier — ${start.toLocaleDateString('fr-FR')}`;
    const headers = ['N° Vente', 'Client', 'Montant', 'Type', 'Statut', 'Date'];
    const rows    = sales.map(s => [
      s.saleNumber,
      s.clientName,
      `${formatAmount(s.totalAmount)} GNF`,
      s.paymentType,
      s.status,
      new Date(s.createdAt).toLocaleDateString('fr-FR')
    ]);

    const totals = [
      { label: 'Total ventes',   value: `${formatAmount(totalVentes)} GNF`,   highlight: false },
      { label: 'Total encaissé', value: `${formatAmount(totalEncaisse)} GNF`, highlight: false },
      { label: 'Total dépenses', value: `${formatAmount(totalDepenses)} GNF`, highlight: false },
      { label: 'Bénéfice net',   value: `${formatAmount(benefice)} GNF`,      highlight: true  },
    ];

    const fname = `rapport-journalier-${start.toISOString().split('T')[0]}`;
    if (format === 'pdf')  return await exportPDF(title, headers, rows, res, fname, totals, config);
    if (format === 'word') return await exportWord(title, headers, rows, res, fname);
    if (format === 'csv')  return await exportCSV(headers, rows, res, fname);

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const exportMonthlyReport = async (req, res) => {
  try {
    const { format, month, year } = req.query;
    const m      = month ? parseInt(month) - 1 : new Date().getMonth();
    const y      = year  ? parseInt(year)       : new Date().getFullYear();
    const start  = new Date(y, m, 1);
    const end    = new Date(y, m + 1, 0, 23, 59, 59);
    const config = await SystemConfig.findOne();

    const sales    = await Sale.find({ createdAt: { $gte: start, $lte: end } });
    const expenses = await Expense.find({ date: { $gte: start, $lte: end } });

    const totalVentes   = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    const totalEncaisse = sales.reduce((sum, s) => sum + s.amountPaid, 0);
    const totalDepenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const benefice      = totalEncaisse - totalDepenses;

    const title   = `Rapport Mensuel — ${m + 1}/${y}`;
    const headers = ['N° Vente', 'Client', 'Montant', 'Type', 'Statut', 'Date'];
    const rows    = sales.map(s => [
      s.saleNumber,
      s.clientName,
      `${formatAmount(s.totalAmount)} GNF`,
      s.paymentType,
      s.status,
      new Date(s.createdAt).toLocaleDateString('fr-FR')
    ]);

    const totals = [
      { label: 'Total ventes',   value: `${formatAmount(totalVentes)} GNF`,   highlight: false },
      { label: 'Total encaissé', value: `${formatAmount(totalEncaisse)} GNF`, highlight: false },
      { label: 'Total dépenses', value: `${formatAmount(totalDepenses)} GNF`, highlight: false },
      { label: 'Bénéfice net',   value: `${formatAmount(benefice)} GNF`,      highlight: true  },
    ];

    const fname = `rapport-mensuel-${m + 1}-${y}`;
    if (format === 'pdf')  return await exportPDF(title, headers, rows, res, fname, totals, config);
    if (format === 'word') return await exportWord(title, headers, rows, res, fname);
    if (format === 'csv')  return await exportCSV(headers, rows, res, fname);

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const exportStockReport = async (req, res) => {
  try {
    const { format } = req.query;
    const products   = await Product.find({ isActive: true });
    const config     = await SystemConfig.findOne();

    const title   = 'Rapport des Stocks';
    const headers = ['Produit', 'Catégorie', 'Stock Cartons', 'Stock Kg', 'Prix/Carton', 'Prix/Kg', 'Statut'];
    const rows    = products.map(p => [
      p.name,
      p.category || '—',
      p.stockCartons,
      `${p.stockKg} kg`,
      `${formatAmount(p.pricePerCarton)} GNF`,
      `${formatAmount(p.pricePerKg)} GNF`,
      p.stockCartons <= p.alertThreshold ? 'Stock bas' : 'OK'
    ]);

    const totalCartons = products.reduce((sum, p) => sum + p.stockCartons, 0);
    const totalKg      = products.reduce((sum, p) => sum + p.stockKg, 0);
    const totals = [
      { label: 'Total produits',         value: String(products.length), highlight: false },
      { label: 'Total cartons en stock', value: String(totalCartons),    highlight: false },
      { label: 'Total kg en stock',      value: `${totalKg} kg`,         highlight: true  },
    ];

    if (format === 'pdf')  return await exportPDF(title, headers, rows, res, 'rapport-stocks', totals, config);
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-stocks');
    if (format === 'csv')  return await exportCSV(headers, rows, res, 'rapport-stocks');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const exportDebtReport = async (req, res) => {
  try {
    const { format } = req.query;
    const clients    = await Client.find({ isActive: true, currentDebt: { $gt: 0 } }).sort({ currentDebt: -1 });
    const config     = await SystemConfig.findOne();

    const title   = 'Rapport des Dettes Clients';
    const headers = ['Client', 'Téléphone', 'Plafond', 'Dette actuelle', 'Statut'];
    const rows    = clients.map(c => [
      c.name,
      c.phone || '—',
      `${formatAmount(c.creditLimit)} GNF`,
      `${formatAmount(c.currentDebt)} GNF`,
      c.isBlocked ? 'Bloqué' : 'Actif'
    ]);

    const totalDette = clients.reduce((sum, c) => sum + c.currentDebt, 0);
    const totals = [
      { label: 'Nombre de clients débiteurs', value: String(clients.length),           highlight: false },
      { label: 'Total dettes',                value: `${formatAmount(totalDette)} GNF`, highlight: true  },
    ];

    if (format === 'pdf')  return await exportPDF(title, headers, rows, res, 'rapport-dettes', totals, config);
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-dettes');
    if (format === 'csv')  return await exportCSV(headers, rows, res, 'rapport-dettes');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const exportSupplierReport = async (req, res) => {
  try {
    const { format } = req.query;
    const suppliers  = await Supplier.find({ isActive: true });
    const config     = await SystemConfig.findOne();

    const title   = 'Rapport des Fournisseurs';
    const headers = ['Fournisseur', 'Téléphone', 'Total achats', 'Total payé', 'Solde restant'];
    const rows    = suppliers.map(s => [
      s.name,
      s.phone || '—',
      `${formatAmount(s.totalPurchases)} GNF`,
      `${formatAmount(s.totalPaid)} GNF`,
      `${formatAmount(s.balance)} GNF`
    ]);

    const totalAchats  = suppliers.reduce((sum, s) => sum + s.totalPurchases, 0);
    const totalPaye    = suppliers.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalRestant = suppliers.reduce((sum, s) => sum + s.balance, 0);
    const totals = [
      { label: 'Total achats',  value: `${formatAmount(totalAchats)} GNF`,   highlight: false },
      { label: 'Total payé',    value: `${formatAmount(totalPaye)} GNF`,     highlight: false },
      { label: 'Total à payer', value: `${formatAmount(totalRestant)} GNF`,  highlight: true  },
    ];

    if (format === 'pdf')  return await exportPDF(title, headers, rows, res, 'rapport-fournisseurs', totals, config);
    if (format === 'word') return await exportWord(title, headers, rows, res, 'rapport-fournisseurs');
    if (format === 'csv')  return await exportCSV(headers, rows, res, 'rapport-fournisseurs');

    res.status(400).json({ message: 'Format invalide. Utilisez pdf, word ou csv' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const getCaisseReport = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    let filter = {};

    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }

    const sales          = await Sale.find(filter).sort({ createdAt: -1 });
    const clientPayments = await ClientPayment.find(filter.createdAt ? { createdAt: filter.createdAt } : {});
    const expenses       = await Expense.find(
      startDate && endDate ? { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } : {}
    );

    // ── Calculs globaux ───────────────────────────────
    const totalClientPayments = clientPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalComptant = sales
      .filter(s => s.paymentType === 'comptant')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const totalVirement = sales
      .filter(s => s.paymentType === 'virement')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const totalAmountPaidCredit = sales
      .filter(s => s.paymentType === 'credit')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const totalAcomptesInitiaux = Math.max(0, totalAmountPaidCredit - totalClientPayments);

    const totalEncaisse = totalComptant + totalAcomptesInitiaux + totalClientPayments;
    const totalVentes   = sales.reduce((sum, s) => sum + s.totalAmount, 0);
    
    // ✅ Correct — lit currentDebt sur les clients comme le module Capital
    const clientsWithDebt = await Client.find({ isActive: true, currentDebt: { $gt: 0 } });
    const totalCredit = clientsWithDebt.reduce((sum, c) => sum + c.currentDebt, 0);
    const totalDepenses = expenses.reduce((sum, e) => sum + e.amount, 0);
    const soldeCaisse   = totalEncaisse - totalDepenses;

    // ── Aujourd'hui ───────────────────────────────────
    const today      = new Date();
    const startToday = new Date(new Date().setHours(0, 0, 0, 0));
    const endToday   = new Date(new Date().setHours(23, 59, 59, 999));

    const salesToday         = await Sale.find({ createdAt: { $gte: startToday, $lte: endToday } });
    const clientPayToday     = await ClientPayment.find({ createdAt: { $gte: startToday, $lte: endToday } });
    const expensesToday      = await Expense.find({ date: { $gte: startToday, $lte: endToday } });

    const comptantToday      = salesToday.filter(s => s.paymentType === 'comptant').reduce((sum, s) => sum + s.amountPaid, 0);
    const creditPaidToday    = salesToday.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.amountPaid, 0);
    const clientPayTodayTotal = clientPayToday.reduce((sum, p) => sum + p.amount, 0);
    const acomptesToday      = Math.max(0, creditPaidToday - clientPayTodayTotal);
    const encaisseAujourdhui = comptantToday + acomptesToday + clientPayTodayTotal;
    const depensesAujourdhui = expensesToday.reduce((sum, e) => sum + e.amount, 0);

    // ── Ce mois ───────────────────────────────────────
    const now        = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const salesMonth          = await Sale.find({ createdAt: { $gte: startMonth, $lte: endMonth } });
    const clientPayMonth      = await ClientPayment.find({ createdAt: { $gte: startMonth, $lte: endMonth } });
    const expensesMonth       = await Expense.find({ date: { $gte: startMonth, $lte: endMonth } });

    const comptantMonth       = salesMonth.filter(s => s.paymentType === 'comptant').reduce((sum, s) => sum + s.amountPaid, 0);
    const creditPaidMonth     = salesMonth.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.amountPaid, 0);
    const clientPayMonthTotal = clientPayMonth.reduce((sum, p) => sum + p.amount, 0);
    const acomptesMonth       = Math.max(0, creditPaidMonth - clientPayMonthTotal);
    const encaisseMois        = comptantMonth + acomptesMonth + clientPayMonthTotal;
    const depensesMois        = expensesMonth.reduce((sum, e) => sum + e.amount, 0);
    const soldeMois           = encaisseMois - depensesMois;

    res.json({
      totalVentes,
      totalEncaisse,
      totalComptant,
      totalVirement,
      totalCredit,
      totalDepenses,
      soldeCaisse,
      nbTransactions: sales.length,

      encaisseAujourdhui,
      depensesAujourdhui,
      soldeAujourdhui: encaisseAujourdhui - depensesAujourdhui,
      nbTransactionsAujourdhui: salesToday.length,

      encaisseMois,
      depensesMois,
      soldeMois,
      nbTransactionsMois: salesMonth.length,

      sales,
      expenses
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCapitalReport = async (req, res) => {
  try {
    const products       = await Product.find({ isActive: true });
    const sales          = await Sale.find();
    const damages        = await Damage.find();
    const expenses       = await Expense.find();
    const clients        = await Client.find({ isActive: true });
    const clientPayments = await ClientPayment.find();

    // ── 1. CAPITAL INITIAL ─────────────────────────
    // Somme de (stockInitialCartons × purchasePricePerCarton)
    const capitalInitial = products.reduce((sum, p) =>
      sum + ((p.stockInitialCartons || 0) * (p.purchasePricePerCarton || 0)), 0
    );

    // ── 2. CHIFFRE D'AFFAIRES ESTIMÉ ───────────────
    // Somme de (stockCartons actuels × pricePerCarton)
    const chiffreAffairesEstime = products.reduce((sum, p) =>
      sum + ((p.stockInitialCartons || 0) * p.pricePerCarton), 0
    );
    
    // ── 7. AVARIES ────────────────────────────────
    const avaries = damages.reduce((sum, d) => sum + d.estimatedLoss, 0);

    // ── 3. STOCK FINAL ────────────────────────────────
      // Capital initial - valeur des ventes au prix d'achat - avaries
      const valeurVentesAchat = sales.reduce((sum, s) => {
        return sum + s.items.reduce((iSum, item) => {
          const product = products.find(p => p._id.toString() === item.product.toString());
          if (!product) return iSum;
          const prixAchat  = product.purchasePricePerCarton || 0;
          const qtyCartons = item.unit === 'carton'
            ? item.quantity
            : item.quantity / (product.kgPerCarton || 1);
          return iSum + (qtyCartons * prixAchat);
        }, 0);
      }, 0);

      const stockFinal = Math.max(0, capitalInitial - valeurVentesAchat - avaries);

    // ── 4. CAISSE ─────────────────────────────────
    const totalVentesComptant = sales
      .filter(s => s.paymentType === 'comptant')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    
    const totalClientPayments = clientPayments.reduce((sum, p) => sum + p.amount, 0);

    const totalAcomptesPaidCredit = sales
      .filter(s => s.paymentType === 'credit')
      .reduce((sum, s) => sum + s.amountPaid, 0);
    
    const totalAcomptesInitiaux = Math.max(0, totalAcomptesPaidCredit - totalClientPayments);

    const totalDepenses       = expenses.reduce((sum, e) => sum + e.amount, 0);
    const caisse              = totalVentesComptant + totalAcomptesInitiaux + totalClientPayments - totalDepenses;

    // ── 5. BANQUE ──────────────────────────────────
    const banque = sales
      .filter(s => s.paymentType === 'virement')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    // ── 6. CRÉDITS ────────────────────────────────
    const credits = clients.reduce((sum, c) => sum + c.currentDebt, 0);

    
    // ── 8. CAPITAL DISPONIBLE ─────────────────────────
    // Stock final + Caisse + Banque + Crédits 
    const capitalDisponible = stockFinal + caisse + banque + credits;
        res.json({
          capitalInitial,
          chiffreAffairesEstime,
          stockFinal,
          caisse,
          banque,
          credits,
          avaries,
          totalDepenses,
          capitalDisponible,
          details: {
            totalVentesComptant,
            totalAcomptesInitiaux,
            totalClientPayments,
            valeurVentesAchat,
            nbProduits:  products.length,
            nbClients:   clients.filter(c => c.currentDebt > 0).length,
          }
        });
      } catch (error) {
        res.status(500).json({ message: error.message });
      }
};

module.exports = {
  getDailyReport, getMonthlyReport, getStockReport, getDebtReport,
  getSupplierReport, exportDailyReport, exportMonthlyReport,
  exportStockReport, exportDebtReport, exportSupplierReport,
  getCaisseReport, getCapitalReport
};