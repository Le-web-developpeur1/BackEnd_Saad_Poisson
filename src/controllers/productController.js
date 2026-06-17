const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');
const { notifyUsers } = require('../utils/notify');

// @desc  Lister tous les produits
const getProducts = async (req, res) => {
  try {
    const products = await Product.find({ isActive: true }).sort({ name: 1 });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc  Lister  Un produit
const getProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Créer un produit
const createProduct = async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.stockCartons && data.kgPerCarton) {
      data.stockKg = data.stockCartons * data.kgPerCarton;
    }
    const product = await Product.create(data);
    res.status(201).json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier un produit
const updateProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });
    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer un produit (désactivation)
const deleteProduct = async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true });
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });
    res.json({ message: 'Produit désactivé avec succès' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Ajuster le stock manuellement
const adjustStock = async (req, res) => {
  try {
    const { quantityCartons, quantityKg, reason, type } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    if (type === 'entrée') {
      product.stockCartons += quantityCartons || 0;
      product.stockKg += quantityKg || 0;
    } else if (type === 'sortie') {
      product.stockCartons -= quantityCartons || 0;
      product.stockKg -= quantityKg || 0;
    } else {
      product.stockCartons = quantityCartons || product.stockCartons;
      product.stockKg = quantityKg || product.stockKg;
    }

    await product.save();

    if (product.stockCartons <= product.alertThreshold) {
      await notifyUsers (
        'lowStock',
        'Alerte stock bas',
        `Le produit "${product.name}" est en sctock bas : ${product.stockCartons} cartons restants`,
        '/products'
      );
    }

    await StockMovement.create({
      product: product._id,
      productName: product.name,
      type,
      quantityCartons: quantityCartons || 0,
      quantityKg: quantityKg || 0,
      reason,
      recordedBy: req.user._id
    });

    res.json(product);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Produits en alerte de stock
const getLowStockProducts = async (req, res) => {
  try {
    const products = await Product.find({
      isActive: true,
      $expr: { $lte: ['$stockCartons', '$alertThreshold'] }
    });
    res.json(products);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getProducts, getProduct, createProduct, updateProduct, deleteProduct, adjustStock, getLowStockProducts };