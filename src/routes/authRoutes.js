const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword, getUsers, updateUser, toggleUserStatus, deleteUser  } = require('../controllers/authController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/register', protect, adminOnly, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);
router.get('/users', protect, adminOnly, getUsers);
router.put('/users/:id', protect, adminOnly, updateUser);
router.put('/users/:id/toggle', protect, adminOnly, toggleUserStatus);
router.delete('/users/:id', protect, adminOnly, deleteUser);


module.exports = router;