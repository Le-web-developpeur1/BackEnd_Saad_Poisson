const mongoose = require('mongoose');

// Sous-schéma pour tracer quelles ventes ont été payées
const paymentAllocationSchema = new mongoose.Schema({
  sale: { type: mongoose.Schema.Types.ObjectId, ref: 'Sale', required: true },
  saleNumber: { type: String },
  amountAllocated: { type: Number, required: true },
  saleRemainingBefore: { type: Number }, // Dette de la vente AVANT ce paiement
  saleRemainingAfter: { type: Number }   // Dette de la vente APRÈS ce paiement
}, { _id: false });

const clientPaymentSchema = new mongoose.Schema({
  client:      { type: mongoose.Schema.Types.ObjectId, ref: 'Client', required: true },
  clientName:  { type: String, required: true },
  clientPhone: { type: String, default: '' },
  amount:      { type: Number, required: true },
  
  // 🆕 TRAÇABILITÉ : Quelles ventes ont été payées avec ce paiement
  allocations: [paymentAllocationSchema],
  
  // Dette du client AVANT et APRÈS ce paiement
  clientDebtBefore: { type: Number, default: 0 },
  clientDebtAfter:  { type: Number, default: 0 },
  
  modePaiement: {
    type: String,
    enum: ['comptant', 'virement'],
    default: 'comptant'
  },
  note: { type: String, trim: true }, // 🆕 Pour ajouter des commentaires
  paidBy:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('ClientPayment', clientPaymentSchema);