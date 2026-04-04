// ===== CENTRALIZED CONFIGURATION =====

// Node Types & Colors
const NODE_TYPES = {
  BASE: {
    key: 'base',
    label: 'BASE',
    color: '#0026ff',
    colorDim: 'rgba(0, 85, 255, 0.15)',
    icon: 'base'
  },
  HUB: {
    key: 'hub',
    label: 'HUB',
    color: '#a855f7',
    colorDim: 'rgba(168, 85, 247, 0.15)',
    icon: 'hub'
  },
  CUSTOMER: {
    key: 'customer',
    label: '',
    color: '#22d3ee',
    colorDim: 'rgba(34, 211, 238, 0.15)',
    icon: 'customer'
  }
};

// Get type config by key
function getNodeType(typeKey) {
  return Object.values(NODE_TYPES).find(t => t.key === typeKey) || NODE_TYPES.CUSTOMER;
}

// Get color by type
function getTypeColor(typeKey) {
  return getNodeType(typeKey).color;
}

// Get label by type
function getTypeLabel(typeKey) {
  return getNodeType(typeKey).label;
}

// Input Constraints & Validation
const CONSTRAINTS = {
  LAT: { min: -90, max: 90, name: 'Latitude' },
  LNG: { min: -180, max: 180, name: 'Longitude' },
  HUB_PORTS: { min: 1, max: 32, default: 4, name: 'Hub Ports' },
  NAME: { minLength: 1, maxLength: 100, name: 'Name' },
  PHONE: { pattern: /^[\d\s\+\-]*$/, maxLength: 20, name: 'Phone' },
  NOTE: { maxLength: 500, name: 'Note' }
};

// Status Options
const STATUS_OPTIONS = [
  { value: 'aktif', label: 'Aktif', color: '#10b981' },
  { value: 'tidak_aktif', label: 'Tidak Aktif', color: '#f59e0b' },
  { value: 'calon', label: 'Calon', color: '#3b82f6' }
];

// Hub Port Options
const HUB_PORT_OPTIONS = [
  { value: 4, label: '4 Port (HTB 4SC)' },
  { value: 6, label: '6 Port (HTB 6SC)' },
  { value: 8, label: '8 Port (HTB 8SC)' }
];

// Default Settings
const DEFAULT_SETTINGS = {
  fiberPricePerMeter: 3500,
  copperPricePerMeter: 5000,
  cableMargin: 1.15,
  searchDebounceMs: 1000,
  gpsAccuracyThreshold: 100,
  mapDefaultZoom: 14,
  mapDefaultCenter: [-1.2654, 116.8312], // Banjarmasin
  searchViewbox: '115.0,-2.5,118.0,1.5' // Kalimantan
};

// Default paket list (can be managed in settings)
const DEFAULT_PAKET_LIST = ['10 Mbps', '20 Mbps', '50 Mbps'];
// API Endpoints
const API_ENDPOINTS = {
  OSRM_ROUTE: 'https://router.project-osrm.org/route/v1/driving/',
  NOMINATIM_SEARCH: 'https://nominatim.openstreetmap.org/search'
};

// Tile Layer Providers
const TILE_LAYERS = {
  SATELLITE: {
    url: 'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}',
    attribution: '© Google',
    maxZoom: 20
  },
  SATELLITE_LABELS: {
    url: 'https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}',
    attribution: '© Google',
    maxZoom: 20
  }
};

// Measurement Settings
const MEASUREMENT = {
  CACHE_MAX_SIZE: 100,
  ROUTE_CACHE_ENABLED: true,
  STRAIGHT_LINE_THRESHOLD: 5000 // meters
};

// Error Messages
const ERROR_MESSAGES = {
  REQUIRED_FIELD: 'Field ini wajib diisi',
  INVALID_LAT: 'Latitude harus antara -90 dan 90',
  INVALID_LNG: 'Longitude harus antara -180 dan 180',
  INVALID_COORDS: 'Koordinat tidak valid',
  INVALID_PHONE: 'Nomor HP hanya boleh berisi angka, spasi, +, dan -',
  INVALID_PORTS: 'Jumlah port harus antara 1 dan 32',
  NAME_TOO_LONG: 'Nama terlalu panjang (max 100 karakter)',
  NOTE_TOO_LONG: 'Catatan terlalu panjang (max 500 karakter)',
  NO_DATA: 'Belum ada data',
  GPS_UNAVAILABLE: 'GPS tidak tersedia',
  GPS_ERROR: 'GPS gagal',
  IMPORT_NO_DATA: 'Tidak ada data valid untuk diimport',
  IMPORT_FORMAT_ERROR: 'Format file tidak dikenali',
  ROUTE_FAILED: 'Gagal mendapatkan rute (menggunakan garis lurus)',
  SEARCH_API_ERROR: 'Gagal mencari alamat'
};

// Sort Options
const SORT_OPTIONS = [
  { key: 'type', label: 'Tipe' },
  { key: 'name', label: 'Nama' },
  { key: 'hub', label: 'Hub' },
  { key: 'newest', label: 'Terbaru' }
];

// Animations
const ANIMATIONS = {
  MODAL_DURATION: 100, // ms
  TRANSITION_DURATION: 0.3 // seconds
};
