const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { protect } = require('../middlewares/authMiddleware');

// Routes publiques
router.post('/register', authController.register);
router.post('/login', authController.login);

// Routes protégées
router.get('/me', protect, authController.getMe);
router.put('/me', protect, authController.updateProfile);
router.put('/password', protect, authController.changePassword);

module.exports = router;