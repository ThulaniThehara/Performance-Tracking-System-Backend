const express = require('express');
const notifications = require('../Controllers/notification.controller');
const { verifyToken } = require('../Middleware/auth.middleware');

const router = express.Router();

router.use(verifyToken);

router.get('/', notifications.getMyNotifications);
router.patch('/read-all', notifications.markAllRead);
router.patch('/:id/read', notifications.markRead);

module.exports = router;
