const projectCollection = require('../Models/project.model');
const { param } = require('../Routes/project.route');

exports.addProject = async (req, res) => {
    const data = req.body;
    try{
        const newProject = new projectCollection(data);
        await newProject.save();
res.status(200).send({
            "Message": "Project added Sucessfully.",
            "data" : newProject
});     
}catch(err){
        res.status(500).send({
            message : err
        });
    }
};


exports.getAllProject = async (req, res) => {
    try{
        const project = await projectCollection.find();
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectById = async (req, res) => {
    const id = req.params.id;
    try{
        const project = await projectCollection.findById(id);
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectByName = async (req, res) => {
    const name = req.params.PName;
    try{
        const project = await projectCollection.find({'PName':name});
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectByStatus = async (req, res) => {
    const status = req.params.status;
    try{
        const project = await projectCollection.find({'status':status});
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectByStartDate = async (req, res) => {
    const sDate = req.params.StartDate;
    try{
        const project = await projectCollection.find({'StartDate':sDate});
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectByEndDate = async (req, res) => {
    const eDate = req.params.EndDate;
    try{
        const project = await projectCollection.find({'EndDate':eDate});
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

exports.getProjectByChairPerson = async (req, res) => {
    const cPerson = req.params.chairPerson;
    try{
        const project = await projectCollection.find({'chairPerson':cPerson});
        res.status(200).send({
            message: "Project recieved successfully",
            data: project
        });
    }
    catch(err){
        res.status(500).send({
            message : err
        });
    }
};

