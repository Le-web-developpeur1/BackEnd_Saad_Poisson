const Client = require('../models/Client');
const Sale = require('../models/Sale');
const {generateCreditPDF} = require('../utils/generateInvoicePDF')

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
  
      res.json({ message: 'Paiement enregistré', client });
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

module.exports = { getClients, getClient, createClient, updateClient, deleteClient, recordClientPayment, getClientCredits, downloadCreditPDF, recalculateDebt };