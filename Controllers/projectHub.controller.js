const Project = require('../Models/project.model');
const Committee = require('../Models/Committee.model');
const ProjectMember = require('../Models/projectMember.model');
const ProjectTask = require('../Models/projectTask.model');
const User = require('../Models/baseUser.model');
const Feedback = require('../Models/feedback.model');
const Complaint = require('../Models/complaint.model');
const { notify } = require('../Services/notification.service');

const USER_FIELDS = 'name email indexNo userRole faculty batch contactNO';

/**
 * Counts every card needs, fetched in three grouped queries rather than
 * per-project round trips.
 */
async function summarise(projectIds) {
    if (!projectIds.length) return {};

    const [members, committees, tasks] = await Promise.all([
        ProjectMember.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            { $group: { _id: '$projectId', n: { $sum: 1 } } },
        ]),
        Committee.aggregate([
            { $match: { ProjectId: { $in: projectIds } } },
            { $group: { _id: '$ProjectId', n: { $sum: 1 } } },
        ]),
        ProjectTask.aggregate([
            { $match: { projectId: { $in: projectIds } } },
            {
                $group: {
                    _id: '$projectId',
                    total: { $sum: 1 },
                    done: { $sum: { $cond: [{ $eq: ['$status', 'COMPLETED'] }, 1, 0] } },
                },
            },
        ]),
    ]);

    const out = {};
    const bucket = (id) => (out[id] ||= {
        memberCount: 0, committeeCount: 0, totalTasks: 0, completedTasks: 0, pendingTasks: 0, progress: 0,
    });

    members.forEach(m => { bucket(m._id).memberCount = m.n; });
    committees.forEach(c => { bucket(c._id).committeeCount = c.n; });
    tasks.forEach(t => {
        const b = bucket(t._id);
        b.totalTasks = t.total;
        b.completedTasks = t.done;
        b.pendingTasks = t.total - t.done;
        b.progress = t.total ? Math.round((t.done / t.total) * 100) : 0;
    });

    return out;
}

/**
 * GET /api/pm/my-projects
 * Splits the caller's projects into the ones they lead and the ones they only
 * contribute to — exactly the two dashboard sections.
 */
exports.getMyProjects = async (req, res) => {
    try {
        const memberships = await ProjectMember.find({ userId: req.auth.id });
        const memberProjectIds = memberships.map(m => m.projectId);

        const projects = await Project.find({
            $or: [
                { _id: { $in: memberProjectIds } },
                { chairpersonId: req.auth.id }
            ]
        })
            .populate('chairpersonId', USER_FIELDS)
            .sort({ StartDate: -1, createdAt: -1 });

        const allProjectIds = projects.map(p => p._id);
        const stats = await summarise(allProjectIds);
        const roleByProject = new Map(memberships.map(m => [String(m.projectId), m.role]));

        const led = [];
        const contributing = [];

        for (const p of projects) {
            const isChairUser = p.chairpersonId && String(p.chairpersonId._id || p.chairpersonId) === String(req.auth.id);
            const myRole = isChairUser ? 'CHAIRPERSON' : (roleByProject.get(String(p._id)) || 'MEMBER');
            const card = {
                ...p.toObject(),
                myRole,
                ...(stats[p._id] || {
                    memberCount: 0, committeeCount: 0, totalTasks: 0,
                    completedTasks: 0, pendingTasks: 0, progress: 0,
                }),
            };
            (myRole === 'CHAIRPERSON' ? led : contributing).push(card);
        }

        res.status(200).send({ message: 'Projects fetched', data: { led, contributing } });
    } catch (e) {
        res.status(500).send({ message: 'Could not load your projects', error: e.message });
    }
};

/**
 * GET /api/pm/my-dashboard
 * Aggregated data for the caller's own profile page: every project they're
 * involved in (with a personal contribution % derived from their own task
 * completion on that project), every committee they lead or belong to, a
 * recent-activity feed synthesized from timestamped records (there is no
 * dedicated activity log), and summary stats for the overview cards.
 */
exports.getMyDashboard = async (req, res) => {
    try {
        const userId = req.auth.id;

        const memberships = await ProjectMember.find({ userId });
        const projectIds = memberships.map(m => m.projectId);
        const membershipByProject = new Map(memberships.map(m => [String(m.projectId), m]));

        const [projects, myTasks] = await Promise.all([
            Project.find({ _id: { $in: projectIds } }).sort({ StartDate: -1, createdAt: -1 }),
            ProjectTask.find({ projectId: { $in: projectIds }, assignedTo: userId }),
        ]);

        const tasksByProject = myTasks.reduce((acc, t) => {
            const k = String(t.projectId);
            (acc[k] ||= []).push(t);
            return acc;
        }, {});

        const projectCards = projects.map(p => {
            const membership = membershipByProject.get(String(p._id));
            const myTasksHere = tasksByProject[String(p._id)] || [];
            const completedHere = myTasksHere.filter(t => t.status === 'COMPLETED').length;
            const contribution = myTasksHere.length
                ? Math.round((completedHere / myTasksHere.length) * 100)
                : null;

            return {
                id: p._id,
                name: p.PName,
                societyName: p.societyName || '',
                role: membership?.role || 'MEMBER',
                position: membership?.position || '',
                year: p.StartDate ? new Date(p.StartDate).getFullYear() : new Date(p.createdAt).getFullYear(),
                status: p.status,
                contribution,
            };
        });

        const committeeIds = memberships.filter(m => m.committeeId).map(m => m.committeeId);
        const committees = committeeIds.length
            ? await Committee.find({ _id: { $in: committeeIds } }).populate('ProjectId', 'PName status StartDate EndDate')
            : [];

        const memberCounts = committeeIds.length
            ? await ProjectMember.aggregate([
                { $match: { committeeId: { $in: committeeIds } } },
                { $group: { _id: '$committeeId', n: { $sum: 1 } } },
            ])
            : [];
        const memberCountMap = new Map(memberCounts.map(c => [String(c._id), c.n]));

        const committeeCards = committees.map(c => {
            const membership = memberships.find(m => String(m.committeeId) === String(c._id));
            const proj = c.ProjectId;
            const startYear = proj?.StartDate ? new Date(proj.StartDate).getFullYear() : null;
            const endYear = proj?.EndDate ? new Date(proj.EndDate).getFullYear() : null;
            const year = startYear && endYear && startYear !== endYear
                ? `${startYear}/${endYear}`
                : String(startYear || endYear || '');

            return {
                id: c._id,
                name: c.CName,
                projectName: proj?.PName || '',
                role: membership?.role || 'MEMBER',
                position: membership?.position || '',
                membersCount: memberCountMap.get(String(c._id)) ?? c.MemberCount ?? 0,
                status: proj?.status || 'ACTIVE',
                year,
            };
        });

        // No activity log exists, so the feed is synthesized from timestamps
        // already on hand: task completions, and when the caller took on a
        // chairperson/committee-lead role.
        const activity = [];

        myTasks.filter(t => t.completedAt).forEach(t => {
            const proj = projects.find(p => String(p._id) === String(t.projectId));
            activity.push({
                type: 'task',
                title: `Completed "${t.title}"`,
                detail: proj ? proj.PName : '',
                date: t.completedAt,
            });
        });

        memberships.forEach(m => {
            const proj = projects.find(p => String(p._id) === String(m.projectId));
            if (!proj) return;
            if (m.role === 'CHAIRPERSON') {
                activity.push({
                    type: 'project',
                    title: `Chairing "${proj.PName}"`,
                    detail: 'Assigned as project chairperson',
                    date: m.createdAt,
                });
            } else if (m.role === 'COMMITTEE_LEAD') {
                const c = committees.find(c => String(c._id) === String(m.committeeId));
                activity.push({
                    type: 'committee',
                    title: `Leading "${c?.CName || 'a committee'}"`,
                    detail: proj.PName,
                    date: m.createdAt,
                });
            }
        });

        activity.sort((a, b) => new Date(b.date) - new Date(a.date));
        const recentActivity = activity.slice(0, 8);

        const totalProjects = projectCards.length;
        const completedProjects = projectCards.filter(p => p.status === 'COMPLETED').length;
        const totalCommittees = committeeCards.length;
        const committeesLed = committeeCards.filter(c => c.role === 'COMMITTEE_LEAD').length;
        const totalTasksAssigned = myTasks.length;
        const tasksCompleted = myTasks.filter(t => t.status === 'COMPLETED').length;
        const contributionScore = totalTasksAssigned
            ? Math.round((tasksCompleted / totalTasksAssigned) * 100)
            : 0;

        res.status(200).send({
            message: 'Dashboard fetched',
            data: {
                projects: projectCards,
                committees: committeeCards,
                recentActivity,
                stats: {
                    totalProjects, completedProjects,
                    totalCommittees, committeesLed,
                    totalTasksAssigned, tasksCompleted,
                    contributionScore,
                },
            },
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not load your dashboard', error: e.message });
    }
};

/**
 * GET /api/pm/projects/:projectId
 * Everything the details page renders, plus the caller's permission set so the
 * UI knows which controls to draw.
 */
exports.getProjectDetail = async (req, res) => {
    try {
        const project = req.project;

        const [committees, members, tasks, stats] = await Promise.all([
            Committee.find({ ProjectId: project._id }).populate('leadId', USER_FIELDS).sort({ CName: 1 }),
            ProjectMember.find({ projectId: project._id }).populate('userId', USER_FIELDS),
            ProjectTask.find({ projectId: project._id }).populate('assignedTo', USER_FIELDS).sort({ dueDate: 1 }),
            summarise([project._id]),
        ]);

        // Tasks per member, so member cards can show an assigned-task count.
        const taskCountByUser = tasks.reduce((acc, t) => {
            const k = String(t.assignedTo?._id || t.assignedTo);
            acc[k] = (acc[k] || 0) + 1;
            return acc;
        }, {});

        const memberPayload = members.map(m => ({
            _id: m._id,
            role: m.role,
            position: m.position,
            committeeId: m.committeeId,
            user: m.userId,
            taskCount: taskCountByUser[String(m.userId?._id || m.userId)] || 0,
        }));

        const committeePayload = committees.map(c => ({
            _id: c._id,
            name: c.CName,
            description: c.Description || '',
            lead: c.leadId || null,
            memberCount: memberPayload.filter(m => String(m.committeeId) === String(c._id)).length,
        }));

        res.status(200).send({
            message: 'Project fetched',
            data: {
                project,
                chairperson: project.chairpersonId || null,
                committees: committeePayload,
                members: memberPayload,
                tasks: tasks.map(t => t.toClientJSON()),
                stats: stats[project._id] || {
                    memberCount: 0, committeeCount: 0, totalTasks: 0,
                    completedTasks: 0, pendingTasks: 0, progress: 0,
                },
                permissions: req.perms,
                myRole: req.membership?.role || (req.auth.role === 'ADMIN' ? 'CHAIRPERSON' : 'MEMBER'),
                myCommitteeId: req.membership?.committeeId || null,
            },
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not load the project', error: e.message });
    }
};

/**
 * GET /api/pm/admin/projects   (ADMIN only)
 * Every project in the system, regardless of whether the admin personally
 * belongs to it — powers the Management > Projects overview table. Contrast
 * with getMyProjects, which only returns projects the caller is a member of.
 */
exports.getAllProjectsAdmin = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('chairpersonId', USER_FIELDS)
            .sort({ createdAt: -1 });

        const stats = await summarise(projects.map(p => p._id));

        res.status(200).send({
            message: 'Projects fetched',
            data: projects.map(p => ({
                ...p.toObject(),
                ...(stats[p._id] || {
                    memberCount: 0, committeeCount: 0, totalTasks: 0,
                    completedTasks: 0, pendingTasks: 0, progress: 0,
                }),
            })),
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not load projects', error: e.message });
    }
};

/**
 * POST /api/pm/projects   (ADMIN only)
 * Creates the project and enrols its chairperson in one go, so a project can
 * never exist without an owner who can manage it. The chairperson is always
 * someone the admin explicitly names — there is no self-service creation, so
 * every project's ownership is a deliberate assignment, not a side effect of
 * who happened to click "create."
 */
exports.createProject = async (req, res) => {
    try {
        const b = req.body || {};
        const title = String(b.title || b.PName || '').trim();
        if (!title) return res.status(400).send({ message: 'Project name is required' });
        if (!b.startDate && !b.StartDate) {
            return res.status(400).send({ message: 'Start date is required' });
        }
        if (!b.chairpersonId) {
            return res.status(400).send({ message: 'Please assign a chairperson to this project' });
        }

        const chair = await User.findById(b.chairpersonId);
        if (!chair) return res.status(400).send({ message: 'Chairperson account not found' });

        const status = String(b.status || 'UPCOMING').toUpperCase();
        if (!Project.PROJECT_STATUS.includes(status)) {
            return res.status(400).send({
                message: `status must be one of: ${Project.PROJECT_STATUS.join(', ')}`
            });
        }

        const project = await Project.create({
            PName: title,
            societyName: String(b.societyName || '').trim(),
            description: String(b.description || '').trim(),
            status,
            chairpersonId: chair._id,
            chairPerson: chair.name,
            StartDate: b.startDate || b.StartDate,
            EndDate: b.endDate || b.EndDate || undefined,
        });

        await ProjectMember.create({
            projectId: project._id,
            userId: chair._id,
            role: 'CHAIRPERSON',
            position: 'Chairperson',
        });

        res.status(201).send({ message: 'Project created', data: project });
    } catch (e) {
        if (e.name === 'ValidationError') return res.status(400).send({ message: e.message });
        res.status(500).send({ message: 'Could not create the project', error: e.message });
    }
};

/** PATCH /api/pm/projects/:projectId   (chairperson) */
exports.updateProject = async (req, res) => {
    try {
        const b = req.body || {};
        const p = req.project;

        if (b.title !== undefined || b.PName !== undefined) {
            const t = String(b.title ?? b.PName).trim();
            if (!t) return res.status(400).send({ message: 'Project name cannot be empty' });
            p.PName = t;
        }
        if (b.societyName !== undefined) p.societyName = String(b.societyName).trim();
        if (b.description !== undefined) p.description = String(b.description).trim();
        if (b.startDate !== undefined) p.StartDate = b.startDate;
        if (b.endDate !== undefined) p.EndDate = b.endDate || null;

        if (b.status !== undefined) {
            const s = String(b.status).toUpperCase();
            if (!Project.PROJECT_STATUS.includes(s)) {
                return res.status(400).send({
                    message: `status must be one of: ${Project.PROJECT_STATUS.join(', ')}`
                });
            }
            p.status = s;
        }

        await p.save();
        res.status(200).send({ message: 'Project updated', data: p });
    } catch (e) {
        if (e.name === 'ValidationError') return res.status(400).send({ message: e.message });
        res.status(500).send({ message: 'Could not update the project', error: e.message });
    }
};

/* ------------------------------------------------------------------ *
 *  Committees
 * ------------------------------------------------------------------ */

/** POST /api/pm/projects/:projectId/committees   (chairperson) */
exports.createCommittee = async (req, res) => {
    try {
        const name = String(req.body?.name || req.body?.CName || '').trim();
        if (!name) return res.status(400).send({ message: 'Committee name is required' });

        const clash = await Committee.findOne({ ProjectId: req.project._id, CName: name });
        if (clash) {
            return res.status(409).send({ message: 'This project already has a committee with that name' });
        }

        const committee = await Committee.create({
            CName: name,
            ProjectId: req.project._id,
            Description: String(req.body?.description || '').trim(),
            leadId: req.body?.leadId || null,
        });

        res.status(201).send({ message: 'Committee created', data: committee });
    } catch (e) {
        if (e.name === 'ValidationError') return res.status(400).send({ message: e.message });
        res.status(500).send({ message: 'Could not create the committee', error: e.message });
    }
};

/** PATCH /api/pm/projects/:projectId/committees/:committeeId   (chairperson) */
exports.updateCommittee = async (req, res) => {
    try {
        const committee = await Committee.findOne({
            _id: req.params.committeeId,
            ProjectId: req.project._id,
        });
        if (!committee) return res.status(404).send({ message: 'Committee not found' });

        const b = req.body || {};
        if (b.name !== undefined) {
            const n = String(b.name).trim();
            if (!n) return res.status(400).send({ message: 'Committee name cannot be empty' });
            committee.CName = n;
        }
        if (b.description !== undefined) committee.Description = String(b.description).trim();

        // Changing the lead also promotes/demotes the underlying memberships.
        if (b.leadId !== undefined) {
            if (b.leadId) {
                const membership = await ProjectMember.findOne({
                    projectId: req.project._id,
                    userId: b.leadId,
                });
                if (!membership) {
                    return res.status(400).send({ message: 'That person is not a member of this project' });
                }

                // Step the previous lead back down, unless they are the chairperson.
                if (committee.leadId && String(committee.leadId) !== String(b.leadId)) {
                    await ProjectMember.updateOne(
                        { projectId: req.project._id, userId: committee.leadId, role: 'COMMITTEE_LEAD' },
                        { $set: { role: 'MEMBER' } }
                    );
                }

                membership.committeeId = committee._id;
                if (membership.role !== 'CHAIRPERSON') membership.role = 'COMMITTEE_LEAD';
                await membership.save();

                committee.leadId = b.leadId;
            } else {
                if (committee.leadId) {
                    await ProjectMember.updateOne(
                        { projectId: req.project._id, userId: committee.leadId, role: 'COMMITTEE_LEAD' },
                        { $set: { role: 'MEMBER' } }
                    );
                }
                committee.leadId = null;
            }
        }

        await committee.save();
        res.status(200).send({ message: 'Committee updated', data: committee });
    } catch (e) {
        res.status(500).send({ message: 'Could not update the committee', error: e.message });
    }
};

/** DELETE /api/pm/projects/:projectId/committees/:committeeId   (chairperson) */
exports.deleteCommittee = async (req, res) => {
    try {
        const committee = await Committee.findOneAndDelete({
            _id: req.params.committeeId,
            ProjectId: req.project._id,
        });
        if (!committee) return res.status(404).send({ message: 'Committee not found' });

        // Members stay on the project, they just lose their committee. Tasks
        // likewise survive — orphaning either would be a surprising side effect
        // of deleting a grouping.
        await ProjectMember.updateMany(
            { projectId: req.project._id, committeeId: committee._id },
            { $set: { committeeId: null }, $unset: {} }
        );
        await ProjectMember.updateMany(
            { projectId: req.project._id, committeeId: null, role: 'COMMITTEE_LEAD' },
            { $set: { role: 'MEMBER' } }
        );
        await ProjectTask.updateMany(
            { projectId: req.project._id, committeeId: committee._id },
            { $set: { committeeId: null } }
        );

        res.status(200).send({ message: 'Committee removed', data: committee });
    } catch (e) {
        res.status(500).send({ message: 'Could not remove the committee', error: e.message });
    }
};

/* ------------------------------------------------------------------ *
 *  Members
 * ------------------------------------------------------------------ */

/** POST /api/pm/projects/:projectId/members   (chairperson) */
exports.addMember = async (req, res) => {
    try {
        const b = req.body || {};
        const userId = String(b.userId || '').trim();
        if (!userId) return res.status(400).send({ message: 'userId is required' });

        const user = await User.findById(userId);
        if (!user) return res.status(404).send({ message: 'Account not found' });

        const role = String(b.role || 'MEMBER').toUpperCase();
        if (!ProjectMember.PROJECT_ROLES.includes(role)) {
            return res.status(400).send({
                message: `role must be one of: ${ProjectMember.PROJECT_ROLES.join(', ')}`
            });
        }
        if (role === 'CHAIRPERSON') {
            return res.status(400).send({
                message: 'A project has one chairperson, set when it is created'
            });
        }

        if (b.committeeId) {
            const committee = await Committee.findOne({
                _id: b.committeeId, ProjectId: req.project._id,
            });
            if (!committee) return res.status(400).send({ message: 'Committee not found on this project' });
        }

        const membership = await ProjectMember.findOneAndUpdate(
            { projectId: req.project._id, userId: user._id },
            {
                $set: {
                    role,
                    committeeId: b.committeeId || null,
                    position: String(b.position || '').trim(),
                },
                $setOnInsert: { projectId: req.project._id, userId: user._id },
            },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ).populate('userId', USER_FIELDS);

        await notify({
            recipient: user._id,
            actor: req.auth.id,
            type: b.committeeId ? 'COMMITTEE_MEMBER_ADDED' : 'PROJECT_MEMBER_ADDED',
            message: b.committeeId
                ? `${req.user.name} added you to a committee in "${req.project.PName}"`
                : `${req.user.name} added you to project "${req.project.PName}"`,
            projectId: req.project._id,
            committeeId: b.committeeId || null,
            link: `/projects/${req.project._id}`,
        });

        res.status(201).send({ message: `${user.name} added to the project`, data: membership });
    } catch (e) {
        if (e.code === 11000) {
            return res.status(409).send({ message: 'That person is already on this project' });
        }
        res.status(500).send({ message: 'Could not add the member', error: e.message });
    }
};

/** DELETE /api/pm/projects/:projectId/members/:userId   (chairperson) */
exports.removeMember = async (req, res) => {
    try {
        const { userId } = req.params;

        if (String(req.project.chairpersonId?._id || req.project.chairpersonId) === String(userId)) {
            return res.status(400).send({
                message: 'The chairperson cannot be removed from their own project'
            });
        }

        const membership = await ProjectMember.findOneAndDelete({
            projectId: req.project._id,
            userId,
        });
        if (!membership) return res.status(404).send({ message: 'That person is not on this project' });

        // Free any committee they led, and unassign their tasks rather than
        // deleting work that still needs doing.
        await Committee.updateMany(
            { ProjectId: req.project._id, leadId: userId },
            { $set: { leadId: null } }
        );

        const orphaned = await ProjectTask.countDocuments({
            projectId: req.project._id, assignedTo: userId, status: { $ne: 'COMPLETED' },
        });

        res.status(200).send({
            message: 'Member removed',
            data: { membership, unfinishedTasks: orphaned },
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not remove the member', error: e.message });
    }
};

/**
 * GET /api/pm/projects/:projectId/assignable
 * Accounts that are not yet on this project — powers the "add member" picker.
 */
exports.getAssignableUsers = async (req, res) => {
    try {
        const existing = await ProjectMember.find({ projectId: req.project._id }).select('userId');
        const taken = existing.map(m => m.userId);

        const users = await User.find({ _id: { $nin: taken }, status: 'ACTIVE' })
            .select(USER_FIELDS)
            .sort({ name: 1 });

        res.status(200).send({ message: 'Users fetched', data: users });
    } catch (e) {
        res.status(500).send({ message: 'Could not load users', error: e.message });
    }
};

/**
 * Helper to compute date bounds for period filtering
 */
function getPeriodBounds(period) {
    const now = new Date();
    let startDate = null;
    let endDate = null;

    if (period === 'month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (period === 'quarter') {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        startDate = new Date(now.getFullYear(), qMonth, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), qMonth + 3, 0, 23, 59, 59, 999);
    } else if (period === 'year') {
        startDate = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
        endDate = new Date(now.getFullYear(), 11, 31, 23, 59, 59, 999);
    }

    return { startDate, endDate };
}

/**
 * GET /api/pm/reports?period=all|month|quarter|year
 * Aggregates all members, chairpersons, assigned projects, tasks completed vs before deadline,
 * on-time performance scores, project summaries, and executive KPI analytics.
 */
exports.getReportsAnalytics = async (req, res) => {
    try {
        const period = String(req.query.period || 'all').toLowerCase();
        const { startDate, endDate } = getPeriodBounds(period);

        // 1. Fetch relevant projects
        const projectQuery = {};
        if (startDate && endDate) {
            projectQuery.$or = [
                { StartDate: { $lte: endDate }, EndDate: { $gte: startDate } },
                { StartDate: { $gte: startDate, $lte: endDate } },
                { createdAt: { $gte: startDate, $lte: endDate } },
                { EndDate: null, StartDate: { $lte: endDate } }
            ];
        }

        const allProjects = await Project.find(projectQuery)
            .populate('chairpersonId', USER_FIELDS)
            .sort({ StartDate: -1, createdAt: -1 });

        const projectIds = allProjects.map(p => p._id);
        const statsByProject = await summarise(projectIds);

        // 2. Fetch all active users
        const users = await User.find({ status: 'ACTIVE' })
            .select(USER_FIELDS)
            .sort({ name: 1 });

        // 3. Fetch memberships
        const memberships = await ProjectMember.find({ projectId: { $in: projectIds } });
        const membershipsByUser = new Map();
        for (const m of memberships) {
            const uid = String(m.userId);
            if (!membershipsByUser.has(uid)) membershipsByUser.set(uid, []);
            membershipsByUser.get(uid).push(m);
        }

        // 4. Fetch tasks matching period & projects
        const taskQuery = { projectId: { $in: projectIds } };
        if (startDate && endDate) {
            taskQuery.$or = [
                { dueDate: { $gte: startDate, $lte: endDate } },
                { completedAt: { $gte: startDate, $lte: endDate } },
                { createdAt: { $gte: startDate, $lte: endDate } }
            ];
        }
        const tasks = await ProjectTask.find(taskQuery);

        const tasksByUser = new Map();
        for (const t of tasks) {
            const uid = String(t.assignedTo);
            if (!tasksByUser.has(uid)) tasksByUser.set(uid, []);
            tasksByUser.get(uid).push(t);
        }

        // 5. Build Member Performance Scorecard
        const performanceScorecard = [];
        let totalScoreSum = 0;
        let evaluatedCount = 0;

        for (const u of users) {
            const uid = String(u._id);
            const userMemberships = membershipsByUser.get(uid) || [];
            const userTasks = tasksByUser.get(uid) || [];

            // Find projects this user leads as chairperson
            const ledProjects = allProjects.filter(p => p.chairpersonId && String(p.chairpersonId._id) === uid);
            const userProjectIds = new Set([
                ...userMemberships.map(m => String(m.projectId)),
                ...ledProjects.map(p => String(p._id))
            ]);

            const userProjects = allProjects.filter(p => userProjectIds.has(String(p._id)));
            const projectNames = userProjects.map(p => p.PName);

            const totalTasks = userTasks.length;
            const tasksDone = userTasks.filter(t => t.status === 'COMPLETED').length;

            // Tasks completed before or on deadline
            const completedOnTime = userTasks.filter(t => {
                if (t.status !== 'COMPLETED') return false;
                if (!t.completedAt || !t.dueDate) return true;
                return new Date(t.completedAt).getTime() <= new Date(t.dueDate).getTime();
            }).length;

            const completedLate = Math.max(0, tasksDone - completedOnTime);
            const overdueTasks = userTasks.filter(t => {
                if (t.status === 'COMPLETED' || !t.dueDate) return false;
                return new Date(t.dueDate).getTime() < Date.now();
            }).length;

            // Performance Score calculation logic
            let score = 100;
            if (totalTasks > 0) {
                // On-time tasks get 100% weight, late tasks get 60% weight
                score = Math.round(((completedOnTime * 1.0 + completedLate * 0.6) / totalTasks) * 100);
            } else if (ledProjects.length > 0) {
                // For chairpersons without direct task assignments, score reflects led projects' average progress
                const avgProg = ledProjects.reduce((acc, p) => acc + (statsByProject[p._id]?.progress || 0), 0) / ledProjects.length;
                score = Math.max(70, Math.round(avgProg));
            }

            score = Math.min(100, Math.max(0, score));
            totalScoreSum += score;
            evaluatedCount++;

            let status = 'Good';
            if (score >= 90) status = 'Excellent';
            else if (score < 75) status = 'Needs Attention';

            let roleDisplay = 'Member';
            if (u.userRole === 'ADMIN') roleDisplay = 'Administrator';
            else if (ledProjects.length > 0 || u.userRole === 'CHAIRPERSON') roleDisplay = 'Chairperson';
            else if (userMemberships.some(m => m.role === 'COMMITTEE_LEAD')) roleDisplay = 'Committee Lead';

            performanceScorecard.push({
                id: u._id,
                member: u.name,
                role: roleDisplay,
                faculty: u.faculty || '',
                batch: u.batch || '',
                project: projectNames.length > 0 ? projectNames.join(', ') : 'Unassigned',
                projectCount: projectNames.length,
                score,
                status,
                tasksDone,
                totalTasks,
                completedOnTime,
                completedLate,
                overdueTasks,
                date: new Date().toISOString().split('T')[0]
            });
        }

        // 6. Project Summaries
        const projectSummaries = allProjects.map(p => {
            const s = statsByProject[p._id] || {
                memberCount: 0, committeeCount: 0, totalTasks: 0,
                completedTasks: 0, pendingTasks: 0, progress: 0
            };

            let budgetHealth = 'On Track';
            if (p.status === 'COMPLETED' || s.progress === 100) budgetHealth = 'Completed';
            else if (s.progress >= 75) budgetHealth = 'Optimal';
            else if (s.pendingTasks > 10 && s.progress < 40) budgetHealth = 'Needs Attention';

            return {
                id: p._id,
                name: p.PName,
                lead: p.chairpersonId?.name || p.chairPerson || 'Unassigned',
                progress: s.progress,
                members: s.memberCount,
                committees: s.committeeCount,
                tasksDone: s.completedTasks,
                totalTasks: s.totalTasks,
                status: p.status === 'UPCOMING' ? 'Upcoming' : p.status === 'COMPLETED' ? 'Completed' : 'Active',
                budgetHealth,
                startDate: p.StartDate,
                endDate: p.EndDate
            };
        });

        // 7. KPI Metrics calculation
        const avgPerformance = evaluatedCount > 0 ? (totalScoreSum / evaluatedCount).toFixed(1) : '100.0';
        const activeMembersCount = users.length;
        const healthyProjectsCount = projectSummaries.filter(p => p.status === 'Completed' || p.budgetHealth === 'Optimal' || p.budgetHealth === 'On Track').length;
        const projectHealthRate = projectSummaries.length > 0 ? Math.round((healthyProjectsCount / projectSummaries.length) * 100) : 100;

        const totalTasksInScope = tasks.length;
        const totalDoneTasksInScope = tasks.filter(t => t.status === 'COMPLETED').length;
        const taskVelocity = totalTasksInScope > 0 ? Math.round((totalDoneTasksInScope / totalTasksInScope) * 100) : 100;

        // 8. Feedback and Complaints lists
        const [feedbackList, complaintList] = await Promise.all([
            Feedback.find().sort({ createdAt: -1 }).limit(30),
            Complaint.find().sort({ createdAt: -1 }).limit(30)
        ]);

        const formattedFeedback = feedbackList.map(f => ({
            id: f._id,
            author: f.author,
            role: f.role,
            type: f.type,
            message: f.message,
            rating: f.rating,
            date: f.createdAt ? f.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

        const formattedComplaints = complaintList.map(c => ({
            id: c._id,
            from: c.from,
            category: c.category,
            title: c.title,
            description: c.description,
            priority: c.priority,
            status: c.status,
            date: c.createdAt ? c.createdAt.toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
        }));

        res.status(200).send({
            message: 'Reports analytics fetched',
            data: {
                period,
                kpi: {
                    avgPerformance,
                    activeMembers: activeMembersCount,
                    projectHealth: projectHealthRate,
                    taskVelocity,
                    totalTasks: totalTasksInScope,
                    completedTasks: totalDoneTasksInScope,
                    totalProjects: projectSummaries.length
                },
                performance: performanceScorecard,
                projects: projectSummaries,
                feedback: formattedFeedback,
                complaints: formattedComplaints
            }
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not generate reports', error: e.message });
    }
};

/**
 * POST /api/pm/reports/feedback
 * Submit user feedback
 */
exports.submitFeedback = async (req, res) => {
    try {
        const { author, type, message, rating } = req.body;
        if (!message || !String(message).trim()) {
            return res.status(400).send({ message: 'Feedback message is required' });
        }

        const fb = await Feedback.create({
            userId: req.auth.id,
            author: author && String(author).trim() ? String(author).trim() : 'Anonymous Member',
            role: req.auth.role || 'Member',
            type: type || 'Suggestion',
            message: String(message).trim(),
            rating: Math.min(5, Math.max(1, Number(rating) || 5))
        });

        res.status(201).send({ message: 'Feedback submitted successfully', data: fb });
    } catch (e) {
        res.status(500).send({ message: 'Could not submit feedback', error: e.message });
    }
};

/**
 * POST /api/pm/reports/complaint
 * Submit an issue/ticket
 */
exports.submitComplaint = async (req, res) => {
    try {
        const { from, category, title, description, priority } = req.body;
        if (!title || !description) {
            return res.status(400).send({ message: 'Title and description are required' });
        }

        const cp = await Complaint.create({
            userId: req.auth.id,
            from: from && String(from).trim() ? String(from).trim() : 'Anonymous Member',
            category: category || 'Technical Issue',
            title: String(title).trim(),
            description: String(description).trim(),
            priority: priority || 'Medium',
            status: 'Open'
        });

        res.status(201).send({ message: 'Issue ticket submitted successfully', data: cp });
    } catch (e) {
        res.status(500).send({ message: 'Could not submit complaint', error: e.message });
    }
};

