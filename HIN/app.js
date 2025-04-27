// app.js - Complete working implementation with all fixes

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map centered on Charlotte
    var map = L.map('map').setView([35.2271, -80.8431], 13);

    // Add base tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // =============================================
    // 1. Prepare safety data from count.js
    // =============================================
    
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

    // Create a road network layer with clickable popups
    var roadNetwork = L.geoJSON(safetyData, {
        style: function(feature) {
            return {
                color: getSafetyColor(feature),
                weight: 4,
                opacity: 0.7
            };
        },
        onEachFeature: function(feature, layer) {
            if (feature.properties) {
                var popupContent = `<div class="road-popup">
                    <h3>${feature.properties.FULLNAME || 'Unnamed Road'}</h3>
                    <p><strong>Safety:</strong> ${getSafetyDescription(feature)}</p>
                    <p><strong>Annual Crashes:</strong> ${feature.properties.annualCrashes}</p>
                    <p><strong>Total Crashes (2007-2023):</strong> ${feature.properties.totalCrashes}</p>
                </div>`;
                
                layer.bindPopup(popupContent);
            }
        }
    }).addTo(map);

    function getSafetyDescription(feature) {
        const annual = feature.properties.annualCrashes;
        
        if (annual === 0) return "Excellent (0 crashes/year)";
        if (annual < 0.5) return "Very Good (<0.5 crashes/year)";
        if (annual < 1.5) return "Good (~1 crash/year)";
        if (annual < 3) return "Caution (1.5-3 crashes/year)";
        if (annual < 5) return "Dangerous (3-5 crashes/year)";
        return "Very Dangerous (5+ crashes/year)";
    }

    function getSafetyColor(feature) {
        const annual = feature.properties.annualCrashes;
        
        if (annual === 0) return '#00ff00'; // green - perfectly safe
        if (annual < 0.5) return '#a6d96a'; // light green
        if (annual < 1.5) return '#fee08b'; // yellow
        if (annual < 3) return '#fdae61';   // orange
        if (annual < 5) return '#f46d43';   // dark orange
        return '#d73027';                   // red
    }

    // =============================================
    // 2. Address search and autocomplete
    // =============================================
    
    // Extract road names from the existing count.js data
    var roadNames = [];
    if (typeof count !== 'undefined' && count.features) {
        roadNames = count.features
            .map(feature => feature.properties.FULLNAME)
            .filter(name => name && name.trim() !== '')
            .filter((name, index, self) => self.indexOf(name) === index); // Remove duplicates
    }

    // Common Charlotte addresses (will be supplemented with geocoding)
    var charlotteAddresses = [
        "201 E Trade St, Charlotte, NC",  // Spectrum Center
        "550 S Caldwell St, Charlotte, NC",  // Bank of America Stadium
        "1000 NC Music Factory Blvd, Charlotte, NC",  // Music Factory
        "300 E 7th St, Charlotte, NC",  // 7th Street Public Market
        "400 S Tryon St, Charlotte, NC",  // Charlotte City Hall
        "500 S Tryon St, Charlotte, NC",  // Main Library
        "600 S College St, Charlotte, NC",  // NASCAR Hall of Fame
        "101 S Tryon St, Charlotte, NC",  // Duke Energy Center
        "200 E Stonewall St, Charlotte, NC",  // Convention Center
        "1300 S Blvd, Charlotte, NC"  // Freedom Park
    ];

    // Initialize autocomplete for address inputs
    function initAutocomplete() {
        var fromInput = document.getElementById('from');
        var toInput = document.getElementById('to');
        var fromSuggestions = document.getElementById('from-suggestions');
        var toSuggestions = document.getElementById('to-suggestions');
        
        // Add event listeners to show suggestions
        fromInput.addEventListener('input', function() {
            showSuggestions(this, fromSuggestions);
        });
        
        toInput.addEventListener('input', function() {
            showSuggestions(this, toSuggestions);
        });
        
        // Close suggestions when clicking elsewhere
        document.addEventListener('click', function(e) {
            if (e.target !== fromInput && e.target !== toInput) {
                fromSuggestions.style.display = 'none';
                toSuggestions.style.display = 'none';
            }
        });
    }

    // Show suggestions based on input
    function showSuggestions(input, suggestionsList) {
        var query = input.value.trim();
        suggestionsList.innerHTML = '';
        
        if (!query || query.length < 2) {
            suggestionsList.style.display = 'none';
            return;
        }
        
        // First show local suggestions
        var localSuggestions = roadNames.concat(charlotteAddresses)
            .filter(item => item.toLowerCase().includes(query.toLowerCase()))
            .slice(0, 5);
        
        localSuggestions.forEach(item => {
            var li = document.createElement('li');
            li.textContent = item;
            li.addEventListener('click', function() {
                input.value = item;
                suggestionsList.style.display = 'none';
            });
            suggestionsList.appendChild(li);
        });
        
        if (localSuggestions.length > 0) {
            suggestionsList.style.display = 'block';
        } else {
            suggestionsList.style.display = 'none';
        }
    }

    // =============================================
    // 3. Routing functionality
    // =============================================
    
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
        }),
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1'
        })
    }).addTo(map);

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
        var instructionsContainer = document.getElementById('instructions-panel');
        instructionsContainer.innerHTML = '<div class="instructions-title">Directions</div>';
        routes[0].instructions.forEach(function(instruction, i) {
            var div = document.createElement('div');
            div.className = 'instruction';
            div.innerHTML = `
                <div class="instruction-icon">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="instruction-content">
                    <div class="instruction-distance">${instruction.distance} ${instruction.unit}</div>
                    <div class="instruction-text">${instruction.text}</div>
                </div>`;
            instructionsContainer.appendChild(div);
        });
        
        instructionsContainer.style.display = 'block';
        
        // Highlight safer streets along the route
        highlightSaferStreets(routes[0].coordinates);
    });

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

    // =============================================
    // 4. Button functionality
    // =============================================
    
    function setupButtons() {
        // Zoom buttons
        document.getElementById('zoom-in').addEventListener('click', function() {
            map.zoomIn();
        });
        
        document.getElementById('zoom-out').addEventListener('click', function() {
            map.zoomOut();
        });
        
        // Current location button
        document.getElementById('current-location').addEventListener('click', function() {
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function(position) {
                    map.flyTo([position.coords.latitude, position.coords.longitude], 15);
                    
                    // Add a marker at current location
                    if (window.currentLocationMarker) {
                        map.removeLayer(window.currentLocationMarker);
                    }
                    
                    window.currentLocationMarker = L.marker([position.coords.latitude, position.coords.longitude], {
                        icon: L.divIcon({
                            className: 'current-location-marker',
                            html: '<i class="fas fa-location-dot"></i>',
                            iconSize: [30, 30]
                        })
                    }).addTo(map);
                    
                    // Add circle for accuracy
                    L.circle([position.coords.latitude, position.coords.longitude], {
                        radius: position.coords.accuracy,
                        color: '#4285F4',
                        fillColor: '#4285F4',
                        fillOpacity: 0.2
                    }).addTo(map);
                }, function(error) {
                    alert('Error getting location: ' + error.message);
                }, {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                });
            } else {
                alert('Geolocation is not supported by your browser');
            }
        });
        
        // Route type buttons
        document.querySelectorAll('.route-option').forEach(button => {
            button.addEventListener('click', function() {
                document.querySelectorAll('.route-option').forEach(btn => {
                    btn.classList.remove('active');
                });
                this.classList.add('active');
            });
        });
        
        // Sidebar toggle button
        document.getElementById('toggle-sidebar').addEventListener('click', function() {
            var sidebar = document.getElementById('sidebar');
            sidebar.classList.toggle('sidebar-hidden');
            
            var icon = this.querySelector('i');
            if (sidebar.classList.contains('sidebar-hidden')) {
                icon.classList.remove('fa-chevron-left');
                icon.classList.add('fa-chevron-right');
            } else {
                icon.classList.remove('fa-chevron-right');
                icon.classList.add('fa-chevron-left');
            }
        });
        
        // Go button
        document.getElementById('go-button').addEventListener('click', function() {
            var from = document.getElementById('from').value;
            var to = document.getElementById('to').value;
            
            if (!from || !to) {
                alert("Please enter both starting point and destination");
                return;
            }
            
            // Clear previous instructions
            var instructionsContainer = document.getElementById('instructions-panel');
            instructionsContainer.innerHTML = '';
            instructionsContainer.style.display = 'none';
            
            // Try to find coordinates from road names first
            var fromCoords = findRoadCoordinates(from);
            var toCoords = findRoadCoordinates(to);
            
            if (fromCoords && toCoords) {
                // Both locations found in our road data
                setRoute(fromCoords, toCoords);
            } else {
                // Use geocoding for addresses not in our road data
                geocodeAddresses(from, to);
            }
        });
    }

    // Find coordinates for a road name in our data
    function findRoadCoordinates(roadName) {
        if (!roadName) return null;
        
        // Find the feature with this road name
        var feature = safetyData.features.find(f => 
            f.properties.FULLNAME && 
            f.properties.FULLNAME.toLowerCase() === roadName.toLowerCase()
        );
        
        if (feature && feature.geometry && feature.geometry.coordinates) {
            // Get the first coordinate of the first line in the MultiLineString
            const coords = feature.geometry.coordinates[0][0];
            // Convert from EPSG:3857 to WGS84 (lat/lng)
            return [coords[1], coords[0]];
        }
        
        return null;
    }

    // Geocode addresses using Nominatim (with CORS proxy)
    function geocodeAddresses(from, to) {
        Promise.all([
            geocodeAddress(from),
            geocodeAddress(to)
        ]).then(function(results) {
            var fromLoc = results[0];
            var toLoc = results[1];
            
            if (!fromLoc || !toLoc) {
                alert("Could not find one or both locations");
                return;
            }
            
            setRoute([fromLoc.lat, fromLoc.lon], [toLoc.lat, toLoc.lon]);
        }).catch(function(error) {
            console.error('Geocoding error:', error);
            alert("Error finding locations. Please try different addresses.");
        });
    }

    // Geocode a single address using a CORS proxy
    function geocodeAddress(address) {
        return new Promise((resolve, reject) => {
            // Use a CORS proxy to avoid CORS issues with Nominatim
            var url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Charlotte, NC')}&limit=1`;
            var proxyUrl = 'https://cors-anywhere.herokuapp.com/' + url;
            
            fetch(proxyUrl, {
                headers: {
                    'X-Requested-With': 'XMLHttpRequest'
                }
            })
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (data && data.length > 0) {
                    resolve(data[0]);
                } else {
                    reject('Location not found');
                }
            })
            .catch(error => {
                reject(error);
            });
        });
    }

    // Set the route with given coordinates
    function setRoute(fromCoords, toCoords) {
        routingControl.setWaypoints([
            L.latLng(fromCoords[0], fromCoords[1]),
            L.latLng(toCoords[0], toCoords[1])
        ]);
        
        // Zoom to the route
        map.fitBounds(L.latLngBounds(
            [fromCoords[0], fromCoords[1]],
            [toCoords[0], toCoords[1]]
        ), {padding: [50, 50]});
    }

    // =============================================
    // Initialize all functionality
    // =============================================
    
    initAutocomplete();
    setupButtons();
});