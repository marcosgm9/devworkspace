/* ==========================================================
   CONFIGURACIÓN DE FIREBASE (Google Auth & Firestore)
   ========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyAAtZX3Q-64Iu_P20B8Nwd3s_Sdl589lFI",
    authDomain: "devworkspace-9be99.firebaseapp.com",
    projectId: "devworkspace-9be99",
    storageBucket: "devworkspace-9be99.firebasestorage.app",
    messagingSenderId: "308043648982",
    appId: "1:308043648982:web:eac9eccc00f3a1ead89e77",
    measurementId: "G-KEV0S83H0M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let currentUser = null;

window.loginWithGoogle = async function() {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Error en el login con Google:", error);
        alert("No se pudo iniciar sesión con Google. Revisa la consola.");
    }
};

window.logoutUser = async function() {
    try {
        await signOut(auth);
        location.reload();
    } catch (error) {
        console.error("Error al cerrar sesión:", error);
    }
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('user-profile-widget').style.display = 'flex';
        document.getElementById('user-name').textContent = user.displayName || user.email;
        if (user.photoURL) document.getElementById('user-avatar').src = user.photoURL;

        await loadCloudData();
    } else {
        currentUser = null;
        document.getElementById('auth-modal').style.display = 'flex';
        document.getElementById('user-profile-widget').style.display = 'none';
    }
});

/* ==========================================================
   UTILIDADES Y DEEP MERGE
   ========================================================== */
function debounce(func, wait) {
    let timeout;
    return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"'`]/g, c => ESC_MAP[c]); }
function safeUrl(u) {
    try { const x = new URL(String(u).trim()); return ['http:', 'https:'].includes(x.protocol) ? x.href : '#'; }
    catch (e) { return '#'; }
}
const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
function deepMerge(def, src) {
    if (Array.isArray(def)) return Array.isArray(src) ? src : structuredClone(def);
    if (isObj(def)) {
        const s = isObj(src) ? src : {};
        const out = {};
        for (const k of new Set([...Object.keys(def), ...Object.keys(s)])) {
            if (k === '__proto__' || k === 'constructor' || k === 'prototype') continue;
            out[k] = !(k in def) ? s[k] : !(k in s) ? structuredClone(def[k]) : deepMerge(def[k], s[k]);
        }
        return out;
    }
    return (src === undefined || src === null || typeof src !== typeof def) ? def : src;
}

const defaultCategories = [
    { key: 'all', label: '🚀 Todo' },
    { key: 'study', label: '🎓 Academia & Estudio' },
    { key: 'dev', label: '💻 Dev & SysAdmin Lab' },
    { key: 'focus', label: '⚡ Foco & Productividad' }
];

const defaultData = {
    bookmarks: [
        { id: 1, name: "GitHub", url: "https://github.com" },
        { id: 2, name: "MDN Web Docs", url: "https://developer.mozilla.org" },
        { id: 3, name: "DevDocs API", url: "https://devdocs.io" }
    ],
    tasks: [],
    servers: [{ id: 1, name: "Debian Lab DAM", ip: "192.168.1.150", creds: "student / pass" }],
    schedule: [],
    stickyNote: "",
    notes: { general: "", comandos: "", clases: "" },
    grades: [
        { id: 1, subject: "Programación (Java)", target: 5.0, finalWeight: 40, items: [
            { id: 101, name: "Práctica 1 (POO)", grade: 8.5, weight: 25 },
            { id: 102, name: "Examen Parcial 1", grade: 6.0, weight: 35 } ] },
        { id: 2, subject: "Bases de Datos (SQL)", target: 5.0, finalWeight: 50, items: [
            { id: 201, name: "Consultas & Normalización", grade: 7.2, weight: 50 } ] }
    ],
    deliveries: [
        { id: 1, title: "Práctica 2: Consultas Multitabla", subject: "Bases de Datos", type: "Práctica", dueDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16), done: false },
        { id: 2, title: "Examen Parcial Tema 3-5", subject: "Programación", type: "Examen", dueDate: new Date(Date.now() + 86400000 * 5).toISOString().slice(0, 16), done: false }
    ],
    snippets: [],
    studyKanban: [
        { id: 1, title: "Herencia y Polimorfismo en Java", subject: "PROG", col: "doing", pomos: 4, donePomos: 2, priority: "high" },
        { id: 2, title: "Diagramas E/R y Normalización 3FN", subject: "BBDD", col: "todo", pomos: 3, donePomos: 0, priority: "high" },
        { id: 3, title: "Configuración Servidor DHCP en Linux", subject: "SIST", col: "done", pomos: 2, donePomos: 2, priority: "medium" }
    ],
    studyStats: { todayFocusMinutes: 0, totalFocusMinutes: 0, lastDate: new Date().toISOString().slice(0, 10), streakDays: 0, history: [] },
    customCategories: [],
    customCards: [],
    cardCategories: {},
    settings: {
        timezone: 'Europe/Madrid', theme: 'cyberpunk', manualSkewOffsetMs: 0,
        customTheme: { name: 'Mi Tema', bg: '#05080f', card: '#0d131f', border: '#1e293b', text: '#f8fafc', cyan: '#38bdf8', violet: '#a855f7' },
        scheduleViewMode: 'widget', activeDashboardView: 'all',
        collapsedCards: [], hiddenCards: [], editMode: false,
        layout: {
            colLeft: ['card-kanban', 'card-grades', 'card-deliveries', 'card-tasks', 'card-notes', 'card-sticky'],
            colRight: ['card-study-stats', 'card-pomodoro', 'card-audio', 'card-snippets', 'card-schedule', 'card-bookmarks', 'card-servers']
        }
    }
};

let appData = structuredClone(defaultData);

async function loadCloudData() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appData = deepMerge(defaultData, docSnap.data());
        } else {
            await setDoc(docRef, defaultData);
        }
        appData.snippets = (appData.snippets || []).filter(s => s.isCustom);
        renderAll();
        applyLayoutState();
    } catch (e) {
        console.error("Error al cargar datos de Firestore:", e);
    }
}

const saveData = debounce(async function() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        await setDoc(docRef, appData);
    } catch (e) {
        console.error("Error al guardar en Firestore:", e);
    }
}, 500);

window.toggleForm = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

/* ==========================================================
   CONTROL DEL RELOJ
   ========================================================== */
let networkOffsetMs = 0;
let manualOverrideMs = 0;
let isManualMode = false;

async function syncRealTimeNetwork() {
    const el = document.getElementById('net-status');
    if (isManualMode) { if (el) el.textContent = '✏️ Hora Manual Activa'; return; }
    if (el) el.textContent = '🔄 Sincronizando...';
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid', { cache: 'no-store' });
        const data = await res.json();
        const serverTimeMs = new Date(data.datetime).getTime();
        networkOffsetMs = serverTimeMs - Date.now();
        if (el) { el.textContent = '🌐 Hora Real (API Madrid)'; el.style.color = 'var(--accent-green)'; }
    } catch (e) {
        if (el) { el.textContent = '⚠️ Sin Red'; el.style.color = 'var(--accent-red)'; }
    }
    updateClockDisplay();
}

window.applyManualSkewOffset = function(val) {
    if (val === 'custom') {
        const inputTime = prompt("Introduce la hora real exacta en formato HH:MM (Madrid):");
        if (inputTime) {
            const [h, m] = inputTime.split(':');
            const targetDate = new Date();
            targetDate.setHours(parseInt(h, 10) || 0);
            targetDate.setMinutes(parseInt(m, 10) || 0);
            isManualMode = true;
            manualOverrideMs = targetDate.getTime() - (Date.now() + networkOffsetMs);
        }
    } else {
        manualOverrideMs = parseInt(val, 10) || 0;
        isManualMode = manualOverrideMs !== 0;
    }
    updateClockDisplay();
};

function getClockDate() {
    return new Date(Date.now() + networkOffsetMs + manualOverrideMs);
}

function updateClockDisplay() {
    const d = getClockDate();
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (timeEl) timeEl.textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    updateScheduleWidget(d);
}
setInterval(updateClockDisplay, 1000);

/* ==========================================================
   RENDERIZADO Y GESTIÓN DE MÓDULOS
   ========================================================== */
function getAllCategories() { return [...defaultCategories, ...(appData.customCategories || [])]; }

function renderCategoryPills() {
    const container = document.getElementById('view-pills-container');
    if (!container) return;
    container.innerHTML = getAllCategories().map(cat => `
        <button class="view-pill ${appData.settings.activeDashboardView === cat.key ? 'active' : ''}" data-view="${escapeHtml(cat.key)}" onclick="setDashboardView(this.dataset.view)">${escapeHtml(cat.label)}</button>`).join('');
    populateCategorySelectors();
}

function populateCategorySelectors() {
    const cats = getAllCategories().filter(c => c.key !== 'all');
    const opts = cur => cats.map(c => `<option value="${escapeHtml(c.key)}" ${c.key === cur ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('');
    const createSelect = document.getElementById('new-card-category');
    if (createSelect) createSelect.innerHTML = opts();
    document.querySelectorAll('.card').forEach(card => {
        const select = card.querySelector('.card-category-select');
        if (select) select.innerHTML = opts(appData.cardCategories[card.id] || card.getAttribute('data-category') || 'dev');
    });
}

window.addCustomCategoryPrompt = function() {
    const name = prompt("Nombre de la nueva sección / categoría:");
    if (!name || !name.trim()) return;
    const icon = prompt("Icono/Emoji:", "📁") || "📁";
    const key = 'custom_cat_' + Date.now();
    appData.customCategories.push({ key, label: `${icon} ${name.trim()}` });
    saveData();
    renderCategoryPills();
    setDashboardView(key);
};

window.updateCardCategory = function(cardId, newCatKey) {
    appData.cardCategories[cardId] = newCatKey;
    saveData();
    setDashboardView(appData.settings.activeDashboardView);
};

window.setDashboardView = function(viewKey) {
    appData.settings.activeDashboardView = viewKey;
    document.querySelectorAll('#view-pills-container .view-pill').forEach(b => b.classList.toggle('active', b.dataset.view === viewKey));
    const hiddenSet = new Set(appData.settings.hiddenCards || []);
    document.querySelectorAll('.card').forEach(card => {
        const cat = appData.cardCategories[card.id] || card.getAttribute('data-category');
        if (hiddenSet.has(card.id)) { card.classList.add('hidden-card'); return; }
        card.classList.remove('hidden-card');
        card.style.display = (viewKey === 'all' || cat === viewKey) ? 'flex' : 'none';
    });
    saveData();
};

window.toggleEditMode = function() {
    appData.settings.editMode = !appData.settings.editMode;
    document.body.classList.toggle('edit-mode-active', appData.settings.editMode);
    document.getElementById('btn-toggle-edit-mode')?.classList.toggle('active', appData.settings.editMode);
    saveData();
};

window.toggleCardVisibility = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    const hidden = appData.settings.hiddenCards;
    if (hidden.includes(cardId)) { appData.settings.hiddenCards = hidden.filter(id => id !== cardId); card.classList.remove('hidden-card'); }
    else { hidden.push(cardId); card.classList.add('hidden-card'); }
    saveData();
};

window.openVisibilityModal = function() { document.getElementById('card-visibility-modal').style.display = 'flex'; };
window.closeVisibilityModal = function() { document.getElementById('card-visibility-modal').style.display = 'none'; };
window.showAllCards = function() { appData.settings.hiddenCards = []; saveData(); closeVisibilityModal(); setDashboardView(appData.settings.activeDashboardView); };

window.toggleCardCollapse = function(cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('collapsed');
    const list = appData.settings.collapsedCards;
    if (card.classList.contains('collapsed')) { if (!list.includes(cardId)) list.push(cardId); }
    else appData.settings.collapsedCards = list.filter(id => id !== cardId);
    saveData();
};

window.toggleAllCards = function() {
    const cards = document.querySelectorAll('.card:not(.hidden-card)');
    const shouldCollapse = [...cards].some(c => !c.classList.contains('collapsed'));
    cards.forEach(c => c.classList.toggle('collapsed', shouldCollapse));
    appData.settings.collapsedCards = shouldCollapse ? [...cards].map(c => c.id) : [];
    saveData();
};

function changeTheme(themeName) {
    appData.settings.theme = themeName;
    const panel = document.getElementById('custom-theme-panel');
    if (themeName === 'custom') { panel.style.display = 'flex'; applyCustomThemeStyles(); }
    else { panel.style.display = 'none'; document.documentElement.setAttribute('data-theme', themeName); }
    saveData();
}

function applyCustomThemeStyles() {
    const ct = appData.settings.customTheme;
    document.documentElement.setAttribute('data-theme', 'custom');
    const root = document.documentElement.style;
    root.setProperty('--bg-color', ct.bg); root.setProperty('--card-bg', ct.card); root.setProperty('--card-border', ct.border);
    root.setProperty('--text-main', ct.text); root.setProperty('--accent-cyan', ct.cyan); root.setProperty('--accent-violet', ct.violet);
}

// Drag & Drop
let draggedCardId = null;
window.handleDragStart = function(e, cardId) {
    draggedCardId = cardId;
    document.getElementById(cardId)?.classList.add('dragging');
    e.dataTransfer.setData('text/plain', cardId);
};
function setupDragAndDrop() {
    const container = document.getElementById('dashboard-container');
    document.addEventListener('dragend', () => {
        if (draggedCardId) { document.getElementById(draggedCardId)?.classList.remove('dragging'); draggedCardId = null; saveLayoutState(); }
    });
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const col = e.target.closest('.col-left, .col-right');
        const dragging = document.querySelector('.card.dragging');
        if (!col || !dragging) return;
        const after = [...col.querySelectorAll('.card:not(.dragging)')].reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            return (offset < 0 && offset > closest.offset) ? { offset, element: child } : closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;
        if (after == null) col.appendChild(dragging); else col.insertBefore(dragging, after);
    });
}
function saveLayoutState() {
    appData.settings.layout = {
        colLeft: [...document.querySelectorAll('#col-left .card')].map(c => c.id),
        colRight: [...document.querySelectorAll('#col-right .card')].map(c => c.id)
    };
    saveData();
}
function applyLayoutState() {
    const layout = appData.settings.layout || defaultData.settings.layout;
    const left = document.getElementById('col-left'), right = document.getElementById('col-right');
    (layout.colLeft || []).forEach(id => { const c = document.getElementById(id); if (c) left.appendChild(c); });
    (layout.colRight || []).forEach(id => { const c = document.getElementById(id); if (c) right.appendChild(c); });
}

/* ==========================================================
   AUDIO & RUIDO BLANCO
   ========================================================== */
class NoiseSynth {
    constructor() { this.ctx = null; this.source = null; this.gainNode = null; this.isPlaying = false; }
    init() { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); }
    play(type, vol) {
        this.init(); this.stop();
        const buffer = this.ctx.createBuffer(1, this.ctx.sampleRate * 2, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer; this.source.loop = true;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(vol / 100, this.ctx.currentTime);
        this.source.connect(this.gainNode); this.gainNode.connect(this.ctx.destination);
        this.source.start(); this.isPlaying = true;
    }
    stop() { if (this.source) { try { this.source.stop(); } catch(e){} this.source.disconnect(); } this.isPlaying = false; }
    setVolume(vol) { if (this.gainNode) this.gainNode.gain.setValueAtTime(vol / 100, this.ctx.currentTime); }
}
const audioSynth = new NoiseSynth();
window.toggleNoiseGenerator = function() {
    if (audioSynth.isPlaying) { audioSynth.stop(); document.getElementById('btn-audio-toggle').textContent = '▶ Play'; }
    else { audioSynth.play(document.getElementById('audio-sound-type').value, document.getElementById('audio-volume').value); document.getElementById('btn-audio-toggle').textContent = '⏹ Stop'; }
};
window.updateAudioVolume = function(val) { document.getElementById('audio-vol-text').textContent = val + '%'; audioSynth.setVolume(val); };

/* ==========================================================
   TAREAS, KANBAN, ENTREGAS, CALIFICACIONES Y NOTAS
   ========================================================== */
window.addTask = function() {
    const text = document.getElementById('task-text').value.trim();
    if (!text) return;
    appData.tasks.push({ id: Date.now(), text, date: document.getElementById('task-date').value, priority: document.getElementById('task-priority').value, done: false });
    document.getElementById('task-text').value = '';
    saveData(); renderTasks();
};
window.toggleTask = function(id) { const t = appData.tasks.find(x => x.id === id); if (t) { t.done = !t.done; saveData(); renderTasks(); } };
window.deleteTask = function(id) { appData.tasks = appData.tasks.filter(x => x.id !== id); saveData(); renderTasks(); };
function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = appData.tasks.map(t => `<li class="${t.done ? 'task-done' : ''}"><span onclick="toggleTask(${t.id})" style="cursor:pointer">${t.done ? '✅' : '⬜'} ${escapeHtml(t.text)}</span><button onclick="deleteTask(${t.id})" class="btn-icon">✖</button></li>`).join('');
}

window.addDelivery = function() {
    const title = document.getElementById('deliv-title').value.trim();
    if (!title) return;
    appData.deliveries.push({ id: Date.now(), title, subject: document.getElementById('deliv-subject').value, type: document.getElementById('deliv-type').value, dueDate: document.getElementById('deliv-datetime').value, done: false });
    saveData(); renderDeliveries();
};
function renderDeliveries() {
    const container = document.getElementById('deliveries-list');
    if (!container) return;
    container.innerHTML = appData.deliveries.map(d => `<div class="deadline-card-item"><span>${escapeHtml(d.title)}</span><button onclick="appData.deliveries = appData.deliveries.filter(x => x.id !== ${d.id}); saveData(); renderDeliveries();" class="btn-icon">✖</button></div>`).join('');
}

window.addKanbanTask = function() {
    const title = document.getElementById('kanban-new-title').value.trim();
    if (!title) return;
    appData.studyKanban.push({ id: Date.now(), title, subject: document.getElementById('kanban-new-subject').value, col: 'todo', pomos: 2, donePomos: 0, priority: 'medium' });
    saveData(); renderKanban();
};
function renderKanban() {
    ['todo', 'doing', 'done'].forEach(col => {
        const box = document.getElementById(`kanban-list-${col}`);
        if (box) box.innerHTML = appData.studyKanban.filter(t => t.col === col).map(t => `<div class="kanban-card"><span>${escapeHtml(t.title)}</span></div>`).join('');
    });
}

function renderGradesCalculator() {
    const container = document.getElementById('grades-subjects-container');
    if (!container) return;
    container.innerHTML = appData.grades.map(g => `<div class="grade-calc-subject"><strong>${escapeHtml(g.subject)}</strong></div>`).join('');
}

window.addBookmark = function() {
    const name = document.getElementById('bm-name').value.trim();
    const url = document.getElementById('bm-url').value.trim();
    if (!name || !url) return;
    appData.bookmarks.push({ id: Date.now(), name, url });
    saveData(); renderBookmarks();
};
function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;
    list.innerHTML = appData.bookmarks.map(b => `<li><a href="${escapeHtml(b.url)}" target="_blank">${escapeHtml(b.name)}</a></li>`).join('');
}

window.addServer = function() {
    const name = document.getElementById('srv-name').value.trim();
    const ip = document.getElementById('srv-ip').value.trim();
    if (!name || !ip) return;
    appData.servers.push({ id: Date.now(), name, ip });
    saveData(); renderServers();
};
function renderServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    list.innerHTML = appData.servers.map(s => `<li><span>${escapeHtml(s.name)} (${escapeHtml(s.ip)})</span></li>`).join('');
}

function renderSnippets() {
    const container = document.getElementById('snippet-list-container');
    if (!container) return;
    container.innerHTML = (appData.snippets || []).map(s => `<div class="snippet-box"><strong>${escapeHtml(s.title)}</strong></div>`).join('');
}

function updateScheduleWidget(now) {
    const widget = document.getElementById('schedule-widget');
    if (widget) widget.innerHTML = `<div class="sch-subject">Horario Activo</div>`;
}

function updateStats() {
    document.getElementById('stat-focus-today').textContent = `${appData.studyStats.todayFocusMinutes}m`;
    document.getElementById('stat-focus-total').textContent = `${Math.floor(appData.studyStats.totalFocusMinutes / 60)}h`;
}

function renderAll() {
    renderGradesCalculator(); renderDeliveries(); renderSnippets(); renderKanban();
    renderTasks(); renderBookmarks(); renderServers(); renderCategoryPills(); updateStats();
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-select')?.addEventListener('change', e => changeTheme(e.target.value));
    setupDragAndDrop();
    syncRealTimeNetwork();
});
