const Project = require('../Models/project.model');
const ProjectMember = require('../Models/projectMember.model');

/**
 * Turns a project role into a capability set.
 *
 * Everything the UI hides must also be denied here — the frontend only decides
 * what to *draw*, this decides what is actually allowed. A global ADMIN is
 * treated as a chairperson so system administrators are never locked out of a
 * project they do not personally belong to.
 */
const permissionsFor = (projectRole, globalRole) => {
    const isChair = projectRole === 'CHAIRPERSON' || globalRole === 'ADMIN';
    const isLead = projectRole === 'COMMITTEE_LEAD';

    return {
        isChairperson: isChair,
        isCommitteeLead: isLead,

        canEditProject: isChair,
        canDeleteProject: isChair,          // leads explicitly cannot
        canManageCommittees: isChair,
        canManageMembers: isChair,

        // Feedback/complaints submitted by one member about another must stay
        // private to that pair plus oversight — only the project's chairperson
        // (or a global admin) may read the project's full submissions list.
        canViewSubmissions: isChair,

        canCreateTasks: isChair,
        canDeleteTasks: isChair,

        // Chair may retarget any task; a lead may move tasks inside their own
        // committee; everyone else may only touch a task assigned to them,
        // which is checked per-task rather than here.
        canUpdateAnyTaskStatus: isChair,
        canUpdateCommitteeTaskStatus: isChair || isLead,
    };
};

/**
 * Resolves :projectId, confirms the caller belongs to that project, and hangs
 * the project, the caller's membership and their permissions off the request.
 *
 * Non-members get 404 rather than 403 so this endpoint cannot be used to probe
 * which project IDs exist.
 */
exports.loadProjectAccess = async (req, res, next) => {
    try {
        const project = await Project.findById(req.params.projectId)
            .populate('chairpersonId', 'name email indexNo userRole faculty batch contactNO');

        if (!project) return res.status(404).send({ message: 'Project not found' });

        const membership = await ProjectMember.findOne({
            projectId: project._id,
            userId: req.auth.id,
        });

        // Determine if the caller is the assigned chairperson of this project
        const isChairpersonUser = project.chairpersonId && String(project.chairpersonId._id || project.chairpersonId) === String(req.auth.id);

        if (!membership && !isChairpersonUser && req.auth.role !== 'ADMIN') {
            return res.status(404).send({ message: 'Project not found' });
        }

        const effectiveRole = isChairpersonUser ? 'CHAIRPERSON' : (membership?.role || 'MEMBER');

        req.project = project;
        req.membership = membership;
        req.perms = permissionsFor(effectiveRole, req.auth.role);
        next();
    } catch (e) {
        if (e.name === 'CastError') {
            return res.status(400).send({ message: 'Invalid project id' });
        }
        res.status(500).send({ message: 'Could not load project', error: e.message });
    }
};

/** Usage: requirePerm('canManageCommittees') — must follow loadProjectAccess. */
exports.requirePerm = (permission) => (req, res, next) => {
    if (!req.perms) {
        return res.status(500).send({ message: 'requirePerm used without loadProjectAccess' });
    }
    if (!req.perms[permission]) {
        return res.status(403).send({
            message: 'You do not have permission to perform this action on this project'
        });
    }
    next();
};

exports.permissionsFor = permissionsFor;
