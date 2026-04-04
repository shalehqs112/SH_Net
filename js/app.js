// ===== GLOBAL STATE =====
let nodes = [];
let myLocation = null;
let addMode = false;
let addType = null;
let measureMode = false;
let measurePoints = [];
let measurements = [];
let measureIdCounter = 0;
let pendingLatLng = null;
let editingNodeId = null;
let editingMeasureId = null;
let myMarker = null;
let myAccuracyCircle = null;
let nodeMarkers = {};
let activeHubId = null;
let hubHighlightLayers = [];
let routeCache = {};
let currentSort = 'newest';
let currentGroup = ''; // '' = no group filter (show all). values: ''|'base'|'hub'|'customer'

let settings = {
  fiberPricePerMeter: DEFAULT_SETTINGS.fiberPricePerMeter,
  copperPricePerMeter: DEFAULT_SETTINGS.copperPricePerMeter,
  cableMargin: DEFAULT_SETTINGS.cableMargin
};

// Paket list (managed in settings, persisted via storage.js)
let paketList = [...DEFAULT_PAKET_LIST];

// ===== HELPERS =====
function getHubs() { return nodes.filter(n => n.type === 'hub'); }
function getCustomers() { return nodes.filter(n => n.type === 'customer'); }
function getBases() { return nodes.filter(n => n.type === 'base'); }
function getNodeById(id) { return nodes.find(n => n.id === id); }
function getCustomersForHub(hubId) { return nodes.filter(n => n.type === 'customer' && n.hubId == hubId); }
