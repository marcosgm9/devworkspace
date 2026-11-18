/* ==========================================================
   DEVWORKSPACE ULTIMATE v5.9 - CORE APPLICATION ENGINE
   Modular Architecture & Production-Ready ES6+ (Zen & Performance)
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
   CONFIGURACIÓN FIREBASE
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

const LOCAL_STORAGE_KEY = 'devworkspace_v5_9_clean';

let currentUser = null;
let isRegisterMode = false;

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

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '⚠️' : '⚡';
    toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
}

/* ----------------------------------------------------------
   NOTIFICACIONES NATIVAS DE ESCRITORIO
   ---------------------------------------------------------- */
function requestNotificationPermission() {
    if ("Notification" in window && Notification.permission === "default") {
        Notification.requestPermission();
    }
}

function sendDesktopNotification(title, body) {
    if ("Notification" in window && Notification.permission === "granted") {
        try {
            new Notification(title, { body, icon: 'https://cdn-icons-png.flaticon.com/512/3076/3076129.png' });
        } catch (e) {
            console.warn("No se pudo enviar notificación nativa:", e);
        }
    }
}

/* ----------------------------------------------------------
   SNIPPETS POR DEFECTO
   ---------------------------------------------------------- */
const defaultSnippets = [];

/* ----------------------------------------------------------
   ESTADO INICIAL Y ESQUEMA
   ---------------------------------------------------------- */
const defaultCategories = [
    { key: 'all', label: '🚀 Todo' },
    { key: 'study', label: '🎓 Academia & Estudio' },
    { key: 'dev', label: '💻 Dev & SysAdmin Lab' },
    { key: 'focus', label: '⚡ Foco & Productividad' }
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
    activeNotesTab: 'general',
    grades: [],
    deliveries: [],
    snippets: [],
    studyKanban: [],
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
        editMode: false,
        zenMode: false,
        layout: {
            colLeft: ['card-kanban', 'card-grades', 'card-deliveries', 'card-tasks', 'card-notes', 'card-sticky'],
            colRight: ['card-study-stats', 'card-pomodoro', 'card-audio', 'card-snippets', 'card-schedule', 'card-bookmarks', 'card-servers']
        }
    }
};

let appData = structuredClone(defaultData);

/* ----------------------------------------------------------
   PERSISTENCIA & OFFLINE-FIRST (LOCALSTORAGE + FIRESTORE)
   ---------------------------------------------------------- */
function loadLocalData() {
    try {
        localStorage.removeItem('devworkspace_ultimate_v5_8');
        localStorage.removeItem('devworkspace_data_v5');

        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appData = deepMerge(defaultData, parsed);
        } else {
            appData = structuredClone(defaultData);
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        }
    } catch (e) {
        console.warn("Error leyendo localStorage:", e);
        appData = structuredClone(defaultData);
    }
}

window.resetWorkspacePrompt = function () {
    if (confirm("¿Estás seguro de que deseas vaciar todo el workspace a blanco? Se eliminarán todas las tareas, notas y elementos creados localmente.")) {
        appData = structuredClone(defaultData);
        try {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        } catch (e) {}
        applyTheme();
        renderAll();
        applyLayoutState();
        showToast("🧹 Workspace reiniciado completamente en blanco", "info");
    }
};

async function loadCloudData() {
    if (!currentUser) return;
    try {
        const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            appData = deepMerge(defaultData, docSnap.data());
        } else {
            await setDoc(docRef, appData);
        }
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
        applyTheme();
        renderAll();
        applyLayoutState();
        showToast("☁️ Datos sincronizados con Firestore", "success");
    } catch (e) {
        console.error("Error cargando de Firestore:", e);
        showToast("Modo local (Sin conexión con Firebase)", "error");
    }
}

const saveData = debounce(async function () {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(appData));
    } catch (e) {
        console.error("Error guardando en localStorage:", e);
    }

    if (currentUser) {
        try {
            const docRef = doc(db, "users", currentUser.uid, "workspace", "data");
            await setDoc(docRef, appData);
        } catch (e) {
            console.error("Error guardando en Firestore:", e);
        }
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
        console.error("Error de auth:", error);
        showToast(`Error: ${error.message}`, "error");
    }
};

window.logoutUser = async function () {
    try {
        await signOut(auth);
        currentUser = null;
        showToast("Sesión cerrada", "info");
        location.reload();
    } catch (error) {
        console.error("Error al salir:", error);
    }
};

window.openAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeAuthModal = function () {
    const modal = document.getElementById('auth-modal');
    if (modal) modal.style.display = 'none';
};

window.continueAsGuest = function () {
    closeAuthModal();
    showToast("⚡ Modo Local activo (Datos guardados en tu navegador)", "info");
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
   RELOJ, SKEW & API MADRID (ROBUSTO CON FALLBACK)
   ---------------------------------------------------------- */
let networkOffsetMs = 0;
let isManualMode = false;

window.syncRealTimeNetwork = async function () {
    const el = document.getElementById('net-status');
    if (isManualMode) {
        if (el) el.textContent = '✏️ Hora Manual Activa';
        return;
    }
    if (el) el.textContent = '🔄 Sincronizando...';
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000);
        const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid', { cache: 'no-store', signal: controller.signal });
        clearTimeout(timeoutId);
        if (!res.ok) throw new Error("Network response not ok");
        const data = await res.json();
        const serverTimeMs = new Date(data.datetime).getTime();
        networkOffsetMs = serverTimeMs - Date.now();
        if (el) {
            el.textContent = '🌐 Hora Real (API Madrid)';
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

/* ----------------------------------------------------------
   MODO ZEN / ENFOQUE TOTAL
   ---------------------------------------------------------- */
window.toggleZenMode = function () {
    appData.settings.zenMode = !appData.settings.zenMode;
    applyZenModeState();
    saveData();
    showToast(appData.settings.zenMode ? "🧘 Modo Zen activado" : "⚡ Modo Zen desactivado", "info");
};

function applyZenModeState() {
    const isZen = !!appData.settings.zenMode;
    const btnZen = document.getElementById('btn-zen-mode');
    if (btnZen) btnZen.classList.toggle('active', isZen);
    document.body.classList.toggle('zen-mode-active', isZen);
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

    const hexToRgb = hex => {
        const c = hex.replace('#', '');
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
   VISTAS, CATEGORÍAS & VISIBILIDAD DE TARJETAS
   ---------------------------------------------------------- */
function getAllCategories() {
    return [...defaultCategories, ...(appData.customCategories || [])];
}

function renderCategoryPills() {
    const container = document.getElementById('view-pills-container');
    if (!container) return;
    const activeView = appData.settings.activeDashboardView || 'all';

    container.innerHTML = getAllCategories().map(cat => `
        <button class="view-pill ${activeView === cat.key ? 'active' : ''}" 
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
    const btn = document.getElementById('btn-toggle-edit-mode');
    if (btn) btn.classList.toggle('active', appData.settings.editMode);
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
                <button onclick="toggleCardVisibility('${card.id}')" class="view-pill ${isHidden ? '' : 'active'}" style="font-size:0.65rem;padding:2px 8px;">
                    ${isHidden ? '👁️ Oculta' : '👁️ Visible'}
                </button>
            </div>
        `;
    }).join('');
}

window.toggleCardVisibility = function (cardId) {
    const hidden = appData.settings.hiddenCards || [];
    if (hidden.includes(cardId)) {
        appData.settings.hiddenCards = hidden.filter(id => id !== cardId);
    } else {
        hidden.push(cardId);
    }
    appData.settings.hiddenCards = hidden;
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
    const card = document.getElementById(cardId);
    if (card) card.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cardId);
};

function setupDragAndDrop() {
    const container = document.getElementById('dashboard-container');
    if (!container) return;

    document.addEventListener('dragend', () => {
        if (draggedCardId) {
            const card = document.getElementById(draggedCardId);
            if (card) card.classList.remove('dragging');
            draggedCardId = null;
            saveLayoutState();
        }
    });

    container.addEventListener('dragover', e => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const col = e.target.closest('.col-left, .col-right');
        const dragging = document.querySelector('.card.dragging');
        if (!col || !dragging) return;

        const siblings = [...col.querySelectorAll('.card:not(.dragging)')];
        const afterElement = siblings.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = e.clientY - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) {
                return { offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;

        if (afterElement == null) {
            col.appendChild(dragging);
        } else {
            col.insertBefore(dragging, afterElement);
        }
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
    const left = document.getElementById('col-left');
    const right = document.getElementById('col-right');
    if (!left || !right) return;

    (layout.colLeft || []).forEach(id => {
        const c = document.getElementById(id);
        if (c) left.appendChild(c);
    });

    (layout.colRight || []).forEach(id => {
        const c = document.getElementById(id);
        if (c) right.appendChild(c);
    });

    (appData.settings.collapsedCards || []).forEach(id => {
        const c = document.getElementById(id);
        if (c) {
            c.classList.add('collapsed');
            const btn = c.querySelector('.btn-collapse');
            if (btn) btn.textContent = '+';
        }
    });
    applyZenModeState();
}

/* ----------------------------------------------------------
   KANBAN DE ESTUDIO
   ---------------------------------------------------------- */
window.addKanbanTask = function () {
    const titleInput = document.getElementById('kanban-new-title');
    const title = titleInput?.value.trim();
    if (!title) return;

    const subject = document.getElementById('kanban-new-subject')?.value.trim() || 'DAM';
    const priority = document.getElementById('kanban-new-prio')?.value || 'medium';
    const pomos = parseInt(document.getElementById('kanban-new-pomos')?.value, 10) || 2;

    appData.studyKanban.push({
        id: Date.now(),
        title,
        subject,
        col: 'todo',
        pomos,
        donePomos: 0,
        priority
    });

    titleInput.value = '';
    saveData();
    renderKanban();
    toggleForm('form-kanban-add');
    showToast("Tema de estudio añadido", "success");
};

window.moveKanbanTask = function (id, targetCol) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    task.col = targetCol;
    saveData();
    renderKanban();
};

window.incKanbanPomo = function (id) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    task.donePomos = Math.min((task.donePomos || 0) + 1, task.pomos);
    if (task.donePomos === task.pomos && task.col === 'doing') {
        task.col = 'done';
    }
    saveData();
    renderKanban();
};

window.linkKanbanToPomo = function (id) {
    const task = appData.studyKanban.find(t => t.id === id);
    if (!task) return;
    const targetEl = document.getElementById('pomodoro-target');
    if (targetEl) targetEl.textContent = `Objetivo: [${escapeHtml(task.subject)}] ${escapeHtml(task.title)}`;
    showToast(`Pomodoro vinculado a "${task.title}"`, "info");
};

window.deleteKanbanTask = function (id) {
    appData.studyKanban = appData.studyKanban.filter(t => t.id !== id);
    saveData();
    renderKanban();
};

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
                <div class="kanban-card">
                    <div class="kanban-card-header">
                        <span class="kanban-subject-tag">${escapeHtml(t.subject)}</span>
                        <span>${prioIcon}</span>
                    </div>
                    <div class="kanban-card-title">${escapeHtml(t.title)}</div>
                    <div class="kanban-card-footer">
                        <span onclick="linkKanbanToPomo(${t.id})" style="cursor:pointer;" title="Vincular a Pomodoro">🍅 ${t.donePomos || 0}/${t.pomos}</span>
                        <div class="kanban-nav-btns">
                            ${prevCol ? `<button class="kanban-nav-btn" onclick="moveKanbanTask(${t.id}, '${prevCol}')" title="Mover atrás">←</button>` : ''}
                            <button class="kanban-nav-btn" onclick="incKanbanPomo(${t.id})" title="+1 Pomodoro">🍅+</button>
                            ${nextCol ? `<button class="kanban-nav-btn" onclick="moveKanbanTask(${t.id}, '${nextCol}')" title="Avanzar">→</button>` : ''}
                            <button class="kanban-nav-btn" onclick="deleteKanbanTask(${t.id})" title="Eliminar">✖</button>
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
   CALCULADORA DE CALIFICACIONES PONDERADAS
   ---------------------------------------------------------- */
window.addGradeSubject = function () {
    const nameInput = document.getElementById('new-grade-subj-name');
    const name = nameInput?.value.trim();
    if (!name) return;
    const target = parseFloat(document.getElementById('new-grade-subj-target')?.value) || 5.0;

    appData.grades.push({
        id: Date.now(),
        subject: name,
        target,
        items: []
    });

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
    const name = prompt("Nombre de la prueba / práctica / examen:");
    if (!name || !name.trim()) return;
    const grade = parseFloat(prompt("Nota obtenida (0 a 10):", "7.0")) || 0;
    const weight = parseFloat(prompt("Peso porcentual (%) en el módulo:", "20")) || 20;

    const subj = appData.grades.find(g => g.id === subjId);
    if (subj) {
        if (!subj.items) subj.items = [];
        subj.items.push({ id: Date.now(), name: name.trim(), grade, weight });
        saveData();
        renderGradesCalculator();
    }
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
    if (!container) return;

    if (!appData.grades.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:12px;">Sin módulos registrados. ¡Añade tu primera asignatura!</div>`;
        return;
    }

    container.innerHTML = appData.grades.map(g => {
        const items = g.items || [];
        const totalWeight = items.reduce((acc, i) => acc + (parseFloat(i.weight) || 0), 0);
        const weightedSum = items.reduce((acc, i) => acc + ((parseFloat(i.grade) || 0) * (parseFloat(i.weight) || 0)), 0);
        const currentAvg = totalWeight > 0 ? (weightedSum / totalWeight).toFixed(2) : '0.00';
        const isPassing = parseFloat(currentAvg) >= (g.target || 5.0);
        const percentProgress = Math.min(Math.round((parseFloat(currentAvg) / 10) * 100), 100);

        return `
            <div class="grade-subject-card">
                <div class="grade-subj-header">
                    <div>
                        <span class="grade-subj-name">${escapeHtml(g.subject)}</span>
                        <span style="font-size:0.62rem;color:var(--text-muted);margin-left:4px;">(Obj: ${g.target || 5.0})</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:4px;">
                        <span class="grade-subj-score ${isPassing ? 'score-pass' : 'score-fail'}">${currentAvg}</span>
                        <button class="btn-icon" onclick="deleteGradeSubject(${g.id})" title="Eliminar Módulo">✖</button>
                    </div>
                </div>

                <div class="grade-progress-bar-bg" title="Evaluado: ${totalWeight}%">
                    <div class="grade-progress-bar-fill" style="width: ${percentProgress}%;"></div>
                </div>

                <div class="grade-items-list">
                    ${items.map(i => `
                        <div class="grade-item-row">
                            <span>${escapeHtml(i.name)} (${i.weight}%)</span>
                            <div style="display:flex;gap:4px;align-items:center;">
                                <strong style="color:var(--accent-cyan);">${Number(i.grade).toFixed(1)}</strong>
                                <button class="btn-icon" onclick="deleteGradeItem(${g.id}, ${i.id})" title="Eliminar item" style="font-size:0.65rem;">✖</button>
                            </div>
                        </div>
                    `).join('')}
                </div>

                <button class="btn-toggle" onclick="addGradeItemPrompt(${g.id})" style="margin-top:2px;">✚ Añadir Nota / Examen (${totalWeight}% sumado)</button>
            </div>
        `;
    }).join('');
}

/* ----------------------------------------------------------
   ENTREGAS & EXÁMENES CON CUENTA REGRESIVA
   ---------------------------------------------------------- */
let activeDeliveriesFilter = 'all';

window.setDeliveriesFilter = function (filter) {
    activeDeliveriesFilter = filter;
    ['all', 'exam', 'practice', 'pending'].forEach(f => {
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

    if (!dueDate) {
        showToast("Selecciona fecha y hora de entrega", "error");
        return;
    }

    appData.deliveries.push({
        id: Date.now(),
        title,
        subject,
        type,
        dueDate,
        done: false
    });

    titleInput.value = '';
    saveData();
    renderDeliveries();
    toggleForm('form-add-delivery');
    showToast("Fecha límite guardada", "success");
};

window.toggleDeliveryDone = function (id) {
    const deliv = appData.deliveries.find(d => d.id === id);
    if (!deliv) return;
    deliv.done = !deliv.done;
    saveData();
    renderDeliveries();
};

window.deleteDelivery = function (id) {
    appData.deliveries = appData.deliveries.filter(d => d.id !== id);
    saveData();
    renderDeliveries();
};

function formatCountdown(targetIsoDate) {
    const now = getClockDate().getTime();
    const target = new Date(targetIsoDate).getTime();
    const diff = target - now;

    if (isNaN(target)) return { text: '--', badgeClass: 'cd-ok' };
    if (diff < 0) {
        const passedHrs = Math.floor(Math.abs(diff) / 3600000);
        return { text: `⚠️ Vencido (${passedHrs}h)`, badgeClass: 'cd-urgent' };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days === 0 && hours < 5) {
        return { text: `🔥 ¡${hours}h ${mins}m!`, badgeClass: 'cd-urgent' };
    } else if (days < 2) {
        return { text: `⏳ ${days}d ${hours}h`, badgeClass: 'cd-warn' };
    }
    return { text: `📅 ${days}d ${hours}h`, badgeClass: 'cd-ok' };
}

function updateDeliveriesCountdown() {
    document.querySelectorAll('.deadline-countdown-badge').forEach(el => {
        const dateIso = el.getAttribute('data-due');
        const isDone = el.getAttribute('data-done') === 'true';
        if (isDone) return;
        const res = formatCountdown(dateIso);
        el.textContent = res.text;
        el.className = `countdown-badge deadline-countdown-badge ${res.badgeClass}`;
    });
}

function renderDeliveries() {
    const container = document.getElementById('deliveries-list');
    if (!container) return;

    let items = [...(appData.deliveries || [])];
    if (activeDeliveriesFilter === 'exam') items = items.filter(d => d.type === 'Examen');
    else if (activeDeliveriesFilter === 'practice') items = items.filter(d => d.type === 'Práctica');
    else if (activeDeliveriesFilter === 'pending') items = items.filter(d => !d.done);

    items.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));

    if (!items.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:12px;">No hay entregas pendientes en esta vista.</div>`;
        return;
    }

    container.innerHTML = items.map(d => {
        const cd = formatCountdown(d.dueDate);
        const formattedDate = new Date(d.dueDate).toLocaleString('es-ES', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
            <div class="deadline-card-item">
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
                <div style="display:flex;align-items:center;gap:6px;">
                    <span class="countdown-badge deadline-countdown-badge ${d.done ? 'cd-done' : cd.badgeClass}" 
                          data-due="${escapeHtml(d.dueDate)}" 
                          data-done="${d.done}">${d.done ? 'Completado' : cd.text}</span>
                    <button class="btn-icon" onclick="deleteDelivery(${d.id})" title="Eliminar">✖</button>
                </div>
            </div>
        `;
    }).join('');
}

/* ----------------------------------------------------------
   TAREAS GENERALES
   ---------------------------------------------------------- */
let activeTaskFilter = 'all';

window.setTaskFilter = function (filter) {
    activeTaskFilter = filter;
    ['all', 'pending', 'done'].forEach(f => {
        document.getElementById(`filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderTasks();
};

window.addTask = function () {
    const textInput = document.getElementById('task-text');
    const text = textInput?.value.trim();
    if (!text) return;

    const priority = document.getElementById('task-priority')?.value || 'medium';
    const date = document.getElementById('task-date')?.value || '';

    appData.tasks.push({
        id: Date.now(),
        text,
        priority,
        date,
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
    appData.tasks = appData.tasks.filter(x => x.id !== id);
    saveData();
    renderTasks();
    updateStats();
};

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    let items = appData.tasks || [];
    if (activeTaskFilter === 'pending') items = items.filter(t => !t.done);
    else if (activeTaskFilter === 'done') items = items.filter(t => t.done);

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
                    <button onclick="deleteTask(${t.id})" class="btn-icon" title="Eliminar">✖</button>
                </div>
            </li>
        `;
    }).join('');
}

/* ----------------------------------------------------------
   SCRATCHPAD MULTI-PESTAÑA & STICKY NOTE
   ---------------------------------------------------------- */
window.setNotesTab = function (tabKey) {
    appData.activeNotesTab = tabKey;
    ['general', 'comandos', 'clases'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tabKey);
    });
    const textarea = document.getElementById('scratchpad');
    if (textarea) {
        textarea.value = (appData.notes && appData.notes[tabKey]) || '';
    }
    saveData();
};

window.toolCopy = function () {
    const textarea = document.getElementById('scratchpad');
    if (!textarea) return;
    navigator.clipboard.writeText(textarea.value).then(() => {
        showToast("📋 Notas copiadas al portapapeles", "success");
    }).catch(() => {
        textarea.select();
        document.execCommand('copy');
        showToast("📋 Notas copiadas", "success");
    });
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
    showToast("💾 Notas descargadas", "success");
};

window.copyStickyNote = function () {
    const el = document.getElementById('sticky-note-input');
    if (!el || !el.value) return;
    navigator.clipboard.writeText(el.value).then(() => {
        showToast("📌 Buffer temporal copiado", "success");
    });
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
        scratchpad.addEventListener('input', debounce(e => {
            const tabKey = appData.activeNotesTab || 'general';
            if (!appData.notes) appData.notes = {};
            appData.notes[tabKey] = e.target.value;
            saveData();
        }, 400));
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

/* ----------------------------------------------------------
   MÉTRICAS & GRÁFICO HISTÓRICO DE ESTUDIO
   ---------------------------------------------------------- */
function updateStats() {
    const statToday = document.getElementById('stat-focus-today');
    if (statToday) statToday.textContent = `${appData.studyStats.todayFocusMinutes || 0}m`;

    const statTotal = document.getElementById('stat-focus-total');
    if (statTotal) {
        const hrs = ((appData.studyStats.totalFocusMinutes || 0) / 60).toFixed(1);
        statTotal.textContent = `${hrs}h`;
    }

    const statStreak = document.getElementById('stat-streak');
    if (statStreak) statStreak.textContent = `🔥 ${appData.studyStats.streakDays || 0}d`;

    const statRatio = document.getElementById('stat-ratio');
    if (statRatio) {
        const tasks = appData.tasks || [];
        const completed = tasks.filter(t => t.done).length;
        const pct = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        statRatio.textContent = `${pct}%`;
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

    let weekSum = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - 86400000 * i);
        const iso = d.toISOString().slice(0, 10);
        let mins = 0;
        if (i === 0) {
            mins = appData.studyStats.todayFocusMinutes || 0;
        } else {
            const entry = history.find(h => h.date === iso);
            mins = entry ? entry.minutes : 0;
        }
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

    appData.studyStats.todayFocusMinutes = (appData.studyStats.todayFocusMinutes || 0) + mins;
    appData.studyStats.totalFocusMinutes = (appData.studyStats.totalFocusMinutes || 0) + mins;

    input.value = '';
    saveData();
    updateStats();
    showToast(`+${mins}m registrados en tus métricas`, "success");
};

window.resetStudyStats = function () {
    if (!confirm("¿Deseas reiniciar tus métricas de estudio de hoy?")) return;
    appData.studyStats.todayFocusMinutes = 0;
    saveData();
    updateStats();
    showToast("Métricas reiniciadas", "info");
};

/* ----------------------------------------------------------
   POMODORO PRO CON CHIME Y NOTIFICACIÓN NATIVA
   ---------------------------------------------------------- */
let pomodoroTimer = null;
let pomodoroSecondsLeft = 25 * 60;
let pomodoroMode = 'focus';
let pomodoroRunning = false;

window.startCustomPomodoro = function (mode) {
    requestNotificationPermission();
    clearInterval(pomodoroTimer);
    pomodoroMode = mode;
    const focusSelect = document.getElementById('pomo-focus-time');
    const breakSelect = document.getElementById('pomo-break-time');

    const focusMins = parseInt(focusSelect?.value, 10) || 25;
    const breakMins = parseInt(breakSelect?.value, 10) || 5;

    const durationMins = mode === 'focus' ? focusMins : breakMins;
    pomodoroSecondsLeft = durationMins * 60;
    pomodoroRunning = true;

    updatePomodoroDisplay();

    pomodoroTimer = setInterval(() => {
        pomodoroSecondsLeft--;
        if (pomodoroSecondsLeft <= 0) {
            clearInterval(pomodoroTimer);
            pomodoroRunning = false;
            handlePomodoroComplete(mode, durationMins);
        }
        updatePomodoroDisplay();
    }, 1000);

    showToast(`⏱️ Pomodoro (${mode === 'focus' ? 'Foco' : 'Break'}) iniciado`, "info");
};

window.stopPomodoro = function () {
    clearInterval(pomodoroTimer);
    pomodoroRunning = false;
    const focusSelect = document.getElementById('pomo-focus-time');
    const focusMins = parseInt(focusSelect?.value, 10) || 25;
    pomodoroSecondsLeft = focusMins * 60;
    updatePomodoroDisplay();
    document.title = 'DevWorkspace - Dashboard';
    showToast("Pomodoro detenido", "info");
};

function updatePomodoroDisplay() {
    const mins = Math.floor(pomodoroSecondsLeft / 60).toString().padStart(2, '0');
    const secs = (pomodoroSecondsLeft % 60).toString().padStart(2, '0');
    const text = `${mins}:${secs}`;
    const display = document.getElementById('pomodoro-display');
    if (display) display.textContent = text;
    if (pomodoroRunning) {
        document.title = `(${text}) DevWorkspace`;
    }
}

function handlePomodoroComplete(mode, durationMins) {
    playNotificationChime();
    document.title = '🔔 ¡Tiempo cumplido! DevWorkspace';

    if (mode === 'focus') {
        appData.studyStats.todayFocusMinutes = (appData.studyStats.todayFocusMinutes || 0) + durationMins;
        appData.studyStats.totalFocusMinutes = (appData.studyStats.totalFocusMinutes || 0) + durationMins;
        saveData();
        updateStats();
        showToast(`🎉 ¡Sesión de foco de ${durationMins}m completada!`, "success");
        sendDesktopNotification("Pomodoro Finalizado", `¡Excelente trabajo! Has completado ${durationMins} minutos de enfoque.`);
    } else {
        showToast("☕ ¡Break terminado! Listo para volver a programar", "info");
        sendDesktopNotification("Break Finalizado", "El tiempo de descanso ha terminado. ¡A por la siguiente sesión!");
    }
}

function playNotificationChime() {
    try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
        osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.3); // A5

        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    } catch (e) {
        console.warn("Audio chime no disponible:", e);
    }
}

/* ----------------------------------------------------------
   SINTETIZADOR DE AUDIO (CON LIMPIEZA ESTRICTA DE MEMORIA)
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
        if (!this.ctx) {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    play(type, volumePct) {
        this.init();
        this.stop();

        const gainVal = Math.max(0.01, (volumePct / 100) * 0.4);

        if (type.startsWith('binaural')) {
            this.playBinaural(type, gainVal);
            return;
        }

        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);

        if (type === 'brown') {
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                data[i] = (lastOut + (0.02 * white)) / 1.02;
                lastOut = data[i];
                data[i] *= 3.5;
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
                data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                data[i] *= 0.11;
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
            for (let i = 0; i < bufferSize; i++) {
                data[i] = Math.random() * 2 - 1;
            }
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

    playBinaural(type, gainVal) {
        const carrier = type === 'binaural-alpha' ? 200 : 150;
        const diff = type === 'binaural-alpha' ? 10 : 6;

        const merger = this.ctx.createChannelMerger(2);

        this.leftOsc = this.ctx.createOscillator();
        this.leftOsc.frequency.value = carrier;

        this.rightOsc = this.ctx.createOscillator();
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
    }

    stop() {
        if (this.source) {
            try { this.source.stop(); } catch (e) {}
            try { this.source.disconnect(); } catch (e) {}
            this.source = null;
        }
        if (this.leftOsc) {
            try { this.leftOsc.stop(); } catch (e) {}
            try { this.leftOsc.disconnect(); } catch (e) {}
            this.leftOsc = null;
        }
        if (this.rightOsc) {
            try { this.rightOsc.stop(); } catch (e) {}
            try { this.rightOsc.disconnect(); } catch (e) {}
            this.rightOsc = null;
        }
        if (this.gainNode) {
            try { this.gainNode.disconnect(); } catch (e) {}
            this.gainNode = null;
        }
        this.isPlaying = false;
        this.updateVisualizerState(false);
    }

    setVolume(pct) {
        if (this.gainNode && this.ctx) {
            const val = Math.max(0.01, (pct / 100) * 0.4);
            this.gainNode.gain.setValueAtTime(val, this.ctx.currentTime);
        }
    }

    updateVisualizerState(active) {
        const visualizer = document.getElementById('audio-visualizer');
        if (visualizer) {
            visualizer.classList.toggle('audio-playing', active);
        }
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
        showToast("Audio pausado", "info");
    } else {
        synth.play(type, vol);
        if (btn) btn.textContent = '⏹ Stop';
        showToast("Audio sintético activado", "info");
    }
};

window.handleAudioTypeChange = function (val) {
    if (synth.isPlaying) {
        const vol = parseInt(document.getElementById('audio-volume')?.value, 10) || 40;
        synth.play(val, vol);
    }
};

window.updateAudioVolume = function (val) {
    const lbl = document.getElementById('audio-vol-text');
    if (lbl) lbl.textContent = `${val}%`;
    synth.setVolume(val);
};

/* ----------------------------------------------------------
   SNIPPET & COMMAND LAB
   ---------------------------------------------------------- */
window.addCustomSnippet = function () {
    const titleInput = document.getElementById('snip-new-title');
    const title = titleInput?.value.trim();
    if (!title) return;

    const cat = document.getElementById('snip-new-cat')?.value.trim() || 'Custom';
    const cmd = document.getElementById('snip-new-cmd')?.value.trim();
    if (!cmd) return;

    if (!appData.snippets) appData.snippets = [];
    appData.snippets.push({
        id: 'c_' + Date.now(),
        title,
        cat,
        cmd,
        isCustom: true
    });

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

window.copySnippetText = function (btn, text) {
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.textContent;
        btn.textContent = '✓ Copiado';
        btn.style.color = 'var(--accent-green)';
        setTimeout(() => {
            btn.textContent = orig;
            btn.style.color = '';
        }, 1500);
        showToast("Comando copiado al portapapeles", "success");
    });
};

function getAllSnippets() {
    return [...defaultSnippets, ...(appData.snippets || [])];
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
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);font-size:0.72rem;padding:16px;">No hay comandos guardados. Haz clic en "✚ Añadir Snippet" para registrar tus comandos favoritos.</div>`;
        return;
    }

    container.innerHTML = list.map(s => `
        <div class="snippet-box">
            <div style="flex:1;overflow:hidden;">
                <div style="font-size:0.62rem;color:var(--text-muted);display:flex;justify-content:space-between;">
                    <span>[${escapeHtml(s.cat)}] ${escapeHtml(s.title)}</span>
                </div>
                <code class="snippet-cmd-text">${escapeHtml(s.cmd)}</code>
            </div>
            <div style="display:flex;gap:3px;align-items:center;">
                <button class="btn-icon" onclick="copySnippetText(this, \`${escapeHtml(s.cmd)}\`)" title="Copiar">📋</button>
                ${s.isCustom ? `<button class="btn-icon" onclick="deleteCustomSnippet('${s.id}')" title="Eliminar">✖</button>` : ''}
            </div>
        </div>
    `).join('');
};

/* ----------------------------------------------------------
   HORARIO SEMANAL & CLASE ACTUAL
   ---------------------------------------------------------- */
let scheduleViewTable = false;

window.toggleScheduleViewMode = function () {
    scheduleViewTable = !scheduleViewTable;
    updateScheduleWidget(getClockDate());
};

function updateScheduleWidget(now) {
    const widget = document.getElementById('schedule-widget');
    if (!widget) return;

    if (!appData.schedule || appData.schedule.length === 0) {
        widget.innerHTML = `
            <div class="sch-status">📅 Horario Sin Clases</div>
            <div class="sch-detail">Haz clic en ⚙️ para registrar tus asignaturas y horario semanal.</div>
        `;
        return;
    }

    const currentDay = now.getDay();
    const currentMins = now.getHours() * 60 + now.getMinutes();

    if (scheduleViewTable) {
        const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
        widget.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                <span style="font-weight:700;color:var(--accent-cyan);">Horario Semanal</span>
                <span style="font-size:0.6rem;color:var(--text-muted);cursor:pointer;" onclick="toggleScheduleViewMode()">Volver a vista actual</span>
            </div>
            <table class="sch-table">
                <thead>
                    <tr><th>Día</th><th>Horas</th><th>Asignatura</th><th>Aula</th></tr>
                </thead>
                <tbody>
                    ${(appData.schedule || []).sort((a,b) => a.day - b.day || a.start.localeCompare(b.start)).map(s => `
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
        widget.innerHTML = `
            <div class="sch-status">🌴 Fin de Semana</div>
            <div class="sch-detail">Sin clases programadas. ¡Buen momento para repasar o descansar!</div>
        `;
        return;
    }

    const todayClasses = (appData.schedule || [])
        .filter(s => parseInt(s.day, 10) === currentDay)
        .sort((a, b) => a.start.localeCompare(b.start));

    if (!todayClasses.length) {
        widget.innerHTML = `
            <div class="sch-status">☕ Sin Clases Hoy</div>
            <div class="sch-detail">No hay asignaturas en el horario para hoy.</div>
        `;
        return;
    }

    let currentClass = null;
    let nextClass = null;

    for (const c of todayClasses) {
        const [sh, sm] = c.start.split(':').map(Number);
        const [eh, em] = c.end.split(':').map(Number);
        const startMins = sh * 60 + sm;
        const endMins = eh * 60 + em;

        if (currentMins >= startMins && currentMins < endMins) {
            currentClass = { ...c, remainingMins: endMins - currentMins };
            break;
        } else if (currentMins < startMins && !nextClass) {
            nextClass = { ...c, startsIn: startMins - currentMins };
        }
    }

    if (currentClass) {
        widget.innerHTML = `
            <div class="sch-status">🟢 En Clase: <strong style="color:var(--accent-cyan);">${escapeHtml(currentClass.subject)}</strong></div>
            <div class="sch-detail">Aula: ${escapeHtml(currentClass.room || '204')} &bull; Finaliza en <strong>${currentClass.remainingMins} min</strong> (${currentClass.end})</div>
        `;
    } else if (nextClass) {
        widget.innerHTML = `
            <div class="sch-status">🟡 Próxima Clase: <strong>${escapeHtml(nextClass.subject)}</strong></div>
            <div class="sch-detail">Comienza a las ${escapeHtml(nextClass.start)} (en <strong>${nextClass.startsIn} min</strong>) en ${escapeHtml(nextClass.room || 'Aula')}</div>
        `;
    } else {
        widget.innerHTML = `
            <div class="sch-status">☕ Clases del día finalizadas</div>
            <div class="sch-detail">Has completado tu jornada lectiva de hoy.</div>
        `;
    }
}

window.openScheduleModal = function () {
    renderScheduleEditor();
    const modal = document.getElementById('schedule-modal');
    if (modal) modal.style.display = 'flex';
};

window.closeScheduleModal = function () {
    const modal = document.getElementById('schedule-modal');
    if (modal) modal.style.display = 'none';
};

window.addScheduleClass = function () {
    const day = parseInt(document.getElementById('sch-add-day')?.value, 10) || 1;
    const start = document.getElementById('sch-add-start')?.value;
    const end = document.getElementById('sch-add-end')?.value;
    const subject = document.getElementById('sch-add-subject')?.value.trim();
    const room = document.getElementById('sch-add-room')?.value.trim() || 'Aula 204';

    if (!start || !end || !subject) {
        showToast("Introduce hora de inicio, fin y asignatura", "error");
        return;
    }

    if (!appData.schedule) appData.schedule = [];
    appData.schedule.push({
        id: Date.now(),
        day,
        start,
        end,
        subject,
        room
    });

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
    showToast("Horario vaciado", "info");
};

function renderScheduleEditor() {
    const container = document.getElementById('schedule-list-editor');
    if (!container) return;

    const days = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const items = [...(appData.schedule || [])].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));

    if (!items.length) {
        container.innerHTML = `<div style="text-align:center;color:var(--text-muted);padding:10px;">Sin clases registradas</div>`;
        return;
    }

    container.innerHTML = items.map(s => `
        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;border:1px solid var(--card-border);font-family:var(--font-mono);font-size:0.72rem;">
            <span><strong>${days[s.day - 1]}</strong>: ${escapeHtml(s.start)}-${escapeHtml(s.end)} | <span style="color:var(--accent-cyan);">${escapeHtml(s.subject)}</span> (${escapeHtml(s.room)})</span>
            <button class="btn-icon" onclick="deleteScheduleClass(${s.id})">✖</button>
        </div>
    `).join('');
}

/* ----------------------------------------------------------
   ENLACES & DOCUMENTACIÓN
   ---------------------------------------------------------- */
window.addBookmark = function () {
    const nameInput = document.getElementById('bm-name');
    const name = nameInput?.value.trim();
    const urlInput = document.getElementById('bm-url');
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
    appData.bookmarks = appData.bookmarks.filter(b => b.id !== id);
    saveData();
    renderBookmarks();
};

window.renderBookmarks = function () {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;

    const search = document.getElementById('bm-search-filter')?.value.toLowerCase().trim() || '';
    let items = appData.bookmarks || [];

    if (search) {
        items = items.filter(b => b.name.toLowerCase().includes(search) || b.url.toLowerCase().includes(search));
    }

    if (!items.length) {
        list.innerHTML = `<li style="justify-content:center;color:var(--text-muted);">Sin enlaces coincidentes</li>`;
        return;
    }

    list.innerHTML = items.map(b => `
        <li>
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer">🔖 ${escapeHtml(b.name)}</a>
            <button onclick="deleteBookmark(${b.id})" class="btn-icon" title="Eliminar">✖</button>
        </li>
    `).join('');
};

/* ----------------------------------------------------------
   SERVIDORES & VMS
   ---------------------------------------------------------- */
window.addServer = function () {
    const nameInput = document.getElementById('srv-name');
    const name = nameInput?.value.trim();
    const ip = document.getElementById('srv-ip')?.value.trim();
    const creds = document.getElementById('srv-creds')?.value.trim() || 'root';

    if (!name || !ip) return;

    appData.servers.push({ id: Date.now(), name, ip, creds });
    nameInput.value = '';
    document.getElementById('srv-ip').value = '';
    saveData();
    renderServers();
    toggleForm('form-servers');
    showToast("Servidor registrado", "success");
};

window.deleteServer = function (id) {
    appData.servers = appData.servers.filter(s => s.id !== id);
    saveData();
    renderServers();
};

window.copyServerIp = function (ip) {
    navigator.clipboard.writeText(ip).then(() => {
        showToast(`IP ${ip} copiada`, "success");
    });
};

window.copyServerSsh = function (ip, creds) {
    const user = creds.includes('/') ? creds.split('/')[0].trim() : 'root';
    const cmd = `ssh ${user}@${ip}`;
    navigator.clipboard.writeText(cmd).then(() => {
        showToast(`Comando "${cmd}" copiado`, "success");
    });
};

window.renderServers = function () {
    const list = document.getElementById('servers-list');
    if (!list) return;

    const search = document.getElementById('srv-search-filter')?.value.toLowerCase().trim() || '';
    let items = appData.servers || [];

    if (search) {
        items = items.filter(s => s.name.toLowerCase().includes(search) || s.ip.toLowerCase().includes(search));
    }

    if (!items.length) {
        list.innerHTML = `<li style="justify-content:center;color:var(--text-muted);">Sin servidores registrados</li>`;
        return;
    }

    list.innerHTML = items.map(s => `
        <li>
            <div style="display:flex;flex-direction:column;">
                <span>🖥️ <strong>${escapeHtml(s.name)}</strong></span>
                <span style="font-size:0.62rem;color:var(--text-muted);font-family:var(--font-mono);">${escapeHtml(s.ip)} | ${escapeHtml(s.creds)}</span>
            </div>
            <div style="display:flex;gap:3px;align-items:center;">
                <button class="btn-icon" onclick="copyServerIp('${escapeHtml(s.ip)}')" title="Copiar IP">📋</button>
                <button class="btn-icon" onclick="copyServerSsh('${escapeHtml(s.ip)}', '${escapeHtml(s.creds)}')" title="Copiar comando SSH">⚡</button>
                <button class="btn-icon" onclick="deleteServer(${s.id})" title="Eliminar">✖</button>
            </div>
        </li>
    `).join('');
};

/* ----------------------------------------------------------
   TARJETAS PERSONALIZADAS
   ---------------------------------------------------------- */
window.createCustomCard = function () {
    const title = document.getElementById('new-card-title')?.value.trim();
    if (!title) return;

    const category = document.getElementById('new-card-category')?.value || 'dev';
    const type = document.getElementById('new-card-type')?.value || 'notes';
    const id = 'custom_card_' + Date.now();

    const newCard = {
        id,
        title,
        category,
        type,
        content: type === 'checklist' ? [] : ''
    };

    if (!appData.customCards) appData.customCards = [];
    appData.customCards.push(newCard);
    appData.cardCategories[id] = category;

    if (!appData.settings.layout.colLeft.includes(id) && !appData.settings.layout.colRight.includes(id)) {
        appData.settings.layout.colLeft.push(id);
    }

    document.getElementById('new-card-title').value = '';
    saveData();
    renderCustomCards();
    toggleForm('form-create-card-panel');
    showToast(`Tarjeta "${title}" creada`, "success");
};

window.deleteCustomCard = function (id) {
    if (!confirm("¿Deseas eliminar esta tarjeta personalizada?")) return;
    appData.customCards = (appData.customCards || []).filter(c => c.id !== id);
    appData.settings.layout.colLeft = (appData.settings.layout.colLeft || []).filter(x => x !== id);
    appData.settings.layout.colRight = (appData.settings.layout.colRight || []).filter(x => x !== id);
    const el = document.getElementById(id);
    if (el) el.remove();
    saveData();
    renderVisibilityControls();
    showToast("Tarjeta eliminada", "info");
};

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
                <div id="check-${cardData.id}" style="display:flex;flex-direction:column;gap:3px;max-height:120px;overflow-y:auto;">
                    ${((cardData.content || [])).map((item, idx) => `
                        <div style="display:flex;justify-content:space-between;align-items:center;background:rgba(0,0,0,0.25);padding:3px 6px;border-radius:3px;">
                            <span onclick="toggleCustomCheckItem('${cardData.id}', ${idx})" style="cursor:pointer;${item.done ? 'text-decoration:line-through;color:var(--text-muted);' : ''}">${item.done ? '✅' : '⬜'} ${escapeHtml(item.text)}</span>
                            <button class="btn-icon" onclick="deleteCustomCheckItem('${cardData.id}', ${idx})">✖</button>
                        </div>
                    `).join('')}
                </div>
                <div style="display:flex;gap:4px;margin-top:4px;">
                    <input type="text" id="input-${cardData.id}" placeholder="Nuevo ítem..." style="flex:1;">
                    <button onclick="addCustomCheckItem('${cardData.id}')" class="btn-green">✚</button>
                </div>
            `;
        } else if (cardData.type === 'iframe') {
            bodyHtml = `
                <div style="display:flex;gap:4px;margin-bottom:4px;">
                    <input type="url" id="url-${cardData.id}" value="${escapeHtml(cardData.content || '')}" placeholder="https://..." style="flex:1;">
                    <button onclick="updateCustomCardEmbed('${cardData.id}')" class="btn-cyan">Cargar</button>
                </div>
                <iframe src="${escapeHtml(cardData.content || 'about:blank')}" style="width:100%;height:150px;border:1px solid var(--card-border);border-radius:4px;" sandbox="allow-scripts allow-same-origin"></iframe>
            `;
        }

        card.innerHTML = `
            <div class="card-header">
                <span class="card-title-text">🛠️ ${escapeHtml(cardData.title)}</span>
                <div class="card-actions">
                    <button class="btn-icon" onclick="deleteCustomCard('${cardData.id}')" title="Eliminar Tarjeta">🗑️</button>
                    <div class="edit-controls">
                        <select class="card-category-select" onchange="updateCardCategory('${cardData.id}', this.value)"></select>
                        <button class="btn-icon" onclick="toggleCardVisibility('${cardData.id}')" title="Ocultar Tarjeta">👁️</button>
                    </div>
                    <button class="btn-icon btn-collapse" onclick="toggleCardCollapse('${cardData.id}')">_</button>
                    <span class="drag-handle" draggable="true" ondragstart="handleDragStart(event, '${cardData.id}')">⋮⋮</span>
                </div>
            </div>
            <div class="card-body">${bodyHtml}</div>
        `;

        const targetCol = (appData.settings.layout?.colRight || []).includes(cardData.id) ? 
            document.getElementById('col-right') : document.getElementById('col-left');
        if (targetCol) targetCol.appendChild(card);
    });

    populateCategorySelectors();
}

window.updateCustomCardNotes = debounce(function (id, text) {
    const card = (appData.customCards || []).find(c => c.id === id);
    if (card) {
        card.content = text;
        saveData();
    }
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
        const el = document.getElementById(cardId);
        if (el) el.remove();
        renderCustomCards();
    }
};

window.toggleCustomCheckItem = function (cardId, idx) {
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card && card.content && card.content[idx]) {
        card.content[idx].done = !card.content[idx].done;
        saveData();
        const el = document.getElementById(cardId);
        if (el) el.remove();
        renderCustomCards();
    }
};

window.deleteCustomCheckItem = function (cardId, idx) {
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card && card.content) {
        card.content.splice(idx, 1);
        saveData();
        const el = document.getElementById(cardId);
        if (el) el.remove();
        renderCustomCards();
    }
};

window.updateCustomCardEmbed = function (cardId) {
    const url = document.getElementById(`url-${cardId}`)?.value.trim();
    const card = (appData.customCards || []).find(c => c.id === cardId);
    if (card) {
        card.content = url;
        saveData();
        const el = document.getElementById(cardId);
        if (el) el.remove();
        renderCustomCards();
    }
};

/* ----------------------------------------------------------
   BUSCADOR GLOBAL (CTRL+K)
   ---------------------------------------------------------- */
window.openGlobalSearch = function () {
    const modal = document.getElementById('global-search-modal');
    if (modal) {
        modal.style.display = 'flex';
        const input = document.getElementById('global-search-input');
        if (input) {
            input.value = '';
            input.focus();
            filterGlobalSearch();
        }
    }
};

window.closeGlobalSearch = function () {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
};

window.filterGlobalSearch = function () {
    const query = document.getElementById('global-search-input')?.value.toLowerCase().trim() || '';
    const resultsContainer = document.getElementById('global-search-results');
    if (!resultsContainer) return;

    if (!query) {
        resultsContainer.innerHTML = `<li style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:12px;">Escribe para buscar entregas, tareas, comandos, notas o enlaces...</li>`;
        return;
    }

    const matches = [];

    (appData.tasks || []).forEach(t => {
        if (t.text.toLowerCase().includes(query)) {
            matches.push({ type: 'Tarea', text: t.text, badge: t.done ? '✅ Hecha' : '⏳ Pendiente' });
        }
    });

    (appData.deliveries || []).forEach(d => {
        if (d.title.toLowerCase().includes(query) || d.subject.toLowerCase().includes(query)) {
            matches.push({ type: 'Entrega', text: `${d.title} (${d.subject})`, badge: d.type });
        }
    });

    getAllSnippets().forEach(s => {
        if (s.title.toLowerCase().includes(query) || s.cmd.toLowerCase().includes(query)) {
            matches.push({ type: 'Comando', text: `${s.title}: ${s.cmd}`, badge: s.cat });
        }
    });

    (appData.bookmarks || []).forEach(b => {
        if (b.name.toLowerCase().includes(query) || b.url.toLowerCase().includes(query)) {
            matches.push({ type: 'Enlace', text: `${b.name} (${b.url})`, badge: 'Web' });
        }
    });

    (appData.studyKanban || []).forEach(k => {
        if (k.title.toLowerCase().includes(query) || k.subject.toLowerCase().includes(query)) {
            matches.push({ type: 'Kanban', text: `${k.title} [${k.subject}]`, badge: k.col.toUpperCase() });
        }
    });

    if (!matches.length) {
        resultsContainer.innerHTML = `<li style="text-align:center;color:var(--text-muted);font-size:0.75rem;padding:12px;">No se encontraron resultados para "${escapeHtml(query)}"</li>`;
        return;
    }

    resultsContainer.innerHTML = matches.slice(0, 15).map(m => `
        <li class="search-result-item" onclick="handleSearchResultClick('${escapeHtml(m.text)}')">
            <span><strong>[${escapeHtml(m.type)}]</strong> ${escapeHtml(m.text)}</span>
            <span class="badge-version">${escapeHtml(m.badge)}</span>
        </li>
    `).join('');
};

window.handleSearchResultClick = function (text) {
    navigator.clipboard.writeText(text).then(() => {
        showToast("Texto copiado del buscador", "info");
    });
    closeGlobalSearch();
};

/* ----------------------------------------------------------
   EXPORTACIÓN & IMPORTACIÓN DE DATOS JSON
   ---------------------------------------------------------- */
window.exportData = function () {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(appData, null, 2));
    const downloadAnchor = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `DevWorkspace_Backup_${today}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    showToast("💾 Datos exportados correctamente", "success");
};

window.importData = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const parsed = JSON.parse(e.target.result);
            if (!parsed || typeof parsed !== 'object') throw new Error("Formato no válido");
            appData = deepMerge(defaultData, parsed);
            saveData();
            applyTheme();
            renderAll();
            applyLayoutState();
            showToast("✅ Copia de seguridad importada con éxito", "success");
        } catch (err) {
            console.error("Error importando JSON:", err);
            showToast("Error al importar el archivo JSON", "error");
        }
    };
    reader.readAsText(file);
};

/* ----------------------------------------------------------
   RENDERIZADO INTEGRAL & ARRANQUE
   ---------------------------------------------------------- */
function renderAll() {
    renderCategoryPills();
    renderGradesCalculator();
    renderDeliveries();
    renderTasks();
    renderBookmarks();
    renderServers();
    renderSnippets();
    renderKanban();
    renderCustomCards();
    updateStats();
    updateClockDisplay();
    setNotesTab(appData.activeNotesTab || 'general');
}

window.addEventListener('DOMContentLoaded', () => {
    loadLocalData();
    applyTheme();
    setupThemeListeners();
    setupDragAndDrop();
    setupNotesAutoSave();
    renderAll();
    applyLayoutState();
    syncRealTimeNetwork();

    // Atajos de teclado globales amigables y avanzados
    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            const taskInput = document.getElementById('task-text');
            if (taskInput) taskInput.focus();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            if (pomodoroRunning) {
                stopPomodoro();
            } else {
                startCustomPomodoro('focus');
            }
        } else if (e.key === 'Escape') {
            closeGlobalSearch();
            closeVisibilityModal();
            closeScheduleModal();
            closeAuthModal();
        }
    });

    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                modal.style.display = 'none';
            }
        });
    });
});