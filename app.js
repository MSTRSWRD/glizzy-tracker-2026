const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxjeNeJ_rVJ9l3Q6ZnyTYJ3AFbRuXKRhRd1QfL0g5vrlJAW0LRFw3QxSoPBzgSh9eUYMg/exec';
const ADMIN_PIN = '69420247';
const SEASON_START = new Date('2026-05-25');
const SEASON_END   = new Date('2026-09-07');

let DEFAULT_PLAYERS = [
  { id: 'fleming', displayName: '10,000 Dogs "10-d"', realName: 'Fleming' },
  { id: 'mazzola', displayName: 'Glizzola the Bunless', realName: 'Mazzola' },
  { id: 'taylor',  displayName: 'Glizzstar_69',        realName: 'Taylor'  },
  { id: 'justin',  displayName: 'Glizzdalf',           realName: 'Justin'  },
  { id: 'jordan',  displayName: 'Glunt',               realName: 'Jordan'  },
  { id: 'chris',   displayName: 'Chris',               realName: 'Chris'   },
  { id: 'damon',   displayName: 'Damon',               realName: 'Damon'   },
  { id: 'eloisa',  displayName: 'Eloisa',              realName: 'Eloisa'  },
  { id: 'emily',   displayName: 'Emily',               realName: 'Emily'   },
  { id: 'evan',    displayName: 'Evan',                realName: 'Evan'    },
  { id: 'jen',     displayName: 'Jen',                 realName: 'Jen'     },
  { id: 'kyle',    displayName: 'Kyle',                realName: 'Kyle'    },
  { id: 'lauren',  displayName: 'Lauren',              realName: 'Lauren'  },
  { id: 'parker',  displayName: 'Parker',              realName: 'Parker'  },
  { id: 'sophie',  displayName: 'Sophie',              realName: 'Sophie'  },
];

let state = {
  players: DEFAULT_PLAYERS.map(p => ({ ...p, count: 0 })),
  log: [],
  adminUnlocked: false,
  testMode: false,
  showDeleteConfirm: false,
  showResetConfirm: false,
};
let selectedId = null;
let qty = 1;
let chartInst = null;

// ── API ───────────────────────────────────────────────────────
async function apiFetch(params) {
  const url = APPS_SCRIPT_URL + '?' + new URLSearchParams(params) + '&t=' + Date.now();
  const res = await fetch(url);
  return res.json();
}

async function loadData() {
  setSyncStatus('loading');
  try {
    const data = await apiFetch({ action: 'get' });
    if (data && data.players) {
      const saved = data.players;
      state.players = DEFAULT_PLAYERS.map(def => {
        const ex = saved.find(p => p.id === def.id);
        return ex ? { ...def, displayName: ex.displayName, count: ex.count } : { ...def, count: 0 };
      });
      saved.forEach(p => {
        if (!DEFAULT_PLAYERS.find(d => d.id === p.id)) state.players.push(p);
      });
      state.log = data.log || [];
    }
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('err');
  }
  render();
}

async function saveData() {
  setSyncStatus('loading');
  try {
    await apiFetch({ action: 'set', data: encodeURIComponent(JSON.stringify({ players: state.players, log: state.log })) });
    setSyncStatus('ok');
  } catch(e) {
    setSyncStatus('err');
  }
}

function setSyncStatus(s) {
  const el = document.getElementById('syncStatus');
  el.className = 'sync-status';
  if (s === 'ok')       { el.classList.add('sync-ok');      el.textContent = '✓ synced'; }
  else if (s === 'err') { el.classList.add('sync-err');     el.textContent = '✗ offline'; }
  else                  { el.classList.add('sync-loading'); el.textContent = 'syncing…'; }
}

// ── Season ────────────────────────────────────────────────────
function renderSeason() {
  const now = new Date();
  const pct = Math.max(0, Math.min(100, Math.round(((now - SEASON_START) / (SEASON_END - SEASON_START)) * 100)));
  document.getElementById('seasonBar').style.width = pct + '%';
  document.getElementById('seasonLabel').textContent =
    now < SEASON_START ? 'Season starts May 25, 2026' : pct + '% through the season';
}

// ── Log tab ───────────────────────────────────────────────────
function renderGrid() {
  document.getElementById('playerGrid').innerHTML = state.players.map(p => `
    <div class="player-card${selectedId === p.id ? ' selected' : ''}" data-id="${p.id}">
      <div class="player-card-name">${p.displayName}</div>
    </div>`).join('');
  document.querySelectorAll('.player-card').forEach(card => {
    card.addEventListener('click', () => selectPlayer(card.dataset.id));
  });
  const btn = document.getElementById('logBtn');
  btn.disabled = !selectedId;
  btn.className = 'log-btn' + (state.testMode ? ' test' : '');
  btn.textContent = state.testMode ? 'Log test 🧪' : 'Log it 🌭';
  document.getElementById('testBadge').style.display = state.testMode ? 'inline' : 'none';
}

function dismissCount() {
  document.getElementById('myCountModal').classList.remove('show');
  selectedId = null;
  document.getElementById('logBtn').disabled = true;
  renderGrid();
}

// ── Board ─────────────────────────────────────────────────────
function renderBoard() {
  const area = document.getElementById('boardContent');
  if (!state.adminUnlocked) {
    area.innerHTML = `
      <div class="locked-card">
        <div class="locked-icon">🔒</div>
        <p>Leaderboard is private until end of season.<br>Enter the admin PIN to unlock.</p>
        <div class="pin-row">
          <input class="pin-input" type="password" id="pinInput" maxlength="10" placeholder="PIN"/>
          <button class="pin-btn" id="pinBtn">Unlock</button>
        </div>
        <div class="pin-err" id="pinErr"></div>
      </div>`;
    document.getElementById('pinBtn').addEventListener('click', checkPin);
    document.getElementById('pinInput').addEventListener('keydown', e => { if(e.key==='Enter') checkPin(); });
    return;
  }
  const sorted = [...state.players].sort((a,b) => b.count - a.count);
  const max = Math.max(sorted[0]?.count || 1, 1);
  const medals = ['🥇','🥈','🥉'];
  const rows = sorted.map((p,i) => `
    <div class="board-row">
      <div class="board-medal">${medals[i] || ''}</div>
      <div class="board-rank" style="${medals[i]?'visibility:hidden':''}">${i+1}</div>
      <div class="board-name">${p.displayName}</div>
      <div class="board-bar-wrap"><div class="board-bar" style="width:${Math.round(p.count/max*100)}%"></div></div>
      <div class="board-count">${p.count}</div>
    </div>`).join('');
  const chartH = Math.max(280, sorted.length * 34 + 80);
  area.innerHTML = `
    <p class="section-label" style="margin-bottom:.75rem">Rankings</p>
    ${rows}
    <p class="section-label" style="margin:1.25rem 0 .75rem">Chart</p>
    <div class="chart-wrap" style="height:${chartH}px"><canvas id="boardChart"></canvas></div>`;
  setTimeout(() => {
    const ctx = document.getElementById('boardChart');
    if (!ctx) return;
    if (chartInst) chartInst.destroy();
    chartInst = new Chart(ctx, {
      type: 'bar',
      data: { labels: sorted.map(p => p.displayName), datasets: [{ data: sorted.map(p => p.count), backgroundColor: '#F0997B', borderColor: '#D85A30', borderWidth: 1, borderRadius: 4 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { stepSize: 1, color: '#888780' }, grid: { color: 'rgba(136,135,128,0.12)' } }, y: { ticks: { color: '#444441', font: { size: 12 } }, grid: { display: false } } } }
    });
  }, 60);
}

// ── Feed ──────────────────────────────────────────────────────
function renderFeed() {
  const area = document.getElementById('feedContent');
  if (!state.log.length) { area.innerHTML = '<div class="feed-empty">No glizzies logged yet. The season awaits. 🌭</div>'; return; }
  area.innerHTML = [...state.log].reverse().slice(0,60).map(e => {
    const p = state.players.find(x => x.id === e.playerId);
    const name = p ? p.displayName : e.playerId;
    const dt = new Date(e.ts);
    const time = dt.toLocaleDateString('en-US',{month:'short',day:'numeric'}) + ' at ' + dt.toLocaleTimeString('en-US',{hour:'numeric',minute:'2-digit'});
    return `<div class="feed-item">
      <div class="feed-dot${e.test?' test':''}"></div>
      <div>
        <div class="feed-text">${name} ate ${e.qty} glizz${e.qty>1?'ies':'y'}${e.test?'<span class="inline-badge">test</span>':''}</div>
        <div class="feed-time">${time}</div>
      </div>
    </div>`;
  }).join('');
}

// ── Names ─────────────────────────────────────────────────────
function renderNames() {
  const area = document.getElementById('namesContent');
  area.innerHTML = state.players.map(p => `
    <div class="name-row">
      <div class="name-real">${p.realName}</div>
      <input class="name-input" id="ni-${p.id}" value="${p.displayName}" />
      <button class="name-save" data-id="${p.id}">Save</button>
    </div>`).join('');
  area.querySelectorAll('.name-save').forEach(btn => {
    btn.addEventListener('click', () => saveName(btn.dataset.id));
  });
}

// ── Admin ─────────────────────────────────────────────────────
function renderAdmin() {
  const area = document.getElementById('adminContent');
  if (!state.adminUnlocked) {
    area.innerHTML = `
      <div class="locked-card">
        <div class="locked-icon">⚙️</div>
        <p>Enter PIN to access admin controls.</p>
        <div class="pin-row">
          <input class="pin-input" type="password" id="adminPinInput" maxlength="10" placeholder="PIN"/>
          <button class="pin-btn" id="adminPinBtn">Unlock</button>
        </div>
        <div class="pin-err" id="adminPinErr"></div>
      </div>`;
    document.getElementById('adminPinBtn').addEventListener('click', checkAdminPin);
    document.getElementById('adminPinInput').addEventListener('keydown', e => { if(e.key==='Enter') checkAdminPin(); });
    return;
  }
  const testLogs = state.log.filter(e => e.test);
  const testQty  = testLogs.reduce((s,e)=>s+e.qty,0);
  area.innerHTML = `
    <div class="admin-card">
      <h3>🧪 Test mode</h3>
      <div class="toggle-row">
        <div><div class="toggle-label">Enable test mode</div><div class="toggle-sub">Logs marked as test, excluded from real counts</div></div>
        <label class="toggle"><input type="checkbox" id="testToggle" ${state.testMode?'checked':''}><span class="toggle-slider"></span></label>
      </div>
      ${testLogs.length > 0 ? `
        <div class="info-box">🧪 ${testLogs.length} test log(s) · ${testQty} test glizz${testQty>1?'ies':'y'} on record</div>
        ${state.showDeleteConfirm ? `
          <div class="confirm-box"><p>Delete all test logs and reverse those counts?</p>
            <div class="confirm-btns">
              <button class="btn-yes" id="confirmDeleteBtn">Yes, clear</button>
              <button class="btn-no" id="cancelConfirmBtn">Cancel</button>
            </div>
          </div>` : `<button class="danger-btn" id="clearTestBtn">🗑 Clear test data</button>`}
      ` : '<div class="info-box" style="color:var(--gray-400)">No test data on record.</div>'}
    </div>
    <div class="admin-card">
      <h3>✏️ Edit counts</h3>
      <p style="font-size:12px;color:var(--gray-400);margin-bottom:.75rem">Manually adjust any player's count.</p>
      ${state.players.map(p => `
        <div class="edit-row">
          <div class="edit-name">${p.displayName}</div>
          <input class="edit-input" type="number" id="ec-${p.id}" value="${p.count}" min="0" />
          <button class="edit-save" data-id="${p.id}">Save</button>
          <button class="edit-remove" data-id="${p.id}" title="Remove player">✕</button>
        </div>`).join('')}
    </div>
    <div class="admin-card">
      <h3>➕ Add participant</h3>
      <p style="font-size:12px;color:var(--gray-400);margin-bottom:.5rem">Add someone mid-season — their count starts at 0.</p>
      <div class="add-player-form">
        <input class="add-input" id="addReal" placeholder="Real name" />
        <input class="add-input" id="addDisplay" placeholder="Glizz-name (optional)" />
        <button class="primary-btn" id="addPlayerBtn">Add</button>
      </div>
    </div>
    <div class="admin-card" style="border-color:#F09595">
      <h3 style="color:#A32D2D">⚠️ Danger zone</h3>
      <p style="font-size:13px;color:var(--gray-400);margin-bottom:.75rem">Reset ALL data — counts, logs, name changes. Cannot be undone.</p>
      ${state.showResetConfirm ? `
        <div class="confirm-box"><p>This wipes everything. Are you sure?</p>
          <div class="confirm-btns">
            <button class="btn-yes" id="confirmResetBtn">Yes, reset</button>
            <button class="btn-no" id="cancelResetBtn">Cancel</button>
          </div>
        </div>` : `<button class="danger-btn" id="resetAllBtn">🔄 Reset all data</button>`}
    </div>`;

  // Attach all admin event listeners
  document.getElementById('testToggle')?.addEventListener('change', e => setTestMode(e.target.checked));
  document.getElementById('clearTestBtn')?.addEventListener('click', () => { state.showDeleteConfirm = true; renderAdmin(); });
  document.getElementById('confirmDeleteBtn')?.addEventListener('click', clearTestData);
  document.getElementById('cancelConfirmBtn')?.addEventListener('click', cancelConfirm);
  document.getElementById('resetAllBtn')?.addEventListener('click', () => { state.showResetConfirm = true; renderAdmin(); });
  document.getElementById('confirmResetBtn')?.addEventListener('click', resetAll);
  document.getElementById('cancelResetBtn')?.addEventListener('click', cancelConfirm);
  document.getElementById('addPlayerBtn')?.addEventListener('click', addPlayer);
  area.querySelectorAll('.edit-save').forEach(btn => btn.addEventListener('click', () => saveCount(btn.dataset.id)));
  area.querySelectorAll('.edit-remove').forEach(btn => btn.addEventListener('click', () => removePlayer(btn.dataset.id)));
}

// ── Master render ─────────────────────────────────────────────
function render() {
  renderSeason();
  renderGrid();
  renderBoard();
  renderFeed();
  renderNames();
  renderAdmin();
}

// ── Interactions ──────────────────────────────────────────────
function selectPlayer(id) {
  selectedId = selectedId === id ? null : id;
  document.getElementById('logBtn').disabled = !selectedId;
  document.getElementById('myCountModal').classList.remove('show');
  renderGrid();
}

function changeQty(d) {
  qty = Math.max(1, Math.min(10, qty + d));
  document.getElementById('qtyNum').textContent = qty;
}

async function submitLog() {
  if (!selectedId) return;
  const p = state.players.find(x => x.id === selectedId);
  p.count += qty;
  state.log.push({ playerId: selectedId, qty, ts: Date.now(), test: state.testMode });
  const realCount = state.log.filter(e => e.playerId === selectedId && !e.test).reduce((s,e) => s + e.qty, 0);
  document.getElementById('myCountNum').textContent = realCount;
  document.getElementById('myCountName').textContent = p.displayName;
  document.getElementById('myCountModal').classList.add('show');
  renderGrid(); renderFeed();
  if (state.adminUnlocked) { renderBoard(); renderAdmin(); }
  showToast(state.testMode ? `[TEST] ${p.displayName} +${qty} 🧪` : `${p.displayName} +${qty} 🌭`);
  await saveData();
}

async function saveName(id) {
  const val = document.getElementById('ni-' + id)?.value.trim();
  if (!val) return;
  const p = state.players.find(x => x.id === id);
  if (p) p.displayName = val;
  renderGrid(); renderFeed(); renderAdmin();
  if (state.adminUnlocked) renderBoard();
  showToast('Name updated!');
  await saveData();
}

async function saveCount(id) {
  const val = parseInt(document.getElementById('ec-' + id)?.value);
  if (isNaN(val) || val < 0) return;
  const p = state.players.find(x => x.id === id);
  if (p) p.count = val;
  renderGrid();
  if (state.adminUnlocked) renderBoard();
  showToast(`${p.displayName} updated to ${val}`);
  await saveData();
}

async function addPlayer() {
  const real = document.getElementById('addReal')?.value.trim();
  const display = document.getElementById('addDisplay')?.value.trim();
  if (!real) { showToast('Enter a real name'); return; }
  const id = real.toLowerCase().replace(/[^a-z0-9]/g,'_') + '_' + Date.now();
  state.players.push({ id, realName: real, displayName: display || real, count: 0 });
  document.getElementById('addReal').value = '';
  document.getElementById('addDisplay').value = '';
  renderGrid(); renderNames(); renderAdmin();
  if (state.adminUnlocked) renderBoard();
  showToast(`${display || real} added!`);
  await saveData();
}

async function removePlayer(id) {
  const p = state.players.find(x => x.id === id);
  if (!confirm(`Remove ${p?.displayName}? Their logs will be kept but they won't appear in the list.`)) return;
  state.players = state.players.filter(x => x.id !== id);
  if (selectedId === id) { selectedId = null; document.getElementById('logBtn').disabled = true; }
  renderGrid(); renderNames(); renderAdmin();
  if (state.adminUnlocked) renderBoard();
  showToast(`${p?.displayName} removed`);
  await saveData();
}

function checkPin() {
  if (document.getElementById('pinInput')?.value === ADMIN_PIN) { state.adminUnlocked = true; renderBoard(); }
  else { const e = document.getElementById('pinErr'); if(e) e.textContent = 'Incorrect PIN.'; }
}

function checkAdminPin() {
  if (document.getElementById('adminPinInput')?.value === ADMIN_PIN) { state.adminUnlocked = true; renderAdmin(); }
  else { const e = document.getElementById('adminPinErr'); if(e) e.textContent = 'Incorrect PIN.'; }
}

function setTestMode(on) { state.testMode = on; renderGrid(); renderAdmin(); showToast(on ? 'Test mode on 🧪' : 'Test mode off'); }

async function clearTestData() {
  state.log.filter(e => e.test).forEach(e => { const p = state.players.find(x => x.id === e.playerId); if(p) p.count = Math.max(0, p.count - e.qty); });
  state.log = state.log.filter(e => !e.test);
  state.showDeleteConfirm = false;
  render(); showToast('Test data cleared 🧹'); await saveData();
}

async function resetAll() {
  state.players = DEFAULT_PLAYERS.map(p => ({ ...p, count: 0 }));
  state.log = []; state.showResetConfirm = false; selectedId = null;
  render(); showToast('All data reset'); await saveData();
}

function cancelConfirm() { state.showDeleteConfirm = false; state.showResetConfirm = false; renderAdmin(); }

function switchTab(name) {
  document.querySelectorAll('.tab').forEach((t,i) => t.classList.toggle('active', ['log','board','feed','names','admin'][i] === name));
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById('page-' + name).classList.add('active');
}

let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg; t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('logBtn').addEventListener('click', submitLog);
  document.getElementById('dismissBtn').addEventListener('click', dismissCount);
  document.getElementById('qtyMinus').addEventListener('click', () => changeQty(-1));
  document.getElementById('qtyPlus').addEventListener('click',  () => changeQty(1));
  document.querySelectorAll('.tab').forEach((tab, i) => {
    const names = ['log','board','feed','names','admin'];
    tab.addEventListener('click', () => switchTab(names[i]));
  });
  loadData();
});
