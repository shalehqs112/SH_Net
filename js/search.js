// ===== SEARCH =====
let searchTimeout = null;
let searchMarker = null;
let lastSearchRequest = 0;
const SEARCH_MIN_INTERVAL = DEFAULT_SETTINGS.searchDebounceMs; // Rate limiting

const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');
const searchClear = document.getElementById('searchClear');

searchInput.addEventListener('input', function() {
  const val = this.value.trim();
  searchClear.classList.toggle('show', val.length > 0);
  clearTimeout(searchTimeout);
  if (val.length < 2) { searchResults.classList.remove('show'); return; }

  // Raw coordinates
  const coordMatch = val.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  if (coordMatch) {
    const lat = parseFloat(coordMatch[1]), lng = parseFloat(coordMatch[2]);
    if (isValidCoords(lat, lng)) {
      searchResults.innerHTML = `<div class="search-result-item" onclick="goToCoord(${lat}, ${lng}, 'Koordinat: ${lat.toFixed(5)}, ${lng.toFixed(5)}')">
        <div class="result-name">📍 Langsung ke koordinat</div>
        <div class="result-detail">${lat.toFixed(5)}, ${lng.toFixed(5)}</div>
      </div>`;
      searchResults.classList.add('show');
      return;
    }
  }

  // Local node search
  const localResults = nodes.filter(n => n.name.toLowerCase().includes(val.toLowerCase()));
  if (localResults.length > 0) {
    let html = localResults.slice(0, 3).map(n => {
      const typeConfig = getNodeType(n.type);
      return `<div class="search-result-item" onclick="flyToNode(${n.id})">
        <div class="result-name"><span style="color:${typeConfig.color}">●</span> ${n.name}</div>
        <div class="result-detail">${n.type} · ${n.lat.toFixed(4)}, ${n.lng.toFixed(4)}</div>
      </div>`;
    }).join('');
    html += '<div style="border-top:1px solid var(--border);padding:4px 14px;font-size:10px;color:var(--text-muted);">Cari alamat...</div>';
    searchResults.innerHTML = html;
    searchResults.classList.add('show');
  }

  // Rate-limited address search with debounce
  searchTimeout = setTimeout(() => searchAddress(val), SEARCH_MIN_INTERVAL);
});

searchInput.addEventListener('keydown', function(e) {
  if (e.key === 'Enter') { const first = searchResults.querySelector('.search-result-item'); if (first) first.click(); }
  if (e.key === 'Escape') { searchResults.classList.remove('show'); searchInput.blur(); }
});

document.addEventListener('click', function(e) {
  if (!e.target.closest('.search-bar')) searchResults.classList.remove('show');
});

function searchAddress(query) {
  const now = Date.now();
  if (now - lastSearchRequest < SEARCH_MIN_INTERVAL) {
    return; // Rate limiting: skip if too soon
  }
  lastSearchRequest = now;
  
  const viewbox = DEFAULT_SETTINGS.searchViewbox;
  const api = API_ENDPOINTS.NOMINATIM_SEARCH;
  
  fetch(`${api}?format=json&q=${urlEncode(query)}&viewbox=${viewbox}&bounded=0&limit=5&accept-language=id`, {
    headers: {
      'User-Agent': 'RTRWNetMap/2.0'
    }
  })
    .then(r => r.json())
    .then(results => {
      if (results.length === 0) return;
      const localPart = searchResults.querySelectorAll('.search-result-item').length > 0 ?
        Array.from(searchResults.querySelectorAll('.search-result-item')).map(el => el.outerHTML).join('') : '';

      let html = localPart ? localPart + '<div style="border-top:1px solid var(--border);padding:4px 14px;font-size:10px;color:var(--text-muted);">Alamat:</div>' : '';
      results.forEach(r => {
        const name = r.display_name.split(',')[0];
        const detail = r.display_name.split(',').slice(1, 3).join(',').trim();
        html += `<div class="search-result-item" onclick="goToCoord(${r.lat}, ${r.lon}, '${name.replace(/'/g, "\\'")}')">
          <div class="result-name">${name}</div>
          <div class="result-detail">${detail} · ${parseFloat(r.lat).toFixed(4)}, ${parseFloat(r.lon).toFixed(4)}</div>
        </div>`;
      });
      searchResults.innerHTML = html;
      searchResults.classList.add('show');
    })
    .catch(err => {
      debugLog('Search API Error', err);
      // Silent fail - don't disturb user
    });
}

function goToCoord(lat, lng, label) {
  searchResults.classList.remove('show');
  if (searchMarker) map.removeLayer(searchMarker);
  const searchIcon = L.divIcon({
    className: 'custom-marker',
    html: '<div style="width:20px;height:20px;background:#f43f5e;border:3px solid #fff;border-radius:50%;box-shadow:0 0 0 6px rgba(244,63,94,0.25), 0 2px 8px rgba(0,0,0,0.3);"></div>',
    iconSize: [20, 20], iconAnchor: [10, 10]
  });
  searchMarker = L.marker([lat, lng], { icon: searchIcon }).addTo(map);
  searchMarker.bindPopup(`<strong>${label}</strong><br><small style="color:#999">${parseFloat(lat).toFixed(5)}, ${parseFloat(lng).toFixed(5)}</small>`).openPopup();
  map.setView([lat, lng], 17);
}

function clearSearch() {
  searchInput.value = ''; searchClear.classList.remove('show'); searchResults.classList.remove('show');
  if (searchMarker) { map.removeLayer(searchMarker); searchMarker = null; }
}
