const e = require('express');
const MemberProjectCollection = require('../Models/MemberProject.model');

exports.createMemberProject = async (req, res) => {
    try {
        const memberProjectData = req.body;
        const memberProject = new MemberProjectCollection(memberProjectData);
        await memberProject.save();
        res.status(200).send({ 
            message: 'MemberProject created successfully', 
            data: memberProject });
    } catch (error) {
        res.status(500).send({ 
            message: 'Error creating MemberProject', 
            error: error.message });
    }   
};

exports.getAllMemberProjects = async (req, res) => {
    try {
        const memberProjects = await MemberProjectCollection.find();           
        res.status(200).send({
            message: 'MemberProjects retrieved successfully',
            data: memberProjects
        });
    }   catch (error) { 
        res.status(500).send({
            message: 'Error retrieving MemberProjects', 
            error: error.message
        });
    }
};

exports.getMemberProjectById = async (req, res) => {
    const id = req.params.id;   
    try{
        const memberProject = await MemberProjectCollection.findById(id);
        res.status(200).send({  
            message: "MemberProject received successfully",
            data: memberProject
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving MemberProject',
            error: error.message
        }); 
    }   
};

exports.getMemberProjectByMemberId =async (req, res) => {
    const memberId = req.params.memberId;
    try{    
        const memberProject = await MemberProjectCollection.find({memberId:memberId});
        res.status(200).send({
            message: "MemberProject received successfully",
            data: memberProject
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving MemberProject',  
            error: error.message
        });
    }   
};

exports.getMemberProjectByName =async (req, res) => {
    const PName = req.params.PName;
    try{
        const memberProject = await MemberProjectCollection.find({PName:PName});
        res.status(200).send({
            message: "MemberProject received successfully",
            data: memberProject
        });
    } catch (error) {      
        res.status(500).send({
            message: 'Error retrieving MemberProject',
            error: error.message
        });
    }
};


exports.getRoleByIndexNo =async (req, res) => {
    const indexNo = req.params.indexNo;
    try{    
        const memberProject = await MemberProjectCollection.find({indexNo:indexNo});
        res.status(200).send({
            message: "MemberProject received successfully",
            data: memberProject
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving MemberProject',
            error: error.message
        });
    }   
};

