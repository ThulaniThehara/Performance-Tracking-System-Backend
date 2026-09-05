const Feedback = require('../Models/feedback.model');
const Complaint = require('../Models/complaint.model');
const User = require('../Models/baseUser.model');

// Submit Feedback (Member / Chairperson)
exports.submitFeedback = async (req, res) => {
    try {
        const { type, message, rating, author, role, projectId, projectName, targetMember } = req.body || {};

        if (!message || !String(message).trim()) {
            return res.status(400).send({ message: 'Feedback message is required' });
        }

        let userAuthor = author;
        let userRole = role;
        let userId = req.auth?.id || null;

        if (userId) {
            const u = await User.findById(userId);
            if (u) {
                userAuthor = u.name || u.username || userAuthor;
                userRole = u.userRole || userRole;
            }
        }

        const newFeedback = new Feedback({
            userId,
            author: userAuthor || 'Anonymous Member',
            role: userRole || 'Member',
            type: type || 'General Feedback',
            projectId: projectId || null,
            projectName: projectName || null,
            targetMember: targetMember || null,
            message: String(message).trim(),
            rating: Number(rating) || 5,
        });

        await newFeedback.save();

        // Dispatch notifications to Admins and Project Chairperson without sending duplicates if user holds both roles
        try {
            const { notify } = require('../Services/notification.service');
            const Project = require('../Models/project.model');

            let targetProj = null;
            if (projectId) {
                targetProj = await Project.findById(projectId);
            } else if (projectName) {
                targetProj = await Project.findOne({ PName: projectName });
            }

            const admins = await User.find({ userRole: 'ADMIN' }, '_id');
            const adminIdsSet = new Set(admins.map(a => String(a._id)));
            const chairIdStr = targetProj?.chairpersonId ? String(targetProj.chairpersonId._id || targetProj.chairpersonId) : null;
            const shortMsg = message.length > 50 ? `${message.substring(0, 50)}...` : message;

            // 1. Notify Admins (if admin is also the project chairperson, send specific project message)
            for (const admin of admins) {
                const adminIdStr = String(admin._id);
                if (adminIdStr === String(userId)) continue;

                if (chairIdStr && adminIdStr === chairIdStr && targetProj) {
                    await notify({
                        recipient: admin._id,
                        actor: userId,
                        type: 'FEEDBACK_SUBMITTED',
                        message: `New feedback for "${targetProj.PName}" from ${userAuthor}: "${shortMsg}"`,
                        projectId: targetProj._id,
                        link: `/projects/${targetProj._id}?tab=feedbacks`,
                    });
                } else {
                    await notify({
                        recipient: admin._id,
                        actor: userId,
                        type: 'FEEDBACK_SUBMITTED',
                        message: `New feedback from ${userAuthor}: "${shortMsg}"`,
                        link: '/AdminFeedback',
                    });
                }
            }

            // 2. Notify Project Chairperson if not already notified in admin loop above
            if (targetProj && chairIdStr && chairIdStr !== String(userId) && !adminIdsSet.has(chairIdStr)) {
                await notify({
                    recipient: targetProj.chairpersonId,
                    actor: userId,
                    type: 'FEEDBACK_SUBMITTED',
                    message: `New feedback for "${targetProj.PName}" from ${userAuthor}: "${shortMsg}"`,
                    projectId: targetProj._id,
                    link: `/projects/${targetProj._id}?tab=feedbacks`,
                });
            }
        } catch (notifErr) {
            console.error('Error dispatching feedback notification:', notifErr);
        }

        res.status(201).send({
            message: 'Feedback submitted successfully! Thank you.',
            feedback: newFeedback,
        });
    } catch (e) {
        res.status(500).send({ message: 'Failed to submit feedback', error: e.message });
    }
};

// Submit Complaint / Report Issue (Member / Chairperson)
exports.submitComplaint = async (req, res) => {
    try {
        const { title, description, category, priority, from, projectId, projectName, targetMember } = req.body || {};

        if (!title || !String(title).trim()) {
            return res.status(400).send({ message: 'Complaint title is required' });
        }
        if (!description || !String(description).trim()) {
            return res.status(400).send({ message: 'Complaint description is required' });
        }

        let userFrom = from;
        let userId = req.auth?.id || null;

        if (userId) {
            const u = await User.findById(userId);
            if (u) {
                userFrom = u.name || u.username || userFrom;
            }
        }

        const newComplaint = new Complaint({
            userId,
            from: userFrom || 'Anonymous Member',
            category: category || 'Technical Issue',
            projectId: projectId || null,
            projectName: projectName || null,
            targetMember: targetMember || null,
            title: String(title).trim(),
            description: String(description).trim(),
            priority: priority || 'Medium',
            status: 'Open',
        });

        await newComplaint.save();

        // Dispatch notifications to Admins and Project Chairperson without duplicates
        try {
            const { notify } = require('../Services/notification.service');
            const Project = require('../Models/project.model');

            let targetProj = null;
            if (projectId) {
                targetProj = await Project.findById(projectId);
            } else if (projectName) {
                targetProj = await Project.findOne({ PName: projectName });
            }

            const admins = await User.find({ userRole: 'ADMIN' }, '_id');
            const adminIdsSet = new Set(admins.map(a => String(a._id)));
            const chairIdStr = targetProj?.chairpersonId ? String(targetProj.chairpersonId._id || targetProj.chairpersonId) : null;

            // 1. Notify Admins
            for (const admin of admins) {
                const adminIdStr = String(admin._id);
                if (adminIdStr === String(userId)) continue;

                if (chairIdStr && adminIdStr === chairIdStr && targetProj) {
                    await notify({
                        recipient: admin._id,
                        actor: userId,
                        type: 'COMPLAINT_SUBMITTED',
                        message: `Issue reported in "${targetProj.PName}" by ${userFrom}: "${title}"`,
                        projectId: targetProj._id,
                        link: `/projects/${targetProj._id}?tab=complaints`,
                    });
                } else {
                    await notify({
                        recipient: admin._id,
                        actor: userId,
                        type: 'COMPLAINT_SUBMITTED',
                        message: `New issue reported by ${userFrom}: "${title}"`,
                        link: '/AdminFeedback',
                    });
                }
            }

            // 2. Notify Project Chairperson if not already notified in admin loop above
            if (targetProj && chairIdStr && chairIdStr !== String(userId) && !adminIdsSet.has(chairIdStr)) {
                await notify({
                    recipient: targetProj.chairpersonId,
                    actor: userId,
                    type: 'COMPLAINT_SUBMITTED',
                    message: `Issue reported in "${targetProj.PName}" by ${userFrom}: "${title}"`,
                    projectId: targetProj._id,
                    link: `/projects/${targetProj._id}?tab=complaints`,
                });
            }
        } catch (notifErr) {
            console.error('Error dispatching complaint notification:', notifErr);
        }

        res.status(201).send({
            message: 'Complaint / Issue report submitted successfully. Admin has received it.',
            complaint: newComplaint,
        });
    } catch (e) {
        res.status(500).send({ message: 'Failed to submit complaint', error: e.message });
    }
};

// Get User's Own Submissions (Member / Chairperson)
exports.getMySubmissions = async (req, res) => {
    try {
        const userId = req.auth?.id;
        if (!userId) return res.status(401).send({ message: 'Unauthorized' });

        const [feedbacks, complaints] = await Promise.all([
            Feedback.find({ userId }).sort({ createdAt: -1 }),
            Complaint.find({ userId }).sort({ createdAt: -1 }),
        ]);

        res.status(200).send({ feedbacks, complaints });
    } catch (e) {
        res.status(500).send({ message: 'Failed to fetch submissions', error: e.message });
    }
};

// Admin: Get All Feedbacks & Complaints
exports.getAllAdminSubmissions = async (req, res) => {
    try {
        const [feedbacks, complaints] = await Promise.all([
            Feedback.find().populate('userId', 'name email indexNo userRole').sort({ createdAt: -1 }),
            Complaint.find().populate('userId', 'name email indexNo userRole').sort({ createdAt: -1 }),
        ]);

        res.status(200).send({
            feedbacks,
            complaints,
            stats: {
                totalFeedbacks: feedbacks.length,
                totalComplaints: complaints.length,
                openComplaints: complaints.filter(c => c.status === 'Open').length,
                resolvedComplaints: complaints.filter(c => c.status === 'Resolved').length,
            }
        });
    } catch (e) {
        res.status(500).send({ message: 'Failed to load admin submissions', error: e.message });
    }
};

// Admin: Update Complaint Status
exports.updateComplaintStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!['Open', 'In Progress', 'Resolved'].includes(status)) {
            return res.status(400).send({ message: 'Invalid status' });
        }

        const updated = await Complaint.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );

        if (!updated) {
            return res.status(404).send({ message: 'Complaint not found' });
        }

        res.status(200).send({ message: 'Status updated successfully', complaint: updated });
    } catch (e) {
        res.status(500).send({ message: 'Failed to update complaint status', error: e.message });
    }
};

// Get Feedbacks & Complaints for a Specific Project
exports.getProjectSubmissions = async (req, res) => {
    try {
        const { projectId } = req.params;
        const { projectName } = req.query;

        const orConditions = [{ projectId: String(projectId) }];
        if (projectName) {
            orConditions.push({ projectName: String(projectName) });
        }

        const query = { $or: orConditions };

        const [feedbacks, complaints] = await Promise.all([
            Feedback.find(query).populate('userId', 'name email indexNo userRole').sort({ createdAt: -1 }),
            Complaint.find(query).populate('userId', 'name email indexNo userRole').sort({ createdAt: -1 }),
        ]);

        res.status(200).send({
            feedbacks,
            complaints,
            stats: {
                totalFeedbacks: feedbacks.length,
                totalComplaints: complaints.length,
                openComplaints: complaints.filter(c => c.status === 'Open').length,
                resolvedComplaints: complaints.filter(c => c.status === 'Resolved').length,
            }
        });
    } catch (e) {
        res.status(500).send({ message: 'Failed to fetch project submissions', error: e.message });
    }
};

// Admin: Delete Feedback or Complaint
exports.deleteSubmission = async (req, res) => {
    try {
        const { type, id } = req.params;
        if (type === 'feedback') {
            await Feedback.findByIdAndDelete(id);
        } else if (type === 'complaint') {
            await Complaint.findByIdAndDelete(id);
        } else {
            return res.status(400).send({ message: 'Invalid type' });
        }

        res.status(200).send({ message: 'Item deleted successfully' });
    } catch (e) {
        res.status(500).send({ message: 'Failed to delete item', error: e.message });
    }
};
