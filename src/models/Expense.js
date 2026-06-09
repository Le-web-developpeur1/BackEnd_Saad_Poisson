const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Le libellé de la dépense est obligatoire'],
    trim: true
  },
  category: {
    type: String,
    enum: ['transport', 'loyer', 'salaire', 'fourniture', 'entretien', 'autre'],
    default: 'autre'
  },
  amount: {
    type: Number,
    required: [true, 'Le montant est obligatoire'],
    min: 0
  },
  date: {
    type: Date,
    default: Date.now
  },
  note: {
    type: String,
    trim: true
  },
  recordedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('Expense', expenseSchema);