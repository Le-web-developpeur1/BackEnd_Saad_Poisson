const mongoose = require('mongoose');

const dailySnapshotSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true // Une seule entrée par jour
  },
  
  // Ventes
  totalSales: { type: Number, default: 0 },
  totalCash: { type: Number, default: 0 },
  totalVirement: { type: Number, default: 0 },
  totalEncaisse: { type: Number, default: 0 },
  totalCartonsVendus: { type: Number, default: 0 },
  salesCount: { type: Number, default: 0 },
  
  // Crédits
  totalCredit: { type: Number, default: 0 }, // Crédit créé ce jour
  totalAcomptes: { type: Number, default: 0 }, // Acomptes versés ce jour
  
  // Remboursements
  creditRembourse: { type: Number, default: 0 }, // Remboursements reçus ce jour
  
  // Dépenses
  totalExpenses: { type: Number, default: 0 },
  
  // Profit
  netProfit: { type: Number, default: 0 },
  
  // Liste des ventes
  sales: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sale'
  }],
  
  // Liste des dépenses
  expenses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense'
  }],
  
  // Métadonnées
  isFinalized: { type: Boolean, default: false }, // Si true, ne peut plus être modifié
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  
}, { timestamps: true });


module.exports = mongoose.model('DailySnapshot', dailySnapshotSchema);
