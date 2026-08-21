const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

/**
 * Who belongs to which project, and in what capacity.
 *
 * This supersedes the older MemberProject model, which put `unique: true` on
 * BOTH PName and indexNo — that made a project hold exactly one member and a
 * user join exactly one project ever. Here the uniqueness is COMPOUND, so a
 * user appears at most once per project but may join any number of projects.
 *
 * This collection is the single source of truth for membership. Committee
 * documents carry the committee's own details; who is in it is answered by
 * querying ProjectMember on committeeId.
 */
const PROJECT_ROLES = ['CHAIRPERSON', 'COMMITTEE_LEAD', 'MEMBER'];

const projectMemberSchema = new mongoose.Schema({
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', required: true },

    role: { type: String, enum: PROJECT_ROLES, uppercase: true, default: 'MEMBER' },

    // Null for the chairperson and for members not yet placed on a committee.
    committeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee', default: null },

    // Free-text label shown on member cards, e.g. "Design Lead", "Treasurer".
    position: { type: String, trim: true, default: '' },
}, { timestamps: true });

// One membership row per user per project.
projectMemberSchema.index({ projectId: 1, userId: 1 }, { unique: true });

// The two hot read paths: "who is on this committee" and "what am I part of".
projectMemberSchema.index({ committeeId: 1 });
projectMemberSchema.index({ userId: 1 });

const ProjectMember = db.model('ProjectMember', projectMemberSchema);
ProjectMember.PROJECT_ROLES = PROJECT_ROLES;
module.exports = ProjectMember;
