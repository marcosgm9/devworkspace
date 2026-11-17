/* ==========================================================
   DEVWORKSPACE APP.JS - CLOUD SYNC & OPTIMIZED ENGINE v6.1
   ========================================================== */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

let currentUser = null;
let isRegisterMode = false;

// Sistema de Notificaciones Toast
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.style.cssText = `background:var(--card-bg);border:1px solid ${type === 'error' ? 'var(--accent-red)' : type === 'success' ? 'var(--accent-green)' : 'var(--accent-cyan)'};color:var(--text-main);padding:8px 12px;border-radius:4px;font-size:0.75rem;font-family:var(--font-mono);box-shadow:0 4px 12px rgba(0,0,0,0.5);opacity:0;transition:opacity 0.3s;`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.style.opacity = '1', 10);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

window.toggleAuthMode = function() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').textContent = isRegisterMode ? 'Crear Cuenta' : 'DevWorkspace Cloud';
    document.getElementById('auth-subtitle').textContent = isRegisterMode ? 'Regístrate con tu correo y contraseña.' : 'Inicia sesión o regístrate para sincronizar tus datos.';
    document.getElementById('auth-main-btn').textContent = isRegisterMode ? '📝 Registrarse' : '🔑 Iniciar Sesión';
};

window.handleEmailAuth = async function() {
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value.trim();
    if (!email || !pass) { showToast("Introduce correo y contraseña.", "error"); return; }
    try {
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(auth, email, pass);
            showToast("¡Cuenta creada con éxito!", "success");
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
            showToast("¡Sesión iniciada!", "success");
        }
    } catch (error) {
        showToast("Error: " + error.message, "error");
    }
};

window.handlePasswordReset = async function() {
    const email = document.getElementById('auth-email').value.trim();
    if (!email) { showToast("Introduce tu correo arriba para recuperar la contraseña.", "error"); return; }
    try {
        await sendPasswordResetEmail(auth, email);
        showToast("Correo de recuperación enviado a " + email, "success");
    } catch (error) {
        showToast("Error: " + error.message, "error");
    }
};

window.logoutUser = async function() {
    try {
        await signOut(auth);
        localStorage.clear();
        location.reload();
    } catch (e) {}
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-modal').style.display = 'none';
        document.getElementById('user-profile-widget').style.display = 'flex';
        document.getElementById('user-name').textContent = user.email;
        await loadCloudData();
    } else {
        currentUser = null;
        document.getElementById('auth-modal').style.display = 'flex';
        document.getElementById('user-profile-widget').style.display = 'none';
    }
});

/* ==========================================================
   ESTRUCTURA DE DATOS Y CACHÉ LOCAL HÍBRIDA
   ========================================================== */
function debounce(func, wait) {
    let timeout;
    return function (...args) { clearTimeout(timeout); timeout = setTimeout(() => func(...args), wait); };
}
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
function escapeHtml(v) { return String(v ?? '').replace(/[&<>"'`]/g, c => ESC_MAP[c]); }
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

const defaultData = {
    tasks: [],
    studyKanban: [
        { id: 1, title: "Herencia y Polimorfismo en Java", subject: "PROG", col: "doing", priority: "high" },
        { id: 2, title: "Diagramas E/R y Normalización", subject: "BBDD", col: "todo", priority: "high" }
    ],
    studyStats: { todayFocusMinutes: 0, totalFocusMinutes: 0 },
    settings: { theme: 'cyberpunk', hiddenCards: [] }
};

let appData = structuredClone(defaultData);

async function loadCloudData() {
    if (!currentUser) return;
    try {
        const cached = localStorage.getItem('devworkspace_cache_' + currentUser.uid);
        if (cached) {
            appData = deepMerge(defaultData, JSON.parse(cached));
            renderAll();
        }
    } catch(e) {}

    try {
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appData = deepMerge(defaultData, docSnap.data());
        } else {
            await setDoc(docRef, defaultData);
        }
        localStorage.setItem('devworkspace_cache_' + currentUser.uid, JSON.stringify(appData));
        renderAll();
    } catch (e) {
        showToast("⚠️ Modo Offline: Usando caché local", "error");
    }
}

const saveData = debounce(async function() {
    if (!currentUser) return;
    try {
        localStorage.setItem('devworkspace_cache_' + currentUser.uid, JSON.stringify(appData));
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        await setDoc(docRef, appData);
    } catch (e) {
        showToast("⚠️ Error al guardar en la nube", "error");
    }
}, 500);

window.toggleForm = function(id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

/* ==========================================================
   SINCRONIZACIÓN DE HORA REAL (MULTI-API RESILIENTE)
   ========================================================== */
let networkOffsetMs = 0;

async function syncRealTimeNetwork() {
    const el = document.getElementById('net-status');
    if (el) el.textContent = '🔄 Sincronizando...';

    const apis = [
        async () => (await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid', { cache: 'no-store' })).json().then(d => new Date(d.datetime).getTime()),
        async () => (await fetch('https://timeapi.io/api/Time/current/zone?timeZone=Europe/Madrid', { cache: 'no-store' })).json().then(d => new Date(d.dateTime).getTime())
    ];

    let serverTimeMs = null;
    for (const api of apis) {
        try { serverTimeMs = await api(); if (serverTimeMs) break; } catch (e) {}
    }

    if (serverTimeMs) {
        networkOffsetMs = serverTimeMs - Date.now();
        if (el) { el.textContent = '🌐 Hora Real'; el.style.color = 'var(--accent-green)'; }
    } else {
        if (el) { el.textContent = '⚠️ Sin Red'; el.style.color = 'var(--accent-red)'; }
    }
}
setInterval(syncRealTimeNetwork, 300000);
syncRealTimeNetwork();

function updateClockDisplay() {
    const d = new Date(Date.now() + networkOffsetMs);
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (timeEl) timeEl.textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    if (dateEl) dateEl.textContent = d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
}
setInterval(updateClockDisplay, 1000);

document.getElementById('clock-container')?.addEventListener('click', () => {
    syncRealTimeNetwork();
    showToast("🔄 Resincronizando hora real...", "info");
});

/* ==========================================================
   POMODORO AUTOMATIZADO CON ESTADÍSTICAS
   ========================================================== */
let pomoInterval = null;
let pomoSecondsLeft = 25 * 60;

window.startCustomPomodoro = function(mode) {
    const mins = parseInt(document.getElementById('pomo-focus-time').value, 10);
    pomoSecondsLeft = mins * 60;
    clearInterval(pomoInterval);
    document.getElementById('pomodoro-target').textContent = '🎯 Sesión de Foco Activa';
    
    pomoInterval = setInterval(() => {
        pomoSecondsLeft--;
        const m = Math.floor(pomoSecondsLeft / 60);
        const s = pomoSecondsLeft % 60;
        const display = document.getElementById('pomodoro-display');
        if (display) display.textContent = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
        
        if (pomoSecondsLeft <= 0) {
            clearInterval(pomoInterval);
            appData.studyStats.todayFocusMinutes += mins;
            appData.studyStats.totalFocusMinutes += mins;
            saveData();
            updateStats();
            showToast(`🎉 ¡Pomodoro completado! +${mins} min sumados.`, "success");
        }
    }, 1000);
};

window.stopPomodoro = function() {
    clearInterval(pomoInterval);
    pomoSecondsLeft = 25 * 60;
    const display = document.getElementById('pomodoro-display');
    if (display) display.textContent = "25:00";
    document.getElementById('pomodoro-target').textContent = "Objetivo: Detenido";
};

/* ==========================================================
   KANBAN FLUIDO CON BOTONES DE MOVIMIENTO
   ========================================================== */
window.moveKanbanTask = function(id, direction) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    const cols = ['todo', 'doing', 'done'];
    const newIndex = cols.indexOf(task.col) + direction;
    if (newIndex >= 0 && newIndex < cols.length) {
        task.col = cols[newIndex];
        saveData();
        renderKanban();
    }
};

function renderKanban() {
    const cols = ['todo', 'doing', 'done'];
    const counts = { todo: 0, doing: 0, done: 0 };
    cols.forEach(col => {
        const list = document.getElementById(`kanban-list-${col}`);
        const items = appData.studyKanban.filter(t => t.col === col);
        counts[col] = items.length;
        if (list) {
            list.innerHTML = items.map(t => `
                <div class="kanban-card" style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <span style="font-size:0.6rem;color:var(--accent-cyan);display:block;">[${escapeHtml(t.subject)}]</span>
                        <span>${escapeHtml(t.title)}</span>
                    </div>
                    <div style="display:flex;gap:2px;">
                        ${col !== 'todo' ? `<button class="btn-icon" onclick="moveKanbanTask(${t.id}, -1)">◀</button>` : ''}
                        ${col !== 'done' ? `<button class="btn-icon" onclick="moveKanbanTask(${t.id}, 1)">▶</button>` : ''}
                    </div>
                </div>
            `).join('');
        }
    });
    ['todo', 'doing', 'done'].forEach(c => {
        const countEl = document.getElementById(`kanban-count-${c}`);
        if (countEl) countEl.textContent = counts[c];
    });
}

window.addKanbanTask = function() {
    const title = document.getElementById('kanban-new-title').value.trim();
    if (!title) return;
    appData.studyKanban.push({
        id: Date.now(),
        title,
        subject: document.getElementById('kanban-new-subject').value || 'GENERAL',
        col: 'todo',
        priority: document.getElementById('kanban-new-prio').value
    });
    document.getElementById('kanban-new-title').value = '';
    saveData();
    renderKanban();
};

/* ==========================================================
   BUSCADOR GLOBAL
   ========================================================== */
window.openGlobalSearch = function() { document.getElementById('global-search-modal').style.display = 'flex'; };
window.closeGlobalSearch = function() { document.getElementById('global-search-modal').style.display = 'none'; };

window.filterGlobalSearch = function() {
    const query = document.getElementById('global-search-input').value.toLowerCase().trim();
    const resultsList = document.getElementById('global-search-results');
    if (!resultsList || !query) { resultsList.innerHTML = ''; return; }

    let matches = [];
    (appData.tasks || []).forEach(t => { if(t.text.toLowerCase().includes(query)) matches.push(`📋 Tarea: ${escapeHtml(t.text)}`); });
    (appData.studyKanban || []).forEach(k => { if(k.title.toLowerCase().includes(query)) matches.push(`📅 Kanban: ${escapeHtml(k.title)}`); });

    resultsList.innerHTML = matches.length ? matches.map(m => `<li style="padding:6px;border-bottom:1px solid var(--card-border);font-size:0.75rem;">${m}</li>`).join('') : '<li style="padding:6px;font-size:0.75rem;color:var(--text-muted);">Sin resultados.</li>';
};

/* ==========================================================
   RENDERIZADOS Y EVENTOS
   ========================================================== */
function renderAll() {
    renderKanban();
    renderTasks();
    updateStats();
}

window.addTask = function() {
    const text = document.getElementById('task-text').value.trim();
    if (!text) return;
    appData.tasks.push({ id: Date.now(), text, done: false });
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

function updateStats() {
    document.getElementById('stat-focus-today').textContent = `${appData.studyStats.todayFocusMinutes}m`;
    document.getElementById('stat-focus-total').textContent = `${Math.floor(appData.studyStats.totalFocusMinutes / 60)}h`;
}

window.addEventListener('DOMContentLoaded', () => {
    document.getElementById('theme-select')?.addEventListener('change', e => {
        appData.settings.theme = e.target.value;
        document.documentElement.setAttribute('data-theme', e.target.value);
        saveData();
    });
});
