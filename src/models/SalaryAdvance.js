const mongoose = require('mongoose');

const salaryAdvanceSchema = new mongoose.Schema({
  employee:     { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
  employeeName: { type: String, required: true },
  amount:       { type: Number, required: true },
  reason:       { type: String, default: '' },
  status:       { type: String, enum: ['en_attente', 'déduit'], default: 'en_attente' },
  deductedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'SalaryPayment', default: null },
  paidBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  expenseId:    { type: mongoose.Schema.Types.ObjectId, ref: 'Expense' },
}, { timestamps: true });

module.exports = mongoose.model('SalaryAdvance', salaryAdvanceSchema);