// ===== MARKER ICONS =====
function getMarkerIcon(nodeOrType, extraClass, outlineClass) {
  const cls = extraClass ? ' ' + extraClass : '';
  const outline = outlineClass ? ' ' + outlineClass : '';
  // Accept either a node object or a type string
  let type = typeof nodeOrType === 'string' ? nodeOrType : (nodeOrType && nodeOrType.type ? nodeOrType.type : 'customer');
  if (type === 'base') return L.divIcon({ className: 'custom-marker' + cls, html: `<div class="marker-pin-base${outline}"></div>`, iconSize: [18, 18], iconAnchor: [9, 15] });
  if (type === 'hub') return L.divIcon({ className: 'custom-marker' + cls, html: `<div class="marker-pin-hub${outline}"></div>`, iconSize: [16, 16], iconAnchor: [8, 13] });

  // Customer: determine status class if node provided
  let statusClass = '';
  if (nodeOrType && typeof nodeOrType === 'object') {
    const st = nodeOrType.status;
    // Only apply known status classes; unknown/empty -> keep default color
    if (st === 'aktif' || st === 'tidak_aktif') statusClass = ' ' + st;
  }

  return L.divIcon({ className: 'custom-marker' + cls, html: `<div class="marker-pin-customer${statusClass}${outline}"></div>`, iconSize: [14, 14], iconAnchor: [7, 15.6] });
}

// ===== ADD MARKER =====
function addMarkerToMap(node) {
  const icon = getMarkerIcon(node);
  const marker = L.marker([node.lat, node.lng], {
    icon, zIndexOffset: node.type === 'base' ? 900 : node.type === 'hub' ? 800 : 100
  }).addTo(map);

  marker._nodeId = node.id;
  marker._nodeType = node.type;

  marker.on('click', function(e) {
    if (measureMode) { L.DomEvent.stopPropagation(e); handleMeasureClick(L.latLng(node.lat, node.lng)); return; }
    if (addMode) { L.DomEvent.stopPropagation(e); return; }
    L.DomEvent.stopPropagation(e);
    highlightHub(node.id);
    return;
  });

  let popupContent = `<strong>${node.name}</strong>`;
  const typeConfig = getNodeType(node.type);
  if (node.type === 'hub') {
    const used = getCustomersForHub(node.id).length;
    const total = node.ports != null ? node.ports : '∞';
    popupContent += `<br><small style="color:${typeConfig.color}">Hub · ${used}/${total} port</small>`;
  }
  if (node.type === 'base') popupContent += `<br><small style="color:${typeConfig.color}">Base Station</small>`;
  if (node.notes) popupContent += `<br><em style="font-size:11px;color:#999">${node.notes}</em>`;
  if (node.phone) popupContent += `<br><small style="color:#999">📱 ${node.phone}</small>`;
  if (node.hubId) {
    const hub = getNodeById(node.hubId);
    if (hub) popupContent += `<br><small style="color:${getTypeColor('hub')}">🔗 ${hub.name}</small>`;
  }
  popupContent += `<br><a href="#" onclick="event.preventDefault(); editNode(${node.id}); return false;" style="color:${getTypeColor('customer')};font-size:12px;text-decoration:none;">✎ Edit</a>`;

  marker.bindPopup(popupContent);
  if (node.type === 'hub') marker.on('contextmenu', function() { marker.openPopup(); });

  nodeMarkers[node.id] = marker;
}

function rebuildMarker(node) {
  // Atomic operation: remove old marker synchronously before adding new one
  if (nodeMarkers[node.id]) {
    const oldMarker = nodeMarkers[node.id];
    map.removeLayer(oldMarker);
    delete nodeMarkers[node.id];
  }
  // Immediately add new marker - no gap where marker doesn't exist
  addMarkerToMap(node);
}

function removeNode(id) {
  const node = getNodeById(id);
  if (node && node.type === 'hub') nodes.forEach(n => { if (n.hubId == id) n.hubId = ''; });
  nodes = nodes.filter(n => n.id !== id);
  if (nodeMarkers[id]) { map.removeLayer(nodeMarkers[id]); delete nodeMarkers[id]; }
  saveData();
}

function flyToNode(id) {
  const n = getNodeById(id);
  if (n) {
    map.setView([n.lat, n.lng], 18);
    if (nodeMarkers[id]) {
      if (n.type === 'hub' || n.type === 'base' || n.type === 'customer') highlightHub(id);
      else nodeMarkers[id].openPopup();
    }
    if (window.innerWidth < 640) document.getElementById('sidePanel').classList.remove('open');
  }
}

// ===== ADD MODE =====
function toggleAddDropdown() {
  if (addMode) { cancelAddMode(); return; }

  const dropdown = document.getElementById('addDropdown');
  const backdrop = document.getElementById('addDropdownBackdrop');
  const isOpen = dropdown.classList.contains('show');
  
  if (isOpen) {
    closeAddDropdown();
  } else {
    dropdown.classList.add('show');
    backdrop.classList.add('show');
  }
}

function closeAddDropdown() {
  const dropdown = document.getElementById('addDropdown');
  const backdrop = document.getElementById('addDropdownBackdrop');
  dropdown.classList.remove('show');
  backdrop.classList.remove('show');
}

function startAddMode(type) {
  closeAddDropdown();
  addMode = true; addType = type;
  if (measureMode) toggleMeasureMode();

  const btn = document.getElementById('addBtn');
  btn.classList.add('active');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M18 6L6 18"/><path d="M6 6l12 12"/></svg><span class="label">Batal</span>`;
  map.getContainer().style.cursor = 'crosshair';

  const indicator = document.getElementById('modeIndicator');
  const labels = { base: 'Tap peta untuk Base Station', hub: 'Tap peta untuk Hub', customer: 'Tap peta untuk Pelanggan' };
  const classes = { base: 'add-base', hub: 'add-hub', customer: 'add-customer' };
  indicator.className = 'mode-indicator ' + classes[type] + ' show';
  indicator.innerHTML = labels[type];

  // Show movable crosshair overlay as alternative input method
  try { showCrosshairForType(type); } catch (err) { console.warn('Crosshair init failed', err); }
}

function cancelAddMode() {
  addMode = false; addType = null;
  const btn = document.getElementById('addBtn');
  btn.classList.remove('active');
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14"/><path d="M5 12h14"/></svg><span class="label">Tambah</span>`;
  map.getContainer().style.cursor = '';
  document.getElementById('modeIndicator').classList.remove('show');
  closeAddDropdown();

  // hide crosshair if present
  try { hideCrosshair(); } catch (err) { /* ignore */ }
}

// --- Crosshair overlay helpers ---
let _crosshair = {
  el: null,
  btn: null,
  dragging: false
};

function ensureCrosshairElements() {
  if (_crosshair.el && _crosshair.btn) return;
  _crosshair.el = document.getElementById('crosshairOverlay');
  _crosshair.btn = document.getElementById('crosshairConfirmBtn');
  if (!_crosshair.el || !_crosshair.btn) return;

  // Pointer / touch handlers
  _crosshair.el.addEventListener('touchstart', (ev) => {
    _crosshair.dragging = true;
    _crosshair.el.style.cursor = 'grabbing';
  }, { passive: true });

  window.addEventListener('touchmove', (ev) => {
    if (!_crosshair.dragging) return;
    const t = ev.touches[0]; if (!t) return;
    moveCrosshairTo(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener('touchend', (ev) => {
    _crosshair.dragging = false; _crosshair.el && (_crosshair.el.style.cursor = 'grab');
  });

  // Mouse fallback
  _crosshair.el.addEventListener('mousedown', (ev) => { ev.preventDefault(); _crosshair.dragging = true; _crosshair.el.style.cursor = 'grabbing'; });
  window.addEventListener('mousemove', (ev) => { if (!_crosshair.dragging) return; moveCrosshairTo(ev.clientX, ev.clientY); });
  window.addEventListener('mouseup', (ev) => { _crosshair.dragging = false; _crosshair.el && (_crosshair.el.style.cursor = 'grab'); });

  // Confirm button
  _crosshair.btn.addEventListener('click', () => {
    if (!_crosshair.el) return;
    const rect = _crosshair.el.getBoundingClientRect();
    const centerX = rect.left + rect.width/2;
    const centerY = rect.top + rect.height/2;
    const mapRect = map.getContainer().getBoundingClientRect();
    const x = centerX - mapRect.left;
    const y = centerY - mapRect.top;
    const point = L.point(x, y);
    const latlng = map.containerPointToLatLng(point);
    pendingLatLng = latlng;
    // If measure mode is active, treat confirm as a measure point
    if (typeof measureMode !== 'undefined' && measureMode) {
      try { handleMeasureClick(latlng); } catch (err) { console.warn('handleMeasureClick failed', err); }
      // keep crosshair visible for adding more measure points (use warn color)
      try { showCrosshairForType('var(--warn)'); } catch (err) { /* ignore */ }
      return;
    }

    // Otherwise fall back to add-node behavior
    hideCrosshair();
    openNodeModal(addType, null);
  });
}

function showCrosshairForType(type) {
  ensureCrosshairElements();
  if (!_crosshair.el || !_crosshair.btn) return;
  // center overlay
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  _crosshair.el.style.left = cx + 'px';
  _crosshair.el.style.top = cy + 'px';
  // color by type or explicit CSS color variable/value
  // Use CSS custom properties so theme variables are respected
  let cssVar;
  if (typeof type === 'string' && (type.startsWith('var(') || type.startsWith('--') || type.startsWith('#'))) {
    cssVar = type;
  } else {
    cssVar = type === 'base' ? 'var(--base-color)' : type === 'hub' ? 'var(--hub-color)' : 'var(--accent)';
  }
  _crosshair.el.style.setProperty('--crosshair-color', cssVar);
  _crosshair.el.classList.add('show');
  _crosshair.btn.classList.add('show');
}

function hideCrosshair() {
  if (_crosshair.el) _crosshair.el.classList.remove('show');
  if (_crosshair.btn) _crosshair.btn.classList.remove('show');
  _crosshair.dragging = false;
}

function moveCrosshairTo(clientX, clientY) {
  if (!_crosshair.el) return;
  // keep within viewport
  const w = window.innerWidth, h = window.innerHeight;
  const clampedX = Math.max(8, Math.min(w-8, clientX));
  const clampedY = Math.max(8, Math.min(h-8, clientY));
  _crosshair.el.style.left = clampedX + 'px';
  _crosshair.el.style.top = clampedY + 'px';
}

// Close dropdown when clicking outside
document.addEventListener('click', function(e) {
  if (!e.target.closest('.action-bar') && !e.target.closest('.add-dropdown')) {
    closeAddDropdown();
  }
});

// ===== HUB HIGHLIGHT =====
function highlightHub(nodeId) {
  // nodeId may be base, hub, or customer
  if (activeHubId === nodeId) { clearHubHighlight(); return; }
  clearHubHighlight();
  activeHubId = nodeId;

  const node = getNodeById(nodeId);
  if (!node) return;

  // helper to mark non-highlighted nodes
  function dimAllExcept(visibleNodeIds = []) {
    Object.entries(nodeMarkers).forEach(([nid, marker]) => {
      const n = getNodeById(parseInt(nid));
      if (!n) return;
      if (visibleNodeIds.includes(n.id)) {
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(n.type === 'base' ? 900 : n.type === 'hub' ? 800 : 200);
      } else {
        marker.setIcon(getMarkerIcon(n, 'marker-dimmed'));
        marker.setZIndexOffset(-100);
      }
    });
  }

  // Track visible ids for ease
  const visibleIds = new Set();

  if (node.type === 'base') {
    const base = node;
    const baseLL = L.latLng(base.lat, base.lng);
    const connectedHubs = getHubs().filter(h => (h.baseId || '') == base.id);

    // visible: base, its hubs, and customers of those hubs
    visibleIds.add(base.id);
    connectedHubs.forEach(h => { visibleIds.add(h.id); getCustomersForHub(h.id).forEach(c => visibleIds.add(c.id)); });

    // dim others and apply red outline to unconnected hubs and unassigned customers
    Object.entries(nodeMarkers).forEach(([nid, marker]) => {
      const n = getNodeById(parseInt(nid));
      if (!n) return;
      if (visibleIds.has(n.id)) {
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(n.type === 'base' ? 900 : n.type === 'hub' ? 800 : 200);
      } else if (n.type === 'hub') {
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(-100);
      } else if (n.type === 'customer' && (!n.hubId || n.hubId === '')) {
        marker.setIcon(getMarkerIcon(n, '', 'marker-outline-danger'));
        marker.setZIndexOffset(-100);
      } else {
        marker.setIcon(getMarkerIcon(n, 'marker-dimmed'));
        marker.setZIndexOffset(-100);
      }
    });

    // draw lines from base to connected hubs (use CSS var --base-color)
    const baseColor = (getComputedStyle(document.documentElement).getPropertyValue('--base-color') || getTypeColor('base')).trim();
    connectedHubs.forEach(h => {
      const hubLL = L.latLng(h.lat, h.lng);
      const line = L.polyline([baseLL, hubLL], { color: baseColor, weight: 3, interactive: false }).addTo(map);
      hubHighlightLayers.push(line);
    });

    return;
  }

  if (node.type === 'hub') {
    const hub = node;
    const hubLL = L.latLng(hub.lat, hub.lng);
    visibleIds.add(hub.id);
    // its customers visible
    const hubCustomers = getCustomersForHub(hub.id);
    hubCustomers.forEach(c => visibleIds.add(c.id));
    // its base visible
    if (hub.baseId) visibleIds.add(parseInt(hub.baseId));

    // apply icons/dimming: unconnected hubs (different base) -> dim + red outline; unassigned customers -> dim+red outline
    Object.entries(nodeMarkers).forEach(([nid, marker]) => {
      const n = getNodeById(parseInt(nid));
      if (!n) return;
      if (visibleIds.has(n.id)) {
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(n.type === 'base' ? 900 : n.type === 'hub' ? 800 : 200);
      } else if (n.type === 'hub' && (n.baseId || '') !== (hub.baseId || '')) {
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(-100);
      } else if (n.type === 'customer' && (!n.hubId || n.hubId === '')) {
        marker.setIcon(getMarkerIcon(n, '', 'marker-outline-danger'));
        marker.setZIndexOffset(-100);
      } else {
        marker.setIcon(getMarkerIcon(n, 'marker-dimmed'));
        marker.setZIndexOffset(-100);
      }
    });

    // draw line hub -> base (use CSS var --base-color)
    if (hub.baseId) {
      const base = getNodeById(parseInt(hub.baseId));
      if (base) {
        const baseLL = L.latLng(base.lat, base.lng);
        const baseColor2 = (getComputedStyle(document.documentElement).getPropertyValue('--base-color') || getTypeColor('base')).trim();
        const line = L.polyline([hubLL, baseLL], { color: baseColor2, weight: 3, interactive: false }).addTo(map);
        hubHighlightLayers.push(line);
      }
    }

    // draw lines hub -> customers
    hubCustomers.forEach(c => {
      const custLL = L.latLng(c.lat, c.lng);
      const line = L.polyline([hubLL, custLL], { color: getTypeColor('hub'), weight: 2.5, interactive: false }).addTo(map);
      hubHighlightLayers.push(line);
    });

    return;
  }

  if (node.type === 'customer') {
    const cust = node;
    const custLL = L.latLng(cust.lat, cust.lng);
    visibleIds.add(cust.id);

    if (cust.hubId) {
      const hub = getNodeById(parseInt(cust.hubId));
      if (hub) {
        visibleIds.add(hub.id);
        // hub's base
        if (hub.baseId) visibleIds.add(parseInt(hub.baseId));
        // siblings: keep them visible and draw connecting lines from hub to all siblings
        const hubCustomers = getCustomersForHub(hub.id);
        hubCustomers.forEach(sib => visibleIds.add(sib.id));

        const hubLL = L.latLng(hub.lat, hub.lng);

        // draw lines hub -> all customers (siblings included)
        hubCustomers.forEach(c => {
          const customerLL = L.latLng(c.lat, c.lng);
          const line = L.polyline([hubLL, customerLL], { color: getTypeColor('hub'), weight: 2.5, interactive: false }).addTo(map);
          hubHighlightLayers.push(line);
        });

        // draw line hub -> base (use CSS var --base-color)
        if (hub.baseId) {
          const base = getNodeById(parseInt(hub.baseId));
          if (base) {
            const baseLL = L.latLng(base.lat, base.lng);
            const baseColor3 = (getComputedStyle(document.documentElement).getPropertyValue('--base-color') || getTypeColor('base')).trim();
            const line2 = L.polyline([hubLL, baseLL], { color: baseColor3, weight: 3, interactive: false }).addTo(map);
            hubHighlightLayers.push(line2);
          }
        }
      }
    }

    // apply icons: clicked customer gets accent outline; hub/base always visible
    Object.entries(nodeMarkers).forEach(([nid, marker]) => {
      const n = getNodeById(parseInt(nid));
      if (!n) return;
      if (n.id === cust.id) {
        // Clicked customer: accent outline and highest z-index
        marker.setIcon(getMarkerIcon(n, '', 'marker-outline-accent'));
        marker.setZIndexOffset(1000);
      } else if (visibleIds.has(n.id)) {
        // Visible nodes (hub, siblings, base): normal icon
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(n.type === 'base' ? 900 : n.type === 'hub' ? 800 : 200);
      } else if (n.type === 'base') {
        // Bases always remain fully visible
        marker.setIcon(getMarkerIcon(n));
        marker.setZIndexOffset(900);
      } else if (n.type === 'hub') {
        // Hubs: dim only if customer is connected and hub has different base
        if (cust.hubId) {
          const connectedHub = getNodeById(parseInt(cust.hubId));
          if (connectedHub && (n.baseId || '') !== (connectedHub.baseId || '')) {
            // Different base: dim
            marker.setIcon(getMarkerIcon(n, 'marker-dimmed'));
            marker.setZIndexOffset(-100);
          } else {
            // Same base: visible
            marker.setIcon(getMarkerIcon(n));
            marker.setZIndexOffset(800);
          }
        } else {
          // Unconnected customer: all hubs remain visible
          marker.setIcon(getMarkerIcon(n));
          marker.setZIndexOffset(800);
        }
      } else if (n.type === 'customer' && (!n.hubId || n.hubId === '')) {
        // Other unassigned customers: danger outline
        marker.setIcon(getMarkerIcon(n, '', 'marker-outline-danger'));
        marker.setZIndexOffset(-100);
      } else {
        // Assigned customers from other hubs: dimmed
        marker.setIcon(getMarkerIcon(n, 'marker-dimmed'));
        marker.setZIndexOffset(-100);
      }
    });

    return;
  }
}

function clearHubHighlight() {
  if (!activeHubId) return;
  activeHubId = null;
  Object.entries(nodeMarkers).forEach(([nid, marker]) => {
    const node = getNodeById(parseInt(nid));
    if (node) {
      marker.setIcon(getMarkerIcon(node));
      marker.setZIndexOffset(node.type === 'base' ? 900 : node.type === 'hub' ? 800 : 100);
    }
  });
  hubHighlightLayers.forEach(l => map.removeLayer(l));
  hubHighlightLayers = [];
}
