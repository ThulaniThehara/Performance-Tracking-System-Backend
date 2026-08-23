const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

/**
 * In-app notifications for events a user didn't cause themselves: being
 * assigned a task, being added to a project/committee, or someone finishing
 * a task they created. Deadline reminders are NOT stored here — like
 * ProjectTask.isOverdue, they're derived live from dueDate on every read
 * (see notification.controller.js) so there's no scheduled job to keep in
 * sync and no risk of a stale reminder for a task whose deadline changed.
 */
const NOTIFICATION_TYPES = [
    'TASK_ASSIGNED',
    'TASK_COMPLETED',
    'PROJECT_MEMBER_ADDED',
    'COMMITTEE_MEMBER_ADDED',
];

const notificationSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', default: null },

    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    message: { type: String, required: true, trim: true },

    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    committeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee', default: null },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask', default: null },

    // Frontend route to send the user to when they click the notification.
    link: { type: String, default: '' },

    isRead: { type: Boolean, default: false },
    readAt: { type: Date, default: null },
}, { timestamps: true });

// The one hot read path: "my recent notifications, newest first".
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = db.model('Notification', notificationSchema);
Notification.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports = Notification;
