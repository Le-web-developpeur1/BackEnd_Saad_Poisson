const mongoose = require('mongoose');

const supplierPurchaseSchema = new mongoose.Schema({
  supplier:      { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
  supplierName:  { type: String, required: true },
  items: [{
    libelle:         { type: String, required: true },
    quantiteCartons: { type: Number, default: 0 },
    prixUnitaire:    { type: Number, required: true },
    montantTotal:    { type: Number, required: true },
  }],
  montantTotal:   { type: Number, required: true },
  montantPaye:    { type: Number, default: 0 },
  montantRestant: { type: Number, default: 0 },
  modePaiement:   { type: String, enum: ['comptant', 'virement', 'non_payé'], default: 'non_payé' },
  statut:         { type: String, enum: ['payé', 'partiel', 'impayé'], default: 'impayé' },
  expenseId:      { type: mongoose.Schema.Types.ObjectId, ref: 'Expense', default: null },
  recordedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

module.exports = mongoose.model('SupplierPurchase', supplierPurchaseSchema);