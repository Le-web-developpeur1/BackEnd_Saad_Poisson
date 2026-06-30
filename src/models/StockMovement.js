const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: String,
  type: {
    type: String,
    enum: ['entrée', 'sortie', 'ajustement'],
    required: true
  },
  quantityCartons: {
    type: Number,
    default: 0
  },
  reason: {
    type: String,
    enum: ['achat', 'vente', 'retour', 'perte', 'ajustement'],
    required: true
  },
  reference: {
    type: String
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('StockMovement', stockMovementSchema);