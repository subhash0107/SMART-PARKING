// ============================================
// Booking Model
// ============================================

const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    bookingId: {
        type: String,
        unique: true,
        required: true
    },
    
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    
    lotId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ParkingLot',
        required: true
    },
    
    spotNumber: {
        type: Number,
        required: true
    },
    
    checkIn: {
        type: Date,
        required: true
    },
    
    checkOut: {
        type: Date,
        required: true
    },
    
    duration: {
        hours: Number,
        minutes: Number
    },
    
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'active', 'completed', 'cancelled', 'no-show'],
        default: 'confirmed'
    },
    
    paymentDetails: {
        amount: {
            type: Number,
            required: true
        },
        
        tax: {
            type: Number,
            default: 0
        },
        
        totalAmount: {
            type: Number,
            required: true
        },
        
        paymentMethod: {
            type: String,
            enum: ['razorpay', 'upi', 'netbanking', 'wallet', 'cash'],
            required: true
        },
        
        transactionId: String,
        
        orderId: String,
        
        signature: String,
        
        paymentStatus: {
            type: String,
            enum: ['pending', 'completed', 'failed', 'refunded'],
            default: 'completed'
        },
        
        paidAt: Date
    },
    
    vehicleDetails: {
        vehicleNumber: String,
        vehicleType: String,
        color: String
    },
    
    qrCode: String,
    
    entryGate: String,
    entryTime: Date,
    
    exitGate: String,
    exitTime: Date,
    
    actualDuration: Number, // in minutes
    
    notes: String,
    
    cancellationReason: String,
    
    rating: {
        type: Number,
        min: 1,
        max: 5,
        default: null
    },
    
    review: String,
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Index for queries
bookingSchema.index({ userId: 1, createdAt: -1 });
bookingSchema.index({ lotId: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ bookingId: 1 });
bookingSchema.index({ 'paymentDetails.transactionId': 1 });

module.exports = mongoose.model('Booking', bookingSchema);
