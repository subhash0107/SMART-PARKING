// ============================================
// Global Variables & State Management
// ============================================

let currentLot = null;
let parkingSpots = [];
let selectedSpot = null;
let bookingStorage = [];
let currentUser = null;
let isUserAuthenticated = false;
const API_BASE_URL = 'http://localhost:5000/api';
let parkingMap = null;
let directionsService = null;
let directionsRenderer = null;
let placesAutocomplete = null;
let searchCenter = null;
let mapMarkers = [];
let mapFacilities = [];
let adminRefreshTimer = null;
let latestAdminAnalytics = null;
let activeLotSearch = null;
let activeSpotAvailabilityRequest = null;

const CITY_AREAS = {
    Vizag: ['RK Beach', 'Kailasagiri', 'VUDA Park', 'MVP Colony', 'Dwaraka Nagar'],
    Ongole: ['Gandhi Park', 'Ongole Bull Park', 'Railway Station', 'Trunk Road'],
    Tirupati: ['Tirumala Bypass', 'Srinivasa Theatre Road', 'Deer Park', 'Railway Station'],
    Vijayawada: ['Kanaka Durga Temple', 'PNBS Bus Station', 'Benz Circle', 'Prakasam Barrage'],
    Guntur: ['Mangalagiri Temple', 'Guntur Railway Station', 'Arundelpet', 'Brodipet'],
    Kadapa: ['Gandikota Fort', 'Ameen Peer Dargah', 'Kadapa Railway Station'],
    Hyderabad: ['Charminar', 'HITEC City', 'Gachibowli', 'Secunderabad', 'Banjara Hills', 'Golconda Fort', 'Hussain Sagar'],
    Warangal: ['Thousand Pillar Temple', 'Bhadrakali Temple', 'Warangal Fort', 'Hanamkonda'],
    Karimnagar: ['Karimnagar Clock Tower', 'Lower Manair Dam', 'Mankammathota'],
    Nizamabad: ['Nizamabad Fort', 'Nizamabad Railway Station', 'Bodhan Road'],
    Khammam: ['Khammam Fort', 'Khammam Railway Station', 'Wyra Road'],
    Nalgonda: ['Nalgonda Clock Tower', 'Nalgonda Railway Station', 'Devarakonda Road'],
    Mahbubnagar: ['Pillalamarri Banyan Tree', 'Mahbubnagar Railway Station', 'Clock Tower'],
    Siddipet: ['Siddipet Bus Station', 'Komuravelli Mallanna Temple', 'Ponnala'],
    Suryapet: ['Suryapet Bus Station', 'Suryapet Clock Tower', 'NH 65']
};

const AREA_CENTERS = {
    'Charminar': [17.3616, 78.4747],
    'HITEC City': [17.4435, 78.3772],
    'Gachibowli': [17.4401, 78.3489],
    'Secunderabad': [17.4399, 78.4983],
    'Banjara Hills': [17.4156, 78.4347],
    'Golconda Fort': [17.3833, 78.4011],
    'Hussain Sagar': [17.4239, 78.4738],
    'Thousand Pillar Temple': [17.9957, 79.5793],
    'Bhadrakali Temple': [17.9757, 79.5754],
    'Warangal Fort': [17.9689, 79.6020],
    'Hanamkonda': [18.0000, 79.5830],
    'Karimnagar Clock Tower': [18.4386, 79.1288],
    'Nizamabad Fort': [18.6733, 78.1000],
    'Khammam Fort': [17.2473, 80.1514],
    'Nalgonda Clock Tower': [17.0575, 79.2684],
    'Pillalamarri Banyan Tree': [16.7272, 77.9997],
    'Siddipet Bus Station': [18.1018, 78.8520],
    'Suryapet Bus Station': [17.1405, 79.6236]
};

function populateCityAreas(city) {
    const areaSelect = document.getElementById('areaSelect');
    if (!areaSelect) return;
    areaSelect.replaceChildren(new Option(city ? 'Choose a popular area...' : 'Choose a city first...', ''));
    (CITY_AREAS[city] || []).forEach(area => {
        const option = new Option(area, area);
        if (AREA_CENTERS[area]) option.dataset.center = JSON.stringify(AREA_CENTERS[area]);
        areaSelect.add(option);
    });
    areaSelect.disabled = !city;
}

function initGoogleParkingMap() {
    const status = document.getElementById('mapStatus');
    if (!window.google?.maps) {
        if (status) status.textContent = 'Google Maps could not load. Check the API key, Maps JavaScript API, Places API, and billing settings.';
        return;
    }

    parkingMap = new google.maps.Map(document.getElementById('parkingMap'), {
        center: { lat: 16.5, lng: 80.6 },
        zoom: 7,
        mapTypeControl: false
    });
    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({ map: parkingMap });
    placesAutocomplete = new google.maps.places.Autocomplete(
        document.getElementById('destinationSearch'),
        { fields: ['geometry', 'formatted_address', 'name'] }
    );
    placesAutocomplete.addListener('place_changed', () => {
        const place = placesAutocomplete.getPlace();
        if (!place.geometry?.location) {
            showNotification('Choose a suggested destination to search nearby parking.', 'warning');
            return;
        }
        searchCenter = {
            lat: place.geometry.location.lat(),
            lng: place.geometry.location.lng()
        };
        parkingMap.setCenter(searchCenter);
        parkingMap.setZoom(13);
        document.getElementById('mapStatus').textContent =
            `Showing parking facilities near ${place.formatted_address || place.name || 'your destination'}.`;
        loadLotsForMapSearch();
    });
    document.getElementById('mapStatus').textContent = 'Search a destination or use your location to find nearby parking.';
}

window.initGoogleParkingMap = initGoogleParkingMap;

function loadGoogleMaps() {
    const key = window.GOOGLE_MAPS_API_KEY;
    const status = document.getElementById('mapStatus');
    if (!key || key === 'YOUR_GOOGLE_MAPS_API_KEY') {
        status.textContent = 'Google Maps is not configured. Add a restricted API key to map-config.js to enable maps, Places search and route estimates.';
        return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&callback=initGoogleParkingMap`;
    script.async = true;
    script.defer = true;
    script.onerror = () => {
        status.textContent = 'Google Maps failed to load. Verify your key, API enablement and billing configuration.';
    };
    document.head.appendChild(script);
}

async function loadLocalMapConfiguration() {
    try {
        const response = await fetch('./map-config.js', { cache: 'no-store' });
        if (response.ok) {
            const config = await response.text();
            const match = config.match(/window\.GOOGLE_MAPS_API_KEY\s*=\s*(['"])([^'"]*)\1/);
            if (match) window.GOOGLE_MAPS_API_KEY = match[2];
        }
    } catch (error) {
        console.info('Optional local Google Maps configuration is unavailable.');
    }
    loadGoogleMaps();
}

function distanceInKm(origin, destination) {
    const radians = value => value * Math.PI / 180;
    const latitudeDelta = radians(destination.latitude - origin.lat);
    const longitudeDelta = radians(destination.longitude - origin.lng);
    const a = Math.sin(latitudeDelta / 2) ** 2 +
        Math.cos(radians(origin.lat)) * Math.cos(radians(destination.latitude)) *
        Math.sin(longitudeDelta / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function hasCoordinates(lot) {
    return lot.coordinates?.latitude !== null && lot.coordinates?.latitude !== undefined &&
        lot.coordinates?.longitude !== null && lot.coordinates?.longitude !== undefined &&
        Number.isFinite(Number(lot.coordinates.latitude)) &&
        Number.isFinite(Number(lot.coordinates.longitude));
}

function clearParkingMarkers() {
    mapMarkers.forEach(marker => marker.setMap(null));
    mapMarkers = [];
}

function renderParkingMarkers(lots) {
    if (!parkingMap || !window.google?.maps) return;
    clearParkingMarkers();
    lots.forEach(lot => {
        if (!hasCoordinates(lot)) return;
        const position = { lat: Number(lot.coordinates.latitude), lng: Number(lot.coordinates.longitude) };
        const marker = new google.maps.Marker({
            map: parkingMap,
            position,
            title: `${lot.name} (${lot.availableSpots ?? '—'} available)`
        });
        marker.addListener('click', () => selectParkingLot(lot.lotId));
        mapMarkers.push(marker);
    });
}

function clearSelectedFacility() {
    activeSpotAvailabilityRequest?.controller.abort();
    activeSpotAvailabilityRequest = null;
    currentLot = null;
    parkingSpots = [];
    selectedSpot = null;
    document.getElementById('lotName').textContent = 'Select a parking facility';
    document.getElementById('lotAddr').textContent = 'Choose a facility from the search results.';
    document.getElementById('availCount').textContent = '0';
    document.getElementById('occupCount').textContent = '0';
    document.getElementById('slotAvailabilityStatus').textContent = 'Choose a facility to load its live numbered slots.';
    document.getElementById('rates').textContent = '₹0/hr';
    document.getElementById('bookingSummary').innerHTML = '<p class="empty-state">Select a parking spot to book</p>';
    document.getElementById('navigationLink').hidden = true;
    document.getElementById('routeSummary').textContent = '';
    document.querySelectorAll('.nearby-lot-card').forEach(card => card.classList.remove('selected'));
    renderParkingGrid();
}

async function loadLotsForMapSearch() {
    const city = document.getElementById('citySelect').value;
    const query = city ? `?city=${encodeURIComponent(city)}` : '';
    const status = document.getElementById('mapStatus');
    activeLotSearch?.controller.abort();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);
    activeLotSearch = { controller, timeoutId };
    clearSelectedFacility();
    mapFacilities = [];
    clearParkingMarkers();
    document.getElementById('nearbyLots').replaceChildren();
    status.textContent = `Searching registered parking facilities${city ? ` in ${city}` : ''}...`;
    try {
        const response = await fetch(`${API_BASE_URL}/lots${query}`, { signal: controller.signal });
        const result = await response.json().catch(() => ({}));
        if (!response.ok || result.status !== 'SUCCESS') {
            throw new Error(result.message || `Parking service returned HTTP ${response.status}`);
        }

        mapFacilities = result.data.map(lot => ({
            ...lot,
            distanceKm: searchCenter && hasCoordinates(lot) ? distanceInKm(searchCenter, lot.coordinates) : null
        })).sort((a, b) => (a.distanceKm ?? Number.MAX_VALUE) - (b.distanceKm ?? Number.MAX_VALUE));

        const nearby = document.getElementById('nearbyLots');
        nearby.replaceChildren();
        mapFacilities.slice(0, 20).forEach(lot => {
            const card = document.createElement('article');
            card.className = 'nearby-lot-card';
            card.dataset.lotId = lot.lotId;
            const title = document.createElement('strong');
            title.textContent = lot.name;
            const detail = document.createElement('p');
            const availability = Number.isInteger(lot.availableSpots)
                ? `${lot.availableSpots} of ${lot.totalSpots} spots available now`
                : `${lot.totalSpots} spots · live availability loads when selected`;
            detail.textContent = `${lot.address || lot.city} · ${lot.distanceKm?.toFixed(1) ?? '—'} km away · ${availability}`;
            const button = document.createElement('button');
            button.className = 'search-button';
            button.type = 'button';
            button.textContent = 'View slots and choose facility';
            button.addEventListener('click', () => selectParkingLot(lot.lotId));
            const navigate = document.createElement('a');
            navigate.className = 'search-button navigation-link';
            navigate.href = getGoogleMapsDirectionsUrl(lot);
            navigate.target = '_blank';
            navigate.rel = 'noopener noreferrer';
            navigate.textContent = 'Navigate with Google Maps';
            card.append(title, detail, button, navigate);
            nearby.appendChild(card);
        });

        renderParkingMarkers(mapFacilities);
        if (mapFacilities.length) {
            const mappedCount = mapFacilities.filter(hasCoordinates).length;
            status.textContent =
                `Found ${mapFacilities.length} parking facilities, ${mappedCount} with map coordinates${searchCenter ? ' near your search location' : ''}.`;
        } else {
            status.textContent = city
                ? `No active parking facilities are registered in ${city} yet. Try another city or ask an operator to add facilities.`
                : 'No active parking facilities are registered yet.';
        }
    } catch (error) {
        if (activeLotSearch?.controller !== controller) return;
        if (controller.signal.aborted) {
            console.warn('Nearby parking search timed out.');
        } else {
            console.error('Nearby parking search failed:', error);
        }
        const detail = controller.signal.aborted
            ? 'The parking service took too long to respond.'
            : error instanceof TypeError
                ? 'The parking service could not be reached. Start the backend and MongoDB, then open the site through http://localhost:8080 (not as a file).'
                : error.message;
        status.textContent = `Could not load parking facilities. ${detail}`;
        const nearby = document.getElementById('nearbyLots');
        const retryButton = document.createElement('button');
        retryButton.type = 'button';
        retryButton.className = 'search-button';
        retryButton.textContent = 'Retry parking search';
        retryButton.addEventListener('click', loadLotsForMapSearch);
        nearby.replaceChildren(retryButton);
        showNotification(`Could not search parking facilities. ${detail}`, 'error');
    } finally {
        clearTimeout(timeoutId);
        if (activeLotSearch?.controller === controller) activeLotSearch = null;
    }
}

function selectParkingLot(lotId) {
    const lot = mapFacilities.find(item => item.lotId === lotId);
    if (!lot) {
        showNotification('That facility is no longer in the current search. Search again and select a facility.', 'warning');
        return;
    }

    currentLot = { ...lot, id: lot._id || lot.lotId, address: lot.address || `${lot.name}, ${lot.city}` };
    selectedSpot = null;
    loadParkingLot();
    document.querySelectorAll('.nearby-lot-card').forEach(card => {
        card.classList.toggle('selected', card.dataset.lotId === lotId);
    });
    updateParkingRoute(currentLot);
    if (hasCoordinates(lot)) {
        parkingMap?.panTo({ lat: Number(lot.coordinates.latitude), lng: Number(lot.coordinates.longitude) });
    }
}

function getGoogleMapsDirectionsUrl(lot) {
    const destination = `${lot.name}, ${lot.address || lot.city}`;
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(destination)}&travelmode=driving`;
}

function updateParkingRoute(lot) {
    if (!lot) return;
    const navigationLink = document.getElementById('navigationLink');
    navigationLink.href = getGoogleMapsDirectionsUrl(lot);
    navigationLink.hidden = false;

    if (!hasCoordinates(lot)) {
        document.getElementById('routeSummary').textContent =
            'Google Maps will navigate to the facility address. A route estimate is unavailable until the operator adds map coordinates.';
        return;
    }
    if (!searchCenter || !directionsService || !directionsRenderer) {
        document.getElementById('routeSummary').textContent =
            'Route distance and travel time are available after searching a destination or sharing your location.';
        return;
    }
    directionsService.route({
        origin: searchCenter,
        destination: { lat: Number(lot.coordinates.latitude), lng: Number(lot.coordinates.longitude) },
        travelMode: google.maps.TravelMode.DRIVING
    }, (result, status) => {
        if (status !== 'OK' || !result?.routes?.[0]?.legs?.[0]) {
            document.getElementById('routeSummary').textContent = 'A driving route estimate is unavailable for this facility.';
            return;
        }
        directionsRenderer.setDirections(result);
        const leg = result.routes[0].legs[0];
        document.getElementById('routeSummary').textContent =
            `Route to ${lot.name}: ${leg.distance.text}, about ${leg.duration.text} by car.`;
    });
}

function initializeLocationControls() {
    const button = document.getElementById('useMyLocation');
    button.addEventListener('click', () => {
        if (!navigator.geolocation) {
            showNotification('This browser does not support location lookup.', 'error');
            return;
        }
        button.disabled = true;
        navigator.geolocation.getCurrentPosition(position => {
            searchCenter = { lat: position.coords.latitude, lng: position.coords.longitude };
            if (parkingMap) {
                parkingMap.setCenter(searchCenter);
                parkingMap.setZoom(13);
            }
            document.getElementById('mapStatus').textContent = 'Searching parking near your current location.';
            loadLotsForMapSearch().finally(() => { button.disabled = false; });
        }, error => {
            button.disabled = false;
            showNotification(`Could not access your location: ${error.message}`, 'error');
        }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    });

    document.getElementById('enableNotifications').addEventListener('click', async () => {
        if (!('Notification' in window)) {
            showNotification('Browser notifications are not supported here; in-app alerts remain enabled.', 'warning');
            return;
        }
        const permission = await Notification.requestPermission();
        showNotification(permission === 'granted'
            ? 'Browser notifications enabled.'
            : 'Browser notifications were not enabled; in-app alerts remain available.',
        permission === 'granted' ? 'success' : 'info');
    });
}

function initializeAdminDashboard() {
    document.getElementById('refreshAdminDashboard').addEventListener('click', loadAdminDashboard);
    document.getElementById('facilityForm').addEventListener('submit', saveFacility);
    document.getElementById('downloadAdminReport').addEventListener('click', downloadAdminReport);
    document.getElementById('facilityReport').addEventListener('click', event => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        const button = target.closest('[data-deactivate-lot]');
        if (button) deactivateFacility(button.dataset.deactivateLot);
        const manageButton = target.closest('[data-manage-lot]');
        if (manageButton) manageParkingSlot(manageButton.dataset.manageLot);
        const editButton = target.closest('[data-edit-lot]');
        if (editButton) editFacility(editButton.dataset.editLot);
        const activateButton = target.closest('[data-activate-lot]');
        if (activateButton) setFacilityStatus(activateButton.dataset.activateLot, 'active');
    });
}

async function adminRequest(path, options = {}) {
    if (!currentUser?.token || !['admin', 'superadmin'].includes(currentUser.role)) {
        throw new Error('A signed-in parking operator account is required.');
    }
    const response = await fetch(`${API_BASE_URL}/admin${path}`, {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`,
            ...options.headers
        }
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'SUCCESS') {
        throw new Error(result.message || 'Operator request failed');
    }
    return result.data;
}

async function loadAdminDashboard() {
    if (!currentUser || !['admin', 'superadmin'].includes(currentUser.role)) return;
    try {
        const from = document.getElementById('reportFrom').value;
        const to = document.getElementById('reportTo').value;
        const query = new URLSearchParams();
        if (from) query.set('from', new Date(`${from}T00:00:00`).toISOString());
        if (to) query.set('to', new Date(`${to}T23:59:59`).toISOString());
        const suffix = query.toString() ? `?${query}` : '';
        const [statsResult, analytics, lots, bookings] = await Promise.all([
            adminRequest('/stats'),
            adminRequest(`/analytics${suffix}`),
            adminRequest('/lots'),
            adminRequest('/bookings?limit=20')
        ]);
        latestAdminAnalytics = analytics;
        renderAdminStats(statsResult.statistics);
        renderAdminTable('occupancyReport', ['Facility', 'Occupied', 'Capacity', 'Utilization'], analytics.occupancy.map(row =>
            [row.lotName, row.occupiedSpots, row.totalSpots, `${row.utilizationPercent}%`]));
        renderAdminTable('demandReport', ['Facility', 'City', 'Bookings', 'Cancelled'], analytics.bookingsByLot.map(row =>
            [row.lotName || 'Facility', row.city || '—', row.bookings, row.cancelled]));
        renderAdminTable('dailyReport', ['Date', 'Reservations'], analytics.bookingsByDay.map(row => [row._id, row.bookings]));
        renderFacilities(lots);
        renderAdminTable('adminBookings', ['Reference', 'User', 'Facility', 'Slot', 'Check-in', 'Check-out', 'Status', 'Payment'], bookings.map(booking => [
            booking.bookingId,
            booking.userId?.name || '—',
            booking.lotId?.name || '—',
            booking.spotNumber,
            new Date(booking.checkIn).toLocaleString(),
            new Date(booking.checkOut).toLocaleString(),
            booking.status,
            booking.paymentDetails?.paymentStatus || 'pending'
        ]));
    } catch (error) {
        console.error('Could not load operator dashboard:', error);
        showNotification(`Could not load operator dashboard: ${error.message}`, 'error');
    }
}

function renderAdminStats(stats) {
    const container = document.getElementById('adminStats');
    container.replaceChildren();
    const metrics = [
        ['Facilities', stats.totalLots],
        ['Reservations', stats.totalBookings],
        ['Active', stats.activeBookings],
        ['Payment pending', stats.pendingBookings],
        ['Completed', stats.completedBookings],
        ['Cancelled', stats.cancelledBookings],
        ['Registered users', stats.totalUsers],
        ['Collected revenue', `₹${stats.totalRevenue}`]
    ];
    metrics.forEach(([label, value]) => {
        const card = document.createElement('div');
        card.className = 'admin-stat-card';
        const title = document.createElement('span');
        title.textContent = label;
        const metric = document.createElement('strong');
        metric.textContent = value;
        card.append(title, metric);
        container.appendChild(card);
    });
}

function renderAdminTable(containerId, headers, rows) {
    const container = document.getElementById(containerId);
    const table = document.createElement('table');
    const thead = table.createTHead().insertRow();
    headers.forEach(header => {
        const cell = document.createElement('th');
        cell.textContent = header;
        thead.appendChild(cell);
    });
    const body = table.createTBody();
    rows.forEach(row => {
        const tr = body.insertRow();
        row.forEach(value => {
            const cell = tr.insertCell();
            cell.textContent = String(value ?? '—');
        });
    });
    container.replaceChildren(table);
}

function renderFacilities(lots) {
    const container = document.getElementById('facilityReport');
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    ['ID', 'Facility', 'City', 'Slots', 'Rate', 'Status', 'Management'].forEach(text => {
        const th = document.createElement('th');
        th.textContent = text;
        head.appendChild(th);
    });
    const body = table.createTBody();
    lots.forEach(lot => {
        const row = body.insertRow();
        [lot.lotId, lot.name, lot.city, lot.totalSpots, `₹${lot.ratePerHour}`, lot.status].forEach(text => {
            row.insertCell().textContent = String(text ?? '—');
        });
        const action = row.insertCell();
        if (lot.status === 'active') {
            const editButton = document.createElement('button');
            editButton.type = 'button';
            editButton.textContent = 'Edit capacity/rate';
            editButton.dataset.editLot = lot.lotId;
            action.appendChild(editButton);
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Manage slots';
            button.dataset.manageLot = lot.lotId;
            action.appendChild(button);
            const deactivateButton = document.createElement('button');
            deactivateButton.type = 'button';
            deactivateButton.textContent = 'Deactivate';
            deactivateButton.dataset.deactivateLot = lot.lotId;
            action.appendChild(deactivateButton);
        } else {
            const statusButton = document.createElement('button');
            statusButton.type = 'button';
            statusButton.textContent = lot.status === 'inactive' ? 'Activate' : 'Set active';
            statusButton.dataset.activateLot = lot.lotId;
            action.appendChild(statusButton);
        }
    });
    container.replaceChildren(table);
}

async function saveFacility(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    const facility = {
        lotId: fields.get('lotId').trim(),
        name: fields.get('name').trim(),
        city: fields.get('city'),
        address: fields.get('address').trim(),
        coordinates: { latitude: Number(fields.get('latitude')), longitude: Number(fields.get('longitude')) },
        totalSpots: Number(fields.get('totalSpots')),
        ratePerHour: Number(fields.get('ratePerHour'))
    };
    try {
        await adminRequest('/lots', { method: 'POST', body: JSON.stringify(facility) });
        form.reset();
        await loadAdminDashboard();
        showNotification('Parking facility added.', 'success');
    } catch (error) {
        showNotification(`Could not add facility: ${error.message}`, 'error');
    }
}

async function deactivateFacility(lotId) {
    if (!confirm(`Deactivate facility ${lotId}?`)) return;
    try {
        await adminRequest(`/lots/${encodeURIComponent(lotId)}`, { method: 'DELETE' });
        await loadAdminDashboard();
        showNotification(`Facility ${lotId} deactivated.`, 'success');
    } catch (error) {
        showNotification(`Could not deactivate facility: ${error.message}`, 'error');
    }
}

async function setFacilityStatus(lotId, status) {
    try {
        await adminRequest(`/lots/${encodeURIComponent(lotId)}/status`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
        await loadAdminDashboard();
        showNotification(`Facility ${lotId} set to ${status}.`, 'success');
    } catch (error) {
        showNotification(`Could not update facility status: ${error.message}`, 'error');
    }
}

async function manageParkingSlot(lotId) {
    const spotText = prompt(`Enter the slot number at ${lotId} to update:`);
    if (spotText === null) return;
    const spotNumber = Number(spotText);
    if (!Number.isInteger(spotNumber) || spotNumber < 1) {
        showNotification('Enter a valid positive slot number.', 'error');
        return;
    }
    const status = prompt('Enter slot status: available, occupied, or maintenance', 'occupied');
    if (!status) return;
    try {
        await adminRequest(`/lots/${encodeURIComponent(lotId)}/spots/${spotNumber}`, {
            method: 'PUT',
            body: JSON.stringify({ status: status.trim().toLowerCase() })
        });
        await loadAdminDashboard();
        showNotification(`Updated ${lotId} slot ${spotNumber} to ${status}.`, 'success');
    } catch (error) {
        showNotification(`Could not update slot: ${error.message}`, 'error');
    }
}

async function editFacility(lotId) {
    try {
        const lots = await adminRequest('/lots');
        const lot = lots.find(item => item.lotId === lotId);
        if (!lot) throw new Error('Facility not found');
        const totalSpots = prompt('Set total slot capacity:', String(lot.totalSpots));
        if (totalSpots === null) return;
        const ratePerHour = prompt('Set hourly rate in rupees:', String(lot.ratePerHour));
        if (ratePerHour === null) return;
        const values = { totalSpots: Number(totalSpots), ratePerHour: Number(ratePerHour) };
        if (!Number.isInteger(values.totalSpots) || values.totalSpots < 1 ||
            !Number.isFinite(values.ratePerHour) || values.ratePerHour < 1) {
            throw new Error('Capacity and hourly rate must be positive numbers.');
        }
        await adminRequest(`/lots/${encodeURIComponent(lotId)}`, {
            method: 'PUT',
            body: JSON.stringify(values)
        });
        await loadAdminDashboard();
        showNotification(`Updated facility ${lotId}.`, 'success');
    } catch (error) {
        showNotification(`Could not update facility: ${error.message}`, 'error');
    }
}

function downloadAdminReport() {
    if (!latestAdminAnalytics) {
        showNotification('Load the operator report before downloading it.', 'warning');
        return;
    }
    const rows = [
        ['Facility', 'City', 'Bookings', 'Cancelled', 'Capacity', 'Occupied', 'Utilization'],
        ...latestAdminAnalytics.bookingsByLot.map(row => {
            const occupancy = latestAdminAnalytics.occupancy.find(item => item.lotId === row.lotId);
            return [row.lotName, row.city, row.bookings, row.cancelled, occupancy?.totalSpots, occupancy?.occupiedSpots, `${occupancy?.utilizationPercent ?? 0}%`];
        })
    ];
    const csv = rows.map(row => row.map(value => `"${String(value ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    link.download = 'parking-demand-and-utilization.csv';
    link.click();
    URL.revokeObjectURL(link.href);
}

// ============================================
// Real-Time Socket.IO Setup
// ============================================

// Initialize Socket.IO connection (enable real-time features)
let socket = null;
let isConnectedToRealtime = false;

function initializeRealTimeConnection() {
    if (typeof window.io === 'undefined') {
        console.warn('⚠️ Socket.IO library not available; continuing without real-time updates.');
        return;
    }

    // Connect to WebSocket server
    socket = io('http://localhost:5000', {
        auth: { token: currentUser?.token || '' },
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
        if (currentLot) subscribeToLotUpdates(currentLot.lotId || currentLot.id);
        bookingStorage.forEach(booking => subscribeToBookingUpdates(booking.id));
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
        if (currentLot && (currentLot.lotId === data.lotId || currentLot.id === data.lotId)) {
            refreshAvailableSpots();
        }
        if (currentUser && ['admin', 'superadmin'].includes(currentUser.role)) loadAdminDashboard();
    });

    socket.on('booking:updated', (data) => {
        console.log('Real-time: Booking updated', data);
        updateLocalBookingStatus(data.bookingId, data.status);
        displayMyBookings();
        if (currentUser && ['admin', 'superadmin'].includes(currentUser.role)) loadAdminDashboard();
    });

    socket.on('booking:cancelled', (data) => {
        console.log('Real-time: Booking cancelled', data);
        if (currentLot && (currentLot.lotId === data.lotId || currentLot.id === data.lotId)) {
            refreshAvailableSpots();
        }
        const cancelledBooking = bookingStorage.find(booking => booking.id === data.bookingId);
        if (cancelledBooking) {
            cancelledBooking.status = 'cancelled';
            saveBookingsToStorage();
            showNotification(`Booking ${data.bookingId} cancelled with refund ₹${data.refund}`, 'info');
        }
        displayMyBookings();
        if (currentUser && ['admin', 'superadmin'].includes(currentUser.role)) loadAdminDashboard();
    });

    socket.on('spot:updated', data => {
        if (currentLot && (currentLot.lotId === data.lotId || currentLot.id === data.lotId)) {
            refreshAvailableSpots();
        }
        if (currentUser && ['admin', 'superadmin'].includes(currentUser.role)) loadAdminDashboard();
    });

    // Real-time payment updates
    socket.on('payment:confirmed', (data) => {
        console.log('Real-time: Payment confirmed', data);
        showNotification(`✓ Payment confirmed for booking ${data.bookingId || data.orderId}`, 'success');
        updateLocalPaymentStatus(data.bookingId || data.orderId, 'completed');
    });

    socket.on('payment:failed', (data) => {
        console.log('Real-time: Payment failed', data);
        showNotification(`✗ Payment failed for order ${data.orderId}`, 'error');
        updateLocalPaymentStatus(data.bookingId || data.orderId, 'failed');
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

function updateRealtimeAuthentication() {
    if (!socket) return;
    socket.auth = { token: currentUser?.token || '' };
    if (socket.connected) socket.disconnect();
    socket.connect();
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
    const bookingIndex = bookingStorage.findIndex(b =>
        b.id === orderId || b.paymentDetails?.orderId === orderId
    );
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
        const response = await fetch(`${API_BASE_URL}/users/login`, {
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
            if (!result.data?.token) {
                showNotification('Login failed because the service did not return a secure booking session.', 'error');
                return false;
            }
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
                role: user.role || 'user',
                ipAddress: 'user-session-' + Math.random().toString(36).substr(2, 9),
                deviceId: generateDeviceId(),
                walletBalance: user.walletBalance || 0
            };
            isUserAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('lastLoginTime', new Date().toISOString());
            localStorage.setItem('userSessionToken', user.token);
            updateUserUI();
            updateRealtimeAuthentication();
            closeLoginModal();
            console.log('✅ Login successful via MongoDB backend!');
            showNotification('✓ Login Successful! Welcome ' + currentUser.name, 'success');
            openUserProfile();
            return true;
        }

        const message = response.status === 401
            ? 'Email or password is incorrect.'
            : result.message || 'The login service could not create a secure session.';
        console.warn('⚠️ Backend login failed:', message);
        showNotification(message, 'error');
        if (response.status === 401) recordFailedLogin(loginIdentifier);
        return false;
    } catch (error) {
        console.error('❌ Backend login unavailable:', error);
        showNotification('Login is unavailable because the parking service could not be reached. Please try again when it is online.', 'error');
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
        const response = await fetch(`${API_BASE_URL}/users/register`, {
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
            if (!result.data?.token) {
                showNotification('Account creation failed because the service did not return a secure booking session.', 'error');
                return false;
            }
            const user = result.data;
            currentUser = {
                id: user.userId,
                email: user.email,
                name: user.name,
                phone: user.phone || phone,
                loginTime: new Date().toISOString(),
                sessionToken: user.token,
                token: user.token,
                role: user.role || 'user',
                ipAddress: 'user-session-' + Math.random().toString(36).substr(2, 9),
                deviceId: generateDeviceId(),
                walletBalance: 0
            };
            isUserAuthenticated = true;
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            localStorage.setItem('lastLoginTime', new Date().toISOString());
            localStorage.setItem('userSessionToken', user.token);
            updateUserUI();
            updateRealtimeAuthentication();
            closeSignupModal();
            showNotification('✅ Account created successfully! Welcome ' + name, 'success');
            return true;
        }

        showNotification(result.message || 'Registration failed because the service did not create a secure account session.', 'error');
        return false;
    } catch (error) {
        console.error('❌ Backend registration unavailable:', error);
        showNotification('Registration is unavailable because the parking service could not be reached. Please try again when it is online.', 'error');
        return false;
    }
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
    updateRealtimeAuthentication();
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
        
        if (userDropdownName) {
            userDropdownName.innerHTML = `👋 ${currentUser.name}<br><small style="font-weight: normal; font-size: 12px;">@${currentUser.email}</small>`;
        }
        userDropdown.classList.remove('show');
        displayProfile();
    } else {
        userMenuToggle.innerHTML = '👤 Login';
        userMenuToggle.style.background = 'linear-gradient(135deg, #2563eb, #1e40af)';
        userDropdown.classList.remove('show');
        displayProfileNotAuthenticated();
    }
    const adminNavItem = document.getElementById('adminNavItem');
    const adminDashboard = document.getElementById('adminDashboard');
    const isOperator = Boolean(currentUser && ['admin', 'superadmin'].includes(currentUser.role));
    adminNavItem.hidden = !isOperator;
    adminDashboard.hidden = !isOperator;
    if (isOperator) {
        loadAdminDashboard();
        if (!adminRefreshTimer) adminRefreshTimer = setInterval(() => {
            if (!document.hidden) loadAdminDashboard();
        }, 30000);
    } else if (adminRefreshTimer) {
        clearInterval(adminRefreshTimer);
        adminRefreshTimer = null;
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

function openUserProfile() {
    if (!isUserAuthenticated || !currentUser) return;
    displayProfile();
    document.getElementById('userDropdown')?.classList.remove('show');
    location.hash = 'profile';
    requestAnimationFrame(() => document.getElementById('profile')?.scrollIntoView({ behavior: 'smooth' }));
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
    if (!currentUser || !currentUser.token) {
        showNotification('A backend-connected account is required to create a live booking. Please log in while the API is running.', 'error');
        return false;
    }
    return true;
}

async function loadBookingsFromStorage() {
    if (!currentUser || !currentUser.token) {
        bookingStorage = [];
        displayMyBookings();
        return;
    }

    try {
        const response = await fetch(`${API_BASE_URL}/bookings/user/${encodeURIComponent(currentUser.id)}`, {
            headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const result = await response.json();
        if (!response.ok || result.status !== 'SUCCESS') {
            throw new Error(result.message || 'Unable to load bookings');
        }

        bookingStorage = result.data.map(booking => ({
            id: booking.bookingId,
            lotId: booking.lotId?.lotId || booking.lotId?._id,
            lotName: booking.lotId?.name || 'Parking lot',
            city: booking.lotId?.city || '',
            spotNumber: booking.spotNumber,
            checkIn: booking.checkIn,
            checkOut: booking.checkOut,
            paymentMethod: booking.paymentDetails?.paymentMethod || '',
            amount: booking.paymentDetails?.totalAmount || 0,
            status: booking.status,
            createdAt: booking.createdAt,
            qrCode: booking.qrCode,
            paymentDetails: booking.paymentDetails
        }));
        bookingStorage.forEach(booking => subscribeToBookingUpdates(booking.id));
        displayMyBookings();
    } catch (error) {
        console.error('Unable to load bookings from the API:', error);
        showNotification(`Could not load your live bookings: ${error.message}`, 'error');
    }
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
    loadLocalMapConfiguration();
    initializeLocationControls();
    initializeAdminDashboard();
    
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
    const searchButton = document.getElementById('searchSpots');

    if (!citySelect || !searchButton) {
        console.error('❌ Required DOM elements not found');
        return;
    }

    // City change handler
    citySelect.addEventListener('change', function() {
        console.log('🏙️ City selected:', this.value);
        populateCityAreas(this.value);
        loadLotsForMapSearch();
    });
    const areaSelect = document.getElementById('areaSelect');
    areaSelect?.addEventListener('change', function() {
        if (!this.value) return;
        const area = this.value;
        const city = citySelect.value;
        document.getElementById('destinationSearch').value = `${area}, ${city}, India`;
        const center = this.options[this.selectedIndex].dataset.center;
        const coordinates = center ? JSON.parse(center) : null;
        searchCenter = coordinates ? { lat: coordinates[0], lng: coordinates[1] } : null;
        if (searchCenter && parkingMap) {
            parkingMap.setCenter(searchCenter);
            parkingMap.setZoom(14);
        }
        document.getElementById('mapStatus').textContent =
            `Selected ${area}, ${city}. Showing registered parking facilities${searchCenter ? ' nearest to this area' : ` in ${city}`}.`;
        loadLotsForMapSearch();
    });

    // Search button handler
    searchButton.addEventListener('click', validateAndSearch);

    // Set minimum datetime to now
    const now = new Date(Date.now() + 60000);
    now.setSeconds(0, 0);
    const checkInValue = toLocalDateTimeInputValue(now);
    document.getElementById('checkIn').min = checkInValue;
    document.getElementById('checkIn').value = checkInValue;
    updateCheckOut();

    document.getElementById('checkOut').addEventListener('change', updateCheckOut);
    document.getElementById('checkIn').addEventListener('change', () => {
        document.getElementById('checkOut').value = '';
        updateCheckOut();
        if (currentLot) refreshAvailableSpots();
    });
    document.getElementById('checkOut').addEventListener('change', () => {
        if (currentLot) refreshAvailableSpots();
    });
}

function toLocalDateTimeInputValue(date) {
    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
}

function updateCheckOut() {
    const checkInInput = document.getElementById('checkIn').value;
    if (checkInInput) {
        const checkInTime = new Date(checkInInput);
        const checkOutTime = new Date(checkInTime.getTime() + 1 * 60 * 60 * 1000);
        const checkOutInput = document.getElementById('checkOut');
        checkOutInput.min = checkInInput;
        if (!checkOutInput.value || new Date(checkOutInput.value) <= checkInTime) {
            checkOutInput.value = toLocalDateTimeInputValue(checkOutTime);
        }
    }
}

async function validateAndSearch() {
    console.log('🔍 Validating and searching...');
    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;

    if (!checkIn || !checkOut) {
        showNotification('Set both check-in and check-out times to search for available spots.', 'error');
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

    if (!currentLot) {
        const nearbyLots = document.getElementById('nearbyLots');
        const mapStatus = document.getElementById('mapStatus');
        if (!mapFacilities.length) {
            await loadLotsForMapSearch();
            if (!mapFacilities.length) return;
        }

        if (mapFacilities.length === 1) {
            selectParkingLot(mapFacilities[0].lotId);
            return;
        } else {
            mapStatus.textContent = 'Choose the parking facility you want. Its individual live slots will appear below.';
            nearbyLots.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nearbyLots.querySelector('.nearby-lot-card button')?.focus();
            showNotification('Select your parking facility to see its individual slots.', 'info');
            return;
        }

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
        
        document.getElementById('availCount').textContent = '…';
        document.getElementById('occupCount').textContent = '…';
        document.getElementById('slotAvailabilityStatus').textContent =
            `Loading live slots for ${currentLot.name}…`;

        renderParkingGrid();
        subscribeToLotUpdates(currentLot.lotId || currentLot.id);
        refreshAvailableSpots();
        
        document.getElementById('bookingSummary').innerHTML = '<p class="empty-state">Select a parking spot to book</p>';

        scrollToSection('booking');
        console.log('✅ Parking lot loaded successfully');
        showNotification(`Loaded ${currentLot.name}; checking live availability…`, 'info');
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
        spotElement.dataset.lotId = currentLot?.lotId || currentLot?.id || '';
        spotElement.textContent = spot.number;
        const facilityLocation = currentLot
            ? `${currentLot.name}, ${currentLot.address}`
            : 'No facility selected';
        spotElement.title = `${spot.status === 'available' ? 'Available' : spot.status} - Spot ${spot.number} at ${facilityLocation}`;
        spotElement.setAttribute('aria-label', `${spot.status === 'available' ? 'Available' : spot.status}, spot ${spot.number}, ${facilityLocation}`);

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
                <span class="summary-value">${currentLot.name}, ${currentLot.address}</span>
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
        <button class="book-button" onclick="openBookingModal()">Reserve Spot</button>
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
            <span class="modal-detail-value">${currentLot.name}, ${currentLot.address}</span>
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

async function processPayment() {
    const selectedMethod = document.querySelector('.payment-btn.selected');
    if (!selectedMethod) {
        showNotification('Please select a payment method', 'error');
        return;
    }

    if (!checkAuthentication()) return;

    const paymentMethod = selectedMethod.dataset.method;
    const amount = window.currentBookingCost.finalAmount;
    if (amount < 10 || amount > 100000) {
        showNotification('❌ Invalid amount. Allowed range: ₹10 - ₹100,000', 'error');
        return;
    }

    if (!currentLot || !selectedSpot) {
        showNotification('❌ Booking details invalid. Please select a lot and spot again.', 'error');
        return;
    }

    const confirmed = confirm(
        `Create a reservation at ${currentLot.name}, ${currentLot.address}, spot ${selectedSpot.number}, for ₹${amount} using ${capitalizeFirstLetter(paymentMethod)}? Payment is not charged here and will remain pending until a payment provider confirms it.`
    );
    if (!confirmed) {
        showNotification('Booking cancelled', 'warning');
        return;
    }

    const button = document.getElementById('confirmBooking');
    button.disabled = true;
    showNotification('Creating reservation with the live parking service…', 'info');
    try {
        await completeBooking(paymentMethod);
    } catch (error) {
        console.error('Live reservation failed:', error);
        showNotification(`Reservation failed: ${error.message}`, 'error');
        button.disabled = false;
        refreshAvailableSpots();
    }
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

// Fetch available spots in real-time
async function refreshAvailableSpotsLegacy() {
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
function updateAvailableSpotsUILegacy(availableSpots) {
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
    if (booking.status === 'cancelled') {
        status = 'Cancelled';
    } else if (booking.status === 'pending') {
        status = 'Payment pending';
    } else if (booking.status === 'completed' || now > checkOutTime) {
        status = 'Completed';
    } else if (booking.status === 'active' || now > checkInTime) {
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
                    <div class="booking-detail-value">${booking.lotName}${booking.address ? `, ${booking.address}` : ''}</div>
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

        const profileLink = document.querySelector('#userDropdown a[href="#profile"]');
        profileLink?.addEventListener('click', function(e) {
            e.preventDefault();
            openUserProfile();
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
    if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        new Notification('Smart Parking', { body: String(message) });
    }
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

async function refreshAvailableSpots() {
    if (!currentLot || !parkingSpots.length) return;

    const checkIn = document.getElementById('checkIn').value;
    const checkOut = document.getElementById('checkOut').value;
    if (!checkIn || !checkOut) return;

    activeSpotAvailabilityRequest?.controller.abort();
    const controller = new AbortController();
    let timedOut = false;
    const timeoutId = setTimeout(() => {
        timedOut = true;
        controller.abort();
    }, 10000);
    activeSpotAvailabilityRequest = { controller, timeoutId };
    const lotIdentifier = currentLot.lotId || currentLot.id;

    try {
        const query = new URLSearchParams({
            checkIn: new Date(checkIn).toISOString(),
            checkOut: new Date(checkOut).toISOString()
        });
        const response = await fetch(
            `${API_BASE_URL}/lots/${encodeURIComponent(lotIdentifier)}/spots?${query}`,
            { signal: controller.signal }
        );
        const result = await response.json().catch(() => ({}));
        if (activeSpotAvailabilityRequest?.controller !== controller) return;
        if (!response.ok || result.status !== 'SUCCESS' || !Array.isArray(result.data)) {
            throw new Error(result.message || 'Unable to check spot availability');
        }
        const validStatuses = new Set(['available', 'reserved', 'occupied', 'maintenance']);
        if (result.data.some(spot =>
            !Number.isInteger(Number(spot.spotNumber)) || !validStatuses.has(spot.status)
        )) {
            throw new Error('The facility returned invalid slot availability data. Ask the operator to check this location.');
        }
        const spotNumbers = new Set(result.data.map(spot => Number(spot.spotNumber)));
        if (result.data.length !== parkingSpots.length ||
            spotNumbers.size !== parkingSpots.length ||
            parkingSpots.some(spot => !spotNumbers.has(spot.number))) {
            throw new Error('The facility returned an incomplete slot list. Ask the operator to sync its slot capacity.');
        }
        updateAvailableSpotsUI(result.data);
        document.getElementById('slotAvailabilityStatus').textContent =
            `${parkingSpots.filter(spot => spot.status === 'available').length} of ${parkingSpots.length} slots available for the selected time. Select a green slot to continue.`;
    } catch (error) {
        if (activeSpotAvailabilityRequest?.controller !== controller) return;
        if (controller.signal.aborted && !timedOut) return;
        console.error('Error fetching live spot availability:', error);
        parkingSpots.forEach(spot => { spot.status = 'unavailable'; });
        selectedSpot = null;
        renderParkingGrid();
        document.getElementById('availCount').textContent = '0';
        document.getElementById('occupCount').textContent = String(parkingSpots.length);
        const message = timedOut
            ? 'Live slot search timed out. Check that the updated backend and MongoDB are running, then search again.'
            : error instanceof TypeError
                ? 'The parking service could not be reached. Start the backend and MongoDB, then search again.'
                : error.message;
        document.getElementById('slotAvailabilityStatus').textContent =
            `Slots cannot be reserved until live availability loads. ${message}`;
        showNotification(message, 'error');
    } finally {
        clearTimeout(timeoutId);
        if (activeSpotAvailabilityRequest?.controller === controller) {
            activeSpotAvailabilityRequest = null;
        }
    }
}

function updateAvailableSpotsUI(availableSpots) {
    const statusByNumber = new Map(availableSpots.map(spot => [Number(spot.spotNumber), spot.status || 'available']));
    parkingSpots.forEach(spot => {
        spot.status = statusByNumber.get(spot.number) || 'occupied';
    });
    if (selectedSpot && statusByNumber.get(selectedSpot.number) !== 'available') selectedSpot = null;
    const availableCount = parkingSpots.filter(spot => spot.status === 'available').length;
    document.getElementById('availCount').textContent = String(availableCount);
    document.getElementById('occupCount').textContent = String(parkingSpots.length - availableCount);
    renderParkingGrid();
}

async function completeBooking(paymentMethod) {
    if (!currentUser || !currentUser.token ||
        localStorage.getItem('userSessionToken') !== currentUser.token) {
        showNotification('Your backend session expired. Please log in again.', 'error');
        logoutUser();
        return;
    }
    if (!currentLot || !selectedSpot) {
        throw new Error('Select a currently available spot before reserving.');
    }

    const response = await fetch(`${API_BASE_URL}/bookings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${currentUser.token}`
        },
        body: JSON.stringify({
            lotId: currentLot.lotId || currentLot.id,
            spotNumber: selectedSpot.number,
            checkIn: new Date(document.getElementById('checkIn').value).toISOString(),
            checkOut: new Date(document.getElementById('checkOut').value).toISOString(),
            paymentMethod
        })
    });
    const result = await response.json();
    if (!response.ok || result.status !== 'SUCCESS') {
        throw new Error(result.message || 'The booking could not be created');
    }

    const booking = {
        id: result.data.bookingId,
        lotId: currentLot.lotId || currentLot.id,
        lotName: currentLot.name,
        address: currentLot.address,
        city: currentLot.city,
        spotNumber: result.data.spotNumber,
        checkIn: result.data.checkIn,
        checkOut: result.data.checkOut,
        paymentMethod,
        amount: result.data.amount,
        status: result.data.status,
        createdAt: new Date().toISOString(),
        qrCode: result.data.qrCode,
        paymentDetails: { paymentStatus: 'pending' }
    };

    bookingStorage.unshift(booking);
    saveBookingsToStorage();
    subscribeToBookingUpdates(booking.id);
    closeBookingModal();
    resetBookingForm();
    displayMyBookings();
    await refreshAvailableSpots();
    showNotification(`Reservation created: ${booking.id}. Payment is pending confirmation.`, 'success');
    setTimeout(() => scrollToSection('myBookings'), 500);
}

async function cancelBooking(bookingId) {
    const booking = bookingStorage.find(item => item.id === bookingId);
    if (!booking || !currentUser || !currentUser.token) {
        showNotification('Unable to cancel this live booking. Please log in again.', 'error');
        return;
    }
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
        const response = await fetch(`${API_BASE_URL}/bookings/${encodeURIComponent(bookingId)}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${currentUser.token}` }
        });
        const result = await response.json();
        if (!response.ok || result.status !== 'SUCCESS') {
            throw new Error(result.message || 'Unable to cancel booking');
        }
        booking.status = 'cancelled';
        saveBookingsToStorage();
        displayMyBookings();
        if (currentLot && currentLot.lotId === booking.lotId) await refreshAvailableSpots();
        showNotification('Booking cancelled successfully', 'success');
    } catch (error) {
        console.error('Live booking cancellation failed:', error);
        showNotification(`Could not cancel booking: ${error.message}`, 'error');
    }
}
