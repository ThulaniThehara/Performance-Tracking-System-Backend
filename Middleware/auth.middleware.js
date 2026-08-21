const jwt = require('jsonwebtoken');
const User = require('../Models/baseUser.model');

/**
 * Verifies the Bearer token and loads the current user onto req.user.
 * The user is re-read on every request so that deactivating an account
 * takes effect immediately instead of when their token happens to expire.
 */
exports.verifyToken = async (req, res, next) => {
    try {
        const header = req.headers.authorization || '';
        if (!header.startsWith('Bearer ')) {
            return res.status(401).send({ message: 'Authentication required' });
        }

        const token = header.slice(7).trim();
        if (!token) return res.status(401).send({ message: 'Authentication required' });

        let payload;
        try {
            payload = jwt.verify(token, process.env.JWT_SECRET);
        } catch (e) {
            return res.status(401).send({ message: 'Session is invalid or has expired' });
        }

        const user = await User.findById(payload.id);
        if (!user) return res.status(401).send({ message: 'Account no longer exists' });
        if (user.status !== 'ACTIVE') {
            return res.status(403).send({ message: 'This account has been deactivated' });
        }

        req.user = user;
        req.auth = { id: String(user._id), role: String(user.userRole).toUpperCase() };
        next();
    } catch (e) {
        res.status(500).send({ message: 'Authentication failed', error: e.message });
    }
};

/** Usage: requireRole('ADMIN')  |  requireRole('ADMIN', 'CHAIRPERSON') */
exports.requireRole = (...roles) => {
    const allowed = roles.flat().map(r => String(r).toUpperCase());
    return (req, res, next) => {
        if (!req.auth) return res.status(401).send({ message: 'Authentication required' });
        if (!allowed.includes(req.auth.role)) {
            return res.status(403).send({
                message: 'You do not have permission to perform this action'
            });
        }
        next();
    };
};
