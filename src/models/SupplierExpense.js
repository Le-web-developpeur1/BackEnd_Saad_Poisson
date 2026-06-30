const mongoose = require('mongoose');

const supplierExpenseSchema = new mongoose.Schema({
  supplier:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName:  { type: String, required: true },
  title:         { type: String, required: true },
  amount:        { type: Number, required: true },
  modePaiement:  { type: String, enum: ['comptant', 'virement'], required: true },
  note:          { type: String, default: '' },
  date:          { type: Date, default: Date.now },
  recordedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SupplierExpense', supplierExpenseSchema);