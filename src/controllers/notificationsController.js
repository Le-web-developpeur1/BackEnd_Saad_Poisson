const Notification = require('../models/Notification');

// @desc    Mes notifications
// @route   GET /api/notifications
const getNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ user: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50);
    const unreadCount = await Notification.countDocuments({ user: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Marquer une notification comme lue
// @route   PUT /api/notifications/:id/read
const markAsRead = async (req, res) => {
  try {
    const notif = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      { isRead: true },
      { new: true }
    );
    if (!notif) return res.status(404).json({ message: 'Notification introuvable' });
    res.json(notif);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Marquer toutes comme lues
// @route   PUT /api/notifications/read-all
const markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ user: req.user._id, isRead: false }, { isRead: true });
    res.json({ message: 'Toutes les notifications marquées comme lues' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Supprimer une notification
// @route   DELETE /api/notifications/:id
const deleteNotification = async (req, res) => {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    res.json({ message: 'Notification supprimée' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getNotifications, markAsRead, markAllAsRead, deleteNotification };