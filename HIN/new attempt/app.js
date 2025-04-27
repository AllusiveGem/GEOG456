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
                    <p><strong>Safety Score:</strong> ${feature.properties.safetyScore.toFixed(2)}</p>
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
    if (typeof count !== 'yards' && count.features) {
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
    
    // Initialize routing control with custom markers
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
                    html: i === 0 ? '<i class="fas fa-map-marker-alt"></i>' : '<i class="fas fa-flag"></i>',
                    iconSize: [30, 30],
                    iconAnchor: [15, 30]
                }),
                draggable: true
            });
        },
        formatter: new L.Routing.Formatter({
            language: 'en',
            units: 'imperial'
        }),
        router: L.Routing.osrmv1({
            serviceUrl: 'https://router.project-osrm.org/route/v1',
            timeout: 30000 // (30 seconds timeout)
        })
    }).addTo(map);

    // Update instructions when route changes
    routingControl.on('routesfound', function(e) {
        var routes = e.routes;
        var summary = routes[0].summary;
        var routeMode = document.querySelector('.route-option.active').dataset.route;
        
        // Format time display
        var totalMinutes = Math.floor(summary.totalTime / 60);
        var totalSeconds = summary.totalTime % 60;
        var timeString = totalMinutes + ' min' + (totalSeconds > 0 ? ' ' + totalSeconds + ' s' : '');
        
        // Calculate route safety score
        var safetyScore = calculateRouteSafetyScore(routes[0].coordinates);
        
        // Update route summary
        document.getElementById('distance').textContent = 
            (summary.totalDistance * 0.000621371).toFixed(1) + ' mi';
        document.getElementById('time').textContent = timeString;
        document.getElementById('route-type').textContent = 
            document.querySelector('.route-option.active').textContent.trim();
        
        // Show safety info if in safest mode
        if (routeMode === 'safest') {
            document.getElementById('safety-info').style.display = 'flex';
            document.getElementById('safety-score').textContent = 
                (safetyScore * 100).toFixed(0) + '% (' + getSafetyDescriptionFromScore(safetyScore) + ')';
        } else {
            document.getElementById('safety-info').style.display = 'none';
        }
        
        document.getElementById('route-summary').style.display = 'block';
        
        // Display turn-by-turn instructions
        var instructionsContainer = document.getElementById('instructions-panel');
        instructionsContainer.innerHTML = '<div class="instructions-title">Directions</div>';
        routes[0].instructions.forEach(function(instruction, i) {
            var div = document.createElement('div');
            div.className = 'instruction';
            
            // Format instruction time
            var timeMinutes = Math.floor(instruction.time / 60);
            var timeSeconds = instruction.time % 60;
            var instructionTime = timeMinutes > 0 ? 
                timeMinutes + ' min ' + (timeSeconds > 0 ? timeSeconds + ' s' : '') : 
                timeSeconds + ' s';
            
            div.innerHTML = `
                <div class="instruction-icon">
                    <i class="fas fa-arrow-right"></i>
                </div>
                <div class="instruction-content">
                    <div class="instruction-distance">${instruction.distance} ${instruction.unit}</div>
                    <div class="instruction-text">${instruction.text}</div>
                    <div class="instruction-time">${instructionTime}</div>
                </div>`;
            instructionsContainer.appendChild(div);
        });
        
        instructionsContainer.style.display = 'block';
        
        // Highlight safer streets along the route if safest option selected
        if (routeMode === 'safest') {
            highlightSaferStreets(routes[0].coordinates);
            
            // Check for dangerous streets and potentially adjust route
            checkDangerousStreets(routes[0].coordinates);
        }
    });

    // Calculate a safety score for the route (0-1 scale)
    function calculateRouteSafetyScore(routeCoords) {
        let totalScore = 0;
        let count = 0;
        
        safetyData.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            
            // Check if this road segment is near the route
            const isNearRoute = feature.geometry.coordinates.some(line => {
                return line.some(coord => {
                    const point = L.latLng(coord[1], coord[0]);
                    return routeCoords.some(routePoint => {
                        return point.distanceTo(routePoint) < 50; // within 50 meters
                    });
                });
            });
            
            if (isNearRoute) {
                totalScore += feature.properties.safetyScore;
                count++;
            }
        });
        
        return count > 0 ? totalScore / count : 0;
    }

    function getSafetyDescriptionFromScore(score) {
        if (score >= 0.9) return 'Excellent';
        if (score >= 0.7) return 'Very Good';
        if (score >= 0.5) return 'Good';
        if (score >= 0.3) return 'Caution';
        return 'Dangerous';
    }

    function highlightSaferStreets(routeCoords) {
        if (window.safetyLayer) {
            map.removeLayer(window.safetyLayer);
        }
        
        window.safetyLayer = L.layerGroup().addTo(map);
        
        safetyData.features.forEach(feature => {
            if (!feature.geometry || !feature.geometry.coordinates) return;
            
            // Only highlight roads with low crash counts for safest route
            const isSafe = feature.properties.annualCrashes < 1.5;
            const isNearRoute = feature.geometry.coordinates.some(line => {
                return line.some(coord => {
                    const point = L.latLng(coord[1], coord[0]);
                    return routeCoords.some(routePoint => {
                        return point.distanceTo(routePoint) < 100; // within 100 meters
                    });
                });
            });
            
            if (isNearRoute && isSafe) {
                const color = getSafetyColor(feature);
                
                L.polyline(feature.geometry.coordinates.map(line => 
                    line.map(coord => [coord[1], coord[0]])
                ), {
                    color: color,
                    weight: 8, // Make safer roads more prominent
                    opacity: 0.9
                }).addTo(window.safetyLayer);
            }
        });
    }

    // Check for dangerous streets along the route and warn user
    function checkDangerousStreets(routeCoords) {
        const dangerThreshold = 3; // Annual crashes >3 per year considered dangerous
        let dangerStreets = [];
        
        safetyData.features.forEach(feature => {
            const annualCrashes = feature.properties.annualCrashes;
            const coords = feature.geometry.coordinates;
            
            if (annualCrashes > dangerThreshold && coords) {
                coords.forEach(line => {
                    line.forEach(coord => {
                        const point = L.latLng(coord[1], coord[0]);
                        routeCoords.forEach(routePoint => {
                            if (point.distanceTo(routePoint) < 50) { // 50m near route
                                dangerStreets.push({
                                    name: feature.properties.FULLNAME || 'Unnamed Road',
                                    crashes: annualCrashes,
                                    point: point
                                });
                            }
                        });
                    });
                });
            }
        });
        
        // Remove duplicates
        dangerStreets = dangerStreets.filter((street, index, self) =>
            index === self.findIndex(s => s.name === street.name)
        );
        
        if (dangerStreets.length > 0) {
            // Show warning with list of dangerous streets
            let warningMsg = 'Warning: This route passes near dangerous streets:\n\n';
            dangerStreets.forEach(street => {
                warningMsg += `• ${street.name} (${street.crashes.toFixed(1)} crashes/year)\n`;
            });
            
            warningMsg += '\nConsider adjusting your route for safety.';
            alert(warningMsg);
            
            // Add markers for dangerous streets
            dangerStreets.forEach(street => {
                L.marker(street.point, {
                    icon: L.divIcon({
                        className: 'danger-marker',
                        html: '<i class="fas fa-exclamation-triangle"></i>',
                        iconSize: [30, 30],
                        iconAnchor: [15, 30]
                    })
                }).addTo(map).bindPopup(`<b>${street.name}</b><br>${street.crashes.toFixed(1)} crashes/year`);
            });
        }
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
                
                // If there's an existing route, recalculate with new preferences
                if (routingControl.getWaypoints().length > 0) {
                    routingControl.route();
                }
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
            var url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Charlotte, NC')}&limit=1`;
            
            // Use a different CORS proxy
            var proxyUrl = 'https://api.allorigins.win/get?url=' + encodeURIComponent(url);
            
            fetch(proxyUrl)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                try {
                    const result = JSON.parse(data.contents);
                    if (result && result.length > 0) {
                        resolve(result[0]);
                    } else {
                        reject('Location not found');
                    }
                } catch (e) {
                    reject('Invalid response');
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
    
    routingControl.on('routingerror', function(e) {
        console.error('Routing error:', e.error);
        alert('Failed to calculate route: ' + e.error.message);
    });
    
    // =============================================
    // Initialize all functionality
    // =============================================
    
    initAutocomplete();
    setupButtons();
});