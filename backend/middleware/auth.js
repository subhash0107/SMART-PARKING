// ============================================
// Authentication Middleware
// ============================================

const jwt = require('jsonwebtoken');

const authMiddleware = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        
        if (!token) {
            return res.status(401).json({
                status: 'ERROR',
                message: 'No authentication token provided'
            });
        }
        
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        req.userId = decoded.userId;
        req.user = decoded;
        next();
    } catch (error) {
        res.status(401).json({
            status: 'ERROR',
            message: 'Invalid token',
            error: error.message
        });
    }
};

module.exports = authMiddleware;
