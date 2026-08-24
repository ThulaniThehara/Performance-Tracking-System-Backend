const mongoose = require('mongoose');
const dns = require('dns');

// System DNS resolver fails to resolve the mongodb+srv SRV record on this
// network; force lookups through public resolvers that work.
dns.setServers(['8.8.8.8', '1.1.1.1']);

const URL = process.env.DB_URL

const connectDB = async () => {
    try {
        await mongoose.connect(URL);
        console.log("MongoDB Connected successfully");
    } catch (e) {
        console.log(e);
    }
}

module.exports = connectDB;