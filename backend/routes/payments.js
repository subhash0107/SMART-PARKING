// ============================================
// Payments Routes (Razorpay Integration)
// Enhanced Security Features
// ============================================

const express = require('express');
const router = express.Router();
const Razorpay = require('razorpay');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const Booking = require('../models/Booking');
const authMiddleware = require('../middleware/auth');

// Initialize Razorpay
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'TEST_KEY',
    key_secret: process.env.RAZORPAY_SECRET || 'TEST_SECRET'
});

// In-memory storage for idempotency and rate limiting (use Redis in production)
const paymentRequests = new Map();
const userPaymentAttempts = new Map();
const processedPayments = new Map();

// Rate limiting configuration
const RATE_LIMIT = {
    maxAttempts: 5,
    timeWindowMs: 60000, // 1 minute
    maxAmountPerDay: 100000, // 100,000 INR per day
    minAmountCheck: 10, // minimum 10 INR
    maxAmountCheck: 100000 // maximum 100,000 INR
};

// Helper: Track payment attempt for rate limiting
function trackPaymentAttempt(userId) {
    const now = Date.now();
    if (!userPaymentAttempts.has(userId)) {
        userPaymentAttempts.set(userId, []);
    }
    
    const attempts = userPaymentAttempts.get(userId);
    // Remove old attempts outside time window
    const validAttempts = attempts.filter(time => now - time < RATE_LIMIT.timeWindowMs);
    validAttempts.push(now);
    userPaymentAttempts.set(userId, validAttempts);
    
    return validAttempts.length;
}

// Helper: Check if user exceeded rate limit
function isRateLimited(userId) {
    const attempts = userPaymentAttempts.get(userId) || [];
    return attempts.length > RATE_LIMIT.maxAttempts;
}

// Helper: Validate payment amount
function validateAmount(amount) {
    if (amount < RATE_LIMIT.minAmountCheck) {
        return { valid: false, reason: `Minimum amount is ${RATE_LIMIT.minAmountCheck} INR` };
    }
    if (amount > RATE_LIMIT.maxAmountCheck) {
        return { valid: false, reason: `Maximum amount is ${RATE_LIMIT.maxAmountCheck} INR` };
    }
    return { valid: true };
}

// Helper: Generate secure signature
function generateSecureSignature(orderId, paymentId, timestamp) {
    const message = `${orderId}|${paymentId}|${timestamp}`;
    return crypto.createHmac('sha256', process.env.RAZORPAY_SECRET || 'TEST_SECRET')
        .update(message)
        .digest('hex');
}

// Create payment order with enhanced security
router.post('/create-order', authMiddleware, async (req, res) => {
    try {
        const { bookingId, amount, idempotencyKey } = req.body;
        const uniqueIdempotencyKey = idempotencyKey || uuidv4();
        
        // Validation
        if (!bookingId || !amount) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Missing required fields: bookingId, amount',
                code: 'INVALID_REQUEST'
            });
        }

        // Check if request was already processed (idempotency)
        if (paymentRequests.has(uniqueIdempotencyKey)) {
            return res.status(200).json({
                status: 'SUCCESS',
                message: 'Order already created (idempotent response)',
                data: paymentRequests.get(uniqueIdempotencyKey),
                cached: true
            });
        }

        // Rate limiting check
        const attemptCount = trackPaymentAttempt(req.userId);
        if (isRateLimited(req.userId)) {
            return res.status(429).json({
                status: 'ERROR',
                message: `Too many payment attempts. Maximum ${RATE_LIMIT.maxAttempts} attempts per minute allowed`,
                code: 'RATE_LIMITED',
                retryAfter: RATE_LIMIT.timeWindowMs / 1000
            });
        }

        // Validate amount
        const amountValidation = validateAmount(amount);
        if (!amountValidation.valid) {
            return res.status(400).json({
                status: 'ERROR',
                message: amountValidation.reason,
                code: 'INVALID_AMOUNT'
            });
        }

        // Verify booking exists and belongs to user
        const booking = await Booking.findOne({ bookingId: bookingId, userId: req.userId });
        if (!booking) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Booking not found or does not belong to this user',
                code: 'BOOKING_NOT_FOUND'
            });
        }

        // Check if payment already completed
        if (booking.paymentDetails.paymentStatus === 'completed') {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Payment for this booking already completed',
                code: 'PAYMENT_ALREADY_COMPLETED'
            });
        }

        // Amount verification - ensure amount matches booking
        if (Math.abs(amount - booking.paymentDetails.totalAmount) > 1) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Payment amount does not match booking amount',
                code: 'AMOUNT_MISMATCH',
                expectedAmount: booking.paymentDetails.totalAmount
            });
        }

        // Create Razorpay order with enhanced details
        const timestamp = Date.now();
        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency: 'INR',
            receipt: `${bookingId}-${timestamp}`,
            payment_capture: 1, // Auto-capture
            timeout: 900, // 15 minutes timeout
            notes: {
                bookingId: bookingId,
                userId: req.userId,
                createdAt: new Date().toISOString(),
                idempotencyKey: uniqueIdempotencyKey
            }
        };
        
        const order = await razorpay.orders.create(options);
        
        // Generate secure token for frontend verification
        const secureToken = generateSecureSignature(order.id, bookingId, timestamp);

        // Update booking with order ID
        await Booking.findOneAndUpdate(
            { bookingId: bookingId },
            {
                'paymentDetails.orderId': order.id,
                'paymentDetails.paymentStatus': 'pending',
                'paymentDetails.secureToken': secureToken,
                'paymentDetails.orderCreatedAt': new Date(),
                'paymentDetails.idempotencyKey': uniqueIdempotencyKey
            }
        );
        
        const responseData = {
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            keyId: process.env.RAZORPAY_KEY_ID,
            secureToken: secureToken,
            timestamp: timestamp,
            expiresIn: 900
        };

        // Cache the response for idempotency
        paymentRequests.set(uniqueIdempotencyKey, responseData);

        res.json({
            status: 'SUCCESS',
            message: 'Order created successfully',
            data: responseData,
            idempotencyKey: uniqueIdempotencyKey
        });
    } catch (error) {
        console.error('Payment creation error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Failed to create order',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Verify payment with enhanced security
router.post('/verify', authMiddleware, async (req, res) => {
    try {
        const { orderId, paymentId, signature } = req.body;
        
        if (!orderId || !paymentId || !signature) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'Missing required verification fields',
                code: 'INVALID_VERIFICATION'
            });
        }

        // Prevent duplicate payment processing
        const duplicateKey = `${orderId}-${paymentId}`;
        if (processedPayments.has(duplicateKey)) {
            return res.status(400).json({
                status: 'ERROR',
                message: 'This payment has already been processed',
                code: 'DUPLICATE_PAYMENT'
            });
        }

        // Verify signature - critical security measure
        const text = orderId + '|' + paymentId;
        const generated_signature = crypto
            .createHmac('sha256', process.env.RAZORPAY_SECRET || 'TEST_SECRET')
            .update(text)
            .digest('hex');
        
        if (generated_signature !== signature) {
            console.warn(`Payment verification failed for order ${orderId}`);
            return res.status(400).json({
                status: 'ERROR',
                message: 'Payment verification failed - Invalid signature',
                code: 'SIGNATURE_MISMATCH'
            });
        }

        // Fetch payment details from Razorpay for additional verification
        const payment = await razorpay.payments.fetch(paymentId);
        
        if (payment.status !== 'captured') {
            return res.status(400).json({
                status: 'ERROR',
                message: `Payment status is ${payment.status}, expected captured`,
                code: 'INVALID_PAYMENT_STATUS'
            });
        }

        // Verify payment belongs to the order
        if (payment.order_id !== orderId) {
            console.error(`Payment order mismatch: expected ${orderId}, got ${payment.order_id}`);
            return res.status(400).json({
                status: 'ERROR',
                message: 'Payment order mismatch - security validation failed',
                code: 'ORDER_MISMATCH'
            });
        }

        // Update booking with payment details
        const booking = await Booking.findOneAndUpdate(
            { 'paymentDetails.orderId': orderId, userId: req.userId },
            {
                'paymentDetails.transactionId': paymentId,
                'paymentDetails.signature': signature,
                'paymentDetails.paymentStatus': 'completed',
                'paymentDetails.paidAt': new Date(),
                'paymentDetails.razorpayPaymentId': paymentId,
                'paymentDetails.razorpayOrderId': orderId,
                status: 'confirmed'
            },
            { new: true }
        );
        
        if (!booking) {
            return res.status(404).json({
                status: 'ERROR',
                message: 'Booking not found',
                code: 'BOOKING_NOT_FOUND'
            });
        }

        global.io?.to(`booking:${booking.bookingId}`).emit('payment:confirmed', {
            bookingId: booking.bookingId,
            orderId,
            paymentId
        });
        global.io?.to(`booking:${booking.bookingId}`).emit('booking:updated', {
            bookingId: booking.bookingId,
            status: booking.status,
            updatedAt: new Date().toISOString()
        });

        // Mark payment as processed
        processedPayments.set(duplicateKey, { timestamp: Date.now(), bookingId: booking.bookingId });

        res.json({
            status: 'SUCCESS',
            message: 'Payment verified successfully',
            data: {
                bookingId: booking.bookingId,
                paymentStatus: booking.paymentDetails.paymentStatus,
                bookingStatus: booking.status,
                transactionId: paymentId,
                paidAt: booking.paymentDetails.paidAt
            }
        });
    } catch (error) {
        console.error('Payment verification error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Payment verification error',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Get payment status with security checks
router.get('/status/:orderId', authMiddleware, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        // Verify order belongs to authenticated user
        const booking = await Booking.findOne(
            { 'paymentDetails.orderId': orderId, userId: req.userId }
        );
        
        if (!booking) {
            return res.status(403).json({
                status: 'ERROR',
                message: 'Unauthorized access to payment status',
                code: 'UNAUTHORIZED'
            });
        }
        
        // Fetch order details from Razorpay
        const order = await razorpay.orders.fetch(orderId);
        
        res.json({
            status: 'SUCCESS',
            data: {
                orderId: order.id,
                paymentStatus: order.status,
                amount: order.amount / 100, // Convert from paise
                currency: order.currency,
                createdAt: new Date(order.created_at * 1000),
                attempts: order.attempts,
                bookingStatus: booking.status
            }
        });
    } catch (error) {
        console.error('Payment status fetch error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Failed to fetch payment status',
            error: error.message,
            code: 'SERVER_ERROR'
        });
    }
});

// Razorpay Webhook Verification (for real-time payment updates)
router.post('/webhook/razorpay', async (req, res) => {
    try {
        const { event, payload } = req.body;
        
        // Verify webhook signature
        const shasum = crypto.createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || 'TEST_SECRET');
        shasum.update(JSON.stringify(req.body));
        const digest = shasum.digest('hex');
        
        const xRazorpaySignature = req.headers['x-razorpay-signature'];
        if (digest !== xRazorpaySignature) {
            return res.status(401).json({
                status: 'ERROR',
                message: 'Webhook signature verification failed'
            });
        }

        // Handle different payment events
        if (event === 'payment.authorized' || event === 'payment.captured') {
            const orderId = payload.payment.entity.order_id;
            const paymentId = payload.payment.entity.id;
            
            const booking = await Booking.findOneAndUpdate(
                { 'paymentDetails.orderId': orderId },
                {
                    'paymentDetails.transactionId': paymentId,
                    'paymentDetails.paymentStatus': 'completed',
                    'paymentDetails.paidAt': new Date(),
                    status: 'confirmed'
                },
                { new: true }
            );

            if (global.io && booking) {
                global.io.to(`booking:${booking.bookingId}`).emit('payment:confirmed', {
                    bookingId: booking.bookingId,
                    orderId,
                    paymentId
                });
                global.io.to(`booking:${booking.bookingId}`).emit('booking:updated', {
                    bookingId: booking.bookingId,
                    status: booking.status,
                    updatedAt: new Date().toISOString()
                });
            }
        } else if (event === 'payment.failed') {
            const orderId = payload.payment.entity.order_id;
            
            const booking = await Booking.findOneAndUpdate(
                { 'paymentDetails.orderId': orderId },
                { 'paymentDetails.paymentStatus': 'failed' },
                { new: true }
            );

            if (global.io && booking) {
                global.io.to(`booking:${booking.bookingId}`).emit('payment:failed', {
                    bookingId: booking.bookingId,
                    orderId
                });
            }
        }

        res.json({ status: 'SUCCESS', message: 'Webhook processed' });
    } catch (error) {
        console.error('Webhook error:', error);
        res.status(500).json({
            status: 'ERROR',
            message: 'Webhook processing failed'
        });
    }
});

// Get payment history with security
router.get('/history/:userId', authMiddleware, async (req, res) => {
    try {
        // Verify user is accessing their own history
        if (req.params.userId !== req.userId) {
            return res.status(403).json({
                status: 'ERROR',
                message: 'Unauthorized access',
                code: 'UNAUTHORIZED'
            });
        }

        const bookings = await Booking.find({ userId: req.userId })
            .select('bookingId paymentDetails.totalAmount paymentDetails.paymentStatus paymentDetails.paidAt createdAt')
            .sort({ 'paymentDetails.paidAt': -1 })
            .limit(50);

        res.json({
            status: 'SUCCESS',
            data: bookings,
            count: bookings.length
        });
    } catch (error) {
        res.status(500).json({
            status: 'ERROR',
            message: 'Failed to fetch payment history',
            error: error.message
        });
    }
});

module.exports = router;
