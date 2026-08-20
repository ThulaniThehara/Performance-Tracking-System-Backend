require('dotenv').config();
console.log('PORT:', process.env.PORT);
console.log('DB_URL:', process.env.DB_URL);
const express = require('express');
const connect = require('./Config/db');
const cors = require('cors');


const app = express();
app.use(express.json());

app.use(cors({
    origin: 'http://localhost:5173', // Replace with your frontend URL
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
}));

const router = require('./Routes/sample.route');
const routers =require('./Routes/Committee.route');
const baseUserRoute = require('./Routes/baseUser.route');
const taskRoute = require('./Routes/task.route');
const projectRoute = require('./Routes/project.route');
const memberProjectRoute = require('./Routes/MemberProject.route');

app.use('/api/task',taskRoute);
app.use('/sample',router);
app.use('/api/user', baseUserRoute);
app.use('/api/committee',routers);
app.use('/api/project', projectRoute);
app.use('/api/memberProject', memberProjectRoute);


connect();

app.listen(process.env.PORT,()=>{
    console.log(`Server Listen on Port ${process.env.PORT}`);
});


