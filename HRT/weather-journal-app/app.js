document.addEventListener('DOMContentLoaded', function() {
    // Initialize variables
    let map;
    let marker;
    let currentLat = 0;
    let currentLng = 0;
    let windyMapInstance = null;
    const pointApiKeyInput = document.getElementById('api-key');
    const mapApiKeyInput = document.getElementById('map-api-key');
    
    // DOM elements
    const saveKeyBtn = document.getElementById('save-key');
    const locationInput = document.getElementById('location-input');
    const getWeatherBtn = document.getElementById('get-weather');
    const useLocationBtn = document.getElementById('use-location');
    const weatherDataDiv = document.getElementById('weather-data');
    const journalEntry = document.getElementById('journal-entry');
    const saveEntryBtn = document.getElementById('save-entry');
    const savedEntriesDiv = document.getElementById('saved-entries');
    const coordinatesDiv = document.getElementById('coordinates');
    const windyMapContainer = document.getElementById('windy-map');
    
    // Load saved API keys from localStorage
    function loadApiKeys() {
        const savedPointKey = localStorage.getItem('windyPointApiKey');
        const savedMapKey = localStorage.getItem('windyMapApiKey');
        
        if (savedPointKey) {
            pointApiKeyInput.value = savedPointKey;
        }
        
        if (savedMapKey) {
            mapApiKeyInput.value = savedMapKey;
        }
    }
    
    // Save API keys to localStorage
    function saveApiKeys() {
        localStorage.setItem('windyPointApiKey', pointApiKeyInput.value.trim());
        localStorage.setItem('windyMapApiKey', mapApiKeyInput.value.trim());
        alert('API keys saved locally');
    }
    
    // Initialize the map
    function initMap() {
        map = L.map('map').setView([51.505, -0.09], 3);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(map);
        
        // Add click event to update location
        map.on('click', function(e) {
            updateLocation(e.latlng.lat, e.latlng.lng);
        });
    }
    
    // Update location on map and inputs
    function updateLocation(lat, lng) {
        currentLat = lat;
        currentLng = lng;
        
        // Update map view
        map.setView([lat, lng], 8);
        
        // Update or add marker
        if (marker) {
            marker.setLatLng([lat, lng]);
        } else {
            marker = L.marker([lat, lng]).addTo(map);
        }
        
        // Update coordinates display
        coordinatesDiv.textContent = `Lat: ${lat.toFixed(4)}, Lng: ${lng.toFixed(4)}`;
        
        // Reverse geocode to get location name
        reverseGeocode(lat, lng);
    }
    
    // Reverse geocode coordinates to get location name
    async function reverseGeocode(lat, lng) {
        try {
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            const data = await response.json();
            
            if (data.address) {
                let locationName = '';
                if (data.address.city) locationName = data.address.city;
                else if (data.address.town) locationName = data.address.town;
                else if (data.address.village) locationName = data.address.village;
                
                if (data.address.country) {
                    if (locationName) locationName += `, ${data.address.country}`;
                    else locationName = data.address.country;
                }
                
                if (locationName) {
                    locationInput.value = locationName;
                }
            }
        } catch (error) {
            console.error("Error in reverse geocoding: ", error);
        }
    }
    
    // Initialize Windy map
    function initWindyMap() {
        if (!window.windyInit) {
            console.error("Windy API not loaded");
            return;
        }
        
        windyMapContainer.innerHTML = '';
        
        // Get the map API key
        const mapApiKey = mapApiKeyInput.value.trim();
        
        if (!mapApiKey) {
            console.error("Map API key not provided");
            return;
        }
        
        // Initialize Windy map
        windyInit({
            key: mapApiKey,
            lat: currentLat,
            lon: currentLng,
            zoom: 5,
        }, windyAPI => {
            // Store windyAPI instance for later use
            console.log("Windy API initialized");
            windyMapInstance = windyAPI;
            const { picker, utils, broadcast } = windyAPI;

            // Set the view to current coordinates
            windyAPI.map.setView([currentLat, currentLng], 8);
            
            // Create a marker at the selected location
            const marker = L.marker([currentLat, currentLng]).addTo(windyAPI.map);
            
            // Optional: Select the most suitable overlay
            broadcast.on('redrawFinished', () => {
                console.log('Windy map render finished');
            });
        });
    }
    
    // Get weather data from Windy API
    async function getWeatherData(lat, lng) {
        try {
            // Get the point API key
            const pointApiKey = pointApiKeyInput.value.trim();
            
            if (!pointApiKey) {
                throw new Error("Point API key not provided");
            }
            
            // Initialize Windy map first
            initWindyMap();
            
            // Then get point forecast data
            const response = await fetch('https://api.windy.com/api/point-forecast/v2', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    lat: lat,
                    lon: lng,
                    model: "gfs",
                    parameters: ["temp", "wind", "rh", "dewpoint", "precip", "gust", "wind_dir"],
                    levels: ["surface"],
                    key: pointApiKey
                })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `API request failed with status ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Weather data response:", data); // Log for debugging
            displayWeatherData(data);
        } catch (error) {
            console.error("Error fetching weather data: ", error);
            weatherDataDiv.innerHTML = `<p class="error">Error fetching weather data: ${error.message}</p>`;
        }
    }
    
    // Display weather data - Fixed to properly handle the Windy API response structure
    function displayWeatherData(data) {
        // Check if data is in the expected format
        if (!data || !data.ts || !data.data) {
            weatherDataDiv.innerHTML = `<p class="error">Invalid weather data format</p>`;
            return;
        }
        
        try {
            // The first timestamp is the current data
            const currentIndex = 0;
            
            // Extract data from the response
            const temp = data.data.temp[currentIndex] !== undefined ? data.data.temp[currentIndex] : 'N/A';
            const windSpeed = data.data.wind[currentIndex] !== undefined ? data.data.wind[currentIndex] : 'N/A';
            const windGust = data.data.gust ? (data.data.gust[currentIndex] !== undefined ? data.data.gust[currentIndex] : 'N/A') : 'N/A';
            const windDir = data.data.wind_dir ? (data.data.wind_dir[currentIndex] !== undefined ? data.data.wind_dir[currentIndex] : 'N/A') : 'N/A';
            const humidity = data.data.rh[currentIndex] !== undefined ? data.data.rh[currentIndex] : 'N/A';
            const precip = data.data.precip[currentIndex] !== undefined ? data.data.precip[currentIndex] : 'N/A';
            
            // Format date from timestamp
            const date = new Date(data.ts[currentIndex] * 1000);
            const formattedDate = date.toLocaleString();
            
            weatherDataDiv.innerHTML = `
                <div class="weather-card">
                    <h3>Current Conditions (${formattedDate})</h3>
                    <p>Temperature: ${temp !== 'N/A' ? temp.toFixed(1) : 'N/A'}°C</p>
                    <p>Wind: ${windSpeed !== 'N/A' ? windSpeed.toFixed(1) : 'N/A'} km/h from ${windDir !== 'N/A' ? windDir.toFixed(0) : 'N/A'}°</p>
                    <p>Wind Gusts: ${windGust !== 'N/A' ? windGust.toFixed(1) : 'N/A'} km/h</p>
                    <p>Humidity: ${humidity !== 'N/A' ? humidity.toFixed(1) : 'N/A'}%</p>
                    <p>Precipitation: ${precip !== 'N/A' ? precip.toFixed(2) : 'N/A'} mm</p>
                </div>
            `;
        } catch (error) {
            console.error("Error displaying weather data:", error);
            weatherDataDiv.innerHTML = `<p class="error">Error displaying weather data: ${error.message}</p>`;
        }
    }
    
    // Save journal entry to local storage
    function saveJournalEntry() {
        const entryText = journalEntry.value.trim();
        if (!entryText) return;
        
        const now = new Date();
        const entryDate = now.toLocaleString();
        const weatherSnapshot = weatherDataDiv.textContent || "No weather data available";
        
        const entry = {
            date: entryDate,
            text: entryText,
            weather: weatherSnapshot,
            location: {
                name: locationInput.value,
                lat: currentLat,
                lng: currentLng
            }
        };
        
        // Get existing entries or initialize empty array
        const entries = JSON.parse(localStorage.getItem('weatherJournalEntries') || '[]');
        entries.push(entry);
        localStorage.setItem('weatherJournalEntries', JSON.stringify(entries));
        
        // Clear input and refresh display
        journalEntry.value = '';
        displaySavedEntries();
    }
    
    // Display saved journal entries
    function displaySavedEntries() {
        const entries = JSON.parse(localStorage.getItem('weatherJournalEntries') || '[]');
        savedEntriesDiv.innerHTML = '';
        
        if (entries.length === 0) {
            savedEntriesDiv.innerHTML = '<p>No entries yet. Add your first weather journal entry!</p>';
            return;
        }
        
        // Display entries in reverse chronological order
        entries.reverse().forEach(entry => {
            const entryDiv = document.createElement('div');
            entryDiv.className = 'entry';
            entryDiv.innerHTML = `
                <div class="entry-date">${entry.date}</div>
                <div class="entry-location">${entry.location.name || 'Unknown location'}</div>
                <div class="entry-weather">${entry.weather.substring(0, 100)}...</div>
                <div class="entry-text">${entry.text}</div>
            `;
            savedEntriesDiv.appendChild(entryDiv);
        });
    }
    
    // Event listeners
    saveKeyBtn.addEventListener('click', saveApiKeys);
    
    getWeatherBtn.addEventListener('click', function() {
        if (currentLat && currentLng) {
            getWeatherData(currentLat, currentLng);
        } else {
            alert('Please select a location on the map or enter a location');
        }
    });
    
    useLocationBtn.addEventListener('click', function() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                function(position) {
                    updateLocation(position.coords.latitude, position.coords.longitude);
                    getWeatherData(position.coords.latitude, position.coords.longitude);
                },
                function(error) {
                    console.error("Error getting location: ", error);
                    alert('Could not get your location. Please allow location access or select manually.');
                }
            );
        } else {
            alert('Geolocation is not supported by your browser');
        }
    });
    
    saveEntryBtn.addEventListener('click', saveJournalEntry);
    
    // Initialize the app
    loadApiKeys();
    initMap();
    displaySavedEntries();
});