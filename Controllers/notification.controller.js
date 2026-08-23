const Notification = require('../Models/notification.model');
const ProjectTask = require('../Models/projectTask.model');

// A task inside this window shows up as a "due soon" reminder.
const DEADLINE_SOON_HOURS = 48;

/**
 * GET /api/notifications
 * Merges persisted events (assigned/completed/added-to-project/committee)
 * with deadline reminders derived live from the caller's open tasks. The
 * deadline half is never stored — it's recomputed on every call, the same
 * way ProjectTask itself derives "overdue" from dueDate on read instead of
 * through a scheduled job (see ProjectTask.isOverdue).
 */
exports.getMyNotifications = async (req, res) => {
    try {
        const userId = req.auth.id;

        const [events, myTasks] = await Promise.all([
            Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('actor', 'name'),
            ProjectTask.find({ assignedTo: userId, status: { $ne: 'COMPLETED' } })
                .populate('projectId', 'PName'),
        ]);

        const now = Date.now();
        const soonCutoff = now + DEADLINE_SOON_HOURS * 60 * 60 * 1000;
        const deadlines = [];

        for (const t of myTasks) {
            const due = t.dueDate ? t.dueDate.getTime() : null;
            if (!due) continue;

            const projectName = t.projectId?.PName || '';
            const projectIdStr = t.projectId?._id || t.projectId;

            if (due < now) {
                deadlines.push({
                    id: `deadline-overdue-${t._id}`,
                    type: 'DEADLINE_OVERDUE',
                    message: `"${t.title}" is overdue${projectName ? ` (${projectName})` : ''}`,
                    link: projectIdStr ? `/projects/${projectIdStr}` : '',
                    createdAt: t.dueDate,
                    isRead: false,
                });
            } else if (due <= soonCutoff) {
                deadlines.push({
                    id: `deadline-soon-${t._id}`,
                    type: 'DEADLINE_NEAR',
                    message: `"${t.title}" is due soon${projectName ? ` (${projectName})` : ''}`,
                    link: projectIdStr ? `/projects/${projectIdStr}` : '',
                    createdAt: t.dueDate,
                    isRead: false,
                });
            }
        }

        const persisted = events.map(n => ({
            id: String(n._id),
            type: n.type,
            message: n.message,
            link: n.link || '',
            createdAt: n.createdAt,
            isRead: n.isRead,
            actor: n.actor ? { name: n.actor.name } : null,
        }));

        const items = [...persisted, ...deadlines].sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        );

        const unreadCount = persisted.filter(n => !n.isRead).length + deadlines.length;

        res.status(200).send({ message: 'Notifications fetched', data: { items, unreadCount } });
    } catch (e) {
        res.status(500).send({ message: 'Could not load notifications', error: e.message });
    }
};

/** PATCH /api/notifications/:id/read */
exports.markRead = async (req, res) => {
    try {
        const { id } = req.params;
        // Deadline reminders are derived, not stored — they clear themselves
        // once the task is completed or the due date is edited.
        if (id.startsWith('deadline-')) {
            return res.status(200).send({ message: 'Deadline reminders clear on their own' });
        }

        const notification = await Notification.findOneAndUpdate(
            { _id: id, recipient: req.auth.id },
            { $set: { isRead: true, readAt: new Date() } },
            { new: true }
        );
        if (!notification) return res.status(404).send({ message: 'Notification not found' });

        res.status(200).send({ message: 'Marked as read', data: notification });
    } catch (e) {
        res.status(500).send({ message: 'Could not update notification', error: e.message });
    }
};

/** PATCH /api/notifications/read-all */
exports.markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipient: req.auth.id, isRead: false },
            { $set: { isRead: true, readAt: new Date() } }
        );
        res.status(200).send({ message: 'All notifications marked as read' });
    } catch (e) {
        res.status(500).send({ message: 'Could not update notifications', error: e.message });
    }
};
