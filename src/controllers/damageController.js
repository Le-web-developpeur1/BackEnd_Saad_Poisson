const Damage = require('../models/Damage');
const Product = require('../models/Product');
const StockMovement = require('../models/StockMovement');

// @desc    Toutes les avaries
const getDamages = async (req, res) => {
  try {
    const damages = await Damage.find()
      .populate('product', 'name category')
      .populate('declaredBy', 'name')
      .sort({ createdAt: -1 });
    res.json(damages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Déclarer une avarie
const createDamage = async (req, res) => {
  try {
    const { product: productId, reason, quantityCartons = 0, note } = req.body;

    const product = await Product.findById(productId);
    if (!product) return res.status(404).json({ message: 'Produit introuvable' });

    // Vérification stock suffisant
    if (quantityCartons > product.stockCartons) {
      return res.status(400).json({ message: `Stock insuffisant : ${product.stockCartons} cartons disponibles` });
    }

    // Calcul de la perte estimée
    const estimatedLoss = quantityCartons * product.pricePerCarton;

    // Déduction du stock
    product.stockCartons -= quantityCartons;
    await product.save();

    // Mouvement de stock
    await StockMovement.create({
      product: product._id,
      productName: product.name,
      type: 'sortie',
      quantityCartons,
      reason: 'perte',
      reference: `AVARIE-${reason}`,
      recordedBy: req.user._id
    });

    // Enregistrement de l'avarie
    const damage = await Damage.create({
      product: product._id,
      productName: product.name,
      reason,
      quantityCartons,
      estimatedLoss,
      note,
      declaredBy: req.user._id
    });

    res.status(201).json(damage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une avarie
const deleteDamage = async (req, res) => {
  try {
    await Damage.findByIdAndDelete(req.params.id);
    res.json({ message: 'Avarie supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Stats avaries
const getDamageStats = async (req, res) => {
  try {
    const damages = await Damage.find();
    const totalLoss    = damages.reduce((sum, d) => sum + d.estimatedLoss, 0);
    const totalCartons = damages.reduce((sum, d) => sum + d.quantityCartons, 0);
    const totalKg      = damages.reduce((sum, d) => sum + d.quantityKg, 0);

    const byReason = damages.reduce((acc, d) => {
      acc[d.reason] = (acc[d.reason] || 0) + 1;
      return acc;
    }, {});

    res.json({ totalLoss, totalCartons, totalKg, totalDamages: damages.length, byReason });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getDamages, createDamage, deleteDamage, getDamageStats };