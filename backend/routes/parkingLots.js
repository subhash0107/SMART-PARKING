// ============================================
// Parking Lots Routes
// ============================================

const express = require('express');
const router = express.Router();
const ParkingLot = require('../models/ParkingLot');
const ParkingSpot = require('../models/ParkingSpot');
const Booking = require('../models/Booking');

// Get all lots for a city
// Available cities: Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa
router.get('/', async (req, res) => {
    try {
        const { city } = req.query;
        
        let query = { status: 'active' };
        if (city) query.city = city;
        
        const lots = await ParkingLot.find(query)
            .select('lotId name city address totalSpots availableSpots ratePerHour amenities coordinates status');
        const liveLots = await Promise.all(lots.map(async lot => {
            const now = new Date();
            const [booked, blocked] = await Promise.all([
                Booking.distinct('spotNumber', {
                    lotId: lot._id,
                    status: { $nin: ['cancelled', 'no-show'] },
                    checkIn: { $lte: now },
                    checkOut: { $gt: now }
                }),
                ParkingSpot.distinct('spotNumber', { lotId: lot._id, status: { $ne: 'available' } })
            ]);
            const occupied = new Set([...booked, ...blocked]).size;
            return { ...lot.toObject(), availableSpots: Math.max(0, lot.totalSpots - occupied) };
        }));
        
        res.json({
            status: 'SUCCESS',
            data: liveLots,
            count: liveLots.length
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Get specific lot
router.get('/:lotId', async (req, res) => {
    try {
        const lot = await ParkingLot.findOne({ lotId: req.params.lotId });
        
        if (!lot) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Parking lot not found'
            });
        }
        
        res.json({
            status: 'SUCCESS',
            data: lot
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

// Get lot availability
router.get('/:lotId/availability', async (req, res) => {
    try {
        const { lotId } = req.params;
        const { checkIn, checkOut } = req.query;
        
        const lot = await ParkingLot.findOne({ lotId });
        
        if (!lot) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Parking lot not found'
            });
        }
        
        const now = new Date();
        const [bookedSpots, blockedSpots] = await Promise.all([
            Booking.distinct('spotNumber', {
                lotId: lot._id,
                status: { $nin: ['cancelled', 'no-show'] },
                checkIn: { $lte: now },
                checkOut: { $gt: now }
            }),
            ParkingSpot.distinct('spotNumber', { lotId: lot._id, status: { $ne: 'available' } })
        ]);
        const occupiedCount = new Set([...bookedSpots, ...blockedSpots]).size;
        const availableSpots = Math.max(0, lot.totalSpots - occupiedCount);
        const occupancyRate = lot.totalSpots ? (occupiedCount / lot.totalSpots) * 100 : 0;
        
        res.json({
            status: 'SUCCESS',
            data: {
                lotId: lot.lotId,
                totalSpots: lot.totalSpots,
                availableSpots,
                occupiedSpots: occupiedCount,
                occupancyRate: occupancyRate.toFixed(2),
                ratePerHour: lot.ratePerHour
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: error.message
        });
    }
});

router.get('/:lotId/spots', async (req, res) => {
    try {
        const lot = await ParkingLot.findOne({ lotId: req.params.lotId, status: 'active' });
        if (!lot) return res.status(404).json({ status: 'ERROR', message: 'Parking lot not found' });
        const [managed, booked] = await Promise.all([
            ParkingSpot.find({ lotId: lot._id }).select('spotNumber status updatedAt').lean(),
            Booking.find({
                lotId: lot._id,
                status: { $nin: ['cancelled', 'no-show'] },
                checkIn: { $lt: new Date(req.query.checkOut || Date.now() + 86400000) },
                checkOut: { $gt: new Date(req.query.checkIn || Date.now()) }
            }).distinct('spotNumber')
        ]);
        const statusByNumber = new Map(managed.map(spot => [spot.spotNumber, spot]));
        const spots = Array.from({ length: lot.totalSpots }, (_, index) => {
            const spotNumber = index + 1;
            const spot = statusByNumber.get(spotNumber);
            const status = spot?.status !== 'available' && spot?.status
                ? spot.status
                : booked.includes(spotNumber) ? 'reserved' : 'available';
            return { spotNumber, status, updatedAt: spot?.updatedAt || null };
        });
        res.json({ status: 'SUCCESS', data: spots });
    } catch (error) {
        res.status(500).json({ status: 'ERROR', message: error.message });
    }
});

module.exports = router;
