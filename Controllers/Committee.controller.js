const CommitteeCollection = require('../Models/Committee.model');
const ProjectCollection = require('../Models/Project.model'); // Assuming you have this

// Add Committee to a Project (Only by Chairperson)
exports.addCommittee = async (req, res) => {
    const { projectId, CName, Description, Members } = req.body;
    const userId = req.user?.id; // From authentication middleware

    try {
      /*  if(projectId && userId){
        // Check if user is chairperson of the project
        const project = await ProjectCollection.findById(projectId);
        
        if (!project) {
            return res.status(404).send({
                message: "Project not found"
            });
        }

        if (project.Chairperson.toString() !== userId) {
            return res.status(403).send({
                message: "Only chairperson can add committees"
            });
        }
        } */

        const newCommittee = new CommitteeCollection({
            CName,
            ProjectId: projectId,
            Description,
            Members: Members || []
        });

        await newCommittee.save();
        
        res.status(200).send({
            message: "Committee added successfully",
            data: newCommittee
        });     
    } catch(err) {
        res.status(500).send({
            message: err.message
        });
    }
};

// Add member to committee
exports.addMember = async (req, res) => {
    const { id } = req.params; // Committee ID
    const { userId, userName, role } = req.body;
    
    try {
        console.log('Adding member:', { committeeId: id, userId, userName, role }); // Debug log
        
        const committee = await CommitteeCollection.findById(id);
        
        if (!committee) {
            return res.status(404).send({
                message: 'Committee not found'
            });
        }

        // Check if member already exists
        const memberExists = committee.Members.some(
            member => member.UserId && member.UserId.toString() === userId.toString()
        );

        if (memberExists) {
            return res.status(400).send({
                message: 'Member already exists in this committee'
            });
        }

        committee.Members.push({
            UserId: userId,
            UserName: userName,
            Role: role || 'Member'
        });

        console.log('Members after addition:', committee.Members.length); // Debug log

        await committee.save();

        res.status(200).send({
            message: 'Member added successfully',
            data: committee
        });
    } catch (err) {
        console.error('Error adding member:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};

// Remove member from committee
exports.removeMember = async (req, res) => {
    const { id } = req.params; // Committee ID
    const { memberId } = req.body; // Member's _id in the Members array
    
    try {
        console.log('Removing member:', { committeeId: id, memberId }); // Debug log
        
        const committee = await CommitteeCollection.findById(id);
        
        if (!committee) {
            return res.status(404).send({
                message: 'Committee not found'
            });
        }

        // Log before removal
        console.log('Members before removal:', committee.Members.length);

        // Remove member by _id
        const originalLength = committee.Members.length;
        committee.Members = committee.Members.filter(
            member => member._id.toString() !== memberId.toString()
        );

        console.log('Members after removal:', committee.Members.length); // Debug log

        if (committee.Members.length === originalLength) {
            return res.status(404).send({
                message: 'Member not found in committee'
            });
        }

        await committee.save();

        res.status(200).send({
            message: 'Member removed successfully',
            data: committee
        });
    } catch (err) {
        console.error('Error removing member:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};

// Delete committee
exports.deleteCommittee = async (req, res) => {
    const { id } = req.params; // Committee ID
    
    try {
        console.log('Deleting committee:', id); // Debug log
        
        const committee = await CommitteeCollection.findById(id);
        
        if (!committee) {
            return res.status(404).send({
                message: 'Committee not found'
            });
        }

        await CommitteeCollection.findByIdAndDelete(id);

        res.status(200).send({
            message: 'Committee deleted successfully',
            data: committee
        });
    } catch (err) {
        console.error('Error deleting committee:', err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};


// Get committees where user is a member
exports.getUserCommittees = async (req, res) => {
    const userId = req.user.id;
    
    try {
        const committees = await CommitteeCollection.find({
            'Members.UserId': userId
        }).populate('ProjectId', 'ProjectName');
        
        res.status(200).send({
            message: "User committees retrieved successfully",
            data: committees
        });
    } catch(err) {
        res.status(500).send({
            message: err.message
        });
    }
};


// Get committee by ID
exports.getCommitteeById = async (req, res) => {
    try {
        const committee = await CommitteeCollection.findById(req.params.id);
        
        if (!committee) {
            return res.status(404).send({
                message: "Committee not found"
            });
        }
        
        res.status(200).send({
            message: "Committee fetched successfully",
            data: committee
        });
    } catch (err) {
        console.error("Error fetching committee:", err);
        res.status(500).send({
            message: err.message,
            error: err.toString()
        });
    }
};

// Get committees by name
exports.getCommitteesByName = async (req, res) => {
    try {
        const committees = await CommitteeCollection.find({ 
            CName: new RegExp(req.params.name, 'i') 
        });
        
        res.status(200).send({
            message: "Committees fetched successfully",
            data: committees
        });
    } catch (err) {
        console.error("Error fetching committees:", err);
        res.status(500).send({
            message: err.message
        });
    }
};


// Get committees by member count
exports.getCommitteesByMemCount = async (req, res) => {
    try {
        const committees = await CommitteeCollection.find();
        const filtered = committees.filter(
            committee => committee.Members.length === parseInt(req.params.Count)
        );
        
        res.status(200).send({
            message: "Committees fetched successfully",
            data: filtered
        });
    } catch (err) {
        console.error("Error fetching committees:", err);
        res.status(500).send({
            message: err.message
        });
    }
};

// Get committees by project
exports.getCommitteesByProject = async (req, res) => {
    try {
        const committees = await CommitteeCollection.find({ 
            ProjectId: req.params.projectId 
        });
        
        res.status(200).send({
            message: "Committees fetched successfully",
            data: committees
        });
    } catch (err) {
        console.error("Error fetching committees:", err);
        res.status(500).send({
            message: err.message
        });
    }
};

// Get user committees
exports.getUserCommittees = async (req, res) => {
    try {
        const userId = req.user?.id || req.query.userId;
        
        if (!userId) {
            return res.status(400).send({
                message: "User ID is required"
            });
        }
        
        const committees = await CommitteeCollection.find({
            'Members.UserId': userId
        });
        
        res.status(200).send({
            message: "User committees fetched successfully",
            data: committees
        });
    } catch (err) {
        console.error("Error fetching user committees:", err);
        res.status(500).send({
            message: err.message
        });
    }
};


exports.getCommittees = async (req, res) => {
   try {
        const committees = await CommitteeCollection.find();
        
        res.status(200).send({
            message: "Committees received successfully",
            data: committees
        });
    }
    catch(err){
        console.error("Error in getCommittees:", err);
        res.status(500).send({
            message: err.message
        });
    }
};

exports.getCommitteesByID = async (req, res) => {
    const id = req.params.id;
    try{
        const committees = await CommitteeCollection.findById(id)
            .populate('Members.UserId', 'name email')
            .populate('Coordinator', 'name email');
        res.status(200).send({
            message: "Committees received successfully",
            data: committees
        });
    }
    catch(err){
        res.status(500).send({
            message : err.message
        });
    }
};


exports.getCommitteesByCoordinator = async (req, res) => {
    const Coname = req.params.Coname;
    try{
        const committees = await CommitteeCollection.find({'Coordinator':Coname})
            .populate('ProjectId', 'ProjectName');
        res.status(200).send({
            message: "Committees received successfully",
            data: committees
        });
    }
    catch(err){
        res.status(500).send({
            message : err.message
        });
    }
};

exports.getCommitteesByMemCount = async (req, res) => {
    const Count = req.params.Count;
    try{
        const committees = await CommitteeCollection.find({'MemberCount':Count})
            .populate('ProjectId', 'ProjectName');
        res.status(200).send({
            message: "Committees received successfully",
            data: committees
        });
    }
    catch(err){
        res.status(500).send({
            message : err.message
        });
    }
};