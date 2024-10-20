<script>
    import { onMount } from 'svelte';
    import Geolocation from 'svelte-geolocation';
    import {
        Control, ControlButton, ControlGroup, DefaultMarker,
        FillLayer, GeoJSON, hoverStateFilter, LineLayer,
        MapEvents, MapLibre, Marker, Popup,
    } from 'svelte-maplibre';
    import { getDistance, getMapBounds } from '$lib';
    import { getUserLocationWithGNSSStatus } from '$lib/utils';
    import { fade } from 'svelte/transition';
    import { lineString as turfLineString } from '@turf/helpers';
    import turfLength from '@turf/length';

    // Predefined markers with names and images
    let markers = [
        { lngLat: { lng: 144.96459814751478, lat: -37.80995056223396 }, label: 'Key POI1', name: 'State Library', image: 'images/State_Library.jpg', modalShown: false },
        { lngLat: { lng: 144.96318039790924, lat: -37.808357984258315 }, label: 'Key POI2', name: 'RMIT', image: 'images/RMIT.jpg', modalShown: false },
        { lngLat: { lng: 144.96917684226275, lat: -37.817900704255486 }, label: 'Key POI3', name: 'Federation Square', image: 'images/Federation_Square.jpg', modalShown: false },
        { lngLat: { lng: 144.96704004380317, lat: -37.818197131671816 }, label: 'Key POI4', name: 'Flinders st station', image: 'images/FlindersSt_Station.jpg', modalShown: false },
        { lngLat: { lng: 144.95251801634004, lat: -37.818339416930115 }, label: 'Key POI5', name: 'SouthernCross Station', image: 'images/SouthernCross_Station.jpg', modalShown: false },
        { lngLat: { lng: 144.9567645161061, lat: -37.80713929364221 }, label: 'Key POI6', name: 'Queen Victoria Market', image: 'images/Queen_Victoria_Market.jpg', modalShown: false },
        { lngLat: { lng: 144.95829663666132, lat: -37.81375690238818 }, label: 'Key POI7', name: 'Supreme Court', image: 'images/Supreme_Court.jpg', modalShown: false },
        { lngLat: { lng: 144.96239751929886, lat: -37.82058741142394 }, label: 'Key POI8', name: 'Sandridge Bridge', image: 'images/Sandridge_Bridge.jpg', modalShown: false }
    ];

    // Add the poiColors constant here
    const poiColors = {
        gallery: 'bg-purple-500',
        museum: 'bg-blue-500',
        attraction: 'bg-yellow-500',
        artwork: 'bg-green-500',
        default: 'bg-gray-500' // Changed to gray for any unforeseen categories
    };

    let bounds = getMapBounds(markers);
    let showGeoJSON = false;
    let geojsonData;
    let poiData; // Variable to store the POI data

    const options = { enableHighAccuracy: true, timeout: Infinity, maximumAge: 0 };
    let getPosition = false;
    let success = false;
    let error = '';
    let position = {};
    let coords = [];
    let watchPosition = false;
    let watchedPosition = {};
    let watchedMarker = {};
    let count = 0;
    let locationMessage = "";
    let isGNSS = null;
    let showModal = false;
    let selectedPlace = null;
    let mapLoaded = false;
    let walkingRouteGeojson = null;
    let walkingRouteDistance = 0;
    let gameActive = false;
    let score = 0;
    let visitedPOIs = new Set();
    let visitedMarkers = new Set();
    let walkingRouteCoordinates = [];
    let lastAddedPosition = null;
    const MIN_DISTANCE_THRESHOLD = 5;
    let medals = 0;
    let lastMedalScore = 0;
    let showMedal = false;    // New state for medal animation
    let medalEarned = false;  // Track if a medal was earned
    let signalStrength = 0; // Range from 0 to 5 to represent the number of green bars
    let markerCounter = 0; 

    function showMedalAnimation() {
        showMedal = true;
        setTimeout(() => {
            showMedal = false;
        }, 2000);  // Hide the medal after 2 seconds
    }

    function checkMedals() {
        if (score >= 100 && score - lastMedalScore >= 100) {
            medals++;
            lastMedalScore = score;
            medalEarned = true;
            showMedalAnimation();  // Trigger the medal animation here
        }
    }

    $: {
        if (score > 0) {
            checkMedals();
        }
    }
    
    // Simulate signal strength based on GNSS status or calculated value
    // Simulate signal strength based on GNSS status or calculated value
    $: {
        if (isGNSS) {
            // Replace this with actual accuracy data if available
            const accuracy = 10; // Example accuracy value (in meters)

            if (accuracy <= 5) {
                signalStrength = 5; // Excellent signal
            } else if (accuracy <= 10) {
                signalStrength = 4; // Good signal
            } else if (accuracy <= 20) {
                signalStrength = 3; // Fair signal
            } else if (accuracy <= 50) {
                signalStrength = 2; // Weak signal
            } else {
                signalStrength = 1; // Very weak signal
            }
        } else {
            signalStrength = 0; // No GNSS, all bars remain red
        }
    }

    function getNextMarkerNumber() {
        markerCounter += 1;
        return markerCounter;
    }

    function addMarkerWithNextName(e) {
        const newMarkerNumber = getNextMarkerNumber();
        const newMarker = {
            lngLat: e.detail.lngLat,
            label: `Marker ${newMarkerNumber}`,
            name: `New Place ${newMarkerNumber}`,
            modalShown: false
        };
        markers = [...markers, newMarker];
        console.log('New marker added:', newMarker);

        if (watchedMarker.lngLat) {
            calculateWalkingRoute(watchedMarker.lngLat, newMarker.lngLat);
        }
    }

    function openModal(marker) {
        selectedPlace = marker;
        showModal = true;
    }

    function closeModal() {
        showModal = false;
        selectedPlace = null;
    }

    function deleteMarker(index) {
        markers = markers.filter((_, i) => i !== index);
        // We don't decrement markerCounter here to maintain the sequence
    }

    function checkProximity() {
        if (!watchedMarker.lngLat) return;
        markers.forEach(marker => {
            const distance = getDistance([watchedMarker, marker]);
            
            if (distance <= 100) {
                // Scoring logic for pre-defined markers
                if (gameActive && marker.name && marker.image && !visitedMarkers.has(marker.label)) {
                    score += 100;
                    visitedMarkers.add(marker.label);
                    console.log(`Visited pre-defined marker: ${marker.name}, New score: ${score}`);
                    checkMedals();  // Add this line
                }
                
                // Modal display logic
                if (!marker.modalShown) {
                    if (marker && marker.name && marker.image) {
                        selectedPlace = {
                            name: marker.name,
                            image: marker.image
                        };
                        showModal = true;
                        marker.modalShown = true;
                    } else {
                        console.log('No valid data for this marker:', marker);
                    }
                }
            }
        });
    }

    function startGame() {
        gameActive = true;
        score = 0;
        medals = 0;
        lastMedalScore = 0;
        visitedPOIs.clear();
        visitedMarkers.clear();
        walkingRouteCoordinates = [];
        walkingRouteGeojson = null;
        walkingRouteDistance = 0;
        lastAddedPosition = null;
    }
    
    function clearWalkingRoute() {
        walkingRouteCoordinates = [];
        walkingRouteGeojson = null;
        walkingRouteDistance = 0;
        lastAddedPosition = null;
    }

    function endGame() {
        gameActive = false;
        console.log(`Total walking distance: ${walkingRouteDistance.toFixed(2)} meters`);
    }

    function checkProximityToPOIs() {
        if (!gameActive || !watchedMarker.lngLat) return;
        
        poiData.features.forEach(poi => {
            const poiCoords = poi.geometry.coordinates;
            const distance = getDistance([
                watchedMarker,
                { lngLat: { lng: poiCoords[0], lat: poiCoords[1] } }
            ]);
            
            if (distance <= 50 && !visitedPOIs.has(poi.id)) {
                score += 50;
                visitedPOIs.add(poi.id);
                console.log(`Visited POI: ${poi.properties.name}, New score: ${score}`);
                checkMedals();  // Add this line
            }
        });
    }
    
    function updateWalkingRouteGeojson() {
        if (walkingRouteCoordinates.length < 2) return;

        walkingRouteGeojson = {
            type: "Feature",
            properties: {},
            geometry: {
                type: "LineString",
                coordinates: walkingRouteCoordinates
            }
        };
        
        // Calculate route distance in meters
        const line = turfLineString(walkingRouteCoordinates);
        walkingRouteDistance = turfLength(line, {units: 'meters'});
    }


    async function calculateWalkingRoute(start, end) {
        const url = `https://router.project-osrm.org/route/v1/walking/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`;

        try {
            const response = await fetch(url);
            const data = await response.json();

            if (data.code === 'Ok') {
                walkingRouteGeojson = data.routes[0].geometry;
                
                // Calculate route distance in meters
                const line = turfLineString(walkingRouteGeojson.coordinates);
                walkingRouteDistance = turfLength(line, {units: 'meters'});

                console.log('Walking route calculated:', walkingRouteGeojson);
                console.log('Walking route distance:', walkingRouteDistance.toFixed(0), 'm');
            }
        } catch (error) {
            console.error('Error calculating walking route:', error);
        }
    }

    $: if (success || error) {
        getPosition = false;
    }

    $: if (success) {
        coords = [position.coords.longitude, position.coords.latitude];
        markers = [...markers, {
            lngLat: { lng: coords[0], lat: coords[1] },
            label: 'Current',
            name: null,
            image: null,
            modalShown: false
        }];
        // Reset markerCounter when adding 'Current' marker
        markerCounter = 0;
    }

    $: if (watchedPosition.coords) {
        const newPosition = {
            lng: watchedPosition.coords.longitude,
            lat: watchedPosition.coords.latitude,
        };
        watchedMarker = { lngLat: newPosition };
        
        if (gameActive) {
            const newCoords = [newPosition.lng, newPosition.lat];
            
            // Check if this is the first point or if the distance from the last point is greater than the threshold
            if (!lastAddedPosition || getDistance([
                { lngLat: { lng: lastAddedPosition[0], lat: lastAddedPosition[1] } },
                { lngLat: newPosition }
            ]) > MIN_DISTANCE_THRESHOLD) {
                walkingRouteCoordinates = [...walkingRouteCoordinates, newCoords];
                lastAddedPosition = newCoords;
                updateWalkingRouteGeojson();
            }
        }
        
        checkProximity();
        checkProximityToPOIs();
    }

    onMount(async () => {
        const response = await fetch('melbourne.geojson');
        geojsonData = await response.json();
        const poiResponse = await fetch('tourism.geojson');
        poiData = await poiResponse.json();
        console.log('POI Data loaded:', poiData.features.length, 'features');
        
        // Filter POI data to include only tourism-related places
        poiData.features = poiData.features.filter(feature => {
            const tags = feature.properties;
            return (tags.tourism && tags.tourism === 'gallery') ||
                   (tags.tourism && tags.tourism === 'artwork') ||
                   (tags.tourism && tags.tourism === 'museum') ||
                   (tags.tourism && tags.tourism === 'attraction');
        });

        getUserLocationWithGNSSStatus()
            .then(({ coords, isGNSS: gnssStatus, message }) => {
                locationMessage = message;
                isGNSS = gnssStatus;
                console.log('Coordinates:', coords);
            })
            .catch((error) => {
                locationMessage = "Error getting location: " + error.message;
            });
    });
</script>

{#if showModal}
<div class="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center z-50">
    <div class="bg-white p-5 rounded-lg w-1/2 relative">
        <button class="absolute top-2 right-2 text-xl font-bold" on:click={closeModal}>X</button>
        <h1 class="text-2xl font-bold mb-4">{selectedPlace.name}</h1>
        <img 
          src={selectedPlace.image} 
          alt={selectedPlace.name} 
          class="w-full h-auto"
          on:error={(e) => {
            console.error(`Failed to load image: ${selectedPlace.image}`);
            e.target.src = '/images/placeholder.jpg';
          }}
        />
    </div>
</div>
{/if}

<!-- Main content layout and map rendering -->
<div class="flex flex-col h-[calc(100vh-80px)] w-full bg-gray-100">
    <div class="grid grid-cols-4 gap-4 p-4">
        <!-- Geolocation Controls -->
        <div class="col-span-4 md:col-span-1 text-center mt-4"> <!-- Added mt-4 for top margin -->
            <h2 class="font-bold text-[#1e6091] text-lg mb-2">
                Click to get one-time Current Position
            </h2>
            <button class="btn bg-[#1e6091] text-white hover:bg-[#2a7ab0] w-2/5 mb-2" on:click={() => { getPosition = true }}>
                Get geolocation
            </button>
            <Geolocation {getPosition} options={options} bind:position let:loading bind:success bind:error let:notSupported>
                {#if notSupported}
                    Your browser does not support the Geolocation API.
                {:else}
                    {#if loading}Loading...{/if}
                    {#if success}Success!{/if}
                    {#if error}An error occurred. Error code {error.code}: {error.message}.{/if}
                {/if}
            </Geolocation>
            <p class="text-sm break-words text-left">Coordinates: {coords}</p>
            <p class="text-sm break-words text-left">Position: {JSON.stringify(position)}</p>
        </div>

        <!-- Watch Position Controls -->
        <div class="col-span-4 md:col-span-1 bg-white p-4 rounded-lg shadow">
            <h2 class="font-bold text-[#1e6091] text-lg mb-2">Watch Real-time Position</h2>
            <button class="btn bg-[#1e6091] text-white hover:bg-[#2a7ab0] w-full mb-2" on:click={() => { watchPosition = true }}>Start watching</button>
            <Geolocation getPosition={watchPosition} options={options} watch={true} on:position={(e) => { watchedPosition = e.detail }} />
            <p class="break-words text-left">watchedPosition: {JSON.stringify(watchedPosition)}</p>
        </div>

        <!-- GeoJSON Toggle -->
        <div class="col-span-4 md:col-span-1 bg-white p-4 rounded-lg shadow">
            <h2 class="font-bold text-[#1e6091] text-lg mb-2">Melbourne Suburbs</h2>
            <button class="btn bg-[#1e6091] text-white hover:bg-[#2a7ab0] w-full" on:click={() => { showGeoJSON = !showGeoJSON }}>Toggle Suburbs</button>
        </div>

        <!-- Add the new Score Game controls here -->
        <div class="col-span-4 md:col-span-1 bg-white p-4 rounded-lg shadow">
            <h2 class="font-bold text-[#1e6091] text-lg mb-2">CultureWalk Melbourne</h2>
            
            <!-- Place the Start Game and End Game buttons in a flex container for side-by-side layout -->
            <div class="flex space-x-2 mb-2">
                <button class="btn bg-green-500 text-white hover:bg-green-600 w-1/2" on:click={startGame} disabled={gameActive}>
                    Start Game
                </button>
                <button class="btn bg-red-500 text-white hover:bg-red-600 w-1/2" on:click={endGame} disabled={!gameActive}>
                    End Game
                </button>
            </div>
            <button class="btn bg-blue-500 text-white hover:bg-blue-600 w-full mb-2" on:click={clearWalkingRoute} disabled={!gameActive}>
                Clear Walking Route
            </button>
            <p class="text-sm text-gray-600 mt-2">
                +50 points for approaching a POI<br>
                +100 points for approaching a Key POI with IMAGE Popup.<br>
                Earn a medal for every 100 points! Players earn points by approaching cultural landmarks and can track their real-time walking distance for health bonuses.
            </p>
        </div>      
    </div>

    <!-- Legends below the map -->
    <div class="grid grid-cols-2 gap-4 p-4">
        <!-- POI Types Legend -->
        <div class="bg-white p-2 rounded-lg shadow text-xs">
            <h3 class="text-sm font-bold mb-1 text-[#1e6091]">POI Types:</h3>
            <div class="flex flex-row space-x-4">
                <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-[#1e6091] mr-1"></div><span>Gallery</span></div>
                <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-[#f59e0b] mr-1"></div><span>Museum</span></div>
                <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-[#10b981] mr-1"></div><span>Attraction</span></div>
                <div class="flex items-center"><div class="w-3 h-3 rounded-full bg-[#ef4444] mr-1"></div><span>Artwork</span></div>
            </div>
        </div>
    </div>

    <!-- Add the new score and medal bar HERE, just before the closing div tag -->
    <div class="bg-[#1e6091] text-white p-2 flex justify-between items-center">
        <div class="text-lg font-bold">Score: {score}</div>
        <div class="flex items-center">
            <span class="text-lg font-bold mr-2">Medals:</span>
            <div class="flex flex-wrap">
                {#each Array(medals) as _, i}
                    <span class="text-base" style="line-height: 1; margin-right: -0.05em;">🏅</span>
                {/each}
            </div>
        </div>
    </div>

    {#if showMedal}
    <div class="medal-animation fixed inset-x-0 bottom-0 flex items-center justify-center z-50">
        <span class="text-7xl bounce animate-medal">🏅</span>
    </div>
    {/if}

    <!-- Map -->
    <MapLibre 
        center={[144.97, -37.81]} 
        class="map flex-grow min-h-[calc(100vh-280px)] relative"
        standardControls
        style="https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json" 
        bind:bounds 
        zoom={14}
        on:load={() => {
            console.log('Map loaded');
            mapLoaded = true;
        }}
    >

        <!-- Add this part at the top of the map, centered -->
        <div class="walking-distance-indicator absolute top-4 left-1/2 transform -translate-x-1/2 bg-white bg-opacity-80 px-3 py-1 rounded-full shadow-md z-10">
            {#if walkingRouteDistance > 0}
                <div class="text-sm font-semibold">Walking Distance: {Math.round(walkingRouteDistance)} m</div>
            {:else}
                <div class="text-sm font-semibold italic">No route calculated</div>
            {/if}
        </div>
               
        <Control class="flex flex-col gap-y-2">
            <ControlGroup>
                <ControlButton on:click={() => { bounds = getMapBounds(markers) }}>Fit</ControlButton>
            </ControlGroup>
        </Control>

        
        <!-- GNSS Indicator -->
        <div class="gnss-indicator">
            <div class="signal-bars">
                <div class="bar" style="background-color: {signalStrength >= 1 ? 'green' : 'lightgrey'};"></div>
                <div class="bar" style="background-color: {signalStrength >= 2 ? 'green' : 'lightgrey'};"></div>
                <div class="bar" style="background-color: {signalStrength >= 3 ? 'green' : 'lightgrey'};"></div>
                <div class="bar" style="background-color: {signalStrength >= 4 ? 'green' : 'lightgrey'};"></div>
                <div class="bar" style="background-color: {signalStrength >= 5 ? 'green' : 'lightgrey'};"></div>
            </div>
            <div class="gnss-status">
                <p>{isGNSS ? 'GNSS' : 'No GNSS'}</p>
            </div>
        </div>

        <MapEvents on:click={addMarkerWithNextName} />


        {#if showGeoJSON}
            <GeoJSON id="geojsonData" data={geojsonData} promoteId="name">
                <FillLayer paint={{ 'fill-color': hoverStateFilter('purple', 'yellow'), 'fill-opacity': 0.3 }}
                    beforeLayerType="symbol" manageHoverState>
                    <Popup openOn="hover" let:data>
                        {@const props = data?.properties}
                        {#if props}
                            <div class="flex flex-col gap-2">
                                <p>{props.name}</p>
                            </div>
                        {/if}
                    </Popup>
                </FillLayer>
                <LineLayer layout={{ 'line-cap': 'round', 'line-join': 'round' }}
                    paint={{ 'line-color': 'purple', 'line-width': 3 }} beforeLayerType="symbol" />
            </GeoJSON>
        {/if}

        {#each markers as marker, i (i)}
            <div transition:fade={{ duration: 500 }}>
                <Marker lngLat={marker.lngLat} class="grid h-8 w-30 place-items-center rounded-md border border-gray-200 bg-red-300 text-black shadow-2xl focus:outline-2 focus:outline-black">
                    <span class="text-lg flex items-center justify-between w-full px-2">
                        {marker.label || `Marker ${i + 1}`}
                        {#if i >= 9}
                            <button on:click|stopPropagation={() => deleteMarker(i)} class="text-red-600 hover:text-red-800">
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M6 3a1 1 0 011-1h6a1 1 0 011 1v1h5a1 1 0 110 2H4a1 1 0 110-2h5V3zM5 6h10l-1 12a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6zm3 2a1 1 0 00-2 0v8a1 1 0 002 0V8zm4 0a1 1 0 00-2 0v8a1 1 0 002 0V8z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        {/if}
                    </span>
                    {#if marker.name}
                        <Popup offset={[0, -10]}>
                            <div class="text-lg font-bold">
                                {marker.name}
                            </div>
                        </Popup>
                    {/if}
                </Marker>
            </div>
        {/each}

        <!-- Display POI data -->
        {#if poiData}
            <GeoJSON id="poiData" data={poiData}>
                {#each poiData.features as feature (feature.id)}
                    <Marker lngLat={feature.geometry.coordinates} class="poi-marker">
                        <div class={`w-4 h-4 rounded-full border-2 border-white ${poiColors[feature.properties.tourism] || poiColors.default}`}></div>
                        <Popup offset={[0, -10]}>
                            <div>
                                <strong>{feature.properties.name || 'Unnamed POI'}</strong>
                                <p>{feature.properties.tourism || 'Tourism'}</p>
                            </div>
                        </Popup>
                    </Marker>
                {/each}
            </GeoJSON>
        {/if}

        <!-- Add the new walking route GeoJSON here -->
        {#if walkingRouteGeojson}
            <GeoJSON data={walkingRouteGeojson}>
                <LineLayer
                    id="walking-route"
                    layout={{ 'line-join': 'round', 'line-cap': 'round' }}
                    paint={{ 
                        'line-color': '#1e6091',
                        'line-width': 4,
                        'line-dasharray': [2, 2]
                    }}
                />
            </GeoJSON>
        {/if}

        {#if watchedMarker.lngLat}
            <DefaultMarker lngLat={watchedMarker.lngLat}>
                <div
                    class="custom-marker"
                    style="background-color: red; border-radius: 50%; width: 20px; height: 20px; position: relative; transform: translate(-50%, -50%);"
                >
                </div>
                <Popup offset={[0, -10]}>
                    <div class="text-lg font-bold">{isGNSS ? 'You' : 'No GNSS'}</div>
                </Popup>
            </DefaultMarker>
        {/if}
    </MapLibre>
</div>

<style>
    :global(body) {
        background-color: #f3f4f6;
    }

    .btn {
        @apply font-bold py-2 px-4 rounded;
    }

    .btn:disabled {
        @apply opacity-50 cursor-not-allowed;
    }

    /* Medal Scaling and Bounce Animation */
    @keyframes scaleUp {
        0% { transform: scale(0.5); }
        50% { transform: scale(1.5); }
        100% { transform: scale(1); }
    }

    @keyframes bounce {
        0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
        40% { transform: translateY(-30px); }
        60% { transform: translateY(-15px); }
    }

    @keyframes changeColor {
        0%, 100% { color: gold; }
        50% { color: orange; }
    }

    /* New Spin Animation */
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(720deg); } /* 2 full spins = 720deg */
    }

    /* Updated Medal Animation */
    .medal-animation {
        position: fixed;
        bottom: 20%; /* Middle of the bottom half */
        left: 50%;
        transform: translateX(-50%);
        animation: scaleUp 0.5s ease-out forwards, changeColor 2s infinite;
    }

    /* Bounce Twice first, then Spin */
    .bounce {
        animation: bounce 2s ease-in-out 2, spin 1s linear 2s forwards; /* Spin starts after 2 seconds */
    }

    /* GNSS indicator styling */
    .gnss-indicator {
        position: absolute;
        top: 50px;
        right: 10px;
        z-index: 1000;
        display: flex;
        flex-direction: column;
        align-items: center;
        background: white;
        padding: 5px;
        border-radius: 5px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.15);
        min-width: 60px; /* Ensure minimum width to fit "No GNSS" */
    }

    .signal-bars {
        display: flex;
        flex-direction: row;
        gap: 2px;
        margin-bottom: 2px;
    }

    .signal-bars .bar {
        width: 6px;
        height: 15px;
        transition: background-color 0.3s;
    }

    .gnss-status {
        font-size: 0.75rem;
        text-align: center;
        width: 100%;
    }

    /* Add this class for walking distance indicator placement */
    .walking-distance-indicator {
        position: absolute;
        top: 10px; /* Top of the map */
        left: 50%; /* Center horizontally */
        transform: translateX(-50%); /* Adjust for centering */
        background-color: white; /* Background for visibility */
        padding: 8px 12px; /* Padding around the text */
        border-radius: 5px; /* Rounded corners */
        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.2); /* Light shadow for elevation */
        z-index: 1000; /* Keep above map layers */
    }
</style>
 