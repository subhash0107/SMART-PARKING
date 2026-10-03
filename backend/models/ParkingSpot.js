const mongoose = require('mongoose');

const parkingSpotSchema = new mongoose.Schema({
    lotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLot',
        required: true
    },
    spotNumber: {
        type: Number,
        required: true,
        min: 1
    },
    status: {
        type: String,
        enum: ['available', 'occupied', 'maintenance'],
        default: 'available'
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

parkingSpotSchema.index({ lotId: 1, spotNumber: 1 }, { unique: true });

module.exports = mongoose.model('ParkingSpot', parkingSpotSchema);
