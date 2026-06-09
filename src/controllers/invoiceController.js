const Invoice = require('../models/Invoice');
const generateInvoicePDF = require('../utils/generateInvoicePDF');

const getInvoices = async (req, res) => {
  try {
    const invoices = await Invoice.find()
      .populate('client', 'name phone address')
      .populate('issuedBy', 'name')
      .sort({ createdAt: -1 });
    res.json(invoices);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getInvoice = async (req, res) => {
  try {
    const invoice = await Invoice.findById(req.params.id)
      .populate('client')
      .populate('issuedBy', 'name');
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
    res.json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const createInvoice = async (req, res) => {
  try {
    const { items, discount = 0, tva = 0, clientName, clientAddress, client, paymentConditions, sale } = req.body;

    const subTotal = items.reduce((sum, item) => sum + item.total, 0);
    const totalHT = subTotal - discount;
    const totalTTC = totalHT + (totalHT * tva / 100);
// Génération du numéro de facture
const count = await Invoice.countDocuments();
const date = new Date();
const year = date.getFullYear();
const month = String(date.getMonth() + 1).padStart(2, '0');
const invoiceNumber = `FAC-${year}${month}-${String(count + 1).padStart(4, '0')}`;

const invoice = await Invoice.create({
  invoiceNumber,
  sale,
  client,
  clientName,
  clientAddress,
  items,
  subTotal,
  discount,
  totalHT,
  tva,
  totalTTC,
  paymentConditions,
  issuedBy: req.user._id
});

    res.status(201).json(invoice);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Enregistrer la signature du client
// @route   PUT /api/invoices/:id/signature
const saveClientSignature = async (req, res) => {
  try {
    const { signature } = req.body;
    const invoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { clientSignature: signature, status: 'payée' },
      { new: true }
    );
    if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
    res.json({ message: 'Signature enregistrée', invoice });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const deleteInvoice = async (req, res) => {
  try {
    await Invoice.findByIdAndDelete(req.params.id);
    res.json({ message: 'Facture supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Télécharger facture en PDF
// @route   GET /api/invoices/:id/pdf
const downloadInvoicePDF = async (req, res) => {
    try {
      const invoice = await Invoice.findById(req.params.id)
        .populate('client')
        .populate('issuedBy', 'name');
      if (!invoice) return res.status(404).json({ message: 'Facture introuvable' });
      await generateInvoicePDF(invoice, res);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

module.exports = { getInvoices, getInvoice, createInvoice, saveClientSignature, deleteInvoice, downloadInvoicePDF  };