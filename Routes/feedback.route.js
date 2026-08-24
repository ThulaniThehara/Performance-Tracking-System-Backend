const express = require('express');
const feedbackController = require('../Controllers/feedback.controller');
const { verifyToken, requireRole } = require('../Middleware/auth.middleware');

const router = express.Router();

// Member / User routes (Authenticated)
router.post('/submit-feedback', verifyToken, feedbackController.submitFeedback);
router.post('/submit-complaint', verifyToken, feedbackController.submitComplaint);
router.get('/my-submissions', verifyToken, feedbackController.getMySubmissions);
router.get('/project/:projectId', verifyToken, feedbackController.getProjectSubmissions);

// Admin-only routes
router.get('/admin/all', verifyToken, requireRole('ADMIN'), feedbackController.getAllAdminSubmissions);
router.patch('/admin/complaint/:id/status', verifyToken, requireRole('ADMIN'), feedbackController.updateComplaintStatus);
router.delete('/admin/:type/:id', verifyToken, requireRole('ADMIN'), feedbackController.deleteSubmission);

module.exports = router;
