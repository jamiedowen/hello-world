/* ============================================================
   ProCountdown — renderer.js
   Broadcast-quality countdown timer for live events
   ============================================================ */

'use strict';

// ─── STATE ──────────────────────────────────────────────────────────────────

const state = {
  totalSeconds:     600,   // default 10:00
  isRunning:        false,
  isPaused:         false,
  isOvertime:       false,
  overtimeSeconds:  0,
  showTimeOfDay:    false,
  overtimeMode:     true,
  flashOnRed:       true,
  warnings: {
    green:  600,  // 10:00
    yellow: 300,  // 5:00
    red:    60    // 1:00
  },
  currentColorState: 'default',
  controlsVisible:   true,
  redFlashDone:      false,   // track if entrance flash has fired for current red threshold
  _tickInterval:     null,
  _overtimeFlashInterval: null,
  _redEntranceFlashInterval: null
};

// ─── DOM REFS ────────────────────────────────────────────────────────────────

const els = {
  mainTimer:        document.getElementById('main-timer'),
  overtimeIndicator:document.getElementById('overtime-indicator'),
  overtimeValue:    document.getElementById('overtime-value'),
  timerLabel:       document.getElementById('timer-label'),
  timeOfDay:        document.getElementById('time-of-day'),
  statusBadge:      document.getElementById('status-badge'),
  displayArea:      document.getElementById('display-area'),
  messageDisplay:   document.getElementById('message-display'),
  messageText:      document.getElementById('message-text'),
  controlPanel:     document.getElementById('control-panel'),

  // Inputs
  inputHours:       document.getElementById('input-hours'),
  inputMinutes:     document.getElementById('input-minutes'),
  inputSeconds:     document.getElementById('input-seconds'),

  // Buttons
  btnStart:         document.getElementById('btn-start'),
  btnPause:         document.getElementById('btn-pause'),
  btnResume:        document.getElementById('btn-resume'),
  btnReset:         document.getElementById('btn-reset'),
  btnHideControls:  document.getElementById('btn-hide-controls'),
  btnFullscreen:    document.getElementById('btn-fullscreen'),
  btnSend:          document.getElementById('btn-send'),
  btnClearMsg:      document.getElementById('btn-clear-msg'),

  // Warning inputs
  warnGreenMin:     document.getElementById('warn-green-min'),
  warnGreenSec:     document.getElementById('warn-green-sec'),
  warnYellowMin:    document.getElementById('warn-yellow-min'),
  warnYellowSec:    document.getElementById('warn-yellow-sec'),
  warnRedMin:       document.getElementById('warn-red-min'),
  warnRedSec:       document.getElementById('warn-red-sec'),

  // Checkboxes
  chkTimeOfDay:     document.getElementById('chk-timeofday'),
  chkOvertime:      document.getElementById('chk-overtime'),
  chkFlashRed:      document.getElementById('chk-flashred'),

  // Message input
  messageInput:     document.getElementById('message-input'),

  // Drag-bar close
  dragBarClose:     document.getElementById('drag-bar-close')
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────

/**
 * Format seconds into MM:SS or HH:MM:SS
 * @param {number} secs - non-negative integer
 * @returns {string}
 */
function formatTime(secs) {
  secs = Math.max(0, Math.floor(secs));
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  if (h > 0) {
    return `${String(h).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
}

/**
 * Current wall-clock time as HH:MM:SS
 * @returns {string}
 */
function getCurrentTimeOfDay() {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

/**
 * Determine which color state should be active.
 * Checks red first, then yellow, then green, then default.
 * In overtime mode, always 'overtime'.
 * @returns {'default'|'green'|'yellow'|'red'|'overtime'}
 */
function getColorState() {
  // No color indication until the timer has been started at least once
  if (!state.isRunning && !state.isPaused && !state.isOvertime) return 'default';
  if (state.isOvertime) return 'overtime';
  const t = state.totalSeconds;
  if (t <= state.warnings.red)    return 'red';
  if (t <= state.warnings.yellow) return 'yellow';
  if (t <= state.warnings.green)  return 'green';
  return 'default';
}

// ─── COLOR STATE ─────────────────────────────────────────────────────────────

const COLOR_CLASSES = ['color-default', 'color-green', 'color-yellow', 'color-red', 'color-overtime'];

/**
 * Apply body CSS class for current color state, manage flash intervals.
 */
function updateColorState() {
  const newState = getColorState();
  const prevState = state.currentColorState;

  // Stop overtime flash if leaving overtime
  if (prevState === 'overtime' && newState !== 'overtime') {
    _clearOvertimeFlash();
  }

  // Red entrance flash: fire once when first entering red
  if (newState === 'red' && prevState !== 'red' && state.flashOnRed && !state.redFlashDone) {
    state.redFlashDone = true;
    _doRedEntranceFlash();
  }

  // Reset redFlashDone when leaving red
  if (prevState === 'red' && newState !== 'red') {
    state.redFlashDone = false;
  }

  state.currentColorState = newState;

  // Apply body class
  COLOR_CLASSES.forEach(c => document.body.classList.remove(c));
  document.body.classList.add(`color-${newState}`);

  // Start overtime flash if entering overtime
  if (newState === 'overtime') {
    _startOvertimeFlash();
  }
}

function _clearOvertimeFlash() {
  if (state._overtimeFlashInterval) {
    clearInterval(state._overtimeFlashInterval);
    state._overtimeFlashInterval = null;
  }
  document.body.classList.remove('flash-off');
}

function _startOvertimeFlash() {
  if (state._overtimeFlashInterval) return; // already running
  state._overtimeFlashInterval = setInterval(() => {
    document.body.classList.toggle('flash-off');
  }, 500);
}

function _doRedEntranceFlash() {
  // 3 quick flashes: add flash-red-on, remove, add, remove, add, remove
  let count = 0;
  const FLASH_MS = 130;
  if (state._redEntranceFlashInterval) {
    clearInterval(state._redEntranceFlashInterval);
    document.body.classList.remove('flash-red-on');
  }
  state._redEntranceFlashInterval = setInterval(() => {
    document.body.classList.toggle('flash-red-on');
    count++;
    if (count >= 6) { // 3 on + 3 off = 6 toggles
      clearInterval(state._redEntranceFlashInterval);
      state._redEntranceFlashInterval = null;
      document.body.classList.remove('flash-red-on');
    }
  }, FLASH_MS);
}

// ─── DISPLAY UPDATE ───────────────────────────────────────────────────────────

function updateDisplay() {
  if (state.isOvertime) {
    els.mainTimer.textContent = '00:00';
    els.overtimeIndicator.classList.remove('hidden');
    els.overtimeValue.textContent = formatTime(state.overtimeSeconds);
    els.timerLabel.textContent = 'OVERTIME';
  } else {
    els.mainTimer.textContent = formatTime(state.totalSeconds);
    els.overtimeIndicator.classList.add('hidden');
    els.timerLabel.textContent = 'TIME REMAINING';
  }
}

function updateStatus() {
  const badge = els.statusBadge;
  // Clear all badge classes
  badge.classList.remove('badge-stopped', 'badge-running', 'badge-paused', 'badge-overtime');

  if (state.isOvertime) {
    badge.textContent = 'OVERTIME';
    badge.classList.add('badge-overtime');
  } else if (state.isRunning) {
    badge.textContent = 'RUNNING';
    badge.classList.add('badge-running');
  } else if (state.isPaused) {
    badge.textContent = 'PAUSED';
    badge.classList.add('badge-paused');
  } else {
    badge.textContent = 'STOPPED';
    badge.classList.add('badge-stopped');
  }
}

function updateButtonVisibility() {
  if (state.isRunning) {
    els.btnStart.classList.add('hidden');
    els.btnResume.classList.add('hidden');
    els.btnPause.classList.remove('hidden');
  } else if (state.isPaused) {
    els.btnStart.classList.add('hidden');
    els.btnPause.classList.add('hidden');
    els.btnResume.classList.remove('hidden');
  } else {
    // stopped
    els.btnStart.classList.remove('hidden');
    els.btnPause.classList.add('hidden');
    els.btnResume.classList.add('hidden');
  }
}

function updateTimeOfDay() {
  if (state.showTimeOfDay) {
    els.timeOfDay.textContent = getCurrentTimeOfDay();
    els.timeOfDay.classList.remove('hidden');
  } else {
    els.timeOfDay.classList.add('hidden');
  }
}

// ─── TICK ────────────────────────────────────────────────────────────────────

function tick() {
  if (state.isOvertime) {
    state.overtimeSeconds++;
    updateDisplay();
    updateStatus();
    // color state doesn't change in overtime, but updateColorState is cheap
    return;
  }

  if (state.totalSeconds > 0) {
    state.totalSeconds--;
    updateDisplay();
    updateColorState();
    updateStatus();
  }

  // Transition to overtime or stop at zero
  if (state.totalSeconds === 0 && !state.isOvertime) {
    if (state.overtimeMode) {
      // Enter overtime
      state.isOvertime = true;
      state.overtimeSeconds = 0;
      updateColorState();
      updateDisplay();
      updateStatus();
    } else {
      // Stop the timer at zero
      pauseTimer();
      updateStatus();
    }
  }
}

// ─── TIMER CONTROL ───────────────────────────────────────────────────────────

function startTimer() {
  if (state.isRunning) return;

  // If not paused, load from inputs first
  if (!state.isPaused) {
    loadTimeFromInputs();
    state.isOvertime = false;
    state.overtimeSeconds = 0;
    state.redFlashDone = false;
    _clearOvertimeFlash();
  }

  state.isRunning = true;
  state.isPaused  = false;

  // Clear any existing interval before starting
  if (state._tickInterval) {
    clearInterval(state._tickInterval);
  }
  state._tickInterval = setInterval(tick, 1000);

  updateColorState();
  updateDisplay();
  updateStatus();
  updateButtonVisibility();
}

function pauseTimer() {
  if (!state.isRunning) return;
  state.isRunning = false;
  state.isPaused  = true; // always set; overtime resumes same as normal

  if (state._tickInterval) {
    clearInterval(state._tickInterval);
    state._tickInterval = null;
  }

  updateStatus();
  updateButtonVisibility();
}

function resetTimer() {
  // Stop everything
  state.isRunning       = false;
  state.isPaused        = false;
  state.isOvertime      = false;
  state.overtimeSeconds = 0;
  state.redFlashDone    = false;

  if (state._tickInterval) {
    clearInterval(state._tickInterval);
    state._tickInterval = null;
  }

  _clearOvertimeFlash();

  if (state._redEntranceFlashInterval) {
    clearInterval(state._redEntranceFlashInterval);
    state._redEntranceFlashInterval = null;
    document.body.classList.remove('flash-red-on');
  }

  loadTimeFromInputs();

  updateColorState();
  updateDisplay();
  updateStatus();
  updateButtonVisibility();
}

// ─── TIME INPUT ───────────────────────────────────────────────────────────────

function loadTimeFromInputs() {
  const h = Math.max(0, parseInt(els.inputHours.value,   10) || 0);
  const m = Math.max(0, parseInt(els.inputMinutes.value, 10) || 0);
  const s = Math.max(0, parseInt(els.inputSeconds.value, 10) || 0);
  state.totalSeconds = (h * 3600) + (m * 60) + s;
}

// ─── ADJUST TIME ──────────────────────────────────────────────────────────────

/**
 * Adjust time by delta seconds. Works while running.
 * In overtime mode, adjust the overtime counter (subtracting from overtime, minimum 0).
 * @param {number} delta - seconds to add (can be negative)
 */
function adjustTime(delta) {
  if (state.isOvertime) {
    // Adjusting in overtime: positive delta reduces overtime, negative adds to it
    // But semantically: +5m means "add 5 more minutes to countdown" -> exit overtime
    if (delta > 0) {
      // Add time back: exit overtime if we have enough
      if (delta > state.overtimeSeconds) {
        // Come back out of overtime
        const remaining = delta - state.overtimeSeconds;
        state.overtimeSeconds = 0;
        state.isOvertime      = false;
        state.totalSeconds    = remaining;
        _clearOvertimeFlash();
      } else {
        state.overtimeSeconds -= delta;
      }
    } else {
      // Negative delta: add more overtime
      state.overtimeSeconds += Math.abs(delta);
    }
  } else {
    state.totalSeconds = Math.max(0, state.totalSeconds + delta);
  }

  // Force color re-evaluation
  updateColorState();
  updateDisplay();
  updateStatus();
}

// ─── WARNINGS ────────────────────────────────────────────────────────────────

function updateWarnings() {
  const gm = Math.max(0, parseInt(els.warnGreenMin.value,  10) || 0);
  const gs = Math.max(0, parseInt(els.warnGreenSec.value,  10) || 0);
  const ym = Math.max(0, parseInt(els.warnYellowMin.value, 10) || 0);
  const ys = Math.max(0, parseInt(els.warnYellowSec.value, 10) || 0);
  const rm = Math.max(0, parseInt(els.warnRedMin.value,    10) || 0);
  const rs = Math.max(0, parseInt(els.warnRedSec.value,    10) || 0);

  state.warnings.green  = (gm * 60) + gs;
  state.warnings.yellow = (ym * 60) + ys;
  state.warnings.red    = (rm * 60) + rs;

  // Re-evaluate color in case we're already in a threshold zone
  updateColorState();
}

// ─── MESSAGE ─────────────────────────────────────────────────────────────────

function sendMessage() {
  const text = els.messageInput.value.trim();
  if (!text) return;
  els.messageText.textContent = text;
  els.messageDisplay.classList.remove('hidden');
}

function clearMessage() {
  els.messageDisplay.classList.add('hidden');
  els.messageText.textContent = '';
  els.messageInput.value = '';
}

// ─── CONTROLS VISIBILITY ─────────────────────────────────────────────────────

function toggleControls() {
  state.controlsVisible = !state.controlsVisible;
  if (state.controlsVisible) {
    els.controlPanel.classList.remove('hidden');
    els.btnHideControls.textContent = 'HIDE CONTROLS';
  } else {
    els.controlPanel.classList.add('hidden');
    els.btnHideControls.textContent = 'SHOW CONTROLS';
  }
}

// ─── FULLSCREEN ───────────────────────────────────────────────────────────────

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
    els.btnFullscreen.textContent = 'EXIT FULLSCREEN';
    document.body.classList.add('fullscreen');
  } else {
    document.exitFullscreen().catch(() => {});
    els.btnFullscreen.textContent = 'FULLSCREEN';
    document.body.classList.remove('fullscreen');
  }
}

// ─── EVENT LISTENERS ──────────────────────────────────────────────────────────

// Main timer controls
els.btnStart.addEventListener('click', startTimer);
els.btnPause.addEventListener('click', pauseTimer);
els.btnResume.addEventListener('click', startTimer);
els.btnReset.addEventListener('click', resetTimer);

// Adjust buttons
document.querySelectorAll('.btn-adjust').forEach(btn => {
  btn.addEventListener('click', () => {
    const delta = parseInt(btn.dataset.adjust, 10);
    if (!isNaN(delta)) adjustTime(delta);
  });
});

// Warning inputs
[
  els.warnGreenMin, els.warnGreenSec,
  els.warnYellowMin, els.warnYellowSec,
  els.warnRedMin, els.warnRedSec
].forEach(input => {
  input.addEventListener('change', updateWarnings);
  input.addEventListener('input',  updateWarnings);
});

// Set-time inputs: when changed while stopped, update display
[els.inputHours, els.inputMinutes, els.inputSeconds].forEach(input => {
  input.addEventListener('change', () => {
    if (!state.isRunning && !state.isPaused) {
      loadTimeFromInputs();
      updateColorState();
      updateDisplay();
    }
  });
});

// Message controls
els.btnSend.addEventListener('click', sendMessage);
els.btnClearMsg.addEventListener('click', clearMessage);

// Enter key in message input
els.messageInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendMessage();
});

// Checkbox: Show Time of Day
els.chkTimeOfDay.addEventListener('change', () => {
  state.showTimeOfDay = els.chkTimeOfDay.checked;
  updateTimeOfDay();
});

// Checkbox: Overtime Mode
els.chkOvertime.addEventListener('change', () => {
  state.overtimeMode = els.chkOvertime.checked;
});

// Checkbox: Flash on Red
els.chkFlashRed.addEventListener('change', () => {
  state.flashOnRed  = els.chkFlashRed.checked;
  state.redFlashDone = false; // allow re-flash if re-enabled
});

// Hide / Show controls
els.btnHideControls.addEventListener('click', toggleControls);

// Fullscreen
els.btnFullscreen.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  if (!document.fullscreenElement) {
    els.btnFullscreen.textContent = 'FULLSCREEN';
    document.body.classList.remove('fullscreen');
  }
});

// Drag-bar close button (frameless window)
els.dragBarClose.addEventListener('click', () => {
  // In Electron with nodeIntegration, we can use remote or ipcRenderer
  // Simplest: window.close() works in Electron
  window.close();
});

// ─── KEYBOARD SHORTCUTS ───────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  // Don't fire shortcuts when typing in inputs
  const tag = document.activeElement.tagName.toLowerCase();
  if (tag === 'input' || tag === 'textarea') return;

  switch (e.key) {
    case ' ':
    case 'Space':
      e.preventDefault();
      if (state.isRunning) {
        pauseTimer();
      } else {
        startTimer();
      }
      break;

    case 'r':
    case 'R':
      e.preventDefault();
      resetTimer();
      break;

    case '+':
    case '=':   // '=' without shift on US keyboard
      e.preventDefault();
      adjustTime(60);
      break;

    case '-':
    case '_':
      e.preventDefault();
      adjustTime(-60);
      break;

    case 'h':
    case 'H':
      e.preventDefault();
      toggleControls();
      break;

    case 'f':
    case 'F':
      e.preventDefault();
      toggleFullscreen();
      break;
  }
});

// ─── LIVE CLOCK ───────────────────────────────────────────────────────────────

setInterval(updateTimeOfDay, 1000);

// ─── INITIALIZE ───────────────────────────────────────────────────────────────

(function init() {
  // Sync checkbox defaults with state
  els.chkOvertime.checked  = state.overtimeMode;
  els.chkFlashRed.checked  = state.flashOnRed;
  els.chkTimeOfDay.checked = state.showTimeOfDay;

  // Read warning inputs into state
  updateWarnings();

  // Load time from the pre-filled inputs (default 0:10:00 = 600s)
  loadTimeFromInputs();

  // Initial render
  updateColorState();
  updateDisplay();
  updateStatus();
  updateButtonVisibility();
  updateTimeOfDay();
})();
