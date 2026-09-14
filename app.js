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
const DAYS_IT    = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'];
const DAYS_SHORT = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'];
const MONTHS_IT  = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
                    'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];

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
// ============================================================
// NOTE GIORNALIERE
// ============================================================
let dailyNotes = {}; // { "2026-08-31": "testo" }

async function loadNotes() {
  const { data } = await db.from('note_giornaliere').select('date,testo');
  if (data) data.forEach(r => { dailyNotes[r.date] = r.testo; });
}

async function saveNote(date, testo) {
  await db.from('note_giornaliere').upsert({ date, testo, updated_at: new Date().toISOString() });
  dailyNotes[date] = testo;
}

function renderNotePreview() {
  const testo = dailyNotes[s.viewDate] || '';
  const el = document.getElementById('notePreview');
  if (!testo.trim()) {
    el.textContent = 'Tocca per aggiungere una nota…';
    el.classList.add('note-empty');
  } else {
    const lines = testo.split('\n').filter(l => l.trim()).slice(0, 3);
    el.textContent = lines.join(' · ');
    el.classList.remove('note-empty');
  }
}

function openNoteModal() {
  const date = s.viewDate;
  document.getElementById('noteTitleLabel').textContent = `Note — ${fmtDateLong(date)}`;
  document.getElementById('noteTextarea').value = dailyNotes[date] || '';
  document.getElementById('noteOverlay').classList.remove('hidden');
  document.getElementById('voiceFab').classList.add('hidden');
  setTimeout(() => document.getElementById('noteTextarea').focus(), 300);
}

function closeNoteModal() {
  document.getElementById('noteOverlay').classList.add('hidden');
  const fab = document.getElementById('voiceFab');
  if (fab.dataset.voiceEnabled) fab.classList.remove('hidden');
}

// ============================================================
// PRANZO FERIALE
// ============================================================
function isWeekday(dateStr) {
  const dow = fromDateStr(dateStr).getDay();
  return dow >= 1 && dow <= 5; // lun-ven
}

function getLunchOverride(dateStr) {
  return localStorage.getItem('lunchOpen_' + dateStr) === '1';
}

function setLunchOverride(dateStr, val) {
  if (val) localStorage.setItem('lunchOpen_' + dateStr, '1');
  else localStorage.removeItem('lunchOpen_' + dateStr);
}

function isLunchClosed(dateStr) {
  return isWeekday(dateStr) && !getLunchOverride(dateStr);
}

function isSunday(dateStr) {
  return fromDateStr(dateStr).getDay() === 0;
}

function getDinnerOverride(dateStr) {
  return localStorage.getItem('dinnerOpen_' + dateStr) === '1';
}

function setDinnerOverride(dateStr, val) {
  if (val) localStorage.setItem('dinnerOpen_' + dateStr, '1');
  else localStorage.removeItem('dinnerOpen_' + dateStr);
}

function isDinnerClosed(dateStr) {
  return isSunday(dateStr) && !getDinnerOverride(dateStr);
}

function renderHome() {
  const date  = s.viewDate;
  const today = todayStr();

  document.getElementById('dayLabel').textContent   = fmtDayLabel(date);
  document.getElementById('dayDateSub').textContent = fmtDateLong(date);
  document.getElementById('btnGoToday')?.classList.toggle('hidden', date !== today);

  renderList('lunch');
  renderList('dinner');
  renderNotePreview();
}

function renderList(service) {
  const date  = s.viewDate;
  const items = forDate(date, service);
  const list  = document.getElementById(service === 'lunch' ? 'lunchList' : 'dinnerList');
  const chip  = document.getElementById(service === 'lunch' ? 'lunchChip' : 'dinnerChip');

  // Cena chiusa la domenica
  if (service === 'dinner') {
    const section       = document.querySelector('.service-section.dinner-section');
    const toggleBtn     = document.getElementById('dinnerToggleBtn');
    const deactivateBtn = document.getElementById('dinnerDeactivateBtn');
    const chipEl        = document.getElementById('dinnerChip');
    const addBtn        = document.querySelector('.add-res-btn.add-dinner');
    const closed        = isDinnerClosed(date);
    const sunday        = isSunday(date);

    toggleBtn.classList.toggle('hidden', !closed);
    deactivateBtn.classList.toggle('hidden', !sunday || closed);
    chipEl.classList.toggle('hidden', closed);
    list.classList.toggle('hidden', closed);
    addBtn.classList.toggle('hidden', closed);
    section.classList.toggle('lunch-closed', closed);
    if (closed) return;
  }

  // Pranzo chiuso nei giorni feriali
  if (service === 'lunch') {
    const section    = document.querySelector('.service-section:first-child');
    const toggleBtn  = document.getElementById('lunchToggleBtn');
    const chipEl     = document.getElementById('lunchChip');
    const addBtn     = document.querySelector('.add-res-btn.add-lunch');
    const closed     = isLunchClosed(date);

    const deactivateBtn = document.getElementById('lunchDeactivateBtn');
    const weekday = isWeekday(date);

    toggleBtn.classList.toggle('hidden', !closed);
    deactivateBtn.classList.toggle('hidden', !weekday || closed);
    chipEl.classList.toggle('hidden', closed);
    list.classList.toggle('hidden', closed);
    addBtn.classList.toggle('hidden', closed);
    section.classList.toggle('lunch-closed', closed);
  }

  list.innerHTML = '';

  if (items.length === 0) {
    const el = document.createElement('div');
    el.className = 'empty-state';
    el.textContent = service === 'lunch'
      ? 'Nessuna prenotazione a pranzo'
      : 'Nessuna prenotazione a cena';
    list.appendChild(el);
    chip.innerHTML = '<span class="chip-item"><svg style="display:inline;vertical-align:middle;margin-right:3px" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg><b class="chip-num">0</b></span>';
    return;
  }

  const totalAdults   = items.reduce((n, r) => n + (r.adults   ?? r.people ?? 0), 0);
  const totalChildren = items.reduce((n, r) => n + (r.children ?? 0), 0);
  const childPart = totalChildren > 0 ? ` + <b class="chip-num">${totalChildren}</b>` : '';
  const personIcon = `<svg style="display:inline;vertical-align:middle;margin-right:3px" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
  chip.innerHTML = `<span class="chip-item">${personIcon}<b class="chip-num">${totalAdults}</b>${childPart}</span><span class="chip-item"><b class="chip-num">${items.length}</b> ${items.length === 1 ? 'tavolo' : 'tavoli'}</span>`;

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
    ? `${adults}<span class="badge-sep">+</span>${children}`
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
  addSwipeToDelete(card, r.id);
  return card;
}

function addSwipeToDelete(card, id) {
  let startX = 0, startY = 0, dx = 0;
  let swiping = false;

  card.addEventListener('touchstart', e => {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    dx = 0;
    swiping = false;
  }, { passive: true });

  card.addEventListener('touchmove', e => {
    dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (!swiping && Math.abs(dy) > Math.abs(dx)) return; // vertical scroll
    swiping = true;
    if (dx < 0) {
      card.style.transform = `translateX(${Math.max(dx, -100)}px)`;
      card.style.transition = 'none';
    }
  }, { passive: true });

  card.addEventListener('touchend', async () => {
    card.style.transition = 'transform .3s ease';
    if (dx < -60) {
      card.style.transform = 'translateX(-100%)';
      card.style.opacity = '0';
      const ok = await confirmDelete();
      if (ok) {
        await removeReservation(id);
      } else {
        card.style.transform = '';
        card.style.opacity = '';
      }
    } else {
      card.style.transform = '';
    }
  });
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

    const dayRes     = forDate(cellDate, null);
    const lunchRes   = dayRes.filter(r => r.service === 'lunch');
    const dinnerRes  = dayRes.filter(r => r.service === 'dinner');
    const hasLunch   = lunchRes.length > 0;
    const hasDinner  = dinnerRes.length > 0;
    const lunchPax   = totalPeople(lunchRes);
    const dinnerPax  = totalPeople(dinnerRes);

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
        ${hasLunch  ? `<span class="cal-pax lunch-pax">${lunchPax}</span>`  : ''}
        ${hasDinner ? `<span class="cal-pax dinner-pax">${dinnerPax}</span>` : ''}
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
  } else if (name === 'rendimento') {
    document.getElementById('viewRendimento').classList.add('active');
    document.querySelector('[data-view="rendimento"]').classList.add('active');
    renderRendimento();
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
  document.getElementById('stepAdults').value  = '2';
  document.getElementById('stepChildren').value = '0';
  document.getElementById('btnDeleteRes').classList.add('hidden');
  setSvc(service);
  updateDateDay();
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
  document.getElementById('stepAdults').value   = s.adults;
  document.getElementById('stepChildren').value = s.children;
  document.getElementById('btnDeleteRes').classList.remove('hidden');
  setSvc(r.service);
  updateDateDay();
  showModal();
}

function updateDateDay() {
  const val = document.getElementById('formDate').value;
  const el  = document.getElementById('formDateDisplay');
  if (!val) { el.textContent = 'Seleziona data'; el.classList.add('placeholder'); return; }
  const d = fromDateStr(val);
  el.textContent = `${DAYS_SHORT[d.getDay()]} · ${d.getDate()} ${MONTHS_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  el.classList.remove('placeholder');
}

function setSvc(val) {
  s.service = val;
  document.querySelectorAll('.svc-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.value === val)
  );
}

function showModal() {
  document.getElementById('modalOverlay').classList.remove('hidden');
  document.getElementById('voiceFab').classList.add('hidden');
  setTimeout(() => document.getElementById('formName').focus(), 300);
}

function hideModal() {
  document.getElementById('modalOverlay').classList.add('hidden');
  const fab = document.getElementById('voiceFab');
  if (fab.dataset.voiceEnabled) fab.classList.remove('hidden');
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

  s.adults   = Math.min(99, Math.max(0, parseInt(document.getElementById('stepAdults').value)   || 0));
  s.children = Math.min(99, Math.max(0, parseInt(document.getElementById('stepChildren').value) || 0));

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
// VOICE RESERVATION
// ============================================================
const MONTHS_MAP = {
  gennaio:1, febbraio:2, marzo:3, aprile:4, maggio:5, giugno:6,
  luglio:7, agosto:8, settembre:9, ottobre:10, novembre:11, dicembre:12
};

// Converte testo numerico italiano → numero
const NUM_WORDS = {
  uno:1, due:2, tre:3, quattro:4, cinque:5, sei:6, sette:7, otto:8,
  nove:9, dieci:10, undici:11, dodici:12, tredici:13, quattordici:14,
  quindici:15, sedici:16, diciassette:17, diciotto:18, diciannove:19,
  venti:20, trenta:30, quaranta:40, cinquanta:50
};
function wordToNum(s) {
  const n = parseInt(s);
  if (!isNaN(n)) return n;
  return NUM_WORDS[s.toLowerCase()] ?? null;
}

function parseVoiceText(raw) {
  const t = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  const result = {};

  // --- DATA ---
  const monthNames = Object.keys(MONTHS_MAP).join('|');
  const dateRx = new RegExp(`(\\d{1,2})\\s+(${monthNames})(?:\\s+(\\d{4}))?`);
  const dm = t.match(dateRx);
  if (dm) {
    const day = parseInt(dm[1]), month = MONTHS_MAP[dm[2]];
    const year = dm[3] ? parseInt(dm[3]) : new Date().getFullYear();
    const candidate = new Date(year, month - 1, day);
    const today = new Date(); today.setHours(0,0,0,0);
    if (candidate < today && !dm[3]) candidate.setFullYear(year + 1);
    result.date = toDateStr(candidate);
  }
  if (!result.date && /\boggi\b/.test(t))   result.date = todayStr();
  if (!result.date && /\bdomani\b/.test(t)) result.date = shiftDate(todayStr(), 1);

  // Prossimo giorno della settimana
  if (!result.date) {
    const dayNames = ['domenica','lunedì','martedì','mercoledì','giovedì','venerdì','sabato'];
    for (let i = 0; i < dayNames.length; i++) {
      if (t.includes(dayNames[i])) {
        const today = new Date(); today.setHours(0,0,0,0);
        const todayDow = today.getDay();
        let diff = i - todayDow;
        if (diff <= 0) diff += 7; // sempre il PROSSIMO
        const target = new Date(today);
        target.setDate(today.getDate() + diff);
        result.date = toDateStr(target);
        break;
      }
    }
  }

  // --- SERVIZIO ---
  if (/\bcena\b/.test(t)) result.service = 'dinner';
  else if (/\bpranzo\b/.test(t)) result.service = 'lunch';

  // --- SPLIT per keyword: estrai segmenti ---
  // Normalizza sinonimi
  const norm = t
    .replace(/\bnot[ae]\b/g, 'NOTA')
    .replace(/\bnome\b/g, 'NOME')
    .replace(/\badult[oi]\b/g, 'ADULTI')
    .replace(/\bbambin[io]\b|bimb[io]\b/g, 'BAMBINI')
    .replace(/\bperson[ae]\b/g, 'ADULTI');

  // NOME: testo dopo "NOME" fino alla prossima keyword o fine
  const nomeMatch = norm.match(/NOME\s+(.+?)(?=\s*(?:ADULTI|BAMBINI|NOTA|$))/);
  if (nomeMatch) {
    const raw = nomeMatch[1].replace(/^\d+\s*/, '').replace(/\s*\d+$/, '').trim();
    if (raw) result.name = raw.replace(/\b\w/g, c => c.toUpperCase());
  }

  // NOME FALLBACK: se non trovato con keyword, cerca testo tra servizio/data e i numeri/note
  if (!result.name) {
    // Rimuovi dal testo normalizzato tutto ciò che è già noto
    const stripWords = (str, words) =>
      words.reduce((s, w) => s.replace(new RegExp(`(^|\\s)${w}(\\s|$)`, 'gi'), ' '), str);

    let leftover = norm;
    leftover = stripWords(leftover, [
      'prenotazione','oggi','domani',
      'luned[iì]','marted[iì]','mercoled[iì]','gioved[iì]','venerd[iì]','sabato','domenica',
      ...Object.keys(MONTHS_MAP),
      'pranzo','cena','a pranzo','a cena'
    ])
      .replace(/\d+\s+ADULTI/g, '')
      .replace(/\d+\s+BAMBINI/g, '')
      .replace(/(\w+)\s+ADULTI/g, '')
      .replace(/(\w+)\s+BAMBINI/g, '')
      .replace(/NOTA\s+.+/, '')
      .replace(/ADULTI|BAMBINI|NOTA|NOME/g, '')
      .replace(/\b\d+\b/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (leftover.length > 1) {
      result.name = leftover.replace(/\b\w/g, c => c.toUpperCase()).trim();
    }
  }

  // ADULTI: numero prima di "ADULTI"
  const adultiMatch = norm.match(/(\d+|\w+)\s+ADULTI/);
  if (adultiMatch) result.adults = wordToNum(adultiMatch[1]);

  // BAMBINI: numero prima di "BAMBINI"
  const bambiniMatch = norm.match(/(\d+|\w+)\s+BAMBINI/);
  if (bambiniMatch) result.children = wordToNum(bambiniMatch[1]);

  // NOTA: testo dopo "NOTA" fino a fine
  const notaMatch = norm.match(/NOTA\s+(.+)/);
  if (notaMatch) {
    const n = notaMatch[1].trim();
    result.notes = n.charAt(0).toUpperCase() + n.slice(1);
  }

  return result;
}

function applyVoiceResult(parsed) {
  if (parsed.date) s.viewDate = parsed.date;

  s.editingId = null;
  s.service   = parsed.service || 'lunch';
  s.adults    = parsed.adults  ?? 2;
  s.children  = parsed.children ?? 0;

  document.getElementById('sheetTitle').textContent   = 'Nuova prenotazione';
  document.getElementById('formId').value             = '';
  document.getElementById('formDate').value           = parsed.date || s.viewDate;
  document.getElementById('formName').value           = parsed.name || '';
  document.getElementById('formNotes').value          = parsed.notes || '';
  document.getElementById('stepAdults').value   = s.adults;
  document.getElementById('stepChildren').value = s.children;
  document.getElementById('btnDeleteRes').classList.add('hidden');
  setSvc(s.service);
  updateDateDay();
  showModal();
}

function initVoice() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const fab       = document.getElementById('voiceFab');
  const toast     = document.getElementById('voiceToast');
  const toastText = document.getElementById('voiceToastText');

  if (!SpeechRecognition) return; // resta hidden

  fab.classList.remove('hidden');
  fab.dataset.voiceEnabled = '1';

  const recognition = new SpeechRecognition();
  recognition.lang = 'it-IT';
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;
  let gotResult = false;

  function resetUI() {
    listening = false;
    gotResult = false;
    fab.classList.remove('recording');
  }

  function hideToast() { toast.classList.add('hidden'); }

  fab.addEventListener('click', () => {
    if (listening) { recognition.stop(); return; }
    gotResult = false;
    try { recognition.start(); } catch(e) { console.warn('SpeechRecognition start:', e); }
  });

  recognition.onstart = () => {
    listening = true;
    fab.classList.add('recording');
    toast.classList.remove('hidden');
    toastText.textContent = 'In ascolto… parla ora';
  };

  recognition.onresult = (e) => {
    gotResult = true;
    const transcript = Array.from(e.results)
      .map(r => r[0].transcript).join(' ');
    toastText.textContent = `"${transcript}"`;
    setTimeout(() => {
      hideToast();
      applyVoiceResult(parseVoiceText(transcript));
    }, 1400);
  };

  recognition.onerror = (e) => {
    resetUI();
    toastText.textContent = e.error === 'not-allowed'
      ? 'Abilita il microfono nelle impostazioni'
      : e.error === 'no-speech'
      ? 'Nessuna voce rilevata'
      : 'Errore: ' + e.error;
    toast.classList.remove('hidden');
    setTimeout(hideToast, 3000);
  };

  recognition.onend = () => {
    resetUI();
    if (!gotResult) setTimeout(hideToast, 300);
  };
}

// ============================================================
// INIT
// ============================================================
// ============================================================
// RENDIMENTO
// ============================================================
let rendPeriod = 'week';
let chartTrend = null, chartDonut = null, chartWeekday = null;

const CHART_GREEN  = '#1A7A32';
const CHART_BLUE   = '#0055CC';
const CHART_GREEN2 = 'rgba(26,122,50,0.15)';
const CHART_BLUE2  = 'rgba(0,85,204,0.15)';

function rendPeriodDates() {
  const today = new Date();
  let start, end, days;

  if (rendPeriod === 'week') {
    // Settimana corrente: lunedì → domenica
    const dow = today.getDay() === 0 ? 6 : today.getDay() - 1; // lun=0
    start = new Date(today); start.setDate(today.getDate() - dow);
    end   = new Date(start); end.setDate(start.getDate() + 6);
    days  = 7;
  } else if (rendPeriod === 'month') {
    // Mese corrente: 1° → ultimo giorno
    start = new Date(today.getFullYear(), today.getMonth(), 1);
    end   = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    days  = end.getDate();
  } else {
    // Trimestre corrente: Q1/Q2/Q3/Q4
    const q = Math.floor(today.getMonth() / 3);
    start = new Date(today.getFullYear(), q * 3, 1);
    end   = new Date(today.getFullYear(), q * 3 + 3, 0);
    days  = Math.round((end - start) / 86400000) + 1;
  }

  return { start: toDateStr(start), end: toDateStr(end), days };
}

function rendFilterRes() {
  const { start, end } = rendPeriodDates();
  return reservations.filter(r => r.date >= start && r.date <= end);
}

function renderRendimento() {
  const res = rendFilterRes();
  const { start, end, days } = rendPeriodDates();

  // --- KPI ---
  const totalCovers = res.reduce((n, r) => n + (r.adults || 0) + (r.children || 0), 0);
  const avgPerDay   = days > 0 ? (totalCovers / days).toFixed(1) : '—';
  const avgParty    = res.length ? (totalCovers / res.length).toFixed(1) : '—';

  document.getElementById('kpiTotalCovers').textContent = totalCovers;
  document.getElementById('kpiAvgPerDay').textContent   = avgPerDay;
  document.getElementById('kpiTotalRes').textContent    = res.length;
  document.getElementById('kpiAvgParty').textContent    = avgParty;

  // --- Trend: coperti per giorno (settimana/mese) o per settimana (trimestre) ---
  const dateLabels = [];
  const lunchData  = [];
  const dinnerData = [];

  const startD = fromDateStr(start);
  const endD   = fromDateStr(end);

  if (rendPeriod === 'week') {
    // 7 barre: un giorno per barra
    for (let d = new Date(startD); d <= endD; d.setDate(d.getDate() + 1)) {
      const ds  = toDateStr(d);
      const lbl = ['Dom','Lun','Mar','Mer','Gio','Ven','Sab'][d.getDay()] + ' ' + d.getDate();
      dateLabels.push(lbl);
      const dayRes = res.filter(r => r.date === ds);
      lunchData.push( dayRes.filter(r => r.service === 'lunch').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
      dinnerData.push( dayRes.filter(r => r.service === 'dinner').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
    }
  } else if (rendPeriod === 'month') {
    // ~4-5 barre: raggruppate per settimana del mese
    let cursor = new Date(startD);
    let weekNum = 1;
    while (cursor <= endD) {
      const ws = toDateStr(cursor);
      const we_d = new Date(cursor); we_d.setDate(cursor.getDate() + 6);
      const we = toDateStr(we_d > endD ? endD : we_d);
      dateLabels.push('Sett. ' + weekNum++);
      const weekRes = res.filter(r => r.date >= ws && r.date <= we);
      lunchData.push( weekRes.filter(r => r.service === 'lunch').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
      dinnerData.push( weekRes.filter(r => r.service === 'dinner').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
      cursor.setDate(cursor.getDate() + 7);
    }
  } else {
    // 3 barre: un mese per barra
    const MONTHS_SHORT = ['Gen','Feb','Mar','Apr','Mag','Giu','Lug','Ago','Set','Ott','Nov','Dic'];
    const q = Math.floor(startD.getMonth() / 3);
    for (let m = q * 3; m < q * 3 + 3; m++) {
      const ms = toDateStr(new Date(startD.getFullYear(), m, 1));
      const me = toDateStr(new Date(startD.getFullYear(), m + 1, 0));
      dateLabels.push(MONTHS_SHORT[m]);
      const mRes = res.filter(r => r.date >= ms && r.date <= me);
      lunchData.push( mRes.filter(r => r.service === 'lunch').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
      dinnerData.push( mRes.filter(r => r.service === 'dinner').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0) );
    }
  }

  if (chartTrend) chartTrend.destroy();
  chartTrend = new Chart(document.getElementById('chartTrend'), {
    type: 'bar',
    data: {
      labels: dateLabels,
      datasets: [
        { label: 'Pranzo', data: lunchData,  backgroundColor: CHART_GREEN, borderRadius: 4, borderSkipped: false },
        { label: 'Cena',   data: dinnerData, backgroundColor: CHART_BLUE,  borderRadius: 4, borderSkipped: false },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } }, tooltip: { mode: 'index' } },
      scales: {
        x: { stacked: true, grid: { display: false }, ticks: { font: { size: 11 }, maxRotation: 0 } },
        y: { stacked: true, beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 }, precision: 0 } }
      }
    }
  });

  // --- Donut: pranzo vs cena ---
  const lunchCovers  = res.filter(r => r.service === 'lunch').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0);
  const dinnerCovers = res.filter(r => r.service === 'dinner').reduce((n,r) => n+(r.adults||0)+(r.children||0), 0);

  if (chartDonut) chartDonut.destroy();
  chartDonut = new Chart(document.getElementById('chartDonut'), {
    type: 'doughnut',
    data: {
      labels: ['Pranzo', 'Cena'],
      datasets: [{ data: [lunchCovers, dinnerCovers], backgroundColor: [CHART_GREEN, CHART_BLUE], borderWidth: 0, hoverOffset: 6 }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, font: { size: 12 } } } }
    }
  });

  // --- Per giorno della settimana ---
  const DAYS_SHORT = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];
  const weekdayTotals = [0,0,0,0,0,0,0];
  const weekdayCounts = [0,0,0,0,0,0,0];
  res.forEach(r => {
    const dow = fromDateStr(r.date).getDay(); // 0=dom
    const idx = dow === 0 ? 6 : dow - 1;     // lun=0 ... dom=6
    weekdayTotals[idx] += (r.adults||0) + (r.children||0);
    weekdayCounts[idx]++;
  });
  const weekdayAvg = weekdayTotals.map((t, i) => weekdayCounts[i] ? Math.round(t / weekdayCounts[i] * 10) / 10 : 0);

  if (chartWeekday) chartWeekday.destroy();
  chartWeekday = new Chart(document.getElementById('chartWeekday'), {
    type: 'bar',
    data: {
      labels: DAYS_SHORT,
      datasets: [{ label: 'Media cop.', data: weekdayAvg, backgroundColor: weekdayAvg.map(v => v === Math.max(...weekdayAvg) ? CHART_BLUE : CHART_BLUE2), borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { beginAtZero: true, grid: { color: 'rgba(0,0,0,0.06)' }, ticks: { font: { size: 11 }, precision: 0 } }
      }
    }
  });

  // --- Distribuzione pranzo/cena per giorno della settimana (barre orizzontali) ---
  const wrap = document.getElementById('rendBestWrap');
  const maxVal = Math.max(...weekdayTotals, 1);
  wrap.innerHTML = DAYS_SHORT.map((d, i) => `
    <div class="rend-best-row">
      <span class="rend-best-label">${d}</span>
      <div class="rend-best-bar-wrap">
        <div class="rend-best-bar" style="width:${(weekdayTotals[i]/maxVal*100).toFixed(1)}%;background:${i === 5 || i === 6 ? CHART_BLUE : CHART_GREEN}"></div>
      </div>
      <span class="rend-best-val">${weekdayTotals[i]}</span>
    </div>
  `).join('');
}

function initRendimento() {
  document.querySelectorAll('.rend-periodo-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.rend-periodo-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      rendPeriod = btn.dataset.period;
      renderRendimento();
    });
  });
}

async function init() {
  initTheme();

  // Render immediato del giorno prima del fetch (header sempre aggiornato)
  renderHome();

  // Loading state nelle liste mentre aspettiamo i dati
  document.getElementById('lunchList').innerHTML = '<div class="empty-state">Caricamento…</div>';
  document.getElementById('dinnerList').innerHTML = '<div class="empty-state">Caricamento…</div>';

  await loadData();
  await loadNotes();

  // Navigation
  document.getElementById('btnPrevDay').addEventListener('click', () => {
    s.viewDate = shiftDate(s.viewDate, -1);
    renderHome();
  });
  document.getElementById('btnNextDay').addEventListener('click', () => {
    s.viewDate = shiftDate(s.viewDate, 1);
    renderHome();
  });
  document.getElementById('btnGoToday')?.addEventListener('click', () => {
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

  const syncAdults   = () => { s.adults   = Math.min(99, Math.max(0, parseInt(document.getElementById('stepAdults').value)   || 0)); document.getElementById('stepAdults').value   = s.adults; };
  const syncChildren = () => { s.children = Math.min(99, Math.max(0, parseInt(document.getElementById('stepChildren').value) || 0)); document.getElementById('stepChildren').value = s.children; };

  document.getElementById('btnDecAdults').addEventListener('click', () => { syncAdults(); if (s.adults > 0) { s.adults--; document.getElementById('stepAdults').value = s.adults; } });
  document.getElementById('btnIncAdults').addEventListener('click', () => { syncAdults(); if (s.adults < 99) { s.adults++; document.getElementById('stepAdults').value = s.adults; } });
  document.getElementById('btnDecChildren').addEventListener('click', () => { syncChildren(); if (s.children > 0) { s.children--; document.getElementById('stepChildren').value = s.children; } });
  document.getElementById('btnIncChildren').addEventListener('click', () => { syncChildren(); if (s.children < 99) { s.children++; document.getElementById('stepChildren').value = s.children; } });
  document.getElementById('stepAdults').addEventListener('change', syncAdults);
  document.getElementById('stepChildren').addEventListener('change', syncChildren);

  document.getElementById('noteSectionBox').addEventListener('click', openNoteModal);
  document.getElementById('btnCloseNote').addEventListener('click', closeNoteModal);
  document.getElementById('noteOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('noteOverlay')) closeNoteModal();
  });
  document.getElementById('btnSaveNote').addEventListener('click', async () => {
    const testo = document.getElementById('noteTextarea').value;
    await saveNote(s.viewDate, testo);
    renderNotePreview();
    closeNoteModal();
  });

  document.getElementById('lunchToggleBtn').addEventListener('click', () => {
    setLunchOverride(s.viewDate, true);
    renderHome();
  });

  document.getElementById('lunchDeactivateBtn').addEventListener('click', () => {
    setLunchOverride(s.viewDate, false);
    renderHome();
  });

  document.getElementById('dinnerToggleBtn').addEventListener('click', () => {
    setDinnerOverride(s.viewDate, true);
    renderHome();
  });

  document.getElementById('dinnerDeactivateBtn').addEventListener('click', () => {
    setDinnerOverride(s.viewDate, false);
    renderHome();
  });

  document.getElementById('formDate').addEventListener('change', updateDateDay);
  document.getElementById('reservationForm').addEventListener('submit', handleSubmit);
  document.getElementById('btnCloseModal').addEventListener('click', hideModal);
  document.getElementById('btnDeleteRes').addEventListener('click', handleDelete);
  document.getElementById('modalOverlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modalOverlay')) hideModal();
  });

  initSwipe();
  initVoice();
  initRendimento();
  initAutoRefresh();
  switchView('home');
}

function rerender() {
  const activeView = document.querySelector('.view.active');
  if (activeView?.id === 'viewHome') renderHome();
  else renderCalendar();
}

function initAutoRefresh() {
  // Realtime: aggiornamento istantaneo per tutti gli utenti
  db.channel('prenotazioni-realtime')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'prenotazioni'
    }, (payload) => {
      const { eventType, new: row, old } = payload;
      if (eventType === 'INSERT') {
        if (!reservations.some(r => r.id === row.id)) {
          reservations.push(row);
          reservations.sort((a, b) =>
            a.date !== b.date
              ? a.date.localeCompare(b.date)
              : new Date(a.created_at) - new Date(b.created_at)
          );
        }
      } else if (eventType === 'UPDATE') {
        const idx = reservations.findIndex(r => r.id === row.id);
        if (idx !== -1) reservations[idx] = row;
      } else if (eventType === 'DELETE') {
        reservations = reservations.filter(r => r.id !== old.id);
      }
      rerender();
    })
    .subscribe();

  // Fallback: ricarica dati completi quando si torna sull'app
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await loadData();
      rerender();
    }
  });
}

document.addEventListener('DOMContentLoaded', init);
