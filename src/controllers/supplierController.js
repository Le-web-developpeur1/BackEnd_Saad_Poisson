const Supplier = require('../models/Supplier');

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
      const { amount, note } = req.body;
      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
  
      supplier.totalPaid += amount;
      supplier.balance = supplier.totalPurchases - supplier.totalPaid;
      supplier.payments.push({ amount, note, recordedBy: req.user._id });
      await supplier.save();
  
      res.json({ message: 'Versement enregistré', supplier });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };
  
  const recordPurchase = async (req, res) => {
    try {
      const { amount } = req.body;
      const supplier = await Supplier.findById(req.params.id);
      if (!supplier) return res.status(404).json({ message: 'Fournisseur introuvable' });
  
      supplier.totalPurchases += amount;
      supplier.balance = supplier.totalPurchases - supplier.totalPaid;
      await supplier.save();
  
      res.json({ message: 'Achat enregistré', supplier });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

module.exports = { getSuppliers, getSupplier, createSupplier, updateSupplier, deleteSupplier, recordSupplierPayment, recordPurchase };