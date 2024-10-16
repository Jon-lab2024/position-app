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

    // Predefined markers with names and images
    let markers = [
        { lngLat: { lng: 144.96459814751478, lat: -37.80995056223396 }, label: 'Marker 1', name: 'State Library', image: '/images/State_Library.jpg', modalShown: false },
        { lngLat: { lng: 144.96318039790924, lat: -37.808357984258315 }, label: 'Marker 2', name: 'RMIT', image: '/images/RMIT.jpg', modalShown: false },
        { lngLat: { lng: 144.96917684226275, lat: -37.817900704255486 }, label: 'Marker 3', name: 'Federation Square', image: '/images/Federation_Square.jpg', modalShown: false },
        { lngLat: { lng: 144.96704004380317, lat: -37.818197131671816 }, label: 'Marker 4', name: 'Flinders st station', image: '/images/FlindersSt_Station.jpg', modalShown: false },
        { lngLat: { lng: 144.95251801634004, lat: -37.818339416930115 }, label: 'Marker 5', name: 'SouthernCross Station', image: '/images/SouthernCross_Station.jpg', modalShown: false },
        { lngLat: { lng: 144.9567645161061, lat: -37.80713929364221 }, label: 'Marker 6', name: 'Queen Victoria Market', image: '/images/Queen_Victoria_Market.jpg', modalShown: false },
        { lngLat: { lng: 144.95829663666132, lat: -37.81375690238818 }, label: 'Marker 7', name: 'Supreme Court', image: '/images/Supreme_Court.jpg', modalShown: false },
        { lngLat: { lng: 144.96239751929886, lat: -37.82058741142394 }, label: 'Marker 8', name: 'Sandridge Bridge', image: '/images/Sandridge_Bridge.jpg', modalShown: false }
    ];

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

    // Helper function to get the next available marker number
    function getNextMarkerNumber() {
        let maxNumber = 0;
        markers.forEach(marker => {
            const match = marker.label.match(/Marker (\d+)/);
            if (match) {
                const number = parseInt(match[1], 10);
                if (number > maxNumber) {
                    maxNumber = number;
                }
            }
        });
        return maxNumber + 1;
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
    }

    function checkProximity() {
        if (!watchedMarker.lngLat) return;
        markers.forEach(marker => {
            if (!marker.modalShown) {
                const distance = getDistance([watchedMarker, marker]);
                if (distance <= 100) {
                    if (marker && marker.name && marker.image) {
                        selectedPlace = {
                            name: marker.name,
                            image: marker.image
                        };
                        showModal = true;
                        marker.modalShown = true;
                    } else {
                        console.log('No valid data for this marker:', marker);
                        return; // Do nothing if marker data is invalid
                    }
                }
            }
        });
    }

    $: if (success || error) {
        getPosition = false;
    }

    $: if (success) {
        coords = [position.coords.longitude, position.coords.latitude];
        markers = [...markers, {
            lngLat: { lng: coords[0], lat: coords[1] },
            label: 'Current', // No name or image for current location
            name: null,       // Intentionally left null
            image: null,      // Intentionally left null
            modalShown: false
        }];
    }

    $: if (watchedPosition.coords) {
        watchedMarker = {
            lngLat: {
                lng: watchedPosition.coords.longitude,
                lat: watchedPosition.coords.latitude,
            },
        };
        checkProximity();
    }

    onMount(async () => {
        const response = await fetch('melbourne.geojson');
        geojsonData = await response.json();
        const poiResponse = await fetch('/tourism.geojson');
        poiData = await poiResponse.json();
        
        // Filter POI data to include only tourism-related places
        poiData.features = poiData.features.filter(feature => {
            const tags = feature.properties;
            return (tags.tourism && tags.tourism === 'gallery') ||
                   (tags.tourism && tags.tourism === 'artwork') ||
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
<div class="flex flex-col h-[calc(100vh-80px)] w-full">
    <div class="grid grid-cols-4">
        <!-- Geolocation Controls -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Click button to get a one-time current position and add it to the map</h1>
            <button class="btn btn-neutral" on:click={() => { getPosition = true }}>Get geolocation</button>
            <Geolocation {getPosition} options={options} bind:position let:loading bind:success bind:error let:notSupported>
                {#if notSupported}
                    Your browser does not support the Geolocation API.
                {:else}
                    {#if loading}Loading...{/if}
                    {#if success}Success!{/if}
                    {#if error}An error occurred. Error code {error.code}: {error.message}.{/if}
                {/if}
            </Geolocation>
            <p class="break-words text-left">Coordinates: {coords}</p>
            <p class="break-words text-left">Position: {JSON.stringify(position)}</p>
        </div>

        <!-- Watch Position Controls -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Automatically updated position when moving</h1>
            <button class="btn btn-neutral" on:click={() => { watchPosition = true }}>Start watching</button>
            <Geolocation getPosition={watchPosition} options={options} watch={true} on:position={(e) => { watchedPosition = e.detail }} />
            <p class="break-words text-left">watchedPosition: {JSON.stringify(watchedPosition)}</p>
        </div>

        <!-- GeoJSON Toggle -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Toggle Melbourne Suburbs</h1>
            <button class="btn btn-neutral" on:click={() => { showGeoJSON = !showGeoJSON }}>Toggle</button>
        </div>

        <!-- Marker Count -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Found {count} markers</h1>
            The count will go up by one each time you are within 50 meters of a new marker.
        </div>
    </div>

    <!-- Map -->
    <MapLibre 
        center={[144.97, -37.81]} 
        class="map flex-grow min-h-[500px]" 
        standardControls
        style="https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json" 
        bind:bounds 
        zoom={14}
        on:load={() => {
            console.log('Map loaded');
            mapLoaded = true;
        }}
    >
        <Control class="flex flex-col gap-y-2">
            <ControlGroup>
                <ControlButton on:click={() => { bounds = getMapBounds(markers) }}>Fit</ControlButton>
            </ControlGroup>
        </Control>

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
                <Marker lngLat={marker.lngLat} class="grid h-8 w-28 place-items-center rounded-md border border-gray-200 bg-red-300 text-black shadow-2xl focus:outline-2 focus:outline-black">
                    <span class="text-lg flex items-center justify-between w-full px-2">
                        {marker.label || `Marker ${i + 1}`} {watchedMarker.lngLat ? `(${getDistance([watchedMarker, marker]).toFixed(0)}m)` : ''}
                        {#if i >= 9}
                            <button on:click|stopPropagation={() => deleteMarker(i)} class="text-red-600 hover:text-red-800">
                                <!-- SVG trash icon goes here -->
                                <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M6 3a1 1 0 011-1h6a1 1 0 011 1v1h5a1 1 0 110 2H4a1 1 0 110-2h5V3zM5 6h10l-1 12a1 1 0 01-1 1H7a1 1 0 01-1-1L5 6zm3 2a1 1 0 00-2 0v8a1 1 0 002 0V8zm4 0a1 1 0 00-2 0v8a1 1 0 002 0V8z" clip-rule="evenodd" />
                                </svg>
                            </button>
                        {/if}
                    </span>
                    <Popup openOn="hover" offset={[0, -10]}>
                        <div class="text-lg font-bold">
                            {#if i < 9}
                                {marker.name || `New Place ${i + 1}`}
                            {/if}
                        </div>
                    </Popup>
                </Marker>
            </div>
        {/each}

        <!-- Display POI data -->
        {#if poiData}
            <GeoJSON id="poiData" data={poiData}>
                {#each poiData.features as feature (feature.id)}
                    <DefaultMarker lngLat={feature.geometry.coordinates}>
                        <Popup offset={[0, -10]}>
                            <div>
                                <strong>{feature.properties.name || 'Unnamed POI'}</strong>
                                <p>{feature.properties.tourism || 'Tourism'}</p>
                            </div>
                        </Popup>
                    </DefaultMarker>
                {/each}
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
    h1 {
        color: #ff3e00;
        text-transform: uppercase;
        font-size: 2em;
        font-weight: 200;
    }
</style>
