const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

const PROJECT_STATUS = ['UPCOMING', 'ACTIVE', 'COMPLETED'];

const projectSchema = new mongoose.Schema({
    PName: { type: String, required: true, trim: true },

    // Which society owns the project. Stored as a name because there is no
    // Society collection yet; swap for a societyId ref when one exists.
    societyName: { type: String, trim: true, default: '' },

    description: { type: String, default: '' },

    status: { type: String, enum: PROJECT_STATUS, uppercase: true, default: 'UPCOMING' },

    // The canonical owner. `chairPerson` below is the legacy free-text name,
    // kept so the older admin project screens keep rendering.
    chairpersonId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser' },
    chairPerson: { type: String, trim: true, default: '' },

    StartDate: { type: Date },
    EndDate: { type: Date },
}, { timestamps: true });

projectSchema.index({ chairpersonId: 1 });
projectSchema.index({ status: 1 });

const Project = db.model('Project', projectSchema);
Project.PROJECT_STATUS = PROJECT_STATUS;
module.exports = Project;
