// ============================================
// Admin Authentication Middleware
// ============================================

const jwt = require('jsonwebtoken');

const adminAuthMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                status: 'ERROR',
                message: 'No authentication token provided'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        if (decoded.role !== 'admin' && decoded.role !== 'superadmin') {
            return res.status(403).json({
                status: 'ERROR',
                message: 'Insufficient permissions. Admin role required.'
            });
        }
        
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            status: 'ERROR',
            message: 'Invalid token or insufficient permissions',
            error: error.message
        });
    }
};

module.exports = adminAuthMiddleware;
