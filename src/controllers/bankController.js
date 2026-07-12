const Sale          = require('../models/Sale');
const Expense        = require('../models/Expense');
const BankTransfer   = require('../models/BankTransfer');
const ClientPayment  = require('../models/ClientPayment');
const SupplierExpense = require('../models/SupplierExpense');
const BankIn          = require('../models/BankIn');
const CashIn = require('../models/CashIn');



const getBankReport = async (req, res) => {
  try {
    const ventesVirement = await Sale.find({ paymentType: 'virement' });
    const totalVentesVirement = ventesVirement.reduce((sum, s) => sum + s.amountPaid, 0);

    const clientPaymentsVirement = await ClientPayment.find({ modePaiement: 'virement' });
    const totalClientPaymentsVirement = clientPaymentsVirement.reduce((sum, p) => sum + p.amount, 0);

    const transfertsEntree = await BankTransfer.find({ direction: 'caisse_vers_banque' });
    const totalTransfertsEntree = transfertsEntree.reduce((sum, t) => sum + t.amount, 0);

    const transfertsSortie = await BankTransfer.find({ direction: 'banque_vers_caisse' });
    const totalTransfertsSortie = transfertsSortie.reduce((sum, t) => sum + t.amount, 0);

    const paiementsFournisseurs = await SupplierExpense.find({ modePaiement: 'virement' });
    const totalDepensesVirement = paiementsFournisseurs.reduce((sum, e) => sum + e.amount, 0);

    const bankIns = await BankIn.find();
    const totalBankIns = bankIns.reduce((sum, b) => sum + b.amount, 0);

    const soldeBanque = totalVentesVirement + totalClientPaymentsVirement 
                      + totalTransfertsEntree + totalBankIns
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
      mouvements,
      totalBankIns
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
    const montant = Number(amount);

    if (!montant || montant <= 0) return res.status(400).json({ message: 'Montant invalide' });
    if (!direction) return res.status(400).json({ message: 'Direction obligatoire' });

    // ── Calcul du solde Caisse actuel ──────────────────
    const sales            = await Sale.find();
    const clientPayments   = await ClientPayment.find();
    const expenses         = await Expense.find();
    const supplierExpenses = await SupplierExpense.find();
    const transferts       = await BankTransfer.find();

    const cashIns = await CashIn.find();
    const totalCashIns = cashIns.reduce((sum, c) => sum + c.amount, 0);


    const bankIns = await BankIn.find();
    const totalBankIns = bankIns.reduce((sum, b) => sum + b.amount, 0);


    const totalVentesComptant = sales
      .filter(s => s.paymentType === 'comptant')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const clientPaymentsComptant = clientPayments
      .filter(p => p.modePaiement !== 'virement')
      .reduce((sum, p) => sum + p.amount, 0);

    const totalAmountPaidCredit = sales
      .filter(s => s.paymentType === 'credit')
      .reduce((sum, s) => sum + s.amountPaid, 0);
    const totalClientPayments = clientPayments.reduce((sum, p) => sum + p.amount, 0);
    const acomptesInitiaux = Math.max(0, totalAmountPaidCredit - totalClientPayments);

    const depensesOperationnelles = expenses.reduce((sum, e) => sum + e.amount, 0);

    const paiementsFournisseursComptant = supplierExpenses
      .filter(e => e.modePaiement === 'comptant')
      .reduce((sum, e) => sum + e.amount, 0);

    const transfertsEntreeCaisse = transferts
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);
    const transfertsSortieCaisse = transferts
      .filter(t => t.direction === 'caisse_vers_banque')
      .reduce((sum, t) => sum + t.amount, 0);

    const soldeCaisse = totalVentesComptant + acomptesInitiaux + clientPaymentsComptant
                       + transfertsEntreeCaisse - transfertsSortieCaisse
                       - depensesOperationnelles - paiementsFournisseursComptant + totalCashIns;

    // ── Calcul du solde Banque actuel ──────────────────
    const totalVentesVirement = sales
      .filter(s => s.paymentType === 'virement')
      .reduce((sum, s) => sum + s.amountPaid, 0);

    const clientPaymentsVirement = clientPayments
      .filter(p => p.modePaiement === 'virement')
      .reduce((sum, p) => sum + p.amount, 0);

    const paiementsFournisseursVirement = supplierExpenses
      .filter(e => e.modePaiement === 'virement')
      .reduce((sum, e) => sum + e.amount, 0);

    const transfertsEntreeBanque = transferts
      .filter(t => t.direction === 'caisse_vers_banque')
      .reduce((sum, t) => sum + t.amount, 0);
    const transfertsSortieBanque = transferts
      .filter(t => t.direction === 'banque_vers_caisse')
      .reduce((sum, t) => sum + t.amount, 0);

    const soldeBanque = totalVentesVirement + clientPaymentsVirement
                       + transfertsEntreeBanque - transfertsSortieBanque
                       - paiementsFournisseursVirement + totalBankIns;

    // ── Validation du solde disponible ─────────────────
    if (direction === 'caisse_vers_banque' && montant > soldeCaisse) {
      return res.status(400).json({
        message: `Solde caisse insuffisant. Disponible : ${soldeCaisse} GNF`
      });
    }
    if (direction === 'banque_vers_caisse' && montant > soldeBanque) {
      return res.status(400).json({
        message: `Solde banque insuffisant. Disponible : ${soldeBanque} GNF`
      });
    }

    // ── Créer le transfert (aucune Expense créée) ──────
    const transfer = await BankTransfer.create({
      amount:     montant,
      direction,
      note:       note || '',
      recordedBy: req.user._id
    });

    res.status(201).json({ message: 'Transfert effectué', transfer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getBankReport, transferToBanque };