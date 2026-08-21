const express = require('express');

const baseUserControllers = require("../Controllers/baseUser.controller");

const { verifyToken, requireRole } = require('../Middleware/auth.middleware');

const router = express.Router();

// Route to register a new user
// Locked to ADMIN: this handler takes userRole straight from the request body,
// so leaving it public let anyone create themselves an ADMIN account.
// Prefer POST /api/admin/users/create (invite flow) for new accounts.
router.post('/add', verifyToken, requireRole('ADMIN'), baseUserControllers.registerUser);
router.get('/all', baseUserControllers.getAllUsers);
router.get('/id/:id', baseUserControllers.getUserById);
router.get('/email/:email', baseUserControllers.getUserByEmail);
router.get('/indexNo/:indexNo', baseUserControllers.getUserByIndex);
router.get('/name/:name', baseUserControllers.getUserByName);
router.get('/contactNO/:contactNO', baseUserControllers.getUserByContact);
router.get('/faculty/:faculty', baseUserControllers.getUserByFaculty);
router.get('/batch/:batch', baseUserControllers.getUserByBatch);
router.get('/role/:userRole', baseUserControllers.getUserByRole);

module.exports = router;