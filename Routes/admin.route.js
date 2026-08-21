const express = require('express');
const adminController = require('../Controllers/admin.controller');
const { verifyToken, requireRole } = require('../Middleware/auth.middleware');

const router = express.Router();

// Everything under /api/admin requires a valid ADMIN session.
router.use(verifyToken, requireRole('ADMIN'));

router.get('/stats', adminController.getStats);

router.post('/users/create', adminController.createUser);
router.post('/users/:id/resend-invite', adminController.resendInvite);
router.patch('/users/:id/status', adminController.setUserStatus);

module.exports = router;
