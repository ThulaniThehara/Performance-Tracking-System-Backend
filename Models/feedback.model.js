const mongoose = require('mongoose');
const db = mongoose.connection.useDb("MPTS", { useCache: true });

const feedbackSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser' },
    author: { type: String, trim: true, default: 'Anonymous Member' },
    role: { type: String, trim: true, default: 'Member' },
    type: { type: String, trim: true, default: 'Suggestion' },
    message: { type: String, required: true, trim: true },
    rating: { type: Number, min: 1, max: 5, default: 5 },
}, { timestamps: true });

const Feedback = db.model('Feedback', feedbackSchema);
module.exports = Feedback;
