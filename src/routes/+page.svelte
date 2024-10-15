<script>
    import { onMount } from 'svelte'
    import Geolocation from 'svelte-geolocation'
    import {
        Control, ControlButton, ControlGroup, DefaultMarker,
        FillLayer, GeoJSON, hoverStateFilter, LineLayer,
        MapEvents, MapLibre, Marker, Popup,
    } from 'svelte-maplibre' // DoNotChange

    import { getDistance, getMapBounds } from '$lib'
    import { getUserLocationWithGNSSStatus } from '$lib/utils';

    // Marker data
    let markers = [
        { lngLat: { lng: 144.9638347277324, lat: -37.80967960080751 }, label: 'Marker 1', name: 'This is a marker' },
        { lngLat: { lng: 144.96318039790924, lat: -37.808357984258315 }, label: 'Marker 2', name: 'This is a marker' },
        { lngLat: { lng: 144.96280297287632, lat: -37.80668719932231 }, label: 'Marker 3', name: 'This is a marker' },
    ]

    // Map related variables
    let bounds = getMapBounds(markers)
    let showGeoJSON = false
    let geojsonData

    // Geolocation related variables
    const options = { enableHighAccuracy: true, timeout: Infinity, maximumAge: 0 }
    let getPosition = false
    let success = false
    let error = ''
    let position = {}
    let coords = []
    let watchPosition = false
    let watchedPosition = {}
    let watchedMarker = {}
    let count = 0
    let locationMessage = "";
    let isGNSS = null;
    // The count will go up by one each time you are within 10 meters
    // Functions
    function addMarker(e, label, name) {
        markers = [...markers, { lngLat: e.detail.lngLat, label, name }]
    }

    // Reactive statements
    $: if (success || error) {
        getPosition = false
    }

    $: if (success) {
        coords = [position.coords.longitude, position.coords.latitude]
        markers = [...markers, { lngLat: { lng: coords[0], lat: coords[1] }, label: 'Current', name: 'This is the current position' }]
    }

    $: if (watchedPosition.coords) {
        watchedMarker = {
            lngLat: {
                lng: watchedPosition.coords.longitude,
                lat: watchedPosition.coords.latitude,
            },
        }

        markers.forEach((marker) => {
            const distance = getDistance([watchedMarker, marker])
            if (distance <= 10) {
                count += 1
            }
        })
    }

    // onMount functions
    onMount(async () => {
        const response = await fetch('melbourne.geojson')
        geojsonData = await response.json()

        getUserLocationWithGNSSStatus()
            .then(({ coords, isGNSS: gnssStatus, message }) => {
                locationMessage = message;
                isGNSS = gnssStatus;
                console.log('Coordinates:', coords);
            })
            .catch((error) => {
                locationMessage = "Error getting location: " + error.message;
            });
    })

    let markerCounter = markers.length; // Start counting from the number of existing markers

    // Function to generate the next marker name
    function getNextMarkerName() {
        markerCounter++; // Increment counter only when a new marker is added
        return `Marker ${markerCounter}`;
    }

    // Function to add a marker with the next name
    function addMarkerWithNextName(e) {
        const newMarkerName = getNextMarkerName();
        addMarker(e, newMarkerName, `This is ${newMarkerName}`);
    }

    // Function to calculate the distance between user and marker
    function getMarkerDistance(markerLngLat) {
        if (watchedMarker && watchedMarker.lngLat) {
            const distance = getDistance([watchedMarker, { lngLat: markerLngLat }]);
            return Math.round(distance); // Round to nearest meter
        }
        return null; // If watchedMarker is not available or doesn't have lngLat, return null
    }

    // Reactive statement to update marker labels with distance in meters
    $: markerLabels = markers.map(marker => {
        const distance = getMarkerDistance(marker.lngLat);
        return distance !== null ? `${marker.label} (${distance}m)` : marker.label;
    });
</script>

<div class="flex flex-col h-[calc(100vh-80px)] w-full">
    <div class="grid grid-cols-4">
        <!-- Geolocation Controls -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Click button to get a one-time current position and add it to the map</h1>
            <button class="btn btn-neutral" on:click={() => { getPosition = true }}>
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
            <p class="break-words text-left">Coordinates: {coords}</p>
            <p class="break-words text-left">Position: {JSON.stringify(position)}</p>
            <div class="text-center font-medium text-red-500">Note: In some browsers, you cannot repeatedly request the current location. If you need to continuously update the location, use the watch option below.</div>
        </div>

        <!-- Watch Position Controls -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Automatically updated position when moving</h1>
            <button class="btn btn-neutral" on:click={() => { watchPosition = true }}>
                Start watching
            </button>
            <Geolocation getPosition={watchPosition} options={options} watch={true} on:position={(e) => { watchedPosition = e.detail }} />
            <p class="break-words text-left">watchedPosition: {JSON.stringify(watchedPosition)}</p>
        </div>

        <!-- GeoJSON Toggle -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Toggle Melbourne Suburbs</h1>
            <button class="btn btn-neutral" on:click={() => { showGeoJSON = !showGeoJSON }}>
                Toggle
            </button>
        </div>

        <!-- Marker Count -->
        <div class="col-span-4 md:col-span-1 text-center">
            <h1 class="font-bold">Found {count} markers</h1>
            The count will go up by one each time you are within 10 meters of a marker.
        </div>
    </div>

    <!-- Map -->
    <MapLibre center={[144.97, -37.81]} class="map flex-grow min-h-[500px]" standardControls
        style="https://tiles.basemaps.cartocdn.com/gl/voyager-gl-style/style.json" bind:bounds zoom={14}>
        <Control class="flex flex-col gap-y-2">
            <ControlGroup>
                <ControlButton on:click={() => { bounds = getMapBounds(markers) }}>
                    Fit
                </ControlButton>
            </ControlGroup>
        </Control>

        <!-- Handle map events to add a marker with the next name -->
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

        <!-- Display markers with distances in the label -->
        {#each markers as { lngLat, label, name }, i (i)}
            <Marker {lngLat} class="grid h-8 w-20 place-items-center rounded-md border border-gray-200 bg-red-300 text-black shadow-2xl focus:outline-2 focus:outline-black">
                <span class="text-lg">
                    {markerLabels[i]}
                </span>
                <Popup openOn="hover" offset={[0, -10]}>
                    <div class="text-lg font-bold">{name}</div>
                </Popup>
            </Marker>
        {/each}

        {#if watchedMarker.lngLat}
            <DefaultMarker lngLat={watchedMarker.lngLat}>
                <Popup offset={[0, -10]}>
                    <div class="text-lg font-bold">
                        {isGNSS ? 'You' : 'No GNSS'}
                    </div>
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
