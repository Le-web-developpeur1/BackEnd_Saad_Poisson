const SystemConfig = require('../models/SystemConfig');
const path = require('path');
const fs = require('fs');

// @desc    Récupérer la config système
// @route   GET /api/system
const getSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) {
      config = await SystemConfig.create({});
    }
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier la config système (admin only)
// @route   PUT /api/system
const updateSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) config = await SystemConfig.create({});

    const allowedFields = [
      'establishmentName', 'establishmentSubtitle', 'description',
      'address', 'phone1', 'phone2', 'email', 'currency',
      'invoiceFooter', 'invoiceTagline', 'tvaRate'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        config[field] = req.body[field];
      }
    });

    config.updatedBy = req.user._id;
    await config.save();

    res.json({ message: 'Configuration mise à jour', config });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Uploader le logo (admin only)
// @route   POST /api/system/logo
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier envoyé' });
    }

    let config = await SystemConfig.findOne();
    if (!config) config = await SystemConfig.create({});

    // Supprimer l'ancien logo si existant
    if (config.logo) {
      const oldPath = path.join(__dirname, '../../', config.logo);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }

    config.logo = `src/uploads/logos/${req.file.filename}`;
    config.updatedBy = req.user._id;
    await config.save();

    res.json({ message: 'Logo mis à jour', logo: config.logo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSystemConfig, updateSystemConfig, uploadLogo };