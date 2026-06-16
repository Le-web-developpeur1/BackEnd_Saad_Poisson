const Sale = require('../models/Sale');
const Product = require('../models/Product');
const Client = require('../models/Client');
const StockMovement = require('../models/StockMovement');
const Invoice = require('../models/Invoice');
const { notifyUsers } = require('../utils/notify');

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

      // Calcul préalable du montant de crédit de cette vente
      let montantVente = 0;
      for (const item of items) {
        const product = await Product.findById(item.product);
        if (product) {
          const unitPrice = item.unit === 'carton' ? product.pricePerCarton : product.pricePerKg;
          montantVente += unitPrice * item.quantity;
        }
      }
      const montantCredit  = montantVente - Number(discount || 0);
      const amountPaidNow  = Number(amountPaid || 0);
      const nouveauCredit  = montantCredit - amountPaidNow;

      // Refuser si ça dépasse le plafond
      if (client.creditLimit > 0 && (client.currentDebt + nouveauCredit) > client.creditLimit) {
        return res.status(403).json({
          message: `Vente refusée — Cette vente porterait la dette de ${client.name} à ${client.currentDebt + nouveauCredit} GNF, ce qui dépasse le plafond de ${client.creditLimit} GNF. Dette actuelle : ${client.currentDebt} GNF.`
        });
      }

      // Bloquer si déjà bloqué
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
      clientName: clientId ? (await Client.findById(clientId)).name : (req.body.clientName || 'Client comptant'),
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
        unit: item.unit === 'carton' ? 'Carton' : 'Kg',
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
        await nofifyUsers(
          'clientBlocked',
          'Client bloqué',
          `${updateClient.name} a atteint son plafond de crédit (${updateClient.creditLimit.toLocaleString('fr-FR')} GNF)`,
          '/credits'
        );
      }
    }
    
    res.status(201).json({ sale, invoiceId: createdInvoice._id, invoiceNumber: createdInvoice.invoiceNumber });  
    console.log('Invoice créée:', createdInvoice._id, createdInvoice.invoiceNumber);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
// @desc    Modifier une vente
// @route   PUT /api/sales/:id
const updateSale = async (req, res) => {
  try {
    const { discount, amountPaid, paymentType, status } = req.body;
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Vente introuvable' });

    // Mettre à jour les champs modifiables
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

    // Mettre à jour la facture associée
    await Invoice.findOneAndUpdate(
      { sale: sale._id },
      {
        discount: sale.discount,
        totalHT: sale.totalAmount - sale.discount,
        totalTTC: sale.totalAmount - sale.discount,
        paymentConditions: sale.paymentType === 'comptant' ? 'Paiement comptant' : 'Paiement à crédit'
      }
    );

    // Mettre à jour la dette client si crédit
    if (sale.client) {
      const client = await Client.findById(sale.client);
      if (client) {
        // Recalculer la dette totale du client
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
// @route   DELETE /api/sales/:id
const deleteSale = async (req, res) => {
  try {
    const sale = await Sale.findById(req.params.id);
    if (!sale) return res.status(404).json({ message: 'Vente introuvable' });

    // Remettre le stock
    for (const item of sale.items) {
      const product = await Product.findById(item.product);
      if (product) {
        if (item.unit === 'carton') {
          product.stockCartons += item.quantity;
          product.stockKg += item.quantity * product.kgPerCarton;
        } else {
          product.stockKg += item.quantity;
        }
        await product.save();

        // Mouvement de stock (retour)
        await StockMovement.create({
          product: product._id,
          productName: product.name,
          type: 'entrée',
          quantityCartons: item.unit === 'carton' ? item.quantity : 0,
          quantityKg: item.unit === 'kg' ? item.quantity : 0,
          reason: 'retour',
          reference: `ANNULATION-${sale.saleNumber}`,
          recordedBy: req.user._id
        });
      }
    }

    // Mettre à jour la dette client
    if (sale.client && sale.paymentType === 'credit') {
      const client = await Client.findById(sale.client);
      if (client) {
        client.currentDebt = Math.max(0, client.currentDebt - sale.remainingAmount);
        client.isBlocked = client.creditLimit > 0 && client.currentDebt >= client.creditLimit;
        await client.save();
      }
    }

    // Supprimer la facture associée
    await Invoice.findOneAndDelete({ sale: sale._id });

    // Supprimer la vente
    await Sale.findByIdAndDelete(req.params.id);

    res.json({ message: 'Vente supprimée et stock restauré' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSales, getSale, createSale, updateSale, deleteSale };