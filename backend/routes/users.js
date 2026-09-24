// ============================================
// Users Routes (Authentication)
// ============================================

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const authMiddleware = require('../middleware/auth');

// Register new user
router.post('/register', async (req, res) => {
    try {
        const { name, email, phone, password, vehicleNumber, vehicleType } = req.body;
        
        // Validation
        if (!name || !email || !phone || !password) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Missing required fields'
            });
        }
        
        // Check if user exists
        const existingUser = await User.findOne({
            $or: [
                { email: email.toLowerCase() },
                { phone }
            ]
        });

        if (existingUser) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Email or phone already registered'
            });
        }
        
        // Create new user
        const user = new User({
            name,
            email: email.toLowerCase(),
            phone,
            password,
            vehicleNumber,
            vehicleType: vehicleType || 'car',
            isVerified: true // In production, implement email verification
        });
        
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
        
        res.status(201).json({
            status: 'SUCCESS',
            message: 'User registered successfully',
            data: {
                userId: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                token: token
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// User login
router.post('/login', async (req, res) => {
    try {
        const { identifier, email, password } = req.body;
        const loginIdentifier = identifier || email;
        
        if (!loginIdentifier || !password) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Email/phone and password required'
            });
        }
        
        const normalizedIdentifier = String(loginIdentifier).trim();
        const isEmail = normalizedIdentifier.includes('@');
        const query = isEmail
            ? { email: normalizedIdentifier.toLowerCase() }
            : { phone: normalizedIdentifier };

        // Find user with password field
        const user = await User.findOne(query).select('+password');
        if (!user) {
            return res.status(401).json({
                status: 'ERROR',
                message: 'Invalid credentials'
            });
        }
        
        // Verify password
        const isPasswordValid = await user.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: 'ERROR',
                message: 'Invalid credentials'
            });
        }
        
        // Update last login
        user.lastLogin = new Date();
        await user.save();
        
        // Generate JWT token
        const token = jwt.sign(
            {
                userId: user._id,
                email: user.email,
                role: user.role
            },
            process.env.JWT_SECRET || 'your-secret-key',
            { expiresIn: '30d' }
        );
        
        res.json({
            status: 'SUCCESS',
            message: 'Login successful',
            data: {
                userId: user._id,
                name: user.name,
                email: user.email,
                phone: user.phone,
                token: token,
                walletBalance: user.walletBalance,
                totalBookings: user.totalBookings
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Get user profile
router.get('/profile', authMiddleware, async (req, res) => {
    try {
        const user = await User.findById(req.userId).select('-password');
        
        if (!user) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'User not found'
            });
        }
        
        res.json({
            status: 'SUCCESS',
            data: user
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

module.exports = router;
