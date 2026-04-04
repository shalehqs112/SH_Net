// ===== INPUT VALIDATION UTILITIES =====

/**
 * Validasi koordinat latitude
 */
function isValidLat(lat) {
  return typeof lat === 'number' && lat >= CONSTRAINTS.LAT.min && lat <= CONSTRAINTS.LAT.max;
}

/**
 * Validasi koordinat longitude
 */
function isValidLng(lng) {
  return typeof lng === 'number' && lng >= CONSTRAINTS.LNG.min && lng <= CONSTRAINTS.LNG.max;
}

/**
 * Validasi koordinat lengkap
 */
function isValidCoords(lat, lng) {
  return isValidLat(lat) && isValidLng(lng);
}

/**
 * Parse koordinat dari string (contoh: "-1.23, 116.89" atau "-1.23 116.89")
 * @param {string} str - String koordinat
 * @returns {Object|null} {lat, lng} atau null jika invalid
 */
function parseCoords(str) {
  const trimmed = str.trim();
  // Regex yang lebih ketat: memerlukan minimal satu digit sebelum atau sesudah desimal
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/);
  
  if (!match) return null;
  
  const lat = parseFloat(match[1]);
  const lng = parseFloat(match[2]);
  
  return isValidCoords(lat, lng) ? { lat, lng } : null;
}

/**
 * Validasi nama (tidak kosong, tidak terlalu panjang)
 */
function isValidName(name) {
  if (typeof name !== 'string') return false;
  const trimmed = name.trim();
  return trimmed.length > 0 && trimmed.length <= CONSTRAINTS.NAME.maxLength;
}

/**
 * Validasi nomor HP
 */
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  if (phone.length === 0) return true; // Optional field
  if (phone.length > CONSTRAINTS.PHONE.maxLength) return false;
  return CONSTRAINTS.PHONE.pattern.test(phone);
}

/**
 * Validasi port hub
 */
function isValidPorts(ports) {
  if (ports === '' || ports === null || ports === undefined) return true;
  const p = parseInt(ports);
  return !isNaN(p) && p >= 1;
}

/**
 * Validasi catatan
 */
function isValidNote(note) {
  return typeof note === 'string' && note.length <= CONSTRAINTS.NOTE.maxLength;
}

/**
 * Validasi node object lengkap
 */
function isValidNode(node) {
  if (!node || typeof node !== 'object') return { valid: false, errors: ['Data tidak valid'] };
  
  const errors = [];
  
  // Check required fields
  if (!node.id) errors.push('ID tidak ada');
  if (!isValidName(node.name)) errors.push(ERROR_MESSAGES.REQUIRED_FIELD + ' (Nama)');
  if (!isValidCoords(node.lat, node.lng)) {
    errors.push(ERROR_MESSAGES.INVALID_COORDS);
  }
  if (!node.type || !['base', 'hub', 'customer'].includes(node.type)) {
    errors.push('Tipe node tidak valid');
  }
  
  // Type-specific validation
  if (node.type === 'hub' && !isValidPorts(node.ports)) {
    errors.push(ERROR_MESSAGES.INVALID_PORTS);
  }
  
  if (node.type === 'customer' && node.phone && !isValidPhone(node.phone)) {
    errors.push(ERROR_MESSAGES.INVALID_PHONE);
  }
  
  // Optional field validation
  if (node.notes && !isValidNote(node.notes)) {
    errors.push(ERROR_MESSAGES.NOTE_TOO_LONG);
  }
  
  return { valid: errors.length === 0, errors };
}

/**
 * Clean/normalize coordinate
 */
function sanitizeCoords(lat, lng) {
  const latNum = parseFloat(lat);
  const lngNum = parseFloat(lng);
  
  if (!isValidCoords(latNum, lngNum)) {
    return null;
  }
  
  // Round to 6 decimal places (max precision needed for mapping)
  return {
    lat: parseFloat(latNum.toFixed(6)),
    lng: parseFloat(lngNum.toFixed(6))
  };
}

/**
 * Sanitize node data sebelum save
 */
function sanitizeNode(node) {
  if (!node) return null;
  
  const sanitized = {
    id: node.id,
    type: node.type,
    name: (node.name || '').trim(),
    lat: node.lat,
    lng: node.lng,
    notes: (node.notes || '').trim(),
    createdAt: node.createdAt || new Date().toISOString()
  };
  
  // Type-specific fields
  if (node.type === 'hub') {
    const p = parseInt(node.ports);
    sanitized.ports = isNaN(p) ? null : Math.max(1, p);
  }
  
  if (node.type === 'customer') {
    sanitized.phone = (node.phone || '').trim();
    sanitized.paket = (node.paket || '').trim();
    sanitized.status = node.status || 'aktif';
    sanitized.hubId = node.hubId || '';
  }
  
  return sanitized;
}

/**
 * Validate import data
 */
function validateImportData(rawData) {
  const errors = [];
  const warnings = [];
  
  if (!Array.isArray(rawData)) {
    errors.push('Data harus berupa array');
    return { valid: false, errors, warnings, data: [] };
  }
  
  if (rawData.length === 0) {
    errors.push(ERROR_MESSAGES.IMPORT_NO_DATA);
    return { valid: false, errors, warnings, data: [] };
  }
  
  const validNodes = [];
  
  rawData.forEach((item, index) => {
    if (!item.name || typeof item.lat !== 'number' || typeof item.lng !== 'number') {
      warnings.push(`Baris ${index + 1}: Data tidak lengkap, skip`);
      return;
    }
    
    const coordCheck = sanitizeCoords(item.lat, item.lng);
    if (!coordCheck) {
      warnings.push(`Baris ${index + 1} (${item.name}): Koordinat tidak valid, skip`);
      return;
    }
    
    // Tentukan tipe jika tidak ada
    const type = item.type || 'customer';
    
    const node = {
      id: item.id || Date.now() + Math.random(),
      type: type,
      name: item.name.trim().substring(0, CONSTRAINTS.NAME.maxLength),
      lat: coordCheck.lat,
      lng: coordCheck.lng,
      notes: (item.notes || '').trim().substring(0, CONSTRAINTS.NOTE.maxLength),
      phone: item.phone ? (item.phone + '').trim().substring(0, CONSTRAINTS.PHONE.maxLength) : '',
      paket: item.paket || '',
      status: item.status || 'aktif',
      hubId: item.hubId || '',
      createdAt: item.createdAt || new Date().toISOString()
    };
    
    // Validate ports untuk hub
    if (type === 'hub') {
      const p = parseInt(item.ports);
      node.ports = isNaN(p) ? null : Math.max(1, p);
    }
    
    validNodes.push(node);
  });
  
  if (validNodes.length === 0) {
    errors.push(ERROR_MESSAGES.IMPORT_NO_DATA);
    return { valid: false, errors, warnings, data: [] };
  }
  
  return {
    valid: true,
    errors: [],
    warnings,
    data: validNodes,
    importedCount: validNodes.length,
    skippedCount: rawData.length - validNodes.length
  };
}

/**
 * Bulk validate nodes for consistency
 */
function validateNodeConsistency(nodes) {
  const issues = [];
  
  // Check for duplicate IDs
  const ids = new Set();
  nodes.forEach(n => {
    if (ids.has(n.id)) {
      issues.push(`Ditemukan duplikat ID: ${n.id}`);
    }
    ids.add(n.id);
  });
  
  // Check hub references
  const hubIds = new Set(nodes.filter(n => n.type === 'hub').map(n => n.id));
  nodes.forEach(n => {
    if (n.type === 'customer' && n.hubId && !hubIds.has(parseInt(n.hubId))) {
      issues.push(`Pelanggan "${n.name}" mereferensi hub yang tidak ada (${n.hubId})`);
    }
  });
  
  return { valid: issues.length === 0, issues };
}
