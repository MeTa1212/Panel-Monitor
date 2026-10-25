// ============================================================
// Reactive Store — Firebase Realtime Database
// Real-time sync across ALL devices on the internet.
// Same API as before: onChange, updatePanel, getPanels, etc.
// ============================================================

var db = firebase.database();
var panelsRef = db.ref('panels');
var _changeCallbacks = new Set();
var _cache = {};
var _storeReady = false;
var _readyCallbacks = [];

// ---- Color palette (cycles for any number of panels) ----
var PANEL_COLORS = [
  '#3B82F6', '#10B981', '#F59E0B', '#F43F5E', '#8B5CF6',
  '#EC4899', '#06B6D4', '#84CC16', '#F97316', '#6366F1'
];

function getPanelColor(id) {
  return PANEL_COLORS[(parseInt(id, 10) - 1) % PANEL_COLORS.length];
}

// ---- Initialize 5 default panels if DB is empty ----
function _initDefaults() {
  panelsRef.once('value').then(function (snap) {
    if (!snap.exists()) {
      var defaults = {};
      for (var i = 1; i <= 5; i++) {
        defaults[i] = {
          name: 'Panel ' + i,
          status: 'busy',
          freeAt: null,
          updatedAt: Date.now(),
        };
      }
      panelsRef.set(defaults);
    }
  });
}

// ---- Read (from local cache, always in sync) ----
function getPanels() {
  return _cache;
}

function getPanel(id) {
  return _cache[id] || null;
}

function getPanelCount() {
  return Object.keys(_cache).length;
}

// ---- Write ----
function updatePanel(id, updates) {
  return db.ref('panels/' + id).update({
    ...updates,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });
}

function addPanel(id, name) {
  return db.ref('panels/' + id).set({
    name: name,
    status: 'busy',
    freeAt: null,
    updatedAt: firebase.database.ServerValue.TIMESTAMP,
  });
}

function removePanel(id) {
  return db.ref('panels/' + id).remove();
}

// ---- Subscribe to changes ----
function onChange(callback) {
  _changeCallbacks.add(callback);
  // If store already has data, deliver immediately
  if (_storeReady) {
    try { callback(_cache); } catch (e) { console.error(e); }
  }
  return function unsubscribe() {
    _changeCallbacks.delete(callback);
  };
}

// Called once when store is first ready
function onReady(callback) {
  if (_storeReady) {
    callback(_cache);
  } else {
    _readyCallbacks.push(callback);
  }
}

// ---- Firebase listener (single listener for all panels) ----
panelsRef.on('value', function (snapshot) {
  _cache = snapshot.val() || {};
  var wasReady = _storeReady;
  _storeReady = true;

  // Fire ready callbacks once
  if (!wasReady) {
    _readyCallbacks.forEach(function (cb) {
      try { cb(_cache); } catch (e) { console.error(e); }
    });
    _readyCallbacks = [];
  }

  // Fire change callbacks
  _changeCallbacks.forEach(function (cb) {
    try { cb(_cache); } catch (e) { console.error(e); }
  });
});

// ---- Connection monitoring ----
function onConnectionChange(callback) {
  db.ref('.info/connected').on('value', function (snap) {
    callback(snap.val() === true);
  });
}

// ---- Init ----
_initDefaults();
