// ===== MAP INIT =====
const map = L.map('map', { 
  center: DEFAULT_SETTINGS.mapDefaultCenter, 
  zoom: DEFAULT_SETTINGS.mapDefaultZoom, 
  zoomControl: false 
});
L.control.zoom({ position: 'topright' }).addTo(map);

const satelliteLayer = L.tileLayer(TILE_LAYERS.SATELLITE.url, {
  attribution: TILE_LAYERS.SATELLITE.attribution,
  maxZoom: TILE_LAYERS.SATELLITE.maxZoom
});
const satelliteLabels = L.tileLayer(TILE_LAYERS.SATELLITE_LABELS.url, {
  maxZoom: TILE_LAYERS.SATELLITE_LABELS.maxZoom
});
satelliteLayer.addTo(map);
satelliteLabels.addTo(map);

// ===== GPS =====
let labelsVisible = true;

function toggleLabels() {
  const btn = document.getElementById('labelsBtn');
  if (labelsVisible) {
    map.removeLayer(satelliteLabels);
    btn.classList.add('active');
  } else {
    map.addLayer(satelliteLabels);
    btn.classList.remove('active');
  }
  labelsVisible = !labelsVisible;
}

function initGPS() {
  if (!navigator.geolocation) { setGPSStatus('error', 'GPS tidak tersedia'); return; }
  navigator.geolocation.watchPosition(
    (pos) => {
      const { latitude, longitude, accuracy } = pos.coords;
      myLocation = { lat: latitude, lng: longitude, accuracy };
      setGPSStatus('locked', `Akurasi: ${Math.round(accuracy)}m`);
      const latlng = [latitude, longitude];
      if (!myMarker) {
        const icon = L.divIcon({ className: 'custom-marker', html: '<div class="my-location-marker"></div>', iconSize: [16, 16], iconAnchor: [8, 8] });
        myMarker = L.marker(latlng, { icon, zIndexOffset: 1000 }).addTo(map);
        myMarker.bindPopup('<strong>Lokasi Saya</strong>');
        map.setView(latlng, 16);
      } else { myMarker.setLatLng(latlng); }
      if (!myAccuracyCircle) {
        myAccuracyCircle = L.circle(latlng, { radius: accuracy, color: '#3b82f6', fillColor: '#3b82f6', fillOpacity: 0.08, weight: 1 }).addTo(map);
      } else { myAccuracyCircle.setLatLng(latlng); myAccuracyCircle.setRadius(accuracy); }
      updateStats();
    },
    (err) => { setGPSStatus('error', 'GPS gagal: ' + err.message); },
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
  );
}

function setGPSStatus(status, text) {
  const el = document.getElementById('gpsStatus');
  el.className = 'gps-status ' + status;
  document.getElementById('gpsText').textContent = text;
}

function centerOnMe() {
  if (myLocation) map.setView([myLocation.lat, myLocation.lng], 17);
  else alert('Lokasi GPS belum tersedia');
}

// ===== MAP CLICK =====
map.on('click', function(e) {
  if (!measureMode && !addMode && activeHubId) { clearHubHighlight(); return; }
  if (addMode) { pendingLatLng = e.latlng; openNodeModal(addType, null); }
  if (measureMode) { handleMeasureClick(e.latlng); }
});
