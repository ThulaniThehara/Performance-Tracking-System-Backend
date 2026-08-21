/**
 * Creates (or resets) the first ADMIN account.
 *
 * There is no way to create an admin through the UI, because creating accounts
 * requires already being signed in as an admin. This script breaks that
 * chicken-and-egg by writing the first one straight to the database.
 *
 *   node seedAdmin.js
 *   node seedAdmin.js --email=me@uom.lk --password='S3cret!' --index=ADM001 --name='Ashan'
 *
 * Running it again for an existing email resets that account's password
 * and re-promotes it to ADMIN, so it doubles as a password-recovery tool.
 */
require('dotenv').config();
const mongoose = require('mongoose');
const connect = require('./Config/db');

const arg = (key, fallback) => {
    const hit = process.argv.find(a => a.startsWith(`--${key}=`));
    return hit ? hit.slice(key.length + 3) : fallback;
};

(async () => {
    await connect();

    // Required AFTER connect(): the model binds to useDb("MPTS") at load time.
    const User = require('./Models/baseUser.model');

    if (mongoose.connection.readyState !== 1) {
        console.error('\n  Not connected to MongoDB. Fix the connection first, then re-run.\n');
        process.exit(1);
    }

    const email    = String(arg('email',    'admin@mpts.lk')).toLowerCase();
    const password = arg('password', 'Admin@123');
    const indexNo  = arg('index',    'ADM001');
    const name     = arg('name',     'System Admin');

    if (String(password).length < 6) {
        console.error('  Password must be at least 6 characters.');
        process.exit(1);
    }

    try {
        let user = await User.findOne({ email });

        if (user) {
            user.password = password;      // pre-save hook hashes it
            user.userRole = 'ADMIN';
            user.status = 'ACTIVE';
            user.mustSetPassword = false;
            user.passwordSetTokenHash = undefined;
            user.passwordSetTokenExpires = undefined;
            await user.save();
            console.log(`\n  Existing account promoted to ADMIN and password reset.`);
        } else {
            user = new User({
                indexNo,
                email,
                name,
                password,                  // pre-save hook hashes it
                faculty: 'Faculty of IT',
                batch: '21',
                contactNO: '0770000000',
                experience: '',
                userRole: 'ADMIN',
                status: 'ACTIVE',
                mustSetPassword: false,
            });
            await user.save();
            console.log(`\n  Admin account created.`);
        }

        console.log(`     Login with : ${email}   (or index no ${user.indexNo})`);
        console.log(`     Password   : ${password}`);
        console.log(`\n  Change this password after your first login.\n`);
    } catch (e) {
        console.error('\n  Failed:', e.message, '\n');
        process.exitCode = 1;
    } finally {
        await mongoose.connection.close();
    }
})();
