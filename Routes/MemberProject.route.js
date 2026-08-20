const express = require('express');
const memberProjectController = require('../Controllers/MemberProject.controller');

const memberProjectRouter = express.Router();



memberProjectRouter.post('/create', memberProjectController.createMemberProject);
memberProjectRouter.get('/get', memberProjectController.getAllMemberProjects);
memberProjectRouter.get('/get/id/:id', memberProjectController.getMemberProjectById);
memberProjectRouter.get('/get/memberId/:memberId', memberProjectController.getMemberProjectByMemberId);
memberProjectRouter.get('/get/name/:PName', memberProjectController.getMemberProjectByName);
memberProjectRouter.get('/get/indexNo/:indexNo', memberProjectController.getRoleByIndexNo);

module.exports = memberProjectRouter;