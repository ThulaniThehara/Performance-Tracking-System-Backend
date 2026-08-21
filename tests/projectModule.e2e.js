/**
 * End-to-end check of the Projects module: chairperson flow, member flow,
 * and every permission boundary between them.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connect = require('../Config/db');

const BASE = `http://localhost:${Number(process.env.PORT) || 5000}/api/pm`;
let pass = 0, fail = 0;

const ok = (label, cond, extra = '') => {
    if (cond) { pass++; console.log(`  PASS  ${label}`); }
    else { fail++; console.log(`  FAIL  ${label} ${extra}`); }
};

const call = async (tok, method, path, body) => {
    const r = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let j = null;
    try { j = await r.json(); } catch { /* empty body */ }
    return { status: r.status, body: j };
};

(async () => {
    await connect();
    const User = require('../Models/baseUser.model');
    const Project = require('../Models/project.model');
    const Committee = require('../Models/Committee.model');
    const ProjectMember = require('../Models/projectMember.model');
    const ProjectTask = require('../Models/projectTask.model');

    const db = mongoose.connection.useDb('MPTS');
    const sign = (u) => jwt.sign(
        { id: String(u._id), role: String(u.userRole).toUpperCase() },
        process.env.JWT_SECRET, { expiresIn: '10m' }
    );

    // --- fixtures -------------------------------------------------------
    const mk = async (indexNo, name, role) =>
        (await User.findOneAndUpdate(
            { indexNo },
            { $set: { indexNo, email: `${indexNo.toLowerCase()}@test.lk`, name, userRole: role,
                      faculty: 'IT', batch: '21', contactNO: '0770000000', status: 'ACTIVE',
                      mustSetPassword: false } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        ));

    const admin  = await mk('TST-ADMIN', 'Test Admin', 'ADMIN');
    const chair  = await mk('TST-CHAIR', 'Test Chair', 'CHAIRPERSON');
    const lead   = await mk('TST-LEAD',  'Test Lead',  'MEMBER');
    const member = await mk('TST-MEM',   'Test Member','MEMBER');
    const outsider = await mk('TST-OUT', 'Test Outsider','MEMBER');

    const T = {
        admin: sign(admin), chair: sign(chair), lead: sign(lead),
        member: sign(member), outsider: sign(outsider),
    };

    // clean slate for repeat runs
    const old = await Project.find({ PName: 'PM Test Project' });
    for (const p of old) {
        await Promise.all([
            ProjectMember.deleteMany({ projectId: p._id }),
            ProjectTask.deleteMany({ projectId: p._id }),
            Committee.deleteMany({ ProjectId: p._id }),
        ]);
        await Project.deleteOne({ _id: p._id });
    }

    console.log('\n=== ADMIN CREATES PROJECT + ASSIGNS CHAIRPERSON ===');
    ok('chairperson CANNOT self-create a project (admin-only now)',
        (await call(T.chair, 'POST', '/projects', {
            title: 'Rogue Project', startDate: '2026-09-01', chairpersonId: String(chair._id),
        })).status === 403);

    const missingChair = await call(T.admin, 'POST', '/projects', {
        title: 'PM Test Project', startDate: '2026-09-01',
    });
    ok('admin creating without chairpersonId is rejected', missingChair.status === 400);

    const created = await call(T.admin, 'POST', '/projects', {
        title: 'PM Test Project', societyName: 'Rotaract', description: 'e2e',
        startDate: '2026-09-01', endDate: '2026-12-01', status: 'ACTIVE',
        chairpersonId: String(chair._id),
    });
    ok('admin creates project and assigns chairperson', created.status === 201, JSON.stringify(created.body));
    const pid = created.body?.data?._id;

    const auto = await ProjectMember.findOne({ projectId: pid, userId: chair._id });
    ok('assigned chairperson auto-enrolled as CHAIRPERSON', auto?.role === 'CHAIRPERSON');

    console.log('\n=== ADMIN "SEE ALL PROJECTS" TABLE ===');
    const adminList = await call(T.admin, 'GET', '/admin/projects');
    ok('GET /admin/projects (admin only)', adminList.status === 200);
    ok('new project appears with chairperson populated',
        adminList.body?.data?.some(p => String(p._id) === String(pid) && p.chairpersonId?.name === 'Test Chair'));
    ok('non-admin refused', (await call(T.chair, 'GET', '/admin/projects')).status === 403);

    console.log('\n=== CHAIRPERSON FLOW (in their own portal) ===');

    const com = await call(T.chair, 'POST', `/projects/${pid}/committees`, { name: 'Logistics' });
    ok('chair creates committee', com.status === 201, JSON.stringify(com.body));
    const cid = com.body?.data?._id;

    ok('duplicate committee name rejected',
        (await call(T.chair, 'POST', `/projects/${pid}/committees`, { name: 'Logistics' })).status === 409);

    ok('chair adds member',
        (await call(T.chair, 'POST', `/projects/${pid}/members`,
            { userId: String(member._id), committeeId: cid, position: 'Volunteer' })).status === 201);

    ok('chair adds lead',
        (await call(T.chair, 'POST', `/projects/${pid}/members`,
            { userId: String(lead._id), committeeId: cid })).status === 201);

    const promo = await call(T.chair, 'PATCH', `/projects/${pid}/committees/${cid}`,
        { leadId: String(lead._id) });
    ok('chair sets committee lead', promo.status === 200, JSON.stringify(promo.body));
    ok('lead promoted to COMMITTEE_LEAD',
        (await ProjectMember.findOne({ projectId: pid, userId: lead._id }))?.role === 'COMMITTEE_LEAD');

    ok('cannot add a second chairperson',
        (await call(T.chair, 'POST', `/projects/${pid}/members`,
            { userId: String(outsider._id), role: 'CHAIRPERSON' })).status === 400);

    const t1 = await call(T.chair, 'POST', `/projects/${pid}/tasks`, {
        title: 'Book the hall', assignedTo: String(member._id), committeeId: cid,
        priority: 'HIGH', dueDate: '2026-09-20', dueTime: '14:30',
    });
    ok('chair creates task', t1.status === 201, JSON.stringify(t1.body));
    const tid = t1.body?.data?._id;

    ok('cannot assign task to a non-member',
        (await call(T.chair, 'POST', `/projects/${pid}/tasks`,
            { title: 'x', assignedTo: String(outsider._id), dueDate: '2026-09-20' })).status === 400);

    // overdue is derived, never stored
    const overdue = await call(T.chair, 'POST', `/projects/${pid}/tasks`, {
        title: 'Late thing', assignedTo: String(member._id), dueDate: '2020-01-01',
    });
    ok('past-due task derives displayStatus OVERDUE',
        overdue.body?.data?.displayStatus === 'OVERDUE', overdue.body?.data?.displayStatus);

    console.log('\n=== MEMBER FLOW ===');
    const detail = await call(T.member, 'GET', `/projects/${pid}`);
    ok('member reads project detail', detail.status === 200);
    ok('member permissions all false',
        detail.body?.data?.permissions?.canEditProject === false &&
        detail.body?.data?.permissions?.canCreateTasks === false);

    ok('member updates own task status',
        (await call(T.member, 'PATCH', `/projects/${pid}/tasks/${tid}`, { status: 'COMPLETED' })).status === 200);

    const done = await ProjectTask.findById(tid);
    ok('completedAt stamped on completion', !!done.completedAt);
    ok('completed task is not overdue', done.status === 'COMPLETED');

    ok('member CANNOT change task details',
        (await call(T.member, 'PATCH', `/projects/${pid}/tasks/${tid}`, { title: 'hacked' })).status === 403);
    ok('member CANNOT create a task',
        (await call(T.member, 'POST', `/projects/${pid}/tasks`,
            { title: 'x', assignedTo: String(member._id), dueDate: '2026-09-20' })).status === 403);
    ok('member CANNOT edit the project',
        (await call(T.member, 'PATCH', `/projects/${pid}`, { title: 'hacked' })).status === 403);
    ok('member CANNOT create a committee',
        (await call(T.member, 'POST', `/projects/${pid}/committees`, { name: 'Rogue' })).status === 403);
    ok('member CANNOT add members',
        (await call(T.member, 'POST', `/projects/${pid}/members`, { userId: String(outsider._id) })).status === 403);
    ok('member CANNOT delete a task',
        (await call(T.member, 'DELETE', `/projects/${pid}/tasks/${tid}`)).status === 403);

    console.log('\n=== COMMITTEE LEAD ===');
    const t2 = await call(T.chair, 'POST', `/projects/${pid}/tasks`, {
        title: 'Lead-scope task', assignedTo: String(member._id), committeeId: cid, dueDate: '2026-10-01',
    });
    ok('lead updates status of a task in their committee',
        (await call(T.lead, 'PATCH', `/projects/${pid}/tasks/${t2.body.data._id}`,
            { status: 'IN_PROGRESS' })).status === 200);
    ok('lead CANNOT delete the project data',
        (await call(T.lead, 'PATCH', `/projects/${pid}`, { title: 'nope' })).status === 403);

    console.log('\n=== OUTSIDER ===');
    ok('non-member gets 404 (not 403 — no ID probing)',
        (await call(T.outsider, 'GET', `/projects/${pid}`)).status === 404);
    ok('unauthenticated request refused',
        (await (await fetch(`${BASE}/projects/${pid}`)).status) === 401);

    console.log('\n=== MY TASKS WIDGET ===');
    const mine = await call(T.member, 'GET', '/my-tasks');
    ok('my-tasks returns buckets', mine.status === 200 && mine.body?.data?.counts !== undefined,
        JSON.stringify(mine.body?.data?.counts));
    ok('overdue bucket populated', mine.body?.data?.counts?.overdue >= 1);
    ok('completed bucket populated', mine.body?.data?.counts?.completed >= 1);
    ok('task cards carry project + committee names',
        !!mine.body?.data?.completed?.[0]?.projectName);

    console.log('\n=== DASHBOARD SPLIT ===');
    const chairView = await call(T.chair, 'GET', '/my-projects');
    ok('chair sees project under "led"', chairView.body?.data?.led?.length >= 1);
    const memberView = await call(T.member, 'GET', '/my-projects');
    ok('member sees project under "contributing"',
        memberView.body?.data?.contributing?.length >= 1 && memberView.body?.data?.led?.length === 0);
    ok('cards carry counts',
        chairView.body?.data?.led?.[0]?.committeeCount === 1 &&
        chairView.body?.data?.led?.[0]?.memberCount === 3,
        JSON.stringify(chairView.body?.data?.led?.[0]));

    // --- teardown: leave the database exactly as we found it ------------
    await Promise.all([
        ProjectMember.deleteMany({ projectId: pid }),
        ProjectTask.deleteMany({ projectId: pid }),
        Committee.deleteMany({ ProjectId: pid }),
    ]);
    await Project.deleteOne({ _id: pid });
    await User.deleteMany({ indexNo: { $in: ['TST-ADMIN', 'TST-CHAIR', 'TST-LEAD', 'TST-MEM', 'TST-OUT'] } });
    console.log('  (fixtures cleaned up)');

    console.log(`\n${pass} passed, ${fail} failed\n`);
    await mongoose.connection.close();
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(1); });
