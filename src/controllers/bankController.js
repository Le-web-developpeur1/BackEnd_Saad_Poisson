const Sale           = require('../models/Sale');
const Expense        = require('../models/Expense');
const BankTransfer   = require('../models/BankTransfer');
const ClientPayment  = require('../models/ClientPayment');
const SupplierExpense = require('../models/SupplierExpense');

// @desc    Rapport banque complet
// @route   GET /api/bank
const getBankReport = async (req, res) => {
  try {
    const ventesVirement = await Sale.find({ paymentType: 'virement' });
    const totalVentesVirement = ventesVirement.reduce((sum, s) => sum + s.amountPaid, 0);

    // Paiements de dettes clients par virement (entrée banque)
    const clientPaymentsVirement = await ClientPayment.find({ modePaiement: 'virement' });
    const totalClientPaymentsVirement = clientPaymentsVirement.reduce((sum, p) => sum + p.amount, 0);

    const transfertsEntree = await BankTransfer.find({ direction: 'caisse_vers_banque' });
    const totalTransfertsEntree = transfertsEntree.reduce((sum, t) => sum + t.amount, 0);

    const transfertsSortie = await BankTransfer.find({ direction: 'banque_vers_caisse' });
    const totalTransfertsSortie = transfertsSortie.reduce((sum, t) => sum + t.amount, 0);

    const paiementsFournisseurs = await SupplierExpense.find({ modePaiement: 'virement' });
    const totalDepensesVirement = paiementsFournisseurs.reduce((sum, e) => sum + e.amount, 0);

    const soldeBanque = totalVentesVirement + totalClientPaymentsVirement + totalTransfertsEntree
                      - totalDepensesVirement - totalTransfertsSortie;

    const mouvements = [
      ...ventesVirement.map(s => ({
        type: 'entrée', libelle: `Vente virement — ${s.clientName}`,
        montant: s.amountPaid, date: s.createdAt, categorie: 'vente_virement'
      })),
      ...clientPaymentsVirement.map(p => ({
        type: 'entrée', libelle: `Paiement dette — ${p.clientName}`,
        montant: p.amount, date: p.createdAt, categorie: 'paiement_dette_client'
      })),
      ...transfertsEntree.map(t => ({
        type: 'entrée', libelle: `Transfert caisse → banque${t.note ? ' — ' + t.note : ''}`,
        montant: t.amount, date: t.createdAt, categorie: 'transfert_entree'
      })),
      ...transfertsSortie.map(t => ({
        type: 'sortie', libelle: `Transfert banque → caisse${t.note ? ' — ' + t.note : ''}`,
        montant: t.amount, date: t.createdAt, categorie: 'transfert_sortie'
      })),
      ...paiementsFournisseurs.map(e => ({
        type: 'sortie', libelle: `${e.title} — ${e.supplierName}`,
        montant: e.amount, date: e.date || e.createdAt, categorie: 'paiement_fournisseur'
      }))
    ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 10);

    res.json({
      soldeBanque,
      totalVentesVirement,
      totalClientPaymentsVirement,
      totalTransfertsEntree,
      totalTransfertsSortie,
      totalDepensesVirement,
      mouvements
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Effectuer un transfert caisse ↔ banque
// @route   POST /api/bank/transfer
const transferToBanque = async (req, res) => {
  try {
    const { amount, direction, note } = req.body;
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (!direction) return res.status(400).json({ message: 'Direction obligatoire' });

    // Créer le transfert
    const transfer = await BankTransfer.create({
      amount:     Number(amount),
      direction,
      note:       note || '',
      recordedBy: req.user._id
    });

    if (direction === 'caisse_vers_banque') {
      // Caisse diminue → dépense catégorie transfert_banque
      // Banque augmente → géré via BankTransfer (pas de dépense banque)
      await Expense.create({
        title:      `Transfert caisse → banque${note ? ' — ' + note : ''}`,
        category:   'transfert_banque',
        amount:     Number(amount),
        date:       new Date(),
        note:       note || '',
        recordedBy: req.user._id
      });
    } else {
      // Banque diminue → géré via BankTransfer (pas de dépense caisse)
      // Caisse augmente → entrée catégorie transfert_caisse
      await Expense.create({
        title:      `Transfert banque → caisse${note ? ' — ' + note : ''}`,
        category:   'transfert_caisse',
        amount:     Number(amount),
        date:       new Date(),
        note:       note || '',
        recordedBy: req.user._id
      });
    }

    res.status(201).json({ message: 'Transfert effectué', transfer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBankReport, transferToBanque };