const Expense = require('../models/Expense');
const Supplier = require('../models/Supplier');
const SupplierPurchase = require('../models/SupplierPurchase');

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
    const { amount, note, modePaiement } = req.body; // ← modePaiement depuis req.body
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });

    const paye = Number(amount);

    if (paye <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (paye > supplier.balance) return res.status(400).json({
      message: `Le montant ne peut pas dépasser le solde dû (${supplier.balance} GNF)`
    });
    if (!modePaiement) return res.status(400).json({ message: 'Mode de paiement obligatoire' });

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

    // Créer la dépense
    const categorieDepense = modePaiement === 'virement' ? 'virement_fournisseur' : 'achat_fournisseur';
    await Expense.create({
      title:      `Versement fournisseur — ${supplier.name}${note ? ' — ' + note : ''}`,
      category:   categorieDepense,
      amount:     paye,
      date:       new Date(),
      note:       note || '',
      recordedBy: req.user._id
    });

    // Mettre à jour le solde fournisseur
    supplier.totalPaid += paye;
    supplier.balance   -= paye;
    await supplier.save();

    res.json({ message: 'Versement enregistré', supplier });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
  
  // const recordPurchase = async (req, res) => {
  //   try {
  //     const { amount } = req.body;
  //     const supplier = await Supplier.findById(req.params.id);
  //     if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
  
  //     supplier.totalPurchases += amount;
  //     supplier.balance = supplier.totalPurchases - supplier.totalPaid;
  //     await supplier.save();
  
  //     res.json({ message: 'Achat enregistré', supplier });
  //   } catch (error) {
  //     res.status(500).json({ message: error.message });
  //   }
  // };

// @desc    Enregistrer un achat fournisseur détaillé
// @route   POST /api/suppliers/:id/purchase
const recordPurchase = async (req, res) => {
  try {
    const { items, montantPaye, modePaiement } = req.body;
    const supplier = await Supplier.findById(req.params.id);
    if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
    if (!items || items.length === 0) return res.status(400).json({ message: 'Ajoutez au moins un article' });

    // Calcul du montant total
    const processedItems = items.map(item => ({
      libelle:         item.libelle,
      quantiteCartons: Number(item.quantiteCartons || 0),
      prixUnitaire:    Number(item.prixUnitaire),
      montantTotal:    Number(item.quantiteCartons || 0) * Number(item.prixUnitaire),
    }));

    const montantTotal   = processedItems.reduce((sum, i) => sum + i.montantTotal, 0);
    const paye           = Math.min(Number(montantPaye || 0), montantTotal); // ne dépasse jamais le total
    const montantRestant = Math.max(0, montantTotal - paye);

    // Validation mode paiement
    if (paye > 0 && !modePaiement) {
      return res.status(400).json({ message: 'Mode de paiement obligatoire si montant payé > 0' });
    }

    let statut = 'impayé';
    if (paye >= montantTotal) statut = 'payé';
    else if (paye > 0) statut = 'partiel';

    // Créer une dépense automatiquement si paiement effectué
    let expenseId = null;
    if (paye > 0) {
      const categorieDepense = modePaiement === 'virement' ? 'virement_fournisseur' : 'achat_fournisseur';
      const expense = await Expense.create({
        title:      `Achat — ${supplier.name} (${processedItems.map(i => i.libelle).join(', ')})`,
        category:   categorieDepense,
        amount:     paye,
        date:       new Date(),
        note:       `Paiement ${modePaiement} pour achat fournisseur`,
        recordedBy: req.user._id
      });
      expenseId = expense._id;
    }

    // Créer l'achat
    const purchase = await SupplierPurchase.create({
      supplier:      supplier._id,
      supplierName:  supplier.name,
      items:         processedItems,
      montantTotal,
      montantPaye:   paye,
      montantRestant,
      modePaiement:  paye > 0 ? modePaiement : 'non_payé',
      statut,
      expenseId,
      recordedBy:    req.user._id
    });

    // Mettre à jour les totaux du fournisseur
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