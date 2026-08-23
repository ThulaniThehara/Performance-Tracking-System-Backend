const Notification = require('../Models/notification.model');

/**
 * Fire-and-forget notification creation, called from whichever controller
 * just assigned a task / added a member / etc. Errors are swallowed and
 * logged rather than thrown, so a notification failure never breaks the
 * action that triggered it.
 */
async function notify({ recipient, actor, type, message, projectId, committeeId, taskId, link }) {
    if (!recipient) return;
    // Don't notify people about their own actions (e.g. a chair assigning a task to themselves).
    if (actor && String(actor) === String(recipient)) return;

    try {
        await Notification.create({
            recipient, actor: actor || null, type, message,
            projectId: projectId || null,
            committeeId: committeeId || null,
            taskId: taskId || null,
            link: link || '',
        });
    } catch (e) {
        console.error('Could not create notification:', e.message);
    }
}

module.exports = { notify };
