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
    data.stockInitialCartons = data.stockCartons || 0;
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
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    // 🆕 VÉRIFICATION 1 : Stock restant
    if (product.stockCartons > 0) {
      return res.status(400).json({ 
        message: `Impossible de supprimer ce produit : ${product.stockCartons} carton(s) en stock. Veuillez d'abord ajuster le stock à 0.`,
        currentStock: product.stockCartons
      });
    }

    // 🆕 VÉRIFICATION 2 : Vérifier l'historique
    const Sale = require('../models/Sale');
    const totalSales = await Sale.countDocuments({ 'items.product': product._id });
    const Damage = require('../models/Damage');
    const totalDamages = await Damage.countDocuments({ product: product._id });
    const totalMovements = await StockMovement.countDocuments({ product: product._id });
    
    const hasHistory = totalSales > 0 || totalDamages > 0 || totalMovements > 0;

    if (hasHistory) {
      // Soft delete pour préserver l'historique
      product.isActive = false;
      product.name = `[ARCHIVÉ] ${product.name}`; // 🆕 Marquer visuellement
      await product.save();

      return res.json({ 
        message: 'Produit archivé avec succès (historique préservé)',
        product,
        archived: true,
        stats: {
          totalSales,
          totalDamages,
          totalMovements
        }
      });
    } else {
      // Hard delete si aucun historique (produit jamais utilisé)
      await Product.findByIdAndDelete(req.params.id);
      
      return res.json({ 
        message: 'Produit supprimé définitivement (aucun historique)',
        deleted: true
      });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 RÉACTIVER UN PRODUIT ARCHIVÉ
const restoreProduct = async (req, res) => {
  try {
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    if (product.isActive) {
      return res.status(400).json({ message: 'Ce produit est déjà actif' });
    }

    // Retirer le préfixe [ARCHIVÉ]
    if (product.name.startsWith('[ARCHIVÉ] ')) {
      product.name = product.name.replace('[ARCHIVÉ] ', '');
    }

    product.isActive = true;
    await product.save();

    res.json({ 
      message: 'Produit réactivé avec succès',
      product
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// 🆕 LISTER LES PRODUITS ARCHIVÉS
const getArchivedProducts = async (req, res) => {
  try {
    const archivedProducts = await Product.find({ isActive: false }).sort({ name: 1 });
    res.json(archivedProducts);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Ajuster le stock manuellement
const adjustStock = async (req, res) => {
  try {
    const { quantityCartons, reason, type } = req.body;
    const product = await Product.findById(req.params.id);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    const qCartons = Number(quantityCartons || 0);

    if (type === 'entrée') {
      product.stockCartons        += qCartons;
      product.stockInitialCartons += qCartons;
    } else if (type === 'sortie') {
      product.stockCartons = Math.max(0, product.stockCartons - qCartons);
    } else {
      product.stockCartons        = qCartons;
      product.stockInitialCartons = qCartons;
    }

    await product.save();

    if (product.stockCartons <= product.alertThreshold) {
      await notifyUsers(
        'lowStock',
        'Alerte stock bas',
        `Le produit "${product.name}" est en stock bas : ${product.stockCartons} cartons restants`,
        '/products'
      );
    }

    await StockMovement.create({
      product: product._id,
      productName: product.name,
      type,
      quantityCartons: qCartons,
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

module.exports = { 
  getProducts, getProduct, createProduct, updateProduct, deleteProduct, 
  restoreProduct, getArchivedProducts,
  adjustStock, getLowStockProducts 
};