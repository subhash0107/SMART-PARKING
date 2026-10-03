// Parking Lot Database with Indian Cities
const parkingLotsData = {
    Vizag: [
        {
            id: 'VZ001',
            name: 'RamaKrishna Beach',
            address: 'RK Beach, Vizag',
            totalSpots: 20,
            ratePerHour: 10,
            amenities: ['CCTV', 'Security Guard', 'EV Charging']
        },
        {
            id: 'VZ002',
            name: 'Kailasa Giri',
            address: 'Hilltop, Vizag',
            totalSpots: 20,
            ratePerHour: 10,
            amenities: ['WiFi', 'Security Guard', 'CCTV']
        },
        {
            id: 'VZ003',
            name: 'Vuda Park',
            address: 'Park, Vizag',
            totalSpots: 15,
            ratePerHour: 10,
            amenities: ['Reserved Spots', 'Mobile App', 'Auto Payment']
        }
    ],
    Tirupati: [
        {
            id: 'TPT001',
            name: 'Bazaar Street',
            address: 'Street, Tirupati',
            totalSpots: 15,
            ratePerHour: 10,
            amenities: ['24/7 Monitoring', 'Valet Service', 'Restaurant']
        },
        {
            id: 'TPT002',
            name: 'Deer Park',
            address: 'Park, Tirupati',
            totalSpots: 20,
            ratePerHour: 10,
            amenities: ['CCTV', 'Security Guard', 'EV Charging']
        }
    ],
    Ongole: [
        {
            id: 'ONG001',
            name: 'Gandhi Park',
            address: 'PAndripuram, Ongole',
            totalSpots: 15,
            ratePerHour: 10,
            amenities: ['Security', 'EV Charging', 'CCTV']
        },
        {
            id: 'ONG002',
            name: 'Ongole Bull Park',
            address: 'Bull Park, Ongole',
            totalSpots: 10,
            ratePerHour: 10,
            amenities: ['Park', 'Security', 'CCTV']
        }
    ],
    Vijayawada: [
        {
            id: 'VJD001',
            name: 'Ambedkar Park',
            address: 'Park, Vijayawada',
            totalSpots: 18,
            ratePerHour: 10,
            amenities: ['IT Park', 'Food Truck', 'CCTV']
        }
    ],
    Guntur: [
        {
            id: 'GNT001',
            name: 'Pankala Narasimha Temple',
            address: 'Mangalagiri, Guntur',
            totalSpots: 20,
            ratePerHour: 10,
            amenities: ['Temple', 'CCTV', 'Security Guard']
        }
    ],
    Kadapa: [
        {
            id: 'KDP001',
            name: 'Gandikota Fort',
            address: 'Fort, Kadapa',
            totalSpots: 15,
            ratePerHour: 10,
            amenities: ['CCTV', 'Security', 'EV Charging']
        }
    ]
};

// Function to get lots for a city
function getLotsForCity(city) {
    return parkingLotsData[city] || [];
}

// Function to generate parking spots
function generateParkingSpots(totalSpots) {
    const spots = [];
    for (let i = 1; i <= totalSpots; i++) {
        spots.push({
            id: `SPOT-${String(i).padStart(3, '0')}`,
            number: i,
            status: 'unavailable',
            floor: Math.ceil(i / 30)
        });
    }
    return spots;
}

// Get available spots count
function getAvailableSpots(spots) {
    return spots.filter(s => s.status === 'available').length;
}

// Calculate parking cost
function calculateCost(checkInTime, checkOutTime, ratePerHour) {
    const checkIn = new Date(checkInTime);
    const checkOut = new Date(checkOutTime);
    const durationInMs = checkOut - checkIn;
    const durationInHours = durationInMs / (1000 * 60 * 60);
    const roundedHours = Math.ceil(durationInHours);
    const totalCost = roundedHours * ratePerHour;
    
    return {
        hours: roundedHours,
        costPerHour: ratePerHour,
        totalCost: totalCost,
        taxAmount: Math.round(totalCost * 0.18), // 18% GST
        finalAmount: Math.round(totalCost * 1.18)
    };
}

// Format time to readable format
function formatDateTime(dateTimeStr) {
    const date = new Date(dateTimeStr);
    return date.toLocaleString('en-IN', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

// Generate booking reference
function generateBookingRef() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 7).toUpperCase();
    return `PARK${random}${timestamp.toString().slice(-4)}`;
}

// Validate datetime
function isValidDateTime(checkIn, checkOut) {
    const checkInTime = new Date(checkIn);
    const checkOutTime = new Date(checkOut);
    const now = new Date();

    if (checkInTime < now) {
        return { valid: false, message: 'Check-in time must be in future' };
    }

    if (checkOutTime <= checkInTime) {
        return { valid: false, message: 'Check-out must be after check-in' };
    }

    const maxDuration = 24 * 60 * 60 * 1000; // 24 hours
    if (checkOutTime - checkInTime > maxDuration) {
        return { valid: false, message: 'Maximum booking duration is 24 hours' };
    }

    return { valid: true };
}

// Export functions
window.parkingData = {
    parkingLotsData,
    getLotsForCity,
    generateParkingSpots,
    getAvailableSpots,
    calculateCost,
    formatDateTime,
    generateBookingRef,
    isValidDateTime
};
