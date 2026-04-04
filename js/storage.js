// ===== STORAGE =====
function loadData() {
  try {
    const d = localStorage.getItem('rtrwnet_v2_nodes');
    if (d) nodes = JSON.parse(d);
    const s = localStorage.getItem('rtrwnet_v2_settings');
    if (s) Object.assign(settings, JSON.parse(s));
    // Load paket list (managed separately)
    try {
      const p = localStorage.getItem('rtrwnet_v2_paket');
      if (p) paketList = JSON.parse(p);
      else paketList = [...DEFAULT_PAKET_LIST];
    } catch(e) { paketList = [...DEFAULT_PAKET_LIST]; }
  } catch(e) { nodes = []; }

  // Migration from v1
  if (nodes.length === 0) {
    try {
      const old = localStorage.getItem('rtrwnet_customers');
      if (old) {
        const oldData = JSON.parse(old);
        if (oldData.length > 0) {
          nodes = oldData.map(c => ({
            ...c, type: 'customer', phone: '', paket: '', status: 'aktif', hubId: ''
          }));
          saveData();
        }
      }
    } catch(e) {}
  }
}

function saveData() {
  localStorage.setItem('rtrwnet_v2_nodes', JSON.stringify(nodes));
  localStorage.setItem('rtrwnet_v2_settings', JSON.stringify(settings));
  // Save paket list
  try { localStorage.setItem('rtrwnet_v2_paket', JSON.stringify(paketList)); } catch(e) {}
  invalidateStatsCache(); // Invalidate cache on data change
  updateStats();
  renderAllList();
  autoBackup();
}

let lastBackup = 0;
function autoBackup() {
  const now = Date.now();
  if (now - lastBackup < 300000) return;
  lastBackup = now;
  localStorage.setItem('rtrwnet_v2_backup_' + new Date().toISOString().slice(0,10), JSON.stringify(nodes));
}

// ===== EXPORT =====
function exportJSON() {
  if (nodes.length === 0) { alert('Belum ada data'); return; }
  const data = {
    version: 2, exportedAt: new Date().toISOString(),
    nodes, settings, paketList,
    measurements: measurements.map(m => ({
      id: m.id, label_text: m.label_text, notes: m.notes,
      latlngs: m.latlngs, routeDistance: m.routeDistance || null
    }))
  };
  downloadFile(JSON.stringify(data, null, 2), 'rtrwnet-v2-' + new Date().toISOString().slice(0,10) + '.json', 'application/json');
}

function exportCSV() {
  if (nodes.length === 0) { alert('Belum ada data'); return; }
  let csv = 'Nama,Tipe,Hub,Nomor HP,Paket,Status,Latitude,Longitude,Catatan\n';
  nodes.forEach(n => {
    const hubName = n.hubId ? (getNodeById(parseInt(n.hubId))?.name || '') : '';
    csv += `"${n.name}","${n.type}","${hubName}","${n.phone || ''}","${n.paket || ''}","${n.status || ''}",${n.lat},${n.lng},"${(n.notes || '').replace(/"/g, '""')}"\n`;
  });
  downloadFile(csv, 'rtrwnet-pelanggan-' + new Date().toISOString().slice(0,10) + '.csv', 'text/csv');
}

function exportSummary() {
  const hubs = getHubs();
  const customers = getCustomers();
  const bases = getBases();

  let txt = `=== RINGKASAN RT/RW NET ===\n`;
  txt += `Tanggal: ${new Date().toLocaleDateString('id-ID')}\n`;
  txt += `Total: ${bases.length} base, ${hubs.length} hub, ${customers.length} pelanggan\n\n`;

  hubs.forEach(h => {
    const hc = getCustomersForHub(h.id);
    let totalCable = 0;
    txt += `--- ${h.name} (${hc.length}/${h.ports != null ? h.ports : '∞'} port) ---\n`;
    hc.forEach(c => {
      const dist = L.latLng(h.lat, h.lng).distanceTo(L.latLng(c.lat, c.lng)) * settings.cableMargin;
      totalCable += dist;
      txt += `  ${c.name} · ~${formatDist(dist)} · ${c.status || '-'}\n`;
    });
    txt += `  Total kabel: ~${formatDist(totalCable)} · Est. biaya: ${formatMoney(totalCable * settings.fiberPricePerMeter)}\n\n`;
  });

  const unassigned = customers.filter(c => !c.hubId);
  if (unassigned.length > 0) {
    txt += `--- BELUM ASSIGN ---\n`;
    unassigned.forEach(c => { txt += `  ${c.name}\n`; });
  }

  downloadFile(txt, 'rtrwnet-ringkasan-' + new Date().toISOString().slice(0,10) + '.txt', 'text/plain');
}

// ===== IMPORT =====
function importData(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      let imported = [];

      if (data.version === 2 && data.nodes) {
        imported = data.nodes;
        // Restore settings if present
        if (data.settings) Object.assign(settings, data.settings);
        // Restore paket list if present
        if (data.paketList && Array.isArray(data.paketList) && data.paketList.length > 0) {
          paketList.length = 0;
          paketList.push(...data.paketList);
        }
        // Restore measurements if present
        if (data.measurements && Array.isArray(data.measurements)) {
          measurements.length = 0;
          data.measurements.forEach(m => {
            measurements.push({
              id: m.id,
              label_text: m.label_text || '',
              notes: m.notes || '',
              latlngs: m.latlngs || [],
              routeDistance: m.routeDistance || null
            });
          });
        }
      } else if (data.customers && Array.isArray(data.customers)) {
        imported = data.customers.map(c => ({ ...c, type: 'customer', phone: '', paket: '', status: 'aktif', hubId: '' }));
      } else if (Array.isArray(data)) {
        imported = data.map(c => c.type ? c : { ...c, type: 'customer', phone: '', paket: '', status: 'aktif', hubId: '' });
      } else { alert('Format file tidak dikenali'); return; }

      // Use validation utilities
      const validationResult = validateImportData(imported);
      if (!validationResult.valid) {
        alert('Gagal import:\n' + validationResult.errors.join('\n'));
        return;
      }

      const valid = validationResult.data;
      
      if (validationResult.warnings.length > 0) {
        console.warn('Import warnings:', validationResult.warnings);
      }

      let mode = 'replace';
      if (nodes.length > 0) {
        mode = confirm(`Ditemukan ${valid.length} node.\n\nOK = Gabungkan\nCancel = Timpa semua`) ? 'merge' : 'replace';
      }

      if (mode === 'replace') {
        Object.values(nodeMarkers).forEach(m => map.removeLayer(m));
        nodeMarkers = {};
        nodes = valid;
      } else {
        const existingIds = new Set(nodes.map(n => n.id));
        valid.forEach(n => { if (!existingIds.has(n.id)) nodes.push(n); });
      }

      saveData();
      Object.values(nodeMarkers).forEach(m => map.removeLayer(m));
      nodeMarkers = {};
      nodes.forEach(n => addMarkerToMap(n));

      if (nodes.length > 0) {
        const bounds = L.latLngBounds(nodes.map(n => [n.lat, n.lng]));
        map.fitBounds(bounds, { padding: [50, 50] });
      }

      alert(`Berhasil import ${valid.length} node` + (validationResult.warnings.length > 0 ? ` (${validationResult.skippedCount} skip)` : ''));
    } catch (err) { alert('Gagal: ' + err.message); }
  };
  reader.readAsText(file);
  event.target.value = '';
}
