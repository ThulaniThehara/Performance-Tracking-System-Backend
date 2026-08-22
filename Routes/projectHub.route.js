const express = require('express');
const hub = require('../Controllers/projectHub.controller');
const tasks = require('../Controllers/projectTask.controller');
const { verifyToken, requireRole } = require('../Middleware/auth.middleware');
const { loadProjectAccess, requirePerm } = require('../Middleware/projectAccess.middleware');

const router = express.Router();

// Nothing in the Projects module is public.
router.use(verifyToken);

/* ---- the caller's own view ------------------------------------------- */
router.get('/my-projects', hub.getMyProjects);
router.get('/my-dashboard', hub.getMyDashboard);
router.get('/my-tasks', tasks.getMyTasks);
router.patch('/my-tasks/:taskId/status', tasks.updateMyTaskStatus);

/* ---- reports and feedback --------------------------------------------- */
router.get('/reports', hub.getReportsAnalytics);
router.post('/reports/feedback', hub.submitFeedback);
router.post('/reports/complaint', hub.submitComplaint);

/* ---- admin-only project management ------------------------------------ *
 * A project is always created by an admin, who assigns its chairperson in
 * the same step. There is no self-service creation: this keeps every
 * project's ownership a deliberate assignment rather than whoever clicked
 * "create." Day-to-day running of the project (committees, members, tasks)
 * is then done by that chairperson from their own login, via the routes
 * below — loadProjectAccess grants an admin the same rights there too, so an
 * admin can still step in on any project without a separate UI for it.     */
router.get('/admin/projects', requireRole('ADMIN'), hub.getAllProjectsAdmin);
router.post('/projects', requireRole('ADMIN'), hub.createProject);

/* ---- everything below is scoped to one project ------------------------ *
 * loadProjectAccess resolves :projectId, refuses non-members, and attaches
 * req.project / req.membership / req.perms for the guards that follow.      */
router.get('/projects/:projectId', loadProjectAccess, hub.getProjectDetail);

router.patch('/projects/:projectId',
    loadProjectAccess, requirePerm('canEditProject'), hub.updateProject);

/* ---- committees -------------------------------------------------------- */
router.post('/projects/:projectId/committees',
    loadProjectAccess, requirePerm('canManageCommittees'), hub.createCommittee);

router.patch('/projects/:projectId/committees/:committeeId',
    loadProjectAccess, requirePerm('canManageCommittees'), hub.updateCommittee);

router.delete('/projects/:projectId/committees/:committeeId',
    loadProjectAccess, requirePerm('canManageCommittees'), hub.deleteCommittee);

/* ---- members ----------------------------------------------------------- */
router.get('/projects/:projectId/assignable',
    loadProjectAccess, requirePerm('canManageMembers'), hub.getAssignableUsers);

router.post('/projects/:projectId/members',
    loadProjectAccess, requirePerm('canManageMembers'), hub.addMember);

router.delete('/projects/:projectId/members/:userId',
    loadProjectAccess, requirePerm('canManageMembers'), hub.removeMember);

/* ---- tasks -------------------------------------------------------------- *
 * Listing is open to any project member; the controller decides per task who
 * may change what, because a lead's rights depend on the task's committee.   */
router.get('/projects/:projectId/tasks', loadProjectAccess, tasks.listProjectTasks);

router.post('/projects/:projectId/tasks',
    loadProjectAccess, requirePerm('canCreateTasks'), tasks.createTask);

router.patch('/projects/:projectId/tasks/:taskId', loadProjectAccess, tasks.updateTask);

router.delete('/projects/:projectId/tasks/:taskId',
    loadProjectAccess, requirePerm('canDeleteTasks'), tasks.deleteTask);

module.exports = router;
