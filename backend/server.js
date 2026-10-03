// ============================================
// Smart Parking Backend - Main Server
// Real-time Support & Enhanced Security
// ============================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const socketIO = require('socket.io');
const ParkingLot = require('./models/ParkingLot');
const defaultLots = require('./config/defaultLots');
const ParkingSpot = require('./models/ParkingSpot');
const Booking = require('./models/Booking');
const jwt = require('jsonwebtoken');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// ============================================
// Real-time Socket.IO Setup
// ============================================

const io = socketIO(server, {
    cors: {
        origin: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:8080'],
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6,
    pingInterval: 25000,
    pingTimeout: 60000
});

// Make io available globally for route handlers
global.io = io;

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log(`✓ Client connected: ${socket.id}`);

    // Subscribe to lot updates
    socket.on('subscribe:lot', (lotId) => {
        socket.join(`lot:${lotId}`);
        console.log(`✓ Client subscribed to lot: ${lotId}`);
    });

    // Subscribe to booking updates
    socket.on('subscribe:booking', async (bookingId) => {
        try {
            const token = socket.handshake.auth?.token;
            if (typeof token !== 'string') return;
            const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
            const booking = await Booking.findOne({ bookingId, userId: decoded.userId }).select('_id');
            if (booking) socket.join(`booking:${bookingId}`);
        } catch (error) {
            console.error(`Booking subscription failed for ${socket.id}:`, error.message);
        }
    });

    // Real-time spot status request
    socket.on('request:spotStatus', (lotId) => {
        socket.emit('spot:status', { lotId, timestamp: new Date().toISOString() });
    });

    // Disconnect handler
    socket.on('disconnect', () => {
        console.log(`✗ Client disconnected: ${socket.id}`);
    });

    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

// ============================================
// Security Middleware
// ============================================

// Helmet for HTTP headers security
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            scriptSrc: ["'self'"],
            imgSrc: ["'self'", 'data:', 'https:']
        }
    },
    hsts: {
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
    }
}));

// Rate limiting middleware
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later',
    standardHeaders: true,
    legacyHeaders: false
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // limit each IP to 5 requests per windowMs
    message: 'Too many authentication attempts, please try again later',
    skipSuccessfulRequests: true
});

const paymentLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // limit each IP to 10 payment requests per minute
    message: 'Too many payment attempts, please try again later'
});

// Apply general rate limiter to all requests
app.use(generalLimiter);

// ============================================
// CORS Configuration
// ============================================

app.use(cors({
    origin: ['http://localhost:3000', 'http://localhost:5000', 'http://localhost:8080'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

// ============================================
// Body Parser Middleware
// ============================================

app.use(express.json({ limit: '10kb' })); // Limit JSON payload
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Custom middleware to log requests
app.use((req, res, next) => {
    res.on('finish', () => {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path} - ${res.statusCode}`);
    });
    next();
});

// ============================================
// Database Connection
// ============================================

let databaseReconnectTimer = null;
let isDatabaseConnecting = false;
let isDatabaseInitialized = false;
let databaseInitializationError = 'Database connection is unavailable';

const scheduleDatabaseReconnect = () => {
    if (databaseReconnectTimer || isDatabaseConnecting || mongoose.connection.readyState === 1) return;
    databaseReconnectTimer = setTimeout(() => {
        databaseReconnectTimer = null;
        connectDB();
    }, 5000);
};

const connectDB = async () => {
    if (isDatabaseConnecting || mongoose.connection.readyState === 1) return;
    isDatabaseConnecting = true;
    isDatabaseInitialized = false;

    try {
        const mongoURI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartparking';
        
        await mongoose.connect(mongoURI, {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
        });

        console.log('✓ MongoDB Connected Successfully');
        if (process.env.NODE_ENV !== 'production') {
            for (const lotData of defaultLots) {
                const existingLot = await ParkingLot.findOne({ lotId: lotData.lotId });
                if (existingLot) {
                    const [bookedHigherSpot, blockedHigherSpot] = await Promise.all([
                        Booking.exists({
                            lotId: existingLot._id,
                            spotNumber: { $gt: lotData.totalSpots },
                            status: { $nin: ['cancelled', 'no-show'] },
                            checkOut: { $gt: new Date() }
                        }),
                        ParkingSpot.exists({
                            lotId: existingLot._id,
                            spotNumber: { $gt: lotData.totalSpots },
                            status: { $ne: 'available' }
                        })
                    ]);
                    if (bookedHigherSpot || blockedHigherSpot) {
                        throw new Error(
                            `Cannot reduce ${lotData.lotId} to ${lotData.totalSpots} slots: a higher-numbered slot is booked or unavailable. Resolve those reservations/slot statuses, then restart.`
                        );
                    }
                }

                const { totalSpots, coordinates, ...lotDefaults } = lotData;
                const lot = await ParkingLot.findOneAndUpdate(
                    { lotId: lotData.lotId },
                    {
                        $set: {
                            totalSpots,
                            availableSpots: totalSpots,
                            coordinates
                        },
                        $setOnInsert: lotDefaults
                    },
                    { new: true, upsert: true, setDefaultsOnInsert: true }
                );
                await ParkingSpot.bulkWrite(Array.from({ length: lot.totalSpots }, (_, index) => ({
                    updateOne: {
                        filter: { lotId: lot._id, spotNumber: index + 1 },
                        update: { $setOnInsert: { status: 'available' } },
                        upsert: true
                    }
                })));
                await ParkingSpot.deleteMany({
                    lotId: lot._id,
                    spotNumber: { $gt: lot.totalSpots }
                });
            }
            const totalSeedSlots = defaultLots.reduce((total, lot) => total + lot.totalSpots, 0);
            console.log(`✓ Development parking facilities and ${totalSeedSlots} slots are ready`);
        }
        isDatabaseInitialized = true;
        databaseInitializationError = '';
    } catch (error) {
        databaseInitializationError = error.message;
        console.error('✗ Database initialization failed:', error.message);
    } finally {
        isDatabaseConnecting = false;
        scheduleDatabaseReconnect();
    }
};

connectDB();

// Monitor database connection
mongoose.connection.on('disconnected', () => {
    isDatabaseInitialized = false;
    databaseInitializationError = 'Database connection is unavailable';
    console.error('⚠  MongoDB Disconnected');
    scheduleDatabaseReconnect();
});

// ============================================
// Routes
// ============================================

// Health Check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'SUCCESS',
        message: 'Smart Parking API is running',
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        initialized: isDatabaseInitialized,
        initializationError: databaseInitializationError || undefined,
        activeConnections: io.engine.clientsCount,
        timestamp: new Date().toISOString()
    });
});

app.get('/api/ready', (req, res) => {
    const applicationReady = mongoose.connection.readyState === 1 && isDatabaseInitialized;
    res.status(applicationReady ? 200 : 503).json({
        status: applicationReady ? 'SUCCESS' : 'ERROR',
        ready: applicationReady,
        database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        message: applicationReady
            ? 'Smart Parking API is ready'
            : databaseInitializationError || 'Database connection is unavailable'
    });
});

app.use('/api', (req, res, next) => {
    if (mongoose.connection.readyState !== 1 || !isDatabaseInitialized) {
        return res.status(503).json({
            status: 'ERROR',
            message: databaseInitializationError || 'Database connection is unavailable. Please try again shortly.',
            code: mongoose.connection.readyState === 1 ? 'DATABASE_INITIALIZATION_FAILED' : 'DATABASE_UNAVAILABLE'
        });
    }
    next();
});

// Route Modules
const parkingLotsRoutes = require('./routes/parkingLots');
const bookingsRoutes = require('./routes/bookings');
const paymentsRoutes = require('./routes/payments');
const usersRoutes = require('./routes/users');
const adminRoutes = require('./routes/admin');

// Parking Lots API
app.use('/api/lots', parkingLotsRoutes);

// Bookings API
app.use('/api/bookings', bookingsRoutes);

// Payments API - with stricter rate limiting
app.use('/api/payments', paymentLimiter, paymentsRoutes);

// Users API - with auth rate limiting
app.use('/api/users', authLimiter, usersRoutes);

// Admin API
app.use('/api/admin', adminRoutes);

// ============================================
// Error Handling
// ============================================

// IMPORTANT: This error handler must be the last middleware
app.use((err, req, res, next) => {
    console.error('Error Stack:', err.stack);
    
    const status = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    // Don't expose sensitive error details in production
    const errorResponse = {
        status: 'ERROR',
        message: message,
        code: err.code || 'SERVER_ERROR'
    };
    
    if (process.env.NODE_ENV === 'development') {
        errorResponse.details = err;
    }
    
    res.status(status).json(errorResponse);
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        status: 'ERROR',
        message: 'Route not found: ' + req.originalUrl,
        code: 'NOT_FOUND'
    });
});

// ============================================
// Server Start
// ============================================

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`
    ╔═══════════════════════════════════════╗
    ║  🅿️  Smart Parking Backend Started     ║
    ║  🔧 Port: ${PORT}                          ║
    ║  🔐 Security: Enhanced               ║
    ║  ⚡ Real-time: WebSocket Ready       ║
    ║  ✓  Ready to accept requests           ║
    ╚═══════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM signal received: closing HTTP server');
    server.close(() => {
        console.log('HTTP server closed');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed');
            process.exit(0);
        });
    });
});

module.exports = app;
