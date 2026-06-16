const mongoose = require('mongoose');

const salaryPaymentSchema = new mongoose.Schema({
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  position:     { type: String },
  period: { // "Juin 2026" ou "15/06/2026" pour journalier
    type: String,
    required: true
  },
  daysWorked: { type: Number, default: null }, // pour journalier
  amount:     { type: Number, required: true },
  paymentDate: { type: Date, default: Date.now },
  note: { type: String, trim: true },
  paidBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expenseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' } // lien vers la dépense créée
}, { timestamps: true });

module.exports = mongoose.model('SalaryPayment', salaryPaymentSchema);