const mongoose = require("mongoose");
const db = mongoose.connection.useDb("MPTS", { useCache: true });

const committeeSchema = new mongoose.Schema(
  {
    CName: { type: String, required: true },
    ProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },

    // The committee lead. Membership itself lives in ProjectMember; this is
    // just a pointer to which of those members runs the committee.
    leadId: { type: mongoose.Schema.Types.ObjectId, ref: 'BaseUser', default: null },

    // Legacy embedded roster, kept so the older committee screens keep working.
    // The Projects module reads membership from ProjectMember instead.
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