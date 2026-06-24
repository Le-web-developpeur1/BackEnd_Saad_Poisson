const mongoose = require('mongoose');

const clientPaymentSchema = new mongoose.Schema({
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientName:  { type: String, required: true },
  clientPhone: { type: String, default: '' },
  amount:      { type: Number, required: true },
  remainingDebt: { type: Number, default: 0},
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ClientPayment', clientPaymentSchema);