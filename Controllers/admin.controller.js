const User = require('../Models/baseUser.model');
const Project = require('../Models/project.model');
const { issueSetPasswordToken } = require('./auth.controller');

// Project.status is a free-text string, so the same idea arrives spelled several
// ways depending on who typed it. Match on a normalised form instead of one literal.
const ONGOING_STATUSES = ['ongoing', 'active', 'inprogress', 'progress', 'started'];
const normalise = (s) => String(s || '').toLowerCase().replace(/[\s_-]/g, '');

/**
 * GET /api/admin/stats   (ADMIN only)
 * Headline counters for the admin home page.
 */
exports.getStats = async (req, res) => {
    try {
        const [totalProjects, totalMembers, activeMembers, statuses] = await Promise.all([
            Project.countDocuments(),
            User.countDocuments(),
            User.countDocuments({ status: 'ACTIVE' }),
            Project.distinct('status'),
        ]);

        const ongoingValues = statuses.filter(s => ONGOING_STATUSES.includes(normalise(s)));
        const ongoingProjects = ongoingValues.length
            ? await Project.countDocuments({ status: { $in: ongoingValues } })
            : 0;

        res.status(200).send({
            message: 'Stats fetched',
            data: {
                totalProjects,
                ongoingProjects,
                completedProjects: totalProjects - ongoingProjects,
                totalMembers,
                activeMembers,
            }
        });
    } catch (e) {
        res.status(500).send({ message: 'Error fetching stats', error: e.message });
    }
};

/**
 * POST /api/admin/users/create   (ADMIN only)
 * Creates the account with NO password and returns a one-time set-password link.
 * Accepts `faculty` or the legacy misspelling `faculy` from the older frontend build.
 */
exports.createUser = async (req, res) => {
    try {
        const b = req.body || {};
        const payload = {
            indexNo: String(b.indexNo || '').trim(),
            email: String(b.email || '').trim().toLowerCase(),
            name: String(b.name || '').trim(),
            faculty: String(b.faculty ?? b.faculy ?? '').trim(),
            batch: String(b.batch || '').trim(),
            contactNO: String(b.contactNO || '').trim(),
            experience: String(b.experience || '').trim(),
            userRole: String(b.userRole || 'MEMBER').trim().toUpperCase(),
        };

        for (const field of ['indexNo', 'email', 'name', 'faculty', 'batch', 'contactNO']) {
            if (!payload[field]) {
                return res.status(400).send({ message: `${field} is required` });
            }
        }

        if (!User.USER_ROLES.includes(payload.userRole)) {
            return res.status(400).send({
                message: `userRole must be one of: ${User.USER_ROLES.join(', ')}`
            });
        }

        const clash = await User.findOne({
            $or: [{ email: payload.email }, { indexNo: payload.indexNo }]
        });
        if (clash) {
            const field = clash.email === payload.email ? 'email' : 'index number';
            return res.status(409).send({ message: `An account with this ${field} already exists` });
        }

        const user = new User(payload);
        const { link } = await issueSetPasswordToken(user); // saves the document

        res.status(201).send({
            message: 'Account created. Send the set-password link to the user.',
            data: user.toPublicJSON(),
            setPasswordLink: link
        });
    } catch (e) {
        if (e.name === 'ValidationError') {
            return res.status(400).send({ message: e.message });
        }
        res.status(500).send({ message: 'Error creating account', error: e.message });
    }
};

/** POST /api/admin/users/:id/resend-invite   (ADMIN only) */
exports.resendInvite = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send({ message: 'Account not found' });

        const { link } = await issueSetPasswordToken(user);
        res.status(200).send({ message: 'New set-password link generated', setPasswordLink: link });
    } catch (e) {
        res.status(500).send({ message: 'Error generating link', error: e.message });
    }
};

/**
 * PATCH /api/admin/users/:id/status   (ADMIN only)
 * Body: { status: "ACTIVE" | "INACTIVE" }   -- this is the "deactivate accounts" requirement.
 */
exports.setUserStatus = async (req, res) => {
    try {
        const status = String(req.body?.status || '').toUpperCase();
        if (!User.USER_STATUS.includes(status)) {
            return res.status(400).send({
                message: `status must be one of: ${User.USER_STATUS.join(', ')}`
            });
        }

        if (String(req.params.id) === req.auth.id && status === 'INACTIVE') {
            return res.status(400).send({ message: 'You cannot deactivate your own account' });
        }

        const user = await User.findById(req.params.id);
        if (!user) return res.status(404).send({ message: 'Account not found' });

        user.status = status;
        await user.save();

        res.status(200).send({ message: `Account set to ${status}`, data: user.toPublicJSON() });
    } catch (e) {
        res.status(500).send({ message: 'Error updating account status', error: e.message });
    }
};
