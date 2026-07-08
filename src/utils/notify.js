const Notification = require('../models/Notification');
const Settings = require('../models/Settings');
const User = require('../models/User');

/**
 * Crée une notification pour tous les utilisateurs qui ont activé ce type
 * @param {string} type 
 * @param {string} title
 * @param {string} message
 * @param {string} link
 */
const notifyUsers = async (type, title, message, link = null) => {
  try {
    const users = await User.find({ isActive: true });

    for (const user of users) {
      const settings = await Settings.findOne({ user: user._id });
      const enabled = settings?.notifications?.[type] !== false; 

      if (enabled) {
        await Notification.create({
          user: user._id,
          type,
          title,
          message,
          link
        });
      }
    }
  } catch (error) {
  }
};

module.exports = { notifyUsers };