// ===== NODE MODAL =====
let currentNodeType = null; // fix: simpan type di variabel global, bukan di DOM element

function openNodeModal(type, existingNode) {
  const modal = document.getElementById('nodeModal');
  currentNodeType = type;
  document.getElementById('nodeFieldsBase').style.display = type === 'base' ? '' : 'none';
  document.getElementById('nodeFieldsHub').style.display = type === 'hub' ? '' : 'none';
  document.getElementById('nodeFieldsCustomer').style.display = type === 'customer' ? '' : 'none';

  const titles = { base: 'Base Station', hub: 'Hub / Node', customer: 'Pelanggan' };
  const typeConfig = getNodeType(type);

  if (existingNode) {
    document.getElementById('nodeModalTitle').textContent = 'Edit ' + titles[type];
    document.getElementById('nodeDeleteBtn').style.display = '';
    document.getElementById('nodeSaveBtn').textContent = 'Update';
    editingNodeId = existingNode.id;

    if (type === 'base') document.getElementById('nodeName').value = existingNode.name;
    else if (type === 'hub') {
      document.getElementById('hubName').value = existingNode.name;
      document.getElementById('hubPorts').value = existingNode.ports != null ? existingNode.ports : '';
      // Populate Base select for hubs
      try { populateBaseSelect(existingNode.baseId || ''); } catch (err) { /* ignore */ }
    } else {
      document.getElementById('custName').value = existingNode.name;
      document.getElementById('custPhone').value = existingNode.phone || '';
      // Populate paket dropdown
      const paketSelect = document.getElementById('custPaket');
      paketSelect.innerHTML = '<option value="">Pilih Paket</option>';
      paketList.forEach(p => {
        paketSelect.innerHTML += `<option value="${p}" ${existingNode && existingNode.paket === p ? 'selected' : ''}>${p}</option>`;
      });
      document.getElementById('custStatus').value = existingNode.status || 'aktif';
      populateHubSelect(existingNode.hubId, existingNode.lat, existingNode.lng);
    }
    document.getElementById('nodeNotes').value = existingNode.notes || '';
    document.getElementById('nodeCoordDisplay').textContent = `${existingNode.lat.toFixed(6)}, ${existingNode.lng.toFixed(6)}`;
  } else {
    document.getElementById('nodeModalTitle').textContent = titles[type] + ' Baru';
    document.getElementById('nodeDeleteBtn').style.display = 'none';
    document.getElementById('nodeSaveBtn').textContent = 'Simpan';
    editingNodeId = null;

    if (type === 'base') document.getElementById('nodeName').value = '';
    else if (type === 'hub') { 
      document.getElementById('hubName').value = ''; 
      document.getElementById('hubPorts').value = '';
      try { populateBaseSelect(''); } catch (err) { /* ignore */ }
    }
    else {
      document.getElementById('custName').value = '';
      document.getElementById('custPhone').value = '';
        // Populate paket dropdown for new customer
        const paketSelect = document.getElementById('custPaket');
        paketSelect.innerHTML = '<option value="">Pilih Paket</option>';
        paketList.forEach(p => {
          paketSelect.innerHTML += `<option value="${p}">${p}</option>`;
        });
      document.getElementById('custStatus').value = 'aktif';
      populateHubSelect('', pendingLatLng?.lat, pendingLatLng?.lng);
    }
    document.getElementById('nodeNotes').value = '';
    if (pendingLatLng) document.getElementById('nodeCoordDisplay').textContent = `${pendingLatLng.lat.toFixed(6)}, ${pendingLatLng.lng.toFixed(6)}`;
  }

  document.getElementById('nodeModalTitle').style.color = typeConfig.color;
  modal.classList.add('show');

  const focusMap = { base: 'nodeName', hub: 'hubName', customer: 'custName' };
  setTimeout(() => document.getElementById(focusMap[type]).focus(), ANIMATIONS.MODAL_DURATION);
}

function populateHubSelect(selectedId, customerLat, customerLng) {
  const select = document.getElementById('custHub');
  const hubs = getHubs();
  
  // Calculate occupancy and distance for sorting
  const hubsWithMeta = hubs.map(h => {
    const count = getCustomersForHub(h.id).length;
    const ports = h.ports;
    const isFull = ports != null && count >= ports;
    let distance = Infinity;
    if (customerLat != null && customerLng != null) {
      distance = L.latLng(h.lat, h.lng).distanceTo(L.latLng(customerLat, customerLng));
    }
    return { ...h, count, isFull, distance };
  });
  
  // Sort: available hubs first (by distance), then full hubs (by distance)
  hubsWithMeta.sort((a, b) => {
    if (a.isFull && !b.isFull) return 1;
    if (!a.isFull && b.isFull) return -1;
    return a.distance - b.distance;
  });
  
  select.innerHTML = '<option value="">Belum di tentukan</option>';
  hubsWithMeta.forEach(h => {
    const portLabel = h.ports != null ? h.ports : '∞';
    const warn = h.isFull ? ' ⚠️ PENUH' : '';
    select.innerHTML += `<option value="${h.id}" ${h.id == selectedId ? 'selected' : ''}>${h.name} (${h.count}/${portLabel}${warn})</option>`;
  });
  
  // Add onchange listener for validation
  select.onchange = validateHubSelection;
  
  // Initial validation
  validateHubSelection();
}

function populateBaseSelect(selectedId) {
  const select = document.getElementById('hubBase');
  if (!select) return;
  const bases = getBases();
  select.innerHTML = '<option value="">Tidak ada</option>';
  bases.forEach(b => {
    select.innerHTML += `<option value="${b.id}" ${b.id == selectedId ? 'selected' : ''}>${b.name}</option>`;
  });
}

function validateHubSelection() {
  const select = document.getElementById('custHub');
  const saveBtn = document.getElementById('nodeSaveBtn');
  const hubId = select.value;
  
  if (!hubId) {
    select.classList.remove('error');
    saveBtn.disabled = false;
    return;
  }
  
  const hub = getNodeById(parseInt(hubId));
  if (!hub) {
    select.classList.remove('error');
    saveBtn.disabled = false;
    return;
  }
  
  // If editing and customer already belongs to this hub, allow it
  if (editingNodeId) {
    const currentNode = getNodeById(editingNodeId);
    if (currentNode && currentNode.hubId == hubId) {
      select.classList.remove('error');
      saveBtn.disabled = false;
      return;
    }
  }
  
  const count = getCustomersForHub(hub.id).length;
  const isFull = hub.ports != null && count >= hub.ports;
  
  if (isFull) {
    select.classList.add('error');
    saveBtn.disabled = true;
  } else {
    select.classList.remove('error');
    saveBtn.disabled = false;
  }
}

function saveNode() {
  const type = currentNodeType;
  let name = '';

  if (type === 'base') name = document.getElementById('nodeName').value.trim();
  else if (type === 'hub') name = document.getElementById('hubName').value.trim();
  else name = document.getElementById('custName').value.trim();

  if (!isValidName(name)) {
    const fieldMap = { base: 'nodeName', hub: 'hubName', customer: 'custName' };
    document.getElementById(fieldMap[type]).style.borderColor = 'var(--danger)';
    alert(ERROR_MESSAGES.REQUIRED_FIELD);
    return;
  }

  if (editingNodeId) {
    const node = getNodeById(editingNodeId);
    if (node) {
      node.name = name;
      node.notes = document.getElementById('nodeNotes').value.trim();
      if (pendingLatLng) { 
        node.lat = pendingLatLng.lat; 
        node.lng = pendingLatLng.lng; 
      }
      
      if (type === 'hub') {
        const portsVal = document.getElementById('hubPorts').value.trim();
        if (!isValidPorts(portsVal)) {
          alert(ERROR_MESSAGES.INVALID_PORTS);
          return;
        }
        node.ports = portsVal === '' ? null : parseInt(portsVal);
        node.baseId = document.getElementById('hubBase') ? (document.getElementById('hubBase').value || '') : '';
      }
      
      if (type === 'customer') {
        node.phone = document.getElementById('custPhone').value.trim();
        if (node.phone && !isValidPhone(node.phone)) {
          alert(ERROR_MESSAGES.INVALID_PHONE);
          return;
        }
        node.paket = document.getElementById('custPaket').value.trim();
        node.status = document.getElementById('custStatus').value;
        node.hubId = document.getElementById('custHub').value || '';
      }
      
      saveData();
      rebuildMarker(node);
    }
  } else {
    if (!pendingLatLng) {
      alert('Koordinat tidak tersedia. Klik peta terlebih dahulu.');
      return;
    }
    
    const node = {
      id: Date.now(),
      type,
      name,
      lat: pendingLatLng.lat,
      lng: pendingLatLng.lng,
      notes: document.getElementById('nodeNotes').value.trim(),
      createdAt: new Date().toISOString()
    };
    
    if (type === 'hub') {
      const portsVal = document.getElementById('hubPorts').value.trim();
      if (!isValidPorts(portsVal)) {
        alert(ERROR_MESSAGES.INVALID_PORTS);
        return;
      }
      node.ports = portsVal === '' ? null : parseInt(portsVal);
      node.baseId = document.getElementById('hubBase') ? (document.getElementById('hubBase').value || '') : '';
    }
    
    if (type === 'customer') {
      node.phone = document.getElementById('custPhone').value.trim();
      if (node.phone && !isValidPhone(node.phone)) {
        alert(ERROR_MESSAGES.INVALID_PHONE);
        return;
      }
      node.paket = document.getElementById('custPaket').value.trim();
      node.status = document.getElementById('custStatus').value;
      node.hubId = document.getElementById('custHub').value || '';

      if (node.hubId) {
        const hub = getNodeById(parseInt(node.hubId));
        if (hub) {
          const count = getCustomersForHub(hub.id).length;
          if (hub.ports != null && count >= hub.ports) {
            if (!confirm(`Hub "${hub.name}" sudah penuh (${count}/${hub.ports} port). Tetap assign?`)) return;
          }
        }
      }
    }

    nodes.push(node);
    saveData();
    addMarkerToMap(node);
    updateStats();
    renderAllList();
  }

  closeNodeModal();
  cancelAddMode();
}

function editNode(id) {
  const node = getNodeById(id);
  if (!node) return;
  pendingLatLng = { lat: node.lat, lng: node.lng };
  openNodeModal(node.type, node);
}

function deleteFromNodeModal() {
  if (editingNodeId) {
    if (!confirm('Hapus node ini?')) return;
    removeNode(editingNodeId);
    closeNodeModal();
  }
}

function closeNodeModal() {
  document.getElementById('nodeModal').classList.remove('show');
  pendingLatLng = null; editingNodeId = null;
}

// Enter key saves
document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && document.getElementById('nodeModal').classList.contains('show')) saveNode();
});

// ===== MEASUREMENT EDIT MODAL =====
function editMeasurement(id) {
  const m = measurements.find(x => x.id === id);
  if (!m) return;
  editingMeasureId = id;
  document.getElementById('measureLabelInput').value = m.label_text || '';
  document.getElementById('measureNotesInput').value = m.notes || '';
  const dist = getMeasureTotalDist(m);
  const routeTag = m.routeDistance ? '🛣 routing' : 'garis lurus';
  document.getElementById('measureCoordDisplay').textContent =
    `${formatDist(dist)} (${routeTag}) · ~${formatDist(dist * settings.cableMargin)} estimasi kabel`;
  document.getElementById('measureModal').classList.add('show');
  setTimeout(() => document.getElementById('measureLabelInput').focus(), 100);
}

function saveMeasureEdit() {
  const m = measurements.find(x => x.id === editingMeasureId);
  if (!m) return;
  m.label_text = document.getElementById('measureLabelInput').value.trim();
  m.notes = document.getElementById('measureNotesInput').value.trim();
  updateMeasurementLabel(m);
  renderMeasureList();
  closeMeasureModal();
}

function deleteFromMeasureModal() {
  if (editingMeasureId) { deleteMeasurement(editingMeasureId); closeMeasureModal(); }
}

function closeMeasureModal() {
  document.getElementById('measureModal').classList.remove('show');
  editingMeasureId = null;
}
