// ===== UTILITY HELPER FUNCTIONS =====

/**
 * Format jarak dalam meter ke string yang readable
 * @param {number} meters - Jarak dalam meter
 * @returns {string} Format jarak (contoh: "1.23 km" atau "456 m")
 */
function formatDist(meters) {
  if (typeof meters !== 'number' || meters < 0) return '0 m';
  if (meters > 1000) return (meters / 1000).toFixed(2) + ' km';
  return Math.round(meters) + ' m';
}

/**
 * Format uang dalam Rupiah
 * @param {number} rp - Jumlah Rupiah
 * @returns {string} Format uang (contoh: "Rp 1.5jt" atau "Rp 50rb")
 */
function formatMoney(rp) {
  if (typeof rp !== 'number' || rp < 0) return 'Rp 0';
  if (rp >= 1000000) return 'Rp ' + (rp / 1000000).toFixed(1) + 'jt';
  if (rp >= 1000) return 'Rp ' + (rp / 1000).toFixed(0) + 'rb';
  return 'Rp ' + Math.round(rp);
}

/**
 * Download file ke browser user
 * @param {string} content - Konten file
 * @param {string} filename - Nama file
 * @param {string} mimeType - MIME type (contoh: 'text/plain', 'application/json')
 */
function downloadFile(content, filename, mimeType) {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Error downloading file:', error);
    alert('Gagal mendownload file: ' + error.message);
  }
}

/**
 * Format tanggal dalam format Indonesia
 * @param {Date|string} date - Tanggal
 * @returns {string} Format tanggal
 */
function formatDate(date) {
  const d = new Date(date);
  return d.toLocaleDateString('id-ID', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

/**
 * Format jam dalam format Indonesia
 * @param {Date|string} date - Tanggal
 * @returns {string} Format jam
 */
function formatTime(date) {
  const d = new Date(date);
  return d.toLocaleTimeString('id-ID', { 
    hour: '2-digit', 
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Generate timestamp ISO string
 */
function getTimestamp() {
  return new Date().toISOString();
}

/**
 * Sleep/delay dalam ms
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Debounce function
 * @param {Function} func - Function yang akan di-debounce
 * @param {number} wait - Delay dalam ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

/**
 * Throttle function
 * @param {Function} func - Function yang akan di-throttle
 * @param {number} limit - Limit dalam ms
 * @returns {Function} Throttled function
 */
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

/**
 * Copy text ke clipboard
 */
function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(() => true).catch(() => false);
  }
  // Fallback untuk browser lama
  const textarea = document.createElement('textarea');
  textarea.value = text;
  document.body.appendChild(textarea);
  textarea.select();
  const success = document.execCommand('copy');
  document.body.removeChild(textarea);
  return success;
}

/**
 * URL encode string
 */
function urlEncode(str) {
  return encodeURIComponent(str);
}

/**
 * Generate unique ID
 */
function generateId() {
  return Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

/**
 * Compare dua object secara deep
 */
function deepEqual(obj1, obj2) {
  return JSON.stringify(obj1) === JSON.stringify(obj2);
}

/**
 * Deep copy object
 */
function deepCopy(obj) {
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch (e) {
    console.warn('Deep copy failed:', e);
    return obj;
  }
}

/**
 * Show notification toast (simple implementation)
 */
function showNotification(message, type = 'info', duration = 3000) {
  // Type: 'success', 'error', 'warning', 'info'
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    padding: 12px 20px;
    border-radius: 8px;
    background: ${type === 'error' ? '#f43f5e' : type === 'success' ? '#10b981' : type === 'warning' ? '#f59e0b' : '#3b82f6'};
    color: white;
    font-size: 13px;
    font-weight: 600;
    z-index: 10000;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    animation: slideIn 0.3s ease;
  `;
  notification.textContent = message;
  document.body.appendChild(notification);
  
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

/**
 * Get current memory usage info (jika tersedia)
 */
function getMemoryInfo() {
  if (performance.memory) {
    return {
      usedJSHeapSize: (performance.memory.usedJSHeapSize / 1048576).toFixed(2) + ' MB',
      totalJSHeapSize: (performance.memory.totalJSHeapSize / 1048576).toFixed(2) + ' MB',
      jsHeapSizeLimit: (performance.memory.jsHeapSizeLimit / 1048576).toFixed(2) + ' MB'
    };
  }
  return null;
}

/**
 * Log informasi untuk debugging
 */
function debugLog(label, data) {
  if (localStorage.getItem('DEBUG_MODE')) {
    console.log(`[${label}]`, data);
  }
}

/**
 * Format jarak dari hub ke customer dengan estimasi kabel
 */
function formatDistanceWithCable(distanceMeters, cableMargin = DEFAULT_SETTINGS.cableMargin) {
  const straightDist = formatDist(distanceMeters);
  const cableDist = formatDist(distanceMeters * cableMargin);
  return { straight: straightDist, cable: cableDist, cableMeters: distanceMeters * cableMargin };
}

/**
 * Hitung total kabel untuk hub
 */
function calculateHubTotalCable(hub, customers, cableMargin = DEFAULT_SETTINGS.cableMargin) {
  if (!hub || !Array.isArray(customers)) return 0;
  
  return customers.reduce((total, customer) => {
    const hubLatLng = L.latLng(hub.lat, hub.lng);
    const custLatLng = L.latLng(customer.lat, customer.lng);
    const distance = hubLatLng.distanceTo(custLatLng);
    return total + (distance * cableMargin);
  }, 0);
}

/**
 * Hitung biaya kabel
 */
function calculateCableCost(distanceMeters, pricePerMeter = DEFAULT_SETTINGS.fiberPricePerMeter) {
  return distanceMeters * pricePerMeter;
}
