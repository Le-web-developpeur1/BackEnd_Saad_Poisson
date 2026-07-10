const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const StockMovement = require('../models/StockMovement');
const Invoice = require('../models/Invoice');
const { notifyUsers } = require('../utils/notify');
const Counter = require('../models/Counter');
const ClientPayment = require('../models/ClientPayment');

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

      let montantVente = 0;
      for (const item of items) {
        const product = await Product.findById(item.product);
        if (product) {
          montantVente += product.pricePerCarton * item.quantity;
        }
      }
      const montantCredit  = montantVente - Number(discount || 0);
      const amountPaidNow  = Number(amountPaid || 0);
      const nouveauCredit  = montantCredit - amountPaidNow;

      if (client.creditLimit > 0 && (client.currentDebt + nouveauCredit) > client.creditLimit) {
        return res.status(403).json({
          message: `Vente refusée — Cette vente porterait la dette de ${client.name} à ${client.currentDebt + nouveauCredit} GNF, ce qui dépasse le plafond de ${client.creditLimit} GNF. Dette actuelle : ${client.currentDebt} GNF.`
        });
      }

      if (client.isBlocked) {
        return res.status(403).json({
          message: `Client bloqué — plafond de crédit atteint (${client.creditLimit} GNF)`
        });
      }
    }

    // Calcul des totaux et vérification du stock
    let subTotal = 0;
    const processedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.product);
      if (!product) return res.status(404).json({ message: 'Produit introuvable' });

      if (product.stockCartons < item.quantity) {
        return res.status(400).json({ message: `Stock insuffisant pour ${product.name} (${product.stockCartons} cartons disponibles)` });
      }

      const unitPrice = product.pricePerCarton;
      const total = unitPrice * item.quantity;
      subTotal += total;

      processedItems.push({
        product: product._id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice,
        total
      });

      // Déduction du stock
      product.stockCartons = Math.max(0, product.stockCartons - item.quantity);
      await product.save();

      // Mouvement de stock
      await StockMovement.create({
        product: product._id,
        productName: product.name,
        type: 'sortie',
        quantityCartons: item.quantity,
        reason: 'vente',
        recordedBy: req.user._id
      });
    }

    const totalAmount = subTotal - discount;
    const paid = amountPaid || (paymentType === 'comptant' || paymentType === 'virement' ? totalAmount : 0);

    let status = 'payé';
    if (paid === 0) status = 'crédit';
    else if (paid < totalAmount) status = 'partiel';

    // const count = await Sale.countDocuments();
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');

    const counter = await Counter.findOneAndUpdate(
      { name: 'sales'},
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );

    const saleNumber = `VTE-${year}${month}-${String(counter.seq).padStart(4, '0')}`;

    const sale = await Sale.create({
      saleNumber,
      client: clientId || null,
      clientName: clientId ? (await Client.findById(clientId)).name : (req.body.clientName || 'Client comptant'),
      items: processedItems,
      subTotal,
      discount,
      totalAmount,
      paymentType,
      initialAmountPaid: paid,
      amountPaid: paid,
      remainingAmount: totalAmount - paid,
      status,
      recordedBy: req.user._id
    });

    if (clientId && paymentType === 'credit') {
      const client = await Client.findById(clientId);
      const montant = totalAmount - paid;
      client.currentDebt += montant;
      client.debtHistory.push({ amount: montant, date: new Date() });
      client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
      await client.save();
    }

    const countI = await Invoice.countDocuments();
    const invDate = new Date();
    const invYear = invDate.getFullYear();
    const invMonth = String(invDate.getMonth() + 1).padStart(2, '0');
    const invoiceNumber = `FAC-${invYear}${invMonth}-${String(countI + 1).padStart(4, '0')}`;

    const clientData = clientId ? await Client.findById(clientId) : null;

    const createdInvoice = await Invoice.create({
      invoiceNumber,
      sale: sale._id,
      client: clientId || null,
      clientName: sale.clientName,
      clientAddress: clientData?.address || '',
      clientPhone: clientData?.phone || '',
      items: processedItems.map(item => ({
        designation: item.productName,
        quantity: item.quantity,
        unit: 'Carton',
        unitPrice: item.unitPrice,
        total: item.total
      })),
      subTotal,
      discount,
      totalHT: totalAmount,
      tva: 0,
      totalTTC: totalAmount,
      paymentConditions: paymentType === 'comptant' ? 'Paiement comptant' : 'Paiement à crédit',
      issuedBy: req.user._id
    });

    await notifyUsers(
      'newSale',
      'Nouvelle vente',
      `Vente ${saleNumber} enregistrée avec succès ! \n ${sale.clientName} - ${totalAmount.toLocaleString('fr-FR')} GNF`,
      '/sales'
    );

    if (clientId && paymentType === 'credit') {
      const updateClient = await Client.findById(clientId);
      if (updateClient && updateClient.isBlocked) {
        await notifyUsers(
          'clientBlocked',
          'Client bloqué',
          `${updateClient.name} a atteint son plafond de crédit (${updateClient.creditLimit.toLocaleString('fr-FR')} GNF)`,
          '/credits'
        );
      }
    }

    res.status(201).json({ sale, invoiceId: createdInvoice._id, invoiceNumber: createdInvoice.invoiceNumber });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier une vente
const updateSale = async (req, res) => {
  try {
    const { discount, amountPaid, paymentType, status } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Vente introuvable' });

    if (discount !== undefined) sale.discount = discount;
    if (amountPaid !== undefined) {
      sale.amountPaid = amountPaid;
      sale.remainingAmount = sale.totalAmount - amountPaid;
      if (amountPaid >= sale.totalAmount) sale.status = 'payé';
      else if (amountPaid > 0) sale.status = 'partiel';
      else sale.status = 'crédit';
    }
    if (paymentType !== undefined) sale.paymentType = paymentType;
    if (status !== undefined) sale.status = status;

    await Invoice.findOneAndUpdate(
      { sale: sale._id },
      {
        discount: sale.discount,
        totalHT: sale.totalAmount - sale.discount,
        totalTTC: sale.totalAmount - sale.discount,
        paymentConditions: sale.paymentType === 'comptant' ? 'Paiement comptant' : 'Paiement à crédit'
      }
    );

    if (sale.client) {
      const client = await Client.findById(sale.client);
      if (client) {
        const allSales = await Sale.find({
          client: sale.client,
          paymentType: 'credit'
        });
        client.currentDebt = allSales.reduce((sum, s) => {
          if (s._id.toString() === sale._id.toString()) {
            return sum + (sale.totalAmount - (amountPaid || sale.amountPaid));
          }
          return sum + s.remainingAmount;
        }, 0);
        client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
        await client.save();
      }
    }

    await sale.save();
    res.json(sale);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une vente (admin only)
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Vente introuvable' });

    // ==========================================
    // 1. SUPPRIMER LA FACTURE LIÉE
    // ==========================================
    await Invoice.findOneAndDelete({ sale: sale._id });

    // ==========================================
    // 2. GÉRER LES PAIEMENTS LIÉS À CETTE VENTE
    // ==========================================
    const paymentsToUpdate = await ClientPayment.find({
      'allocations.sale': sale._id
    });

    let paymentsDeleted = 0;
    let paymentsUpdated = 0;

    for (const payment of paymentsToUpdate) {
      // Retirer l'allocation de cette vente
      payment.allocations = payment.allocations.filter(
        alloc => alloc.sale.toString() !== sale._id.toString()
      );
      
      // Si plus d'allocations, SUPPRIMER le paiement complètement
      if (payment.allocations.length === 0) {
        await ClientPayment.findByIdAndDelete(payment._id);
        paymentsDeleted++;
      } else {
        // Sinon juste sauvegarder les allocations mises à jour
        await payment.save();
        paymentsUpdated++;
      }
    }

    // ==========================================
    // 3. RESTAURER LE STOCK POUR CHAQUE ARTICLE
    // ==========================================
    for (const item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        product.stockCartons += item.quantity;
        await product.save();

        // Créer un mouvement de retour
        await StockMovement.create({
          product: product._id,
          productName: product.name,
          type: 'entrée',
          quantityCartons: item.quantity,
          reason: 'retour',
          reference: `ANNULATION-${sale.saleNumber}`,
          recordedBy: req.user._id
        });
      }
    }

    // ==========================================
    // 4. SUPPRIMER LES MOUVEMENTS DE STOCK INITIAUX DE CETTE VENTE
    // ==========================================
    await StockMovement.deleteMany({
      reason: 'vente',
      reference: { $exists: false }, // Mouvements sans référence = mouvements initiaux
      product: { $in: sale.items.map(item => item.product) },
      createdAt: { 
        $gte: new Date(sale.createdAt.getTime() - 5000), // 5 secondes avant
        $lte: new Date(sale.createdAt.getTime() + 5000)  // 5 secondes après
      }
    });

    // ==========================================
    // 5. AJUSTER LA DETTE DU CLIENT SI VENTE À CRÉDIT
    // ==========================================
    if (sale.client && sale.paymentType === 'credit') {
      const client = await Client.findById(sale.client);
      if (client) {
        
        // Nettoyer debtHistory - Retirer l'entrée créée lors de cette vente
        const montantInitialCredit = sale.totalAmount - sale.initialAmountPaid;
        client.debtHistory = client.debtHistory.filter(entry => {
          const isSameAmount = Math.abs(entry.amount - montantInitialCredit) < 0.01;
          const isSameDate = Math.abs(new Date(entry.date) - new Date(sale.createdAt)) < 60000; // 1 minute de marge
          return !(isSameAmount && isSameDate);
        });

        // Recalculer la dette totale depuis toutes les ventes à crédit restantes
        const allCreditSales = await Sale.find({ 
          _id: { $ne: sale._id }, // Exclure la vente qu'on supprime
          client: client._id, 
          paymentType: 'credit' 
        });
        
        client.currentDebt = allCreditSales.reduce((sum, s) => sum + s.remainingAmount, 0);
        
        // Recalculer le statut de blocage
        client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
        
        await client.save();
      }
    }

    // ==========================================
    // 6. SUPPRIMER LA VENTE
    // ==========================================
    await Sale.findByIdAndDelete(req.params.id);

    res.json({ 
      message: 'Vente supprimée avec succès - Toutes les données liées ont été nettoyées',
      details: {
        saleNumber: sale.saleNumber,
        stockRestored: sale.items.length,
        invoiceDeleted: true,
        paymentsDeleted,
        paymentsUpdated,
        clientDebtRecalculated: sale.client && sale.paymentType === 'credit'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};


module.exports = { getSales, getSale, createSale, updateSale, deleteSale };