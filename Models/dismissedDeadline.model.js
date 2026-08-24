const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

/**
 * Marks that a user has already seen a particular deadline reminder ("soon"
 * or "overdue") for a particular task. The reminder itself is never stored
 * (see notification.controller.js) — it's recomputed from ProjectTask on
 * every read — so without this, there is nowhere to record "the user already
 * dismissed this" and the same reminder would keep coming back unread on
 * every poll. Keyed on (recipient, taskId, kind) so dismissing the "soon"
 * reminder doesn't suppress the later "overdue" one for the same task — that
 * is a genuinely new thing to notify about.
 */
const dismissedDeadlineSchema = new mongoose.Schema({
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },
    taskId: { type: mongoose.Schema.Types.ObjectId, ref: 'ProjectTask', required: true },
    kind: { type: String, enum: ['soon', 'overdue'], required: true },
}, { timestamps: true });

dismissedDeadlineSchema.index({ recipient: 1, taskId: 1, kind: 1 }, { unique: true });

const DismissedDeadline = db.model('DismissedDeadline', dismissedDeadlineSchema);
module.exports = DismissedDeadline;
