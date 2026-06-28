const mongoose = require('mongoose');

const bankTransferSchema = new mongoose.Schema({
  amount:      { type: Number, required: true },
  direction:   { type: String, enum: ['caisse_vers_banque', 'banque_vers_caisse'], required: true },
  note:        { type: String, default: '' },
  recordedBy:  { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('BankTransfer', bankTransferSchema);