// ============================================
// Parking Lots Routes
// ============================================

const express = require('express');
const router = express.Router();
const ParkingLot = require('../models/ParkingLot');

// Get all lots for a city
// Available cities: Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa
router.get('/', async (req, res) => {
    try {
        const { city } = req.query;
        
        let query = { status: 'active' };
        if (city) query.city = city;
        
        const lots = await ParkingLot.find(query)
            .select('lotId name city address totalSpots availableSpots ratePerHour amenities coordinates');
        
        res.json({
            status: 'SUCCESS',
            data: lots,
            count: lots.length
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
        
        // In a real app, this would check actual bookings for the time period
        const occupancyRate = ((lot.totalSpots - lot.availableSpots) / lot.totalSpots) * 100;
        
        res.json({
            status: 'SUCCESS',
            data: {
                lotId: lot.lotId,
                totalSpots: lot.totalSpots,
                availableSpots: lot.availableSpots,
                occupiedSpots: lot.totalSpots - lot.availableSpots,
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

module.exports = router;
