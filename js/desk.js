// ============================================================
// Desk Screen Logic
// Registration desk sees ALL panels live from Firebase.
// Can add new panels on the fly during a session.
// Can reset any panel back to Busy ("Sent candidate ✔").
// ============================================================

var previousStates = {};
var isFirstLoad = true;
var freeSinceTimer = null;

// ---- Initialization ----
function init() {
  setupConnectionIndicator();

  onChange(function (panels) {
    renderPanelCards(panels);
    updateReadyQueue(panels);

    // Detect newly-free panels (skip first load to avoid false alerts)
    if (!isFirstLoad) {
      var ids = Object.keys(panels);
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (panels[id].status === 'free' && previousStates[id] !== 'free') {
          flashCard(id);
          playNotificationSound();
        }
      }
    }

    // Snapshot for next comparison
    previousStates = {};
    var allIds = Object.keys(panels);
    for (var j = 0; j < allIds.length; j++) {
      previousStates[allIds[j]] = panels[allIds[j]].status;
    }
    isFirstLoad = false;
  });

  // Update "free since" timers every 10 seconds
  freeSinceTimer = setInterval(function () {
    updateFreeSinceTimers(getPanels());
  }, 10000);
}

// ---- Render Panel Cards (dynamic count) ----
function renderPanelCards(panels) {
  var grid = document.getElementById('panels-grid');
  var ids = Object.keys(panels).sort(function (a, b) {
    return parseInt(a, 10) - parseInt(b, 10);
  });

  // Build a map of existing card elements
  var existingCards = {};
  var currentCards = grid.querySelectorAll('.desk-panel-card');
  for (var c = 0; c < currentCards.length; c++) {
    existingCards[currentCards[c].getAttribute('data-panel')] = currentCards[c];
  }

  // Remove cards for panels that no longer exist
  var existingIds = Object.keys(existingCards);
  for (var r = 0; r < existingIds.length; r++) {
    if (!panels[existingIds[r]]) {
      existingCards[existingIds[r]].remove();
    }
  }

  // Update or create cards
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var data = panels[id];
    var color = getPanelColor(id);
    var card = document.getElementById('panel-card-' + id);

    if (!card) {
      // Create new card
      card = document.createElement('div');
      card.className = 'card desk-panel-card';
      card.id = 'panel-card-' + id;
      card.setAttribute('data-panel', id);
      card.innerHTML =
        '<div class="card-top-bar" style="background:' + color + '"></div>' +
        '<div class="card-body">' +
        '<div class="card-header">' +
        '<div class="panel-name">' +
        '<span class="color-dot" style="background:' + color + '"></span>' +
        '<span id="card-name-' + id + '">' + data.name + '</span>' +
        '</div>' +
        '</div>' +
        '<div class="card-status" id="card-status-' + id + '">' +
        '<span class="status-dot busy" id="card-dot-' + id + '"></span>' +
        '<span id="card-status-label-' + id + '">🔴 Busy</span>' +
        '</div>' +
        '<div class="free-since" id="card-free-since-' + id + '"></div>' +
        '<div class="card-action" id="card-action-' + id + '"></div>' +
        '</div>';
      grid.appendChild(card);
    }

    // Update card content
    var hasFlash = card.classList.contains('flash-free');
    card.className = 'card desk-panel-card status-' + data.status;
    card.setAttribute('data-panel', id);
    if (hasFlash) card.classList.add('flash-free');

    var nameEl = document.getElementById('card-name-' + id);
    if (nameEl) nameEl.textContent = data.name;

    var dot = document.getElementById('card-dot-' + id);
    dot.className = 'status-dot ' + data.status;

    var map = { free: '🟢 Free', busy: '🔴 Busy', break: '🟡 Break' };
    document.getElementById('card-status-label-' + id).textContent = map[data.status] || data.status;

    var freeSince = document.getElementById('card-free-since-' + id);
    if (data.status === 'free' && data.freeAt) {
      freeSince.textContent = 'Free since ' + timeAgo(data.freeAt);
    } else {
      freeSince.textContent = '';
    }

    var action = document.getElementById('card-action-' + id);
    if (data.status === 'free') {
      action.innerHTML =
        '<button class="btn btn-primary btn-sm" id="sent-btn-' + id + '" onclick="sentCandidate(' + id + ')">' +
        'Sent candidate ✔</button>';
    } else {
      action.innerHTML = '';
    }
  }
}

// ---- Update "free since" timers ----
function updateFreeSinceTimers(panels) {
  var ids = Object.keys(panels);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    var data = panels[id];
    var el = document.getElementById('card-free-since-' + id);
    if (el && data.status === 'free' && data.freeAt) {
      el.textContent = 'Free since ' + timeAgo(data.freeAt);
    }
  }
}

// ---- Ready Queue ----
function updateReadyQueue(panels) {
  var queueList = document.getElementById('queue-list');
  var queueBadge = document.getElementById('queue-badge');

  // Collect free panels, sort by freeAt ascending
  var freePanels = [];
  var ids = Object.keys(panels);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (panels[id].status === 'free' && panels[id].freeAt) {
      freePanels.push({ id: id, data: panels[id] });
    }
  }
  freePanels.sort(function (a, b) {
    return a.data.freeAt - b.data.freeAt;
  });

  queueBadge.textContent = freePanels.length;

  if (freePanels.length === 0) {
    queueList.innerHTML = '<li class="queue-empty">No panels free right now</li>';
    return;
  }

  var html = '';
  for (var idx = 0; idx < freePanels.length; idx++) {
    var p = freePanels[idx];
    var color = getPanelColor(p.id);
    html +=
      '<li class="queue-item">' +
      '<span class="queue-rank">' + (idx + 1) + '</span>' +
      '<div class="queue-info">' +
      '<div class="queue-name">' +
      '<span style="color:' + color + '">●</span> ' + p.data.name +
      '</div>' +
      '<div class="queue-time">Free ' + timeAgo(p.data.freeAt) + '</div>' +
      '</div>' +
      '</li>';
  }
  queueList.innerHTML = html;
}

// ---- Desk Actions ----
function sentCandidate(id) {
  updatePanel(id, { status: 'busy', freeAt: null });
}

// ---- Add Panel (on the fly, during a session) ----
function addNewPanel() {
  var panels = getPanels();
  var ids = Object.keys(panels).map(function (x) { return parseInt(x, 10); });
  var nextId = ids.length > 0 ? Math.max.apply(null, ids) + 1 : 1;
  var name = 'Panel ' + nextId;
  addPanel(nextId, name);
}

// ---- Flash Animation ----
function flashCard(id) {
  var card = document.getElementById('panel-card-' + id);
  if (!card) return;
  card.classList.remove('flash-free');
  void card.offsetWidth; // force reflow
  card.classList.add('flash-free');
  setTimeout(function () {
    card.classList.remove('flash-free');
  }, 1500);
}

// ---- Notification Sound (Web Audio API — no files needed) ----
function playNotificationSound() {
  try {
    var ctx = new (window.AudioContext || window.webkitAudioContext)();
    var notes = [523.25, 659.25, 783.99]; // C5 → E5 → G5 major triad
    for (var i = 0; i < notes.length; i++) {
      (function (freq, delay) {
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        var t = ctx.currentTime + delay;
        gain.gain.setValueAtTime(0.12, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
        osc.start(t);
        osc.stop(t + 0.5);
      })(notes[i], i * 0.12);
    }
  } catch (e) {
    // Web Audio not supported
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

// ---- Time Ago Helper ----
function timeAgo(timestamp) {
  var seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 10) return 'just now';
  if (seconds < 60) return seconds + 's ago';
  var minutes = Math.floor(seconds / 60);
  if (minutes === 1) return '1 min ago';
  return minutes + ' min ago';
}

// ---- Start ----
document.addEventListener('DOMContentLoaded', init);
