// ============================================
// User Model
// ============================================

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true
    },
    
    phone: {
        type: String,
        required: true
    },
    
    password: {
        type: String,
        required: true,
        select: false
    },
    
    vehicleNumber: {
        type: String,
        default: null
    },
    
    vehicleType: {
        type: String,
        enum: ['car', 'bike', 'van', 'other'],
        default: 'car'
    },
    
    profilePicture: {
        type: String,
        default: null
    },
    
    walletBalance: {
        type: Number,
        default: 0
    },
    
    totalBookings: {
        type: Number,
        default: 0
    },
    
    rating: {
        type: Number,
        default: 5,
        min: 1,
        max: 5
    },
    
    paymentMethods: [{
        methodId: String,
        type: {
            type: String,
            enum: ['razorpay', 'upi', 'netbanking', 'wallet']
        },
        isDefault: Boolean,
        isActive: Boolean
    }],
    
    address: {
        street: String,
        city: {
            type: String,
            enum: [
                'Vizag', 'Ongole', 'Tirupati', 'Vijayawada', 'Guntur', 'Kadapa',
                'Hyderabad', 'Warangal', 'Karimnagar', 'Nizamabad', 'Khammam',
                'Nalgonda', 'Mahbubnagar', 'Siddipet', 'Suryapet'
            ]
        },
        state: String,
        zipCode: String
    },
    
    notificationPreferences: {
        emailNotifications: { type: Boolean, default: true },
        smsNotifications: { type: Boolean, default: true },
        pushNotifications: { type: Boolean, default: true }
    },
    
    isActive: {
        type: Boolean,
        default: true
    },
    
    isVerified: {
        type: Boolean,
        default: false
    },
    
    verificationToken: String,
    
    role: {
        type: String,
        enum: ['user', 'admin', 'superadmin'],
        default: 'user'
    },
    
    lastLogin: Date,
    
    createdAt: {
        type: Date,
        default: Date.now
    },
    
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, { timestamps: true });

// Hash password before saving
userSchema.pre('save', async function(next) {
    if (!this.isModified('password')) return next();
    
    try {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
        next();
    } catch (error) {
        next(error);
    }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
