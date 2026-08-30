'use strict';

// ============================================================
// SUPABASE
// ============================================================
const SUPABASE_URL = 'https://fhpuulstseaeounkljem.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lk304ArmTsqpm9UZdU8NSg_JCdxKusj';
const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ============================================================
// CONSTANTS
// ============================================================
const DAYS_IT   = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const MONTHS_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                   'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];

// ============================================================
// FESTIVITÀ ITALIANE
// ============================================================
function easterDate(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day   = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function isItalianHoliday(dateStr) {
  const d = fromDateStr(dateStr);
  const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();

  // Festività fisse
  const fixed = [
    [1,1],[1,6],[4,25],[5,1],[6,2],[8,15],[11,1],[12,8],[12,25],[12,26]
  ];
  if (fixed.some(([fm, fd]) => m === fm && day === fd)) return true;

  // Pasqua e Lunedì dell'Angelo
  const easter = easterDate(y);
  const easterMonday = new Date(easter); easterMonday.setDate(easter.getDate() + 1);
  if (toDateStr(easter) === dateStr || toDateStr(easterMonday) === dateStr) return true;

  return false;
}

function isClosedDay(dateStr) {
  const d = fromDateStr(dateStr);
  return d.getDay() === 2 && !isItalianHoliday(dateStr); // 2 = martedì
}

// ============================================================
// STATE
// ============================================================
const s = {
  viewDate:  toDateStr(new Date()),
  calYear:   new Date().getFullYear(),
  calMonth:  new Date().getMonth(),
  editingId: null,
  service:   'lunch',
  adults:    2,
  children:  0,
};

let reservations = [];

// ============================================================
// DATA LAYER — Supabase
// ============================================================
async function loadData() {
  const { data, error } = await db
    .from('prenotazioni')
    .select('*')
    .order('date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) { showError('Errore nel caricamento dei dati.'); return; }
  reservations = data || [];
}

async function insertReservation(row) {
  const { data, error } = await db
    .from('prenotazioni')
    .insert(row)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function updateReservation(id, changes) {
  const { data, error } = await db
    .from('prenotazioni')
    .update(changes)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function removeReservation(id) {
  const { error } = await db
    .from('prenotazioni')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ============================================================
// DATE UTILS
// ============================================================
function toDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function fromDateStr(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function todayStr() { return toDateStr(new Date()); }

function shiftDate(str, days) {
  const d = fromDateStr(str);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

function fmtDayLabel(str) {
  return DAYS_IT[fromDateStr(str).getDay()];
}

function fmtDateLong(str) {
  const d = fromDateStr(str);
  return `${d.getDate()} ${MONTHS_IT[d.getMonth()]} ${d.getFullYear()}`;
}

// ============================================================
// DATA QUERIES
// ============================================================
function forDate(date, service) {
  return reservations.filter(r =>
    r.date === date && (service == null || r.service === service)
  );
}

function totalPeople(list) {
  return list.reduce((n, r) => n + (r.adults || 0) + (r.children || 0), 0);
}

// ============================================================
// SAFE HTML
// ============================================================
function esc(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

// ============================================================
// ERROR TOAST
// ============================================================
function showError(msg) {
  let toast = document.getElementById('errorToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'errorToast';
    toast.style.cssText = `
      position:fixed; bottom:90px; left:50%; transform:translateX(-50%);
      background:#FF3B30; color:#fff; padding:10px 20px; border-radius:12px;
      font-size:14px; font-weight:600; z-index:999; white-space:nowrap;
      box-shadow:0 4px 16px rgba(255,59,48,0.4);
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.style.opacity = '1';
  setTimeout(() => { toast.style.opacity = '0'; }, 3000);
}

// ============================================================
// RENDER — HOME
// ============================================================
function renderHome() {
  const date  = s.viewDate;
  const today = todayStr();

  document.getElementById('dayLabel').textContent   = fmtDayLabel(date);
  document.getElementById('dayDateSub').textContent = fmtDateLong(date);
  document.getElementById('btnGoToday').classList.toggle('hidden', date !== today);

  renderList('lunch');
  renderList('dinner');
}

function renderList(service) {
  const date  = s.viewDate;
  const items = forDate(date, service);
  const list  = document.getElementById(service === 'lunch' ? 'lunchList' : 'dinnerList');
  const chip  = document.getElementById(service === 'lunch' ? 'lunchChip' : 'dinnerChip');

  list.innerHTML = '';

  if (items.length === 0) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.textContent = service === 'lunch'
      ? 'Nessuna prenotazione a pranzo'
      : 'Nessuna prenotazione a cena';
    list.appendChild(el);
    chip.innerHTML = '<span class="chip-item">0 coperti</span>';
    return;
  }

  const pax = totalPeople(items);
  chip.innerHTML = `<span class="chip-item">${pax} coperti</span><span class="chip-item">${items.length} ${items.length === 1 ? 'tavolo' : 'tavoli'}</span>`;

  items.forEach(r => list.appendChild(buildCard(r)));
}

function buildCard(r) {
  const isDinner = r.service === 'dinner';
  const card = document.createElement('div');
  card.className = `res-card${isDinner ? ' dinner-card' : ''}`;
  card.dataset.id = r.id;

  const adults   = r.adults   ?? r.people ?? 0;
  const children = r.children ?? 0;
  const badgeText = children > 0
    ? `${adults}<span class="badge-sep">+</span>${children}<span class="badge-child">👶</span>`
    : `${adults}`;

  card.innerHTML = `
    <div class="res-card-inner">
      <span class="res-badge">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
          <circle cx="9" cy="7" r="4"/>
          <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
        </svg>
        ${badgeText}
      </span>
      <span class="res-name">${esc(r.name)}</span>
      <button class="res-edit-btn" aria-label="Modifica">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
          <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
        </svg>
      </button>
    </div>
    ${r.notes ? `<div class="res-notes-row"><p class="res-notes-text">${esc(r.notes)}</p></div>` : ''}
  `;

  card.addEventListener('click', () => openEdit(r.id));
  return card;
}

// ============================================================
// RENDER — CALENDAR
// ============================================================
function renderCalendar() {
  const year  = s.calYear;
  const month = s.calMonth;
  const today = todayStr();

  document.getElementById('calMonthTitle').textContent = `${MONTHS_IT[month]} ${year}`;

  const grid = document.getElementById('calGrid');
  grid.innerHTML = '';

  const firstDow    = new Date(year, month, 1).getDay();
  const offset      = (firstDow + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevDays    = new Date(year, month, 0).getDate();

  for (let i = 0; i < 42; i++) {
    let day, dm, dy, inMonth = true;

    if (i < offset) {
      day = prevDays - offset + i + 1;
      dm = month - 1; dy = year;
      if (dm < 0) { dm = 11; dy = year - 1; }
      inMonth = false;
    } else if (i - offset < daysInMonth) {
      day = i - offset + 1;
      dm = month; dy = year;
    } else {
      day = i - offset - daysInMonth + 1;
      dm = month + 1; dy = year;
      if (dm > 11) { dm = 0; dy = year + 1; }
      inMonth = false;
    }

    const cellDate  = toDateStr(new Date(dy, dm, day));
    const isToday   = cellDate === today;
    const isSelected = cellDate === s.viewDate;
    const isClosed  = inMonth && isClosedDay(cellDate);

    const dayRes    = forDate(cellDate, null);
    const hasLunch  = dayRes.some(r => r.service === 'lunch');
    const hasDinner = dayRes.some(r => r.service === 'dinner');

    const cell = document.createElement('div');
    cell.className = [
      'cal-cell',
      !inMonth   ? 'other-month' : '',
      isToday    ? 'is-today'    : '',
      isSelected ? 'is-selected' : '',
      isClosed   ? 'is-closed'   : '',
    ].filter(Boolean).join(' ');

    cell.innerHTML = `
      <span class="cal-num">${day}</span>
      <div class="cal-dots">
        ${hasLunch  ? '<span class="cal-dot lunch-dot"></span>'  : ''}
        ${hasDinner ? '<span class="cal-dot dinner-dot"></span>' : ''}
      </div>
    `;

    cell.addEventListener('click', () => {
      s.viewDate = cellDate;
      switchView('home');
    });

    grid.appendChild(cell);
  }

  // Nascondi ultima riga se tutta fuori mese
  const cells = grid.querySelectorAll('.cal-cell');
  const lastRow = Array.from(cells).slice(35);
  if (lastRow.every(c => c.classList.contains('other-month'))) {
    lastRow.forEach(c => c.style.display = 'none');
  }
}

// ============================================================
// VIEW SWITCHING
// ============================================================
function switchView(name) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  if (name === 'home') {
    document.getElementById('viewHome').classList.add('active');
    document.querySelector('[data-view="home"]').classList.add('active');
    renderHome();
  } else {
    const d = fromDateStr(s.viewDate);
    s.calYear  = d.getFullYear();
    s.calMonth = d.getMonth();
    document.getElementById('viewCalendar').classList.add('active');
    document.querySelector('[data-view="calendar"]').classList.add('active');
    renderCalendar();
  }
}

// ============================================================
// MODAL
// ============================================================
function openAdd(service) {
  s.editingId = null;
  s.service   = service;
  s.adults    = 2;
  s.children  = 0;

  document.getElementById('sheetTitle').textContent  = 'Nuova prenotazione';
  document.getElementById('formId').value            = '';
  document.getElementById('formDate').value          = s.viewDate;
  document.getElementById('formName').value          = '';
  document.getElementById('formNotes').value         = '';
  document.getElementById('stepAdults').textContent  = '2';
  document.getElementById('stepChildren').textContent = '0';
  document.getElementById('btnDeleteRes').classList.add('hidden');
  setSvc(service);
  showModal();
}

function openEdit(id) {
  const r = reservations.find(x => x.id === id);
  if (!r) return;

  s.editingId = id;
  s.service   = r.service;
  s.adults    = r.adults   ?? r.people ?? 2;
  s.children  = r.children ?? 0;

  document.getElementById('sheetTitle').textContent   = 'Modifica prenotazione';
  document.getElementById('formId').value             = id;
  document.getElementById('formDate').value           = r.date;
  document.getElementById('formName').value           = r.name;
  document.getElementById('formNotes').value          = r.notes || '';
  document.getElementById('stepAdults').textContent   = s.adults;
  document.getElementById('stepChildren').textContent = s.children;
  document.getElementById('btnDeleteRes').classList.remove('hidden');
  setSvc(r.service);
  showModal();
}

function setSvc(val) {
  s.service = val;
  document.querySelectorAll('.svc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.value === val)
  );
}

function showModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  setTimeout(() => document.getElementById('formName').focus(), 300);
}

function hideModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
}

// ============================================================
// SAVE BUTTON STATE
// ============================================================
function setBtnLoading(loading) {
  const btn = document.getElementById('btnSaveRes');
  btn.disabled = loading;
  btn.textContent = loading ? 'Salvo…' : 'Salva prenotazione';
}

// ============================================================
// CONFIRM DIALOG
// ============================================================
function confirmDelete() {
  return new Promise(resolve => {
    const overlay = document.getElementById('confirmOverlay');
    overlay.classList.remove('hidden');

    const onOk     = () => cleanup(true);
    const onCancel = () => cleanup(false);

    function cleanup(result) {
      overlay.classList.add('hidden');
      document.getElementById('confirmOk').removeEventListener('click', onOk);
      document.getElementById('confirmCancel').removeEventListener('click', onCancel);
      resolve(result);
    }

    document.getElementById('confirmOk').addEventListener('click', onOk);
    document.getElementById('confirmCancel').addEventListener('click', onCancel);
  });
}

// ============================================================
// FORM HANDLERS
// ============================================================
async function handleSubmit(e) {
  e.preventDefault();

  const date  = document.getElementById('formDate').value;
  const name  = document.getElementById('formName').value.trim();
  const notes = document.getElementById('formNotes').value.trim();

  if (!date || !name) return;
  if (s.adults < 1) { showError('Inserisci almeno 1 adulto.'); return; }

  setBtnLoading(true);

  try {
    const people = s.adults + s.children;
    if (s.editingId) {
      const updated = await updateReservation(s.editingId, {
        date, service: s.service, name, people, adults: s.adults, children: s.children, notes
      });
      const idx = reservations.findIndex(r => r.id === s.editingId);
      if (idx !== -1) reservations[idx] = updated;
    } else {
      const created = await insertReservation({
        date, service: s.service, name, people, adults: s.adults, children: s.children, notes
      });
      reservations.push(created);
      reservations.sort((a, b) =>
        a.date !== b.date
          ? a.date.localeCompare(b.date)
          : new Date(a.created_at) - new Date(b.created_at)
      );
    }
  } catch {
    showError('Errore nel salvataggio. Riprova.');
    setBtnLoading(false);
    return;
  }

  setBtnLoading(false);
  s.viewDate = date;
  hideModal();
  renderHome();
}

async function handleDelete() {
  const confirmed = await confirmDelete();
  if (!confirmed) return;

  try {
    await removeReservation(s.editingId);
    reservations = reservations.filter(r => r.id !== s.editingId);
  } catch {
    showError('Errore nell\'eliminazione. Riprova.');
    return;
  }

  hideModal();
  renderHome();
}

// ============================================================
// SWIPE GESTURE
// ============================================================
function initSwipe() {
  const nav = document.getElementById('dayNavigator');
  let startX = 0;

  nav.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
  }, { passive: true });

  nav.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) < 50) return;
    s.viewDate = shiftDate(s.viewDate, dx < 0 ? 1 : -1);
    renderHome();
  }, { passive: true });
}

// ============================================================
// THEME
// ============================================================
function initTheme() {
  const stored = localStorage.getItem('theme') || 'light';
  setTheme(stored);
}

function setTheme(mode) {
  document.documentElement.setAttribute('data-theme', mode);
  localStorage.setItem('theme', mode);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = mode === 'dark' ? '#000000' : '#ffffff';
}

// ============================================================
// INIT
// ============================================================
async function init() {
  initTheme();

  // Loading state
  document.getElementById('lunchList').innerHTML = '<div class="empty-state">Caricamento…</div>';
  document.getElementById('dinnerList').innerHTML = '<div class="empty-state">Caricamento…</div>';

  await loadData();

  // Navigation
  document.getElementById('btnPrevDay').addEventListener('click', () => {
    s.viewDate = shiftDate(s.viewDate, -1);
    renderHome();
  });
  document.getElementById('btnNextDay').addEventListener('click', () => {
    s.viewDate = shiftDate(s.viewDate, 1);
    renderHome();
  });
  document.getElementById('btnGoToday').addEventListener('click', () => {
    s.viewDate = todayStr();
    renderHome();
  });

  document.querySelectorAll('.nav-item').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.view === 'home') s.viewDate = todayStr();
      switchView(btn.dataset.view);
    });
  });

  document.querySelectorAll('.add-res-btn').forEach(btn => {
    btn.addEventListener('click', () => openAdd(btn.dataset.service));
  });

  document.getElementById('btnPrevMonth').addEventListener('click', () => {
    s.calMonth--;
    if (s.calMonth < 0) { s.calMonth = 11; s.calYear--; }
    renderCalendar();
  });
  document.getElementById('btnNextMonth').addEventListener('click', () => {
    s.calMonth++;
    if (s.calMonth > 11) { s.calMonth = 0; s.calYear++; }
    renderCalendar();
  });

  document.querySelectorAll('.svc-btn').forEach(btn => {
    btn.addEventListener('click', () => setSvc(btn.dataset.value));
  });

  document.getElementById('btnDecAdults').addEventListener('click', () => {
    if (s.adults > 0) { s.adults--; document.getElementById('stepAdults').textContent = s.adults; }
  });
  document.getElementById('btnIncAdults').addEventListener('click', () => {
    if (s.adults < 99) { s.adults++; document.getElementById('stepAdults').textContent = s.adults; }
  });
  document.getElementById('btnDecChildren').addEventListener('click', () => {
    if (s.children > 0) { s.children--; document.getElementById('stepChildren').textContent = s.children; }
  });
  document.getElementById('btnIncChildren').addEventListener('click', () => {
    if (s.children < 99) { s.children++; document.getElementById('stepChildren').textContent = s.children; }
  });

  document.getElementById('reservationForm').addEventListener('submit', handleSubmit);
  document.getElementById('btnCloseModal').addEventListener('click', hideModal);
  document.getElementById('btnDeleteRes').addEventListener('click', handleDelete);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) hideModal();
  });

  initSwipe();
  switchView('home');
}

document.addEventListener('DOMContentLoaded', init);
