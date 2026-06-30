const Expense = require('../models/Expense');
const Supplier = require('../models/Supplier');
const SupplierPurchase = require('../models/SupplierPurchase');
const SupplierExpense = require('../models/SupplierExpense');
const Sale = require('../models/Sale');
const ClientPayment = require('../models/ClientPayment');
const BankTransfer = require('../models/BankTransfer');

// Fonction utilitaire pour calculer le solde caisse et banque actuels
const getSoldesActuels = async () => {
  const sales            = await Sale.find();
  const clientPayments   = await ClientPayment.find();
  const expenses         = await Expense.find();
  const supplierExpenses = await SupplierExpense.find();
  const transferts       = await BankTransfer.find();

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

  const totalAmountPaidCredit = sales
    .filter(s => s.paymentType === 'credit')
    .reduce((sum, s) => sum + s.amountPaid, 0);
  const acomptesInitiaux = Math.max(0, totalAmountPaidCredit - totalClientPayments);

  const depensesOperationnelles = expenses.reduce((sum, e) => sum + e.amount, 0);

  const paiementsFournisseursComptant = supplierExpenses
    .filter(e => e.modePaiement === 'comptant')
    .reduce((sum, e) => sum + e.amount, 0);

  const transfertsBanqueVersCaisse = transferts
    .filter(t => t.direction === 'banque_vers_caisse')
    .reduce((sum, t) => sum + t.amount, 0);
  const transfertsCaisseVersBanque = transferts
    .filter(t => t.direction === 'caisse_vers_banque')
    .reduce((sum, t) => sum + t.amount, 0);

  const soldeCaisse = totalVentesComptant + acomptesInitiaux + clientPaymentsComptant
                     + transfertsBanqueVersCaisse - transfertsCaisseVersBanque
                     - depensesOperationnelles - paiementsFournisseursComptant;

  const totalVentesVirement = sales
    .filter(s => s.paymentType === 'virement')
    .reduce((sum, s) => sum + s.amountPaid, 0);

  const paiementsFournisseursVirement = supplierExpenses
    .filter(e => e.modePaiement === 'virement')
    .reduce((sum, e) => sum + e.amount, 0);

  const soldeBanque = totalVentesVirement + clientPaymentsVirement
                     + transfertsCaisseVersBanque - transfertsBanqueVersCaisse
                     - paiementsFournisseursVirement;

  return { soldeCaisse, soldeBanque };
};

const getSuppliers = async (req, res) => {
  try {
    const suppliers = await Supplier.find({ isActive: true }).sort({ name: 1 });
    res.json(suppliers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.create(req.body);
    res.status(201).json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateSupplier = async (req, res) => {
  try {
    const supplier = await Supplier.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
    res.json(supplier);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteSupplier = async (req, res) => {
  try {
    await Supplier.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Fournisseur désactivé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const recordSupplierPayment = async (req, res) => {
  try {
    const { amount, note, modePaiement } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });

    const paye = Number(amount);

    if (paye <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (paye > supplier.balance) return res.status(400).json({
      message: `Le montant ne peut pas dépasser le solde dû (${supplier.balance} GNF)`
    });
    if (!modePaiement) return res.status(400).json({ message: 'Mode de paiement obligatoire' });

    // ── Validation du solde disponible ─────────────────
    const { soldeCaisse, soldeBanque } = await getSoldesActuels();
    if (modePaiement === 'comptant' && paye > soldeCaisse) {
      return res.status(400).json({
        message: `Solde caisse insuffisant. Disponible : ${soldeCaisse} GNF`
      });
    }
    if (modePaiement === 'virement' && paye > soldeBanque) {
      return res.status(400).json({
        message: `Solde banque insuffisant. Disponible : ${soldeBanque} GNF`
      });
    }

    // Mettre à jour les achats impayés/partiels par ordre chronologique
    const achatsRestants = await SupplierPurchase.find({
      supplier: supplier._id,
      statut:   { $in: ['impayé', 'partiel'] }
    }).sort({ createdAt: 1 });

    let resteAPayer = paye;
    for (const achat of achatsRestants) {
      if (resteAPayer <= 0) break;
      const paiementPourCetAchat = Math.min(resteAPayer, achat.montantRestant);
      achat.montantPaye    += paiementPourCetAchat;
      achat.montantRestant -= paiementPourCetAchat;
      achat.modePaiement    = modePaiement;
      achat.statut = achat.montantRestant === 0 ? 'payé' : 'partiel';
      await achat.save();
      resteAPayer -= paiementPourCetAchat;
    }

    await SupplierExpense.create({
      supplier:     supplier._id,
      supplierName: supplier.name,
      title:        `Versement fournisseur${note ? ' — ' + note : ''}`,
      amount:       paye,
      modePaiement,
      note:         note || '',
      recordedBy:   req.user._id
    });

    supplier.totalPaid += paye;
    supplier.balance   -= paye;
    await supplier.save();

    res.json({ message: 'Versement enregistré', supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Enregistrer un achat fournisseur détaillé
// @route   POST /api/suppliers/:id/purchase
const recordPurchase = async (req, res) => {
  try {
    const { items, montantPaye, modePaiement } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Ajoutez au moins un article' });

    const processedItems = items.map(item => ({
      libelle:         item.libelle,
      quantiteCartons: Number(item.quantiteCartons || 0),
      prixUnitaire:    Number(item.prixUnitaire),
      montantTotal:    Number(item.quantiteCartons || 0) * Number(item.prixUnitaire),
    }));

    const montantTotal   = processedItems.reduce((sum, i) => sum + i.montantTotal, 0);
    const paye           = Math.min(Number(montantPaye || 0), montantTotal);
    const montantRestant = Math.max(0, montantTotal - paye);

    if (paye > 0 && !modePaiement) {
      return res.status(400).json({ message: 'Mode de paiement obligatoire si montant payé > 0' });
    }

    // ── Validation du solde disponible ─────────────────
    if (paye > 0) {
      const { soldeCaisse, soldeBanque } = await getSoldesActuels();
      if (modePaiement === 'comptant' && paye > soldeCaisse) {
        return res.status(400).json({
          message: `Solde caisse insuffisant. Disponible : ${soldeCaisse} GNF`
        });
      }
      if (modePaiement === 'virement' && paye > soldeBanque) {
        return res.status(400).json({
          message: `Solde banque insuffisant. Disponible : ${soldeBanque} GNF`
        });
      }
    }

    let statut = 'impayé';
    if (paye >= montantTotal) statut = 'payé';
    else if (paye > 0) statut = 'partiel';

    if (paye > 0) {
      await SupplierExpense.create({
        supplier:     supplier._id,
        supplierName: supplier.name,
        title:        `Achat — ${processedItems.map(i => i.libelle).join(', ')}`,
        amount:       paye,
        modePaiement,
        note:         `Paiement ${modePaiement} pour achat fournisseur`,
        recordedBy:   req.user._id
      });
    }

    const purchase = await SupplierPurchase.create({
      supplier:      supplier._id,
      supplierName:  supplier.name,
      items:         processedItems,
      montantTotal,
      montantPaye:   paye,
      montantRestant,
      modePaiement:  paye > 0 ? modePaiement : 'non_payé',
      statut,
      recordedBy:    req.user._id
    });

    supplier.totalPurchases += montantTotal;
    supplier.totalPaid      += paye;
    supplier.balance        += montantRestant;
    await supplier.save();

    res.status(201).json({ message: 'Achat enregistré', purchase, supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Historique achats + versements d'un fournisseur
// @route   GET /api/suppliers/:id/history
const getSupplierHistory = async (req, res) => {
  try {
    const supplier  = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });

    const purchases = await SupplierPurchase.find({ supplier: req.params.id })
      .sort({ createdAt: -1 });

    res.json({ supplier, purchases });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, recordSupplierPayment, recordPurchase, getSupplierHistory };