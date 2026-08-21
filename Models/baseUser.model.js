const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const db = mongoose.connection.useDb("MPTS");

const USER_ROLES = ['ADMIN', 'CHAIRPERSON', 'COMMITTEEHEAD', 'MEMBER'];
const USER_STATUS = ['ACTIVE', 'INACTIVE'];

const baseUserSchema = new mongoose.Schema({
    indexNo:{type:String, required:true, unique:true, trim:true},
    email:{type:String, required:true, unique:true, trim:true, lowercase:true},

    // Not required: an invited user has no password until they use their set-password link.
    // select:false keeps the hash out of every ordinary query result.
    password:{type:String, select:false},

    name:{type:String, required:true, trim:true},
    faculty:{type:String, required:true, trim:true},
    batch:{type:String, required:true, trim:true},
    contactNO:{type:String, required:true, trim:true},
    experience:{type:String},
    userRole:{type:String, required:true, enum:USER_ROLES, uppercase:true, default:'MEMBER'},

    status:{type:String, enum:USER_STATUS, uppercase:true, default:'ACTIVE'},
    mustSetPassword:{type:Boolean, default:true},

    // Only the SHA-256 of the invite token is stored, so a database leak
    // does not hand out working set-password links.
    passwordSetTokenHash:{type:String, select:false},
    passwordSetTokenExpires:{type:Date, select:false},
}, { timestamps: true });

// Hash on every path that saves a password, so no controller can forget to.
baseUserSchema.pre('save', async function (next) {
    if (!this.isModified('password') || !this.password) return next();
    try {
        this.password = await bcrypt.hash(this.password, 10);
        next();
    } catch (e) {
        next(e);
    }
});

baseUserSchema.methods.comparePassword = function (plainText) {
    if (!this.password) return Promise.resolve(false);
    return bcrypt.compare(plainText, this.password);
};

// The exact shape LoginPage.jsx and ProtectedRoute.jsx expect: `role`, uppercased.
baseUserSchema.methods.toPublicJSON = function () {
    return {
        id: this._id,
        indexNo: this.indexNo,
        name: this.name,
        email: this.email,
        role: String(this.userRole).toUpperCase(),
        userRole: String(this.userRole).toUpperCase(),
        faculty: this.faculty,
        batch: this.batch,
        contactNO: this.contactNO,
        status: this.status,
        mustSetPassword: this.mustSetPassword,
    };
};

// Belt and braces: strip secrets even if a controller sends the raw document.
baseUserSchema.set('toJSON', {
    transform: (doc, ret) => {
        delete ret.password;
        delete ret.passwordSetTokenHash;
        delete ret.passwordSetTokenExpires;
        return ret;
    }
});

const BaseUser = db.model('BaseUser', baseUserSchema);
BaseUser.USER_ROLES = USER_ROLES;
BaseUser.USER_STATUS = USER_STATUS;
module.exports = BaseUser;
