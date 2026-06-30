const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du produit est obligatoire'],
    trim: true
  },
  category: {
    type: String,
    default: ''
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
  pricePerCarton: {
    type: Number,
    required: [true, 'Le prix par carton est obligatoire'],
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