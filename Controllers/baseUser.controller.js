const userCollection = require('../Models/baseUser.model');

exports.registerUser = async (req, res) => {
    try {
        const userData = req.body;
        const user = new userCollection(userData);
        await user.save();
        res.status(200).send({ 
            message: 'User registered successfully', 
            data: user });
    } catch (error) {
        res.status(500).send({ 
            message: 'Error registering user', 
            error: error.message });
    }
};

exports.getAllUsers = async (req, res) => {
    try {
        const users = await userCollection.find();
        res.status(200).send({
            message: 'Users retrieved successfully',
            data: users
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving users',
            error: error.message
        });
    }
};

exports.getUserById = async (req, res) => {
    try {
        const userId = req.params.id;
        const user = await userCollection.findById(userId);
        res.status(200).send({
            message: 'User retrieved successfully',
            data: user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};

exports.getUserByEmail = async (req, res) => {
    try {
        const email = req.params.email;
        const user = await userCollection.find({ "email": email });
        res.status(200).send({
            message: 'User retrieved successfully',
            data: user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};

exports.getUserByIndex = async (req,res)=>{
    try{
        const indexNo = req.params.indexNo;
        const user =await userCollection.find({"indexNo":indexNo});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};

 exports.getUserByName = async (req,res)=>{
    try{
        const name = req.params.name;
        const user = await userCollection.find({"name":name});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};      

exports.getUserByContact = async (req,res)=>{
    try{
        const contactNO = req.params.contactNO;
        const user = await userCollection.find({"contactNO":contactNO});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};      

exports.getUserByFaculty = async (req,res)=>{
    try{
        const faculty = req.params.faculty;
        const user = await userCollection.find({"faculty":faculty});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};

exports.getUserByBatch = async (req,res)=>{ 
    try{
        const batch = req.params.batch;
        const user = await userCollection.find({"batch":batch});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',
            error: error.message
        });
    }
};

exports.getUserByRole = async (req,res)=>{
    try{
        const userRole = req.params.userRole;
        const user = await userCollection.find({"userRole":userRole});
        res.status(200).send({
            message:"User retrieved successfully",
            data:user
        });
    } catch (error) {
        res.status(500).send({
            message: 'Error retrieving user',   
            error: error.message
        });
    }
};
