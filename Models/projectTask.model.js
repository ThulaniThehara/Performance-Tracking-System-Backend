const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

/**
 * Tasks belonging to a society project.
 *
 * Kept separate from the legacy Task model, which stores project/committee/
 * assignee as plain strings and is still used by the older Chair screens.
 * This one uses real ObjectId references so a task can be populated and
 * permission-checked without string matching.
 */
const TASK_PRIORITY = ['LOW', 'MEDIUM', 'HIGH'];

// OVERDUE is deliberately NOT a stored status. A stored value would need a
// scheduled job to stay truthful; instead it is derived from dueDate on read
// (see the isOverdue virtual and toClientJSON below).
const TASK_STATUS = ['TODO', 'IN_PROGRESS', 'COMPLETED'];

const projectTaskSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    committeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee', default: null },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },

    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },

    priority: { type: String, enum: TASK_PRIORITY, uppercase: true, default: 'MEDIUM' },
    status: { type: String, enum: TASK_STATUS, uppercase: true, default: 'TODO' },

    dueDate: { type: Date, required: true },
    // Stored as "HH:mm" rather than folded into dueDate, so a task can be
    // "due Friday" with no particular time without implying midnight.
    dueTime: { type: String, trim: true, default: '' },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser' },
    completedAt: { type: Date, default: null },
}, { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } });

projectTaskSchema.index({ projectId: 1 });
projectTaskSchema.index({ assignedTo: 1, dueDate: 1 });
projectTaskSchema.index({ committeeId: 1 });

/** Past its due date and not finished. */
projectTaskSchema.virtual('isOverdue').get(function () {
    if (this.status === 'COMPLETED' || !this.dueDate) return false;
    return this.dueDate.getTime() < Date.now();
});

/**
 * The shape the UI consumes. `displayStatus` folds the derived OVERDUE state
 * into the status field so badges have a single value to switch on, while
 * `status` keeps the real stored value that writes go back to.
 */
projectTaskSchema.methods.toClientJSON = function () {
    const o = this.toObject({ virtuals: true });
    o.displayStatus = o.isOverdue ? 'OVERDUE' : o.status;
    return o;
};

/** Keeps completedAt in step with status on every save path. */
projectTaskSchema.pre('save', function (next) {
    if (this.isModified('status')) {
        if (this.status === 'COMPLETED' && !this.completedAt) {
            this.completedAt = new Date();
        } else if (this.status !== 'COMPLETED') {
            this.completedAt = null;
        }
    }
    next();
});

const ProjectTask = db.model('ProjectTask', projectTaskSchema);
ProjectTask.TASK_PRIORITY = TASK_PRIORITY;
ProjectTask.TASK_STATUS = TASK_STATUS;
module.exports = ProjectTask;
