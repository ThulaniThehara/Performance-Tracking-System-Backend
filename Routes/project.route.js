const express = require('express');

const projectControllers = require("../Controllers/project.controller");

const router = express.Router();

router.post('/add', projectControllers.addProject);
router.get('/get', projectControllers.getAllProject);
router.get('/:id', projectControllers.getProjectById);
router.get('/name/:PName', projectControllers.getProjectByName);
router.get('/status/:status', projectControllers.getProjectByStatus);
router.get('/StartDate/:StartDate', projectControllers.getProjectByStartDate);
router.get('/EndDate/:EndDate', projectControllers.getProjectByEndDate);
router.get('/chairPerson/:chairPerson', projectControllers.getProjectByChairPerson);


module.exports = router;
