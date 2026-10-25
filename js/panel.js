// ============================================================
// Panel Screen Logic
// Each panel device sees and controls ONLY its own panel.
// Panels are loaded dynamically from Firebase (supports any count).
// ============================================================

var PANEL_ID_KEY = 'panel_queue_selected_panel';
var panelId = null;
var currentStatus = null;

// ---- Initialization ----
function init() {
  // Set up connection indicator
  setupConnectionIndicator();

  var saved = localStorage.getItem(PANEL_ID_KEY);
  if (saved) {
    // Verify panel still exists in DB, then lock
    onReady(function (panels) {
      if (panels[saved]) {
        lockToPanel(saved);
      } else {
        // Panel was deleted, re-show selection
        localStorage.removeItem(PANEL_ID_KEY);
        showSelection();
      }
    });
  } else {
    showSelection();
  }
}

// ---- Selection Screen (dynamic) ----
function showSelection() {
  document.getElementById('selection-screen').classList.remove('hidden');
  document.getElementById('controls-screen').classList.add('hidden');
  document.getElementById('switch-panel-link').classList.add('hidden');

  // Render available panels from Firebase
  onChange(function (panels) {
    if (panelId) return; // already locked, ignore updates
    renderSelectionButtons(panels);
  });
}

function renderSelectionButtons(panels) {
  var grid = document.getElementById('panel-grid');
  var ids = Object.keys(panels).sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10);
  });

  if (ids.length === 0) {
    grid.innerHTML =
      '<p class="text-secondary" style="grid-column:1/-1;text-align:center;padding:24px;">' +
      'No panels created yet.<br>Ask the registration desk to add panels.' +
      '</p>';
    return;
  }

  grid.innerHTML = ids
    .map(function (id) {
      var color = getPanelColor(id);
      var p = panels[id];
      return (
        '<button class="panel-select-btn" data-panel="' + id + '" onclick="selectPanel(' + id + ')">' +
        '<div class="panel-dot" style="background:' + color + '"></div>' +
        '<span class="panel-label">' + p.name + '</span>' +
        '</button>'
      );
    })
    .join('');
}

function selectPanel(id) {
  localStorage.setItem(PANEL_ID_KEY, id);
  lockToPanel(id);
}

// ---- Lock to Panel ----
function lockToPanel(id) {
  panelId = parseInt(id, 10);
  var color = getPanelColor(id);

  document.getElementById('selection-screen').classList.add('hidden');
  document.getElementById('controls-screen').classList.remove('hidden');
  document.getElementById('switch-panel-link').classList.remove('hidden');

  // Style badge
  var badge = document.getElementById('panel-badge');
  badge.style.borderColor = color;
  badge.style.color = color;
  badge.style.background = hexToRgba(color, 0.08);
  document.getElementById('panel-badge-dot').style.background = color;

  // Listen for own panel changes
  onChange(function (panels) {
    var data = panels[panelId];
    if (data) {
      document.getElementById('panel-badge-label').textContent = data.name;
      updateUI(data);
    }
  });
}

// ---- Update Controls UI ----
function updateUI(data) {
  currentStatus = data.status;

  // Status dot
  document.getElementById('status-dot').className = 'status-dot ' + data.status;

  // Status label
  var map = { free: '🟢 Free', busy: '🔴 Busy', break: '🟡 Break' };
  document.getElementById('status-label').textContent = map[data.status] || data.status;

  // Sub text
  var sub = document.getElementById('status-sub');
  if (data.status === 'free') {
    sub.textContent = 'Waiting for next candidate...';
  } else if (data.status === 'break') {
    sub.textContent = 'On break — not accepting candidates';
  } else {
    sub.textContent = 'Interview in progress';
  }

  renderActions(data);
}

function renderActions(data) {
  var area = document.getElementById('action-area');
  area.innerHTML = '';

  if (data.status === 'busy') {
    area.innerHTML =
      '<button class="btn btn-success btn-lg" id="free-btn" onclick="setFree()">✅ I\'m free, send next!</button>' +
      '<button class="btn btn-warning" id="break-btn" onclick="setBreak()">🟡 Take a break</button>';
  } else if (data.status === 'free') {
    area.innerHTML =
      '<div class="waiting-message">' +
      '<div class="waiting-dots"><span></span><span></span><span></span></div>' +
      '<p style="font-weight:600; color: var(--green);">Waiting for next candidate...</p>' +
      '</div>' +
      '<button class="btn btn-outline" id="undo-btn" onclick="undoFree()">↩ Undo — not ready yet</button>';
  } else if (data.status === 'break') {
    area.innerHTML =
      '<button class="btn btn-success btn-lg" id="back-btn" onclick="resumeFromBreak()">🟢 I\'m back — resume</button>' +
      '<p class="text-muted" style="margin-top:8px;font-size:0.9rem;">Desk will not send candidates while on break.</p>';
  }
}

// ---- Actions (write ONLY to own panel) ----
function setFree() {
  updatePanel(panelId, {
    status: 'free',
    freeAt: firebase.database.ServerValue.TIMESTAMP,
  });
}

function undoFree() {
  updatePanel(panelId, { status: 'busy', freeAt: null });
}

function setBreak() {
  updatePanel(panelId, { status: 'break', freeAt: null });
}

function resumeFromBreak() {
  updatePanel(panelId, { status: 'busy', freeAt: null });
}

// ---- Switch Panel ----
function switchPanel() {
  if (confirm('Switch panel? This will disconnect from the current panel. Are you sure?')) {
    localStorage.removeItem(PANEL_ID_KEY);
    panelId = null;
    currentStatus = null;
    showSelection();
  }
}

// ---- Connection indicator ----
function setupConnectionIndicator() {
  var el = document.getElementById('connection-status');
  if (!el) return;
  onConnectionChange(function (connected) {
    var dot = el.querySelector('.connection-dot');
    var label = el.querySelector('.connection-label');
    if (connected) {
      el.classList.remove('offline');
      label.textContent = 'Live';
    } else {
      el.classList.add('offline');
      label.textContent = 'Offline';
    }
  });
}

// ---- Helpers ----
function hexToRgba(hex, alpha) {
  var r = parseInt(hex.slice(1, 3), 16);
  var g = parseInt(hex.slice(3, 5), 16);
  var b = parseInt(hex.slice(5, 7), 16);
  return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')';
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
