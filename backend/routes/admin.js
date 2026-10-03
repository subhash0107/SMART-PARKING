// ============================================
// Admin Routes
// ============================================
// Supported Cities: Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const ParkingLot = require('../models/ParkingLot');
const ParkingSpot = require('../models/ParkingSpot');
const adminAuthMiddleware = require('../middleware/adminAuth');

// Get dashboard statistics
router.get('/stats', adminAuthMiddleware, async (req, res) => {
    try {
        const totalBookings = await Booking.countDocuments();
        const totalUsers = await User.countDocuments();
        const totalLots = await ParkingLot.countDocuments();
        
        const completedBookings = await Booking.countDocuments({ status: 'completed' });
        const activeBookings = await Booking.countDocuments({ status: 'active' });
        const pendingBookings = await Booking.countDocuments({ status: 'pending' });
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
                    pendingBookings,
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

router.get('/analytics', adminAuthMiddleware, async (req, res) => {
    try {
        const to = req.query.to ? new Date(req.query.to) : new Date();
        const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
        if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
            return res.status(400).json({ status: 'ERROR', message: 'Invalid report date range' });
        }

        const dateMatch = { createdAt: { $gte: from, $lte: to } };
        const [bookingsByDay, bookingsByLot, lots] = await Promise.all([
            Booking.aggregate([
                { $match: dateMatch },
                { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, bookings: { $sum: 1 } } },
                { $sort: { _id: 1 } }
            ]),
            Booking.aggregate([
                { $match: dateMatch },
                { $group: { _id: '$lotId', bookings: { $sum: 1 }, cancelled: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } } } },
                { $lookup: { from: 'parkinglots', localField: '_id', foreignField: '_id', as: 'lot' } },
                { $unwind: { path: '$lot', preserveNullAndEmptyArrays: true } },
                { $project: { lotId: '$lot.lotId', lotName: '$lot.name', city: '$lot.city', totalSpots: '$lot.totalSpots', bookings: 1, cancelled: 1 } },
                { $sort: { bookings: -1 } }
            ]),
            ParkingLot.find({ status: 'active' }).select('lotId name totalSpots')
        ]);

        const occupancy = await Promise.all(lots.map(async lot => {
            const [activeBookings, manuallyOccupied] = await Promise.all([
                Booking.distinct('spotNumber', {
                    lotId: lot._id,
                    status: { $nin: ['cancelled', 'no-show'] },
                    checkIn: { $lte: to },
                    checkOut: { $gt: to }
                }),
                ParkingSpot.distinct('spotNumber', { lotId: lot._id, status: 'occupied' })
            ]);
            const activeSpots = new Set([...activeBookings, ...manuallyOccupied]);
            return {
                lotId: lot.lotId,
                lotName: lot.name,
                totalSpots: lot.totalSpots,
                occupiedSpots: activeSpots.size,
                utilizationPercent: lot.totalSpots ? Math.round(activeSpots.size / lot.totalSpots * 100) : 0
            };
        }));

        res.json({ status: 'SUCCESS', data: { from, to, bookingsByDay, bookingsByLot, occupancy } });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

router.get('/lots', adminAuthMiddleware, async (req, res) => {
    try {
        const lots = await ParkingLot.find().sort({ city: 1, name: 1 });
        res.json({ status: 'SUCCESS', data: lots });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

// Get all bookings with filters
router.get('/bookings', adminAuthMiddleware, async (req, res) => {
    try {
        const { status, lotId, page = 1, limit = 20 } = req.query;
        
        let query = {};
        if (status) query.status = status;
        if (lotId) {
            const lot = await ParkingLot.findOne({ lotId });
            if (!lot) return res.json({ status: 'SUCCESS', data: [], pagination: { page: Number(page), limit: Number(limit), total: 0, pages: 0 } });
            query.lotId = lot._id;
        }
        
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
        await ParkingSpot.insertMany(Array.from({ length: lot.totalSpots }, (_, index) => ({
            lotId: lot._id,
            spotNumber: index + 1,
            status: 'available'
        })));
        
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
        const { ratePerHour, totalSpots, amenities, status, name, city, address, coordinates } = req.body;
        const existingLot = await ParkingLot.findOne({ lotId: req.params.lotId });
        if (!existingLot) {
            return res.status(404).json({ status: 'ERROR', message: 'Parking lot not found' });
        }
        if (totalSpots !== undefined &&
            (!Number.isInteger(Number(totalSpots)) || Number(totalSpots) < 1)) {
            return res.status(400).json({ status: 'ERROR', message: 'Total slots must be a positive integer' });
        }
        if (totalSpots !== undefined && Number(totalSpots) < existingLot.totalSpots) {
            const spotsInUse = await Booking.exists({
                lotId: existingLot._id,
                spotNumber: { $gt: Number(totalSpots) },
                status: { $nin: ['cancelled', 'no-show'] }
            });
            const managedSpotsInUse = await ParkingSpot.exists({
                lotId: existingLot._id,
                spotNumber: { $gt: Number(totalSpots) },
                status: { $ne: 'available' }
            });
            if (spotsInUse || managedSpotsInUse) {
                return res.status(409).json({ status: 'ERROR', message: 'Cannot reduce capacity while higher-numbered slots are reserved or occupied' });
            }
        }

        const lot = await ParkingLot.findOneAndUpdate(
            { lotId: req.params.lotId },
            {
                ...(ratePerHour !== undefined && { ratePerHour }),
                ...(totalSpots !== undefined && { totalSpots }),
                ...(amenities !== undefined && { amenities }),
                ...(status !== undefined && { status }),
                ...(name !== undefined && { name }),
                ...(city !== undefined && { city }),
                ...(address !== undefined && { address }),
                ...(coordinates !== undefined && { coordinates })
            },
            { new: true, runValidators: true }
        );
        if (!lot) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Parking lot not found'
            });
        }
        if (totalSpots !== undefined) {
            if (lot.totalSpots > existingLot.totalSpots) {
                await ParkingSpot.bulkWrite(Array.from({ length: lot.totalSpots }, (_, index) => ({
                    updateOne: {
                        filter: { lotId: lot._id, spotNumber: index + 1 },
                        update: { $setOnInsert: { status: 'available' } },
                        upsert: true
                    }
                })).slice(existingLot.totalSpots));
            } else if (lot.totalSpots < existingLot.totalSpots) {
                await ParkingSpot.deleteMany({
                    lotId: lot._id,
                    spotNumber: { $gt: lot.totalSpots }
                });
            }
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

router.put('/lots/:lotId/spots/:spotNumber', adminAuthMiddleware, async (req, res) => {
    try {
        const lot = await ParkingLot.findOne({ lotId: req.params.lotId, status: 'active' });
        if (!lot) return res.status(404).json({ status: 'ERROR', message: 'Active parking lot not found' });
        const spotNumber = Number(req.params.spotNumber);
        const { status } = req.body;
        if (!Number.isInteger(spotNumber) || spotNumber < 1 || spotNumber > lot.totalSpots ||
            !['available', 'occupied', 'maintenance'].includes(status)) {
            return res.status(400).json({ status: 'ERROR', message: 'Invalid slot number or status' });
        }
        const spot = await ParkingSpot.findOneAndUpdate(
            { lotId: lot._id, spotNumber },
            { status, updatedAt: new Date() },
            { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
        );
        global.io?.to(`lot:${lot.lotId}`).emit('spot:updated', {
            lotId: lot.lotId,
            spotNumber,
            status: spot.status,
            updatedAt: spot.updatedAt
        });
        res.json({ status: 'SUCCESS', data: spot });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

router.put('/lots/:lotId/status', adminAuthMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['active', 'inactive', 'maintenance'].includes(status)) {
            return res.status(400).json({ status: 'ERROR', message: 'Invalid facility status' });
        }
        const lot = await ParkingLot.findOneAndUpdate(
            { lotId: req.params.lotId },
            { status },
            { new: true, runValidators: true }
        );
        if (!lot) return res.status(404).json({ status: 'ERROR', message: 'Parking lot not found' });
        res.json({ status: 'SUCCESS', data: lot });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

router.delete('/lots/:lotId', adminAuthMiddleware, async (req, res) => {
    try {
        const lot = await ParkingLot.findOneAndUpdate(
            { lotId: req.params.lotId },
            { status: 'inactive' },
            { new: true }
        );
        if (!lot) return res.status(404).json({ status: 'ERROR', message: 'Parking lot not found' });
        res.json({ status: 'SUCCESS', message: 'Parking facility deactivated', data: lot });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
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
