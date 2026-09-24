// ============================================
// Parking Lot Model
// ============================================

const mongoose = require('mongoose');

const parkingLotSchema = new mongoose.Schema({
    _id: mongoose.Schema.Types.ObjectId,
    
    lotId: {
        type: String,
        unique: true,
        required: true
    },
    
    name: {
        type: String,
        required: true
    },
    
    city: {
        type: String,
        required: true,
        enum: ['Vizag', 'Ongole', 'Tirupati', 'Vijayawada', 'Guntur', 'Kadapa']
    },
    
    address: {
        type: String,
        required: true
    },
    
    coordinates: {
        latitude: Number,
        longitude: Number
    },
    
    // Lot ID prefixes: VZ (Vizag), ONG (Ongole), TPT (Tirupati), VJD (Vijayawada), GNT (Guntur), KDP (Kadapa)
    
    totalSpots: {
        type: Number,
        required: true
    },
    
    availableSpots: {
        type: Number,
        default: function() { return this.totalSpots; }
    },
    
    ratePerHour: {
        type: Number,
        required: true
    },
    
    amenities: [{
        type: String,
        enum: ['CCTV', 'Elevator', 'EV Charging', 'WiFi', 'Security Guard', 
               'Car Wash', 'Premium Security', 'Valet Service', 'Restaurant',
               'Air Conditioned', 'Office Access', 'Gym', 'Cafeteria',
               'Food Truck', 'Mobile Charging']
    }],
    
    openingHour: {
        type: Number,
        default: 0
    },
    
    closingHour: {
        type: Number,
        default: 24
    },
    
    maxDurationHours: {
        type: Number,
        default: 24
    },
    
    image: {
        type: String,
        default: null
    },
    
    status: {
        type: String,
        enum: ['active', 'inactive', 'maintenance'],
        default: 'active'
    },
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

module.exports = mongoose.model('ParkingLot', parkingLotSchema);
