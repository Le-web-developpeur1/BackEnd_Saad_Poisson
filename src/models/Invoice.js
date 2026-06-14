const mongoose = require('mongoose');

const invoiceItemSchema = new mongoose.Schema({
  designation: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: { type: String, required: true },
  unitPrice: { type: Number, required: true },
  total: { type: Number, required: true }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    unique: true
  },
  sale: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  },
  client: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Client'
  },
  clientName: { type: String, required: true },
  clientAddress: { type: String },
  clientPhone: { type: String, default: ''},
  items: [invoiceItemSchema],
  subTotal: { type: Number, required: true },
  discount: { type: Number, default: 0 },
  totalHT: { type: Number, required: true },
  tva: { type: Number, default: 0 },
  totalTTC: { type: Number, required: true },
  paymentConditions: { type: String, trim: true },
  clientSignature: { type: String, default: null },
  status: {
    type: String,
    enum: ['brouillon', 'émise', 'payée'],
    default: 'émise'
  },
  issuedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Invoice', invoiceSchema);