const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du produit est obligatoire'],
    trim: true
  },
  category: {
    type: String,
    trim: true
  },
  stockInitialCartons: {
    type: Number,
    default: 0,
    min: 0
  },
  stockCartons: {
    type: Number,
    default: 0,
    min: 0
  },
  stockKg: {
    type: Number,
    default: 0,
    min: 0
  },
  kgPerCarton: {
    type: Number,
    required: [true, 'Le poids par carton est obligatoire'],
    min: 0
  },
  pricePerCarton: {
    type: Number,
    required: [true, 'Le prix par carton est obligatoire'],
    min: 0
  },
  pricePerKg: {
    type: Number,
    required: [true, 'Le prix par kg est obligatoire'],
    min: 0
  },
  purchasePricePerCarton: {
    type: Number,
    default: 0,
    min: 0
  },
  alertThreshold: {
    type: Number,
    default: 5
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Product', productSchema);