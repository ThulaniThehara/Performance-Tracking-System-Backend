const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS");

const projectSchema = new mongoose.Schema({
    PName:{type:String, required:true},
    status:{type:String, required:true},
    description:{type:String, required:true},
    StartDate:{type:Date, required:true},
    EndDate:{type:Date, required:true},
    chairPerson:{type:String, required:true}
});

const Project = db.model('Project', projectSchema);
module.exports = Project;

