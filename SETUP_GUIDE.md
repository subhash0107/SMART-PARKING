# Smart Parking System - Complete Setup & Deployment Guide

## 📋 Table of Contents
1. [System Architecture](#system-architecture)
2. [Prerequisites](#prerequisites)
3. [Frontend Setup](#frontend-setup)
4. [Backend Setup](#backend-setup)
5. [Database Configuration](#database-configuration)
6. [Payment Gateway Integration](#payment-gateway-integration)
7. [Running Locally](#running-locally)
8. [Production Deployment](#production-deployment)
9. [API Reference](#api-reference)
10. [Troubleshooting](#troubleshooting)

---

## 🏗️ System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Client (Frontend)                         │
│  HTML5 + CSS3 + Vanilla JavaScript (No frameworks)          │
│  - City & Lot Selection                                      │
│  - Parking Spot Grid                                         │
│  - Booking Calculator (with 18% GST)                         │
│  - Payment Modal (Razorpay)                                  │
│  - My Bookings Display                                       │
└────────────────────┬────────────────────────────────────────┘
                     │ REST API (HTTP/HTTPS)
                     │
┌────────────────────┴────────────────────────────────────────┐
│            Backend Server (Node.js + Express)               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  API Routes:                                         │   │
│  │  ├── /api/lots (Parking lots listing)               │   │
│  │  ├── /api/bookings (CRUD operations)                │   │
│  │  ├── /api/payments (Razorpay integration)           │   │
│  │  ├── /api/users (Auth & profile)                    │   │
│  │  └── /api/admin (Dashboard & management)            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Middleware:                                         │   │
│  │  ├── JWT Authentication                             │   │
│  │  ├── Role-Based Access Control (RBAC)              │   │
│  │  └── Error Handling                                 │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────┬────────────────────────────────────────┘
                     │ MongoDB Driver
                     │
┌────────────────────┴────────────────────────────────────────┐
│                 Database (MongoDB)                           │
│  Collections:                                                │
│  ├── users (authentication, profile, wallet)                │
│  ├── parkinglots (lot details, amenities, rates)           │
│  └── bookings (transactions, payment details)               │
└─────────────────────────────────────────────────────────────┘

Payment Gateway:
Razorpay (supports UPI, Cards, Net Banking, Wallets)
```

---

## ✅ Prerequisites

### System Requirements
```
Operating System: Windows, macOS, or Linux
RAM: Minimum 4GB
Storage: 500MB for project files
Browser: Chrome 90+, Firefox 88+, Safari 14+, Edge 90+
```

### Required Software

#### 1. Node.js & npm
Download from: https://nodejs.org/en/download/
```bash
# Verify installation
node --version   # Should be v14.0.0 or higher
npm --version    # Should be v6.0.0 or higher
```

#### 2. MongoDB
**Option A - Local Installation:**
- Download: https://www.mongodb.com/try/download/community
- Installation guides: https://docs.mongodb.com/manual/installation/

**Option B - Cloud (Recommended):**
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- Free tier: 512MB storage, perfect for development

#### 3. Git (Optional, for version control)
Download: https://git-scm.com/downloads

#### 4. Code Editor (Recommended)
- VS Code: https://code.visualstudio.com/

### Required Accounts
1. **Razorpay**: https://razorpay.com (Indian payment gateway)
2. **MongoDB Atlas**: https://www.mongodb.com/cloud/atlas (for cloud database)

---

## 🎨 Frontend Setup

### Step 1: Project Files
The frontend consists of 4 files that work together:
- `index.html` - Main HTML structure
- `styles.css` - Complete styling
- `script.js` - Application logic
- `booking-data.js` - Parking lot database

### Step 2: Open in Browser
```bash
# Option 1: Direct file open
# Windows: Double-click index.html
# macOS: Double-click index.html
# Linux: Double-click index.html or use `xdg-open index.html`

# Option 2: VS Code Live Server Extension
# 1. Install "Live Server" extension in VS Code
# 2. Right-click index.html → "Open with Live Server"
# 3. Browser opens at http://127.0.0.1:5500

# Option 3: Python HTTP Server (Windows)
# Windows Store → Search "Python" → Install
# Then in project directory:
python -m http.server 3000
# Visit http://localhost:3000

# Option 4: Python HTTP Server (macOS/Linux)
python3 -m http.server 3000
# Visit http://localhost:3000

# Option 5: Node.js HTTP Server
npx http-server -p 3000
# Visit http://localhost:3000
```

### Step 3: Frontend File Structure
```
index.html
├── Navigation Section
├── Hero Section (Parking grid visualization)
├── About Section
├── Booking Section
│   ├── Filters (City, Lot, DateTime)
│   ├── Parking Grid (12-300 spots)
│   └── Booking Summary (Cost + GST)
├── My Bookings Section
├── Payment Modal
├── Contact Section
└── Footer

Dependencies:
├── booking-data.js (Parking lots database)
└── script.js (All JavaScript logic)
```

### Step 4: Features Included
- ✅ City selection (6 Indian cities)
- ✅ Parking lot browsing
- ✅ Real-time spot availability (30-50% random)
- ✅ Booking cost calculator (with 18% GST)
- ✅ 4 payment method options
- ✅ My Bookings with status tracking
- ✅ Responsive design (mobile-optimized)
- ✅ Local storage persistence (offline capable)

---

## 🔧 Backend Setup

### Step 1: Navigate to Backend Directory
```bash
cd backend
```

### Step 2: Install Node Modules
```bash
npm install
# This installs all dependencies from package.json
```

### Step 3: Setup Environment Variables
```bash
# Copy template file
cp .env.example .env

# Edit .env with your configuration
# Windows: Open .env with Notepad
# macOS/Linux: nano .env
```

### Step 4: Environment Variables Configuration

#### Minimal Setup (Development)
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smartparking
JWT_SECRET=your-super-secret-jwt-key-min-32-chars
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_SECRET=your_razorpay_test_secret
```

#### Full Setup (Production-Ready)
```env
# ============================================
# Server Configuration
# ============================================
NODE_ENV=production
PORT=5000
LOG_LEVEL=info

# ============================================
# Database Configuration
# ============================================
# Local: mongodb://localhost:27017/smartparking
# Atlas: mongodb+srv://user:pass@cluster.mongodb.net/smartparking
MONGODB_URI=mongodb+srv://your-username:your-password@your-cluster.mongodb.net/smartparking

# ============================================
# JWT Configuration
# ============================================
JWT_SECRET=generate-with-node-e-console.log-require-crypto-randomBytes-32-toString-hex
JWT_EXPIRE=30d

# ============================================
# Razorpay (Indian Payment Gateway)
# ============================================
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_SECRET=your_razorpay_secret_key

# ============================================
# CORS Settings
# ============================================
FRONTEND_URL=http://localhost:3000
ADMIN_PORTAL_URL=http://localhost:3001

# ============================================
# Email Configuration (Optional)
# ============================================
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password
EMAIL_FROM=Smart Parking <noreply@smartparking.com>
```

### Step 5: Backend File Structure
```
backend/
├── server.js                          # Express app initialization
├── package.json                       # Dependencies & scripts
├── .env.example                       # Template (copy to .env)
├── models/                            # MongoDB Schemas
│   ├── User.js                        # User: auth, profile, wallet
│   ├── ParkingLot.js                  # ParkingLot: details, amenities
│   └── Booking.js                     # Booking: transactions & payments
├── middleware/                        # Express Middleware
│   ├── auth.js                        # JWT verification
│   └── adminAuth.js                   # Role-based access control
└── routes/                            # API Endpoints
    ├── users.js                       # Register, Login, Profile
    ├── parkingLots.js                 # Browse & check availability
    ├── bookings.js                    # Create, read, cancel bookings
    ├── payments.js                    # Razorpay integration
    └── admin.js                       # Dashboard & management
```

### Step 6: Database Collections Auto-Created
When backend starts, MongoDB automatically creates:

**users Collection**
- Stores user accounts with hashed passwords
- Fields: email, password, name, phone, walletBalance, totalBookings
- Indexes: email (unique), createdAt

**parkinglots Collection**
- Stores parking lot information for 6 Indian cities
- Fields: lotId, name, city, address, totalSpots, ratePerHour, amenities
- Indexes: city, status

**bookings Collection**
- Stores all booking transactions
- Fields: bookingId, userId, lotId, checkIn, checkOut, paymentDetails
- Indexes: userId, bookingId, transactionId

### Step 7: npm Scripts

In `backend/package.json`, the following scripts are available:
```json
{
  "scripts": {
    "start": "node server.js",              // Production start
    "dev": "nodemon server.js",             // Development with auto-reload
    "test": "npm run test"                  // Run tests (if configured)
  }
}
```

---

## 💾 Database Configuration

### Option 1: Local MongoDB

#### Windows
1. Download MongoDB Community from https://www.mongodb.com/try/download/community
2. Run the installer
3. Choose "Run as a Service" during installation
4. Verify installation:
```bash
# MongoDB should be running as a service
# In PowerShell:
Get-Service MongoDB

# Test connection:
mongosh
# Should connect to mongodb://localhost:27017
```

#### macOS
```bash
# Install with Homebrew
brew tap mongodb/brew
brew install mongodb-community

# Start MongoDB
brew services start mongodb-community

# Verify connection
mongosh
```

#### Linux (Ubuntu)
```bash
# Import MongoDB GPG key
wget -qO - https://www.mongodb.org/static/pgp/server-5.0.asc | sudo apt-key add -

# Add MongoDB repository
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/5.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-5.0.list

# Install MongoDB
sudo apt-get update
sudo apt-get install -y mongodb-org

# Start MongoDB
sudo systemctl start mongod

# Verify
mongosh
```

### Option 2: MongoDB Atlas (Cloud - Recommended)

#### Step 1: Create Account
1. Go to https://www.mongodb.com/cloud/atlas
2. Click "Sign Up"
3. Fill in details and verify email

#### Step 2: Create Cluster
1. Create a project named "Smart Parking"
2. Click "Build a Cluster"
3. Choose "Shared Clusters" (Free tier)
4. Select region (choose closest to India: Mumbai, Singapore, or Sydney)
5. Click "Create Cluster"

#### Step 3: Create Database User
1. Go to "Database Access"
2. Click "Add New Database User"
3. Enter username: `smartparkinguser`
4. Generate password: Use "Autogenerate Secure Password"
5. Click "Create Database User"
6. Save credentials securely

#### Step 4: Configure Network Access
1. Go to "Network Access"
2. Click "Add IP Address"
3. Choose "Allow access from anywhere" (for development)
4. For production, add specific IP addresses
5. Click "Confirm"

#### Step 5: Get Connection String
1. Go to "Clusters"
2. Click "Connect"
3. Choose "Connect your application"
4. Copy connection string:
```
mongodb+srv://smartparkinguser:PASSWORD@cluster0.mongodb.net/smartparking?retryWrites=true&w=majority
```
5. Replace `PASSWORD` with your actual password
6. Add to .env:
```env
MONGODB_URI=mongodb+srv://smartparkinguser:passw0rd@cluster0.mongodb.net/smartparking
```

---

## 💳 Payment Gateway Integration

### Razorpay Setup (Indian Payment Processing)

#### Step 1: Create Razorpay Account
1. Go to https://razorpay.com
2. Click "Sign Up"
3. Choose "Business" account type
4. Enter business details
5. Verify phone and email
6. Complete KYC for live payments

#### Step 2: Get API Keys
1. Go to Settings → API Keys
2. Copy **Key ID** (starts with `rzp_live_` or `rzp_test_`)
3. Copy **Key Secret** (keep this secret!)
4. Add to .env:
```env
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_SECRET=your_secret_key_here
```

#### Step 3: Test Payment Integration
- **Test Mode**: Use keys starting with `rzp_test_`
- **Live Mode**: Use keys starting with `rzp_live_` (after verification)

**Test Credit Cards:**
- Visa: 4111 1111 1111 1111
- Mastercard: 5555 5555 5555 4444
- Expiry: Any future date
- CVV: Any 3 digits

#### Step 4: Payment Methods Supported
- 💳 Credit/Debit Cards (Visa, Mastercard, RuPay)
- 📱 UPI (Google Pay, PhonePe, Paytm, WhatsApp Pay)
- 🏦 Net Banking (All major Indian banks)
- 💰 Digital Wallets (Paytm, Mobikwik, Amazon Pay)

---

## 🚀 Running Locally

### Terminal 1: Start MongoDB (if using local MongoDB)
```bash
# Windows (MongoDB should auto-start as service)
# Verify it's running:
netstat -ano | findstr :27017

# macOS
brew services start mongodb-community

# Linux
sudo systemctl start mongod
```

### Terminal 2: Start Backend Server
```bash
cd backend
npm install          # First time only
npm start           # Starts on http://localhost:5000
```

### Terminal 3: Start Frontend
```bash
# Option 1: Open index.html directly in browser
# Option 2: Use Live Server extension in VS Code
# Option 3: Run HTTP server:
python -m http.server 3000    # Windows
# or
python3 -m http.server 3000   # macOS/Linux
# Then visit http://localhost:3000
```

### Verify Everything Is Running

**Backend Health Check:**
```bash
# In another terminal
curl http://localhost:5000/api/health

# Expected response:
# { "status": "SUCCESS", "message": "Smart Parking API is running" }
```

**Frontend Check:**
- Open browser to http://localhost:3000 (or file:///path/to/index.html)
- Should see parking booking interface
- Try booking a parking spot

---

## 📦 Production Deployment

### Backend Deployment Options

#### Option 1: Heroku (Easiest)
```bash
# 1. Install Heroku CLI
# Windows: Download from https://devcenter.heroku.com/articles/heroku-cli
# macOS: brew tap heroku/brew && brew install heroku
# Linux: curl https://cli-assets.heroku.com/install.sh | sh

# 2. Login
heroku login

# 3. Create Heroku App
heroku create smart-parking-api

# 4. Set environment variables
heroku config:set NODE_ENV=production
heroku config:set MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/smartparking
heroku config:set JWT_SECRET=your-generated-secret
heroku config:set RAZORPAY_KEY_ID=rzp_live_XXXXXXXXXX
heroku config:set RAZORPAY_SECRET=your_live_secret_key

# 5. Deploy
git push heroku main

# 6. View logs
heroku logs --tail
```

#### Option 2: AWS EC2
```bash
# 1. Launch EC2 Ubuntu Instance
# Choose: Ubuntu 20.04 LTS, t2.micro (free tier)

# 2. Connect via SSH
ssh -i your-key.pem ubuntu@your-ec2-ip

# 3. Install Node.js
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs

# 4. Install MongoDB (or use MongoDB Atlas)
sudo apt-get install -y mongodb

# 5. Clone your code
git clone <your-repository-url>

# 6. Setup environment
cd Smart\ Parking/backend
npm install
cp .env.example .env
# Edit .env with production values

# 7. Install PM2 for process management
sudo npm install -g pm2
pm2 start server.js --name "smart-parking"
pm2 startup
pm2 save

# 8. Setup Nginx as reverse proxy
sudo apt-get install -y nginx
# Configure /etc/nginx/sites-available/default
# Proxy to localhost:5000
```

#### Option 3: DigitalOcean
```bash
# 1. Create Droplet (Ubuntu 20.04)
# 2. SSH into droplet
ssh root@your-droplet-ip

# 3. Install Node.js, MongoDB, Git
curl -fsSL https://deb.nodesource.com/setup_16.x | sudo -E bash -
sudo apt-get install -y nodejs mongodb git

# 4. Clone and setup (same as AWS)
# 5. Use PM2 for process management
# 6. Setup SSL with Let's Encrypt + Nginx
```

### Frontend Deployment Options

#### Option 1: Netlify
```bash
# 1. Install Netlify CLI
npm install -g netlify-cli

# 2. Build (no build step needed for vanilla JS)
# 3. Deploy
netlify deploy --prod --dir=.

# Frontend will be at: https://your-project.netlify.app
```

#### Option 2: Vercel
```bash
# 1. Install Vercel CLI
npm install -g vercel

# 2. Deploy
vercel --prod

# Frontend will be at: https://your-project.vercel.app
```

#### Option 3: GitHub Pages
```bash
# 1. Push to GitHub
git push origin main

# 2. Enable Pages in Settings → Pages
# 3. Select 'main' branch as source
# 4. Site published at: https://your-username.github.io/smart-parking

# Important: Change API URL in script.js to your production backend
```

---

## 📡 API Reference

### Base URL
- Development: `http://localhost:5000`
- Production: `https://your-api.herokuapp.com` (or your domain)

### Health Check
```http
GET /api/health
```

### Users API
```http
# Register
POST /api/users/register
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePassword123"
}

# Login
POST /api/users/login
{
  "email": "john@example.com",
  "password": "SecurePassword123"
}

# Get Profile (Requires JWT Token)
GET /api/users/profile
Authorization: Bearer <JWT_TOKEN>
```

### Parking Lots API
```http
# Get all lots by city (supported: Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa)
GET /api/lots?city=Vizag

# Get specific lot
GET /api/lots/VZ001

# Check availability
GET /api/lots/VZ001/availability
```

### Bookings API
```http
# Create booking
POST /api/bookings
Authorization: Bearer <JWT_TOKEN>
{
  "lotId": "VZ001",
  "spotNumber": "SPOT-001",
  "checkIn": "2024-04-15T10:00:00Z",
  "checkOut": "2024-04-15T14:00:00Z",
  "vehicleNumber": "AP01AB1234",
  "vehicleType": "sedan",
  "paymentMethod": "razorpay"
}

# Get user's bookings
GET /api/bookings/user/USER_ID
Authorization: Bearer <JWT_TOKEN>

# Cancel booking
DELETE /api/bookings/BOOKING_ID
Authorization: Bearer <JWT_TOKEN>
```

### Payments API  
```http
# Create Razorpay order
POST /api/payments/create-order
Authorization: Bearer <JWT_TOKEN>
{
  "bookingId": "PARK123456",
  "amount": 500
}

# Verify payment
POST /api/payments/verify
{
  "orderId": "order_123",
  "paymentId": "pay_123",
  "signature": "signature_hash"
}
```

### Admin API (Admin Auth Required)
```http
# Get dashboard stats
GET /api/admin/stats

# Get all bookings
GET /api/admin/bookings?status=completed&page=1

# Create parking lot
POST /api/admin/lots
{
  "lotId": "KDP001",
  "name": "Gandikota Fort",
  "city": "Kadapa",
  "address": "Fort, Kadapa",
  "totalSpots": 15,
  "ratePerHour": 10
}

# Update parking lot
PUT /api/admin/lots/KDP001
{
  "ratePerHour": 12,
  "status": "active"
}
```

---

## 🐛 Troubleshooting

### Backend Issues

#### "Port 5000 is already in use"
```bash
# Windows
netstat -ano | findstr :5000
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :5000
kill -9 <PID>

# Then change PORT in .env
PORT=5001
```

#### "MongoDB connection failed"
```bash
# Check if MongoDB is running
# Windows: Services → MongoDB
# macOS: brew services list
# Linux: systemctl status mongod

# Verify Atlas connection string
# Username and password should not contain special chars (URL encode if needed)
# IP must be whitelisted in Atlas
```

#### "JWT token invalid/expired"
- Token expires after 30 days
- User needs to login again to get new token
- Check JWT_SECRET in .env matches front and backend

#### "CORS error"
```javascript
// Update server.js CORS configuration
cors({
    origin: ['http://localhost:3000', 'https://your-frontend.com'],
    credentials: true
})
```

### Frontend Issues

#### "API calls not working"
1. Open browser DevTools (F12)
2. Go to Network tab
3. Check if requests reach the backend
4. Check CORS errors in Console
5. Verify backend is running: `http://localhost:5000/api/health`

#### "Booking not saving"
- Check browser LocalStorage is enabled
- Open DevTools → Application → LocalStorage
- Verify data is being stored

#### "Payment modal not appearing"
1. Check if Razorpay script is loaded
2. Verify RAZORPAY_KEY_ID in script.js
3. Check browser console for errors

### Database Issues

#### "Collections not created"
- MongoDB should auto-create collections on first use
- If not, manually create them:
```javascript
// Connect to MongoDB
mongosh

// Select database
use smartparking

// Create collections
db.createCollection("users")
db.createCollection("parkinglots")
db.createCollection("bookings")
```

#### "Out of storage space (MongoDB Atlas)"
- Free tier has 512MB limit
- Delete old bookings or upgrade plan
- Or switch to local MongoDB for development

---

## 📚 Additional Resources

- **Express.js**: https://expressjs.com
- **MongoDB Docs**: https://docs.mongodb.com
- **Mongoose ODM**: https://mongoosejs.com
- **Razorpay Integration**: https://razorpay.com/docs
- **JWT Authentication**: https://jwt.io
- **Heroku Deployment**: https://devcenter.heroku.com

---

## 🎓 Next Steps (Advanced Features)

1. **Real-time Updates**: Add WebSocket (Socket.io) for live spot availability
2. **Email Notifications**: Setup Nodemailer for booking confirmations
3. **SMS OTP**: Add Twilio for phone verification
4. **Admin Dashboard**: Create React/Vue admin panel
5. **Analytics**: Implement revenue and occupancy reports
6. **Mobile App**: Build React Native or Flutter app
7. **QR Codes**: Generate QR codes for entry/exit
8. **Machine Learning**: Predict occupancy patterns

---

**Last Updated**: 2024  
**Version**: 1.0.0  
**Support**: For issues, check browser console and server logs first
