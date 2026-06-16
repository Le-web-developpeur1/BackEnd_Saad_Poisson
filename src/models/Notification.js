const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: ['lowStock', 'newSale', 'clientBlocked'],
    required: true
  },
  title:   { type: String, required: true },
  message: { type: String, required: true },
  link:    { type: String, default: null },
  isRead:  { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);