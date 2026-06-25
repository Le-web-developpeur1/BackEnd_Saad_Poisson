const SystemConfig = require('../models/SystemConfig');

// @desc    Récupérer la config système
const getSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) config = await SystemConfig.create({});
    res.json(config);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier la config système (admin only)
const updateSystemConfig = async (req, res) => {
  try {
    let config = await SystemConfig.findOne();
    if (!config) config = await SystemConfig.create({});

    const allowedFields = [
      'establishmentName', 'establishmentSubtitle', 'description',
      'address', 'phone1', 'phone2', 'email', 'currency',
      'invoiceFooter', 'invoiceTagline', 'tvaRate', 'tauxFCFA' // ← ajouté
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
const uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Aucun fichier envoyé' });
    }

    let config = await SystemConfig.findOne();
    if (!config) config = await SystemConfig.create({});

    const base64 = `data:${req.file.mimetype};base64,${req.file.buffer.toString('base64')}`;
    config.logo = base64;
    config.updatedBy = req.user._id;
    await config.save();

    res.json({ message: 'Logo mis à jour', logo: config.logo });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSystemConfig, updateSystemConfig, uploadLogo };