const Notification = require('../Models/notification.model');
const ProjectTask = require('../Models/projectTask.model');
const DismissedDeadline = require('../Models/dismissedDeadline.model');

// A task inside this window shows up as a "due soon" reminder.
const DEADLINE_SOON_HOURS = 48;

/**
 * Deadline reminders derived live from the caller's open tasks, minus
 * whichever ones they've already dismissed (see DismissedDeadline). The
 * reminder itself is never stored — it's recomputed from ProjectTask on
 * every call, the same way ProjectTask itself derives "overdue" from
 * dueDate on read instead of through a scheduled job (see
 * ProjectTask.isOverdue) — but dismissal state has to be stored somewhere,
 * or a reminder the user already saw would come back unread on every poll.
 */
async function computeDeadlineItems(userId) {
    const [myTasks, dismissed] = await Promise.all([
        ProjectTask.find({ assignedTo: userId, status: { $ne: 'COMPLETED' } })
            .populate('projectId', 'PName'),
        DismissedDeadline.find({ recipient: userId }),
    ]);

    const dismissedSet = new Set(dismissed.map(d => `${d.taskId}-${d.kind}`));

    const now = Date.now();
    const soonCutoff = now + DEADLINE_SOON_HOURS * 60 * 60 * 1000;
    const items = [];

    for (const t of myTasks) {
        const due = t.dueDate ? t.dueDate.getTime() : null;
        if (!due) continue;

        const kind = due < now ? 'overdue' : (due <= soonCutoff ? 'soon' : null);
        if (!kind || dismissedSet.has(`${t._id}-${kind}`)) continue;

        const projectName = t.projectId?.PName || '';
        const projectIdStr = t.projectId?._id || t.projectId;

        items.push({
            id: `deadline-${kind}-${t._id}`,
            taskId: String(t._id),
            kind,
            type: kind === 'overdue' ? 'DEADLINE_OVERDUE' : 'DEADLINE_NEAR',
            message: kind === 'overdue'
                ? `"${t.title}" is overdue${projectName ? ` (${projectName})` : ''}`
                : `"${t.title}" is due soon${projectName ? ` (${projectName})` : ''}`,
            link: projectIdStr ? `/projects/${projectIdStr}` : '',
            createdAt: t.dueDate,
            isRead: false,
        });
    }

    return items;
}

/** Parses `deadline-<soon|overdue>-<taskId>` back into its parts, or null if it isn't one. */
function parseDeadlineId(id) {
    const m = /^deadline-(soon|overdue)-([0-9a-fA-F]{24})$/.exec(id);
    return m ? { kind: m[1], taskId: m[2] } : null;
}

/**
 * GET /api/notifications
 * Merges persisted events (assigned/completed/added-to-project/committee)
 * with the derived deadline reminders above.
 */
exports.getMyNotifications = async (req, res) => {
    try {
        const userId = req.auth.id;

        const [events, deadlines] = await Promise.all([
            Notification.find({ recipient: userId })
                .sort({ createdAt: -1 })
                .limit(50)
                .populate('actor', 'name'),
            computeDeadlineItems(userId),
        ]);

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

        const deadline = parseDeadlineId(id);
        if (deadline) {
            await DismissedDeadline.updateOne(
                { recipient: req.auth.id, taskId: deadline.taskId, kind: deadline.kind },
                { $setOnInsert: { recipient: req.auth.id, taskId: deadline.taskId, kind: deadline.kind } },
                { upsert: true }
            );
            return res.status(200).send({ message: 'Reminder dismissed' });
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
        const userId = req.auth.id;

        const deadlines = await computeDeadlineItems(userId);

        await Promise.all([
            Notification.updateMany(
                { recipient: userId, isRead: false },
                { $set: { isRead: true, readAt: new Date() } }
            ),
            ...deadlines.map(d => DismissedDeadline.updateOne(
                { recipient: userId, taskId: d.taskId, kind: d.kind },
                { $setOnInsert: { recipient: userId, taskId: d.taskId, kind: d.kind } },
                { upsert: true }
            )),
        ]);

        res.status(200).send({ message: 'All notifications marked as read' });
    } catch (e) {
        res.status(500).send({ message: 'Could not update notifications', error: e.message });
    }
};
