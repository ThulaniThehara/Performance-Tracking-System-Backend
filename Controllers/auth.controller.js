const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../Models/baseUser.model');

const MIN_PASSWORD_LENGTH = 6; // matches the check in Frontend SetPassword.jsx

const signToken = (user) => jwt.sign(
    { id: String(user._id), role: String(user.userRole).toUpperCase() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
);

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex');

/**
 * POST /api/auth/login
 * Body: { username, password }   username = email OR indexNo
 * 200 : { token, user: { id, name, email, role, ... } }
 */
exports.login = async (req, res) => {
    try {
        const { username, password } = req.body || {};

        if (!username || !password) {
            return res.status(400).send({ message: 'Username and password are required' });
        }

        const id = String(username).trim();
        const user = await User.findOne({
            $or: [{ email: id.toLowerCase() }, { indexNo: id }]
        }).select('+password');

        // Same message for "no such user" and "wrong password" so the endpoint
        // cannot be used to discover which accounts exist.
        if (!user) return res.status(401).send({ message: 'Invalid username or password' });

        if (user.status !== 'ACTIVE') {
            return res.status(403).send({ message: 'This account has been deactivated' });
        }

        if (!user.password) {
            return res.status(403).send({
                message: 'Password not set yet. Please use the set-password link sent to your email.',
                mustSetPassword: true
            });
        }

        const ok = await user.comparePassword(password);
        if (!ok) return res.status(401).send({ message: 'Invalid username or password' });

        res.status(200).send({
            message: 'Login successful',
            token: signToken(user),
            user: user.toPublicJSON()
        });
    } catch (e) {
        res.status(500).send({ message: 'Login failed', error: e.message });
    }
};

/** GET /api/auth/me  (Bearer token) */
exports.me = async (req, res) => {
    res.status(200).send({ message: 'Session valid', user: req.user.toPublicJSON() });
};

/**
 * POST /api/auth/set-password
 * Body: { token, password }   token = the raw value from the set-password link
 */
exports.setPassword = async (req, res) => {
    try {
        const { token, password } = req.body || {};

        if (!token) return res.status(400).send({ message: 'Invalid or missing token' });
        if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
            return res.status(400).send({
                message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            });
        }

        const user = await User.findOne({
            passwordSetTokenHash: hashToken(String(token)),
            passwordSetTokenExpires: { $gt: new Date() }
        }).select('+passwordSetTokenHash +passwordSetTokenExpires');

        if (!user) {
            return res.status(400).send({ message: 'This link is invalid or has expired' });
        }
        if (user.status !== 'ACTIVE') {
            return res.status(403).send({ message: 'This account has been deactivated' });
        }

        user.password = password;              // pre-save hook hashes it
        user.mustSetPassword = false;
        user.passwordSetTokenHash = undefined; // single use
        user.passwordSetTokenExpires = undefined;
        await user.save();

        res.status(200).send({ message: 'Password set successfully. You can now log in.' });
    } catch (e) {
        res.status(500).send({ message: 'Failed to set password', error: e.message });
    }
};

/**
 * POST /api/auth/change-password   (Bearer token)
 * Body: { currentPassword, newPassword }
 */
exports.changePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body || {};

        if (!currentPassword || !newPassword) {
            return res.status(400).send({ message: 'Current and new password are required' });
        }
        if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
            return res.status(400).send({
                message: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
            });
        }

        const user = await User.findById(req.auth.id).select('+password');
        if (!user) return res.status(404).send({ message: 'Account not found' });

        const ok = await user.comparePassword(currentPassword);
        if (!ok) return res.status(401).send({ message: 'Current password is incorrect' });

        user.password = newPassword;
        user.mustSetPassword = false;
        await user.save();

        res.status(200).send({ message: 'Password changed successfully' });
    } catch (e) {
        res.status(500).send({ message: 'Failed to change password', error: e.message });
    }
};

// Shared with admin.controller so both issue identical invite links.
exports.issueSetPasswordToken = async (user, days = 7) => {
    const raw = crypto.randomBytes(32).toString('hex');
    user.passwordSetTokenHash = hashToken(raw);
    user.passwordSetTokenExpires = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    user.mustSetPassword = true;
    await user.save();
    const appUrl = (process.env.APP_URL || 'http://localhost:5173').replace(/\/+$/, '');
    return { rawToken: raw, link: `${appUrl}/set-password?token=${raw}` };
};
