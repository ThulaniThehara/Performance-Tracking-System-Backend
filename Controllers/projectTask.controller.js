const ProjectTask = require('../Models/projectTask.model');
const ProjectMember = require('../Models/projectMember.model');
const Committee = require('../Models/Committee.model');

const USER_FIELDS = 'name email indexNo userRole';

/**
 * May the caller change this task's status?
 *
 * Chairperson : any task on the project.
 * Lead        : any task inside the committee they lead.
 * Member      : only a task assigned to them.
 */
function canEditStatus(task, req) {
    if (req.perms.canUpdateAnyTaskStatus) return true;
    if (String(task.assignedTo?._id || task.assignedTo) === String(req.auth.id)) return true;

    if (req.perms.isCommitteeLead && task.committeeId && req.membership?.committeeId) {
        return String(task.committeeId) === String(req.membership.committeeId);
    }
    return false;
}

/** GET /api/pm/projects/:projectId/tasks */
exports.listProjectTasks = async (req, res) => {
    try {
        const filter = { projectId: req.project._id };
        if (req.query.committeeId) filter.committeeId = req.query.committeeId;
        if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

        const tasks = await ProjectTask.find(filter)
            .populate('assignedTo', USER_FIELDS)
            .sort({ dueDate: 1 });

        res.status(200).send({
            message: 'Tasks fetched',
            data: tasks.map(t => t.toClientJSON()),
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not load tasks', error: e.message });
    }
};

/** POST /api/pm/projects/:projectId/tasks   (chairperson) */
exports.createTask = async (req, res) => {
    try {
        const b = req.body || {};

        const title = String(b.title || '').trim();
        if (!title) return res.status(400).send({ message: 'Task title is required' });
        if (!b.assignedTo) return res.status(400).send({ message: 'Please assign the task to someone' });
        if (!b.dueDate) return res.status(400).send({ message: 'A due date is required' });

        const dueDate = new Date(b.dueDate);
        if (Number.isNaN(dueDate.getTime())) {
            return res.status(400).send({ message: 'Due date is not a valid date' });
        }

        // The assignee must actually be on this project.
        const membership = await ProjectMember.findOne({
            projectId: req.project._id,
            userId: b.assignedTo,
        });
        if (!membership) {
            return res.status(400).send({ message: 'That person is not a member of this project' });
        }

        if (b.committeeId) {
            const committee = await Committee.findOne({
                _id: b.committeeId, ProjectId: req.project._id,
            });
            if (!committee) {
                return res.status(400).send({ message: 'Committee not found on this project' });
            }
        }

        const priority = String(b.priority || 'MEDIUM').toUpperCase();
        if (!ProjectTask.TASK_PRIORITY.includes(priority)) {
            return res.status(400).send({
                message: `priority must be one of: ${ProjectTask.TASK_PRIORITY.join(', ')}`
            });
        }

        const status = String(b.status || 'TODO').toUpperCase();
        if (!ProjectTask.TASK_STATUS.includes(status)) {
            return res.status(400).send({
                message: `status must be one of: ${ProjectTask.TASK_STATUS.join(', ')}`
            });
        }

        const task = new ProjectTask({
            projectId: req.project._id,
            committeeId: b.committeeId || membership.committeeId || null,
            assignedTo: b.assignedTo,
            title,
            description: String(b.description || '').trim(),
            priority,
            status,
            dueDate,
            dueTime: String(b.dueTime || '').trim(),
            createdBy: req.auth.id,
        });
        await task.save();
        await task.populate('assignedTo', USER_FIELDS);

        res.status(201).send({ message: 'Task created', data: task.toClientJSON() });
    } catch (e) {
        if (e.name === 'ValidationError') return res.status(400).send({ message: e.message });
        res.status(500).send({ message: 'Could not create the task', error: e.message });
    }
};

/**
 * PATCH /api/pm/projects/:projectId/tasks/:taskId
 * Status is open to whoever passes canEditStatus; every other field is
 * chairperson-only, so a member cannot rewrite their own deadline.
 */
exports.updateTask = async (req, res) => {
    try {
        const task = await ProjectTask.findOne({
            _id: req.params.taskId,
            projectId: req.project._id,
        });
        if (!task) return res.status(404).send({ message: 'Task not found' });

        const b = req.body || {};
        const wantsStatusOnly = Object.keys(b).every(k => k === 'status');

        if (b.status !== undefined) {
            if (!canEditStatus(task, req)) {
                return res.status(403).send({
                    message: 'You can only update tasks assigned to you'
                });
            }
            const s = String(b.status).toUpperCase();
            if (!ProjectTask.TASK_STATUS.includes(s)) {
                return res.status(400).send({
                    message: `status must be one of: ${ProjectTask.TASK_STATUS.join(', ')}`
                });
            }
            task.status = s; // pre-save hook maintains completedAt
        }

        if (!wantsStatusOnly) {
            if (!req.perms.canCreateTasks) {
                return res.status(403).send({
                    message: 'Only the chairperson can change task details'
                });
            }

            if (b.title !== undefined) {
                const t = String(b.title).trim();
                if (!t) return res.status(400).send({ message: 'Task title cannot be empty' });
                task.title = t;
            }
            if (b.description !== undefined) task.description = String(b.description).trim();
            if (b.dueTime !== undefined) task.dueTime = String(b.dueTime).trim();

            if (b.dueDate !== undefined) {
                const d = new Date(b.dueDate);
                if (Number.isNaN(d.getTime())) {
                    return res.status(400).send({ message: 'Due date is not a valid date' });
                }
                task.dueDate = d;
            }

            if (b.priority !== undefined) {
                const p = String(b.priority).toUpperCase();
                if (!ProjectTask.TASK_PRIORITY.includes(p)) {
                    return res.status(400).send({
                        message: `priority must be one of: ${ProjectTask.TASK_PRIORITY.join(', ')}`
                    });
                }
                task.priority = p;
            }

            if (b.assignedTo !== undefined) {
                const membership = await ProjectMember.findOne({
                    projectId: req.project._id, userId: b.assignedTo,
                });
                if (!membership) {
                    return res.status(400).send({ message: 'That person is not a member of this project' });
                }
                task.assignedTo = b.assignedTo;
            }

            if (b.committeeId !== undefined) {
                if (b.committeeId) {
                    const committee = await Committee.findOne({
                        _id: b.committeeId, ProjectId: req.project._id,
                    });
                    if (!committee) {
                        return res.status(400).send({ message: 'Committee not found on this project' });
                    }
                }
                task.committeeId = b.committeeId || null;
            }
        }

        await task.save();
        await task.populate('assignedTo', USER_FIELDS);

        res.status(200).send({ message: 'Task updated', data: task.toClientJSON() });
    } catch (e) {
        if (e.name === 'ValidationError') return res.status(400).send({ message: e.message });
        res.status(500).send({ message: 'Could not update the task', error: e.message });
    }
};

/** DELETE /api/pm/projects/:projectId/tasks/:taskId   (chairperson) */
exports.deleteTask = async (req, res) => {
    try {
        const task = await ProjectTask.findOneAndDelete({
            _id: req.params.taskId,
            projectId: req.project._id,
        });
        if (!task) return res.status(404).send({ message: 'Task not found' });
        res.status(200).send({ message: 'Task removed', data: task });
    } catch (e) {
        res.status(500).send({ message: 'Could not remove the task', error: e.message });
    }
};

/**
 * GET /api/pm/my-tasks
 * Powers the dashboard widget. Buckets by deadline rather than making the
 * client re-derive them, and sorts by nearest deadline throughout.
 */
exports.getMyTasks = async (req, res) => {
    try {
        const tasks = await ProjectTask.find({ assignedTo: req.auth.id })
            .sort({ dueDate: 1 })
            .populate('projectId', 'PName societyName')
            .populate('committeeId', 'CName');

        const now = new Date();
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);
        const startOfTomorrow = new Date(startOfToday); startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

        const buckets = { today: [], upcoming: [], overdue: [], completed: [] };

        for (const t of tasks) {
            const card = {
                ...t.toClientJSON(),
                projectName: t.projectId?.PName || '',
                societyName: t.projectId?.societyName || '',
                committeeName: t.committeeId?.CName || '',
            };

            if (t.status === 'COMPLETED') buckets.completed.push(card);
            else if (t.dueDate < startOfToday) buckets.overdue.push(card);
            else if (t.dueDate < startOfTomorrow) buckets.today.push(card);
            else buckets.upcoming.push(card);
        }

        res.status(200).send({
            message: 'Tasks fetched',
            data: {
                ...buckets,
                counts: {
                    today: buckets.today.length,
                    upcoming: buckets.upcoming.length,
                    overdue: buckets.overdue.length,
                    completed: buckets.completed.length,
                },
            },
        });
    } catch (e) {
        res.status(500).send({ message: 'Could not load your tasks', error: e.message });
    }
};

/**
 * PATCH /api/pm/my-tasks/:taskId/status
 * The member-facing shortcut: no project id in the path, and it only ever
 * touches a task the caller is personally assigned.
 */
exports.updateMyTaskStatus = async (req, res) => {
    try {
        const status = String(req.body?.status || '').toUpperCase();
        if (!ProjectTask.TASK_STATUS.includes(status)) {
            return res.status(400).send({
                message: `status must be one of: ${ProjectTask.TASK_STATUS.join(', ')}`
            });
        }

        const task = await ProjectTask.findOne({
            _id: req.params.taskId,
            assignedTo: req.auth.id,
        });
        if (!task) return res.status(404).send({ message: 'Task not found' });

        task.status = status;
        await task.save();

        res.status(200).send({ message: 'Task updated', data: task.toClientJSON() });
    } catch (e) {
        res.status(500).send({ message: 'Could not update the task', error: e.message });
    }
};
