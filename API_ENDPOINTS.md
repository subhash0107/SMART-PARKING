# Smart Parking API - Complete Endpoint Reference

**Base URL:**
- Development: `http://localhost:5000`
- Production: `https://your-api-domain.com`

**Authentication:** JWT Token required (except register/login)
- Header: `Authorization: Bearer <token>`
- Obtain token from `/api/users/login` or `/api/users/register`

---

## 🏥 Health & Status

### Health Check
```http
GET /api/health
```
**Purpose:** Verify API is running  
**Auth:** No  
**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Smart Parking API is running",
  "timestamp": "2024-04-15T10:30:00.000Z"
}
```

---

## 👥 User Management API

### 1. Register New User
```http
POST /api/users/register
Content-Type: application/json
```
**Auth:** No  
**Body:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "9876543210",
  "password": "SecurePass123!"
}
```
**Response:**
```json
{
  "status": "SUCCESS",
  "message": "User registered successfully",
  "data": {
    "userId": "USER123",
    "email": "john@example.com",
    "token": "eyJhbGciOiJIUzI1NiIs..."
  }
}
```
**Status Codes:**
- `201`: User created
- `400`: Invalid input or email exists
- `500`: Server error

---

### 2. Login
```http
POST /api/users/login
Content-Type: application/json
```
**Auth:** No  
**Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "userId": "USER123",
    "email": "john@example.com",
    "name": "John Doe",
    "token": "eyJhbGciOiJIUzI1NiIs...",
    "walletBalance": 500,
    "totalBookings": 5
  }
}
```
**Status Codes:**
- `200`: Login successful
- `401`: Invalid credentials
- `500`: Server error

---

### 3. Get User Profile
```http
GET /api/users/profile
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "userId": "USER123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "9876543210",
    "vehicleNumber": "AP01AB1234",
    "vehicleType": "sedan",
    "walletBalance": 1000,
    "totalBookings": 5,
    "rating": 4.5,
    "address": {
      "street": "123 Main St",
      "city": "Ongole",
      "state": "AP",
      "zipcode": "523240"
    },
    "paymentMethods": [
      {
        "type": "razorpay",
        "isDefault": true
      }
    ],
    "createdAt": "2024-01-15T10:00:00.000Z"
  }
}
```
**Status Codes:**
- `200`: Profile retrieved
- `401`: Unauthorized (invalid token)
- `404`: User not found
- `500`: Server error

---

## 🅿️ Parking Lots API

### 1. Get All Parking Lots
```http
GET /api/lots?city=Vizag
```
**Auth:** No  
**Query Parameters:**
- `city` (optional): Filter by city
  - Values: `Vizag`, `Ongole`, `Tirupati`, `Vijayawada`, `Guntur`, `Kadapa`

**Response:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "lotId": "VZ001",
      "name": "RamaKrishna Beach",
      "city": "Vizag",
      "address": "RK Beach, Vizag",
      "totalSpots": 20,
      "availableSpots": 8,
      "ratePerHour": 10,
      "amenities": [
        "CCTV",
        "Security Guard",
        "EV Charging"
      ],
      "status": "active"
    },
    {
      "lotId": "VZ002",
      "name": "Kailasa Giri",
      "city": "Vizag",
      "address": "Hilltop, Vizag",
      "totalSpots": 20,
      "availableSpots": 12,
      "ratePerHour": 10,
      "amenities": [
        "WiFi",
        "Security Guard",
        "CCTV"
      ],
      "status": "active"
    },
    {
      "lotId": "VZ003",
      "name": "Vuda Park",
      "city": "Vizag",
      "address": "Park, Vizag",
      "totalSpots": 15,
      "availableSpots": 6,
      "ratePerHour": 10,
      "amenities": [
        "Reserved Spots",
        "Mobile App",
        "Auto Payment"
      ],
      "status": "active"
    }
  ],
  "count": 3
}
```
**Status Codes:**
- `200`: Lots retrieved
- `500`: Server error

---

### 2. Get Single Parking Lot Details
```http
GET /api/lots/:lotId
```
**Auth:** No  
**URL Parameters:**
- `:lotId` - Parking lot ID (e.g., `VZ001`, `TPT001`, `ONG001`, `VJD001`, `GNT001`, `KDP001`)

**Available Lot IDs by City:**
- **Vizag:** VZ001 (RamaKrishna Beach), VZ002 (Kailasa Giri), VZ003 (Vuda Park)
- **Tirupati:** TPT001 (Bazaar Street), TPT002 (Deer Park)
- **Ongole:** ONG001 (Gandhi Park), ONG002 (Ongole Bull Park)
- **Vijayawada:** VJD001 (Ambedkar Park)
- **Guntur:** GNT001 (Pankala Narasimha Temple)
- **Kadapa:** KDP001 (Gandikota Fort)

**Response:** Same as Get All Lots (single lot object)

---

### 3. Check Parking Lot Availability
```http
GET /api/lots/:lotId/availability
```
**Auth:** No  
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "lotId": "VZ001",
    "name": "RamaKrishna Beach",
    "city": "Vizag",
    "totalSpots": 20,
    "availableSpots": 8,
    "occupiedSpots": 12,
    "occupancyRate": 60,
    "ratePerHour": 10,
    "lastUpdated": "2024-04-15T10:35:00.000Z"
  }
}
```

---

## 📅 Bookings API

### 1. Create New Booking
```http
POST /api/bookings
Content-Type: application/json
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Body:**
```json
{
  "lotId": "VZ001",
  "spotNumber": "SPOT-001",
  "checkIn": "2024-04-15T10:00:00Z",
  "checkOut": "2024-04-15T14:00:00Z",
  "vehicleNumber": "AP01AB1234",
  "vehicleType": "sedan",
  "paymentMethod": "razorpay"
}
```
**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Booking created successfully",
  "data": {
    "bookingId": "PARKVZ12345",
    "lotId": "VZ001",
    "lotName": "RamaKrishna Beach",
    "city": "Vizag",
    "spotNumber": "SPOT-001",
    "checkIn": "2024-04-15T10:00:00Z",
    "checkOut": "2024-04-15T14:00:00Z",
    "duration": 4,
    "costPerHour": 10,
    "baseCost": 40,
    "tax": 7.2,
    "totalCost": 47.2,
    "status": "pending",
    "paymentDetails": {
      "method": "razorpay",
      "status": "pending"
    },
    "createdAt": "2024-04-15T10:00:00.000Z"
  }
}
```
**Status Codes:**
- `201`: Booking created
- `400`: Invalid input or spot unavailable
- `401`: Unauthorized
- `500`: Server error

---

### 2. Get Booking Details
```http
GET /api/bookings/:bookingId
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Response:** Single booking object (similar to Create response)

---

### 3. Get User's Bookings
```http
GET /api/bookings/user/:userId
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Query Parameters:**
- `status` (optional): Filter by status
  - Values: `pending`, `confirmed`, `active`, `completed`, `cancelled`
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "bookingId": "PARKVZ12345",
      "lotId": "VZ001",
      "lotDetails": {
        "name": "RamaKrishna Beach",
        "city": "Vizag",
        "ratePerHour": 10
      },
      "spotNumber": "SPOT-001",
      "checkIn": "2024-04-15T10:00:00Z",
      "checkOut": "2024-04-15T14:00:00Z",
      "status": "completed",
      "totalCost": 47.2,
      "rating": 5,
      "review": "Great parking experience",
      "createdAt": "2024-04-15T10:00:00.000Z"
    }
  ]
}
```

---

### 4. Update Booking
```http
PUT /api/bookings/:bookingId
Content-Type: application/json
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Body:**
```json
{
  "status": "active",
  "entryTime": "2024-04-15T10:05:00Z",
  "rating": 5,
  "review": "Amazing place to park!"
}
```
**Response:** Updated booking object

---

### 5. Cancel Booking
```http
DELETE /api/bookings/:bookingId
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Booking cancelled successfully",
  "data": {
    "bookingId": "PARK12345678",
    "status": "cancelled",
    "refundAmount": 50
  }
}
```

---

## 💳 Payments API

### 1. Create Razorpay Order
```http
POST /api/payments/create-order
Content-Type: application/json
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Body:**
```json
{
  "bookingId": "PARKVZ12345",
  "amount": 47.2
}
```
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "orderId": "order_VZ2cQQbbIDzcDx7f",
    "keyId": "rzp_test_XXXXXXXXXX",
    "amount": 47.2,
    "currency": "INR",
    "receipt": "PARKVZ12345"
  }
}
```
**Status Codes:**
- `201`: Order created
- `400`: Invalid input
- `401`: Unauthorized
- `500`: Server error

---

### 2. Verify Payment Signature
```http
POST /api/payments/verify
Content-Type: application/json
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Body:**
```json
{
  "orderId": "order_VZ2cQQbbIDzcDx7f",
  "paymentId": "pay_VZ2cQQccIDzcDx7g",
  "signature": "9ef4dffbfd84f1318f6739a3ce19f9d85851857ae648f114332d8401e0949a3d"
}
```
**Response:**
```json
{
  "status": "SUCCESS",
  "message": "Payment verified successfully",
  "data": {
    "bookingId": "PARKVZ12345",
    "paymentStatus": "completed",
    "transactionId": "pay_VZ2cQQccIDzcDx7g",
    "amount": 47.2
  }
}
```
**Status Codes:**
- `200`: Payment verified
- `400`: Invalid signature
- `401`: Unauthorized
- `500`: Server error

---

### 3. Get Payment Status
```http
GET /api/payments/status/:orderId
Authorization: Bearer <token>
```
**Auth:** Required ✅  
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "orderId": "order_VZ2cQQbbIDzcDx7f",
    "paymentStatus": "completed",
    "amount": 47.2,
    "currency": "INR",
    "lotDetails": {
      "lotId": "VZ001",
      "name": "RamaKrishna Beach",
      "city": "Vizag"
    },
    "createdAt": "2024-04-15T10:00:00.000Z"
  }
}
```

---

## 👨‍💼 Admin API (Admin Access Required)

All admin endpoints require JWT token with `admin` or `superadmin` role.

### 1. Get Dashboard Statistics
```http
GET /api/admin/stats
Authorization: Bearer <admin-token>
```
**Auth:** Admin Required ✅  
**Response:**
```json
{
  "status": "SUCCESS",
  "data": {
    "statistics": {
      "totalBookings": 1250,
      "totalUsers": 450,
      "totalLots": 13,
      "completedBookings": 1100,
      "activeBookings": 45,
      "cancelledBookings": 105,
      "totalRevenue": 285000
    },
    "timestamp": "2024-04-15T10:35:00.000Z"
  }
}
```

---

### 2. Get All Bookings (Paginated)
```http
GET /api/admin/bookings?status=completed&page=1&limit=20
Authorization: Bearer <admin-token>
```
**Auth:** Admin Required ✅  
**Query Parameters:**
- `status` (optional): `pending`, `confirmed`, `active`, `completed`, `cancelled`
- `lotId` (optional): Filter by parking lot
- `page` (optional, default: 1)
- `limit` (optional, default: 20)

**Response:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "bookingId": "PARK123",
      "userId": {"name": "John", "email": "john@example.com"},
      "lotId": {"name": "RamaKrishna Beach", "city": "Vizag"},
      "spotNumber": "SPOT-001",
      "status": "completed",
      "totalCost": 47.2,
      "createdAt": "2024-04-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "pages": 23
  }
}
```

---

### 3. Add New Parking Lot
```http
POST /api/admin/lots
Content-Type: application/json
Authorization: Bearer <admin-token>
```
**Auth:** Admin Required ✅  
**Body:**
```json
{
  "lotId": "GNT001",
  "name": "Pankala Narasimha Temple",
  "city": "Guntur",
  "address": "Mangalagiri, Guntur, India",
  "coordinates": {
    "lat": 16.3067,
    "lng": 80.6476
  },
  "totalSpots": 20,
  "ratePerHour": 10,
  "amenities": ["CCTV", "EV Charging", "Security Guard"],
  "openingHour": 6,
  "closingHour": 23
}
```
**Response:** Created parking lot object

---

### 4. Update Parking Lot
```http
PUT /api/admin/lots/:lotId
Content-Type: application/json
Authorization: Bearer <admin-token>
```
**Auth:** Admin Required ✅  
**Body:**
```json
{
  "ratePerHour": 45,
  "totalSpots": 220,
  "status": "maintenance"
}
```
**Response:** Updated parking lot object

---

### 5. Get Users List
```http
GET /api/admin/users?page=1&limit=20
Authorization: Bearer <admin-token>
```
**Auth:** Admin Required ✅  
**Response:**
```json
{
  "status": "SUCCESS",
  "data": [
    {
      "userId": "USER123",
      "name": "John Doe",
      "email": "john@example.com",
      "phone": "9876543210",
      "walletBalance": 500,
      "totalBookings": 5,
      "rating": 4.5,
      "createdAt": "2024-01-15T10:00:00.000Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "pages": 23
  }
}
```

---

## 📝 Status Codes Reference

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Missing or invalid authentication |
| 403 | Forbidden | Insufficient permissions (admin access) |
| 404 | Not Found | Resource not found |
| 500 | Server Error | Internal server error |

---

## 🔐 Authentication Methods

### 1. Bearer Token (Recommended)
```http
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 2. Getting a Token
```bash
# Login
curl -X POST http://localhost:5000/api/users/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "john@example.com",
    "password": "password123"
  }'

# Response includes: "token": "eyJhbGci..."
```

### 3. Token Expiration
- Default: 30 days
- After expiration: User must login again
- Configure in .env: `JWT_EXPIRE=30d`

---

## 🔍 Error Response Format

All errors follow this format:
```json
{
  "status": "ERROR",
  "message": "Descriptive error message",
  "code": "ERROR_CODE"
}
```

Example:
```json
{
  "status": "ERROR",
  "message": "Invalid email or password",
  "code": "INVALID_CREDENTIALS"
}
```

---

## 🧪 Testing with cURL

### Test API Health
```bash
curl http://localhost:5000/api/health
```

### Register User
```bash
curl -X POST http://localhost:5000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@example.com",
    "phone": "9876543210",
    "password": "Password123"
  }'
```

### Get Parking Lots by City
```bash
curl "http://localhost:5000/api/lots?city=Vizag"
```

### Create Booking (with authentication)
```bash
curl -X POST http://localhost:5000/api/bookings \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -d '{
    "lotId": "VZ001",
    "spotNumber": "SPOT-001",
    "checkIn": "2024-04-15T10:00:00Z",
    "checkOut": "2024-04-15T14:00:00Z",
    "vehicleNumber": "AP01AB1234",
    "vehicleType": "sedan",
    "paymentMethod": "razorpay"
  }'
```

---

## 📚 Rate Limiting
Currently not implemented. To add:
1. Install `express-rate-limit`
2. Configure in server.js
3. Limit requests per IP/user

---

## 🚀 Pagination Details

Endpoints supporting pagination return:
```json
{
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 450,
    "pages": 23
  }
}
```

Parameters:
- `page` (default: 1)
- `limit` (default: 20, max: 100)

Example:
```http
GET /api/bookings/user/USER123?page=2&limit=50
```

---

**Last Updated:** 2024  
**API Version:** 1.0.0  
**Base URL:** http://localhost:5000
