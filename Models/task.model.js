const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS");

const taskSchema = new mongoose.Schema({
    TName:{type:String, required:true},
    Description:{type:String, required:true},
    AssignedTo: { type: [String], required: true },
    Project:{type:String, required:true},
     //CommitteeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Committee' },
    Committee:{type:String, required:true},
    Status:{type:String, required:true}, 
    StartDate:{type:Date, required:true},
    EndDate:{type:Date, required:true},

});

const Task = db.model('Task', taskSchema);
module.exports = Task;
