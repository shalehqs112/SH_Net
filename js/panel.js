// ===== STATS WITH CACHING =====
let statsCache = { dirty: true, data: null };

function invalidateStatsCache() {
  statsCache.dirty = true;
}

function getStatsCache() {
  if (statsCache.dirty) {
    const customers = getCustomers();
    const customerCount = customers.length;
    const hubCount = getHubs().length;
    
    // Count customers by status
    const aktifCount = customers.filter(c => c.status === 'aktif').length;
    const tidakAktifCount = customers.filter(c => c.status === 'tidak_aktif').length;
    const calonCount = customers.filter(c => c.status === 'calon').length;
    
    let totalCable = 0;
    getHubs().forEach(hub => {
      totalCable += calculateHubTotalCable(hub, getCustomersForHub(hub.id));
    });
    
    statsCache.data = {
      customerCount,
      hubCount,
      totalCable,
      aktifCount,
      tidakAktifCount,
      calonCount
    };
    statsCache.dirty = false;
  }
  return statsCache.data;
}

function updateStats() {
  const stats = getStatsCache();
  document.getElementById('customerCount').textContent = stats.customerCount;
  document.getElementById('hubCount').textContent = stats.hubCount;
  document.getElementById('totalCable').textContent = stats.totalCable > 0 ? formatDist(stats.totalCable) : '-';
  document.getElementById('aktifCount').textContent = stats.aktifCount;
  document.getElementById('tidakAktifCount').textContent = stats.tidakAktifCount;
  document.getElementById('calonCount').textContent = stats.calonCount;
}

// ===== ALL LIST =====
let panelSearchQuery = '';

function renderAllList() {
  const container = document.getElementById('allList');
  if (nodes.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="10" r="3"/><path d="M12 21.7C17.3 17 20 13 20 10a8 8 0 1 0-16 0c0 3 2.7 7 8 11.7z"/></svg>
      <p>Belum ada data.<br>Tap <strong>+</strong> untuk menambah Base, Hub, atau Pelanggan.</p>
    </div>`;
    return;
  }

  // Apply group filter first
  let filtered = [...nodes];
  if (typeof currentGroup !== 'undefined' && currentGroup) {
    filtered = filtered.filter(n => n.type === currentGroup);
  }

  // Apply search filter (name and phone)
  if (panelSearchQuery.trim()) {
    const query = panelSearchQuery.toLowerCase().trim();
    filtered = filtered.filter(n => {
      const nameMatch = n.name && n.name.toLowerCase().includes(query);
      const phoneMatch = n.phone && n.phone.toLowerCase().includes(query);
      return nameMatch || phoneMatch;
    });
  }

  // Then sort according to currentSort
  let sorted = [...filtered];
  if (currentSort === 'name') {
    sorted.sort((a, b) => a.name.localeCompare(b.name));
  } else if (currentSort === 'newest') {
    sorted.sort((a, b) => b.id - a.id);
  } else if (currentSort === 'oldest') {
    sorted.sort((a, b) => a.id - b.id);
  } else if (currentSort === 'busiest') {
    // Sort by occupancy ratio descending; hubs with ports === null go last
    sorted.sort((a, b) => {
      const countA = getCustomersForHub(a.id).length;
      const countB = getCustomersForHub(b.id).length;
      const portsA = a.ports;
      const portsB = b.ports;
      // If both have null ports, sort by customer count descending
      if (portsA === null && portsB === null) return countB - countA;
      // Null ports go last
      if (portsA === null) return 1;
      if (portsB === null) return -1;
      // Calculate occupancy ratio
      const ratioA = countA / portsA;
      const ratioB = countB / portsB;
      return ratioB - ratioA;
    });
  } else if (currentSort === 'available') {
    // Sort by occupancy ratio ascending; hubs with ports === null go first
    sorted.sort((a, b) => {
      const countA = getCustomersForHub(a.id).length;
      const countB = getCustomersForHub(b.id).length;
      const portsA = a.ports;
      const portsB = b.ports;
      // If both have null ports, sort by customer count ascending
      if (portsA === null && portsB === null) return countA - countB;
      // Null ports go first
      if (portsA === null) return -1;
      if (portsB === null) return 1;
      // Calculate occupancy ratio
      const ratioA = countA / portsA;
      const ratioB = countB / portsB;
      return ratioA - ratioB;
    });
  } else if (currentSort === 'status_active') {
    // Sort by status priority: aktif (0) → calon (1) → tidak_aktif (2)
    const priority = { 'aktif': 0, 'calon': 1, 'tidak_aktif': 2 };
    sorted.sort((a, b) => {
      const prioA = priority[a.status] ?? 2;
      const prioB = priority[b.status] ?? 2;
      if (prioA !== prioB) return prioA - prioB;
      // Secondary sort by name ascending
      return a.name.localeCompare(b.name);
    });
  } else if (currentSort === 'status_inactive') {
    // Sort by status priority: tidak_aktif (0) → calon (1) → aktif (2)
    const priority = { 'tidak_aktif': 0, 'calon': 1, 'aktif': 2 };
    sorted.sort((a, b) => {
      const prioA = priority[a.status] ?? 2;
      const prioB = priority[b.status] ?? 2;
      if (prioA !== prioB) return prioA - prioB;
      // Secondary sort by name ascending
      return a.name.localeCompare(b.name);
    });
  }

  // UI: Group + Sort dropdowns
  let html = `<div class="sort-bar">
    <div class="select-row">
      <label class="sort-label">Group</label>
      <select class="panel-select" onchange="setGroup(this.value)">
        <option value="" ${currentGroup === '' ? 'selected' : ''}>Semua</option>
        <option value="base" ${currentGroup === 'base' ? 'selected' : ''}>Base Station</option>
        <option value="hub" ${currentGroup === 'hub' ? 'selected' : ''}>Hub</option>
        <option value="customer" ${currentGroup === 'customer' ? 'selected' : ''}>Pelanggan</option>
      </select>
    </div>
    <div class="select-row" style="margin-left:12px;">
      <label class="sort-label">Urut</label>
      <select class="panel-select" onchange="setSort(this.value)">
        <option value="newest" ${currentSort === 'newest' ? 'selected' : ''}>Terbaru</option>
        <option value="oldest" ${currentSort === 'oldest' ? 'selected' : ''}>Terlama</option>
        <option value="name" ${currentSort === 'name' ? 'selected' : ''}>Nama</option>
        ${currentGroup === 'hub' ? `<option value="busiest" ${currentSort === 'busiest' ? 'selected' : ''}>Tersibuk</option>` : ''}
        ${currentGroup === 'hub' ? `<option value="available" ${currentSort === 'available' ? 'selected' : ''}>Tersedia</option>` : ''}
        ${currentGroup === 'customer' ? `<option value="status_active" ${currentSort === 'status_active' ? 'selected' : ''}>Aktif</option>` : ''}
        ${currentGroup === 'customer' ? `<option value="status_inactive" ${currentSort === 'status_inactive' ? 'selected' : ''}>Tidak Aktif</option>` : ''}
      </select>
    </div>
  </div>`;

  sorted.forEach(n => {
    const typeConfig = getNodeType(n.type);
    let meta = `<span>📍 ${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}</span>`;

    if (n.type === 'hub') {
      const count = getCustomersForHub(n.id).length;
      const ports = n.ports;
      const portLabel = ports != null ? ports : '∞';
      const isFull = ports != null && count >= ports;
      meta += ` <span class="${isFull ? 'port-warning' : 'port-ok'}">${count}/${portLabel} port</span>`;
    }
    if (n.type === 'customer') {
      if (n.hubId) {
        const hub = getNodeById(parseInt(n.hubId));
        meta += ` <span style="color:${getTypeColor('hub')}">🔗 ${hub ? hub.name : '?'}</span>`;
      } else meta += ` <span style="color:var(--text-muted)">⚠ belum assign</span>`;
      if (n.status) {
        let statusVal = n.status;
        const validValues = (typeof STATUS_OPTIONS !== 'undefined') ? STATUS_OPTIONS.map(s => s.value) : ['aktif', 'tidak_aktif'];
        if (!validValues.includes(statusVal)) statusVal = 'tidak_aktif';
        const opt = (typeof STATUS_OPTIONS !== 'undefined') ? STATUS_OPTIONS.find(s => s.value === statusVal) : null;
        const statusLabel = opt ? opt.label : statusVal;
        meta += ` <span class="status-badge ${statusVal}">${statusLabel}</span>`;
      }
    }

    html += `
      <div class="customer-card" onclick="flyToNode(${n.id})" style="border-left: 3px solid ${typeConfig.color}">
        <div class="name">
          <span><span class="type-indicator ${n.type}"></span>${n.name} ${typeConfig.label ? '<small style="color:'+typeConfig.color+';font-size:10px;font-weight:700;">'+typeConfig.label+'</small>' : ''}</span>
          <div style="display:flex;gap:4px;">
            <button class="delete-customer" style="color:${typeConfig.color};" onclick="event.stopPropagation(); editNode(${n.id})" title="Edit">✎</button>
            <button class="delete-customer" onclick="event.stopPropagation(); if(confirm('Hapus?')) removeNode(${n.id})" title="Hapus">×</button>
          </div>
        </div>
        <div class="meta">${meta}</div>
        ${n.phone ? `<div class="meta" style="margin-top:2px"><span>📱 ${n.phone}</span>${n.paket ? ` <span>📦 ${n.paket}</span>` : ''}</div>` : ''}
        ${n.notes ? `<div class="notes">${n.notes}</div>` : ''}
      </div>`;
  });
  container.innerHTML = html;
}

function setSort(mode) { currentSort = mode; renderAllList(); }

function setPanelSearch(query) {
  panelSearchQuery = query;
  renderAllList();
  // Show/hide clear button
  const clearBtn = document.getElementById('panelSearchClear');
  if (clearBtn) {
    clearBtn.style.display = query.trim() ? 'flex' : 'none';
  }
}

function clearPanelSearch() {
  const searchInput = document.getElementById('panelSearchInput');
  if (searchInput) {
    searchInput.value = '';
    setPanelSearch('');
    searchInput.focus();
  }
}

function setGroup(mode) { 
  // If switching away from 'hub' while hub-only sort is active, reset to 'newest'
  if (currentGroup === 'hub' && mode !== 'hub' && (currentSort === 'busiest' || currentSort === 'available')) {
    currentSort = 'newest';
  }
  // If switching away from 'customer' while customer-only sort is active, reset to 'newest'
  if (currentGroup === 'customer' && mode !== 'customer' && (currentSort === 'status_active' || currentSort === 'status_inactive')) {
    currentSort = 'newest';
  }
  currentGroup = mode; 
  renderAllList(); 
}

// ===== MEASURE LIST =====
function renderMeasureList() {
  const container = document.getElementById('measureList');
  if (!container) return;
  if (measurements.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12h5"/><path d="M17 12h5"/><path d="M12 2v5"/><path d="M12 17v5"/></svg>
      <p>Belum ada pengukuran.<br>Tap <strong>Ukur</strong> lalu tap titik di peta.</p>
    </div>`;
    return;
  }

  let html = '';
  measurements.forEach((m, i) => {
    const dist = getMeasureTotalDist(m);
    const displayName = m.label_text || ('Ukur #' + (i + 1));
    const routeTag = m.routeDistance ? '🛣' : '📏';
    const estCable = dist * settings.cableMargin;
    const cost = estCable * settings.fiberPricePerMeter;
    html += `
      <div class="customer-card" onclick="flyToMeasurement(${m.id})">
        <div class="name">
          <span style="color:var(--warn)">${displayName}</span>
          <div style="display:flex;gap:4px;">
            <button class="delete-customer" style="color:var(--warn);" onclick="event.stopPropagation(); editMeasurement(${m.id})" title="Edit">✎</button>
            <button class="delete-customer" onclick="event.stopPropagation(); deleteMeasurement(${m.id})" title="Hapus">×</button>
          </div>
        </div>
        <div class="meta">
          <span>${routeTag} ${formatDist(dist)}</span>
          <span>~${formatDist(estCable)} kabel</span>
          <span>${formatMoney(cost)}</span>
        </div>
        ${m.notes ? `<div class="notes">${m.notes}</div>` : ''}
        <div class="meta" style="margin-top:2px;"><span style="color:var(--text-muted)">${m.markers.length} titik${m.routeDistance ? ' · routed' : ' · garis lurus'}</span></div>
      </div>`;
  });

  if (measurements.length > 1) {
    let totalDist = 0, totalCable = 0;
    measurements.forEach(m => { const d = getMeasureTotalDist(m); totalDist += d; totalCable += d * settings.cableMargin; });
    html += `<div style="padding:8px 12px;font-size:11px;color:var(--text-dim);font-family:var(--font-mono);text-align:center;">
      Total: ${formatDist(totalDist)} · ~${formatDist(totalCable)} kabel · ${formatMoney(totalCable * settings.fiberPricePerMeter)}
    </div>`;
    html += `<button class="action-btn danger" style="width:100%;margin-top:4px;justify-content:center;" onclick="clearAllMeasurements()">Hapus Semua</button>`;
  }
  container.innerHTML = html;
}

// ===== SETTINGS =====
function renderSettings() {
  const settingsEl = document.getElementById('settingsList');
  settingsEl.innerHTML = `
    <div class="settings-section">
      <h4>Harga Kabel</h4>
      <div class="settings-row"><label>Fiber (Rp/m)</label><input type="number" value="${settings.fiberPricePerMeter}" onchange="settings.fiberPricePerMeter = parseInt(this.value); saveData();"></div>
      <div class="settings-row"><label>Copper (Rp/m)</label><input type="number" value="${settings.copperPricePerMeter}" onchange="settings.copperPricePerMeter = parseInt(this.value); saveData();"></div>
      <div class="settings-row"><label>Margin kabel (×)</label><input type="number" step="0.05" value="${settings.cableMargin}" onchange="settings.cableMargin = parseFloat(this.value); saveData();"></div>
    </div>
    <div class="settings-section">
      <h4>Daftar Paket</h4>
      <div id="paketListContainer">
        ${paketList.map((p, i) => `<div class="paket-item"><span>${p}</span><button class="paket-delete-btn delete-customer" data-index="${i}" title="Hapus paket">×</button></div>`).join('')}
      </div>
      <div class="paket-add-row">
        <input type="text" id="newPaketInput" placeholder="Nama paket (mis. 30 Mbps)">
        <button class="action-btn" id="paketAddBtn">Tambah</button>
      </div>
    </div>
    <div class="settings-section">
      <h4>Data</h4>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="action-btn secondary" style="font-size:12px;" onclick="exportJSON()">Export JSON</button>
        <button class="action-btn secondary" style="font-size:12px;" onclick="exportCSV()">Export CSV</button>
        <button class="action-btn secondary" style="font-size:12px;" onclick="exportSummary()">Ringkasan</button>
      </div>
    </div>
    <div class="settings-section">
      <h4>Info</h4>
      <p style="font-size:11px;color:var(--text-dim);line-height:1.6;">NET/MAP v2 — Tool perencanaan RT/RW Net<br>Data tersimpan di browser (localStorage).<br>Gunakan Export untuk backup rutin.</p>
    </div>`;

  // Pasang event listener untuk tombol hapus paket (hindari inline onclick yang rawan error)
  document.querySelectorAll('.paket-delete-btn').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.stopPropagation();
      const idx = parseInt(this.dataset.index);
      if (isNaN(idx)) return;
      if (!confirm(`Hapus paket "${paketList[idx]}"?`)) return;
      paketList.splice(idx, 1);
      saveData();
      renderSettings();
    });
  });

  // Pasang event listener untuk tombol Tambah paket
  const addBtn = document.getElementById('paketAddBtn');
  if (addBtn) {
    addBtn.addEventListener('click', function(e) { e.stopPropagation(); addPaket(); });
  }
  // Enter pada input juga menambah paket
  const newInput = document.getElementById('newPaketInput');
  if (newInput) {
    newInput.addEventListener('keydown', function(e) { if (e.key === 'Enter') addPaket(); });
  }
}

function addPaket() {
  const inp = document.getElementById('newPaketInput');
  if (!inp) return;
  const v = inp.value.trim();
  if (!v) { alert('Nama paket tidak boleh kosong'); return; }
  if (paketList.includes(v)) { alert('Nama paket sudah ada'); return; }
  paketList.push(v);
  inp.value = '';
  saveData();
  renderSettings();
}

function removePaket(name) {
  if (!confirm(`Hapus paket "${name}"?`)) return;
  paketList = paketList.filter(p => p !== name);
  saveData();
  renderSettings();
}

// ===== TABS =====
function switchTab(tab) {
  const allList = document.getElementById('allList');
  const measList = document.getElementById('measureList');
  const setList = document.getElementById('settingsList');
  const actions = document.getElementById('panelActionsMain');

  allList.style.display = 'none'; measList.style.display = 'none'; setList.style.display = 'none';
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));

  if (tab === 'all') { allList.style.display = ''; actions.style.display = ''; document.getElementById('tabAll').classList.add('active'); renderAllList(); }
  else if (tab === 'measure') { measList.style.display = ''; actions.style.display = 'none'; document.getElementById('tabMeasure').classList.add('active'); renderMeasureList(); }
  else { setList.style.display = ''; actions.style.display = 'none'; document.getElementById('tabSettings').classList.add('active'); renderSettings(); }
}

function togglePanel() { document.getElementById('sidePanel').classList.toggle('open'); }

// Panel search listener
document.addEventListener('DOMContentLoaded', function() {
  const searchInput = document.getElementById('panelSearchInput');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      setPanelSearch(e.target.value);
    });
  }
});
