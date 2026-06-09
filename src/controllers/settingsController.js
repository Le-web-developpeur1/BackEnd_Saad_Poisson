const Settings = require('../models/Settings');

// @desc    Récupérer les settings de l'utilisateur connecté
// @route   GET /api/settings
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id });
    if (!settings) {
      settings = await Settings.create({ user: req.user._id });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Modifier les settings de l'utilisateur connecté
// @route   PUT /api/settings
const updateSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne({ user: req.user._id });
    if (!settings) {
      settings = await Settings.create({ user: req.user._id });
    }

    const allowedFields = [
      'language', 'theme', 'notifications',
      'defaultPaymentType', 'itemsPerPage'
    ];

    allowedFields.forEach(field => {
      if (req.body[field] !== undefined) {
        settings[field] = req.body[field];
      }
    });

    await settings.save();
    res.json({ message: 'Paramètres mis à jour', settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Réinitialiser les settings par défaut
// @route   DELETE /api/settings/reset
const resetSettings = async (req, res) => {
  try {
    await Settings.findOneAndDelete({ user: req.user._id });
    const settings = await Settings.create({ user: req.user._id });
    res.json({ message: 'Paramètres réinitialisés', settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings, resetSettings };