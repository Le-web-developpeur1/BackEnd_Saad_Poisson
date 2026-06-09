const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const StockMovement = require('../models/StockMovement');

const getSales = async (req, res) => {
  try {
    const { startDate, endDate, paymentType, status } = req.query;
    let filter = {};
    if (startDate && endDate) {
      filter.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (paymentType) filter.paymentType = paymentType;
    if (status) filter.status = status;

    const sales = await Sale.find(filter)
      .populate('client', 'name phone')
      .populate('recordedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(sales);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id)
      .populate('client')
      .populate('items.product')
      .populate('recordedBy', 'name');
    if (!sale) return res.status(404).json({ message: 'Vente introuvable' });
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createSale = async (req, res) => {
  try {
    const { client: clientId, items, discount = 0, paymentType, amountPaid } = req.body;

    // Vérification client créditeur
    if (clientId && paymentType === 'credit') {
      const client = await Client.findById(clientId);
      if (!client) return res.status(404).json({ message: 'Client introuvable' });
      if (client.isBlocked) {
        return res.status(403).json({ message: `Client bloqué — plafond de crédit atteint (${client.creditLimit} GNF)` });
      }
    }

    // Calcul des totaux et vérification du stock
    let subTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: 'Produit introuvable' });

      if (item.unit === 'carton' && product.stockCartons < item.quantity) {
        return res.status(400).json({ message: `Stock insuffisant pour ${product.name} (${product.stockCartons} cartons disponibles)` });
      }
      if (item.unit === 'kg' && product.stockKg < item.quantity) {
        return res.status(400).json({ message: `Stock insuffisant pour ${product.name} (${product.stockKg} kg disponibles)` });
      }

      const unitPrice = item.unit === 'carton' ? product.pricePerCarton : product.pricePerKg;
      const total = unitPrice * item.quantity;
      subTotal += total;

      processedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice,
        total
      });

      // Déduction du stock
      if (item.unit === 'carton') {
        product.stockCartons -= item.quantity;
        product.stockKg -= item.quantity * product.kgPerCarton;
      } else {
        product.stockKg -= item.quantity;
      }
      await product.save();

      // Mouvement de stock
      await StockMovement.create({
        product: product._id,
        productName: product.name,
        type: 'sortie',
        quantityCartons: item.unit === 'carton' ? item.quantity : 0,
        quantityKg: item.unit === 'kg' ? item.quantity : 0,
        reason: 'vente',
        recordedBy: req.user._id
      });
    }

    const totalAmount = subTotal - discount;
    const paid = amountPaid || (paymentType === 'comptant' ? totalAmount : 0);

    let status = 'payé';
    if (paid === 0) status = 'crédit';
    else if (paid < totalAmount) status = 'partiel';

    // Génération du numéro de vente
    const count = await Sale.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const saleNumber = `VTE-${year}${month}-${String(count + 1).padStart(4, '0')}`;

    const sale = await Sale.create({
      saleNumber,
      client: clientId || null,
      clientName: clientId ? (await Client.findById(clientId)).name : 'Client comptant',
      items: processedItems,
      subTotal,
      discount,
      totalAmount,
      paymentType,
      amountPaid: paid,
      remainingAmount: totalAmount - paid,
      status,
      recordedBy: req.user._id
    });

    // Mise à jour de la dette du client
    if (clientId && paymentType === 'credit') {
      const client = await Client.findById(clientId);
      client.currentDebt += totalAmount - paid;
      client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
      await client.save();
    }

    res.status(201).json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSales, getSale, createSale };