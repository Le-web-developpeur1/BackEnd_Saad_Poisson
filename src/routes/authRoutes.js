const express = require('express');
const router = express.Router();
const { 
  register, login, getMe, updatePassword, getUsers, updateUser, 
  toggleUserStatus, deleteUser, restoreUser, getInactiveUsers 
} = require('../controllers/authController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/register', protect, adminOnly, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

// 🆕 ROUTES STATIQUES EN PREMIER (avant /users/:id)
router.get('/users', protect, adminOnly, getUsers);
router.get('/users/inactive', protect, adminOnly, getInactiveUsers);

// 🆕 ROUTES DYNAMIQUES AVEC :id À LA FIN
router.post('/users/:id/restore', protect, adminOnly, restoreUser);
router.put('/users/:id', protect, adminOnly, updateUser);
router.put('/users/:id/toggle', protect, adminOnly, toggleUserStatus);
router.delete('/users/:id', protect, adminOnly, deleteUser);

module.exports = router;