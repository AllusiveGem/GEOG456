# Weather Journal App

A web application that fetches real-time weather data from the Windy API and allows users to write daily notes about conditions, stored in local storage.

## Features

- Fetch weather data from Windy API
- Interactive map to select locations
- Save weather journal entries with location data
- All data stored locally in browser storage
- Responsive design for all devices

## Setup

1. Clone this repository
2. Open `index.html` in a web browser
3. Enter your Windy API key when prompted

## API Key Security

For security, the API key is:
- Not hardcoded in the repository
- Stored only in the browser's local storage
- Required to be entered by the user

## Technologies Used

- HTML5, CSS3, JavaScript
- Leaflet.js for maps
- Windy API for weather data
- OpenStreetMap for map tiles
- Nominatim for reverse geocoding

## How to Use

1. Enter your Windy API key and click "Save Key"
2. Select a location on the map or enter a location name
3. Click "Get Weather" to fetch current conditions
4. Write your observations in the journal textarea
5. Click "Save Entry" to store your journal entry