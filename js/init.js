// ===== INIT =====
loadData();
nodes.forEach(n => addMarkerToMap(n));
updateStats();
renderAllList();
initGPS();

// Add event listener for add button to prevent event bubbling
document.getElementById('addBtn').addEventListener('click', function(e) {
  e.stopPropagation();
  toggleAddDropdown();
});
