// ============================================
// Bookings Routes - Real-time Support
// ============================================

const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const User = require('../models/User');
const ParkingLot = require('../models/ParkingLot');
const authMiddleware = require('../middleware/auth');
const mongoose = require('mongoose');
const ParkingSpot = require('../models/ParkingSpot');

// Track concurrent bookings to prevent double booking
const concurrentBookingAttempts = new Map();

// Helper: Check spot availability in real-time
async function isSpotAvailable(lotId, spotNumber, checkIn, checkOut, excludeBookingId = null) {
    const query = {
        lotId: lotId,
        spotNumber: spotNumber,
        status: { $ne: 'cancelled' },
        $or: [
            { checkIn: { $lt: new Date(checkOut) }, checkOut: { $gt: new Date(checkIn) } }
        ]
    };

    if (excludeBookingId) {
        query.bookingId = { $ne: excludeBookingId };
    }

    const existingBooking = await Booking.findOne(query);
    return !existingBooking;
}

// Helper: Get real-time spot status
async function getSpotStatus(lotId, spotNumber) {
    const sensorStatus = await ParkingSpot.findOne({ lotId, spotNumber }).select('status');
    if (sensorStatus && sensorStatus.status !== 'available') return sensorStatus.status;

    const booking = await Booking.findOne({
        lotId: lotId,
        spotNumber: spotNumber,
        status: { $nin: ['cancelled', 'no-show'] },
        checkIn: { $lte: new Date() },
        checkOut: { $gt: new Date() }
    }).select('status paymentDetails.paymentStatus checkIn checkOut');

    if (!booking) return 'available';
    if (booking.paymentDetails.paymentStatus !== 'completed') return 'reserved';
    return 'occupied';
}

async function findParkingLot(identifier) {
    if (mongoose.Types.ObjectId.isValid(identifier)) {
        const byId = await ParkingLot.findById(identifier);
        if (byId) return byId;
    }
    return ParkingLot.findOne({ lotId: identifier });
}

// Create new booking with real-time conflict detection
router.post('/', authMiddleware, async (req, res) => {
    let lockedSpotKey = null;
    try {
        const { lotId, spotNumber, checkIn, checkOut, paymentMethod, vehicleNumber, vehicleType } = req.body;
        
        // Validation
        if (!lotId || !spotNumber || !checkIn || !checkOut || !paymentMethod) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Missing required fields',
                code: 'INVALID_REQUEST'
            });
        }

        // Validate dates
        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);

        if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkInDate >= checkOutDate) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Check-out time must be after check-in time',
                code: 'INVALID_DATE_RANGE'
            });
        }

        if (checkInDate < new Date()) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Check-in time cannot be in the past',
                code: 'PAST_DATE'
            });
        }

        const lot = await findParkingLot(lotId);
        if (!lot) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Parking lot not found',
                code: 'LOT_NOT_FOUND'
            });
        }

        const parsedSpotNumber = Number(spotNumber);
        if (!Number.isInteger(parsedSpotNumber) || parsedSpotNumber < 1 || parsedSpotNumber > lot.totalSpots) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Invalid parking spot number',
                code: 'INVALID_SPOT'
            });
        }

        const bookingLotId = lot._id;
        const spotKey = `${bookingLotId}-${parsedSpotNumber}`;
        if (concurrentBookingAttempts.has(spotKey)) {
            return res.status(429).json({
                status: 'ERROR',
                message: 'Another user is booking this spot. Please try another spot.',
                code: 'CONCURRENT_BOOKING',
                retryAfter: 5
            });
        }

        concurrentBookingAttempts.set(spotKey, { userId: req.userId, timestamp: Date.now() });
        lockedSpotKey = spotKey;

        const managedSpot = await ParkingSpot.findOne({ lotId: bookingLotId, spotNumber: parsedSpotNumber });
        if (managedSpot && managedSpot.status !== 'available') {
            concurrentBookingAttempts.delete(spotKey);
            lockedSpotKey = null;
            return res.status(409).json({
                status: 'ERROR',
                message: `Spot is currently ${managedSpot.status}`,
                code: 'SPOT_UNAVAILABLE'
            });
        }

        const isAvailable = await isSpotAvailable(bookingLotId, parsedSpotNumber, checkInDate, checkOutDate);
        if (!isAvailable) {
            concurrentBookingAttempts.delete(spotKey);
            lockedSpotKey = null;
            return res.status(409).json({
                status: 'ERROR',
                message: 'Spot is not available for the selected time period',
                code: 'SPOT_UNAVAILABLE',
                suggestedSpots: await getAvailableSpots(bookingLotId, checkInDate, checkOutDate)
            });
        }

        // Calculate cost
        const durationMs = checkOutDate - checkInDate;
        const durationHours = Math.ceil(durationMs / (1000 * 60 * 60));
        
        const baseAmount = durationHours * lot.ratePerHour;
        const tax = Math.round(baseAmount * 0.18); // 18% GST
        const totalAmount = baseAmount + tax;
        
        // Generate unique booking reference
        const bookingRef = `PARK${Math.random().toString(36).substring(2, 7).toUpperCase()}${Date.now().toString().slice(-4)}`;
        
        const booking = new Booking({
            bookingId: bookingRef,
            userId: req.userId,
            lotId: bookingLotId,
            spotNumber: parsedSpotNumber,
            checkIn: checkInDate,
            checkOut: checkOutDate,
            duration: {
                hours: durationHours,
                minutes: 0
            },
            paymentDetails: {
                amount: baseAmount,
                tax: tax,
                totalAmount: totalAmount,
                paymentMethod: paymentMethod,
                paymentStatus: 'pending'
            },
            vehicleDetails: {
                vehicleNumber: vehicleNumber,
                vehicleType: vehicleType
            },
            qrCode: `PARK-${spotNumber}-${bookingRef}`,
            status: 'pending'
        });
        
        await booking.save();
        
        // Update user booking count
        await User.findByIdAndUpdate(req.userId, {
            $inc: { totalBookings: 1 }
        });

        // Emit real-time booking event
        if (global.io) {
            global.io.to(`lot:${lot.lotId}`).emit('booking:created', {
                lotId: lot.lotId,
                spotNumber: parsedSpotNumber,
                status: booking.status
            });
        }

        concurrentBookingAttempts.delete(spotKey);
        lockedSpotKey = null;
        
        res.status(201).json({
            status: 'SUCCESS',
            message: 'Booking created successfully',
            data: {
                bookingId: booking.bookingId,
                spotNumber: booking.spotNumber,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                amount: booking.paymentDetails.totalAmount,
                status: booking.status,
                qrCode: booking.qrCode
            }
        });
    } catch (error) {
        if (lockedSpotKey) concurrentBookingAttempts.delete(lockedSpotKey);
        console.error('Booking creation error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Get booking details
router.get('/:bookingId', async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId })
            .populate('lotId', 'name address city ratePerHour totalSpots');
        
        if (!booking) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Booking not found',
                code: 'NOT_FOUND'
            });
        }
        
        // Get real-time spot status
        const spotStatus = await getSpotStatus(booking.lotId._id, booking.spotNumber);
        
        res.json({
            status: 'SUCCESS',
            data: {
                ...booking._doc,
                spotStatus: spotStatus,
                fetchedAt: new Date().toISOString()
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Get user bookings with real-time updates
router.get('/user/:userId', authMiddleware, async (req, res) => {
    try {
        // Verify user is accessing their own bookings
        if (req.params.userId !== req.userId) {
            return res.status(403).json({
                status: 'ERROR',
                message: 'Unauthorized access',
                code: 'UNAUTHORIZED'
            });
        }

        const bookings = await Booking.find({ userId: req.userId })
            .populate('lotId', 'name address city')
            .sort({ createdAt: -1 });

        // Enrich with real-time spot statuses
        const enrichedBookings = await Promise.all(
            bookings.map(async (booking) => ({
                ...booking._doc,
                spotStatus: await getSpotStatus(booking.lotId._id, booking.spotNumber)
            }))
        );
        
        res.json({
            status: 'SUCCESS',
            data: enrichedBookings,
            count: enrichedBookings.length,
            fetchedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Get available spots (real-time)
async function getAvailableSpots(lotId, checkInDate, checkOutDate, limit = 5) {
    try {
        const lot = await findParkingLot(lotId);
        if (!lot) throw new Error('Parking lot not found');

        const bookedSpots = await Booking.find({
            lotId: lot._id,
            status: { $ne: 'cancelled' },
            $or: [
                { checkIn: { $lt: checkOutDate }, checkOut: { $gt: checkInDate } }
            ]
        }).distinct('spotNumber');
        const blockedSpots = await ParkingSpot.find({
            lotId: lot._id,
            status: { $ne: 'available' }
        }).distinct('spotNumber');
        const unavailable = new Set([...bookedSpots, ...blockedSpots]);

        const availableSpots = [];
        for (let i = 1; i <= lot.totalSpots && availableSpots.length < limit; i++) {
            if (!unavailable.has(i)) {
                availableSpots.push({ spotNumber: i, available: true });
            }
        }
        return availableSpots;
    } catch (error) {
        console.error('Error fetching available spots:', error);
        throw error;
    }
}

router.get('/available/spots/:lotId', async (req, res) => {
    try {
        const { lotId } = req.params;
        const { checkIn, checkOut } = req.query;

        if (!checkIn || !checkOut) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'checkIn and checkOut parameters required',
                code: 'MISSING_PARAMS'
            });
        }

        const checkInDate = new Date(checkIn);
        const checkOutDate = new Date(checkOut);
        if (Number.isNaN(checkInDate.getTime()) || Number.isNaN(checkOutDate.getTime()) || checkInDate >= checkOutDate) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'A valid check-in and check-out range is required',
                code: 'INVALID_DATE_RANGE'
            });
        }

        const availableSpots = await getAvailableSpots(
            lotId,
            checkInDate,
            checkOutDate,
            20
        );

        res.json({
            status: 'SUCCESS',
            data: availableSpots,
            count: availableSpots.length,
            updatedAt: new Date().toISOString()
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Update booking status (with real-time notification)
router.put('/:bookingId', authMiddleware, async (req, res) => {
    try {
        const { status } = req.body;
        
        // Validate status transition
        const validStatuses = ['pending', 'confirmed', 'check-in', 'active', 'check-out', 'completed', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                status: 'ERROR',
                message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
                code: 'INVALID_STATUS'
            });
        }

        const booking = await Booking.findOneAndUpdate(
            { bookingId: req.params.bookingId, userId: req.userId },
            { status: status, updatedAt: new Date() },
            { new: true }
        ).populate('lotId', 'name address lotId');
        
        if (!booking) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Booking not found',
                code: 'NOT_FOUND'
            });
        }

        // Emit real-time status update
        if (global.io) {
            global.io.to(`booking:${booking.bookingId}`).emit('booking:updated', {
                bookingId: booking.bookingId,
                status: booking.status,
                lotId: booking.lotId.lotId,
                updatedAt: new Date().toISOString()
            });
        }
        
        res.json({
            status: 'SUCCESS',
            message: 'Booking updated',
            data: booking
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Cancel booking with refund calculation
router.delete('/:bookingId', authMiddleware, async (req, res) => {
    try {
        const booking = await Booking.findOne({ bookingId: req.params.bookingId, userId: req.userId });
        
        if (!booking) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Booking not found',
                code: 'NOT_FOUND'
            });
        }

        // Cannot cancel completed or already cancelled bookings
        if (booking.status === 'completed' || booking.status === 'cancelled') {
            return res.status(400).json({
                status: 'ERROR',
                message: `Cannot cancel ${booking.status} booking`,
                code: 'INVALID_CANCELLATION'
            });
        }

        // Calculate refund (full refund if cancelled before check-in)
        const now = new Date();
        const checkInTime = new Date(booking.checkIn);
        const refundPercentage = now < checkInTime ? 100 : 0;
        const refundAmount = (booking.paymentDetails.totalAmount * refundPercentage) / 100;

        const updatedBooking = await Booking.findOneAndUpdate(
            { bookingId: req.params.bookingId },
            {
                status: 'cancelled',
                'paymentDetails.refund': {
                    amount: refundAmount,
                    percentage: refundPercentage,
                    processedAt: new Date(),
                    reason: 'User initiated cancellation'
                }
            },
            { new: true }
        );

        // Emit real-time cancellation event
        if (global.io) {
            const lot = await ParkingLot.findById(updatedBooking.lotId);
            global.io.to(`booking:${updatedBooking.bookingId}`).emit('booking:cancelled', {
                bookingId: updatedBooking.bookingId,
                lotId: lot.lotId,
                spotNumber: updatedBooking.spotNumber,
                refund: refundAmount,
                cancelledAt: new Date().toISOString()
            });
            global.io.to(`lot:${lot.lotId}`).emit('booking:cancelled', {
                lotId: lot.lotId,
                spotNumber: updatedBooking.spotNumber,
                cancelledAt: new Date().toISOString()
            });
        }
        
        res.json({
            status: 'SUCCESS',
            message: 'Booking cancelled successfully',
            data: {
                bookingId: updatedBooking.bookingId,
                refundAmount: refundAmount,
                refundPercentage: refundPercentage
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

module.exports = router;
