const mongoose = require('mongoose');

const damageSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: { type: String },
  reason: {
    type: String,
    enum: ['périmé', 'pourri', 'endommagé', 'contamination', 'autre'],
    required: true
  },
  quantityCartons: { type: Number, default: 0 },
  estimatedLoss:   { type: Number, default: 0 },
  note:            { type: String, trim: true },
  declaredBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Damage', damageSchema);