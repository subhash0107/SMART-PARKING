// ============================================
// Admin Routes
// ============================================
// Supported Cities: Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const ParkingLot = require('../models/ParkingLot');
const adminAuthMiddleware = require('../middleware/adminAuth');

// Get dashboard statistics
router.get('/stats', adminAuthMiddleware, async (req, res) => {
    try {
        const totalBookings = await Booking.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalLots = await ParkingLot.countDocuments();
        
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const activeBookings = await Booking.countDocuments({ status: 'active' });
        const cancelledBookings = await Booking.countDocuments({ status: 'cancelled' });
        
        // Calculate revenue (completed bookings)
        const revenueData = await Booking.aggregate([
            { $match: { status: 'completed', 'paymentDetails.paymentStatus': 'completed' } },
            {
                $group: {
                    _id: null,
                    totalRevenue: { $sum: '$paymentDetails.totalAmount' }
                }
            }
        ]);
        
        const totalRevenue = revenueData[0]?.totalRevenue || 0;
        
        res.json({
            status: 'SUCCESS',
            data: {
                statistics: {
                    totalBookings,
                    totalUsers,
                    totalLots,
                    completedBookings,
                    activeBookings,
                    cancelledBookings,
                    totalRevenue
                },
                timestamp: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Get all bookings with filters
router.get('/bookings', adminAuthMiddleware, async (req, res) => {
    try {
        const { status, lotId, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (lotId) query.lotId = lotId;
        
        const skip = (page - 1) * limit;
        
        const bookings = await Booking.find(query)
            .populate('userId', 'name email phone')
            .populate('lotId', 'name city address')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await Booking.countDocuments(query);
        
        res.json({
            status: 'SUCCESS',
            data: bookings,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Add new parking lot
router.post('/lots', adminAuthMiddleware, async (req, res) => {
    try {
        const {
            lotId,
            name,
            city,
            address,
            coordinates,
            totalSpots,
            ratePerHour,
            amenities,
            openingHour,
            closingHour
        } = req.body;
        
        // Validation
        if (!lotId || !name || !city || !address || !totalSpots || !ratePerHour) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Missing required fields'
            });
        }
        
        // Check if lot exists
        const existingLot = await ParkingLot.findOne({ lotId });
        if (existingLot) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Parking lot with this ID already exists'
            });
        }
        
        // Create new lot
        const lot = new ParkingLot({
            lotId,
            name,
            city,
            address,
            coordinates,
            totalSpots,
            availableSpots: totalSpots,
            ratePerHour,
            amenities: amenities || [],
            openingHour: openingHour || 0,
            closingHour: closingHour || 24
        });
        
        await lot.save();
        
        res.status(201).json({
            status: 'SUCCESS',
            message: 'Parking lot created successfully',
            data: lot
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Update parking lot
router.put('/lots/:lotId', adminAuthMiddleware, async (req, res) => {
    try {
        const { ratePerHour, totalSpots, amenities, status } = req.body;
        
        const lot = await ParkingLot.findOneAndUpdate(
            { lotId: req.params.lotId },
            {
                ratePerHour,
                totalSpots,
                amenities,
                status
            },
            { new: true }
        );
        
        if (!lot) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Parking lot not found'
            });
        }
        
        res.json({
            status: 'SUCCESS',
            message: 'Parking lot updated',
            data: lot
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Get users list
router.get('/users', adminAuthMiddleware, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const skip = (page - 1) * limit;
        
        const users = await User.find()
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
        
        const total = await User.countDocuments();
        
        res.json({
            status: 'SUCCESS',
            data: users,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit)
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

module.exports = router;
