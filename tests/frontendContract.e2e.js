/**
 * Contract check: every API path the Projects UI calls, exercised with the
 * exact method and payload shape the frontend sends, and asserted against the
 * response shape the components read.
 *
 * Guards against the UI and API drifting apart.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const connect = require('../Config/db');

const BASE = `http://localhost:${Number(process.env.PORT) || 5000}/api`;
let pass = 0, fail = 0;
const ok = (l, c, x = '') => { c ? (pass++, console.log(`  PASS  ${l}`)) : (fail++, console.log(`  FAIL  ${l} ${x}`)); };

const call = async (tok, method, path, body) => {
    const r = await fetch(`${BASE}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}` },
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    let j = null; try { j = await r.json(); } catch {}
    return { status: r.status, body: j };
};

(async () => {
    await connect();
    const User = require('../Models/baseUser.model');
    const Project = require('../Models/project.model');
    const Committee = require('../Models/Committee.model');
    const ProjectMember = require('../Models/projectMember.model');
    const ProjectTask = require('../Models/projectTask.model');

    const sign = (u) => jwt.sign(
        { id: String(u._id), role: String(u.userRole).toUpperCase() },
        process.env.JWT_SECRET, { expiresIn: '10m' });

    const mk = (indexNo, name, role) => User.findOneAndUpdate(
        { indexNo },
        { $set: { indexNo, email: `${indexNo.toLowerCase()}@t.lk`, name, userRole: role,
                  faculty: 'IT', batch: '21', contactNO: '0770000000', status: 'ACTIVE', mustSetPassword: false } },
        { upsert: true, new: true, setDefaultsOnInsert: true });

    const admin = await mk('FE-ADMIN', 'Fe Admin', 'ADMIN');
    const chair = await mk('FE-CHAIR', 'Fe Chair', 'CHAIRPERSON');
    const mem = await mk('FE-MEM', 'Fe Member', 'MEMBER');
    const Ta = sign(admin), Tc = sign(chair), Tm = sign(mem);

    for (const p of await Project.find({ PName: 'FE Contract Project' })) {
        await Promise.all([
            ProjectMember.deleteMany({ projectId: p._id }),
            ProjectTask.deleteMany({ projectId: p._id }),
            Committee.deleteMany({ ProjectId: p._id }),
        ]);
        await Project.deleteOne({ _id: p._id });
    }

    console.log('\n=== paths called by AdminProjectsPage.jsx (Management > Projects) ===');
    const adminList0 = await call(Ta, 'GET', '/pm/admin/projects');
    ok('GET /pm/admin/projects', adminList0.status === 200 && Array.isArray(adminList0.body?.data));

    const created = await call(Ta, 'POST', '/pm/projects', {
        title: 'FE Contract Project', societyName: 'Rotaract', description: 'd',
        status: 'ACTIVE', startDate: '2026-09-01', endDate: '2026-12-01',
        chairpersonId: String(chair._id),
    });
    ok('POST /pm/projects (admin, with chairpersonId)', created.status === 201, JSON.stringify(created.body));
    const pid = created.body?.data?._id;

    ok('chairperson cannot self-create (admin-only route)',
        (await call(Tc, 'POST', '/pm/projects',
            { title: 'x', startDate: '2026-09-01', chairpersonId: String(chair._id) })).status === 403);

    console.log('\n=== paths called by ProjectsHome.jsx ===');
    const home = await call(Tc, 'GET', '/pm/my-projects');
    ok('GET /pm/my-projects', home.status === 200);
    const card = home.body?.data?.led?.[0];
    ok('card has every field ProjectCard reads',
        card && ['PName', 'status', 'progress', 'memberCount', 'committeeCount', 'pendingTasks']
            .every(k => card[k] !== undefined), JSON.stringify(card));

    console.log('\n=== paths called by ProjectDetails.jsx ===');
    const detail = await call(Tc, 'GET', `/pm/projects/${pid}`);
    ok('GET /pm/projects/:id', detail.status === 200);
    const d = detail.body?.data;
    ok('detail payload has the keys the page destructures',
        d && ['project', 'chairperson', 'committees', 'members', 'tasks', 'stats', 'permissions', 'myCommitteeId']
            .every(k => k in d), Object.keys(d || {}).join(','));
    ok('stats has ProjectOverviewCard fields',
        ['memberCount', 'committeeCount', 'pendingTasks', 'totalTasks', 'completedTasks', 'progress']
            .every(k => d.stats[k] !== undefined));

    const com = await call(Tc, 'POST', `/pm/projects/${pid}/committees`, { name: 'Media', description: 'x' });
    ok('POST .../committees', com.status === 201);
    const cid = com.body?.data?._id;

    ok('PATCH .../committees/:id',
        (await call(Tc, 'PATCH', `/pm/projects/${pid}/committees/${cid}`,
            { name: 'Media & Design', description: 'y' })).status === 200);

    const assignable = await call(Tc, 'GET', `/pm/projects/${pid}/assignable`);
    ok('GET .../assignable', assignable.status === 200 && Array.isArray(assignable.body?.data));
    ok('assignable entries have name + indexNo for the picker',
        assignable.body.data.every(u => u.name && u.indexNo));

    ok('POST .../members',
        (await call(Tc, 'POST', `/pm/projects/${pid}/members`,
            { userId: String(mem._id), committeeId: cid, position: 'Editor' })).status === 201);

    ok('PATCH .../committees/:id {leadId} (make lead)',
        (await call(Tc, 'PATCH', `/pm/projects/${pid}/committees/${cid}`,
            { leadId: String(mem._id) })).status === 200);

    const task = await call(Tc, 'POST', `/pm/projects/${pid}/tasks`, {
        title: 'Design poster', description: 'x', assignedTo: String(mem._id),
        committeeId: cid, priority: 'HIGH', dueDate: '2026-09-15', dueTime: '16:00',
    });
    ok('POST .../tasks', task.status === 201, JSON.stringify(task.body));
    const tid = task.body?.data?._id;
    ok('task carries displayStatus for the badge', !!task.body?.data?.displayStatus);
    ok('task populates assignedTo.name for the card', !!task.body?.data?.assignedTo?.name);

    ok('PATCH .../tasks/:id {status}',
        (await call(Tc, 'PATCH', `/pm/projects/${pid}/tasks/${tid}`, { status: 'IN_PROGRESS' })).status === 200);

    console.log('\n=== paths called by MyTasksWidget.jsx ===');
    const mine = await call(Tm, 'GET', '/pm/my-tasks');
    ok('GET /pm/my-tasks', mine.status === 200);
    ok('buckets + counts present',
        ['today', 'upcoming', 'overdue', 'completed', 'counts'].every(k => k in (mine.body?.data || {})));
    const anyTask = [...mine.body.data.today, ...mine.body.data.upcoming, ...mine.body.data.overdue][0];
    ok('widget cards carry projectName / committeeName',
        anyTask && anyTask.projectName !== undefined && anyTask.committeeName !== undefined,
        JSON.stringify(anyTask && { p: anyTask.projectName, c: anyTask.committeeName }));

    ok('PATCH /pm/my-tasks/:id/status',
        (await call(Tm, 'PATCH', `/pm/my-tasks/${tid}/status`, { status: 'COMPLETED' })).status === 200);

    console.log('\n=== member sees no management affordances ===');
    const memDetail = await call(Tm, 'GET', `/pm/projects/${pid}`);
    const mp = memDetail.body?.data?.permissions;
    ok('member permission flags are all false',
        mp && !mp.canEditProject && !mp.canManageCommittees && !mp.canManageMembers &&
        !mp.canCreateTasks && !mp.canDeleteTasks, JSON.stringify(mp));
    ok('member blocked from /assignable (drives the Add-member modal)',
        (await call(Tm, 'GET', `/pm/projects/${pid}/assignable`)).status === 403);

    ok('DELETE .../tasks/:id',
        (await call(Tc, 'DELETE', `/pm/projects/${pid}/tasks/${tid}`)).status === 200);
    ok('DELETE .../members/:userId',
        (await call(Tc, 'DELETE', `/pm/projects/${pid}/members/${mem._id}`)).status === 200);
    ok('DELETE .../committees/:id',
        (await call(Tc, 'DELETE', `/pm/projects/${pid}/committees/${cid}`)).status === 200);
    ok('PATCH /pm/projects/:id (edit modal)',
        (await call(Tc, 'PATCH', `/pm/projects/${pid}`,
            { title: 'FE Contract Project', societyName: 's', description: 'd',
              status: 'COMPLETED', startDate: '2026-09-01', endDate: '2026-12-01' })).status === 200);

    // teardown
    await Promise.all([
        ProjectMember.deleteMany({ projectId: pid }),
        ProjectTask.deleteMany({ projectId: pid }),
        Committee.deleteMany({ ProjectId: pid }),
    ]);
    await Project.deleteOne({ _id: pid });
    await User.deleteMany({ indexNo: { $in: ['FE-ADMIN', 'FE-CHAIR', 'FE-MEM'] } });

    console.log(`\n${pass} passed, ${fail} failed\n`);
    await mongoose.connection.close();
    process.exit(fail ? 1 : 0);
})().catch(e => { console.error('CRASH:', e); process.exit(1); });
