const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true
  },
  language: {
    type: String,
    enum: ['fr', 'en'],
    default: 'fr'
  },
  theme: {
    type: String,
    enum: ['light', 'dark'],
    default: 'light'
  },
  notifications: {
    lowStock: { type: Boolean, default: true },
    newSale: { type: Boolean, default: true },
    clientBlocked: { type: Boolean, default: true }
  },
  defaultPaymentType: {
    type: String,
    enum: ['comptant', 'credit'],
    default: 'comptant'
  },
  itemsPerPage: {
    type: Number,
    default: 20
  }
}, { timestamps: true });

module.exports = mongoose.model('Settings', settingsSchema);