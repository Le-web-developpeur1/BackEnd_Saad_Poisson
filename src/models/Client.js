const mongoose = require('mongoose');

const clientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Le nom du client est obligatoire'],
    trim: true
  },
  phone: {
    type: String,
    trim: true
  },
  address: {
    type: String,
    trim: true
  },
  creditLimit: {
    type: Number,
    default: 0,
    min: 0
  },
  currentDebt: {
    type: Number,
    default: 0,
    min: 0
  },
  isBlocked: {
    type: Boolean,
    default: false
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, { timestamps: true });

module.exports = mongoose.model('Client', clientSchema);