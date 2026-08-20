const mongoose = require("mongoose");
const db = mongoose.connection.useDb("MPTS");

const committeeSchema = new mongoose.Schema(
  {
    CName: { type: String, required: true },
    ProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    Members: [
      {
        UserId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser'},
        UserName: { type: String},
        Role: { type: String, default: 'Member' }
      }
    ],
    MemberCount: { type: Number, default: 0 },
    Description: { type: String }
  },
  { timestamps: true }
);

// Update MemberCount before saving
committeeSchema.pre("save", function (next) {
  this.MemberCount = this.Members ? this.Members.length : 0;
  next();
});

const Committee = db.model("Committee", committeeSchema);
module.exports = Committee;