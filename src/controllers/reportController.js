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
const SupplierExpense = require('../models/SupplierExpense');
const BankTransfer = require('../models/BankTransfer');
const CashIn = require('../models/CashIn');
const BankIn = require('../models/BankIn');

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

    const totalCash = sales
      .filter(s => s.paymentType === 'comptant')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const totalVirement = sales
      .filter(s => s.paymentType === 'virement')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    // Encaissé total = comptant + virement (caisse + banque)
    const totalEncaisse = totalCash + totalVirement;

    const totalCredit = sales
      .filter(s => s.paymentType === 'credit')
      .reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

      
      const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
      
      const totalCreditRembourses = await ClientPayment.find()
        .then(payments => payments.reduce((sum, p) => sum + p.amount, 0));
          
      // Crédits remboursés aujourd'hui
      const paymentsToday = await ClientPayment.find({
        createdAt: { $gte: start, $lte: end }
      });

      const creditRembourseToday =  paymentsToday
        .reduce((sum, p) => sum + p.amount, 0);
      
    res.json({
      date: start,
      totalSales,
      totalCash,
      totalVirement,
      totalEncaisse,
      totalCredit,
      totalExpenses,
      totalCreditRembourses,
      creditRembourseToday,
      netProfit: totalEncaisse - totalExpenses,
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
    const totalCredit = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.totalAmount, 0);


    res.json({
      month: m + 1, year: y, totalSales, totalExpenses, totalCredit,
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

    //Valeur totale du stock au prix de vente
    const valeurStockVente = products.reduce((sum, p) => 
      sum + (p.stockCartons * p.pricePerCarton), 0
    );

    //Valeur totale du stock au prix d'achat
    const valeurStockAchat = products.reduce((sum, p) => 
      sum + (p.stockCartons * (p.purchasePricePerCarton || 0)), 0
    );

    res.json({ products, lowStock, movements, valeurStockAchat, valeurStockVente });
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
    const totalCredit = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + (s.remainingAmount || 0), 0);

    const benefice = totalEncaisse - totalDepenses;

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
      { label: 'Crédits en cours', value: `${formatAmount(totalCredit)} GNF`, highlight: false },
      { label: 'Total dépenses', value: `${formatAmount(totalDepenses)} GNF`, highlight: false },
      { label: 'Total disponible',   value: `${formatAmount(benefice)} GNF`,      highlight: true  },
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
    const totalCredit   = sales.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + (s.remainingAmount || 0), 0);
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
      { label: 'Crédit en cours', value: `${formatAmount(totalCredit)} GNF`, highlight: false },
      { label: 'Total dépenses', value: `${formatAmount(totalDepenses)} GNF`, highlight: false },
      { label: 'Total disponible',   value: `${formatAmount(benefice)} GNF`,      highlight: true  },
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
    const headers = ['Produit', 'Catégorie', 'Stock Cartons', 'Prix/Carton (achat)', 'Valeur stock (achat)', 'Statut'];
    const rows    = products.map(p => [
      p.name,
      p.category || '—',
      String(p.stockCartons),
      `${formatAmount(p.purchasePricePerCarton || 0)} GNF`,
      `${formatAmount(p.stockCartons * (p.purchasePricePerCarton || 0))} GNF`,
      p.stockCartons <= p.alertThreshold ? 'Stock bas' : 'OK'
    ]);

    // Totaux
    const valeurStockAchat  = products.reduce((sum, p) => sum + (p.stockCartons * (p.purchasePricePerCarton || 0)), 0);
    const totalCartons       = products.reduce((sum, p) => sum + p.stockCartons, 0);
    const produitsStockBas   = products.filter(p => p.stockCartons <= p.alertThreshold).length;

    const totals = [
      { label: 'Total produits actifs',          value: String(products.length),                    highlight: false },
      { label: 'Total cartons en stock',          value: String(totalCartons),                       highlight: false },
      { label: 'Produits en stock bas',           value: String(produitsStockBas),                   highlight: false },
      { label: 'Valeur totale stock (prix achat)', value: `${formatAmount(valeurStockAchat)} GNF`,   highlight: true  },
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

    const sales            = await Sale.find(filter).sort({ createdAt: -1 });
    const clientPayments   = await ClientPayment.find(filter.createdAt ? { createdAt: filter.createdAt } : {});
    const expenses         = await Expense.find(
      startDate && endDate ? { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } : {}
    );
    const supplierExpenses = await SupplierExpense.find(
      startDate && endDate ? { date: { $gte: new Date(startDate), $lte: new Date(endDate) } } : {}
    );
    const transferts = await BankTransfer.find(
      filter.createdAt ? { createdAt: filter.createdAt } : {}
    );

    //Ajout de l'argent dans la caisse et de la banque
    const cashIns = await CashIn.find();
    const totalCashIns = cashIns.reduce((sum, c) => sum + c.amount, 0);

    
    // ── Calculs globaux ───────────────────────────────
    const clientPaymentsComptant = clientPayments
      .filter(p => p.modePaiement !== 'virement')
      .reduce((sum, p) => sum + p.amount, 0);
    const clientPaymentsVirement = clientPayments
      .filter(p => p.modePaiement === 'virement')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalClientPayments = clientPaymentsComptant + clientPaymentsVirement;

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

    const totalEncaisse = totalComptant + totalAcomptesInitiaux + clientPaymentsComptant;
    const totalVentes   = sales.reduce((sum, s) => sum + s.totalAmount, 0);

    const clientsWithDebt = await Client.find({ isActive: true, currentDebt: { $gt: 0 } });
    const totalCredit     = clientsWithDebt.reduce((sum, c) => sum + c.currentDebt, 0);
    //Crédit du jour
    const startToday = new Date(new Date().setHours(0, 0, 0, 0));
    const endToday   = new Date(new Date().setHours(23, 59, 59, 999));

    const clients = await Client.find({ isActive: true });

    const totalCreditToday = clients.reduce((sum, c) => {
      const debtsToday = c.debtHistory.filter(
        d => d.date >= startToday && d.date <= endToday
      );
      return sum + debtsToday.reduce((s, d) => s + d.amount, 0);
    }, 0);

    const totalDepenses = expenses.reduce((sum, e) => sum + e.amount, 0);

    // Dépenses caisse = uniquement les dépenses opérationnelles classiques
    const depensesComptant = totalDepenses;

    // Transferts banque → caisse = entrées caisse (depuis BankTransfer, pas Expense)
    const transfertsBanqueVersCaisse = transferts
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfertsCaisseVersBanque = transferts
      .filter(t => t.direction === 'caisse_vers_banque')
      .reduce((sum, t) => sum + t.amount, 0);

    const paiementsFournisseursComptant = supplierExpenses
      .filter(e => e.modePaiement === 'comptant')
      .reduce((sum, e) => sum + e.amount, 0);

    const soldeCaisse = totalEncaisse + transfertsBanqueVersCaisse - transfertsCaisseVersBanque
                       - depensesComptant - paiementsFournisseursComptant + totalCashIns;

    // ── Aujourd'hui ───────────────────────────────────
    const salesToday          = await Sale.find({ createdAt: { $gte: startToday, $lte: endToday } });
    const clientPayToday      = await ClientPayment.find({ createdAt: { $gte: startToday, $lte: endToday } });
    const expensesToday       = await Expense.find({ date: { $gte: startToday, $lte: endToday } });
    const supplierExpToday    = await SupplierExpense.find({ date: { $gte: startToday, $lte: endToday } });
    const transfertsToday     = await BankTransfer.find({ createdAt: { $gte: startToday, $lte: endToday } });

    const comptantToday          = salesToday.filter(s => s.paymentType === 'comptant').reduce((sum, s) => sum + s.amountPaid, 0);
    const creditPaidToday        = salesToday.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.amountPaid, 0);
    const clientPayTodayComptant = clientPayToday.filter(p => p.modePaiement !== 'virement').reduce((sum, p) => sum + p.amount, 0);
    const clientPayTodayTotal    = clientPayToday.reduce((sum, p) => sum + p.amount, 0);
    const acomptesToday          = Math.max(0, creditPaidToday - clientPayTodayTotal);
    const transfertsBanqueCaisseToday = transfertsToday
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);

    const paiementsFournisseursToday = supplierExpToday
      .filter(e => e.modePaiement === 'comptant')
      .reduce((sum, e) => sum + e.amount, 0);
      
    const encaisseAujourdhui   = comptantToday + acomptesToday + clientPayTodayComptant + transfertsBanqueCaisseToday;
    const depensesAujourdhui   = expensesToday.reduce((sum, e) => sum + e.amount, 0);

    // ── Ce mois ───────────────────────────────────────
    const now        = new Date();
    const startMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endMonth   = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const salesMonth        = await Sale.find({ createdAt: { $gte: startMonth, $lte: endMonth } });
    const clientPayMonth    = await ClientPayment.find({ createdAt: { $gte: startMonth, $lte: endMonth } });
    const expensesMonth     = await Expense.find({ date: { $gte: startMonth, $lte: endMonth } });
    const supplierExpMonth  = await SupplierExpense.find({ date: { $gte: startMonth, $lte: endMonth } });
    const transfertsMonth   = await BankTransfer.find({ createdAt: { $gte: startMonth, $lte: endMonth } });

    const comptantMonth          = salesMonth.filter(s => s.paymentType === 'comptant').reduce((sum, s) => sum + s.amountPaid, 0);
    const creditPaidMonth        = salesMonth.filter(s => s.paymentType === 'credit').reduce((sum, s) => sum + s.amountPaid, 0);
    const clientPayMonthComptant = clientPayMonth.filter(p => p.modePaiement !== 'virement').reduce((sum, p) => sum + p.amount, 0);
    const clientPayMonthTotal    = clientPayMonth.reduce((sum, p) => sum + p.amount, 0);
    const acomptesMonth          = Math.max(0, creditPaidMonth - clientPayMonthTotal);
    const transfertsBanqueCaisseMois = transfertsMonth
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);

    // Dépenses opérationnelles uniquement (loyer, salaires, transport...)
    const depensesMois = expensesMonth.reduce((sum, e) => sum + e.amount, 0);

    // Paiements fournisseurs — séparés, pas comptés comme "dépenses"
    const paiementsFournisseursMois = supplierExpMonth
      .filter(e => e.modePaiement === 'comptant')
      .reduce((sum, e) => sum + e.amount, 0);

    const encaisseMois = comptantMonth + acomptesMonth + clientPayMonthComptant + transfertsBanqueCaisseMois;

    // Solde du mois = encaissé − dépenses opérationnelles − paiements fournisseurs
    const soldeMois = encaisseMois - depensesMois - paiementsFournisseursMois;

    res.json({
      totalVentes,
      totalEncaisse,
      totalComptant,
      totalVirement,
      totalCredit,
      totalDepenses,
      depensesComptant,
      paiementsFournisseursComptant,
      clientPaymentsComptant,
      clientPaymentsVirement,
      soldeCaisse,
      nbTransactions: sales.length,
      comptantToday,
      encaisseAujourdhui,
      depensesAujourdhui,
      paiementsFournisseursToday,
      clientPayTodayComptant,
      soldeAujourdhui: encaisseAujourdhui - depensesAujourdhui - paiementsFournisseursToday,
      nbTransactionsAujourdhui: salesToday.length,
      encaisseMois,
      depensesMois,
      paiementsFournisseursMois,
      soldeMois,
      nbTransactionsMois: salesMonth.length,
      sales,
      expenses,
      totalCashIns,
      totalCreditToday
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCapitalReport = async (req, res) => {
  try {
    const products          = await Product.find({ isActive: true });
    const sales             = await Sale.find();
    const damages           = await Damage.find();
    const expenses          = await Expense.find();
    const supplierExpenses  = await SupplierExpense.find();
    const clients           = await Client.find({ isActive: true });
    const clientPayments    = await ClientPayment.find();
    const transferts        = await BankTransfer.find();

    //Ajout de l'argent dans la banque
    const bankIns = await BankIn.find();
    const totalBankIns = bankIns.reduce((sum, b) => sum + b.amount, 0);

    // ── 1. CAPITAL INITIAL ─────────────────────────
    const capitalInitial = products.reduce((sum, p) =>
      sum + ((p.stockInitialCartons || 0) * (p.purchasePricePerCarton || 0)), 0
    );

    // ── 2. CHIFFRE D'AFFAIRES ESTIMÉ ───────────────
    const chiffreAffairesEstime = products.reduce((sum, p) =>
      sum + ((p.stockInitialCartons || 0) * p.pricePerCarton), 0
    );

    // ── 7. AVARIES ────────────────────────────────
    const avaries = damages.reduce((sum, d) => sum + d.estimatedLoss, 0);

    // ── 3. STOCK FINAL ────────────────────────────
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

    const clientPaymentsComptant = clientPayments
      .filter(p => p.modePaiement !== 'virement')
      .reduce((sum, p) => sum + p.amount, 0);
    const clientPaymentsVirement = clientPayments
      .filter(p => p.modePaiement === 'virement')
      .reduce((sum, p) => sum + p.amount, 0);
    const totalClientPayments = clientPaymentsComptant + clientPaymentsVirement;

    const totalAcomptesPaidCredit = sales
      .filter(s => s.paymentType === 'credit')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const totalAcomptesInitiaux = Math.max(0, totalAcomptesPaidCredit - totalClientPayments);

    // Transferts depuis BankTransfer (plus depuis Expense)
    const transfertsBanqueVersCaisse = transferts
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);

    const transfertsCaisseVersBanque = transferts
      .filter(t => t.direction === 'caisse_vers_banque')
      .reduce((sum, t) => sum + t.amount, 0);

    const depensesComptant = expenses.reduce((sum, e) => sum + e.amount, 0);

    const paiementsFournisseursComptant = supplierExpenses
      .filter(e => e.modePaiement === 'comptant')
      .reduce((sum, e) => sum + e.amount, 0);

    const totalDepenses = depensesComptant;


    const cashIns = await CashIn.find();
    const totalCashIns = cashIns.reduce((sum, c) => sum + c.amount, 0);

    const caisse = totalVentesComptant + totalAcomptesInitiaux + clientPaymentsComptant
                   + transfertsBanqueVersCaisse - transfertsCaisseVersBanque + totalCashIns
                   - depensesComptant - paiementsFournisseursComptant;

    // ── 5. BANQUE ──────────────────────────────────
    const paiementsFournisseursVirement = supplierExpenses
      .filter(e => e.modePaiement === 'virement')
      .reduce((sum, e) => sum + e.amount, 0);

    const banque = sales
      .filter(s => s.paymentType === 'virement')
      .reduce((sum, s) => sum + s.amountPaid, 0)
      + clientPaymentsVirement
      + transfertsCaisseVersBanque + totalBankIns
      - paiementsFournisseursVirement
      - transfertsBanqueVersCaisse;

    // ── 6. CRÉDITS ────────────────────────────────
    const credits = clients.reduce((sum, c) => sum + c.currentDebt, 0);

    const totalPaiementsFournisseurs = paiementsFournisseursComptant + paiementsFournisseursVirement;

    // ── 8. CAPITAL DISPONIBLE ─────────────────────
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
      paiementsFournisseursComptant,
      paiementsFournisseursVirement,
      totalPaiementsFournisseurs,
      capitalDisponible,
      details: {
        totalVentesComptant,
        totalAcomptesInitiaux,
        totalClientPayments,
        clientPaymentsComptant,
        clientPaymentsVirement,
        valeurVentesAchat,
        nbProduits: products.length,
        nbClients:  clients.filter(c => c.currentDebt > 0).length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getCaisseMovements = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = startDate && endDate ? {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    } : null;

    // Toutes les sources de mouvements caisse
    const sales = await Sale.find(dateFilter ? { createdAt: dateFilter } : {});
    const clientPayments = await ClientPayment.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: { $ne: 'virement' } } : { modePaiement: { $ne: 'virement' } }
    );
    const expenses = await Expense.find(
      dateFilter ? { date: dateFilter } : {}
    );
    const supplierExpenses = await SupplierExpense.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'comptant' } : { modePaiement: 'comptant' }
    );
    const transferts = await BankTransfer.find(
      dateFilter ? { createdAt: dateFilter } : {}
    );
    const cashIns = await CashIn.find(
      dateFilter ? { createdAt: dateFilter } : {}
    );

    // Construire la liste des mouvements
    const mouvements = [
      // Ventes comptant → entrée
      ...sales.filter(s => s.paymentType === 'comptant').map(s => ({
        date:      s.createdAt,
        type:      'entrée',
        categorie: 'Vente comptant',
        libelle:   `Vente ${s.saleNumber} — ${s.clientName}`,
        montant:   s.amountPaid,
      })),
      // Acomptes initiaux sur ventes crédit → entrée
      ...sales.filter(s => s.paymentType === 'credit' && (s.initialAmountPaid || 0) > 0).map(s => ({
        date:      s.createdAt,
        type:      'entrée',
        categorie: 'Acompte crédit',
        libelle:   `Acompte ${s.saleNumber} — ${s.clientName}`,
        montant:   s.initialAmountPaid || 0,
      })),
      // Paiements de dettes clients comptant → entrée
      ...clientPayments.map(p => ({
        date:      p.createdAt,
        type:      'entrée',
        categorie: 'Remboursement crédit',
        libelle:   `Paiement dette — ${p.clientName}`,
        montant:   p.amount,
      })),
      // Transferts banque → caisse → entrée
      ...transferts.filter(t => t.direction === 'banque_vers_caisse').map(t => ({
        date:      t.createdAt,
        type:      'entrée',
        categorie: 'Transfert reçu',
        libelle:   `Transfert banque → caisse${t.note ? ' — ' + t.note : ''}`,
        montant:   t.amount,
      })),
      // Alimentations caisse → entrée
      ...cashIns.map(c => ({
        date:      c.createdAt,
        type:      'entrée',
        categorie: 'Alimentation',
        libelle:   `${c.reason}${c.note ? ' — ' + c.note : ''}`,
        montant:   c.amount,
      })),
      // Dépenses opérationnelles → sortie
      ...expenses.map(e => ({
        date:      e.date || e.createdAt,
        type:      'sortie',
        categorie: 'Dépense',
        libelle:   e.title,
        montant:   e.amount,
      })),
      // Paiements fournisseurs comptant → sortie
      ...supplierExpenses.map(e => ({
        date:      e.createdAt,
        type:      'sortie',
        categorie: 'Paiement fournisseur',
        libelle:   `${e.title} — ${e.supplierName}`,
        montant:   e.amount,
      })),
      // Transferts caisse → banque → sortie
      ...transferts.filter(t => t.direction === 'caisse_vers_banque').map(t => ({
        date:      t.createdAt,
        type:      'sortie',
        categorie: 'Transfert envoyé',
        libelle:   `Transfert caisse → banque${t.note ? ' — ' + t.note : ''}`,
        montant:   t.amount,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalEntrees = mouvements.filter(m => m.type === 'entrée').reduce((sum, m) => sum + m.montant, 0);
    const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((sum, m) => sum + m.montant, 0);
    const solde = totalEntrees - totalSorties;

    res.json({ mouvements, totalEntrees, totalSorties, solde });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getBankMovements = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = startDate && endDate ? {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    } : null;

    const sales = await Sale.find(dateFilter ? { createdAt: dateFilter } : {});
    const clientPayments = await ClientPayment.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'virement' } : { modePaiement: 'virement' }
    );
    const supplierExpenses = await SupplierExpense.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'virement' } : { modePaiement: 'virement' }
    );
    const transferts = await BankTransfer.find(
      dateFilter ? { createdAt: dateFilter } : {}
    );
    const bankIns = await BankIn.find(
      dateFilter ? { createdAt: dateFilter } : {}
    );

    const mouvements = [
      // Ventes virement → entrée
      ...sales.filter(s => s.paymentType === 'virement').map(s => ({
        date:      s.createdAt,
        type:      'entrée',
        categorie: 'Vente virement',
        libelle:   `Vente ${s.saleNumber} — ${s.clientName}`,
        montant:   s.amountPaid,
      })),
      // Paiements de dettes clients virement → entrée
      ...clientPayments.map(p => ({
        date:      p.createdAt,
        type:      'entrée',
        categorie: 'Remboursement crédit',
        libelle:   `Paiement dette — ${p.clientName}`,
        montant:   p.amount,
      })),
      // Transferts caisse → banque → entrée
      ...transferts.filter(t => t.direction === 'caisse_vers_banque').map(t => ({
        date:      t.createdAt,
        type:      'entrée',
        categorie: 'Transfert reçu',
        libelle:   `Transfert caisse → banque${t.note ? ' — ' + t.note : ''}`,
        montant:   t.amount,
      })),
      // Alimentations banque → entrée
      ...bankIns.map(b => ({
        date:      b.createdAt,
        type:      'entrée',
        categorie: 'Alimentation',
        libelle:   `${b.reason}${b.note ? ' — ' + b.note : ''}`,
        montant:   b.amount,
      })),
      // Paiements fournisseurs virement → sortie
      ...supplierExpenses.map(e => ({
        date:      e.createdAt,
        type:      'sortie',
        categorie: 'Paiement fournisseur',
        libelle:   `${e.title} — ${e.supplierName}`,
        montant:   e.amount,
      })),
      // Transferts banque → caisse → sortie
      ...transferts.filter(t => t.direction === 'banque_vers_caisse').map(t => ({
        date:      t.createdAt,
        type:      'sortie',
        categorie: 'Transfert envoyé',
        libelle:   `Transfert banque → caisse${t.note ? ' — ' + t.note : ''}`,
        montant:   t.amount,
      })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalEntrees = mouvements.filter(m => m.type === 'entrée').reduce((sum, m) => sum + m.montant, 0);
    const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((sum, m) => sum + m.montant, 0);
    const solde = totalEntrees - totalSorties;

    res.json({ mouvements, totalEntrees, totalSorties, solde });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const exportCaisseReport = async (req, res) => {
  try {
    const { format, startDate, endDate } = req.query;
    const dateFilter = startDate && endDate ? {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    } : null;

    // Réutilise la même logique que getCaisseMovements
    const req2 = { query: { startDate, endDate } };
    let mouvements = [], totalEntrees = 0, totalSorties = 0, solde = 0;

    // ... (même calcul que getCaisseMovements)
    // Pour éviter la duplication, appelle directement la logique
    const sales = await Sale.find(dateFilter ? { createdAt: dateFilter } : {});
    const clientPayments = await ClientPayment.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: { $ne: 'virement' } } : { modePaiement: { $ne: 'virement' } }
    );
    const expenses = await Expense.find(dateFilter ? { date: dateFilter } : {});
    const supplierExpenses = await SupplierExpense.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'comptant' } : { modePaiement: 'comptant' }
    );
    const transferts = await BankTransfer.find(dateFilter ? { createdAt: dateFilter } : {});
    const cashIns = await CashIn.find(dateFilter ? { createdAt: dateFilter } : {});
    const config = await SystemConfig.findOne();

    mouvements = [
      ...sales.filter(s => s.paymentType === 'comptant').map(s => ({ date: s.createdAt, type: 'entrée', categorie: 'Vente comptant', libelle: `Vente ${s.saleNumber} — ${s.clientName}`, montant: s.amountPaid })),
      ...sales.filter(s => s.paymentType === 'credit' && (s.initialAmountPaid || 0) > 0).map(s => ({ date: s.createdAt, type: 'entrée', categorie: 'Acompte crédit', libelle: `Acompte ${s.saleNumber} — ${s.clientName}`, montant: s.initialAmountPaid || 0 })),
      ...clientPayments.map(p => ({ date: p.createdAt, type: 'entrée', categorie: 'Remboursement crédit', libelle: `Paiement dette — ${p.clientName}`, montant: p.amount })),
      ...transferts.filter(t => t.direction === 'banque_vers_caisse').map(t => ({ date: t.createdAt, type: 'entrée', categorie: 'Transfert reçu', libelle: `Transfert banque → caisse${t.note ? ' — ' + t.note : ''}`, montant: t.amount })),
      ...cashIns.map(c => ({ date: c.createdAt, type: 'entrée', categorie: 'Alimentation', libelle: `${c.reason}${c.note ? ' — ' + c.note : ''}`, montant: c.amount })),
      ...expenses.map(e => ({ date: e.date || e.createdAt, type: 'sortie', categorie: 'Dépense', libelle: e.title, montant: e.amount })),
      ...supplierExpenses.map(e => ({ date: e.createdAt, type: 'sortie', categorie: 'Paiement fournisseur', libelle: `${e.title} — ${e.supplierName}`, montant: e.amount })),
      ...transferts.filter(t => t.direction === 'caisse_vers_banque').map(t => ({ date: t.createdAt, type: 'sortie', categorie: 'Transfert envoyé', libelle: `Transfert caisse → banque${t.note ? ' — ' + t.note : ''}`, montant: t.amount })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    totalEntrees = mouvements.filter(m => m.type === 'entrée').reduce((sum, m) => sum + m.montant, 0);
    totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((sum, m) => sum + m.montant, 0);
    solde = totalEntrees - totalSorties;

    const title   = 'Rapport des Mouvements Caisse';
    const headers = ['Date', 'Type', 'Catégorie', 'Libellé', 'Montant'];
    const rows    = mouvements.map(m => [
      new Date(m.date).toLocaleDateString('fr-FR'),
      m.type === 'entrée' ? '↑ Entrée' : '↓ Sortie',
      m.categorie,
      m.libelle,
      `${formatAmount(m.montant)} GNF`
    ]);
    const totals = [
      { label: 'Total entrées',  value: `${formatAmount(totalEntrees)} GNF`, highlight: false },
      { label: 'Total sorties',  value: `${formatAmount(totalSorties)} GNF`, highlight: false },
      { label: 'Solde caisse',   value: `${formatAmount(solde)} GNF`,        highlight: true  },
    ];

    if (format === 'pdf') return await exportPDF(title, headers, rows, res, 'rapport-caisse', totals, config);
    if (format === 'csv') return await exportCSV(headers, rows, res, 'rapport-caisse');

    res.status(400).json({ message: 'Format invalide' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

const exportBankReport = async (req, res) => {
  try {
    const { format, startDate, endDate } = req.query;
    const dateFilter = startDate && endDate ? {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    } : null;

    const sales = await Sale.find(dateFilter ? { createdAt: dateFilter } : {});
    const clientPayments = await ClientPayment.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'virement' } : { modePaiement: 'virement' }
    );
    const supplierExpenses = await SupplierExpense.find(
      dateFilter ? { createdAt: dateFilter, modePaiement: 'virement' } : { modePaiement: 'virement' }
    );
    const transferts = await BankTransfer.find(dateFilter ? { createdAt: dateFilter } : {});
    const bankIns = await BankIn.find(dateFilter ? { createdAt: dateFilter } : {});
    const config = await SystemConfig.findOne();

    const mouvements = [
      ...sales.filter(s => s.paymentType === 'virement').map(s => ({ date: s.createdAt, type: 'entrée', categorie: 'Vente virement', libelle: `Vente ${s.saleNumber} — ${s.clientName}`, montant: s.amountPaid })),
      ...clientPayments.map(p => ({ date: p.createdAt, type: 'entrée', categorie: 'Remboursement crédit', libelle: `Paiement dette — ${p.clientName}`, montant: p.amount })),
      ...transferts.filter(t => t.direction === 'caisse_vers_banque').map(t => ({ date: t.createdAt, type: 'entrée', categorie: 'Transfert reçu', libelle: `Transfert caisse → banque${t.note ? ' — ' + t.note : ''}`, montant: t.amount })),
      ...bankIns.map(b => ({ date: b.createdAt, type: 'entrée', categorie: 'Alimentation', libelle: `${b.reason}${b.note ? ' — ' + b.note : ''}`, montant: b.amount })),
      ...supplierExpenses.map(e => ({ date: e.createdAt, type: 'sortie', categorie: 'Paiement fournisseur', libelle: `${e.title} — ${e.supplierName}`, montant: e.amount })),
      ...transferts.filter(t => t.direction === 'banque_vers_caisse').map(t => ({ date: t.createdAt, type: 'sortie', categorie: 'Transfert envoyé', libelle: `Transfert banque → caisse${t.note ? ' — ' + t.note : ''}`, montant: t.amount })),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const totalEntrees = mouvements.filter(m => m.type === 'entrée').reduce((sum, m) => sum + m.montant, 0);
    const totalSorties = mouvements.filter(m => m.type === 'sortie').reduce((sum, m) => sum + m.montant, 0);
    const solde = totalEntrees - totalSorties;

    const title   = 'Rapport des Mouvements Banque';
    const headers = ['Date', 'Type', 'Catégorie', 'Libellé', 'Montant'];
    const rows    = mouvements.map(m => [
      new Date(m.date).toLocaleDateString('fr-FR'),
      m.type === 'entrée' ? '↑ Entrée' : '↓ Sortie',
      m.categorie,
      m.libelle,
      `${formatAmount(m.montant)} GNF`
    ]);
    const totals = [
      { label: 'Total entrées', value: `${formatAmount(totalEntrees)} GNF`, highlight: false },
      { label: 'Total sorties', value: `${formatAmount(totalSorties)} GNF`, highlight: false },
      { label: 'Solde banque',  value: `${formatAmount(solde)} GNF`,        highlight: true  },
    ];

    if (format === 'pdf') return await exportPDF(title, headers, rows, res, 'rapport-banque', totals, config);
    if (format === 'csv') return await exportCSV(headers, rows, res, 'rapport-banque');

    res.status(400).json({ message: 'Format invalide' });
  } catch (error) { res.status(500).json({ message: error.message }); }
};

module.exports = {
  getDailyReport, getMonthlyReport, getStockReport, getDebtReport,
  getSupplierReport, exportDailyReport, exportMonthlyReport,
  exportStockReport, exportDebtReport, exportSupplierReport,
  getCaisseReport, getCapitalReport, getCaisseMovements, getBankMovements,
  exportCaisseReport, exportBankReport
};