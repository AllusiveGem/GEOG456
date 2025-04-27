// Initialize the map centered on Charlotte
var map = L.map('map').setView([35.2271, -80.8431], 13);

// Add base tiles with a Google Maps-like appearance
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
}).addTo(map);

// Add geocoder control for address search
L.Control.geocoder({
    defaultMarkGeocode: false,
    position: 'topleft',
    placeholder: 'Search addresses...',
    errorMessage: 'Address not found.'
}).on('markgeocode', function(e) {
    map.fitBounds(e.geocode.bbox);
}).addTo(map);

// Add locate control
L.control.locate({
    position: 'topleft',
    drawCircle: true,
    follow: true,
    setView: 'untilPan',
    keepCurrentZoomLevel: true,
    markerStyle: {
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.8
    },
    circleStyle: {
        weight: 1,
        clickable: false
    },
    icon: 'fa fa-location-arrow',
    metric: true,
    strings: {
        title: "Show my location",
        popup: "You are within {distance} {unit} from this point",
        outsideMapBoundsMsg: "You seem located outside the map bounds"
    },
    locateOptions: {
        maxZoom: 16,
        watch: true,
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 10000
    }
}).addTo(map);

// Convert your GeoJSON to a safer format with annualized weights
function prepareSafetyData(geojson) {
    const dataYears = 17; // January 2007 - December 2023 = 17 years
    
    return {
        type: "FeatureCollection",
        features: geojson.features.map(feature => {
            // Convert null crash counts to 0 and calculate annual average
            const totalCrashes = feature.properties.CrashID_co || 0;
            const annualCrashes = totalCrashes / dataYears;
            
            // Enhanced safety score calculation
            let safetyScore;
            
            if (totalCrashes === 0) {
                safetyScore = 1.0; // Perfectly safe
            } else {
                safetyScore = 1 / (1 + Math.log1p(annualCrashes * 3));
            }
            
            return {
                ...feature,
                properties: {
                    ...feature.properties,
                    safetyScore: safetyScore,
                    totalCrashes: totalCrashes,
                    annualCrashes: parseFloat(annualCrashes.toFixed(2))
                }
            };
        })
    };
}

var safetyData = prepareSafetyData(count);

// Create a road network layer
var roadNetwork = L.geoJSON(safetyData, {
    style: function(feature) {
        return {
            color: getSafetyColor(feature),
            weight: 4,
            opacity: 0.7
        };
    }
}).addTo(map);

// Helper function to get color based on annual crash rate
function getSafetyColor(feature) {
    const annual = feature.properties.annualCrashes;
    
    if (annual === 0) return '#00ff00'; // green - perfectly safe
    if (annual < 0.5) return '#a6d96a'; // light green
    if (annual < 1.5) return '#fee08b'; // yellow
    if (annual < 3) return '#fdae61';   // orange
    if (annual < 5) return '#f46d43';   // dark orange
    return '#d73027';                   // red
}

// Initialize routing control
var routingControl = L.Routing.control({
    waypoints: [],
    routeWhileDragging: true,
    showAlternatives: false,
    altLineOptions: {
        styles: [
            {color: 'black', opacity: 0.15, weight: 9},
            {color: 'white', opacity: 0.8, weight: 6},
            {color: '#4285F4', opacity: 1, weight: 4}
        ]
    },
    createMarker: function(i, wp) {
        return L.marker(wp.latLng, {
            icon: L.divIcon({
                className: 'route-marker',
                html: i === 0 ? 'A' : 'B',
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            }),
            draggable: true
        });
    },
    formatter: new L.Routing.Formatter({
        language: 'en',
        units: 'imperial'
    })
}).addTo(map);

// Create instructions control
var instructions = L.Routing.instructionControl({
    show: false, // We'll show our own instructions
    compact: false,
    waypointNameFallback: 'Location'
});

// Add custom instructions panel
var instructionsContainer = L.DomUtil.create('div', 'instructions-panel');
document.querySelector('.directions-container').appendChild(instructionsContainer);

// Update instructions when route changes
routingControl.on('routesfound', function(e) {
    var routes = e.routes;
    var summary = routes[0].summary;
    
    // Update route summary
    document.getElementById('distance').textContent = 
        (summary.totalDistance * 0.000621371).toFixed(1) + ' mi';
    document.getElementById('time').textContent = 
        Math.round(summary.totalTime) + ' min';
    document.getElementById('route-type').textContent = 
        document.querySelector('.route-option.active').textContent.trim();
    
    document.getElementById('route-summary').style.display = 'block';
    
    // Display turn-by-turn instructions
    instructionsContainer.innerHTML = '<h3>Directions</h3>';
    routes[0].instructions.forEach(function(instruction, i) {
        var div = L.DomUtil.create('div', 'instruction');
        div.innerHTML = 
            `<span class="distance">${instruction.distance} ${instruction.unit}</span>
             <span class="text">${instruction.text}</span>`;
        instructionsContainer.appendChild(div);
    });
    
    // Highlight safer streets along the route
    highlightSaferStreets(routes[0].coordinates);
});

// Function to highlight safer streets near the route
function highlightSaferStreets(routeCoords) {
    if (window.safetyLayer) {
        map.removeLayer(window.safetyLayer);
    }
    
    window.safetyLayer = L.layerGroup().addTo(map);
    
    safetyData.features.forEach(feature => {
        if (!feature.geometry || !feature.geometry.coordinates) return;
        
        const isNearRoute = feature.geometry.coordinates.some(line => {
            return line.some(coord => {
                const point = L.latLng(coord[1], coord[0]);
                return routeCoords.some(routePoint => {
                    return point.distanceTo(routePoint) < 100; // within 100 meters
                });
            });
        });
        
        if (isNearRoute) {
            const color = getSafetyColor(feature);
            
            L.polyline(feature.geometry.coordinates.map(line => 
                line.map(coord => [coord[1], coord[0]])
            ), {
                color: color,
                weight: 6,
                opacity: 0.9
            }).addTo(window.safetyLayer);
        }
    });
}

// Handle the Go button click
document.getElementById('go-button').addEventListener('click', function() {
    var from = document.getElementById('from').value;
    var to = document.getElementById('to').value;
    var routeType = document.querySelector('.route-option.active').dataset.route;
    
    if (!from || !to) {
        alert("Please enter both starting point and destination");
        return;
    }
    
    // Clear previous instructions
    instructionsContainer.innerHTML = '';
    
    // Use geocoding to find locations
    var geocoder = L.Control.Geocoder.nominatim();
    
    // Geocode both addresses
    Promise.all([
        new Promise((resolve) => {
            geocoder.geocode(from, function(results) {
                resolve(results && results.length ? results[0] : null);
            });
        }),
        new Promise((resolve) => {
            geocoder.geocode(to, function(results) {
                resolve(results && results.length ? results[0] : null);
            });
        })
    ]).then(function(results) {
        var fromLoc = results[0];
        var toLoc = results[1];
        
        if (!fromLoc || !toLoc) {
            alert("Could not find one or both locations");
            return;
        }
        
        // Set waypoints and route
        routingControl.setWaypoints([
            L.latLng(fromLoc.center.lat, fromLoc.center.lng),
            L.latLng(toLoc.center.lat, toLoc.center.lng)
        ]);
        
        // Zoom to the route
        map.fitBounds(L.latLngBounds(
            [fromLoc.center.lat, fromLoc.center.lng],
            [toLoc.center.lat, toLoc.center.lng]
        ), {padding: [50, 50]});
    });
});

// Add CSS for instructions panel
var style = document.createElement('style');
style.textContent = `
    .instructions-panel {
        margin-top: 20px;
        max-height: 300px;
        overflow-y: auto;
        background: #f9f9f9;
        border-radius: 4px;
        padding: 10px;
    }
    .instructions-panel h3 {
        color: #4285F4;
        margin-bottom: 10px;
        font-size: 16px;
    }
    .instruction {
        padding: 8px 0;
        border-bottom: 1px solid #eee;
    }
    .instruction:last-child {
        border-bottom: none;
    }
    .instruction .distance {
        display: inline-block;
        width: 80px;
        color: #5f6368;
        font-size: 13px;
    }
    .instruction .text {
        font-size: 14px;
    }
`;
document.head.appendChild(style);