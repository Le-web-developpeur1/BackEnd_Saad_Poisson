const Client = require('../models/Client');
const Sale = require('../models/Sale');
const {generateCreditPDF, generateClientPaymentReceiptPDF, generateClientHistoryPDF} = require('../utils/generateInvoicePDF')
const ClientPayment = require('../models/ClientPayment');
const SystemConfig  = require('../models/SystemConfig');


const getClients = async (req, res) => {
  try {
    const clients = await Client.find({ isActive: true }).sort({ name: 1 });
    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    const sales = await Sale.find({ client: client._id }).sort({ createdAt: -1 }).limit(20);
    res.json({ client, sales });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createClient = async (req, res) => {
  try {
    const client = await Client.create(req.body);
    res.status(201).json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateClient = async (req, res) => {
  try {
    const client = await Client.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!client) return res.status(404).json({ message: 'Client introuvable' });
    res.json(client);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    // 🆕 VÉRIFICATION 1 : Dette restante
    if (client.currentDebt > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer ce client : dette restante de ${client.currentDebt.toLocaleString('fr-FR')} GNF. Veuillez d'abord encaisser tous les paiements.`,
        currentDebt: client.currentDebt
      });
    }

    // 🆕 VÉRIFICATION 2 : Ventes en cours
    const activeSales = await Sale.find({
      client: client._id,
      status: { $in: ['partiel', 'crédit'] }
    });

    if (activeSales.length > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer ce client : ${activeSales.length} vente(s) en cours non soldée(s).`,
        activeSales: activeSales.length
      });
    }

    // 🆕 VÉRIFICATION 3 : Vérifier s'il y a un historique
    const totalSales = await Sale.countDocuments({ client: client._id });
    const totalPayments = await ClientPayment.countDocuments({ client: client._id });
    const hasHistory = totalSales > 0 || totalPayments > 0;

    if (hasHistory) {
      // Soft delete pour préserver l'historique
      client.isActive = false;
      client.name = `[ARCHIVÉ] ${client.name}`; // 🆕 Marquer visuellement
      await client.save();

      return res.json({ 
        message: 'Client archivé avec succès (historique préservé)',
        client,
        archived: true,
        stats: {
          totalSales,
          totalPayments,
          totalDebt: 0
        }
      });
    } else {
      // Hard delete si aucun historique (client jamais utilisé)
      await Client.findByIdAndDelete(req.params.id);
      
      return res.json({ 
        message: 'Client supprimé définitivement (aucun historique)',
        deleted: true
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 RÉACTIVER UN CLIENT ARCHIVÉ
const restoreClient = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    if (client.isActive) {
      return res.status(400).json({ message: 'Ce client est déjà actif' });
    }

    // Retirer le préfixe [ARCHIVÉ]
    if (client.name.startsWith('[ARCHIVÉ] ')) {
      client.name = client.name.replace('[ARCHIVÉ] ', '');
    }

    client.isActive = true;
    await client.save();

    res.json({ 
      message: 'Client réactivé avec succès',
      client
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 LISTER LES CLIENTS ARCHIVÉS
const getArchivedClients = async (req, res) => {
  try {
    const archivedClients = await Client.find({ isActive: false }).sort({ name: 1 });
    res.json(archivedClients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const recordClientPayment = async (req, res) => {
  try {
    const { amount, modePaiement, note } = req.body;
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    // Validation du montant
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Montant invalide' });
    }

    if (amount > client.currentDebt) {
      return res.status(400).json({ 
        message: `Le montant (${amount} GNF) dépasse la dette actuelle (${client.currentDebt} GNF)` 
      });
    }

    if (!modePaiement) {
      return res.status(400).json({ message: 'Mode de paiement obligatoire' });
    }

    // 🆕 Utiliser la fonction utilitaire pour allouer le paiement
    const { allocatePaymentToSales } = require('../utils/debtCalculator');
    
    const clientDebtBefore = client.currentDebt;
    
    const { allocations, salesUpdated, totalAllocated } = await allocatePaymentToSales(
      client._id, 
      amount, 
      req.user._id
    );

    // Mettre à jour la dette du client
    client.currentDebt = Math.max(0, client.currentDebt - totalAllocated);
    client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
    await client.save();

    // 🆕 Créer un enregistrement de paiement AMÉLIORÉ avec traçabilité
    const newPayment = await ClientPayment.create({
      client: client._id,
      clientName: client.name,
      clientPhone: client.phone || '',
      amount: totalAllocated,
      allocations, // 🆕 Liste des ventes payées
      clientDebtBefore,
      clientDebtAfter: client.currentDebt,
      modePaiement,
      note: note || '',
      paidBy: req.user._id,
    });

    res.json({ 
      message: 'Paiement enregistré avec succès', 
      client, 
      payment: newPayment,
      salesUpdated: salesUpdated.length,
      details: allocations.map(a => `${a.saleNumber}: ${a.amountAllocated} GNF`)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClientCredits = async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ message: 'Client introuvable' });
  
      const sales = await Sale.find({
        client: req.params.id,
        paymentType: 'credit'
      }).sort({ createdAt: -1 });
  
      const totalCredit    = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalPaid      = sales.reduce((sum, s) => sum + s.amountPaid, 0);
      const totalRemaining = sales.reduce((sum, s) => sum + s.remainingAmount, 0);
  
      res.json({ client, sales, totalCredit, totalPaid, totalRemaining });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const downloadCreditPDF = async (req, res) => {
    try {
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ message: 'Client introuvable' });
  
      const sales = await Sale.find({
        client: req.params.id,
        paymentType: 'credit'
      }).sort({ createdAt: -1 });
  
      const totalCredit    = sales.reduce((sum, s) => sum + s.totalAmount, 0);
      const totalPaid      = sales.reduce((sum, s) => sum + s.amountPaid, 0);
      const totalRemaining = sales.reduce((sum, s) => sum + s.remainingAmount, 0);
  
      await generateCreditPDF({ client, sales, totalCredit, totalPaid, totalRemaining }, res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const recalculateDebt = async (req, res) => {
  try {
    const { syncClientDebt, checkDebtConsistency } = require('../utils/debtCalculator');
    
    const clientId = req.params.id;
    const client = await Client.findById(clientId);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    // Synchroniser la dette
    const result = await syncClientDebt(clientId);

    res.json({ 
      message: result.wasDesynchronized 
        ? `Dette recalculée et corrigée` 
        : 'Dette déjà synchronisée',
      client: result.client,
      oldDebt: result.oldDebt,
      newDebt: result.newDebt,
      difference: result.difference,
      correctionNeeded: result.wasDesynchronized
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 VÉRIFIER LA COHÉRENCE DE TOUTES LES DETTES
const checkAllDebtsConsistency = async (req, res) => {
  try {
    const { checkDebtConsistency } = require('../utils/debtCalculator');
    
    const inconsistencies = await checkDebtConsistency();

    if (inconsistencies.length === 0) {
      return res.json({ 
        message: 'Toutes les dettes sont cohérentes ✅',
        inconsistencies: []
      });
    }

    res.json({ 
      message: `${inconsistencies.length} incohérence(s) détectée(s) ⚠️`,
      inconsistencies,
      totalClients: inconsistencies.length
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadPaymentReceipt = async (req, res) => {
  try {
    const payment = await ClientPayment.findById(req.params.paymentId)
      .populate('allocations.sale', 'saleNumber'); // 🆕 Peupler les infos de vente
    
    if (!payment) return res.status(404).json({ message: "Paiement introuvable" });
    
    let config = await SystemConfig.findOne();
    if (!config) config = {};
    
    await generateClientPaymentReceiptPDF(payment, config, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getClientHistory = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    const sales = await Sale.find({ client: req.params.id })
      .sort({ createdAt: 1 })
      .populate('recordedBy', 'name');

    const payments = await ClientPayment.find({ client: req.params.id })
      .sort({ createdAt: 1 })
      .populate('paidBy', 'name');

    const history = [
      ...sales.map(s => ({
        type:        'vente',
        date:        s.createdAt,
        reference:   s.saleNumber,
        montant:     s.totalAmount,
        // Acompte initial figé au moment de la vente
        paye:        s.initialAmountPaid || 0,
        // Reste initial = totalAmount - acompte initial
        reste:       s.totalAmount - (s.initialAmountPaid || 0),
        paymentType: s.paymentType,
        status:      s.status,
        recordedBy:  s.recordedBy?.name || '—',
      })),
      ...payments.map(p => ({
        type:      'paiement',
        date:      p.createdAt,
        reference: `PAY-${p._id.toString().slice(-6).toUpperCase()}`,
        montant:   p.amount,
        paye:      p.amount,
        reste:     p.clientDebtAfter || 0, // ✅ Dette globale du client APRÈS ce paiement
        paidBy:    p.paidBy?.name || '—',
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    res.json({ client, history });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const downloadClientRelevePDF = async (req, res) => {
  try {
    const client = await Client.findById(req.params.id);
    if (!client) return res.status(404).json({ message: 'Client introuvable' });

    const sales = await Sale.find({ client: req.params.id }).sort({ createdAt: 1 });
    const payments = await ClientPayment.find({ client: req.params.id }).sort({ createdAt: 1 });

    const history = [
      ...sales.map(s => ({
        type:      'vente',
        date:      s.createdAt,
        reference: s.saleNumber,
        montant:   s.totalAmount,
        paye:      s.initialAmountPaid || 0,                      // Acompte initial au moment de la vente
        reste:     s.totalAmount - (s.initialAmountPaid || 0),    // Reste initial de cette vente
        status:    s.status
      })),
      ...payments.map(p => ({
        type:      'paiement',
        date:      p.createdAt,
        reference: `PAY-${p._id.toString().slice(-6).toUpperCase()}`,
        montant:   p.amount,                                       // Montant de ce paiement
        reste:     p.clientDebtAfter || 0                          // Dette globale du client APRÈS ce paiement
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    await generateClientHistoryPDF(client, history, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getClients, getClient, createClient, updateClient, deleteClient,
  restoreClient, getArchivedClients,
  recordClientPayment, getClientCredits, downloadCreditPDF,
  recalculateDebt, checkAllDebtsConsistency, downloadPaymentReceipt, getClientHistory, downloadClientRelevePDF,
};