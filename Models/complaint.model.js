const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

const complaintSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser' },
    from: { type: String, trim: true, default: 'Anonymous Member' },
    category: { type: String, trim: true, default: 'Technical Issue' },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },
    priority: { type: String, enum: ['Low', 'Medium', 'High', 'Critical'], default: 'Medium' },
    status: { type: String, enum: ['Open', 'In Progress', 'Resolved'], default: 'Open' },
}, { timestamps: true });

const Complaint = db.model('Complaint', complaintSchema);
module.exports = Complaint;
