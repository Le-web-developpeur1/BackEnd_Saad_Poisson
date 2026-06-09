const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword } = require('../controllers/authController');
const { protect, adminOnly } = require('../middlewares/authMiddleware');

router.post('/register', protect, adminOnly, register);
router.post('/login', login);
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

module.exports = router;