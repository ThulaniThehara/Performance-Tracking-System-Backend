const express = require('express');

const baseUserControllers = require("../Controllers/baseUser.controller");

const router = express.Router();

// Route to register a new user
router.post('/add', baseUserControllers.registerUser);
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