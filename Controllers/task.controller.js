const TaskCollection = require('../Models/task.model');
const BaseUser = require('../Models/baseUser.model');
const { notify } = require('../Services/notification.service');

/**
 * This legacy Task model stores AssignedTo as display-name strings rather
 * than user ids (see task.model.js), so notifying an assignee means looking
 * their name back up. Names are matched exactly (post-trim) against
 * BaseUser.name, which is how they got into AssignedTo in the first place
 * (AddTask.jsx / ViewTask.jsx populate the picker from committee members'
 * real names).
 */
async function notifyAssignedByName(names, task) {
    const cleanNames = (names || []).map(n => String(n || '').trim()).filter(Boolean);
    if (!cleanNames.length) return;

    const users = await BaseUser.find({ name: { $in: cleanNames } });
    await Promise.all(users.map(u => notify({
        recipient: u._id,
        type: 'TASK_ASSIGNED',
        message: `You were assigned a task: "${task.TName}"`,
    })));
}

exports.createTask = async (req, res) => {
    try {
        const taskData = req.body;
       console.log("Incoming task data:", req.body);
        const task = new TaskCollection(taskData);
        await task.save();

        await notifyAssignedByName(task.AssignedTo, task);

        res.status(200).send({
            message: 'Task created successfully',
            data: task });
    } catch (error) {
         console.error("Error creating task:", error);
        res.status(500).send({
            message: 'Error creating task',
            error: error.message });
    }
};

exports.getAllTasks = async (req, res) => {
    try {
        const tasks = await TaskCollection.find();  
        res.status(200).send({
            message: 'Tasks retrieved successfully',
            data: tasks
        });
    }   catch (error) { 
        res.status(500).send({
            message: 'Error retrieving tasks',
            error: error.message
        });
    }   
};

exports.getTaskById = async (req, res) => {
    const id = req.params.id;
    try{
        const task = await TaskCollection.findById(id);
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        }); 
    }
};

exports.getTaskByName =async (req, res) => {
    const name = req.params.name;
    try{
        const task = await TaskCollection.find({TName:name});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByAssignedMember = async (req, res) => {
    const member = req.params.assignedMember;
    try{
        const task = await TaskCollection.find({AssignedTo:member});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByProject = async (req, res) => {
    const project = req.params.project;
    try{
        const task = await TaskCollection.find({Project:project});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByCommittee = async (req, res) => {
    const committee = req.params.committee;
    try{
        const task = await TaskCollection.find({Committee:committee});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByStatus = async (req, res) => {
    const status = req.params.status;
    try{
        const task = await TaskCollection.find({Status:status});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByStartDate = async (req, res) => {
    const startDate = req.params.startDate;
    try{
        const task = await TaskCollection.find({StartDate:startDate});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.getTaskByEndDate = async (req, res) => {
    const endDate = req.params.endDate;
    try{
        const task = await TaskCollection.find({EndDate:endDate});
        res.status(200).send({
            message: "Task received successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving task',
            error: error.message
        });
    }
};

exports.updateAssignedMembers = async (req, res) => {
    const { id } = req.params;
    const { AssignedTo } = req.body; // Expecting an array of member names
    try {
        const before = await TaskCollection.findById(id);
        if (!before) return res.status(404).send({ message: 'Task not found' });

        const previousNames = new Set((before.AssignedTo || []).map(n => String(n || '').trim()));
        const newlyAdded = (AssignedTo || []).filter(n => !previousNames.has(String(n || '').trim()));

        const task = await TaskCollection.findByIdAndUpdate(
            id,
            { AssignedTo },
            { new: true }
        );

        await notifyAssignedByName(newlyAdded, task);

        res.status(200).send({
            message: "Assigned members updated successfully",
            data: task
        });
    } catch (error) {
        res.status(500).send({
            message: "Error updating assigned members",
            error: error.message
        });
    }
};

// ...existing code...
exports.deleteTask = async (req, res) => {
    const { id } = req.params; 
    
    try {
        console.log('Deleting task:', id);
        
        const task = await TaskCollection.findById(id);
        
        if (!task) {
            return res.status(404).send({
                message: 'Task not found'
            });
        }

        await TaskCollection.findByIdAndDelete(id);

        res.status(200).send({
            message: 'Task deleted successfully',
            data: task
        });
    } catch (err) {
        console.error('Error deleting task:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};

// ...existing code...
exports.deleteTasksByCommittee = async (req, res) => {
    const committeeName = req.params.committee;
    try {
        const result = await TaskCollection.deleteMany({ Committee: committeeName });
        res.status(200).send({
            message: `Deleted ${result.deletedCount} task(s) for committee ${committeeName}`,
            deletedCount: result.deletedCount
        });
    } catch (err) {
        console.error('Error deleting tasks by committee:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};

// new: remove committee field from tasks (keeps tasks, unassigns committee)
exports.removeCommittee = async (req, res) => {
    try {
        const { committee } = req.body;
        if (!committee) {
            return res.status(400).send({ message: 'Committee name is required in request body' });
        }
        const result = await TaskCollection.updateMany(
            { Committee: committee },
            { $unset: { Committee: "" } }
        );
        res.status(200).send({
            message: `Removed committee field from ${result.modifiedCount} task(s)`,
            modifiedCount: result.modifiedCount
        });
    } catch (err) {
        console.error('Error removing committee from tasks:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};
// ...existing code...