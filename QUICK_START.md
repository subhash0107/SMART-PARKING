# Smart Parking - Quick Start Guide ⚡

Get the Smart Parking System running in 10 minutes!

## 🎯 Prerequisites Check
```bash
# Verify installations
node --version      # Should be v14+
npm --version       # Should be v6+

# MongoDB options:
# - Local: mongod (should be running)
# - Cloud: MongoDB Atlas account created with connection string
```

## 1️⃣ Quick Setup (Fastest Way with Docker)

If you have **Docker** installed:
```bash
# Navigate to project root
cd "Smart Parking"

# Start everything (MongoDB + Backend)
docker-compose up

# Backend runs on http://localhost:5000
# Frontend: Open index.html in browser
```

Skip to step 4️⃣ if using Docker.

---

## 2️⃣ Manual Backend Setup

### A. Install & Configure
```bash
cd backend
npm install
cp .env.example .env
```

### B. Edit `.env` File

**Minimal Setup (First-Time):**
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/smartparking
JWT_SECRET=your-secret-key-min-32-chars-long-here
RAZORPAY_KEY_ID=rzp_test_XXXXXXXXXX
RAZORPAY_SECRET=test_secret_here
```

**Get Free Test Razorpay Keys:**
- Sign up at https://razorpay.com
- Test keys start with `rzp_test_`

### C. Start Backend
```bash
npm start
# ✓ Runs on http://localhost:5000
```

---

## 3️⃣ Database Setup

**Option 1: Local MongoDB** (Recommended for Development)
```bash
# Windows: Service should auto-start
# macOS: brew services start mongodb-community
# Linux: sudo systemctl start mongod

# Verify connection:
mongosh
# Should show: test>
# Press Ctrl+C to exit
```

**Option 2: MongoDB Atlas** (Cloud)
1. Create account: https://www.mongodb.com/cloud/atlas
2. Create free cluster
3. Get connection string
4. Update `.env`:
```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/smartparking
```

---

## 4️⃣ Frontend Setup

### Open in Browser
```bash
# Option 1: Direct open (Simplest)
# Double-click: index.html

# Option 2: VS Code Live Server (Recommended)
# Install extension: "Live Server"
# Right-click index.html → "Open with Live Server"
# Opens at http://127.0.0.1:5500

# Option 3: Python Server (if Python installed)
# In project root:
python -m http.server 3000   # Windows
python3 -m http.server 3000  # macOS/Linux
# Visit: http://localhost:3000
```

---

## 5️⃣ Test Everything ✅

### Backend Health
```bash
# In another terminal
curl http://localhost:5000/api/health

# Should return:
# { "status": "SUCCESS", "message": "Smart Parking API is running" }
```

### Frontend Check
- Open browser to your frontend URL
- Select city (Vizag, Ongole, Tirupati, Vijayawada, Guntur, Kadapa)
- Select parking lot
- Set check-in/out time
- Click "Search Parking"
- Should see parking spots grid

### Test Booking Flow
1. Click available spot (green)
2. View cost calculation (includes 18% GST)
3. Click "Book Now"
4. Choose payment method
5. Click "Complete Booking"
6. Check "My Bookings" section

---

## 🎵 All Running? Here's What You Got:

✅ **Frontend**: HTML5 + CSS3 + Vanilla JavaScript
- Real-time parking booking interface
- City & lot selection (6 Indian cities)
- Cost calculator with GST
- My Bookings tracker
- LocalStorage persistence

✅ **Backend**: Node.js + Express + MongoDB
- User authentication (JWT)
- Parking lot browsing API
- Booking CRUD operations
- Razorpay payment gateway
- Admin dashboard endpoints

✅ **Database**: MongoDB
- User accounts & profiles
- Parking lot details
- Booking transactions

✅ **Payments**: Razorpay Integration
- Test mode ready
- 4 payment methods
- Order verification

---

## 📂 Project Structure

```
Smart Parking/
├── index.html              # Main interface
├── styles.css              # Complete styling
├── script.js               # Booking logic
├── booking-data.js         # Parking lots database
├── .env.example            # Config template
├── SETUP_GUIDE.md          # Detailed setup
├── README.md               # Full documentation
├── QUICK_START.md          # This file ⭐
├── docker-compose.yml      # Docker setup
├── .gitignore              # Git exclusions
└── backend/
    ├── server.js           # Express server
    ├── package.json        # Dependencies
    ├── .env.example        # Backend config
    ├── Dockerfile          # Container config
    ├── models/             # MongoDB schemas
    ├── middleware/         # Auth & RBAC
    └── routes/             # API endpoints
```

---

## 🚀 Next: Deploy to Production

### Backend Deployment (Choose One)
```bash
# Option 1: Heroku (Easiest)
heroku login
heroku create my-parking-api
heroku config:set MONGODB_URI=<your-atlas-uri>
git push heroku main

# Option 2: AWS/DigitalOcean
# See SETUP_GUIDE.md for detailed steps
```

### Frontend Deployment
```bash
# Option 1: Netlify
netlify deploy --prod

# Option 2: Vercel
vercel --prod

# Option 3: GitHub Pages
git push origin main
# Enable Pages in GitHub Settings
```

---

## 🔧 Common Issues

| Issue | Solution |
|-------|----------|
| "Port 5000 already in use" | Kill process: `lsof -i :5000` then `kill -9 <PID>` |
| "MongoDB not found" | Start MongoDB: `brew services start mongodb-community` (macOS) |
| "API not responding" | Check backend is running: `http://localhost:5000/api/health` |
| "CORS error" | Frontend & backend on different ports (3000 vs 5000) ✓ |
| "Can't book parking" | Check browser console (F12) for JavaScript errors |

---

## 📱 Testing Payment (Sandbox Mode)

**Razorpay Test Cards:**
- Visa: `4111 1111 1111 1111`
- MCard: `5555 5555 5555 4444`
- Expiry: Any future date
- CVV: Any 3 digits

Test UPI: Just use any UPI ID format like `test@razorpay`

---

## 📞 Need Help?

1. Check browser console (F12) for errors
2. Check server terminal for API errors
3. Verify MongoDB is running
4. Check .env variables are set
5. See detailed SETUP_GUIDE.md for comprehensive help

---

## 🎉 You're Ready!

Start with:
```bash
cd backend && npm start
# In another terminal:
# Open index.html in browser
```

**Happy Parking! 🅿️**
