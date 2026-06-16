const express = require('express');
const router = express.Router();
const { getNotifications, markAsRead, markAllAsRead, deleteNotification } = require('../controllers/notificationsController');
const { protect } = require('../middlewares/authMiddleware');

router.use(protect);

router.get('/', getNotifications);
router.put('/red-all', markAllAsRead);
router.put('/:id/read', markAsRead);
router.delete('/:id', deleteNotification);

module.exports = router;