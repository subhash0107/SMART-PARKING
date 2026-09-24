# Backend Environment Configuration

## Production Environment Variables

Copy this to your `.env` file in the `/backend` directory:

```
# Server Configuration
PORT=5000
NODE_ENV=production

# Database
MONGODB_URI=mongodb://localhost:27017/smartparking

# Razorpay Payment Gateway
RAZORPAY_KEY_ID=your_razorpay_key_id_here
RAZORPAY_SECRET=your_razorpay_key_secret_here
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_here

# CORS Origins (comma-separated)
CORS_ORIGIN=http://localhost:3000,http://localhost:5000

# JWT Secret
JWT_SECRET=your_super_secret_jwt_key_change_this_in_production

# Email Service
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password

# Session
SESSION_SECRET=your_session_secret_here

# Feature Flags
ENABLE_REAL_TIME=true
ENABLE_WEBHOOKS=true
ENABLE_RATE_LIMITING=true
```

## Development Environment Variables

```
# Server Configuration
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/smartparking

# Razorpay (Use Test Keys)
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxxx
RAZORPAY_SECRET=test_secret_xxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=webhook_secret_test

# CORS
CORS_ORIGIN=http://localhost:3000,http://localhost:5000,http://localhost:8080

# JWT
JWT_SECRET=dev_secret_key_change_in_production

# Email (Optional for development)
EMAIL_SERVICE=gmail
EMAIL_USER=test@example.com
EMAIL_PASSWORD=test_password

# Session
SESSION_SECRET=dev_session_secret

# Feature Flags
ENABLE_REAL_TIME=true
ENABLE_WEBHOOKS=true
ENABLE_RATE_LIMITING=true
ENABLE_DEBUG_LOGS=true
```

## Razorpay Setup

### Getting Razorpay Keys

1. **Create Account**: Go to https://razorpay.com
2. **Sign Up**: Register with your email and business details
3. **Get Test Keys**: 
   - Dashboard → Settings → API Keys
   - Copy Test Key ID and Test Key Secret
4. **Get Webhook Secret**:
   - Dashboard → Settings → Webhooks
   - Add webhook endpoint: `https://your-domain.com/api/payments/webhook/razorpay`
   - Copy Webhook Secret

### Test Payment Details

- **Card Number**: 4111 1111 1111 1111
- **Expiry**: Any future date (e.g., 12/30)
- **CVV**: Any 3 digits (e.g., 123)

## MongoDB Setup

### Local MongoDB

```bash
# Install MongoDB Community Edition
# https://docs.mongodb.com/manual/installation/

# Start MongoDB
mongod

# Create database (automatic on first write)
# Database name: smartparking
```

### MongoDB Atlas (Cloud)

```bash
# 1. Create account at https://www.mongodb.com/cloud/atlas
# 2. Create a cluster
# 3. Get connection string
# 4. Update MONGODB_URI:

MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartparking
```

## Required Ports

- **Backend API**: 5000
- **MongoDB**: 27017 (if local)
- **Frontend**: 3000 or 5000

## Verification Steps

After setting up environment variables:

```bash
# 1. Navigate to backend
cd backend

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Check health endpoint
curl http://localhost:5000/api/health

# Expected response:
# {
#   "status": "SUCCESS",
#   "message": "Smart Parking API is running",
#   "activeConnections": 0,
#   "timestamp": "2024-05-17T10:30:00Z"
# }
```

## Troubleshooting

### MongoDB Connection Error
```
Error: connect ECONNREFUSED 127.0.0.1:27017

Solution:
- Ensure MongoDB is running: `mongod`
- Check MONGODB_URI in .env
- Verify port 27017 is not blocked by firewall
```

### Razorpay Authentication Error
```
Error: Razorpay API Authentication failed

Solution:
- Double-check RAZORPAY_KEY_ID and RAZORPAY_SECRET
- Ensure using correct test/production keys
- Keys should not have spaces or special characters
```

### CORS Error
```
Error: Access to XMLHttpRequest blocked by CORS policy

Solution:
- Update CORS_ORIGIN in .env to include frontend URL
- Restart backend server after change
- Clear browser cache
```

### WebSocket Connection Failed
```
Error: Socket.IO connection failed

Solution:
- Ensure backend is running on port 5000
- Check browser console for error details
- Verify firewall allows WebSocket connections
- Update Socket.IO URL in script.js if different port
```

## Security Checklist

Before going to production:

- [ ] Change all SECRET keys
- [ ] Use HTTPS (SSL/TLS certificate)
- [ ] Set NODE_ENV=production
- [ ] Update CORS_ORIGIN to production domain
- [ ] Use production Razorpay keys
- [ ] Enable rate limiting
- [ ] Set up proper logging
- [ ] Configure daily backups for MongoDB
- [ ] Use environment-specific configurations
- [ ] Review and test all payment flows
- [ ] Set up monitoring and alerts
