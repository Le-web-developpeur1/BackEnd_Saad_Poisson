const mongoose = require('mongoose');

const systemConfigSchema = new mongoose.Schema({
  establishmentName: {
    type: String,
    default: 'S.A.D POISSON'
  },
  establishmentSubtitle: {
    type: String,
    default: 'ENTREPRISE SAADE'
  },
  description: {
    type: String,
    default: 'Commerce et Distribution de Poissons Congelés en Gros'
  },
  logo: {
    type: String,
    default: null
  },
  address: {
    type: String,
    default: 'Quartier Tata, Commune Urbaine de Labé, Guinée'
  },
  phone1: {
    type: String,
    default: '622 21 21 37'
  },
  phone2: {
    type: String,
    default: '621 02 02 38'
  },
  email: {
    type: String,
    default: 'saadi1238@icloud.com'
  },
  currency: {
    type: String,
    default: 'GNF'
  },
  invoiceFooter: {
    type: String,
    default: 'Merci pour votre confiance !'
  },
  invoiceTagline: {
    type: String,
    default: 'Votre partenaire de confiance pour le poisson congelé en gros.'
  },
  tvaRate: {
    type: Number,
    default: 0
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.model('SystemConfig', systemConfigSchema);