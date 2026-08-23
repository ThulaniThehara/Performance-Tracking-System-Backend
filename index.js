require('dotenv').config();
console.log('PORT:', process.env.PORT);
console.log('DB_URL:', process.env.DB_URL);
const express = require('express');
const connect = require('./Config/db');
const cors = require('cors');


const app = express();
app.use(express.json());

// Any localhost origin is allowed, on any port. Vite falls back to 5174, 5175,
// ... whenever 5173 is already taken (a second `npm run dev`, or the same app
// open in another browser), and a hardcoded single origin meant those tabs got
// their responses blocked by the browser — which surfaces in the UI as a
// misleading "Server error" because fetch() rejects instead of returning a
// status. CORS_ORIGIN overrides this with a comma-separated list for deploys,
// where the real frontend URL should be named explicitly.
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',').map(o => o.trim()).filter(Boolean);

const isLocalhost = (origin) =>
    /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);

app.use(cors({
    origin: (origin, callback) => {
        // Non-browser callers (curl, Postman, server-to-server) send no Origin.
        if (!origin) return callback(null, true);
        if (allowedOrigins.length) return callback(null, allowedOrigins.includes(origin));
        return callback(null, isLocalhost(origin));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
    credentials: true
}));

const router = require('./Routes/sample.route');
const routers =require('./Routes/Committee.route');
const baseUserRoute = require('./Routes/baseUser.route');
const taskRoute = require('./Routes/task.route');
const projectRoute = require('./Routes/project.route');
const memberProjectRoute = require('./Routes/MemberProject.route');
const authRoute = require('./Routes/auth.route');
const adminRoute = require('./Routes/admin.route');
const eventRoute = require('./Routes/event.route');
const projectHubRoute = require('./Routes/projectHub.route');
const notificationRoute = require('./Routes/notification.route');

app.use('/api/auth', authRoute);
app.use('/api/admin', adminRoute);
app.use('/api/event', eventRoute);
app.use('/api/pm', projectHubRoute);
app.use('/api/notifications', notificationRoute);
app.use('/api/task',taskRoute);
app.use('/sample',router);
app.use('/api/user', baseUserRoute);
app.use('/api/committee',routers);
app.use('/api/project', projectRoute);
app.use('/api/memberProject', memberProjectRoute);


connect();

const PORT = Number(process.env.PORT) || 5000;
app.listen(PORT,()=>{
    console.log(`Server Listen on Port ${PORT}`);
});


