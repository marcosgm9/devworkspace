/* ==========================================================
   DEVWORKSPACE ULTIMATE v6.0 - CORE APPLICATION ENGINE
   Full Suite: Study Hub, Dev/SysAdmin Toolbox, Presets & PWA
   ========================================================== */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    setDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

/* ----------------------------------------------------------
   CONFIGURACIÓN FIREBASE & CONSTANTES
   ---------------------------------------------------------- */
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

const LOCAL_STORAGE_KEY = 'devworkspace_v6_0_ultimate';
const SNAPSHOTS_STORAGE_KEY = 'devworkspace_v6_0_snapshots';

let currentUser = null;
let isRegisterMode = false;
let lastDeletedAction = null;
let currentFlashcardIndex = 0;
let isFlashcardFlipped = false;
let isScratchpadPreview = false;

/* ----------------------------------------------------------
   UTILIDADES ES6+ & DEFENSIVA
   ---------------------------------------------------------- */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', '`': '&#96;' };
function escapeHtml(val) {
    return String(val ?? '').replace(/[&<>"'`]/g, c => ESC_MAP[c]);
}

function debounce(func, wait = 300) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
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

/* Toast con soporte para Deshacer (#43) */
function showToast(message, type = 'info', undoCallback = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '⚡';

    const msgSpan = document.createElement('span');
    msgSpan.textContent = `${icon} ${message}`;
    toast.appendChild(msgSpan);

    if (typeof undoCallback === 'function') {
        const undoBtn = document.createElement('button');
        undoBtn.type = 'button';
        undoBtn.className = 'tool-btn';
        undoBtn.textContent = '↩ Deshacer';
        undoBtn.onclick = () => {
            undoCallback();
            if (toast.parentNode) toast.parentNode.removeChild(toast);
        };
        toast.appendChild(undoBtn);
    }

    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, undoCallback ? 5000 : 3000);
}

function setSyncBadge(state, label) {
    const badge = document.getElementById('cloud-sync-indicator');
    if (!badge) return;
    badge.classList.remove('sync-saving', 'sync-error');
    if (state === 'saving') badge.classList.add('sync-saving');
    if (state === 'error') badge.classList.add('sync-error');
    badge.textContent = label;
}

window.copyElementValue = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value !== undefined ? el.value : el.textContent;
    if (!val) return;
    navigator.clipboard?.writeText(val).then(() => showToast("📋 Copiado al portapapeles", "success"));
};

/* ----------------------------------------------------------
   NOTIFICACIONES NATIVAS DE ESCRITORIO (#38)
   ---------------------------------------------------------- */
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission().catch(() => {});
    }
}

function sendDesktopNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, { body });
        } catch (e) {
            console.warn("No se pudo enviar notificación nativa:", e);
        }
    }
}

/* ----------------------------------------------------------
   ESTADO INICIAL Y ESQUEMA
   ---------------------------------------------------------- */
const defaultCategories = [
    { key: 'all', label: '🚀 Todo' },
    { key: 'study', label: '🎓 Academia & Estudio' },
    { key: 'dev', label: '💻 Dev & SysAdmin Lab' },
    { key: 'focus', label: '⚡ Foco & Productividad' }
];

const defaultLayout = {
    colLeft: [
        'card-kanban', 'card-grades', 'card-deliveries', 'card-study-hub',
        'card-projects', 'card-tasks', 'card-notes', 'card-sticky'
    ],
    colRight: [
        'card-study-stats', 'card-pomodoro', 'card-audio', 'card-dev-toolbox',
        'card-snippets', 'card-schedule', 'card-bookmarks', 'card-servers'
    ]
};

const defaultDeployChecklist = [
    { id: 'chk1', text: 'Probado en entorno limpio / máquina virtual', done: false },
    { id: 'chk2', text: 'Sin credenciales ni secretos hardcodeados', done: false },
    { id: 'chk3', text: 'Puertos y firewall verificados', done: false },
    { id: 'chk4', text: 'Documentación / README actualizada', done: false }
];

const defaultData = {
    bookmarks: [],
    tasks: [],
    servers: [],
    schedule: [],
    stickyNote: "",
    notes: {
        general: "",
        comandos: "",
        clases: ""
    },
    noteHistory: {
        general: [],
        comandos: [],
        clases: []
    },
    activeNotesTab: 'general',
    grades: [],
    deliveries: [],
    snippets: [],
    studyKanban: [],
    flashcards: [],
    bugLogs: [],
    classDoubts: [],
    teamProjects: [],
    deployChecklist: structuredClone(defaultDeployChecklist),
    studyStats: {
        todayFocusMinutes: 0,
        totalFocusMinutes: 0,
        lastDate: new Date().toISOString().slice(0, 10),
        streakDays: 0,
        history: []
    },
    customCategories: [],
    customCards: [],
    cardCategories: {},
    settings: {
        timezone: 'Europe/Madrid',
        theme: 'cyberpunk',
        fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
        uiScale: 1,
        preset: 'default',
        weatherEnabled: false,
        manualSkewOffsetMs: 0,
        customTheme: {
            name: 'Cyber Neon',
            bg: '#060813',
            card: '#0d131f',
            border: '#1e293b',
            text: '#f1f5f9',
            cyan: '#38bdf8',
            violet: '#a855f7'
        },
        scheduleViewMode: 'widget',
        activeDashboardView: 'all',
        collapsedCards: [],
        hiddenCards: [],
        expandedCards: [],
        editMode: false,
        zenMode: false,
        compactMode: false,
        layout: structuredClone(defaultLayout)
    }
};

let appData = structuredClone(defaultData);

/* ----------------------------------------------------------
   SNAPSHOTS & ALMACENAMIENTO LOCAL (#29, #36, #42)
   ---------------------------------------------------------- */
function updateStorageQuotaBadge() {
    const badge = document.getElementById('storage-quota-badge');
    if (!badge) return;
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY) || '';
        const bytes = new Blob([raw]).size;
        const kb = (bytes / 1024).toFixed(1);
        const maxKb = 5120; // ~5 MB referencia localStorage
        const pct = Math.min(100, Math.round((bytes / (maxKb * 1024)) * 100));
        badge.textContent = `Storage: ${kb} KB (${pct}%)`;
    } catch (_) {}
}

function saveSnapshot(label = 'Auto-Snapshot') {
    try {
        const existing = JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY) || '[]');
        existing.unshift({
            id: Date.now(),
            label,
            date: new Date().toLocaleString('es-ES'),
            data: structuredClone(appData)
        });
        localStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify(existing.slice(0, 6)));
    } catch (_) {}
}

window.createManualSnapshot = function () {
    saveSnapshot('Snapshot Manual');
    renderSnapshotsModal();
    showToast("📸 Snapshot guardado localmente", "success");
};

window.openSnapshotsModal = function () {
    renderSnapshotsModal();
    const m = document.getElementById('snapshots-modal');
    if (m) m.style.display = 'flex';
};

window.closeSnapshotsModal = function () {
    const m = document.getElementById('snapshots-modal');
    if (m) m.style.display = 'none';
};

function renderSnapshotsModal() {
    const box = document.getElementById('snapshots-list-container');
    if (!box) return;
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY) || '[]');
    if (!snaps.length) {
        box.innerHTML = `<div class="modal-hint">No hay snapshots guardados todavía.</div>`;
        return;
    }
    box.innerHTML = snaps.map(s => `
        <div class="hub-item-card" style="flex-direction:row;justify-content:space-between;align-items:center;">
            <div>
                <strong>${escapeHtml(s.label)}</strong>
                <div style="font-size:0.62rem;color:var(--text-muted);">${escapeHtml(s.date)}</div>
            </div>
            <button type="button" class="btn-cyan" onclick="restoreSnapshot(${s.id})">Restaurar</button>
        </div>
    `).join('');
}

window.restoreSnapshot = function (id) {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_STORAGE_KEY) || '[]');
    const found = snaps.find(s => s.id === id);
    if (!found) return;
    appData = deepMerge(defaultData, found.data);
    saveData();
    applyAppearanceSettings();
    applyTheme();
    renderAll();
    applyLayoutState();
    closeSnapshotsModal();
    showToast("♻️ Snapshot restaurado", "success");
};

/* ----------------------------------------------------------
   PERSISTENCIA & OFFLINE-FIRST (LOCALSTORAGE + FIRESTORE)
   ---------------------------------------------------------- */
function loadLocalData() {
    try {
        localStorage.removeItem('devworkspace_ultimate_v5_8');
        localStorage.removeItem('devworkspace_data_v5');
        localStorage.removeItem('devworkspace_v5_9_clean');

        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            appData = deepMerge(defaultData, JSON.parse(raw));
        } else {
            appData = structuredClone(defaultData);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        }
    } catch (e) {
        console.warn("Error leyendo localStorage:", e);
        appData = structuredClone(defaultData);
    }
    updateStorageQuotaBadge();
}

window.resetWorkspacePrompt = function () {
    if (confirm("¿Estás seguro de que deseas vaciar todo el workspace a blanco? Se guardará antes un snapshot de seguridad.")) {
        saveSnapshot('Antes de vaciar workspace');
        appData = structuredClone(defaultData);
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}
        applyAppearanceSettings();
        applyTheme();
        renderAll();
        applyLayoutState();
        updateStorageQuotaBadge();
        showToast("🧹 Workspace reiniciado en blanco", "info");
    }
};

async function loadCloudData() {
    if (!currentUser) return;
    setSyncBadge('saving', 'Sincronizando...');
    try {
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appData = deepMerge(defaultData, docSnap.data());
        } else {
            await setDoc(docRef, appData);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        updateStorageQuotaBadge();
        setSyncBadge('ok', 'Cloud OK');
        applyAppearanceSettings();
        applyTheme();
        renderAll();
        applyLayoutState();
        showToast("☁️ Datos sincronizados con Firestore", "success");
    } catch (e) {
        console.warn("No se pudo cargar desde Firestore:", e);
        setSyncBadge('error', 'Sin Cloud');
        showToast("Modo local (Sin conexión con Firebase)", "error");
    }
}

const saveData = debounce(async function () {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        updateStorageQuotaBadge();
    } catch (e) {
        console.warn("Error guardando en localStorage:", e);
    }

    if (currentUser) {
        setSyncBadge('saving', 'Guardando...');
        try {
            const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
            await setDoc(docRef, appData);
            setSyncBadge('ok', 'Cloud OK');
        } catch (e) {
            console.warn("Error guardando en Firestore:", e);
            setSyncBadge('error', 'Error Cloud');
        }
    } else {
        setSyncBadge('ok', 'Local');
    }
}, 350);

/* ----------------------------------------------------------
   AUTENTICACIÓN FIREBASE & MODO INVITADO
   ---------------------------------------------------------- */
window.toggleAuthMode = function () {
    isRegisterMode = !isRegisterMode;
    const title = document.getElementById('auth-title');
    const subtitle = document.getElementById('auth-subtitle');
    const mainBtn = document.getElementById('auth-main-btn');
    const toggleBtn = document.querySelector('.btn-link-action');

    if (title) title.textContent = isRegisterMode ? 'Crear Cuenta' : 'DevWorkspace Cloud';
    if (subtitle) subtitle.textContent = isRegisterMode ? 'Regístrate con tu correo para sincronizar en tiempo real.' : 'Inicia sesión para sincronizar tus datos en tiempo real.';
    if (mainBtn) mainBtn.textContent = isRegisterMode ? '📝 Registrarse' : '🔑 Iniciar Sesión';
    if (toggleBtn) toggleBtn.textContent = isRegisterMode ? '¿Ya tienes cuenta? Inicia sesión aquí' : '¿No tienes cuenta? Regístrate aquí';
};

window.handleEmailAuth = async function () {
    const email = document.getElementById('auth-email')?.value.trim();
    const pass = document.getElementById('auth-password')?.value.trim();
    if (!email || !pass) {
        showToast("Introduce correo y contraseña válida", "error");
        return;
    }
    try {
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(auth, email, pass);
            showToast("Cuenta creada con éxito", "success");
        } else {
            await signInWithEmailAndPassword(auth, email, pass);
            showToast("Sesión iniciada con éxito", "success");
        }
        closeAuthModal();
    } catch (error) {
        showToast(`Error de autenticación: ${error.code || 'credenciales inválidas'}`, "error");
    }
};

window.logoutUser = async function () {
    try {
        await signOut(auth);
        currentUser = null;
        setSyncBadge('ok', 'Local');
        loadLocalData();
        applyTheme();
        renderAll();
        applyLayoutState();
        showToast("Sesión cerrada", "info");
    } catch (error) {
        showToast("No se pudo cerrar la sesión", "error");
    }
};

window.openAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) {
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('auth-email')?.focus(), 20);
    }
};

window.closeAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
};

window.continueAsGuest = function () {
    closeAuthModal();
    showToast("⚡ Modo Local activo", "info");
};

onAuthStateChanged(auth, async (user) => {
    const modal = document.getElementById('auth-modal');
    const profileWidget = document.getElementById('user-profile-widget');
    const loginBtn = document.getElementById('btn-cloud-login');
    const userName = document.getElementById('user-name');

    if (user) {
        currentUser = user;
        if (modal) modal.style.display = 'none';
        if (profileWidget) profileWidget.style.display = 'flex';
        if (loginBtn) loginBtn.style.display = 'none';
        if (userName) userName.textContent = user.email ? user.email.split('@')[0] : 'Conectado';
        await loadCloudData();
    } else {
        currentUser = null;
        if (profileWidget) profileWidget.style.display = 'none';
        if (loginBtn) loginBtn.style.display = 'flex';
    }
});

/* ----------------------------------------------------------
   RELOJ, SKEW, APIS HORARIAS & CLIMA (#44)
   ---------------------------------------------------------- */
let networkOffsetMs = 0;
let isManualMode = false;

async function fetchMadridTimeMs() {
    const endpoints = [
        async () => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 3500);
            try {
                const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid', { cache: 'no-store', signal: controller.signal });
                if (!res.ok) throw new Error('worldtimeapi error');
                const data = await res.json();
                return new Date(data.datetime).getTime();
            } finally { clearTimeout(t); }
        },
        async () => {
            const controller = new AbortController();
            const t = setTimeout(() => controller.abort(), 3500);
            try {
                const res = await fetch('https://timeapi.io/api/time/current/zone?timeZone=Europe%2FMadrid', { cache: 'no-store', signal: controller.signal });
                if (!res.ok) throw new Error('timeapi error');
                const data = await res.json();
                return new Date(data.dateTime).getTime();
            } finally { clearTimeout(t); }
        }
    ];

    for (const fn of endpoints) {
        try {
            const ms = await fn();
            if (!Number.isNaN(ms)) return ms;
        } catch (_) {}
    }
    throw new Error('No time API available');
}

window.syncRealTimeNetwork = async function () {
    const el = document.getElementById('net-status');
    if (isManualMode) {
        if (el) el.textContent = '✏️ Hora Manual Activa';
        return;
    }
    if (el) el.textContent = '🔄 Sincronizando...';
    try {
        const serverTimeMs = await fetchMadridTimeMs();
        networkOffsetMs = serverTimeMs - Date.now();
        if (el) {
            el.textContent = '🌐 Hora Real (Madrid)';
            el.style.color = 'var(--accent-green)';
        }
    } catch (e) {
        if (el) {
            el.textContent = '⚠️ Sin Red (Hora Local)';
            el.style.color = 'var(--text-muted)';
        }
    }
    updateClockDisplay();
};

window.applyManualSkewOffset = function (val) {
    if (val === 'custom') {
        const inputTime = prompt("Introduce la hora real deseada en formato HH:MM (Madrid):");
        if (inputTime && inputTime.includes(':')) {
            const [h, m] = inputTime.split(':');
            const targetDate = new Date();
            targetDate.setHours(parseInt(h, 10) || 0, parseInt(m, 10) || 0, 0, 0);
            isManualMode = true;
            appData.settings.manualSkewOffsetMs = targetDate.getTime() - (Date.now() + networkOffsetMs);
            showToast(`Hora ajustada a ${inputTime}`, "info");
        }
    } else {
        const parsed = parseInt(val, 10) || 0;
        appData.settings.manualSkewOffsetMs = parsed;
        isManualMode = parsed !== 0;
    }
    saveData();
    updateClockDisplay();
};

function getClockDate() {
    const offset = (appData.settings.manualSkewOffsetMs || 0) + networkOffsetMs;
    return new Date(Date.now() + offset);
}

function updateClockDisplay() {
    const d = getClockDate();
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (timeEl) {
        timeEl.textContent = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
    if (dateEl) {
        dateEl.textContent = d.toLocaleDateString('es-ES', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
    }
    updateScheduleWidget(d);
    updateDeliveriesCountdown();
}

setInterval(updateClockDisplay, 1000);

/* Clima opcional con Open-Meteo (#44) */
window.toggleWeatherWidget = async function () {
    appData.settings.weatherEnabled = !appData.settings.weatherEnabled;
    saveData();
    await refreshWeatherBadge();
};

async function refreshWeatherBadge() {
    const textEl = document.getElementById('weather-text');
    if (!textEl) return;
    if (!appData.settings.weatherEnabled) {
        textEl.textContent = 'Clima: OFF';
        return;
    }
    textEl.textContent = 'Cargando...';
    try {
        // Almendralejo / Extremadura coords por defecto con geolocalización si está disponible
        let lat = 38.68, lon = -6.41;
        if (navigator.geolocation) {
            await new Promise(resolve => {
                navigator.geolocation.getCurrentPosition(
                    pos => { lat = pos.coords.latitude; lon = pos.coords.longitude; resolve(); },
                    () => resolve(),
                    { timeout: 2500 }
                );
            });
        }
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        textEl.textContent = temp !== undefined ? `${temp}°C` : 'No disp.';
    } catch (_) {
        textEl.textContent = 'Offline';
    }
}

/* ----------------------------------------------------------
   MODO ZEN, COMPACTO, PRESETS & APARIENCIA (#31, #40)
   ---------------------------------------------------------- */
window.toggleZenMode = function () {
    appData.settings.zenMode = !appData.settings.zenMode;
    applyZenModeState();
    saveData();
    showToast(appData.settings.zenMode ? "🧘 Modo Zen activado" : "⚡ Modo Zen desactivado", "info");
};

function applyZenModeState() {
    const isZen = !!appData.settings.zenMode;
    document.getElementById('btn-zen-mode')?.classList.toggle('active', isZen);
    document.body.classList.toggle('zen-mode-active', isZen);
}

window.toggleDensityMode = function () {
    appData.settings.compactMode = !appData.settings.compactMode;
    applyDensityModeState();
    saveData();
    showToast(appData.settings.compactMode ? "📐 Densidad compacta activada" : "📐 Densidad normal restaurada", "info");
};

function applyDensityModeState() {
    const isCompact = !!appData.settings.compactMode;
    document.getElementById('btn-density-mode')?.classList.toggle('active', isCompact);
    document.body.classList.toggle('density-compact', isCompact);
}

/* Perfiles rápidos de espacio de trabajo (#31) */
window.applyWorkspacePreset = function (presetKey) {
    appData.settings.preset = presetKey;
    const presetMap = {
        default: [],
        exam: ['card-bookmarks', 'card-servers', 'card-dev-toolbox', 'card-projects'],
        dev: ['card-grades', 'card-schedule', 'card-study-hub'],
        sysadmin: ['card-grades', 'card-study-hub', 'card-pomodoro'],
        class: ['card-dev-toolbox', 'card-servers', 'card-projects']
    };
    appData.settings.hiddenCards = presetMap[presetKey] || [];
    saveData();
    setDashboardView(appData.settings.activeDashboardView);
    renderVisibilityControls();
    showToast(`🧭 Perfil "${presetKey}" aplicado`, "info");
};

/* Tipografía y escala global (#40) */
window.openAppearanceModal = function () {
    const ff = document.getElementById('font-family-select');
    const sc = document.getElementById('ui-scale-select');
    if (ff) ff.value = appData.settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace";
    if (sc) sc.value = String(appData.settings.uiScale || 1);
    const m = document.getElementById('appearance-modal');
    if (m) m.style.display = 'flex';
};

window.closeAppearanceModal = function () {
    const m = document.getElementById('appearance-modal');
    if (m) m.style.display = 'none';
};

window.updateAppearanceSettings = function () {
    const ff = document.getElementById('font-family-select')?.value;
    const sc = parseFloat(document.getElementById('ui-scale-select')?.value) || 1;
    if (ff) appData.settings.fontFamily = ff;
    appData.settings.uiScale = sc;
    applyAppearanceSettings();
    saveData();
};

function applyAppearanceSettings() {
    const ff = appData.settings.fontFamily || "'JetBrains Mono', 'Fira Code', monospace";
    const sc = appData.settings.uiScale || 1;
    document.documentElement.style.setProperty('--font-mono', ff);
    document.documentElement.style.setProperty('--ui-scale', String(sc));
}

/* ----------------------------------------------------------
   GESTIÓN DE TEMAS & CUSTOM THEME STUDIO
   ---------------------------------------------------------- */
function applyTheme() {
    const currentTheme = appData.settings.theme || 'cyberpunk';
    const select = document.getElementById('theme-select');
    if (select) select.value = currentTheme;

    const panel = document.getElementById('custom-theme-panel');
    if (currentTheme === 'custom') {
        if (panel) panel.style.display = 'flex';
        applyCustomThemeStyles();
    } else {
        if (panel) panel.style.display = 'none';
        document.documentElement.setAttribute('data-theme', currentTheme);
        document.documentElement.removeAttribute('style');
        applyAppearanceSettings();
    }
}

function applyCustomThemeStyles() {
    const ct = appData.settings.customTheme;
    document.documentElement.setAttribute('data-theme', 'custom');
    const root = document.documentElement.style;
    root.setProperty('--bg-color', ct.bg);
    root.setProperty('--card-bg', ct.card);
    root.setProperty('--card-border', ct.border);
    root.setProperty('--text-main', ct.text);
    root.setProperty('--accent-cyan', ct.cyan);
    root.setProperty('--accent-violet', ct.violet);
    applyAppearanceSettings();

    const hexToRgb = hex => {
        const c = (hex || '').replace('#', '');
        if (c.length === 6) {
            return `${parseInt(c.substring(0, 2), 16)}, ${parseInt(c.substring(2, 4), 16)}, ${parseInt(c.substring(4, 6), 16)}`;
        }
        return '56, 189, 248';
    };

    root.setProperty('--accent-cyan-rgb', hexToRgb(ct.cyan));
    root.setProperty('--accent-violet-rgb', hexToRgb(ct.violet));

    const nameInput = document.getElementById('custom-theme-name');
    if (nameInput) nameInput.value = ct.name || 'Mi Tema';
    const cpBg = document.getElementById('cp-bg'); if (cpBg) cpBg.value = ct.bg;
    const cpCard = document.getElementById('cp-card'); if (cpCard) cpCard.value = ct.card;
    const cpBorder = document.getElementById('cp-border'); if (cpBorder) cpBorder.value = ct.border;
    const cpText = document.getElementById('cp-text'); if (cpText) cpText.value = ct.text;
    const cpCyan = document.getElementById('cp-cyan'); if (cpCyan) cpCyan.value = ct.cyan;
    const cpViolet = document.getElementById('cp-violet'); if (cpViolet) cpViolet.value = ct.violet;
}

function setupThemeListeners() {
    const select = document.getElementById('theme-select');
    if (select) {
        select.addEventListener('change', e => {
            appData.settings.theme = e.target.value;
            applyTheme();
            saveData();
        });
    }

    const bindColor = (id, key) => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', e => {
                appData.settings.customTheme[key] = e.target.value;
                applyCustomThemeStyles();
                saveData();
            });
        }
    };

    bindColor('cp-bg', 'bg');
    bindColor('cp-card', 'card');
    bindColor('cp-border', 'border');
    bindColor('cp-text', 'text');
    bindColor('cp-cyan', 'cyan');
    bindColor('cp-violet', 'violet');

    const nameInput = document.getElementById('custom-theme-name');
    if (nameInput) {
        nameInput.addEventListener('input', e => {
            appData.settings.customTheme.name = e.target.value;
            saveData();
        });
    }
}

/* ----------------------------------------------------------
   VISTAS, CATEGORÍAS, VISIBILIDAD & ANCHO DE TARJETAS (#39)
   ---------------------------------------------------------- */
function getAllCategories() {
    return [...defaultCategories, ...(appData.customCategories || [])];
}

function renderCategoryPills() {
    const container = document.getElementById('view-pills-container');
    if (!container) return;
    const activeView = appData.settings.activeDashboardView || 'all';

    container.innerHTML = getAllCategories().map(cat => `
        <button type="button" class="view-pill ${activeView === cat.key ? 'active' : ''}"
                data-view="${escapeHtml(cat.key)}"
                onclick="setDashboardView('${escapeHtml(cat.key)}')">
            ${escapeHtml(cat.label)}
        </button>
    `).join('');

    populateCategorySelectors();
}

function populateCategorySelectors() {
    const cats = getAllCategories().filter(c => c.key !== 'all');
    const opts = cur => cats.map(c => `<option value="${escapeHtml(c.key)}" ${c.key === cur ? 'selected' : ''}>${escapeHtml(c.label)}</option>`).join('');

    const createSelect = document.getElementById('new-card-category');
    if (createSelect) createSelect.innerHTML = opts('study');

    document.querySelectorAll('.card').forEach(card => {
        const select = card.querySelector('.card-category-select');
        if (select) {
            const current = appData.cardCategories[card.id] || card.getAttribute('data-category') || 'dev';
            select.innerHTML = opts(current);
        }
    });
}

window.setDashboardView = function (viewKey) {
    appData.settings.activeDashboardView = viewKey;
    document.querySelectorAll('#view-pills-container .view-pill').forEach(b => {
        b.classList.toggle('active', b.dataset.view === viewKey);
    });

    const hiddenSet = new Set(appData.settings.hiddenCards || []);
    document.querySelectorAll('.card').forEach(card => {
        const cat = appData.cardCategories[card.id] || card.getAttribute('data-category') || 'dev';
        if (hiddenSet.has(card.id)) {
            card.classList.add('hidden-card');
            return;
        }
        card.classList.remove('hidden-card');
        card.style.display = (viewKey === 'all' || cat === viewKey) ? 'flex' : 'none';
    });
    saveData();
};

window.toggleCardSpan = function (cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('card-full-span');
    const expanded = new Set(appData.settings.expandedCards || []);
    if (card.classList.contains('card-full-span')) expanded.add(cardId);
    else expanded.delete(cardId);
    appData.settings.expandedCards = [...expanded];
    saveData();
};

window.addCustomCategoryPrompt = function () {
    const name = prompt("Nombre de la nueva sección / categoría:");
    if (!name || !name.trim()) return;
    const icon = prompt("Icono/Emoji para la sección:", "📁") || "📁";
    const key = 'custom_cat_' + Date.now();
    appData.customCategories.push({ key, label: `${icon} ${name.trim()}` });
    saveData();
    renderCategoryPills();
    setDashboardView(key);
    showToast(`Sección "${name.trim()}" creada`, "success");
};

window.updateCardCategory = function (cardId, newCatKey) {
    appData.cardCategories[cardId] = newCatKey;
    saveData();
    setDashboardView(appData.settings.activeDashboardView);
    showToast("Categoría de tarjeta actualizada", "info");
};

window.toggleEditMode = function () {
    appData.settings.editMode = !appData.settings.editMode;
    document.body.classList.toggle('edit-mode-active', appData.settings.editMode);
    document.getElementById('btn-toggle-edit-mode')?.classList.toggle('active', appData.settings.editMode);
    saveData();
};

window.openVisibilityModal = function () {
    renderVisibilityControls();
    const modal = document.getElementById('card-visibility-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeVisibilityModal = function () {
    const modal = document.getElementById('card-visibility-modal');
    if (modal) modal.style.display = 'none';
};

window.showAllCards = function () {
    appData.settings.hiddenCards = [];
    saveData();
    renderVisibilityControls();
    setDashboardView(appData.settings.activeDashboardView);
    showToast("Todas las tarjetas visibles", "success");
};

window.resetLayoutOnly = function () {
    appData.settings.layout = structuredClone(defaultLayout);
    appData.settings.hiddenCards = [];
    appData.settings.collapsedCards = [];
    appData.settings.expandedCards = [];
    saveData();
    applyLayoutState();
    setDashboardView(appData.settings.activeDashboardView);
    renderVisibilityControls();
    showToast("Diseño y visibilidad restaurados", "info");
};

function renderVisibilityControls() {
    const container = document.getElementById('visibility-controls-container');
    if (!container) return;
    const hiddenSet = new Set(appData.settings.hiddenCards || []);

    container.innerHTML = [...document.querySelectorAll('.card')].map(card => {
        const title = card.querySelector('.card-title-text')?.textContent || card.id;
        const isHidden = hiddenSet.has(card.id);
        return `
            <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);padding:5px 8px;border-radius:4px;border:1px solid var(--card-border);">
                <span style="font-size:0.72rem;font-family:var(--font-mono);">${escapeHtml(title)}</span>
                <button type="button" onclick="toggleCardVisibility('${card.id}')" class="view-pill ${isHidden ? '' : 'active'}" style="font-size:0.65rem;padding:2px 8px;">
                    ${isHidden ? '👁️ Oculta' : '👁️ Visible'}
                </button>
            </div>
        `;
    }).join('');
}

window.toggleCardVisibility = function (cardId) {
    const hidden = appData.settings.hiddenCards || [];
    appData.settings.hiddenCards = hidden.includes(cardId)
        ? hidden.filter(id => id !== cardId)
        : [...hidden, cardId];
    saveData();
    setDashboardView(appData.settings.activeDashboardView);
    renderVisibilityControls();
};

window.toggleCardCollapse = function (cardId) {
    const card = document.getElementById(cardId);
    if (!card) return;
    card.classList.toggle('collapsed');
    const isCollapsed = card.classList.contains('collapsed');
    const list = appData.settings.collapsedCards || [];
    if (isCollapsed) {
        if (!list.includes(cardId)) list.push(cardId);
    } else {
        appData.settings.collapsedCards = list.filter(id => id !== cardId);
    }
    const btn = card.querySelector('.btn-collapse');
    if (btn) btn.textContent = isCollapsed ? '+' : '_';
    saveData();
};

window.toggleAllCards = function () {
    const cards = document.querySelectorAll('.card:not(.hidden-card)');
    const shouldCollapse = [...cards].some(c => !c.classList.contains('collapsed'));
    cards.forEach(c => {
        c.classList.toggle('collapsed', shouldCollapse);
        const btn = c.querySelector('.btn-collapse');
        if (btn) btn.textContent = shouldCollapse ? '+' : '_';
    });
    appData.settings.collapsedCards = shouldCollapse ? [...cards].map(c => c.id) : [];
    saveData();
};

window.toggleForm = function (id) {
    const el = document.getElementById(id);
    if (el) el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

/* ----------------------------------------------------------
   DRAG & DROP ROBUSTO DE TARJETAS
   ---------------------------------------------------------- */
let draggedCardId = null;

window.handleDragStart = function (e, cardId) {
    draggedCardId = cardId;
    document.getElementById(cardId)?.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
};

function setupDragAndDrop() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    document.addEventListener('dragend', () => {
        if (draggedCardId) {
            document.getElementById(draggedCardId)?.classList.remove('dragging');
            draggedCardId = null;
            saveLayoutState();
        }
    });

    container.addEventListener('dragover', e => {
        if (draggedKanbanId !== null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const col = e.target.closest('.col-left, .col-right');
        const dragging = document.querySelector('.card.dragging');
        if (!col || !dragging) return;

        const siblings = [...col.querySelectorAll('.card:not(.dragging)')];
        const afterElement = siblings.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElement == null) col.appendChild(dragging);
        else col.insertBefore(dragging, afterElement);
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
    const layout = appData.settings.layout || defaultLayout;
    const left = document.getElementById('col-left');
    const right = document.getElementById('col-right');
    if (!left || !right) return;

    (layout.colLeft || []).forEach(id => { const c = document.getElementById(id); if (c) left.appendChild(c); });
    (layout.colRight || []).forEach(id => { const c = document.getElementById(id); if (c) right.appendChild(c); });

    (appData.settings.collapsedCards || []).forEach(id => {
        const c = document.getElementById(id);
        if (c) {
            c.classList.add('collapsed');
            const btn = c.querySelector('.btn-collapse');
            if (btn) btn.textContent = '+';
        }
    });

    const expandedSet = new Set(appData.settings.expandedCards || []);
    document.querySelectorAll('.card').forEach(c => {
        c.classList.toggle('card-full-span', expandedSet.has(c.id));
    });

    document.body.classList.toggle('edit-mode-active', !!appData.settings.editMode);
    document.getElementById('btn-toggle-edit-mode')?.classList.toggle('active', !!appData.settings.editMode);

    applyZenModeState();
    applyDensityModeState();
}

/* ----------------------------------------------------------
   KANBAN DE ESTUDIO
   ---------------------------------------------------------- */
let draggedKanbanId = null;

window.addKanbanTask = function () {
    const titleInput = document.getElementById('kanban-new-title');
    const title = titleInput?.value.trim();
    if (!title) return;

    appData.studyKanban.push({
        id: Date.now(),
        title,
        subject: document.getElementById('kanban-new-subject')?.value.trim() || 'DAM',
        col: 'todo',
        pomos: parseInt(document.getElementById('kanban-new-pomos')?.value, 10) || 2,
        donePomos: 0,
        priority: document.getElementById('kanban-new-prio')?.value || 'medium'
    });

    titleInput.value = '';
    saveData();
    renderKanban();
    toggleForm('form-kanban-add');
    showToast("Tema de estudio añadido", "success");
};

window.moveKanbanTask = function (id, targetCol) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task || task.col === targetCol) return;
    task.col = targetCol;
    saveData();
    renderKanban();
};

window.incKanbanPomo = function (id) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    task.donePomos = Math.min((task.donePomos || 0) + 1, task.pomos);
    if (task.donePomos === task.pomos && task.col === 'doing') task.col = 'done';
    saveData();
    renderKanban();
};

window.linkKanbanToPomo = function (id) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    const targetEl = document.getElementById('pomodoro-target');
    if (targetEl) targetEl.textContent = `Objetivo: [${task.subject}] ${task.title}`;
    showToast(`Pomodoro vinculado a "${task.title}"`, "info");
};

window.deleteKanbanTask = function (id) {
    const idx = appData.studyKanban.findIndex(t => t.id === id);
    if (idx === -1) return;
    const removed = appData.studyKanban[idx];
    appData.studyKanban.splice(idx, 1);
    saveData();
    renderKanban();
    showToast("Tarjeta Kanban eliminada", "info", () => {
        appData.studyKanban.splice(idx, 0, removed);
        saveData();
        renderKanban();
    });
};

function setupKanbanDragAndDrop() {
    const board = document.querySelector('.kanban-board');
    if (!board) return;

    board.addEventListener('dragstart', e => {
        const card = e.target.closest('.kanban-card');
        if (!card) return;
        draggedKanbanId = Number(card.dataset.id);
        card.classList.add('kanban-dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', String(draggedKanbanId));
    });

    board.addEventListener('dragend', () => {
        document.querySelectorAll('.kanban-card.kanban-dragging').forEach(el => el.classList.remove('kanban-dragging'));
        document.querySelectorAll('.kanban-col.kanban-drop-hover').forEach(el => el.classList.remove('kanban-drop-hover'));
        draggedKanbanId = null;
    });

    board.addEventListener('dragover', e => {
        if (draggedKanbanId === null) return;
        const col = e.target.closest('.kanban-col');
        if (!col) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        document.querySelectorAll('.kanban-col.kanban-drop-hover').forEach(c => {
            if (c !== col) c.classList.remove('kanban-drop-hover');
        });
        col.classList.add('kanban-drop-hover');
    });

    board.addEventListener('drop', e => {
        if (draggedKanbanId === null) return;
        const col = e.target.closest('.kanban-col');
        if (!col) return;
        e.preventDefault();
        const targetCol = col.dataset.kanbanCol;
        const idToMove = draggedKanbanId;
        draggedKanbanId = null;
        col.classList.remove('kanban-drop-hover');
        if (targetCol) moveKanbanTask(idToMove, targetCol);
    });
}

function renderKanban() {
    const cols = ['todo', 'doing', 'done'];
    const counts = { todo: 0, doing: 0, done: 0 };

    cols.forEach(col => {
        const box = document.getElementById(`kanban-list-${col}`);
        if (!box) return;
        const items = appData.studyKanban.filter(t => t.col === col);
        counts[col] = items.length;

        if (!items.length) {
            box.innerHTML = `<div class="kanban-empty-col">Sin temas</div>`;
            return;
        }

        box.innerHTML = items.map(t => {
            const prioIcon = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟠' : '🔵';
            const prevCol = col === 'done' ? 'doing' : col === 'doing' ? 'todo' : null;
            const nextCol = col === 'todo' ? 'doing' : col === 'doing' ? 'done' : null;

            return `
                <div class="kanban-card" draggable="true" data-id="${t.id}">
                    <div class="kanban-card-header">
                        <span class="kanban-subject-tag">${escapeHtml(t.subject)}</span>
                        <span>${prioIcon}</span>
                    </div>
                    <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                    <div class="kanban-card-footer">
                        <span onclick="linkKanbanToPomo(${t.id})" style="cursor:pointer;" title="Vincular a Pomodoro">🍅 ${t.donePomos || 0}/${t.pomos}</span>
                        <div class="kanban-nav-btns">
                            ${prevCol ? `<button type="button" class="kanban-nav-btn" onclick="moveKanbanTask(${t.id}, '${prevCol}')" title="Mover atrás">←</button>` : ''}
                            <button type="button" class="kanban-nav-btn" onclick="incKanbanPomo(${t.id})" title="+1 Pomodoro">🍅+</button>
                            ${nextCol ? `<button type="button" class="kanban-nav-btn" onclick="moveKanbanTask(${t.id}, '${nextCol}')" title="Avanzar">→</button>` : ''}
                            <button type="button" class="kanban-nav-btn" onclick="deleteKanbanTask(${t.id})" title="Eliminar">✖</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    });

    const cTodo = document.getElementById('kanban-count-todo'); if (cTodo) cTodo.textContent = counts.todo;
    const cDoing = document.getElementById('kanban-count-doing'); if (cDoing) cDoing.textContent = counts.doing;
    const cDone = document.getElementById('kanban-count-done'); if (cDone) cDone.textContent = counts.done;
}

/* ----------------------------------------------------------
   CALCULADORA DE CALIFICACIONES + SIMULADOR & MEDIA GLOBAL (#19, #26)
   ---------------------------------------------------------- */
window.addGradeSubject = function () {
    const nameInput = document.getElementById('new-grade-subj-name');
    const name = nameInput?.value.trim();
    if (!name) return;
    const rawTarget = parseFloat(document.getElementById('new-grade-subj-target')?.value);
    const target = Number.isNaN(rawTarget) ? 5.0 : Math.min(10, Math.max(0, rawTarget));
    const credits = Math.max(1, parseFloat(document.getElementById('new-grade-subj-credits')?.value) || 6);

    appData.grades.push({ id: Date.now(), subject: name, target, credits, items: [] });
    nameInput.value = '';
    saveData();
    renderGradesCalculator();
    toggleForm('form-add-grade-subject');
    showToast(`Módulo "${name}" añadido`, "success");
};

window.deleteGradeSubject = function (subjId) {
    appData.grades = appData.grades.filter(g => g.id !== subjId);
    saveData();
    renderGradesCalculator();
};

window.addGradeItemPrompt = function (subjId) {
    const subj = appData.grades.find(g => g.id === subjId);
    if (!subj) return;

    const name = prompt("Nombre de la prueba / práctica / examen:");
    if (!name || !name.trim()) return;

    const rawGrade = parseFloat((prompt("Nota obtenida (0 a 10):", "7.0") || '').replace(',', '.'));
    if (Number.isNaN(rawGrade) || rawGrade < 0 || rawGrade > 10) {
        showToast("La nota debe estar entre 0 y 10", "error");
        return;
    }

    const rawWeight = parseFloat((prompt("Peso porcentual (%) en el módulo:", "20") || '').replace(',', '.'));
    if (Number.isNaN(rawWeight) || rawWeight <= 0 || rawWeight > 100) {
        showToast("El peso debe ser mayor que 0 y hasta 100%", "error");
        return;
    }

    if (!subj.items) subj.items = [];
    const currentSum = subj.items.reduce((acc, i) => acc + (parseFloat(i.weight) || 0), 0);
    if (currentSum + rawWeight > 100) {
        showToast(`Aviso: el peso total superará el 100% (${currentSum + rawWeight}%)`, "error");
    }

    subj.items.push({ id: Date.now(), name: name.trim(), grade: rawGrade, weight: rawWeight });
    saveData();
    renderGradesCalculator();
};

window.deleteGradeItem = function (subjId, itemId) {
    const subj = appData.grades.find(g => g.id === subjId);
    if (subj && subj.items) {
        subj.items = subj.items.filter(i => i.id !== itemId);
        saveData();
        renderGradesCalculator();
    }
};

function renderGradesCalculator() {
    const container = document.getElementById('grades-subjects-container');
    const globalBadge = document.getElementById('global-course-avg-badge');
    if (!container) return;

    if (!appData.grades.length) {
        if (globalBadge) globalBadge.textContent = 'Media: --';
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:12px;">Sin módulos registrados. ¡Añade tu primera asignatura!</div>`;
        return;
    }

    let totalCredits = 0;
    let weightedCourseSum = 0;

    container.innerHTML = appData.grades.map(g => {
        const items = g.items || [];
        const totalWeight = items.reduce((acc, i) => acc + (parseFloat(i.weight) || 0), 0);
        const weightedSum = items.reduce((acc, i) => acc + ((parseFloat(i.grade) || 0) * (parseFloat(i.weight) || 0)), 0);
        const currentAvgNum = totalWeight > 0 ? weightedSum / totalWeight : 0;
        const currentAvg = totalWeight > 0 ? currentAvgNum.toFixed(2) : '0.00';
        const target = g.target || 5.0;
        const credits = g.credits || 6;

        if (totalWeight > 0) {
            totalCredits += credits;
            weightedCourseSum += currentAvgNum * credits;
        }

        const isPassing = parseFloat(currentAvg) >= target;
        const percentProgress = Math.min(Math.round((parseFloat(currentAvg) / 10) * 100), 100);

        // Simulador de nota mínima necesaria en el porcentaje restante (#19)
        const remainingWeight = Math.max(0, 100 - totalWeight);
        let neededHtml = '';
        if (remainingWeight > 0) {
            const neededAvg = ((target * 100) - weightedSum) / remainingWeight;
            if (neededAvg <= 0) {
                neededHtml = `<div class="grade-needed-banner achieved">🎯 Objetivo (${target}) ya asegurado con el resto al 0</div>`;
            } else if (neededAvg > 10) {
                neededHtml = `<div class="grade-needed-banner impossible">⚠️ Necesitarías ${neededAvg.toFixed(2)} en el ${remainingWeight}% restante (difícil/imposible)</div>`;
            } else {
                neededHtml = `<div class="grade-needed-banner">🎯 Mínimo necesario en el ${remainingWeight}% restante: <strong>${neededAvg.toFixed(2)}</strong> para ${target}</div>`;
            }
        }

        return `
            <div class="grade-subject-card">
                <div class="grade-subj-header">
                    <div>
                        <span class="grade-subj-name">${escapeHtml(g.subject)}</span>
                        <span style="font-size:0.62rem;color:var(--text-muted);margin-left:4px;">(Obj: ${target} &bull; ${credits}cr)</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span class="grade-subj-score ${isPassing ? 'score-pass' : 'score-fail'}">${currentAvg}</span>
                        <button type="button" class="btn-icon" onclick="deleteGradeSubject(${g.id})" title="Eliminar Módulo">✖</button>
                    </div>
                </div>

                ${neededHtml}

                <div class="grade-progress-bar-bg" title="Evaluado: ${totalWeight}%">
                    <div class="grade-progress-bar-fill" style="width: ${percentProgress}%;"></div>
                </div>

                <div class="grade-items-list">
                    ${items.map(i => `
                        <div class="grade-item-row">
                            <span>${escapeHtml(i.name)} (${i.weight}%)</span>
                            <div style="display:flex;gap:4px;align-items:center;">
                                <strong style="color:var(--accent-cyan);">${Number(i.grade).toFixed(1)}</strong>
                                <button type="button" class="btn-icon" onclick="deleteGradeItem(${g.id}, ${i.id})" title="Eliminar item" style="font-size:0.65rem;">✖</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button type="button" class="btn-toggle" onclick="addGradeItemPrompt(${g.id})" style="margin-top:2px;">✚ Añadir Nota / Examen (${totalWeight}% sumado)</button>
            </div>
        `;
    }).join('');

    if (globalBadge) {
        globalBadge.textContent = totalCredits > 0 ? `Media: ${(weightedCourseSum / totalCredits).toFixed(2)}` : 'Media: --';
    }
}

/* ----------------------------------------------------------
   ENTREGAS, PLANIFICADOR HASTA EXAMEN & RÚBRICAS (#22, #25, #38)
   ---------------------------------------------------------- */
let activeDeliveriesFilter = 'all';

window.calculateStudyPlan = function () {
    const dateVal = document.getElementById('planner-exam-date')?.value;
    const topics = parseInt(document.getElementById('planner-topics-count')?.value, 10) || 1;
    const minsTopic = parseInt(document.getElementById('planner-mins-topic')?.value, 10) || 30;
    const out = document.getElementById('study-planner-result');
    if (!out) return;

    if (!dateVal) {
        out.textContent = 'Selecciona una fecha de examen.';
        return;
    }
    const diffDays = Math.max(1, Math.ceil((new Date(`${dateVal}T23:59:59`).getTime() - getClockDate().getTime()) / 86400000));
    const totalMins = topics * minsTopic;
    const perDay = Math.ceil(totalMins / diffDays);
    out.textContent = `Quedan ${diffDays} días • Total: ${(totalMins / 60).toFixed(1)}h (${topics} temas) → ~${perDay} min/día.`;
};

window.setDeliveriesFilter = function (filter) {
    activeDeliveriesFilter = filter;
    ['all', 'exam', 'practice', 'pending', 'soon', 'overdue'].forEach(f => {
        document.getElementById(`deliv-filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderDeliveries();
};

window.addDelivery = function () {
    const titleInput = document.getElementById('deliv-title');
    const title = titleInput?.value.trim();
    if (!title) return;

    const subject = document.getElementById('deliv-subject')?.value.trim() || 'General';
    const type = document.getElementById('deliv-type')?.value || 'Práctica';
    const dueDate = document.getElementById('deliv-datetime')?.value;
    const alertMins = parseInt(document.getElementById('deliv-alert-mins')?.value, 10) || 0;

    if (!dueDate || Number.isNaN(new Date(dueDate).getTime())) {
        showToast("Selecciona una fecha y hora válida", "error");
        return;
    }

    appData.deliveries.push({
        id: Date.now(),
        title,
        subject,
        type,
        dueDate,
        alertMins,
        notified: false,
        done: false,
        rubric: []
    });

    requestNotificationPermission();
    titleInput.value = '';
    saveData();
    renderDeliveries();
    toggleForm('form-add-delivery');
    showToast("Fecha límite guardada", "success");
};

window.addDeliveryRubricItem = function (id) {
    const d = appData.deliveries.find(x => x.id === id);
    if (!d) return;
    const req = prompt("Requisito de la entrega/rúbrica (ej: subir repo, PDF memoria):");
    if (!req || !req.trim()) return;
    if (!Array.isArray(d.rubric)) d.rubric = [];
    d.rubric.push({ text: req.trim(), done: false });
    saveData();
    renderDeliveries();
};

window.toggleDeliveryRubricItem = function (delivId, idx) {
    const d = appData.deliveries.find(x => x.id === delivId);
    if (d && d.rubric && d.rubric[idx]) {
        d.rubric[idx].done = !d.rubric[idx].done;
        saveData();
        renderDeliveries();
    }
};

window.toggleDeliveryDone = function (id) {
    const deliv = appData.deliveries.find(d => d.id === id);
    if (!deliv) return;
    deliv.done = !deliv.done;
    saveData();
    renderDeliveries();
};

window.deleteDelivery = function (id) {
    const idx = appData.deliveries.findIndex(d => d.id === id);
    if (idx === -1) return;
    const removed = appData.deliveries[idx];
    appData.deliveries.splice(idx, 1);
    saveData();
    renderDeliveries();
    showToast("Entrega eliminada", "info", () => {
        appData.deliveries.splice(idx, 0, removed);
        saveData();
        renderDeliveries();
    });
};

function formatCountdown(targetIsoDate) {
    const now = getClockDate().getTime();
    const target = new Date(targetIsoDate).getTime();
    const diff = target - now;

    if (isNaN(target)) return { text: '--', badgeClass: 'cd-ok', diff: Infinity };
    if (diff < 0) {
        const passedHrs = Math.floor(Math.abs(diff) / 3600000);
        return { text: `⚠️ Vencido (${passedHrs}h)`, badgeClass: 'cd-urgent', diff };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days === 0 && hours < 5) return { text: `🔥 ¡${hours}h ${mins}m!`, badgeClass: 'cd-urgent', diff };
    if (days < 2) return { text: `⏳ ${days}d ${hours}h`, badgeClass: 'cd-warn', diff };
    return { text: `📅 ${days}d ${hours}h`, badgeClass: 'cd-ok', diff };
}

function updateDeliveriesCountdown() {
    const nowMs = getClockDate().getTime();
    document.querySelectorAll('.deadline-countdown-badge').forEach(el => {
        const dateIso = el.getAttribute('data-due');
        const isDone = el.getAttribute('data-done') === 'true';
        if (isDone) return;
        const res = formatCountdown(dateIso);
        el.textContent = res.text;
        el.className = `countdown-badge deadline-countdown-badge ${res.badgeClass}`;
    });

    // Alerta nativa programable (#38)
    (appData.deliveries || []).forEach(d => {
        if (!d.done && !d.notified && d.alertMins > 0) {
            const minsLeft = (new Date(d.dueDate).getTime() - nowMs) / 60000;
            if (minsLeft > 0 && minsLeft <= d.alertMins) {
                d.notified = true;
                sendDesktopNotification(`⏳ Próxima entrega: ${d.title}`, `${d.subject} — faltan ${Math.ceil(minsLeft)} minutos.`);
                saveData();
            }
        }
    });
}

function renderDeliveries() {
    const container = document.getElementById('deliveries-list');
    if (!container) return;

    const nowMs = getClockDate().getTime();
    let items = [...(appData.deliveries || [])];

    if (activeDeliveriesFilter === 'exam') items = items.filter(d => d.type === 'Examen');
    else if (activeDeliveriesFilter === 'practice') items = items.filter(d => d.type === 'Práctica');
    else if (activeDeliveriesFilter === 'pending') items = items.filter(d => !d.done);
    else if (activeDeliveriesFilter === 'soon') {
        items = items.filter(d => {
            const diff = new Date(d.dueDate).getTime() - nowMs;
            return !d.done && diff >= 0 && diff <= 48 * 3600000;
        });
    } else if (activeDeliveriesFilter === 'overdue') {
        items = items.filter(d => !d.done && new Date(d.dueDate).getTime() < nowMs);
    }

    items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (!items.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:12px;">No hay entregas en esta vista.</div>`;
        return;
    }

    container.innerHTML = items.map(d => {
        const cd = formatCountdown(d.dueDate);
        const formattedDate = new Date(d.dueDate).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
        const rubric = Array.isArray(d.rubric) ? d.rubric : [];

        return `
            <div class="deadline-card-item">
                <div class="deadline-card-top">
                    <div class="deadline-info" onclick="toggleDeliveryDone(${d.id})" style="cursor:pointer;">
                        <div class="deadline-title" style="${d.done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">
                            ${d.done ? '✅' : '⏳'} ${escapeHtml(d.title)}
                        </div>
                        <div class="deadline-meta">
                            <span style="color:var(--accent-cyan);">${escapeHtml(d.subject)}</span>
                            <span>&bull;</span>
                            <span>${formattedDate}</span>
                        </div>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <button type="button" class="btn-icon" onclick="addDeliveryRubricItem(${d.id})" title="Añadir requisito de rúbrica (#25)">☑️+</button>
                        <span class="countdown-badge deadline-countdown-badge ${d.done ? 'cd-done' : cd.badgeClass}"
                              data-due="${escapeHtml(d.dueDate)}"
                              data-done="${d.done}">${d.done ? 'Completado' : cd.text}</span>
                        <button type="button" class="btn-icon" onclick="deleteDelivery(${d.id})" title="Eliminar">✖</button>
                    </div>
                </div>
                ${rubric.length ? `
                    <div class="deliv-rubric-box">
                        ${rubric.map((r, i) => `
                            <span class="rubric-chip ${r.done ? 'done' : ''}" onclick="toggleDeliveryRubricItem(${d.id}, ${i})">
                                ${r.done ? '☑' : '☐'} ${escapeHtml(r.text)}
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

/* ----------------------------------------------------------
   STUDY HUB: FLASHCARDS, BUG LOG, DUDAS & MARKDOWN (#20, #23, #24, #33)
   ---------------------------------------------------------- */
window.setStudyHubTab = function (tab) {
    ['flashcards', 'bugs', 'doubts'].forEach(t => {
        document.getElementById(`hub-tab-${t}`)?.classList.toggle('active', t === tab);
        const view = document.getElementById(`hub-view-${t}`);
        if (view) view.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'flashcards') renderFlashcards();
    if (tab === 'bugs') renderBugLogs();
    if (tab === 'doubts') renderClassDoubts();
};

function getFilteredFlashcards() {
    const subj = document.getElementById('fc-filter-subject')?.value || 'all';
    const cards = appData.flashcards || [];
    return subj === 'all' ? cards : cards.filter(c => c.subject === subj);
}

window.addFlashcard = function () {
    const subject = document.getElementById('fc-new-subj')?.value.trim() || 'General';
    const q = document.getElementById('fc-new-q')?.value.trim();
    const a = document.getElementById('fc-new-a')?.value.trim();
    if (!q || !a) return;

    if (!Array.isArray(appData.flashcards)) appData.flashcards = [];
    appData.flashcards.push({ id: Date.now(), subject, q, a, mastered: false });
    document.getElementById('fc-new-q').value = '';
    document.getElementById('fc-new-a').value = '';
    isFlashcardFlipped = false;
    saveData();
    renderFlashcards();
    toggleForm('form-add-flashcard');
    showToast("Flashcard añadida", "success");
};

window.flipCurrentFlashcard = function () {
    isFlashcardFlipped = !isFlashcardFlipped;
    renderFlashcards();
};

window.nextFlashcard = function () {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % list.length;
    isFlashcardFlipped = false;
    renderFlashcards();
};

window.markFlashcardStatus = function (mastered) {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    const card = list[currentFlashcardIndex % list.length];
    if (card) card.mastered = mastered;
    isFlashcardFlipped = false;
    currentFlashcardIndex = (currentFlashcardIndex + 1) % list.length;
    saveData();
    renderFlashcards();
};

window.deleteCurrentFlashcard = function () {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    const target = list[currentFlashcardIndex % list.length];
    appData.flashcards = (appData.flashcards || []).filter(c => c.id !== target.id);
    currentFlashcardIndex = 0;
    isFlashcardFlipped = false;
    saveData();
    renderFlashcards();
};

function renderFlashcards() {
    const sel = document.getElementById('fc-filter-subject');
    const stage = document.getElementById('flashcard-stage');
    if (!stage) return;

    const allCards = appData.flashcards || [];
    if (sel) {
        const cur = sel.value;
        const subjects = [...new Set(allCards.map(c => c.subject))];
        sel.innerHTML = `<option value="all">Todas (${allCards.length})</option>` +
            subjects.map(s => `<option value="${escapeHtml(s)}" ${s === cur ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    }

    const list = getFilteredFlashcards();
    if (!list.length) {
        stage.innerHTML = `<div class="fc-hint">Sin flashcards en este filtro. Añade una nueva abajo.</div>`;
        return;
    }

    const card = list[currentFlashcardIndex % list.length];
    stage.innerHTML = `
        <div style="font-size:0.62rem;color:var(--accent-cyan);margin-bottom:4px;">[${escapeHtml(card.subject)}] ${card.mastered ? '✅ Dominada' : '🔄 Por repasar'} (${(currentFlashcardIndex % list.length) + 1}/${list.length})</div>
        <div class="${isFlashcardFlipped ? 'fc-answer-text' : 'fc-question-text'}">${escapeHtml(isFlashcardFlipped ? card.a : card.q)}</div>
        <div class="fc-hint" style="margin-top:6px;">Haz clic para ${isFlashcardFlipped ? 'ver pregunta' : 'revelar respuesta'}</div>
    `;
}

window.addBugLog = function () {
    const subject = document.getElementById('bug-new-subj')?.value.trim() || 'Dev';
    const errorMsg = document.getElementById('bug-new-error')?.value.trim();
    const cause = document.getElementById('bug-new-cause')?.value.trim() || '-';
    const fix = document.getElementById('bug-new-fix')?.value.trim() || '-';
    if (!errorMsg) return;

    if (!Array.isArray(appData.bugLogs)) appData.bugLogs = [];
    appData.bugLogs.unshift({ id: Date.now(), subject, errorMsg, cause, fix });
    ['bug-new-error', 'bug-new-cause', 'bug-new-fix'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    saveData();
    renderBugLogs();
    toggleForm('form-add-bug');
    showToast("Bug registrado en Post-Mortem", "success");
};

window.deleteBugLog = function (id) {
    appData.bugLogs = (appData.bugLogs || []).filter(b => b.id !== id);
    saveData();
    renderBugLogs();
};

function renderBugLogs() {
    const box = document.getElementById('bug-log-list');
    if (!box) return;
    const q = document.getElementById('bug-search-input')?.value.toLowerCase().trim() || '';
    let list = appData.bugLogs || [];
    if (q) {
        list = list.filter(b => `${b.subject} ${b.errorMsg} ${b.cause} ${b.fix}`.toLowerCase().includes(q));
    }
    if (!list.length) {
        box.innerHTML = `<div class="fc-hint" style="padding:8px;">Sin errores registrados.</div>`;
        return;
    }
    box.innerHTML = list.map(b => `
        <div class="hub-item-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong style="color:var(--accent-red);">[${escapeHtml(b.subject)}] ${escapeHtml(b.errorMsg)}</strong>
                <button type="button" class="btn-icon" onclick="deleteBugLog(${b.id})">✖</button>
            </div>
            <div style="color:var(--text-muted);font-size:0.64rem;">Causa: ${escapeHtml(b.cause)}</div>
            <div style="color:var(--accent-green);font-size:0.64rem;">Solución: ${escapeHtml(b.fix)}</div>
        </div>
    `).join('');
}

window.addClassDoubt = function () {
    const subj = document.getElementById('doubt-new-subj')?.value.trim() || 'Clase';
    const input = document.getElementById('doubt-new-text');
    const text = input?.value.trim();
    if (!text) return;

    if (!Array.isArray(appData.classDoubts)) appData.classDoubts = [];
    appData.classDoubts.unshift({ id: Date.now(), subject, text, resolved: false });
    input.value = '';
    saveData();
    renderClassDoubts();
};

window.toggleClassDoubt = function (id) {
    const d = (appData.classDoubts || []).find(x => x.id === id);
    if (!d) return;
    d.resolved = !d.resolved;
    saveData();
    renderClassDoubts();
};

window.deleteClassDoubt = function (id) {
    appData.classDoubts = (appData.classDoubts || []).filter(x => x.id !== id);
    saveData();
    renderClassDoubts();
};

function renderClassDoubts() {
    const box = document.getElementById('doubts-list');
    if (!box) return;
    const list = appData.classDoubts || [];
    if (!list.length) {
        box.innerHTML = `<div class="fc-hint" style="padding:8px;">Sin dudas anotadas para el profesor.</div>`;
        return;
    }
    box.innerHTML = list.map(d => `
        <div class="hub-item-card" style="flex-direction:row;justify-content:space-between;align-items:center;">
            <span onclick="toggleClassDoubt(${d.id})" style="cursor:pointer;${d.resolved ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">
                ${d.resolved ? '✅' : '❓'} <strong>[${escapeHtml(d.subject)}]</strong> ${escapeHtml(d.text)}
            </span>
            <button type="button" class="btn-icon" onclick="deleteClassDoubt(${d.id})">✖</button>
        </div>
    `).join('');
}

window.exportStudyHubMarkdown = function () {
    const md = [
        '# Bug Log & Dudas de Clase',
        '## Bug Log',
        ...(appData.bugLogs || []).map(b => `- **[${b.subject}] ${b.errorMsg}**: Causa: ${b.cause} | Fix: ${b.fix}`),
        '## Dudas para Clase',
        ...(appData.classDoubts || []).map(d => `- [${d.resolved ? 'x' : ' '}] **[${d.subject}]** ${d.text}`)
    ].join('\n');
    navigator.clipboard?.writeText(md).then(() => showToast("📤 Bug Log y Dudas copiados en Markdown", "success"));
};

/* ----------------------------------------------------------
   PROYECTOS EN EQUIPO (#30)
   ---------------------------------------------------------- */
window.addTeamProject = function () {
    const name = document.getElementById('proj-new-name')?.value.trim();
    if (!name) return;
    let repo = document.getElementById('proj-new-repo')?.value.trim() || '';
    if (repo && !/^https?:\/\//i.test(repo)) repo = 'https://' + repo;
    const working = document.getElementById('proj-new-working')?.value.trim() || 'En curso';
    const pending = document.getElementById('proj-new-pending')?.value.trim() || 'Por definir';

    if (!Array.isArray(appData.teamProjects)) appData.teamProjects = [];
    appData.teamProjects.push({ id: Date.now(), name, repo, working, pending });
    ['proj-new-name', 'proj-new-repo', 'proj-new-working', 'proj-new-pending'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    saveData();
    renderTeamProjects();
    toggleForm('form-add-project');
    showToast("Proyecto registrado", "success");
};

window.deleteTeamProject = function (id) {
    appData.teamProjects = (appData.teamProjects || []).filter(p => p.id !== id);
    saveData();
    renderTeamProjects();
};

function renderTeamProjects() {
    const box = document.getElementById('team-projects-list');
    if (!box) return;
    const list = appData.teamProjects || [];
    if (!list.length) {
        box.innerHTML = `<div class="fc-hint" style="padding:8px;">Sin proyectos registrados.</div>`;
        return;
    }
    box.innerHTML = list.map(p => `
        <div class="hub-item-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>🚀 ${escapeHtml(p.name)}</strong>
                <div style="display:flex;gap:4px;align-items:center;">
                    ${p.repo ? `<a href="${escapeHtml(p.repo)}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-cyan);font-size:0.64rem;">Repo 🔗</a>` : ''}
                    <button type="button" class="btn-icon" onclick="deleteTeamProject(${p.id})">✖</button>
                </div>
            </div>
            <div style="color:var(--accent-green);font-size:0.63rem;">Funciona: ${escapeHtml(p.working)}</div>
            <div style="color:var(--accent-yellow);font-size:0.63rem;">Pendiente: ${escapeHtml(p.pending)}</div>
        </div>
    `).join('');
}

/* ----------------------------------------------------------
   TAREAS GENERALES & EXPORTACIÓN MARKDOWN (#33)
   ---------------------------------------------------------- */
let activeTaskFilter = 'all';
let activeTaskSort = 'created';

window.setTaskFilter = function (filter) {
    activeTaskFilter = filter;
    ['all', 'pending', 'done'].forEach(f => {
        document.getElementById(`filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderTasks();
};

window.setTaskSort = function (sortMode) {
    activeTaskSort = sortMode;
    renderTasks();
};

window.addTask = function () {
    const textInput = document.getElementById('task-text');
    const text = textInput?.value.trim();
    if (!text) return;

    appData.tasks.push({
        id: Date.now(),
        text,
        priority: document.getElementById('task-priority')?.value || 'medium',
        date: document.getElementById('task-date')?.value || '',
        done: false
    });

    textInput.value = '';
    saveData();
    renderTasks();
    updateStats();
};

window.toggleTask = function (id) {
    const t = appData.tasks.find(x => x.id === id);
    if (t) {
        t.done = !t.done;
        saveData();
        renderTasks();
        updateStats();
    }
};

window.deleteTask = function (id) {
    const idx = appData.tasks.findIndex(x => x.id === id);
    if (idx === -1) return;
    const removed = appData.tasks[idx];
    appData.tasks.splice(idx, 1);
    saveData();
    renderTasks();
    updateStats();
    showToast("Tarea eliminada", "info", () => {
        appData.tasks.splice(idx, 0, removed);
        saveData();
        renderTasks();
        updateStats();
    });
};

window.exportTasksMarkdown = function () {
    const md = '# Tareas\n' + (appData.tasks || []).map(t =>
        `- [${t.done ? 'x' : ' '}] **${t.text}** (${t.priority}${t.date ? ` • ${t.date}` : ''})`
    ).join('\n');
    navigator.clipboard?.writeText(md).then(() => showToast("📤 Tareas copiadas en Markdown", "success"));
};

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    let items = [...(appData.tasks || [])];
    if (activeTaskFilter === 'pending') items = items.filter(t => !t.done);
    else if (activeTaskFilter === 'done') items = items.filter(t => t.done);

    const prioWeight = { high: 0, medium: 1, low: 2 };
    if (activeTaskSort === 'priority') {
        items.sort((a, b) => (prioWeight[a.priority] ?? 1) - (prioWeight[b.priority] ?? 1) || b.id - a.id);
    } else if (activeTaskSort === 'date') {
        items.sort((a, b) => {
            if (!a.date && !b.date) return b.id - a.id;
            if (!a.date) return 1;
            if (!b.date) return -1;
            return a.date.localeCompare(b.date);
        });
    } else {
        items.sort((a, b) => b.id - a.id);
    }

    if (!items.length) {
        list.innerHTML = `<li style="justify-content:center;color:var(--text-muted);font-size:0.72rem;">Sin tareas en esta vista</li>`;
        return;
    }

    list.innerHTML = items.map(t => {
        const prioTag = t.priority === 'high' ? '🔴' : t.priority === 'medium' ? '🟠' : '🔵';
        return `
            <li class="${t.done ? 'task-done' : ''}">
                <span onclick="toggleTask(${t.id})" style="cursor:pointer;flex:1;display:flex;align-items:center;gap:4px;">
                    ${t.done ? '✅' : '⬜'}
                    <span>${escapeHtml(t.text)}</span>
                    ${t.date ? `<span style="font-size:0.6rem;color:var(--text-dim);font-family:var(--font-mono);">${escapeHtml(t.date)}</span>` : ''}
                </span>
                <div style="display:flex;align-items:center;gap:4px;">
                    <span style="font-size:0.65rem;">${prioTag}</span>
                    <button type="button" onclick="deleteTask(${t.id})" class="btn-icon" title="Eliminar">✖</button>
                </div>
            </li>
        `;
    }).join('');
}

/* ----------------------------------------------------------
   SCRATCHPAD: MARKDOWN PREVIEW, BUSCAR/REEMPLAZAR, HISTORIAL & PLANTILLAS (#27, #28, #29, #34)
   ---------------------------------------------------------- */
function updateNotesMetrics(text) {
    const el = document.getElementById('scratchpad-metrics');
    if (!el) return;
    const str = text || '';
    const lines = str.length ? str.split('\n').length : 0;
    el.textContent = `${lines} ${lines === 1 ? 'línea' : 'líneas'} • ${str.length} caracteres`;
}

function renderMarkdownLite(mdText) {
    const lines = String(mdText || '').split('\n');
    let inCode = false;
    let html = '';

    for (const rawLine of lines) {
        if (rawLine.trim().startsWith('```')) {
            if (!inCode) {
                inCode = true;
                html += '<pre><code>';
            } else {
                inCode = false;
                html += '</code></pre>';
            }
            continue;
        }
        if (inCode) {
            html += escapeHtml(rawLine) + '\n';
            continue;
        }
        let line = escapeHtml(rawLine);
        if (line.startsWith('### ')) line = `<h3>${line.slice(4)}</h3>`;
        else if (line.startsWith('## ')) line = `<h2>${line.slice(3)}</h2>`;
        else if (line.startsWith('# ')) line = `<h1>${line.slice(2)}</h1>`;
        else if (line.startsWith('- ')) line = `• ${line.slice(2)}`;

        line = line
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>');

        html += line + '<br>';
    }
    if (inCode) html += '</code></pre>';
    return html || '<span style="color:var(--text-muted);">Sin contenido para previsualizar.</span>';
}

window.toggleScratchpadPreview = function () {
    isScratchpadPreview = !isScratchpadPreview;
    const ta = document.getElementById('scratchpad');
    const prev = document.getElementById('scratchpad-preview');
    const btn = document.getElementById('btn-notes-preview');
    if (ta && prev) {
        ta.style.display = isScratchpadPreview ? 'none' : 'block';
        prev.style.display = isScratchpadPreview ? 'block' : 'none';
        if (isScratchpadPreview) prev.innerHTML = renderMarkdownLite(ta.value);
    }
    if (btn) btn.classList.toggle('active', isScratchpadPreview);
};

window.toggleScratchpadFind = function () {
    toggleForm('scratchpad-find-bar');
};

window.replaceInScratchpad = function (all) {
    const ta = document.getElementById('scratchpad');
    const findVal = document.getElementById('sp-find-text')?.value;
    const replVal = document.getElementById('sp-replace-text')?.value ?? '';
    if (!ta || !findVal) return;

    if (all) {
        ta.value = ta.value.split(findVal).join(replVal);
    } else {
        ta.value = ta.value.replace(findVal, replVal);
    }
    const tabKey = appData.activeNotesTab || 'general';
    appData.notes[tabKey] = ta.value;
    updateNotesMetrics(ta.value);
    saveData();
    showToast("Reemplazo aplicado", "success");
};

window.insertNoteTemplate = function (key) {
    const templates = {
        clase: "## Apuntes de Clase\n- **Tema:** \n- **Conceptos clave:** \n- **Dudas:** \n",
        comando: "## Ficha de Comando\n```bash\ncomando -flag argumento\n```\n- **Qué hace:** \n",
        practica: "## Análisis de Práctica\n- **Objetivo:** \n- **Pasos:** \n- **Pruebas / Capturas:** \n",
        readme: "# Nombre del Proyecto\nDescripción breve.\n\n## Instalación y Uso\n```bash\n\n```\n"
    };
    if (templates[key]) {
        insertAtCursor(document.getElementById('scratchpad'), templates[key]);
    }
};

window.openNoteHistoryModal = function () {
    const tabKey = appData.activeNotesTab || 'general';
    const hist = (appData.noteHistory && appData.noteHistory[tabKey]) || [];
    const box = document.getElementById('snapshots-list-container');
    if (!box) return;
    box.innerHTML = hist.length ? hist.map((h, i) => `
        <div class="hub-item-card">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <strong>Versión #${i + 1} (${escapeHtml(tabKey)}) • ${escapeHtml(h.time)}</strong>
                <button type="button" class="btn-cyan" onclick="applyNoteVersion('${tabKey}', ${i})">Cargar</button>
            </div>
            <pre style="font-size:0.62rem;color:var(--text-muted);white-space:pre-wrap;max-height:50px;overflow:hidden;">${escapeHtml(h.text)}</pre>
        </div>
    `).join('') : `<div class="modal-hint">Aún no hay historial guardado en esta pestaña.</div>`;
    const m = document.getElementById('snapshots-modal');
    if (m) m.style.display = 'flex';
};

window.applyNoteVersion = function (tabKey, idx) {
    const h = appData.noteHistory?.[tabKey]?.[idx];
    if (!h) return;
    appData.notes[tabKey] = h.text;
    setNotesTab(tabKey);
    saveData();
    closeSnapshotsModal();
    showToast("Versión de nota recuperada", "success");
};

window.setNotesTab = function (tabKey) {
    appData.activeNotesTab = tabKey;
    ['general', 'comandos', 'clases'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tabKey);
    });
    const textarea = document.getElementById('scratchpad');
    const content = (appData.notes && appData.notes[tabKey]) || '';
    if (textarea) textarea.value = content;
    if (isScratchpadPreview) {
        const prev = document.getElementById('scratchpad-preview');
        if (prev) prev.innerHTML = renderMarkdownLite(content);
    }
    updateNotesMetrics(content);
    saveData();
};

function insertAtCursor(textarea, snippet) {
    if (!textarea) return;
    if (isScratchpadPreview) toggleScratchpadPreview();
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    textarea.value = textarea.value.slice(0, start) + snippet + textarea.value.slice(end);
    const nextPos = start + snippet.length;
    textarea.focus();
    textarea.setSelectionRange(nextPos, nextPos);

    const tabKey = appData.activeNotesTab || 'general';
    if (!appData.notes) appData.notes = {};
    appData.notes[tabKey] = textarea.value;
    updateNotesMetrics(textarea.value);
    saveData();
}

window.insertNoteTimestamp = function () {
    insertAtCursor(document.getElementById('scratchpad'), `[${getClockDate().toLocaleString('es-ES')}] `);
};

window.insertNoteCodeBlock = function () {
    insertAtCursor(document.getElementById('scratchpad'), "```\n\n```");
};

window.toolCopy = function () {
    const textarea = document.getElementById('scratchpad');
    if (!textarea) return;
    navigator.clipboard?.writeText(textarea.value)
        .then(() => showToast("📋 Notas copiadas al portapapeles", "success"))
        .catch(() => showToast("No se pudo copiar al portapapeles", "error"));
};

window.toolDownload = function () {
    const tabKey = appData.activeNotesTab || 'general';
    const text = (appData.notes && appData.notes[tabKey]) || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `DevWorkspace_Notas_${tabKey}.md`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("💾 Notas descargadas (.md)", "success");
};

window.copyStickyNote = function () {
    const el = document.getElementById('sticky-note-input');
    if (!el || !el.value) return;
    navigator.clipboard?.writeText(el.value).then(() => showToast("📌 Buffer temporal copiado", "success"));
};

window.clearStickyNote = function () {
    const el = document.getElementById('sticky-note-input');
    if (el) el.value = '';
    appData.stickyNote = '';
    saveData();
    showToast("🗑️ Buffer limpiado", "info");
};

function setupNotesAutoSave() {
    const scratchpad = document.getElementById('scratchpad');
    if (scratchpad) {
        scratchpad.addEventListener('input', e => {
            updateNotesMetrics(e.target.value);
            if (isScratchpadPreview) {
                const prev = document.getElementById('scratchpad-preview');
                if (prev) prev.innerHTML = renderMarkdownLite(e.target.value);
            }
            debouncedSaveScratchpad(e.target.value);
        });
    }

    const sticky = document.getElementById('sticky-note-input');
    if (sticky) {
        sticky.value = appData.stickyNote || '';
        sticky.addEventListener('input', debounce(e => {
            appData.stickyNote = e.target.value;
            saveData();
        }, 400));
    }
}

const debouncedSaveScratchpad = debounce(value => {
    const tabKey = appData.activeNotesTab || 'general';
    if (!appData.notes) appData.notes = {};
    appData.notes[tabKey] = value;

    // Guardar versión en historial si cambia significativamente (#29)
    if (!appData.noteHistory) appData.noteHistory = { general: [], comandos: [], clases: [] };
    const hist = appData.noteHistory[tabKey] || [];
    const last = hist[0];
    if (!last || last.text !== value) {
        hist.unshift({ time: getClockDate().toLocaleTimeString('es-ES'), text: value });
        appData.noteHistory[tabKey] = hist.slice(0, 8);
    }
    saveData();
}, 600);

/* ----------------------------------------------------------
   RESUMEN AUTOMÁTICO DE JORNADA (#32)
   ---------------------------------------------------------- */
window.generateDailySummaryModal = function () {
    const doneTasks = (appData.tasks || []).filter(t => t.done).map(t => `- [x] ${t.text}`);
    const pendingDelivs = (appData.deliveries || []).filter(d => !d.done).slice(0, 5).map(d => `- ${d.title} (${d.subject})`);
    const md = [
        `# Resumen de Jornada — ${getTodayIso()}`,
        `- **Tiempo de foco hoy:** ${appData.studyStats.todayFocusMinutes || 0} min`,
        `- **Racha actual:** ${appData.studyStats.streakDays || 0} días`,
        `## Tareas completadas`,
        ...(doneTasks.length ? doneTasks : ['- Ninguna registrada hoy']),
        `## Próximas entregas / exámenes`,
        ...(pendingDelivs.length ? pendingDelivs : ['- Sin entregas pendientes'])
    ].join('\n');

    const ta = document.getElementById('daily-summary-output');
    if (ta) ta.value = md;
    const m = document.getElementById('daily-summary-modal');
    if (m) m.style.display = 'flex';
};

window.closeDailySummaryModal = function () {
    const m = document.getElementById('daily-summary-modal');
    if (m) m.style.display = 'none';
};

/* ----------------------------------------------------------
   MÉTRICAS, RACHA, HISTÓRICO & GRÁFICO DE ESTUDIO
   ---------------------------------------------------------- */
function getTodayIso() {
    return getClockDate().toISOString().slice(0, 10);
}

function daysBetweenIso(isoA, isoB) {
    const a = new Date(`${isoA}T00:00:00Z`).getTime();
    const b = new Date(`${isoB}T00:00:00Z`).getTime();
    if (Number.isNaN(a) || Number.isNaN(b)) return null;
    return Math.round((b - a) / 86400000);
}

function recordStudyMinutes(mins) {
    if (!mins || mins <= 0) return;
    const stats = appData.studyStats;
    const todayIso = getTodayIso();

    if (stats.lastDate && stats.lastDate !== todayIso) {
        const diffDays = daysBetweenIso(stats.lastDate, todayIso);
        if (diffDays === 1) stats.streakDays = (stats.streakDays || 0) + 1;
        else if (diffDays > 1) stats.streakDays = 1;
        stats.todayFocusMinutes = 0;
    } else if (!stats.streakDays) {
        stats.streakDays = 1;
    }

    stats.lastDate = todayIso;
    stats.todayFocusMinutes = (stats.todayFocusMinutes || 0) + mins;
    stats.totalFocusMinutes = (stats.totalFocusMinutes || 0) + mins;

    if (!Array.isArray(stats.history)) stats.history = [];
    const entry = stats.history.find(h => h.date === todayIso);
    if (entry) entry.minutes = (entry.minutes || 0) + mins;
    else stats.history.push({ date: todayIso, minutes: mins });
    stats.history = stats.history.sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
}

function updateStats() {
    const statToday = document.getElementById('stat-focus-today');
    if (statToday) statToday.textContent = `${appData.studyStats.todayFocusMinutes || 0}m`;

    const statTotal = document.getElementById('stat-focus-total');
    if (statTotal) statTotal.textContent = `${((appData.studyStats.totalFocusMinutes || 0) / 60).toFixed(1)}h`;

    const statStreak = document.getElementById('stat-streak');
    if (statStreak) statStreak.textContent = `🔥 ${appData.studyStats.streakDays || 0}d`;

    const statRatio = document.getElementById('stat-ratio');
    if (statRatio) {
        const tasks = appData.tasks || [];
        const completed = tasks.filter(t => t.done).length;
        statRatio.textContent = `${tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0}%`;
    }
    renderStudyChart();
}

function renderStudyChart() {
    const container = document.getElementById('study-bars-container');
    const sumEl = document.getElementById('chart-week-sum');
    if (!container) return;

    const history = appData.studyStats.history || [];
    const last7Days = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const baseMs = getClockDate().getTime();

    let weekSum = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date(baseMs - 86400000 * i);
        const iso = d.toISOString().slice(0, 10);
        const mins = i === 0
            ? (appData.studyStats.todayFocusMinutes || 0)
            : (history.find(h => h.date === iso)?.minutes || 0);
        weekSum += mins;
        last7Days.push({ label: dayNames[d.getDay()], minutes: mins, iso });
    }

    if (sumEl) sumEl.textContent = `${weekSum} min`;
    const maxMins = Math.max(...last7Days.map(d => d.minutes), 60);

    container.innerHTML = last7Days.map(d => {
        const heightPct = d.minutes > 0 ? Math.max(Math.round((d.minutes / maxMins) * 100), 8) : 4;
        return `
            <div class="chart-bar-col" title="${d.iso}: ${d.minutes} minutos de estudio">
                <div class="chart-bar-fill" style="height: ${heightPct}%; ${d.minutes === 0 ? 'opacity: 0.25;' : ''}"></div>
                <span class="chart-bar-day">${escapeHtml(d.label)}</span>
            </div>
        `;
    }).join('');
}

window.addManualStudyTime = function () {
    const input = document.getElementById('manual-study-mins');
    const mins = parseInt(input?.value, 10);
    if (!mins || mins <= 0) return;
    recordStudyMinutes(mins);
    input.value = '';
    saveData();
    updateStats();
    showToast(`+${mins}m registrados en tus métricas`, "success");
};

window.resetStudyStats = function () {
    if (!confirm("¿Deseas reiniciar tus métricas de estudio de hoy?")) return;
    appData.studyStats.todayFocusMinutes = 0;
    const todayIso = getTodayIso();
    if (Array.isArray(appData.studyStats.history)) {
        appData.studyStats.history = appData.studyStats.history.filter(h => h.date !== todayIso);
    }
    saveData();
    updateStats();
    showToast("Métricas de hoy reiniciadas", "info");
};

/* ----------------------------------------------------------
   POMODORO PRO & TEMPORIZADOR DE EXAMEN (#21)
   ---------------------------------------------------------- */
let pomodoroTimer = null;
let pomodoroSecondsLeft = 25 * 60;
let pomodoroMode = 'focus';
let pomodoroRunning = false;

window.startCustomPomodoro = function (mode) {
    requestNotificationPermission();
    clearInterval(pomodoroTimer);
    pomodoroMode = mode;
    const focusMins = parseInt(document.getElementById('pomo-focus-time')?.value, 10) || 25;
    const breakMins = parseInt(document.getElementById('pomo-break-time')?.value, 10) || 5;
    const durationMins = mode === 'break' ? breakMins : focusMins;

    pomodoroSecondsLeft = durationMins * 60;
    pomodoroRunning = true;
    updatePomodoroDisplay();

    pomodoroTimer = setInterval(() => {
        pomodoroSecondsLeft--;
        if (mode === 'exam' && (pomodoroSecondsLeft === 15 * 60 || pomodoroSecondsLeft === 5 * 60)) {
            const minsLeft = Math.floor(pomodoroSecondsLeft / 60);
            playNotificationChime();
            showToast(`⏰ Aviso de examen: quedan ${minsLeft} minutos`, "info");
            sendDesktopNotification("Aviso de Examen", `Quedan ${minsLeft} minutos en el temporizador.`);
        }
        if (pomodoroSecondsLeft <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroRunning = false;
            handlePomodoroComplete(mode, durationMins);
        }
        updatePomodoroDisplay();
    }, 1000);

    showToast(`⏱️ Temporizador (${mode}) iniciado`, "info");
};

window.stopPomodoro = function () {
    clearInterval(pomodoroTimer);
    pomodoroRunning = false;
    const focusMins = parseInt(document.getElementById('pomo-focus-time')?.value, 10) || 25;
    pomodoroSecondsLeft = focusMins * 60;
    updatePomodoroDisplay();
    document.title = 'DevWorkspace - Cockpit';
    showToast("Temporizador detenido", "info");
};

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSecondsLeft / 60).toString().padStart(2, '0');
    const secs = (pomodoroSecondsLeft % 60).toString().padStart(2, '0');
    const text = `${mins}:${secs}`;
    const display = document.getElementById('pomodoro-display');
    if (display) display.textContent = text;
    if (pomodoroRunning) document.title = `(${text}) DevWorkspace`;
}

function handlePomodoroComplete(mode, durationMins) {
    playNotificationChime();
    document.title = '🔔 ¡Tiempo cumplido! DevWorkspace';

    if (mode === 'focus' || mode === 'exam') {
        recordStudyMinutes(durationMins);
        saveData();
        updateStats();
        showToast(`🎉 ¡Sesión de ${durationMins}m completada!`, "success");
        sendDesktopNotification("Tiempo Completado", `Has registrado ${durationMins} minutos de estudio/práctica.`);
    } else {
        showToast("☕ ¡Break terminado!", "info");
        sendDesktopNotification("Break Finalizado", "El descanso ha terminado.");
    }
}

function playNotificationChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    } catch (_) {}
}

/* ----------------------------------------------------------
   SINTETIZADOR DE AUDIO
   ---------------------------------------------------------- */
class WebAudioSynthesizer {
    constructor() {
        this.ctx = null;
        this.source = null;
        this.gainNode = null;
        this.leftOsc = null;
        this.rightOsc = null;
        this.isPlaying = false;
    }

    init() {
        if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        if (this.ctx.state === 'suspended') this.ctx.resume();
    }

    play(type, volumePct) {
        this.init();
        this.stop();
        const gainVal = Math.max(0.01, (volumePct / 100) * 0.4);

        if (type.startsWith('binaural')) {
            const carrier = type === 'binaural-alpha' ? 200 : 150;
            const diff = type === 'binaural-alpha' ? 10 : 6;
            const merger = this.ctx.createChannelMerger(2);
            this.leftOsc = this.ctx.createOscillator();
            this.rightOsc = this.ctx.createOscillator();
            this.leftOsc.frequency.value = carrier;
            this.rightOsc.frequency.value = carrier + diff;
            this.gainNode = this.ctx.createGain();
            this.gainNode.gain.setValueAtTime(gainVal * 0.8, this.ctx.currentTime);
            this.leftOsc.connect(merger, 0, 0);
            this.rightOsc.connect(merger, 0, 1);
            merger.connect(this.gainNode);
            this.gainNode.connect(this.ctx.destination);
            this.leftOsc.start();
            this.rightOsc.start();
            this.isPlaying = true;
            this.updateVisualizerState(true);
            return;
        }

        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'brown') {
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = ((lastOut + (0.02 * white)) / 1.02) * 3.5;
                lastOut = data[i] / 3.5;
            }
        } else if (type === 'pink') {
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
                b6 = white * 0.115926;
            }
        } else if (type === 'rain') {
            let last = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (last + (0.04 * white)) / 1.04;
                last = data[i];
                if (Math.random() < 0.002) data[i] += (Math.random() - 0.5) * 0.8;
                data[i] *= 2.2;
            }
        } else {
            for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        }

        this.source = this.ctx.createBufferSource();
        this.source.buffer = buffer;
        this.source.loop = true;
        this.gainNode = this.ctx.createGain();
        this.gainNode.gain.setValueAtTime(gainVal, this.ctx.currentTime);
        this.source.connect(this.gainNode);
        this.gainNode.connect(this.ctx.destination);
        this.source.start();
        this.isPlaying = true;
        this.updateVisualizerState(true);
    }

    stop() {
        [this.source, this.leftOsc, this.rightOsc, this.gainNode].forEach(node => {
            if (node) {
                try { if (typeof node.stop === 'function') node.stop(); } catch (_) {}
                try { node.disconnect(); } catch (_) {}
            }
        });
        this.source = this.leftOsc = this.rightOsc = this.gainNode = null;
        this.isPlaying = false;
        this.updateVisualizerState(false);
    }

    setVolume(pct) {
        if (this.gainNode && this.ctx) {
            this.gainNode.gain.setValueAtTime(Math.max(0.01, (pct / 100) * 0.4), this.ctx.currentTime);
        }
    }

    updateVisualizerState(active) {
        document.getElementById('audio-visualizer')?.classList.toggle('audio-playing', active);
    }
}

const synth = new WebAudioSynthesizer();

window.toggleNoiseGenerator = function () {
    const btn = document.getElementById('btn-audio-toggle');
    const type = document.getElementById('audio-sound-type')?.value || 'brown';
    const vol = parseInt(document.getElementById('audio-volume')?.value, 10) || 40;
    if (synth.isPlaying) {
        synth.stop();
        if (btn) btn.textContent = '▶ Play';
    } else {
        synth.play(type, vol);
        if (btn) btn.textContent = '⏹ Stop';
    }
};

window.handleAudioTypeChange = function (val) {
    if (synth.isPlaying) synth.play(val, parseInt(document.getElementById('audio-volume')?.value, 10) || 40);
};

window.updateAudioVolume = function (val) {
    const lbl = document.getElementById('audio-vol-text');
    if (lbl) lbl.textContent = `${val}%`;
    synth.setVolume(val);
};

window.setAudioVolumePreset = function (pct) {
    const slider = document.getElementById('audio-volume');
    if (slider) slider.value = pct;
    updateAudioVolume(pct);
};

/* ----------------------------------------------------------
   DEV & SYSADMIN TOOLBOX (#1 al #13, #16, #17)
   ---------------------------------------------------------- */
window.setToolboxTab = function (tab) {
    ['format', 'encode', 'regex', 'net', 'sys', 'gen', 'ref'].forEach(t => {
        document.getElementById(`tb-tab-${t}`)?.classList.toggle('active', t === tab);
        const v = document.getElementById(`tb-view-${t}`);
        if (v) v.style.display = t === tab ? 'block' : 'none';
    });
    if (tab === 'ref') renderQuickRefList();
    if (tab === 'sys') { updateChmodCalc(); explainCronExpr(); }
};

window.tbFormatJson = function (minify) {
    const ta = document.getElementById('tb-json-input');
    const st = document.getElementById('tb-json-status');
    if (!ta || !st) return;
    try {
        const parsed = JSON.parse(ta.value);
        ta.value = JSON.stringify(parsed, null, minify ? 0 : 2);
        st.textContent = minify ? '✅ JSON minificado' : '✅ JSON válido y formateado';
        st.style.color = 'var(--accent-green)';
    } catch (e) {
        st.textContent = `❌ JSON inválido: ${e.message}`;
        st.style.color = 'var(--accent-red)';
    }
};

window.tbJsonToCsv = function () {
    const ta = document.getElementById('tb-json-input');
    const st = document.getElementById('tb-json-status');
    try {
        const arr = JSON.parse(ta.value);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Debe ser un array de objetos no vacío');
        const headers = Object.keys(arr[0]);
        const rows = arr.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
        ta.value = [headers.join(','), ...rows].join('\n');
        st.textContent = '✅ Convertido JSON → CSV';
        st.style.color = 'var(--accent-green)';
    } catch (e) {
        st.textContent = `❌ ${e.message}`;
        st.style.color = 'var(--accent-red)';
    }
};

window.tbCsvToJson = function () {
    const ta = document.getElementById('tb-json-input');
    const st = document.getElementById('tb-json-status');
    try {
        const lines = ta.value.trim().split('\n').filter(Boolean);
        if (lines.length < 2) throw new Error('Se requiere cabecera y al menos una fila');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result = lines.slice(1).map(l => {
            const cols = l.split(',').map(c => c.trim().replace(/^"|"$/g, ''));
            const obj = {};
            headers.forEach((h, i) => { obj[h] = cols[i] ?? ''; });
            return obj;
        });
        ta.value = JSON.stringify(result, null, 2);
        st.textContent = '✅ Convertido CSV → JSON';
        st.style.color = 'var(--accent-green)';
    } catch (e) {
        st.textContent = `❌ ${e.message}`;
        st.style.color = 'var(--accent-red)';
    }
};

window.tbFormatSql = function () {
    const ta = document.getElementById('tb-json-input');
    if (!ta) return;
    ta.value = ta.value
        .replace(/\b(SELECT|FROM|WHERE|AND|OR|INNER JOIN|LEFT JOIN|GROUP BY|ORDER BY|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM)\b/gi, '\n$1')
        .trim();
    showToast("SQL formateado", "info");
};

window.tbEncodeAction = function (mode) {
    const input = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    if (!out) return;
    try {
        if (mode === 'b64e') out.textContent = btoa(unescape(encodeURIComponent(input)));
        else if (mode === 'b64d') out.textContent = decodeURIComponent(escape(atob(input.trim())));
        else if (mode === 'urle') out.textContent = encodeURIComponent(input);
        else if (mode === 'urld') out.textContent = decodeURIComponent(input);
        else if (mode === 'hex') out.textContent = [...new TextEncoder().encode(input)].map(b => b.toString(16).padStart(2, '0')).join(' ');
    } catch (e) {
        out.textContent = `Error: ${e.message}`;
    }
};

window.tbDecodeJwt = function () {
    const token = (document.getElementById('tb-encode-input')?.value || '').trim();
    const out = document.getElementById('tb-encode-output');
    if (!out) return;
    try {
        const parts = token.split('.');
        if (parts.length < 2) throw new Error('Token JWT inválido');
        const decodePart = p => JSON.parse(decodeURIComponent(escape(atob(p.replace(/-/g, '+').replace(/_/g, '/')))));
        out.textContent = JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2);
    } catch (e) {
        out.textContent = `JWT Error: ${e.message}`;
    }
};

window.tbComputeHashes = async function () {
    const text = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    if (!out || !crypto?.subtle) return;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = `SHA-256: ${hex}`;
};

window.runRegexTester = function () {
    const pat = document.getElementById('tb-regex-pattern')?.value || '';
    const flags = document.getElementById('tb-regex-flags')?.value || 'g';
    const text = document.getElementById('tb-regex-text')?.value || '';
    const out = document.getElementById('tb-regex-result');
    if (!out) return;
    if (!pat) { out.textContent = 'Introduce un patrón regex.'; return; }
    try {
        const safeFlags = flags.includes('g') ? flags : flags + 'g';
        const rx = new RegExp(pat, safeFlags);
        const matches = [...text.matchAll(rx)];
        out.textContent = `${matches.length} coincidencia(s): ${matches.slice(0, 10).map(m => JSON.stringify(m[0])).join(', ')}`;
    } catch (e) {
        out.textContent = `Regex inválida: ${e.message}`;
    }
};

window.runSimpleDiff = function () {
    const aLines = (document.getElementById('tb-regex-text')?.value || '').split('\n');
    const bLines = (document.getElementById('tb-diff-b')?.value || '').split('\n');
    const out = document.getElementById('tb-diff-output');
    if (!out) return;
    const max = Math.max(aLines.length, bLines.length);
    const diff = [];
    for (let i = 0; i < max; i++) {
        if (aLines[i] === bLines[i]) continue;
        if (aLines[i] !== undefined) diff.push(`- ${aLines[i]}`);
        if (bLines[i] !== undefined) diff.push(`+ ${bLines[i]}`);
    }
    out.textContent = diff.length ? diff.join('\n') : 'Sin diferencias línea a línea.';
};

window.calculateSubnet = function () {
    const raw = (document.getElementById('tb-ip-input')?.value || '').trim();
    const out = document.getElementById('tb-subnet-output');
    if (!out) return;
    const [ipStr, prefixStr] = raw.split('/');
    const prefix = parseInt(prefixStr, 10);
    const octets = (ipStr || '').split('.').map(Number);
    if (octets.length !== 4 || octets.some(n => Number.isNaN(n) || n < 0 || n > 255) || Number.isNaN(prefix) || prefix < 0 || prefix > 32) {
        out.textContent = 'Formato esperado: 192.168.1.10/24';
        return;
    }
    const ipInt = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const maskInt = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    const netInt = (ipInt & maskInt) >>> 0;
    const bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;
    const toIp = n => [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    const hosts = prefix >= 31 ? (prefix === 32 ? 1 : 2) : Math.max(0, Math.pow(2, 32 - prefix) - 2);
    out.textContent = `Red: ${toIp(netInt)} | Máscara: ${toIp(maskInt)} | Broadcast: ${toIp(bcastInt)} | Hosts útiles: ${hosts}`;
};

window.convertNumberBase = function (from, val) {
    const clean = (val || '').trim();
    if (!clean) return;
    const bases = { dec: 10, bin: 2, hex: 16, oct: 8 };
    const num = parseInt(clean, bases[from]);
    if (Number.isNaN(num)) return;
    if (from !== 'dec') document.getElementById('base-dec').value = num.toString(10);
    if (from !== 'bin') document.getElementById('base-bin').value = num.toString(2);
    if (from !== 'hex') document.getElementById('base-hex').value = num.toString(16).toUpperCase();
    if (from !== 'oct') document.getElementById('base-oct').value = num.toString(8);
};

window.updateChmodCalc = function () {
    const calcGroup = (rId, wId, xId) => {
        const r = document.getElementById(rId)?.checked ? 4 : 0;
        const w = document.getElementById(wId)?.checked ? 2 : 0;
        const x = document.getElementById(xId)?.checked ? 1 : 0;
        return {
            oct: r + w + x,
            sym: (r ? 'r' : '-') + (w ? 'w' : '-') + (x ? 'x' : '-')
        };
    };
    const u = calcGroup('ch-ur', 'ch-uw', 'ch-ux');
    const g = calcGroup('ch-gr', 'ch-gw', 'ch-gx');
    const o = calcGroup('ch-or', 'ch-ow', 'ch-ox');
    const octEl = document.getElementById('chmod-octal');
    const symEl = document.getElementById('chmod-symbolic');
    if (octEl) octEl.textContent = `${u.oct}${g.oct}${o.oct}`;
    if (symEl) symEl.textContent = `${u.sym}${g.sym}${o.sym}`;
};

window.copyChmodCmd = function () {
    const oct = document.getElementById('chmod-octal')?.textContent || '755';
    navigator.clipboard?.writeText(`chmod ${oct} archivo`).then(() => showToast(`Copiado: chmod ${oct} archivo`, "success"));
};

window.explainCronExpr = function () {
    const expr = (document.getElementById('cron-expr-input')?.value || '').trim();
    const out = document.getElementById('cron-explanation');
    if (!out) return;
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) {
        out.textContent = 'Formato estándar: minuto hora día_mes mes día_semana';
        return;
    }
    const [m, h, dom, mon, dow] = parts;
    const mDesc = m === '*' ? 'cada minuto' : m.startsWith('*/') ? `cada ${m.slice(2)} min` : `en min ${m}`;
    const hDesc = h === '*' ? 'todas las horas' : `a las ${h}h`;
    out.textContent = `Ejecución: ${mDesc}, ${hDesc} (DOM:${dom}, MON:${mon}, DOW:${dow}).`;
};

window.generateMockUsers = function (count) {
    const names = ['Ana', 'Carlos', 'Lucía', 'Diego', 'Sofía', 'Mateo', 'Elena', 'Hugo'];
    const surnames = ['García', 'Martínez', 'López', 'Sánchez', 'Pérez', 'Ruiz'];
    const out = Array.from({ length: count }, (_, i) => {
        const n = names[i % names.length];
        const s = surnames[(i * 2) % surnames.length];
        return { id: i + 1, name: `${n} ${s}`, email: `${n.toLowerCase()}.${s.toLowerCase()}${i + 1}@example.test` };
    });
    const el = document.getElementById('tb-gen-output');
    if (el) el.value = JSON.stringify(out, null, 2);
};

window.generateUuidsAndDni = function () {
    const uuid = crypto?.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = Math.random() * 16 | 0;
        return (c === 'x' ? r : (r & 3 | 8)).toString(16);
    });
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const num = Math.floor(10000000 + Math.random() * 89999999);
    const dni = `${num}${letters[num % 23]}`;
    const el = document.getElementById('tb-gen-output');
    if (el) el.value = `UUID v4: ${uuid}\nDNI Test: ${dni}`;
};

window.generateSecurePassword = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*';
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    const pass = [...arr].map(x => chars[x % chars.length]).join('');
    const el = document.getElementById('tb-gen-output');
    if (el) el.value = pass;
};

window.loadBoilerplate = function (key) {
    const templates = {
        gitignore: "*.class\n*.jar\n*.log\n__pycache__/\nnode_modules/\n.env\ndist/\nbuild/\n",
        dockerfile: "FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD [\"node\", \"index.js\"]\n",
        compose: "services:\n  app:\n    build: .\n    ports:\n      - \"8080:8080\"\n    environment:\n      - NODE_ENV=development\n",
        html5: "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n  <meta charset=\"UTF-8\">\n  <title>Práctica</title>\n</head>\n<body>\n  <h1>Hola mundo</h1>\n</body>\n</html>\n"
    };
    const el = document.getElementById('tb-gen-output');
    if (el && templates[key]) el.value = templates[key];
};

const QUICK_REFS = [
    'HTTP 200 OK — Solicitud correcta',
    'HTTP 201 Created — Recurso creado',
    'HTTP 400 Bad Request — Error de sintaxis/parámetros',
    'HTTP 401 Unauthorized — Falta autenticación',
    'HTTP 403 Forbidden — Sin permisos',
    'HTTP 404 Not Found — Recurso no encontrado',
    'HTTP 500 Internal Server Error — Fallo en servidor',
    'HTTP 502/503/504 — Gateway / Servicio no disponible',
    'Puerto 22 TCP — SSH / SFTP',
    'Puerto 53 TCP/UDP — DNS',
    'Puerto 80 / 443 TCP — HTTP / HTTPS',
    'Puerto 3306 TCP — MySQL / MariaDB',
    'Puerto 5432 TCP — PostgreSQL',
    'Puerto 8080 TCP — Servidor HTTP alternativo / Tomcat'
];

function renderQuickRefList() {
    const box = document.getElementById('tb-ref-list');
    if (!box) return;
    const q = (document.getElementById('tb-ref-search')?.value || '').toLowerCase().trim();
    const list = q ? QUICK_REFS.filter(r => r.toLowerCase().includes(q)) : QUICK_REFS;
    box.innerHTML = list.map(item => `<div class="hub-item-card" style="font-family:var(--font-mono);">${escapeHtml(item)}</div>`).join('');
}

/* ----------------------------------------------------------
   SNIPPET & COMMAND LAB CON VARIABLES DINÁMICAS (#14)
   ---------------------------------------------------------- */
function resolveSnippetCommand(cmd) {
    const user = (document.getElementById('cli-var-user')?.value || 'root').trim() || 'root';
    const ip = (document.getElementById('cli-var-ip')?.value || '192.168.1.10').trim() || '192.168.1.10';
    const port = (document.getElementById('cli-var-port')?.value || '22').trim() || '22';
    return String(cmd || '')
        .replace(/\{\{USER\}\}/gi, user)
        .replace(/\{\{IP\}\}/gi, ip)
        .replace(/\{\{PORT\}\}/gi, port);
}

window.addCustomSnippet = function () {
    const titleInput = document.getElementById('snip-new-title');
    const title = titleInput?.value.trim();
    const cat = document.getElementById('snip-new-cat')?.value.trim() || 'Custom';
    const cmd = document.getElementById('snip-new-cmd')?.value.trim();
    if (!title || !cmd) return;

    if (!appData.snippets) appData.snippets = [];
    appData.snippets.push({ id: 'c_' + Date.now(), title, cat, cmd, isCustom: true });
    titleInput.value = '';
    document.getElementById('snip-new-cmd').value = '';
    saveData();
    renderSnippets();
    toggleForm('form-add-snippet');
    showToast("Snippet personalizado añadido", "success");
};

window.deleteCustomSnippet = function (id) {
    appData.snippets = (appData.snippets || []).filter(s => s.id !== id);
    saveData();
    renderSnippets();
};

function getAllSnippets() {
    return [...(appData.snippets || [])];
}

function setupSnippetContainerEvents() {
    const container = document.getElementById('snippet-list-container');
    if (!container) return;

    container.addEventListener('click', e => {
        const copyBtn = e.target.closest('.btn-copy-snippet');
        if (!copyBtn) return;
        const snip = getAllSnippets().find(s => String(s.id) === String(copyBtn.dataset.id));
        if (!snip) return;

        const finalCmd = resolveSnippetCommand(snip.cmd);
        navigator.clipboard?.writeText(finalCmd).then(() => {
            const orig = copyBtn.textContent;
            copyBtn.textContent = '✓';
            copyBtn.style.color = 'var(--accent-green)';
            setTimeout(() => {
                copyBtn.textContent = orig;
                copyBtn.style.color = '';
            }, 1500);
            showToast("Comando copiado al portapapeles", "success");
        });
    });
}

window.renderSnippets = function () {
    const container = document.getElementById('snippet-list-container');
    if (!container) return;

    const search = document.getElementById('snippet-search')?.value.toLowerCase().trim() || '';
    const filterCat = document.getElementById('snippet-filter-cat')?.value || 'all';
    let list = getAllSnippets();

    if (filterCat !== 'all') {
        if (filterCat === 'Custom') list = list.filter(s => s.isCustom);
        else list = list.filter(s => s.cat.toLowerCase() === filterCat.toLowerCase());
    }
    if (search) {
        list = list.filter(s => s.title.toLowerCase().includes(search) || s.cmd.toLowerCase().includes(search));
    }
    if (!list.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:16px;">No hay comandos guardados.</div>`;
        return;
    }

    container.innerHTML = list.map(s => `
        <div class="snippet-box">
            <div style="flex:1;overflow:hidden;">
                <div style="font-size:0.62rem;color:var(--text-muted);">[${escapeHtml(s.cat)}] ${escapeHtml(s.title)}</div>
                <code class="snippet-cmd-text">${escapeHtml(resolveSnippetCommand(s.cmd))}</code>
            </div>
            <div style="display:flex;gap:3px;align-items:center;">
                <button type="button" class="btn-icon btn-copy-snippet" data-id="${escapeHtml(s.id)}" title="Copiar">📋</button>
                ${s.isCustom ? `<button type="button" class="btn-icon" onclick="deleteCustomSnippet('${escapeHtml(s.id)}')" title="Eliminar">✖</button>` : ''}
            </div>
        </div>
    `).join('');
};

/* ----------------------------------------------------------
   HORARIO SEMANAL & CLASE ACTUAL
   ---------------------------------------------------------- */
window.toggleScheduleViewMode = function () {
    appData.settings.scheduleViewMode = appData.settings.scheduleViewMode === 'table' ? 'widget' : 'table';
    saveData();
    updateScheduleWidget(getClockDate());
};

function updateScheduleWidget(now) {
    const widget = document.getElementById('schedule-widget');
    if (!widget) return;

    if (!appData.schedule || appData.schedule.length === 0) {
        widget.innerHTML = `<div class="sch-status">📅 Horario Sin Clases</div><div class="sch-detail">Haz clic en ⚙️ para registrar tu horario semanal.</div>`;
        return;
    }

    const currentDay = now.getDay();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (appData.settings.scheduleViewMode === 'table') {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        widget.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:700;color:var(--accent-cyan);">Horario Semanal</span>
                <span style="font-size:0.6rem;color:var(--text-muted);cursor:pointer;" onclick="toggleScheduleViewMode()">Volver a vista actual</span>
            </div>
            <table class="sch-table">
                <thead><tr><th>Día</th><th>Horas</th><th>Asignatura</th><th>Aula</th></tr></thead>
                <tbody>
                    ${[...appData.schedule].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start)).map(s => `
                        <tr>
                            <td>${days[s.day - 1] || 'Día ' + s.day}</td>
                            <td>${escapeHtml(s.start)} - ${escapeHtml(s.end)}</td>
                            <td><strong>${escapeHtml(s.subject)}</strong></td>
                            <td>${escapeHtml(s.room || '--')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    if (currentDay === 0 || currentDay === 6) {
        widget.innerHTML = `<div class="sch-status">🌴 Fin de Semana</div><div class="sch-detail">Sin clases programadas.</div>`;
        return;
    }

    const todayClasses = appData.schedule.filter(s => parseInt(s.day, 10) === currentDay).sort((a, b) => a.start.localeCompare(b.start));
    if (!todayClasses.length) {
        widget.innerHTML = `<div class="sch-status">☕ Sin Clases Hoy</div><div class="sch-detail">No hay asignaturas registradas para hoy.</div>`;
        return;
    }

    let currentClass = null, nextClass = null;
    for (const c of todayClasses) {
        const [sh, sm] = c.start.split(':').map(Number);
        const [eh, em] = c.end.split(':').map(Number);
        const startMins = sh * 60 + sm, endMins = eh * 60 + em;
        if (currentMins >= startMins && currentMins < endMins) { currentClass = { ...c, remainingMins: endMins - currentMins }; break; }
        if (currentMins < startMins && !nextClass) nextClass = { ...c, startsIn: startMins - currentMins };
    }

    if (currentClass) {
        widget.innerHTML = `<div class="sch-status">🟢 En Clase: <strong style="color:var(--accent-cyan);">${escapeHtml(currentClass.subject)}</strong></div><div class="sch-detail">Aula: ${escapeHtml(currentClass.room || '204')} &bull; Finaliza en <strong>${currentClass.remainingMins} min</strong> (${escapeHtml(currentClass.end)})</div>`;
    } else if (nextClass) {
        widget.innerHTML = `<div class="sch-status">🟡 Próxima Clase: <strong>${escapeHtml(nextClass.subject)}</strong></div><div class="sch-detail">Comienza a las ${escapeHtml(nextClass.start)} (en <strong>${nextClass.startsIn} min</strong>) en ${escapeHtml(nextClass.room || 'Aula')}</div>`;
    } else {
        widget.innerHTML = `<div class="sch-status">☕ Clases del día finalizadas</div><div class="sch-detail">Jornada completada.</div>`;
    }
}

window.openScheduleModal = function () { renderScheduleEditor(); const m = document.getElementById('schedule-modal'); if (m) m.style.display = 'flex'; };
window.closeScheduleModal = function () { const m = document.getElementById('schedule-modal'); if (m) m.style.display = 'none'; };

window.addScheduleClass = function () {
    const day = parseInt(document.getElementById('sch-add-day')?.value, 10) || 1;
    const start = document.getElementById('sch-add-start')?.value;
    const end = document.getElementById('sch-add-end')?.value;
    const subject = document.getElementById('sch-add-subject')?.value.trim();
    const room = document.getElementById('sch-add-room')?.value.trim() || 'Aula 204';
    if (!start || !end || !subject) return showToast("Introduce inicio, fin y asignatura", "error");

    if (!appData.schedule) appData.schedule = [];
    appData.schedule.push({ id: Date.now(), day, start, end, subject, room });
    document.getElementById('sch-add-subject').value = '';
    saveData();
    renderScheduleEditor();
    updateScheduleWidget(getClockDate());
    showToast("Clase añadida al horario", "success");
};

window.deleteScheduleClass = function (id) {
    appData.schedule = (appData.schedule || []).filter(s => s.id !== id);
    saveData();
    renderScheduleEditor();
    updateScheduleWidget(getClockDate());
};

window.clearSchedule = function () {
    if (!confirm("¿Deseas vaciar todo el horario semanal?")) return;
    appData.schedule = [];
    saveData();
    renderScheduleEditor();
    updateScheduleWidget(getClockDate());
};

function renderScheduleEditor() {
    const container = document.getElementById('schedule-list-editor');
    if (!container) return;
    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const items = [...(appData.schedule || [])].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    container.innerHTML = items.length ? items.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;border:1px solid var(--card-border);font-family:var(--font-mono);font-size:0.72rem;">
            <span><strong>${days[s.day - 1]}</strong>: ${escapeHtml(s.start)}-${escapeHtml(s.end)} | <span style="color:var(--accent-cyan);">${escapeHtml(s.subject)}</span> (${escapeHtml(s.room)})</span>
            <button type="button" class="btn-icon" onclick="deleteScheduleClass(${s.id})">✖</button>
        </div>
    `).join('') : `<div style="text-align:center;color:var(--text-muted);padding:10px;">Sin clases registradas</div>`;
}

/* ----------------------------------------------------------
   ENLACES & DOCUMENTACIÓN
   ---------------------------------------------------------- */
window.addBookmark = function () {
    const nameInput = document.getElementById('bm-name');
    const urlInput = document.getElementById('bm-url');
    const name = nameInput?.value.trim();
    let url = urlInput?.value.trim();
    if (!name || !url) return;
    if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

    appData.bookmarks.push({ id: Date.now(), name, url });
    nameInput.value = '';
    urlInput.value = '';
    saveData();
    renderBookmarks();
    toggleForm('form-bookmarks');
    showToast("Enlace añadido", "success");
};

window.deleteBookmark = function (id) {
    const idx = appData.bookmarks.findIndex(b => b.id === id);
    if (idx === -1) return;
    const removed = appData.bookmarks[idx];
    appData.bookmarks.splice(idx, 1);
    saveData();
    renderBookmarks();
    showToast("Enlace eliminado", "info", () => {
        appData.bookmarks.splice(idx, 0, removed);
        saveData();
        renderBookmarks();
    });
};

window.renderBookmarks = function () {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;
    const search = document.getElementById('bm-search-filter')?.value.toLowerCase().trim() || '';
    let items = appData.bookmarks || [];
    if (search) items = items.filter(b => b.name.toLowerCase().includes(search) || b.url.toLowerCase().includes(search));
    list.innerHTML = items.length ? items.map(b => `
        <li>
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">🔖 ${escapeHtml(b.name)}</a>
            <button type="button" onclick="deleteBookmark(${b.id})" class="btn-icon" title="Eliminar">✖</button>
        </li>
    `).join('') : `<li style="justify-content:center;color:var(--text-muted);">Sin enlaces coincidentes</li>`;
};

/* ----------------------------------------------------------
   SERVIDORES, PUERTOS LOCALES & CHECKLIST SYSADMIN (#15, #18)
   ---------------------------------------------------------- */
window.addServer = function () {
    const nameInput = document.getElementById('srv-name');
    const name = nameInput?.value.trim();
    const ip = document.getElementById('srv-ip')?.value.trim();
    const port = document.getElementById('srv-port')?.value.trim() || '';
    const creds = document.getElementById('srv-creds')?.value.trim() || 'root';
    if (!name || !ip) return;

    appData.servers.push({ id: Date.now(), name, ip, port, creds });
    nameInput.value = '';
    document.getElementById('srv-ip').value = '';
    document.getElementById('srv-port').value = '';
    saveData();
    renderServers();
    toggleForm('form-servers');
    showToast("Servidor/servicio registrado", "success");
};

window.deleteServer = function (id) {
    const idx = appData.servers.findIndex(s => s.id === id);
    if (idx === -1) return;
    const removed = appData.servers[idx];
    appData.servers.splice(idx, 1);
    saveData();
    renderServers();
    showToast("Servidor eliminado", "info", () => {
        appData.servers.splice(idx, 0, removed);
        saveData();
        renderServers();
    });
};

function setupServersContainerEvents() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    list.addEventListener('click', e => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const srv = (appData.servers || []).find(s => s.id === Number(btn.dataset.id));
        if (!srv) return;
        if (btn.dataset.action === 'copy-ip') {
            const target = srv.port ? `${srv.ip}:${srv.port}` : srv.ip;
            navigator.clipboard?.writeText(target).then(() => showToast(`${target} copiado`, "success"));
        } else if (btn.dataset.action === 'copy-ssh') {
            const user = (srv.creds?.split('/')[0]?.trim() || 'root').replace(/[^a-zA-Z0-9._-]/g, '') || 'root';
            const portArg = srv.port ? ` -p ${srv.port}` : '';
            const cmd = `ssh ${user}@${srv.ip}${portArg}`;
            navigator.clipboard?.writeText(cmd).then(() => showToast(`Comando "${cmd}" copiado`, "success"));
        }
    });
}

window.renderServers = function () {
    const list = document.getElementById('servers-list');
    if (!list) return;
    const search = document.getElementById('srv-search-filter')?.value.toLowerCase().trim() || '';
    let items = appData.servers || [];
    if (search) items = items.filter(s => `${s.name} ${s.ip} ${s.port || ''}`.toLowerCase().includes(search));
    list.innerHTML = items.length ? items.map(s => `
        <li>
            <div style="display:flex;flex-direction:column;">
                <span>🖥️ <strong>${escapeHtml(s.name)}</strong> ${s.port ? `<span class="kanban-subject-tag">:${escapeHtml(s.port)}</span>` : ''}</span>
                <span style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(s.ip)} | ${escapeHtml(s.creds)}</span>
            </div>
            <div style="display:flex;gap:3px;align-items:center;">
                <button type="button" class="btn-icon" data-action="copy-ip" data-id="${s.id}" title="Copiar IP/Puerto">📋</button>
                <button type="button" class="btn-icon" data-action="copy-ssh" data-id="${s.id}" title="Copiar SSH">⚡</button>
                <button type="button" class="btn-icon" onclick="deleteServer(${s.id})" title="Eliminar">✖</button>
            </div>
        </li>
    `).join('') : `<li style="justify-content:center;color:var(--text-muted);">Sin servidores registrados</li>`;
};

window.toggleDeployChecklistItem = function (id) {
    const item = (appData.deployChecklist || []).find(c => c.id === id);
    if (!item) return;
    item.done = !item.done;
    saveData();
    renderDeployChecklist();
};

function renderDeployChecklist() {
    const box = document.getElementById('deploy-checklist-items');
    if (!box) return;
    box.innerHTML = (appData.deployChecklist || []).map(c => `
        <span class="rubric-chip ${c.done ? 'done' : ''}" onclick="toggleDeployChecklistItem('${c.id}')">
            ${c.done ? '☑' : '☐'} ${escapeHtml(c.text)}
        </span>
    `).join('');
}

/* ----------------------------------------------------------
   TARJETAS PERSONALIZADAS
   ---------------------------------------------------------- */
window.createCustomCard = function () {
    const title = document.getElementById('new-card-title')?.value.trim();
    if (!title) return;
    const category = document.getElementById('new-card-category')?.value || 'dev';
    const type = document.getElementById('new-card-type')?.value || 'notes';
    const id = 'custom_card_' + Date.now();

    if (!appData.customCards) appData.customCards = [];
    appData.customCards.push({ id, title, category, type, content: type === 'checklist' ? [] : '' });
    appData.cardCategories[id] = category;
    if (!appData.settings.layout.colLeft.includes(id) && !appData.settings.layout.colRight.includes(id)) {
        appData.settings.layout.colLeft.push(id);
    }

    document.getElementById('new-card-title').value = '';
    saveData();
    renderCustomCards();
    setDashboardView(appData.settings.activeDashboardView);
    toggleForm('form-create-card-panel');
    showToast(`Tarjeta "${title}" creada`, "success");
};

window.deleteCustomCard = function (id) {
    if (!confirm("¿Deseas eliminar esta tarjeta personalizada?")) return;
    appData.customCards = (appData.customCards || []).filter(c => c.id !== id);
    appData.settings.layout.colLeft = (appData.settings.layout.colLeft || []).filter(x => x !== id);
    appData.settings.layout.colRight = (appData.settings.layout.colRight || []).filter(x => x !== id);
    delete appData.cardCategories[id];
    document.getElementById(id)?.remove();
    saveData();
    renderVisibilityControls();
    showToast("Tarjeta eliminada", "info");
};

function renderCustomChecklistItems(cardData) {
    const box = document.getElementById(`check-${cardData.id}`);
    if (!box) return;
    box.innerHTML = (cardData.content || []).map((item, idx) => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.25);padding:3px 6px;border-radius:3px;">
            <span onclick="toggleCustomCheckItem('${cardData.id}', ${idx})" style="cursor:pointer;${item.done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${item.done ? '✅' : '⬜'} ${escapeHtml(item.text)}</span>
            <button type="button" class="btn-icon" onclick="deleteCustomCheckItem('${cardData.id}', ${idx})">✖</button>
        </div>
    `).join('');
}

function renderCustomCards() {
    (appData.customCards || []).forEach(cardData => {
        if (document.getElementById(cardData.id)) return;
        const card = document.createElement('div');
        card.className = 'card';
        card.id = cardData.id;
        card.setAttribute('data-category', cardData.category);

        let bodyHtml = '';
        if (cardData.type === 'notes') {
            bodyHtml = `<textarea class="notes-area" style="min-height:80px;" oninput="updateCustomCardNotes('${cardData.id}', this.value)">${escapeHtml(cardData.content || '')}</textarea>`;
        } else if (cardData.type === 'checklist') {
            bodyHtml = `
                <div id="check-${cardData.id}" style="display:flex;flex-direction:column;gap:3px;max-height:120px;overflow-y:auto;"></div>
                <div style="display:flex;gap:4px;margin-top:4px;">
                    <input type="text" id="input-${cardData.id}" placeholder="Nuevo ítem..." style="flex:1;" onkeydown="if(event.key==='Enter') addCustomCheckItem('${cardData.id}')">
                    <button type="button" onclick="addCustomCheckItem('${cardData.id}')" class="btn-green">✚</button>
                </div>
            `;
        } else if (cardData.type === 'iframe') {
            const safeUrl = /^https?:\/\//i.test(cardData.content || '') ? cardData.content : 'about:blank';
            bodyHtml = `
                <div style="display:flex;gap:4px;margin-bottom:4px;">
                    <input type="url" id="url-${cardData.id}" value="${escapeHtml(cardData.content || '')}" placeholder="https://..." style="flex:1;">
                    <button type="button" onclick="updateCustomCardEmbed('${cardData.id}')" class="btn-cyan">Cargar</button>
                </div>
                <iframe src="${escapeHtml(safeUrl)}" style="width:100%;height:150px;border:1px solid var(--card-border);border-radius:4px;" sandbox="allow-scripts allow-same-origin"></iframe>
            `;
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="card-title-text">🛠️ ${escapeHtml(cardData.title)}</span>
                <div class="card-actions">
                    <button type="button" class="btn-icon" onclick="deleteCustomCard('${cardData.id}')" title="Eliminar Tarjeta">🗑️</button>
                    <div class="edit-controls">
                        <select class="card-category-select" onchange="updateCardCategory('${cardData.id}', this.value)"></select>
                        <button type="button" class="btn-icon" onclick="toggleCardVisibility('${cardData.id}')" title="Ocultar Tarjeta">👁️</button>
                    </div>
                    <button type="button" class="btn-icon btn-collapse" onclick="toggleCardCollapse('${cardData.id}')">_</button>
                    <span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, '${cardData.id}')">⋮⋮</span>
                </div>
            </div>
            <div class="card-body">${bodyHtml}</div>
        `;

        const targetCol = (appData.settings.layout?.colRight || []).includes(cardData.id)
            ? document.getElementById('col-right')
            : document.getElementById('col-left');
        targetCol?.appendChild(card);
        if (cardData.type === 'checklist') renderCustomChecklistItems(cardData);
    });
    populateCategorySelectors();
}

window.updateCustomCardNotes = debounce((id, text) => {
    const card = (appData.customCards || []).find(c => c.id === id);
    if (card) { card.content = text; saveData(); }
}, 400);

window.addCustomCheckItem = function (cardId) {
    const input = document.getElementById(`input-${cardId}`);
    const text = input?.value.trim();
    if (!text) return;
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card) {
        if (!Array.isArray(card.content)) card.content = [];
        card.content.push({ text, done: false });
        input.value = '';
        saveData();
        renderCustomChecklistItems(card);
    }
};

window.toggleCustomCheckItem = function (cardId, idx) {
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card?.content?.[idx]) { card.content[idx].done = !card.content[idx].done; saveData(); renderCustomChecklistItems(card); }
};

window.deleteCustomCheckItem = function (cardId, idx) {
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card?.content) { card.content.splice(idx, 1); saveData(); renderCustomChecklistItems(card); }
};

window.updateCustomCardEmbed = function (cardId) {
    let url = document.getElementById(`url-${cardId}`)?.value.trim() || '';
    if (url && !/^https?:\/\//i.test(url)) url = 'https://' + url;
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card) {
        card.content = url;
        saveData();
        const iframe = document.querySelector(`#${cardId} iframe`);
        if (iframe) iframe.src = url || 'about:blank';
    }
};

/* ----------------------------------------------------------
   BUSCADOR GLOBAL (CTRL+K + NAVEGACIÓN CON TECLADO)
   ---------------------------------------------------------- */
let searchResultsCache = [];
let selectedSearchIndex = -1;

window.openGlobalSearch = function () {
    const modal = document.getElementById('global-search-modal');
    if (modal) {
        modal.style.display = 'flex';
        selectedSearchIndex = -1;
        const input = document.getElementById('global-search-input');
        if (input) { input.value = ''; input.focus(); filterGlobalSearch(); }
    }
};

window.closeGlobalSearch = function () {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
    selectedSearchIndex = -1;
};

function focusCardById(cardId) {
    if (!cardId) return;
    if (appData.settings.zenMode) { appData.settings.zenMode = false; applyZenModeState(); }
    const card = document.getElementById(cardId);
    if (!card) return;
    if ((appData.settings.hiddenCards || []).includes(cardId)) {
        appData.settings.hiddenCards = appData.settings.hiddenCards.filter(id => id !== cardId);
    }
    const cat = appData.cardCategories[cardId] || card.getAttribute('data-category') || 'dev';
    if (appData.settings.activeDashboardView !== 'all' && appData.settings.activeDashboardView !== cat) setDashboardView('all');
    else setDashboardView(appData.settings.activeDashboardView);
    if (card.classList.contains('collapsed')) toggleCardCollapse(cardId);
    card.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

window.filterGlobalSearch = function () {
    const query = document.getElementById('global-search-input')?.value.toLowerCase().trim() || '';
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer) return;

    selectedSearchIndex = -1;
    searchResultsCache = [];

    if (!query) {
        resultsContainer.innerHTML = `<li style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:12px;">Escribe para buscar entregas, tareas, comandos, bugs, flashcards o enlaces...</li>`;
        return;
    }

    const matches = [];
    (appData.tasks || []).forEach(t => { if (t.text.toLowerCase().includes(query)) matches.push({ type: 'Tarea', text: t.text, badge: t.done ? '✅ Hecha' : '⏳ Pendiente', cardId: 'card-tasks' }); });
    (appData.deliveries || []).forEach(d => { if (`${d.title} ${d.subject}`.toLowerCase().includes(query)) matches.push({ type: 'Entrega', text: `${d.title} (${d.subject})`, badge: d.type, cardId: 'card-deliveries' }); });
    getAllSnippets().forEach(s => { if (`${s.title} ${s.cmd}`.toLowerCase().includes(query)) matches.push({ type: 'Comando', text: `${s.title}: ${s.cmd}`, copyText: resolveSnippetCommand(s.cmd), badge: s.cat, cardId: 'card-snippets' }); });
    (appData.bookmarks || []).forEach(b => { if (`${b.name} ${b.url}`.toLowerCase().includes(query)) matches.push({ type: 'Enlace', text: `${b.name} (${b.url})`, copyText: b.url, badge: 'Web', cardId: 'card-bookmarks' }); });
    (appData.studyKanban || []).forEach(k => { if (`${k.title} ${k.subject}`.toLowerCase().includes(query)) matches.push({ type: 'Kanban', text: `${k.title} [${k.subject}]`, badge: k.col.toUpperCase(), cardId: 'card-kanban' }); });
    (appData.bugLogs || []).forEach(b => { if (`${b.errorMsg} ${b.fix}`.toLowerCase().includes(query)) matches.push({ type: 'Bug', text: `${b.errorMsg} → ${b.fix}`, copyText: b.fix, badge: b.subject, cardId: 'card-study-hub' }); });
    (appData.flashcards || []).forEach(f => { if (`${f.q} ${f.a}`.toLowerCase().includes(query)) matches.push({ type: 'Flashcard', text: `${f.q} — ${f.a}`, badge: f.subject, cardId: 'card-study-hub' }); });
    (appData.servers || []).forEach(s => { if (`${s.name} ${s.ip}`.toLowerCase().includes(query)) matches.push({ type: 'Servidor', text: `${s.name} (${s.ip})`, copyText: s.ip, badge: 'VM/Host', cardId: 'card-servers' }); });

    searchResultsCache = matches.slice(0, 15);
    if (!searchResultsCache.length) {
        resultsContainer.innerHTML = `<li style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:12px;">No se encontraron resultados para "${escapeHtml(query)}"</li>`;
        return;
    }

    resultsContainer.innerHTML = searchResultsCache.map((m, idx) => `
        <li class="search-result-item" data-index="${idx}" onclick="activateSearchResult(${idx})">
            <span><strong>[${escapeHtml(m.type)}]</strong> ${escapeHtml(m.text)}</span>
            <span class="badge-version">${escapeHtml(m.badge)}</span>
        </li>
    `).join('');
};

function highlightSearchItem() {
    document.querySelectorAll('#global-search-results .search-result-item').forEach((el, idx) => {
        el.classList.toggle('selected', idx === selectedSearchIndex);
        if (idx === selectedSearchIndex) el.scrollIntoView({ block: 'nearest' });
    });
}

window.handleGlobalSearchKeydown = function (e) {
    if (!searchResultsCache.length) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); selectedSearchIndex = (selectedSearchIndex + 1) % searchResultsCache.length; highlightSearchItem(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); selectedSearchIndex = (selectedSearchIndex - 1 + searchResultsCache.length) % searchResultsCache.length; highlightSearchItem(); }
    else if (e.key === 'Enter' && selectedSearchIndex >= 0) { e.preventDefault(); activateSearchResult(selectedSearchIndex); }
};

window.activateSearchResult = function (idx) {
    const item = searchResultsCache[idx];
    if (!item) return;
    navigator.clipboard?.writeText(item.copyText || item.text).catch(() => {});
    focusCardById(item.cardId);
    showToast(`Ir a ${item.type} (copiado)`, "info");
    closeGlobalSearch();
};

/* ----------------------------------------------------------
   EXPORTACIÓN & IMPORTACIÓN DE DATOS JSON (#37)
   ---------------------------------------------------------- */
window.exportData = function () {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const a = document.createElement('a');
    a.setAttribute("href", dataStr);
    a.setAttribute("download", `DevWorkspace_Backup_${getTodayIso()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast("💾 Datos exportados correctamente", "success");
};

window.importData = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    saveSnapshot('Antes de importar JSON');

    const mergeArraysById = (a = [], b = []) => {
        const map = new Map();
        [...a, ...b].forEach((item, idx) => map.set(item?.id ?? `idx_${idx}`, item));
        return [...map.values()];
    };

    const reader = new FileReader();
    reader.onload = function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!isObj(parsed)) throw new Error("Formato no válido");

            const shouldMerge = confirm("¿Deseas COMBINAR (Aceptar) los datos con los actuales o REEMPLAZAR todo (Cancelar)?");
            if (shouldMerge) {
                const base = structuredClone(appData);
                appData = deepMerge(defaultData, parsed);
                ['tasks', 'deliveries', 'bookmarks', 'servers', 'snippets', 'studyKanban', 'flashcards', 'bugLogs', 'classDoubts', 'teamProjects', 'grades', 'schedule'].forEach(k => {
                    appData[k] = mergeArraysById(base[k], parsed[k]);
                });
            } else {
                appData = deepMerge(defaultData, parsed);
            }

            saveData();
            applyAppearanceSettings();
            applyTheme();
            renderAll();
            applyLayoutState();
            showToast("✅ Datos importados con éxito", "success");
        } catch (_) {
            showToast("Error al importar el archivo JSON", "error");
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
};

/* ----------------------------------------------------------
   MODALES EXTRA & PWA (#35, #45)
   ---------------------------------------------------------- */
window.openShortcutsModal = function () { const m = document.getElementById('shortcuts-modal'); if (m) m.style.display = 'flex'; };
window.closeShortcutsModal = function () { const m = document.getElementById('shortcuts-modal'); if (m) m.style.display = 'none'; };

function registerBasicPwa() {
    try {
        const manifest = {
            name: "DevWorkspace v6.0 Ultimate",
            short_name: "DevWorkspace",
            start_url: ".",
            display: "standalone",
            background_color: "#060813",
            theme_color: "#060813"
        };
        const blob = new Blob([JSON.stringify(manifest)], { type: 'application/json' });
        const link = document.getElementById('pwa-manifest-link');
        if (link) link.href = URL.createObjectURL(blob);
    } catch (_) {}
}

/* ----------------------------------------------------------
   RENDERIZADO INTEGRAL & ARRANQUE
   ---------------------------------------------------------- */
function renderAll() {
    renderCategoryPills();
    renderGradesCalculator();
    renderDeliveries();
    renderFlashcards();
    renderBugLogs();
    renderClassDoubts();
    renderTeamProjects();
    renderDeployChecklist();
    renderTasks();
    renderBookmarks();
    renderServers();
    renderSnippets();
    renderKanban();
    renderCustomCards();
    updateStats();
    updateClockDisplay();
    setNotesTab(appData.activeNotesTab || 'general');
    const presetSel = document.getElementById('workspace-preset-select');
    if (presetSel && appData.settings.preset) presetSel.value = appData.settings.preset;
}

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    applyAppearanceSettings();
    applyTheme();
    setupThemeListeners();
    setupDragAndDrop();
    setupKanbanDragAndDrop();
    setupSnippetContainerEvents();
    setupServersContainerEvents();
    setupNotesAutoSave();
    renderAll();
    applyLayoutState();
    syncRealTimeNetwork();
    registerBasicPwa();
    if (appData.settings.weatherEnabled) refreshWeatherBadge();

    window.addEventListener('keydown', e => {
        const isTyping = ['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName);

        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            document.getElementById('task-text')?.focus();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            pomodoroRunning ? stopPomodoro() : startCustomPomodoro('focus');
        } else if (e.altKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            toggleZenMode();
        } else if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
            e.preventDefault();
            const views = ['all', 'study', 'dev', 'focus'];
            setDashboardView(views[Number(e.key) - 1]);
        } else if (!isTyping && e.key === '?') {
            e.preventDefault();
            openShortcutsModal();
        } else if (e.key === 'Escape') {
            ['global-search-modal', 'card-visibility-modal', 'schedule-modal', 'auth-modal', 'appearance-modal', 'shortcuts-modal', 'snapshots-modal', 'daily-summary-modal']
                .forEach(id => { const m = document.getElementById(id); if (m) m.style.display = 'none'; });
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.style.display = 'none';
        });
    });
});