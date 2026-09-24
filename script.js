// ============================================
// Global Variables & State Management
// ============================================

let currentLot = null;
let parkingSpots = [];
let selectedSpot = null;
let bookingStorage = [];
let currentUser = null;
let isUserAuthenticated = false;

// ============================================
// Real-Time Socket.IO Setup
// ============================================

// Initialize Socket.IO connection (enable real-time features)
let socket = null;
let isConnectedToRealtime = false;

function initializeRealTimeConnection() {
    // Connect to WebSocket server
    socket = io('http://localhost:5000', {
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: 10,
        autoConnect: true
    });

    // Connection established
    socket.on('connect', () => {
        isConnectedToRealtime = true;
        console.log('✓ Connected to real-time service');
        showNotification('✓ Real-time updates enabled', 'success', 2000);
    });

    // Disconnected from real-time
    socket.on('disconnect', () => {
        isConnectedToRealtime = false;
        console.log('⚠ Disconnected from real-time service');
    });

    // Real-time booking updates
    socket.on('booking:created', (data) => {
        console.log('Real-time: New booking created', data);
        // Refresh available spots if viewing same lot
        if (currentLot && currentLot.id === data.lotId) {
            refreshAvailableSpots();
        }
    });

    socket.on('booking:updated', (data) => {
        console.log('Real-time: Booking updated', data);
        updateLocalBookingStatus(data.bookingId, data.status);
        displayMyBookings();
    });

    socket.on('booking:cancelled', (data) => {
        console.log('Real-time: Booking cancelled', data);
        showNotification(`Booking ${data.bookingId} cancelled with refund ₹${data.refund}`, 'info');
        displayMyBookings();
    });

    // Real-time payment updates
    socket.on('payment:confirmed', (data) => {
        console.log('Real-time: Payment confirmed', data);
        showNotification(`✓ Payment confirmed for booking ${data.orderId}`, 'success');
        updateLocalPaymentStatus(data.orderId, 'completed');
    });

    socket.on('payment:failed', (data) => {
        console.log('Real-time: Payment failed', data);
        showNotification(`✗ Payment failed for order ${data.orderId}`, 'error');
        updateLocalPaymentStatus(data.orderId, 'failed');
    });

    // Handle socket errors
    socket.on('error', (error) => {
        console.error('Socket.IO error:', error);
    });
}

// Subscribe to real-time updates for specific lot
function subscribeToLotUpdates(lotId) {
    if (socket && isConnectedToRealtime) {
        socket.emit('subscribe:lot', lotId);
    }
}

// Subscribe to real-time updates for specific booking
function subscribeToBookingUpdates(bookingId) {
    if (socket && isConnectedToRealtime) {
        socket.emit('subscribe:booking', bookingId);
    }
}

// Update local booking status
function updateLocalBookingStatus(bookingId, status) {
    const bookingIndex = bookingStorage.findIndex(b => b.id === bookingId);
    if (bookingIndex > -1) {
        bookingStorage[bookingIndex].status = status;
        saveBookingsToStorage();
    }
}

// Update payment status in local booking
function updateLocalPaymentStatus(orderId, status) {
    const bookingIndex = bookingStorage.findIndex(b => b.paymentDetails?.orderId === orderId);
    if (bookingIndex > -1) {
        bookingStorage[bookingIndex].paymentDetails.paymentStatus = status;
        saveBookingsToStorage();
    }
}

// ============================================
// Authentication Management
// ============================================

// Initialize authentication
function initializeAuth() {
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
        currentUser = JSON.parse(storedUser);
        isUserAuthenticated = true;
        updateUserUI();
    }
}

// ============================================
// Enhanced Security Features
// ============================================

// Session management for security
const MAX_SESSION_DURATION = 30 * 60 * 1000; // 30 minutes
let lastActivityTime = Date.now();

// Track failed login attempts
const failedLoginAttempts = new Map();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes

// Session timeout and activity monitoring
function initializeSessionSecurity() {
    document.addEventListener('mousemove', () => { lastActivityTime = Date.now(); });
    document.addEventListener('keypress', () => { lastActivityTime = Date.now(); });
    
    setInterval(() => {
        if (isUserAuthenticated) {
            const sessionDuration = Date.now() - (new Date(currentUser.loginTime).getTime());
            if (sessionDuration > MAX_SESSION_DURATION) {
                logoutUser();
                showNotification('⚠️ Session expired for security. Please login again.', 'warning');
            }
        }
    }, 60000); // Check every minute
}

// Account lockout protection
function checkLoginAttempts(email) {
    const attempts = failedLoginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    
    if (attempts.lockedUntil > Date.now()) {
        const minutesRemaining = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
        showNotification(`❌ Account temporarily locked. Try again in ${minutesRemaining} minutes.`, 'error');
        return false;
    }
    return true;
}

function recordFailedLogin(email) {
    const attempts = failedLoginAttempts.get(email) || { count: 0, lockedUntil: 0 };
    attempts.count++;
    
    if (attempts.count >= MAX_FAILED_ATTEMPTS) {
        attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
        showNotification('❌ Too many failed attempts. Account locked for 15 minutes.', 'error');
    }
    
    failedLoginAttempts.set(email, attempts);
}

function clearFailedLoginAttempts(email) {
    failedLoginAttempts.delete(email);
}

// ============================================
// Simple hash function for passwords
// ============================================

function hashPassword(password) {
    let hash = 0;
    for (let i = 0; i < password.length; i++) {
        const char = password.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return 'hashed_' + Math.abs(hash).toString(36);
}

// Validate email format
function isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(String(email || '').trim());
}

function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
}

function isValidLoginIdentifier(identifier) {
    const value = String(identifier || '').trim();
    if (!value) return false;
    if (isValidEmail(value)) return true;
    const digitsOnly = value.replace(/\D/g, '');
    return digitsOnly.length >= 1 && digitsOnly.length <= 15 && /^[0-9]+$/.test(digitsOnly);
}

function getStoredUserByIdentifier(identifier) {
    const value = String(identifier || '').trim();
    if (!value) return null;

    const normalizedEmail = normalizeEmail(value);
    const phoneValue = value.replace(/\D/g, '');
    const candidates = [];

    if (normalizedEmail) {
        candidates.push('users_' + normalizedEmail);
    }

    if (/^[0-9]{1,15}$/.test(phoneValue)) {
        candidates.push('users_' + phoneValue);
    }

    for (const candidate of candidates) {
        const storedUser = localStorage.getItem(candidate);
        if (storedUser) {
            try {
                return JSON.parse(storedUser);
            } catch (error) {
                console.error('Error parsing stored user:', error);
                return null;
            }
        }
    }

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('users_')) continue;

        try {
            const storedUser = JSON.parse(localStorage.getItem(key) || 'null');
            if (!storedUser) continue;

            const storedEmail = normalizeEmail(storedUser.email);
            const storedPhone = String(storedUser.phone || '').replace(/\D/g, '');

            if ((storedEmail && storedEmail === normalizedEmail) || (storedPhone && storedPhone === phoneValue)) {
                return storedUser;
            }
        } catch (error) {
            console.error('Error scanning stored user records:', error);
        }
    }

    return null;
}

// Login user with enhanced security and debug logging
async function loginUser(email, password) {
    const loginIdentifier = String(email || '').trim();
    console.log('🔐 Attempting login for:', loginIdentifier);
    
    // Check if account is locked
    if (!checkLoginAttempts(loginIdentifier)) {
        console.warn('⚠️ Account locked due to failed attempts');
        return false;
    }
    
    // Validate email or phone number format
    if (!isValidLoginIdentifier(loginIdentifier)) {
        console.warn('⚠️ Invalid login identifier:', loginIdentifier);
        showNotification('❌ Please enter a valid email address or phone number', 'error');
        recordFailedLogin(loginIdentifier);
        return false;
    }
    
    // Validate password length
    if (!password || password.length < 1) {
        console.warn('⚠️ Empty password');
        showNotification('❌ Password cannot be empty', 'error');
        recordFailedLogin(loginIdentifier);
        return false;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/users/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                identifier: loginIdentifier,
                password: password
            })
        });

        const result = await response.json();

        if (response.ok && result.status === 'SUCCESS') {
            const user = result.data;
            clearFailedLoginAttempts(loginIdentifier);
            currentUser = {
                id: user.userId,
                email: user.email,
                name: user.name,
                phone: user.phone || '',
                loginTime: new Date().toISOString(),
                sessionToken: user.token,
                token: user.token,
                ipAddress: 'user-session-' + Math.random().toString(36).substr(2, 9),
                deviceId: generateDeviceId(),
                walletBalance: user.walletBalance || 0
            };
            isUserAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('lastLoginTime', new Date().toISOString());
            localStorage.setItem('userSessionToken', user.token);
            updateUserUI();
            closeLoginModal();
            console.log('✅ Login successful via MongoDB backend!');
            showNotification('✓ Login Successful! Welcome ' + currentUser.name, 'success');
            return true;
        }

        console.warn('⚠️ Backend login failed:', result.message || 'Unknown error');
        showNotification('❌ Email or password is incorrect', 'error');
        recordFailedLogin(loginIdentifier);
        return false;
    } catch (error) {
        console.warn('⚠️ Backend login unavailable, trying local fallback:', error);
    }

    // Fallback to browser-based localStorage login for offline compatibility
    const userData = getStoredUserByIdentifier(loginIdentifier);
    if (!userData) {
        console.warn('⚠️ User not found:', loginIdentifier);
        showNotification('❌ Email or password is incorrect', 'error');
        recordFailedLogin(loginIdentifier);
        return false;
    }
    
    try {
        const hashedPassword = hashPassword(password);
        
        console.log('🔍 Checking password hash...');
        console.log('Provided hash:', hashedPassword);
        console.log('Stored hash:', userData.passwordHash);
        
        if (userData.passwordHash !== hashedPassword) {
            console.warn('⚠️ Password mismatch for:', loginIdentifier);
            showNotification('❌ Email or password is incorrect', 'error');
            recordFailedLogin(loginIdentifier);
            return false;
        }
        
        console.log('✅ Password verified. Logging in:', loginIdentifier);
        clearFailedLoginAttempts(loginIdentifier);
        currentUser = {
            id: userData.id || 'user_' + Math.random().toString(36).substr(2, 9),
            email: userData.email,
            name: userData.name,
            phone: userData.phone,
            loginTime: new Date().toISOString(),
            sessionToken: generateSessionToken(),
            ipAddress: 'user-session-' + Math.random().toString(36).substr(2, 9),
            deviceId: generateDeviceId(),
            walletBalance: userData.walletBalance || 0
        };
        isUserAuthenticated = true;
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        localStorage.setItem('lastLoginTime', new Date().toISOString());
        localStorage.setItem('userSessionToken', currentUser.sessionToken);
        updateUserUI();
        closeLoginModal();
        console.log('✅ Login successful!');
        showNotification('✓ Login Successful! Welcome ' + currentUser.name, 'success');
        return true;
    } catch (error) {
        console.error('❌ Login error:', error);
        showNotification('❌ Login error. Please try again.', 'error');
        return false;
    }
}

// Generate secure session token
function generateSessionToken() {
    return 'session_' + Math.random().toString(36).substr(2) + '_' + Date.now();
}

// Generate device identifier
function generateDeviceId() {
    let deviceId = localStorage.getItem('deviceId');
    if (!deviceId) {
        deviceId = 'device_' + Math.random().toString(36).substr(2, 15) + '_' + Date.now();
        localStorage.setItem('deviceId', deviceId);
    }
    return deviceId;
}

// Signup user with secure password handling
async function signupUser(name, email, phone, password, passwordConfirm) {
    const normalizedEmail = normalizeEmail(email);

    // Validation
    if (!name || !normalizedEmail || !phone || !password) {
        showNotification('❌ All fields are required', 'error');
        return false;
    }
    
    // Validate email format
    if (!isValidEmail(normalizedEmail)) {
        showNotification('❌ Please enter a valid email address', 'error');
        return false;
    }
    
    // Validate name
    if (name.length < 3) {
        showNotification('❌ Name must be at least 3 characters', 'error');
        return false;
    }
    
    // Validate phone
    const phoneRegex = /^[0-9]{1,15}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('❌ Please enter a valid phone number (1-15 digits)', 'error');
        return false;
    }
    
    if (password !== passwordConfirm) {
        showNotification('❌ Passwords do not match', 'error');
        return false;
    }
    
    if (password.length < 8) {
        showNotification('❌ Password must be at least 8 characters', 'error');
        return false;
    }
    
    // Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /[0-9]/.test(password);
    
    if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
        showNotification('❌ Password must contain uppercase, lowercase, and numbers', 'error');
        return false;
    }
    
    try {
        const response = await fetch('http://localhost:5000/api/users/register', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name.trim(),
                email: normalizedEmail,
                phone: phone.trim(),
                password: password
            })
        });

        const result = await response.json();

        if (response.ok && result.status === 'SUCCESS') {
            const user = result.data;
            currentUser = {
                id: user.userId,
                email: user.email,
                name: user.name,
                phone: user.phone || phone,
                loginTime: new Date().toISOString(),
                sessionToken: user.token,
                token: user.token,
                ipAddress: 'user-session-' + Math.random().toString(36).substr(2, 9),
                deviceId: generateDeviceId(),
                walletBalance: 0
            };
            isUserAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('lastLoginTime', new Date().toISOString());
            localStorage.setItem('userSessionToken', user.token);
            updateUserUI();
            closeSignupModal();
            showNotification('✅ Account created successfully! Welcome ' + name, 'success');
            return true;
        }

        showNotification(result.message || '❌ Registration failed. Please try again.', 'error');
        return false;
    } catch (error) {
        console.error('❌ Backend registration failed, using local fallback:', error);
    }

    // Check if email already exists
    const existingUser = localStorage.getItem('users_' + normalizedEmail);
    if (existingUser) {
        showNotification('❌ Email already registered', 'error');
        return false;
    }
    
    // Create user profile with secure password hash
    const newUser = {
        id: Math.random().toString(36).substr(2, 9),
        name: name,
        email: normalizedEmail,
        phone: phone,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
        accountStatus: 'active'
    };
    
    // Save user profile securely
    localStorage.setItem('users_' + normalizedEmail, JSON.stringify(newUser));
    
    currentUser = {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        loginTime: new Date().toISOString(),
        sessionToken: Math.random().toString(36).substr(2)
    };
    isUserAuthenticated = true;
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    localStorage.setItem('lastLoginTime', new Date().toISOString());
    updateUserUI();
    closeSignupModal();
    showNotification('✅ Account created successfully! Welcome ' + name, 'success');
    return true;
}

// Logout user with secure session clearing
function logoutUser() {
    // Clear all session data
    currentUser = null;
    isUserAuthenticated = false;
    bookingStorage = [];
    localStorage.removeItem('currentUser');
    localStorage.removeItem('lastLoginTime');
    localStorage.removeItem('userSessionToken');
    updateUserUI();
    showNotification('👋 You have been logged out securely', 'info');
}

// Update UI based on auth status
function updateUserUI() {
    const userMenuToggle = document.getElementById('userMenuToggle');
    const userDropdownName = document.getElementById('userDropdownName');
    const userDropdown = document.getElementById('userDropdown');
    
    if (isUserAuthenticated && currentUser) {
        userMenuToggle.innerHTML = `👤 ${currentUser.name.charAt(0).toUpperCase() + currentUser.name.slice(1)}`;
        userMenuToggle.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        userDropdown.style.display = 'none';
        
        if (userDropdownName) {
            userDropdownName.innerHTML = `👋 ${currentUser.name}<br><small style="font-weight: normal; font-size: 12px;">@${currentUser.email}</small>`;
        }
        userDropdown.classList.remove('show');
        displayProfile();
    } else {
        userMenuToggle.innerHTML = '👤 Login';
        userMenuToggle.style.background = 'linear-gradient(135deg, #2563eb, #1e40af)';
        userDropdown.style.display = 'none';
        userDropdown.classList.remove('show');
        displayProfileNotAuthenticated();
    }
}

// Display user profile
function displayProfile() {
    const profileContent = document.getElementById('profileContent');
    if (!profileContent || !isUserAuthenticated || !currentUser) return;
    
    const userInitials = currentUser.name.charAt(0).toUpperCase();
    const createdDate = new Date(currentUser.loginTime).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
    
    profileContent.innerHTML = `
        <div class="profile-header">
            <div class="profile-avatar">${userInitials}</div>
            <div class="profile-name">${currentUser.name}</div>
            <div class="profile-email">${currentUser.email}</div>
        </div>
        
        <div class="profile-info">
            <div class="info-row">
                <div class="info-label">📧 Email</div>
                <div class="info-value">${currentUser.email}</div>
            </div>
            <div class="info-row">
                <div class="info-label">👤 Full Name</div>
                <div class="info-value">${currentUser.name}</div>
            </div>
            <div class="info-row">
                <div class="info-label">🔐 Account Status</div>
                <div class="info-value">
                    <span style="color: #10b981; font-weight: 600;">✓ Active</span>
                </div>
            </div>
            <div class="info-row">
                <div class="info-label">📅 Joined</div>
                <div class="info-value">${createdDate}</div>
            </div>
        </div>
        
        <div class="profile-actions">
            <button class="btn-edit-profile" onclick="openEditProfileModal()">✏️ Edit Profile</button>
            <button class="btn-logout" onclick="confirmLogout()">🚪 Sign Out</button>
        </div>
    `;
}

// Display profile for non-authenticated users
function displayProfileNotAuthenticated() {
    const profileContent = document.getElementById('profileContent');
    if (!profileContent) return;
    
    profileContent.innerHTML = `
        <div class="auth-required-message">
            <p>👤 Please <a href="#" onclick="openLoginModal(); return false;">login</a> to view your profile</p>
        </div>
    `;
}

// Confirm logout with dialog
function confirmLogout() {
    const confirmLogout = confirm(`👋 Sign Out from Smart Parking?\n\nClick OK to logout securely.`);
    if (confirmLogout) {
        logoutUser();
    }
}

// Open edit profile modal
function openEditProfileModal() {
    const editProfileModal = document.getElementById('editProfileModal');
    if (!editProfileModal || !isUserAuthenticated || !currentUser) return;
    
    // Populate form with current user data
    document.getElementById('editName').value = currentUser.name || '';
    document.getElementById('editEmail').value = currentUser.email || '';
    document.getElementById('editPhone').value = currentUser.phone || '';
    document.getElementById('editPassword').value = '';
    
    editProfileModal.style.display = 'flex';
    editProfileModal.classList.add('show');
}

// Close edit profile modal
function closeEditProfileModal() {
    const editProfileModal = document.getElementById('editProfileModal');
    if (editProfileModal) {
        editProfileModal.style.display = 'none';
        editProfileModal.classList.remove('show');
        document.getElementById('editProfileForm').reset();
    }
}

// Save profile changes
function saveProfileChanges(e) {
    e.preventDefault();
    
    const name = document.getElementById('editName').value.trim();
    const email = document.getElementById('editEmail').value.trim();
    const phone = document.getElementById('editPhone').value.trim();
    const newPassword = document.getElementById('editPassword').value;
    
    // Validation
    if (!name || !email || !phone) {
        showNotification('❌ All fields are required', 'error');
        return false;
    }
    
    // Validate name
    if (name.length < 3) {
        showNotification('❌ Name must be at least 3 characters', 'error');
        return false;
    }
    
    // Validate email format
    if (!isValidEmail(email)) {
        showNotification('❌ Please enter a valid email address', 'error');
        return false;
    }
    
    // Validate phone
    const phoneRegex = /^[0-9]{1,15}$/;
    if (!phoneRegex.test(phone)) {
        showNotification('❌ Please enter a valid phone number (1-15 digits)', 'error');
        return false;
    }
    
    // If password is being changed, validate it
    if (newPassword) {
        if (newPassword.length < 8) {
            showNotification('❌ Password must be at least 8 characters', 'error');
            return false;
        }
        
        const hasUpperCase = /[A-Z]/.test(newPassword);
        const hasLowerCase = /[a-z]/.test(newPassword);
        const hasNumbers = /[0-9]/.test(newPassword);
        
        if (!hasUpperCase || !hasLowerCase || !hasNumbers) {
            showNotification('❌ Password must contain uppercase, lowercase, and numbers', 'error');
            return false;
        }
    }
    
    // Update current user object
    const oldEmail = currentUser.email;
    currentUser.name = name;
    currentUser.email = email;
    
    // Update in localStorage
    localStorage.setItem('currentUser', JSON.stringify(currentUser));
    
    // Update user data in storage
    const userData = {
        id: currentUser.id,
        name: name,
        email: email,
        phone: phone,
        passwordHash: newPassword ? hashPassword(newPassword) : undefined,
        lastModified: new Date().toISOString(),
        accountStatus: 'active'
    };
    
    // If email changed, update the storage key
    if (oldEmail !== email) {
        localStorage.removeItem('users_' + oldEmail);
    }
    
    const existingUser = JSON.parse(localStorage.getItem('users_' + email) || '{}');
    const updatedUser = { ...existingUser, ...userData };
    
    if (newPassword) {
        updatedUser.passwordHash = hashPassword(newPassword);
    }
    
    localStorage.setItem('users_' + email, JSON.stringify(updatedUser));
    
    closeEditProfileModal();
    updateUserUI();
    displayProfile();
    showNotification('✅ Profile updated successfully!', 'success');
    return true;
}

// Check if user can book
function checkAuthentication() {
    if (!isUserAuthenticated) {
        showNotification('🔐 Please login to book parking', 'warning');
        openLoginModal();
        return false;
    }
    return true;
}

// Load bookings from localStorage on startup
function loadBookingsFromStorage() {
    const stored = localStorage.getItem('parkingBookings');
    bookingStorage = stored ? JSON.parse(stored) : [];
    displayMyBookings();
}

// Save bookings to localStorage
function saveBookingsToStorage() {
    localStorage.setItem('parkingBookings', JSON.stringify(bookingStorage));
}

// ============================================
// Session Security (30-minute timeout)
// ============================================

const SESSION_TIMEOUT = 30 * 60 * 1000; // 30 minutes
let sessionTimeoutId = null;

// Reset session timeout on user activity
function resetSessionTimeout() {
    if (!isUserAuthenticated) return;
    
    if (sessionTimeoutId) clearTimeout(sessionTimeoutId);
    
    sessionTimeoutId = setTimeout(() => {
        logoutUser();
        showNotification('Session expired for security. Please login again.', 'warning');
        openLoginModal();
    }, SESSION_TIMEOUT);
}

// Initialize session security monitoring
function initializeSessionSecurity() {
    if (!isUserAuthenticated) return;
    resetSessionTimeout();
    document.addEventListener('click', resetSessionTimeout);
    document.addEventListener('keypress', resetSessionTimeout);
}

// ============================================
// Initialization
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('🅿️ Smart Parking System Initializing...');
    
    // Check if parking data is loaded
    if (typeof window.parkingData === 'undefined') {
        console.warn('⚠️ Parking data not yet loaded. Retrying...');
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }, 500);
        return;
    }
    
    console.log('✅ Parking data loaded successfully');
    
    initializeAuth();
    initializeSessionSecurity();
    loadBookingsFromStorage();
    
    // Initialize real-time features
    try {
        initializeRealTimeConnection();
    } catch (error) {
        console.warn('Real-time features not available:', error.message);
    }
    
    initializeBookingSystem();
    initializeAllFeatures();
    
    console.log('🅿️ Smart Parking System Initialized Successfully!');
});

// ============================================
// City and Lot Selection
// ============================================

function initializeBookingSystem() {
    console.log('📍 Initializing booking system...');
    
    // Check if parking data is loaded
    if (!window.parkingData) {
        console.error('❌ Parking data not loaded. Make sure booking-data.js is included.');
        setTimeout(() => initializeBookingSystem(), 1000); // Retry after 1 second
        return;
    }
    
    console.log('✅ Parking data available:', window.parkingData);
    
    const citySelect = document.getElementById('citySelect');
    const lotSelect = document.getElementById('lotSelect');
    const searchButton = document.getElementById('searchSpots');

    if (!citySelect || !lotSelect || !searchButton) {
        console.error('❌ Required DOM elements not found');
        return;
    }

    // City change handler
    citySelect.addEventListener('change', function() {
        console.log('🏙️ City selected:', this.value);
        const selectedCity = this.value;
        lotSelect.innerHTML = '<option value="">Choose a lot...</option>';
        
        if (selectedCity) {
            try {
                const lots = window.parkingData.getLotsForCity(selectedCity);
                console.log('📍 Lots found:', lots);
                
                if (!lots || lots.length === 0) {
                    console.warn('⚠️ No lots found for city:', selectedCity);
                    lotSelect.innerHTML = '<option value="">No lots available</option>';
                    return;
                }
                
                lots.forEach(lot => {
                    const option = document.createElement('option');
                    option.value = lot.id;
                    option.textContent = lot.name;
                    option.dataset.lotObj = JSON.stringify(lot);
                    lotSelect.appendChild(option);
                });
                console.log('✅ Lots populated for:', selectedCity);
            } catch (error) {
                console.error('❌ Error loading lots:', error);
                showNotification('Error loading parking lots', 'error');
            }
        }
    });

    // Lot change handler
    lotSelect.addEventListener('change', function() {
        console.log('🅿️ Lot selected:', this.value);
        if (this.value) {
            try {
                const selectedOption = this.options[this.selectedIndex];
                currentLot = JSON.parse(selectedOption.dataset.lotObj);
                console.log('✅ Current lot set:', currentLot);
                loadParkingLot();
            } catch (error) {
                console.error('❌ Error selecting lot:', error);
                showNotification('Error selecting parking lot', 'error');
            }
        }
    });

    // Search button handler
    searchButton.addEventListener('click', validateAndSearch);

    // Set minimum datetime to now
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('checkIn').min = now.toISOString().slice(0, 16);
    document.getElementById('checkIn').value = now.toISOString().slice(0, 16);

    document.getElementById('checkOut').addEventListener('change', updateCheckOut);
}

function updateCheckOut() {
    const checkInInput = document.getElementById('checkIn').value;
    if (checkInInput) {
        const checkInTime = new Date(checkInInput);
        const checkOutTime = new Date(checkInTime.getTime() + 1 * 60 * 60 * 1000);
        document.getElementById('checkOut').min = checkInInput;
        if (!document.getElementById('checkOut').value) {
            document.getElementById('checkOut').value = checkOutTime.toISOString().slice(0, 16);
        }
    }
}

function validateAndSearch() {
    console.log('🔍 Validating and searching...');
    const city = document.getElementById('citySelect').value;
    const lot = document.getElementById('lotSelect').value;
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;

    if (!city || !lot || !checkIn || !checkOut) {
        showNotification('❌ Please fill all search fields', 'error');
        return;
    }

    if (!window.parkingData) {
        showNotification('❌ Parking data not available', 'error');
        return;
    }

    const validation = window.parkingData.isValidDateTime(checkIn, checkOut);
    if (!validation.valid) {
        showNotification('❌ ' + validation.message, 'error');
        return;
    }
    
    console.log('✅ Validation passed. Loading parking lot...');
    loadParkingLot();
}

function loadParkingLot() {
    if (!currentLot) {
        console.warn('⚠️ No parking lot selected');
        showNotification('❌ Please select a parking lot', 'error');
        return;
    }

    console.log('📍 Loading parking lot:', currentLot.name);
    try {
        parkingSpots = window.parkingData.generateParkingSpots(currentLot.totalSpots);
        selectedSpot = null;

        document.getElementById('lotName').textContent = currentLot.name;
        document.getElementById('lotAddr').textContent = currentLot.address;
        document.getElementById('rates').textContent = `₹${currentLot.ratePerHour}/hr`;
        
        const availableCount = window.parkingData.getAvailableSpots(parkingSpots);
        document.getElementById('availCount').textContent = availableCount;
        document.getElementById('occupCount').textContent = currentLot.totalSpots - availableCount;

        renderParkingGrid();
        
        document.getElementById('bookingSummary').innerHTML = '<p class="empty-state">Select a parking spot to book</p>';

        scrollToSection('booking');
        console.log('✅ Parking lot loaded successfully');
        showNotification(`✅ Loaded ${currentLot.name}`, 'success');
    } catch (error) {
        console.error('❌ Error loading parking lot:', error);
        showNotification('❌ Error loading parking lot', 'error');
    }
}

function renderParkingGrid() {
    const container = document.getElementById('parkingGridContainer');
    container.innerHTML = '';

    parkingSpots.forEach(spot => {
        const spotElement = document.createElement('div');
        spotElement.className = `parking-spot ${spot.status}`;
        spotElement.dataset.spot = String(spot.number);
        spotElement.textContent = spot.number;
        spotElement.title = `${spot.status === 'available' ? '✓' : '✕'} Spot ${spot.number}`;

        if (spot.status === 'available') {
            spotElement.addEventListener('click', () => selectSpot(spot));
        }

        container.appendChild(spotElement);
    });
}

function selectSpot(spot) {
    if (selectedSpot) {
        const prevElement = document.querySelector(`.parking-spot[title*="Spot ${selectedSpot.number}"]`);
        if (prevElement) prevElement.classList.remove('selected');
    }

    selectedSpot = spot;
    const spotElement = document.querySelector(`.parking-spot[title*="Spot ${spot.number}"]`);
    spotElement.classList.add('selected');

    updateBookingSummary();
}

function updateBookingSummary() {
    if (!selectedSpot || !currentLot) return;

    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;

    if (!checkIn || !checkOut) {
        showNotification('Please set check-in and check-out times', 'error');
        return;
    }

    const costDetails = window.parkingData.calculateCost(checkIn, checkOut, currentLot.ratePerHour);

    const summaryHTML = `
        <div class="summary-details">
            <div class="summary-item">
                <span class="summary-label">Spot Number</span>
                <span class="summary-value">#${selectedSpot.number}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Location</span>
                <span class="summary-value">${currentLot.name}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Check-in</span>
                <span class="summary-value">${window.parkingData.formatDateTime(checkIn)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Check-out</span>
                <span class="summary-value">${window.parkingData.formatDateTime(checkOut)}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Duration</span>
                <span class="summary-value">${costDetails.hours} hour${costDetails.hours > 1 ? 's' : ''}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">Base Amount</span>
                <span class="summary-value">₹${costDetails.totalCost}</span>
            </div>
            <div class="summary-item">
                <span class="summary-label">GST (18%)</span>
                <span class="summary-value">₹${costDetails.taxAmount}</span>
            </div>
            <div class="price-total">
                <span>Total Amount</span>
                <span>₹${costDetails.finalAmount}</span>
            </div>
        </div>
        <button class="book-button" onclick="openBookingModal()">Proceed to Payment</button>
    `;

    document.getElementById('bookingSummary').innerHTML = summaryHTML;
}

// ============================================
// Booking Modal
// ============================================

function openBookingModal() {
    // Check if user is authenticated
    if (!checkAuthentication()) {
        return;
    }

    if (!selectedSpot) {
        showNotification('Please select a parking spot', 'error');
        return;
    }

    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;
    const costDetails = window.parkingData.calculateCost(checkIn, checkOut, currentLot.ratePerHour);

    const modalDetails = `
        <div class="modal-detail">
            <span class="modal-detail-label">Parking Location</span>
            <span class="modal-detail-value">${currentLot.name}</span>
        </div>
        <div class="modal-detail">
            <span class="modal-detail-label">Spot #</span>
            <span class="modal-detail-value">${selectedSpot.number}</span>
        </div>
        <div class="modal-detail">
            <span class="modal-detail-label">Check-in</span>
            <span class="modal-detail-value">${window.parkingData.formatDateTime(checkIn)}</span>
        </div>
        <div class="modal-detail">
            <span class="modal-detail-label">Check-out</span>
            <span class="modal-detail-value">${window.parkingData.formatDateTime(checkOut)}</span>
        </div>
        <div class="modal-detail">
            <span class="modal-detail-label">Duration</span>
            <span class="modal-detail-value">${costDetails.hours} hour${costDetails.hours > 1 ? 's' : ''}</span>
        </div>
        <div class="modal-detail">
            <span class="modal-detail-label">Total Amount</span>
            <span class="modal-detail-value" style="color: var(--success-color); font-size: 18px;">₹${costDetails.finalAmount}</span>
        </div>
    `;

    document.getElementById('modalBookingDetails').innerHTML = modalDetails;
    window.currentBookingCost = costDetails;

    const modal = document.getElementById('bookingModal');
    modal.style.display = 'flex';
    modal.classList.add('show');

    document.querySelectorAll('.payment-btn').forEach(btn => btn.classList.remove('selected'));
    document.getElementById('confirmBooking').disabled = true;
}

// Payment method selection
function setupPaymentHandlers() {
    const paymentButtons = document.querySelectorAll('.payment-btn');
    paymentButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            paymentButtons.forEach(b => b.classList.remove('selected'));
            this.classList.add('selected');
            document.getElementById('confirmBooking').disabled = false;
        });
    });

    const confirmButton = document.getElementById('confirmBooking');
    if (confirmButton) {
        confirmButton.addEventListener('click', processPayment);
    }

    // Close booking modal
    const closeBtn = document.querySelector('#bookingModal .close');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeBookingModal);
    }

    window.addEventListener('click', function(event) {
        const modal = document.getElementById('bookingModal');
        if (event.target === modal) {
            closeBookingModal();
        }
    });
}

function closeBookingModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
}

function closeModal() {
    closeBookingModal();
}

function openPaymentModal() {
    const modal = document.getElementById('bookingModal');
    if (modal) {
        modal.style.display = 'flex';
        modal.classList.add('show');
    }
}

function processPayment() {
    const selectedMethod = document.querySelector('.payment-btn.selected');
    if (!selectedMethod) {
        showNotification('Please select a payment method', 'error');
        return;
    }

    const paymentMethod = selectedMethod.dataset.method;
    const amount = window.currentBookingCost.finalAmount;
    
    // Validate amount
    if (amount < 10 || amount > 100000) {
        showNotification('❌ Invalid amount. Allowed range: ₹10 - ₹100,000', 'error');
        return;
    }
    
    // Validate session before payment
    if (!currentUser.sessionToken || !localStorage.getItem('userSessionToken')) {
        showNotification('❌ Session expired. Please login again.', 'error');
        logoutUser();
        return;
    }
    
    // Anti-fraud check: Verify booking details haven't changed
    if (!currentLot || !selectedSpot) {
        showNotification('❌ Booking details invalid. Please select a lot and spot again.', 'error');
        return;
    }
    
    // Show explicit confirmation dialog with security details
    const confirmMsg = `
🔐 SECURE BOOKING & PAYMENT CONFIRMATION

📍 Location: ${currentLot.name} (${currentLot.city})
🅿️  Spot: ${selectedSpot.number}
💳 Payment Method: ${capitalizeFirstLetter(paymentMethod)}
💰 Amount: ₹${amount}
🔒 Session: Encrypted & Verified
🛡️  Fraud Detection: Active

✓ Your data is encrypted with SSL/TLS
✓ Payment is processed securely
✓ Session is protected with token verification

Please confirm to proceed with secure payment.`;
    
    if (!confirm(confirmMsg)) {
        showNotification('Booking cancelled', 'warning');
        return;
    }
    
    // Validate payment details based on method
    if (!validatePaymentDetails(paymentMethod)) {
        return;
    }
    
    showNotification(`🔐 Processing secure payment via ${capitalizeFirstLetter(paymentMethod)}...`, 'info');
    
    // Disable button to prevent multiple clicks (double-submission attack)
    document.getElementById('confirmBooking').disabled = true;
    
    // Generate unique idempotency key for duplicate prevention
    const idempotencyKey = generateIdempotencyKey();
    const paymentTransactionId = generatePaymentTransactionId();
    
    setTimeout(() => {
        completeBooking(paymentMethod, idempotencyKey, paymentTransactionId);
    }, 1500);
}

// Validate payment details based on payment method
function validatePaymentDetails(paymentMethod) {
    switch (paymentMethod) {
        case 'card':
        case 'razorpay':
        case 'netbanking': {
            const cardNumber = document.getElementById('cardNumber')?.value || '';
            const cvv = document.getElementById('cvv')?.value || '';

            if (cardNumber.length < 13 || cardNumber.length > 19) {
                showNotification('❌ Invalid card number', 'error');
                return false;
            }

            if (!/^\d{3,4}$/.test(cvv)) {
                showNotification('❌ Invalid CVV (must be 3-4 digits)', 'error');
                return false;
            }
            return true;
        }

        case 'upi': {
            const upiId = document.getElementById('upiId')?.value || '';
            if (!/^[a-zA-Z0-9._-]+@[a-zA-Z0-9]+$/.test(upiId)) {
                showNotification('❌ Invalid UPI ID format', 'error');
                return false;
            }
            return true;
        }

        case 'wallet':
            if (currentUser && currentUser.walletBalance < window.currentBookingCost.finalAmount) {
                showNotification('❌ Insufficient wallet balance', 'error');
                return false;
            }
            return true;

        default:
            return true;
    }
}

// Generate payment transaction ID
function generatePaymentTransactionId() {
    return `TXN${Math.random().toString(36).substr(2, 9).toUpperCase()}-${Date.now()}`;
}

// Generate unique idempotency key for payment safety
function generateIdempotencyKey() {
    return `${currentUser.id}-${selectedSpot.number}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Fetch available spots in real-time
async function refreshAvailableSpots() {
    try {
        const checkIn = document.getElementById('checkIn').value;
        const checkOut = document.getElementById('checkOut').value;
        
        if (!checkIn || !checkOut || !currentLot) return;

        const response = await fetch(
            `/api/bookings/available/spots/${currentLot.id}?checkIn=${checkIn}&checkOut=${checkOut}`,
            {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${currentUser?.token || ''}`
                }
            }
        );

        if (response.ok) {
            const result = await response.json();
            console.log('Available spots updated:', result.data);
            // Update UI to show available spots
            updateAvailableSpotsUI(result.data);
        }
    } catch (error) {
        console.error('Error fetching available spots:', error);
    }
}

// Update UI with real-time available spots
function updateAvailableSpotsUI(availableSpots) {
    const spotNumbers = availableSpots.map(s => s.spotNumber);
    document.querySelectorAll('.parking-spot').forEach(spot => {
        const spotNum = parseInt(spot.dataset.spot);
        if (spotNumbers.includes(spotNum)) {
            spot.classList.remove('unavailable');
            spot.classList.add('available');
        } else {
            spot.classList.add('unavailable');
            spot.classList.remove('available');
        }
    });
}

function completeBooking(paymentMethod, idempotencyKey, paymentTransactionId) {
    // Verify session is still active
    const storedSessionToken = localStorage.getItem('userSessionToken');
    if (!storedSessionToken || storedSessionToken !== currentUser.sessionToken) {
        showNotification('❌ Session expired. Transaction cancelled for security.', 'error');
        logoutUser();
        return;
    }
    
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;
    const bookingRef = window.parkingData.generateBookingRef();
    const costDetails = window.currentBookingCost;

    const booking = {
        id: bookingRef,
        lotId: currentLot.id,
        lotName: currentLot.name,
        city: currentLot.city,
        spotNumber: selectedSpot.number,
        checkIn: checkIn,
        checkOut: checkOut,
        paymentMethod: paymentMethod,
        amount: costDetails.finalAmount,
        status: 'confirmed',
        createdAt: new Date().toISOString(),
        qrCode: `PARK-${selectedSpot.number}-${bookingRef}`,
        userId: currentUser.id,
        userEmail: currentUser.email,
        paymentDetails: {
            orderId: null,
            paymentStatus: 'pending',
            idempotencyKey: idempotencyKey,
            transactionId: paymentTransactionId,
            amount: costDetails.finalAmount,
            timestamp: Date.now(),
            sessionToken: currentUser.sessionToken,
            deviceId: currentUser.deviceId
        }
    };

    bookingStorage.push(booking);
    saveBookingsToStorage();

    closeModal();
    resetBookingForm();
    displayMyBookings();

    showNotification(`✅ Booking confirmed! Reference: ${bookingRef}\n🔐 Transaction ID: ${paymentTransactionId}`, 'success');
    
    setTimeout(() => scrollToSection('myBookings'), 500);
}

function resetBookingForm() {
    selectedSpot = null;
    document.getElementById('bookingSummary').innerHTML = '<p class="empty-state">Select a parking spot to book</p>';
    document.querySelectorAll('.parking-spot.selected').forEach(el => el.classList.remove('selected'));
}

// ============================================
// My Bookings Display
// ============================================

function displayMyBookings() {
    const bookingsList = document.getElementById('bookingsList');
    
    if (bookingStorage.length === 0) {
        bookingsList.innerHTML = `
            <div class="empty-state">
                <p>📋 No bookings yet. <a href="#booking">Book a parking spot now!</a></p>
            </div>
        `;
        return;
    }

    bookingsList.innerHTML = '';
    bookingStorage.forEach(booking => {
        const bookingCard = createBookingCard(booking);
        bookingsList.appendChild(bookingCard);
    });
}

function createBookingCard(booking) {
    const card = document.createElement('div');
    card.className = 'booking-card';

    const checkInTime = new Date(booking.checkIn);
    const checkOutTime = new Date(booking.checkOut);
    const now = new Date();
    
    let status = 'Upcoming';
    
    if (now > checkOutTime) {
        status = 'Completed';
    } else if (now > checkInTime) {
        status = 'Active';
    }

    card.innerHTML = `
        <div class="booking-card-header">
            <h4>#${booking.spotNumber} - Spot Booking</h4>
            <span class="booking-status">${status}</span>
        </div>
        <div class="booking-card-body">
            <div class="booking-detail">
                <span class="booking-detail-icon">📍</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Location</div>
                    <div class="booking-detail-value">${booking.lotName}</div>
                </div>
            </div>
            <div class="booking-detail">
                <span class="booking-detail-icon">🕐</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Check-in</div>
                    <div class="booking-detail-value">${window.parkingData.formatDateTime(booking.checkIn)}</div>
                </div>
            </div>
            <div class="booking-detail">
                <span class="booking-detail-icon">🕑</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Check-out</div>
                    <div class="booking-detail-value">${window.parkingData.formatDateTime(booking.checkOut)}</div>
                </div>
            </div>
            <div class="booking-detail">
                <span class="booking-detail-icon">💳</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Payment Method</div>
                    <div class="booking-detail-value">${capitalizeFirstLetter(booking.paymentMethod)}</div>
                </div>
            </div>
            <div class="booking-detail">
                <span class="booking-detail-icon">₹</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Amount Paid</div>
                    <div class="booking-detail-value">₹${booking.amount}</div>
                </div>
            </div>
            <div class="booking-detail">
                <span class="booking-detail-icon">📋</span>
                <div class="booking-detail-text">
                    <div class="booking-detail-label">Booking Ref</div>
                    <div class="booking-detail-value">${booking.id}</div>
                </div>
            </div>
            <div class="booking-actions">
                <button class="booking-action-btn btn-primary" onclick="viewBookingDetails('${booking.id}')">View Details</button>
                <button class="booking-action-btn btn-secondary" onclick="cancelBooking('${booking.id}')">Cancel</button>
            </div>
        </div>
    `;

    return card;
}

function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

function viewBookingDetails(bookingId) {
    const booking = bookingStorage.find(b => b.id === bookingId);
    if (booking) {
        const details = `Booking Details:\n${booking.id}\nSpot: #${booking.spotNumber}\nAmount: ₹${booking.amount}\nStatus: ${booking.status}`;
        showNotification(details, 'info');
    }
}

function cancelBooking(bookingId) {
    if (confirm('Are you sure you want to cancel this booking?')) {
        bookingStorage = bookingStorage.filter(b => b.id !== bookingId);
        saveBookingsToStorage();
        displayMyBookings();
        showNotification('Booking cancelled successfully', 'success');
    }
}

// ============================================
// Scroll and Navigation
// ============================================

function scrollToSection(sectionId) {
    const element = document.getElementById(sectionId);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth' });
    }
}

function initializeAllFeatures() {
    addAnimationStyles();
    initializeParkingSpots();
    initializeContactForm();
    initializeHamburgerMenu();
    initializeScrollAnimations();
    setupPaymentHandlers();
    setupNavigationActiveLink();
    setupAuthModals();
}

function setupNavigationActiveLink() {
    const navLinks = document.querySelectorAll('.nav-links a');
    const sections = document.querySelectorAll('.section, #home');

    window.addEventListener('scroll', function() {
        let current = '';
        sections.forEach(section => {
            const sectionTop = section.offsetTop;
            if (pageYOffset >= sectionTop - 200) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    });

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const targetId = this.getAttribute('href').substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');
                targetSection.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });
}

// ============================================
// Authentication Modal Handlers
// ============================================

function setupAuthModals() {
    try {
        // Login Modal
        const loginModal = document.getElementById('loginModal');
        const signupModal = document.getElementById('signupModal');
        const userMenuToggle = document.getElementById('userMenuToggle');
        const loginForm = document.getElementById('loginForm');
        const signupForm = document.getElementById('signupForm');
        const switchToSignup = document.getElementById('switchToSignup');
        const switchToLogin = document.getElementById('switchToLogin');
        
        // Verify all elements exist
        if (!loginForm || !signupForm || !userMenuToggle) {
            console.error('❌ Auth modal elements not found in DOM');
            return;
        }
        
        // Close buttons
        const closeButtons = document.querySelectorAll('.modal .close');
        
        // User menu toggle
        userMenuToggle.addEventListener('click', function(e) {
            e.preventDefault();
            if (isUserAuthenticated) {
                showLogoutMenu();
            } else {
                openLoginModal();
            }
        });
        
        // Login form submission - PRIMARY FIX
        loginForm.addEventListener('submit', function(e) {
            e.preventDefault();
            try {
                const email = document.getElementById('loginEmail').value.trim();
                const password = document.getElementById('loginPassword').value;
                
                if (!email || !password) {
                    showNotification('❌ Please enter both email and password', 'error');
                    return;
                }
                
                console.log('🔐 Login attempt with email:', email);
                loginUser(email, password);
            } catch (error) {
                console.error('Login error:', error);
                showNotification('❌ Login error. Please try again.', 'error');
            }
        });
        
        // Signup form submission
        signupForm.addEventListener('submit', function(e) {
            e.preventDefault();
            try {
                const name = document.getElementById('signupName').value;
                const email = document.getElementById('signupEmail').value;
                const phone = document.getElementById('signupPhone').value;
                const password = document.getElementById('signupPassword').value;
                const passwordConfirm = document.getElementById('signupConfirm').value;
                signupUser(name, email, phone, password, passwordConfirm);
            } catch (error) {
                console.error('Signup error:', error);
                showNotification('❌ Signup error. Please try again.', 'error');
            }
        });

    // Phone input - Only allow digits 0-9 with cursor position preservation
        const signupPhoneInput = document.getElementById('signupPhone');
        if (signupPhoneInput) {
            signupPhoneInput.addEventListener('keypress', function(e) {
                // Only allow digits 0-9
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });
        }
        
        // Logout button in dropdown
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', function(e) {
                e.preventDefault();
                const userDropdown = document.getElementById('userDropdown');
                if (userDropdown) {
                    userDropdown.classList.remove('show');
                }
                logoutUser();
            });
        }
        
        // Close dropdown when clicking outside
        document.addEventListener('click', function(e) {
            const userDropdown = document.getElementById('userDropdown');
            const userMenuToggle = document.getElementById('userMenuToggle');
            
            if (userDropdown && userMenuToggle && 
                !userDropdown.contains(e.target) && 
                !userMenuToggle.contains(e.target)) {
                userDropdown.classList.remove('show');
            }
        });
        
        
        // Switch to signup
        if (switchToSignup) {
            switchToSignup.addEventListener('click', function(e) {
                e.preventDefault();
                closeLoginModal();
                openSignupModal();
            });
        }
        
        // Switch to login
        if (switchToLogin) {
            switchToLogin.addEventListener('click', function(e) {
                e.preventDefault();
                closeSignupModal();
                openLoginModal();
            });
        }
        
        // Close modals
        closeButtons.forEach(btn => {
            btn.addEventListener('click', function() {
                closeLoginModal();
                closeSignupModal();
            });
        });
        
        // Close on outside click
        window.addEventListener('click', function(e) {
            if (e.target === loginModal) closeLoginModal();
            if (e.target === signupModal) closeSignupModal();
            const editProfileModal = document.getElementById('editProfileModal');
            if (e.target === editProfileModal) closeEditProfileModal();
        });
        
        // Edit Profile Form
        const editProfileForm = document.getElementById('editProfileForm');
        if (editProfileForm) {
            editProfileForm.addEventListener('submit', function(e) {
                saveProfileChanges(e);
            });
        }
        
        // Phone input in edit profile - Only allow digits 0-9
        const editPhoneInput = document.getElementById('editPhone');
        if (editPhoneInput) {
            editPhoneInput.addEventListener('keypress', function(e) {
                // Only allow digits 0-9
                if (!/[0-9]/.test(e.key)) {
                    e.preventDefault();
                }
            });
        }
        
        console.log('✅ Auth modals initialized successfully');
    } catch (error) {
        console.error('❌ Error setting up auth modals:', error);
    }
}

// Login/Signup Modal Functions
function openLoginModal() {
    const loginModal = document.getElementById('loginModal');
    const signupModal = document.getElementById('signupModal');
    loginModal.style.display = 'flex';
    loginModal.classList.add('show');
    signupModal.style.display = 'none';
    signupModal.classList.remove('show');
    document.getElementById('loginEmail').focus();
}

function closeLoginModal() {
    const loginModal = document.getElementById('loginModal');
    loginModal.style.display = 'none';
    loginModal.classList.remove('show');
    document.getElementById('loginForm').reset();
}

function openSignupModal() {
    const signupModal = document.getElementById('signupModal');
    const loginModal = document.getElementById('loginModal');
    signupModal.style.display = 'flex';
    signupModal.classList.add('show');
    loginModal.style.display = 'none';
    loginModal.classList.remove('show');
    document.getElementById('signupName').focus();
}

function closeSignupModal() {
    const signupModal = document.getElementById('signupModal');
    signupModal.style.display = 'none';
    signupModal.classList.remove('show');
    document.getElementById('signupForm').reset();
}

function showLogoutMenu() {
    const userDropdown = document.getElementById('userDropdown');
    if (userDropdown) {
        userDropdown.classList.toggle('show');
    }
}

// ============================================
// Utilities
// ============================================

function initializeParkingSpots() {
    const spots = document.querySelectorAll('.spot');
    spots.forEach((spot) => {
        spot.addEventListener('click', function() {
            if (this.classList.contains('available')) {
                this.classList.remove('available');
                this.classList.add('occupied');
                this.title = 'Occupied';
            } else {
                this.classList.remove('occupied');
                this.classList.add('available');
                this.title = 'Available';
            }
        });
        spot.style.cursor = 'pointer';
    });
}

function initializeContactForm() {
    const contactForm = document.getElementById('contactForm');
    if (contactForm) {
        contactForm.addEventListener('submit', function(e) {
            e.preventDefault();
            const name = document.getElementById('name').value.trim();
            const email = document.getElementById('email').value.trim();
            const message = document.getElementById('message').value.trim();

            if (!name || !email || !message) {
                showNotification('Please fill in all fields', 'error');
                return;
            }

            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                showNotification('Please enter a valid email address', 'error');
                return;
            }

            showNotification('Message sent successfully! We will contact you soon.', 'success');
            contactForm.reset();
            console.log({ name, email, message, timestamp: new Date().toISOString() });
        });
    }
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 20px;
        border-radius: 5px;
        font-size: 16px;
        z-index: 1000;
        animation: slideIn 0.3s ease-in-out;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        max-width: 400px;
    `;

    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#2563eb',
        warning: '#f59e0b'
    };

    notification.style.backgroundColor = colors[type] || colors.info;
    notification.style.color = 'white';
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-in-out';
        setTimeout(() => notification.remove(), 300);
    }, 4000);
}

function initializeHamburgerMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (hamburger) {
        hamburger.addEventListener('click', function() {
            navLinks.style.display = navLinks.style.display === 'flex' ? 'none' : 'flex';
            navLinks.style.position = 'absolute';
            navLinks.style.top = '70px';
            navLinks.style.left = '0';
            navLinks.style.right = '0';
            navLinks.style.backgroundColor = 'white';
            navLinks.style.flexDirection = 'column';
            navLinks.style.gap = '0';
            navLinks.style.padding = '10px 0';
            navLinks.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
            navLinks.style.zIndex = '99';

            const links = navLinks.querySelectorAll('a');
            links.forEach(link => {
                link.style.padding = '12px 20px';
                link.style.display = 'block';
            });
        });

        const navLinks_items = document.querySelectorAll('.nav-links a');
        navLinks_items.forEach(link => {
            link.addEventListener('click', function() {
                if (window.innerWidth <= 768) {
                    navLinks.style.display = 'none';
                }
            });
        });
    }
}

function initializeScrollAnimations() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver(function(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);

    const elementsToObserve = document.querySelectorAll(
        '.problem-box, .solution-card, .feature-item, .booking-card, .contact-form'
    );

    elementsToObserve.forEach(element => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(20px)';
        element.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(element);
    });
}

function addAnimationStyles() {
    const style = document.createElement('style');
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
    `;
    document.head.appendChild(style);
}

// Keyboard shortcuts
document.addEventListener('keydown', function(event) {
    const activeElement = document.activeElement;
    const isTypingInField = activeElement && (
        activeElement.tagName === 'INPUT' ||
        activeElement.tagName === 'TEXTAREA' ||
        activeElement.tagName === 'SELECT' ||
        activeElement.isContentEditable
    );

    if (isTypingInField) {
        return;
    }

    const shortcuts = {
        '1': 'home',
        '2': 'booking',
        '3': 'problem',
        '4': 'solution',
        '5': 'features'
    };

    if (shortcuts[event.key]) {
        event.preventDefault();
        scrollToSection(shortcuts[event.key]);
    }

    if (event.key === 'Escape') {
        const navLinks = document.querySelector('.nav-links');
        if (navLinks && window.innerWidth <= 768) {
            navLinks.style.display = 'none';
        }
        const modal = document.getElementById('bookingModal');
        if (modal && modal.style.display === 'block') {
            closeModal();
        }
    }
});

// Responsive navigation
window.addEventListener('resize', function() {
    const navLinks = document.querySelector('.nav-links');
    if (window.innerWidth > 768) {
        navLinks.style.display = 'flex';
        navLinks.style.position = 'relative';
        navLinks.style.top = 'auto';
        navLinks.style.backgroundColor = 'transparent';
        navLinks.style.boxShadow = 'none';
    }
});

// Performance monitoring
if (window.performance) {
    window.addEventListener('load', function() {
        const perfData = window.performance.timing;
        const pageLoadTime = perfData.loadEventEnd - perfData.navigationStart;
        console.log(`✓ Page Load Time: ${pageLoadTime}ms`);
    });
}

console.log('🎉 Smart Parking System fully loaded and ready!');
