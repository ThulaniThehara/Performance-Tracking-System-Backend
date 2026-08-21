const express = require('express');
const eventController = require('../Controllers/event.controller');
const { verifyToken, requireRole } = require('../Middleware/auth.middleware');

const router = express.Router();

// Any signed-in member can see the society calendar...
router.get('/get', verifyToken, eventController.getAllEvents);

// ...but only an admin can change what is on it.
router.post('/add', verifyToken, requireRole('ADMIN'), eventController.addEvent);
router.delete('/:id', verifyToken, requireRole('ADMIN'), eventController.deleteEvent);

module.exports = router;
