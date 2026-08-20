const express = require('express');
const router = express.Router();
const committeeController = require('../Controllers/committee.controller');



router.post('/add', committeeController.addCommittee);
router.get('/all', committeeController.getCommittees);


router.get('/name/:name', committeeController.getCommitteesByName);
router.get('/count/:Count', committeeController.getCommitteesByMemCount);
router.get('/project/:projectId', committeeController.getCommitteesByProject);
router.get('/user/my-committees', committeeController.getUserCommittees);

router.get('/:id', committeeController.getCommitteeById);

router.post('/:id/members', committeeController.addMember);
router.delete('/:id/members', committeeController.removeMember);
router.delete('/:id', committeeController.deleteCommittee);



module.exports = router;