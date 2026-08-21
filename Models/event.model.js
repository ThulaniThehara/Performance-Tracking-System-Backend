const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

// Society-wide calendar entries the admin creates by hand: special tasks,
// events, meetings and deadlines. Kept separate from Task, which is always
// tied to a project/committee and assigned to specific members.
const EVENT_TYPES = ['EVENT', 'SPECIAL_TASK', 'MEETING', 'DEADLINE'];

const eventSchema = new mongoose.Schema({
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    type: { type: String, enum: EVENT_TYPES, uppercase: true, default: 'EVENT' },

    // Single-day entries just leave endDate empty.
    startDate: { type: Date, required: true },
    endDate: { type: Date },

    location: { type: String, trim: true, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser' },
}, { timestamps: true });

// The calendar always queries by date range, so index it.
eventSchema.index({ startDate: 1 });

const Event = db.model('Event', eventSchema);
Event.EVENT_TYPES = EVENT_TYPES;
module.exports = Event;
