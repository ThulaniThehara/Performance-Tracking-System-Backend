const express = require("express");
 const taskrouter = express.Router();
const taskController = require("../Controllers/task.controller");



taskrouter.post('/create', taskController.createTask);
taskrouter.get('/get', taskController.getAllTasks);
taskrouter.get('/get/id/:id', taskController.getTaskById);
taskrouter.get('/get/name/:name', taskController.getTaskByName);
taskrouter.get('/get/assignedMember/:assignedMember', taskController.getTaskByAssignedMember);
taskrouter.get('/get/project/:project', taskController.getTaskByProject);
taskrouter.get('/get/committee/:committee', taskController.getTaskByCommittee);
taskrouter.get('/get/status/:status', taskController.getTaskByStatus);
taskrouter.get('/get/startDate/:startDate', taskController.getTaskByStartDate);
taskrouter.get('/get/endDate/:endDate', taskController.getTaskByEndDate);
taskrouter.put('/updateAssigned/:id', taskController.updateAssignedMembers);
taskrouter.delete('/delete/:id', taskController.deleteTask);
taskrouter.delete('/delete/committee/:committee', taskController.deleteTasksByCommittee);
taskrouter.delete('/delete/committeeFromTask', taskController.removeCommittee);

module.exports = taskrouter;
