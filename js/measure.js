// ===== MEASURE MODE =====
function toggleMeasureMode() {
  measureMode = !measureMode;
  if (measureMode && addMode) cancelAddMode();

  const btn = document.getElementById('measureBtn');
  if (measureMode) {
    btn.classList.add('active');
    btn.style.background = 'var(--warn-dim)'; btn.style.color = 'var(--warn)'; btn.style.borderColor = 'var(--warn)';
    map.getContainer().style.cursor = 'crosshair';
    measurePoints = [];
    // show movable crosshair using warn color for measure mode
    try { showCrosshairForType('var(--warn)'); } catch (err) { /* ignore if not available */ }
  } else {
    btn.classList.remove('active');
    btn.style.background = ''; btn.style.color = ''; btn.style.borderColor = '';
    map.getContainer().style.cursor = '';
    if (measurePoints.length >= 2) finishMultiSegment();
    measurePoints.forEach(p => map.removeLayer(p.tempMarker));
    measurePoints = [];
    // hide crosshair when leaving measure mode
    try { hideCrosshair(); } catch (err) { /* ignore */ }
  }
  updateModeIndicator();
}

function handleMeasureClick(latlng) {
  const tempIcon = L.divIcon({
    className: 'measure-point-icon',
    html: '<div style="width:12px;height:12px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(245,158,11,0.6);"></div>',
    iconSize: [12, 12], iconAnchor: [6, 6]
  });
  const tempMarker = L.marker(latlng, { icon: tempIcon }).addTo(map);
  measurePoints.push({ latlng, tempMarker });
  updateModeIndicator();
}

function updateModeIndicator() {
  if (!measureMode) {
    if (!addMode) document.getElementById('modeIndicator').classList.remove('show');
    return;
  }
  const indicator = document.getElementById('modeIndicator');
  indicator.className = 'mode-indicator measure show';
  if (measurePoints.length === 0) {
    indicator.innerHTML = 'Tap titik pertama';
  } else if (measurePoints.length === 1) {
    indicator.innerHTML = 'Tap titik kedua';
  } else {
    let total = 0;
    for (let i = 1; i < measurePoints.length; i++) total += measurePoints[i-1].latlng.distanceTo(measurePoints[i].latlng);
    indicator.innerHTML = `${measurePoints.length} titik · ${formatDist(total)} <button class="measure-finish-btn" onclick="finishMultiSegment()">Selesai</button>`;
  }
}

function finishMultiSegment() {
  if (measurePoints.length < 2) return;
  const latlngs = measurePoints.map(p => p.latlng);
  measurePoints.forEach(p => map.removeLayer(p.tempMarker));
  createMeasurement(latlngs);
  measurePoints = [];
  updateModeIndicator();
}

// ===== CREATE MEASUREMENT =====
function createMeasurement(latlngs) {
  const id = ++measureIdCounter;
  const pointIcon = L.divIcon({
    className: 'measure-point-icon',
    html: '<div style="width:14px;height:14px;background:#f59e0b;border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.4);cursor:grab;"></div>',
    iconSize: [14, 14], iconAnchor: [7, 7]
  });

  const markers = latlngs.map(ll => L.marker(ll, { icon: pointIcon, draggable: true, zIndexOffset: 500 }).addTo(map));
  const line = L.polyline(latlngs, { color: '#f59e0b', weight: 3, dashArray: '8, 8', interactive: true }).addTo(map);

  let totalDist = 0;
  for (let i = 1; i < latlngs.length; i++) totalDist += latlngs[i-1].distanceTo(latlngs[i]);

  const midIdx = Math.floor(latlngs.length / 2);
  const midLat = (latlngs[midIdx].lat + latlngs[Math.max(0, midIdx-1)].lat) / 2;
  const midLng = (latlngs[midIdx].lng + latlngs[Math.max(0, midIdx-1)].lng) / 2;

  const label = L.marker([midLat, midLng], {
    icon: L.divIcon({ className: 'distance-label', html: getMeasureLabelHtml(id, formatDist(totalDist), ''), iconSize: [0, 0] }),
    interactive: true, zIndexOffset: 600
  }).addTo(map);

  

  const m = { id, markers, line, label, label_text: '', notes: '', latlngs: latlngs.map(ll => ({ lat: ll.lat, lng: ll.lng })) };
  measurements.push(m);

  markers.forEach((marker) => {
    marker.on('drag', () => {
      const newLatLngs = markers.map(mk => mk.getLatLng());
      line.setLatLngs(newLatLngs);
      m.latlngs = newLatLngs.map(ll => ({ lat: ll.lat, lng: ll.lng }));
      const mi = Math.floor(newLatLngs.length / 2);
      const mla = (newLatLngs[mi].lat + newLatLngs[Math.max(0, mi-1)].lat) / 2;
      const mln = (newLatLngs[mi].lng + newLatLngs[Math.max(0, mi-1)].lng) / 2;
      label.setLatLng([mla, mln]);
      updateMeasurementLabel(m);
      renderMeasureList();
    });
  });

  fetchRoute(latlngs, m);
  renderMeasureList();
  return m;
}

// ===== OSRM ROUTING WITH CACHE MANAGEMENT =====
async function fetchRoute(latlngs, measurement) {
  if (latlngs.length < 2) return;
  const coords = latlngs.map(ll => `${ll.lng},${ll.lat}`).join(';');
  
  // Check cache first
  if (MEASUREMENT.ROUTE_CACHE_ENABLED && routeCache[coords]) { 
    applyRoute(measurement, routeCache[coords]); 
    return; 
  }

  try {
    const resp = await fetch(`${API_ENDPOINTS.OSRM_ROUTE}driving/${coords}?overview=full&geometries=geojson`);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    
    const data = await resp.json();
    if (data.routes && data.routes.length > 0) {
      // Cache management: limit cache size
      const cacheKeys = Object.keys(routeCache);
      if (cacheKeys.length >= MEASUREMENT.CACHE_MAX_SIZE) {
        // Remove oldest entry (FIFO)
        delete routeCache[cacheKeys[0]];
      }
      
      if (MEASUREMENT.ROUTE_CACHE_ENABLED) {
        routeCache[coords] = data.routes[0];
      }
      applyRoute(measurement, data.routes[0]);
    }
  } catch(e) { 
    debugLog('OSRM Route Error', e);
    // Silent fail - use straight line
  }
}

function applyRoute(measurement, route) {
  try {
    if (!route || !route.geometry || !route.geometry.coordinates) {
      throw new Error('Invalid route data');
    }
    
    const routeCoords = route.geometry.coordinates.map(c => L.latLng(c[1], c[0]));
    measurement.line.setLatLngs(routeCoords);
    measurement.line.setStyle({ dashArray: null, weight: 3.5 });
    measurement.routeDistance = route.distance;
    updateMeasurementLabel(measurement);
    renderMeasureList();
  } catch (e) {
    debugLog('Apply Route Error', e);
    // Keep straight line if route application fails
  }
}

// ===== MEASURE HELPERS =====
function getMeasureTotalDist(m) {
  if (m.routeDistance) return m.routeDistance;
  let total = 0;
  const pts = m.markers ? m.markers.map(mk => mk.getLatLng()) : m.latlngs.map(l => L.latLng(l.lat, l.lng));
  for (let i = 1; i < pts.length; i++) total += pts[i-1].distanceTo(pts[i]);
  return total;
}

function getMeasureLabelHtml(id, distText, labelText) {
  const display = labelText ? `${labelText} · ${distText}` : `📏 ${distText}`;
  return `<span class="dist-text" onclick="event.stopPropagation(); editMeasurement(${id})" style="cursor:pointer;">${display}</span><button class="dist-delete" onclick="event.stopPropagation(); deleteMeasurement(${id})">×</button>`;
}

function updateMeasurementLabel(m) {
  const dist = getMeasureTotalDist(m);
  const distText = formatDist(dist);
  m.label.setIcon(L.divIcon({ className: 'distance-label', html: getMeasureLabelHtml(m.id, distText, m.label_text || ''), iconSize: [0, 0] }));
  
}

function deleteMeasurement(id) {
  const idx = measurements.findIndex(m => m.id === id);
  if (idx === -1) return;
  const m = measurements[idx];
  m.markers.forEach(mk => map.removeLayer(mk));
  map.removeLayer(m.line); map.removeLayer(m.label);
  measurements.splice(idx, 1);
  renderMeasureList();
}

function clearAllMeasurements() {
  if (measurements.length === 0) return;
  if (!confirm('Hapus semua pengukuran?')) return;
  measurements.forEach(m => { m.markers.forEach(mk => map.removeLayer(mk)); map.removeLayer(m.line); map.removeLayer(m.label); });
  measurements = [];
  renderMeasureList();
}

function flyToMeasurement(id) {
  const m = measurements.find(x => x.id === id);
  if (!m) return;
  map.fitBounds(L.latLngBounds(m.markers.map(mk => mk.getLatLng())), { padding: [60, 60] });
}
