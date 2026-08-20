const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS");


const member_projectSchema = new mongoose.Schema({
    PName : { type: String, required: true, unique: true },
    indexNo:{type:String, required:true, unique:true},
    role:{type:String, required:true}
    
});

const MemberProject = db.model('MemberProject', member_projectSchema);
module.exports = MemberProject;