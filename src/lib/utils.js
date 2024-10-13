/**
 * Compute map centre based on a list of markers
 * @param markers Map markers to compute the centre of
 * @returns Map centre
 */
export function getMapCentre(markers) {
    const lats = markers.map(marker => marker.lngLat.lat)
    const lngs = markers.map(marker => marker.lngLat.lng)
    const latMin = Math.min(...lats)
    const latMax = Math.max(...lats)
    const lngMin = Math.min(...lngs)
    const lngMax = Math.max(...lngs)
    return { lng: (lngMin + lngMax) / 2, lat: (latMin + latMax) / 2 }
}

/**
 * Compute map bounds based on a list of markers
 * @param markers Map markers to compute the bounds of
 * @returns Map bounds
 */
export function getMapBounds(markers) {
    const lats = markers.map(marker => marker.lngLat.lat)
    const lngs = markers.map(marker => marker.lngLat.lng)
    const latMin = Math.min(...lats)
    const latMax = Math.max(...lats)
    const lngMin = Math.min(...lngs)
    const lngMax = Math.max(...lngs)
    return [lngMin, latMin, lngMax, latMax]
}

/**
 * Compute the distance between two markers
 * @param markers Map markers to compute the distance between
 * @returns Distance between the two markers
 */
export function getDistance(markers) {
    if (markers.length !== 2) {
        throw new Error('This function requires exactly two markers')
    }

    const R = 6371e3 // Earth's radius in metres
    const phi1 = markers[0].lngLat.lat * Math.PI / 180 // phi, lambda in radians
    const phi2 = markers[1].lngLat.lat * Math.PI / 180
    const dPhi = (markers[1].lngLat.lat - markers[0].lngLat.lat) * Math.PI / 180
    const dLambda = (markers[1].lngLat.lng - markers[0].lngLat.lng) * Math.PI / 180

    const a = Math.sin(dPhi / 2) * Math.sin(dPhi / 2)
        + Math.cos(phi1) * Math.cos(phi2)
        * Math.sin(dLambda / 2) * Math.sin(dLambda / 2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))

    const distance = R * c // in metres

    return distance
}

export function getUserLocationWithGNSSStatus() {
  return new Promise((resolve, reject) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const coords = position.coords;
          const isGNSS = coords.accuracy <= 20; // Assuming GNSS accuracy is 20 meters or better
          resolve({ 
            coords, 
            isGNSS,
            message: isGNSS ? "" : "Location is NOT from GNSS"
          });
        },
        (error) => reject(error),
        { enableHighAccuracy: true }
      );
    } else {
      reject(new Error('Geolocation is not supported by this browser.'));
    }
  });
}
