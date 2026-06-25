const Client = require('../models/Client');
const Sale = require('../models/Sale');
const {generateCreditPDF, generateClientPaymentReceiptPDF} = require('../utils/generateInvoicePDF')
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
    await Client.findByIdAndUpdate(req.params.id, { isActive: false });
    res.json({ message: 'Client désactivé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const recordClientPayment = async (req, res) => {
    try {
      const { amount } = req.body;
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ message: 'Client introuvable' });
  
      if (amount > client.currentDebt) {
        return res.status(400).json({ message: 'Le montant dépasse la dette actuelle' });
      }
  
      client.currentDebt -= amount;
      client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
      await client.save();
      
      //Mettre à jour les ventes à crédit (du plus ancien au plus récent)
      let remainingPayment = amount;
      const creditSales = await Sale.find({
        client: client._id,
        paymentType: 'credit',
        remainingAmount: { $gt: 0 }
      }).sort({ createAt: 1 });

      for (const sale of creditSales) {
        if (remainingPayment <= 0) break;

        const payment = Math.min(remainingPayment, sale.remainingAmount);
        sale.amountPaid += payment;
        sale.remainingAmount -= payment;

        if (sale.remainingAmount === 0) sale.status = 'payé';
        else sale.status = 'partiel';

        await sale.save();
      }

      //Créer un enregistrement de paiement pour la caisse
      const newPayment = await ClientPayment.create({
        client: client.id,
        clientName: client.name,
        clientPhone: client.phone || '',
        amount: Number(amount),
        remainingDebt: client.currentDebt,
        paidBy: req.user._id,
      });

      res.json({ message: 'Paiement enregistré', client, paymentId: newPayment._id });
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
  
      const Sale = require('../models/Sale');
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
      const Sale = require('../models/Sale');
      const client = await Client.findById(req.params.id);
      if (!client) return res.status(404).json({ message: 'Client introuvable' });
  
      // Recalculer la dette réelle depuis les ventes
      const sales = await Sale.find({
        client: req.params.id,
        paymentType: 'credit'
      });
  
      const realDebt = sales.reduce((sum, s) => sum + s.remainingAmount, 0);
      client.currentDebt = realDebt;
      client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
      await client.save();
  
      res.json({ message: 'Dette recalculée', client, realDebt });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
};

const downloadPaymentReceipt = async (req, res) => {
  try {
    const payment = await ClientPayment.findById(req.params.paymentId);
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

    // Toutes les ventes du client
    const sales = await Sale.find({ client: req.params.id })
      .sort({ createdAt: 1 })
      .populate('recordedBy', 'name');

    // Tous les paiements du client
    const payments = await ClientPayment.find({ client: req.params.id })
      .sort({ createdAt: 1 })
      .populate('paidBy', 'name');

    // Fusionner et trier par date
    const history = [
      ...sales.map(s => ({
        type:        'vente',
        date:        s.createdAt,
        reference:   s.saleNumber,
        montant:     s.totalAmount,
        paye:        s.amountPaid,
        reste:       s.remainingAmount,
        paymentType: s.paymentType,
        status:      s.status,
        recordedBy:  s.recordedBy?.name || '—',
      })),
      ...payments.map(p => ({
        type:       'paiement',
        date:       p.createdAt,
        reference:  `PAY-${p._id.toString().slice(-6).toUpperCase()}`,
        montant:    p.amount,
        reste:      p.remainingDebt,
        paidBy:     p.paidBy?.name || '—',
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
        paye:      s.amountPaid,
        reste:     s.remainingAmount,
        status:    s.status
      })),
      ...payments.map(p => ({
        type:      'paiement',
        date:      p.createdAt,
        reference: `PAY-${p._id.toString().slice(-6).toUpperCase()}`,
        montant:   p.amount,
        reste:     p.remainingDebt
      }))
    ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const { generateClientHistoryPDF } = require('../utils/generateInvoicePDF');
    await generateClientHistoryPDF(client, history, res);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  getClients, getClient, createClient, updateClient, deleteClient,
  recordClientPayment, getClientCredits, downloadCreditPDF,
  recalculateDebt, downloadPaymentReceipt, getClientHistory, downloadClientRelevePDF,
};