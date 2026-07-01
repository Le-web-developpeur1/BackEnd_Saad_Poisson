const mongoose = require('mongoose');

const bankInSchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  reason:      { type: String, required: true },
  note:        { type: String, default: '' },
  recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('BankIn', bankInSchema);