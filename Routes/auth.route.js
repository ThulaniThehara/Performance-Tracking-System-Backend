const express = require('express');
const authController = require('../Controllers/auth.controller');
const { verifyToken } = require('../Middleware/auth.middleware');

const router = express.Router();

// Public
router.post('/login', authController.login);
router.post('/set-password', authController.setPassword);

// Authenticated
router.get('/me', verifyToken, authController.me);
router.post('/change-password', verifyToken, authController.changePassword);

module.exports = router;
