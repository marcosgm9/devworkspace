import { calculateSubnet, getMadridClock, getMadridDateKey, getNextRepeatDate, mergeState } from './core.js';

/* ==========================================================
   DEVWORKSPACE v7.0 - STUDIO EDITION (app.js)
   Sincronización en tiempo real con Firebase Auth + Firestore
   ========================================================== */

const STORAGE_KEY = 'devworkspace_v7_state';
const SNAPSHOTS_KEY = 'devworkspace_v7_snapshots';
const FIREBASE_CONFIG = window.DEVWORKSPACE_FIREBASE_CONFIG || null;

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let isRegisterMode = false;
let cloudSyncTimer = null;
let unsubscribeFirestore = null;
let isApplyingRemoteUpdate = false;

let netTimeOffsetMs = 0;
let scheduleViewMode = 'current'; // 'current' | 'table'
let taskFilter = 'all';
let taskSort = 'created';
const expandedTaskIds = new Set();
let deliveriesFilter = 'all';
const deliveryReminderTimers = new Map();
let serviceWorkerRegistration = null;
let activeNotesTab = 'general';
let isNotesPreview = false;
let activeStudioTab = 'html';
let studioAutoRunTimer = null;
let studioConsoleLogs = [];
let studioConsoleToken = '';
let examCramOnly = false;
let activeStudyHubTab = 'flashcards';
let currentFlashcardIdx = 0;
let isFlashcardFlipped = false;
let activeToolboxTab = 'format';
let lastLoadedGoogleFont = 'JetBrains Mono';
let globalSearchSelectedIdx = 0;
let globalSearchQuery = '';
let globalSearchResults = [];
let deferredInstallPrompt = null;

// Pomodoro & Audio State
let pomoInterval = null;
let pomoSecondsLeft = 25 * 60;
let pomoMode = 'focus';
let pomoRunning = false;
let pomoEndsAt = 0;
let audioCtx = null;
let audioNodes = [];
let isAudioPlaying = false;

/* ----------------------------------------------------------
   ESTADO POR DEFECTO Y FUSIÓN SEGURA
   ---------------------------------------------------------- */
function createDefaultState() {
    return {
        activeWorkspace: 'cockpit',
        theme: 'cyberpunk',
        densityCompact: false,
        weatherEnabled: false,
        appearance: {
            scale: '1',
            fontSans: 'Inter',
            fontMono: 'JetBrains Mono',
            customName: 'Mi Tema',
            colors: {
                bg: '#060813',
                card: '#0d131f',
                border: '#1e293b',
                text: '#f1f5f9',
                cyan: '#38bdf8',
                violet: '#a855f7'
            }
        },
        favoriteFonts: ['JetBrains Mono', 'Fira Code', 'Space Grotesk', 'Outfit'],
        schedule: [],
        deliveries: [],
        tasks: [],
        pomodoro: {
            focusMins: 25,
            breakMins: 5,
            todayMinutes: 0,
            totalMinutes: 0,
            lastStudyDate: '',
            streakDays: 0,
            historyByDate: {}
        },
        notes: {
            general: '',
            comandos: '',
            clases: '',
            history: []
        },
        stickyNote: '',
        studio: {
            currentTitle: 'Mi Proyecto Web',
            html: '<div class="card">\n  <h1>Hola DevWorkspace</h1>\n  <p>Edita HTML, CSS y JS en tiempo real.</p>\n  <button id="btn">Pulsar</button>\n</div>',
            css: 'body {\n  font-family: system-ui, sans-serif;\n  background: #0f172a;\n  color: #f8fafc;\n  display: grid;\n  place-items: center;\n  min-height: 100vh;\n  margin: 0;\n}\n.card {\n  background: #1e293b;\n  padding: 2rem;\n  border-radius: 12px;\n  border: 1px solid #38bdf8;\n  text-align: center;\n}\nbutton {\n  background: #38bdf8;\n  color: #0f172a;\n  border: none;\n  padding: 8px 16px;\n  border-radius: 6px;\n  font-weight: bold;\n  cursor: pointer;\n}',
            js: 'document.getElementById("btn")?.addEventListener("click", () => {\n  console.log("¡Botón pulsado a las " + new Date().toLocaleTimeString() + "!");\n});',
            previewFont: '',
            savedProjects: []
        },
        kanban: [],
        grades: [],
        flashcards: [],
        bugLogs: [],
        doubts: [],
        projects: [],
        servers: [],
        infraChangelog: [],
        snippets: [
            { id: 's1', title: 'Conexión SSH estándar', cat: 'Linux', cmd: 'ssh {{USER}}@{{IP}} -p {{PORT}}' },
            { id: 's2', title: 'Contenedores Docker activos', cat: 'Docker', cmd: 'docker ps -a --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"' },
            { id: 's3', title: 'Ver puertos en escucha', cat: 'Redes', cmd: 'ss -tulpn' }
        ],
        bookmarks: [
            { id: 'b1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/es/' },
            { id: 'b2', name: 'GitHub', url: 'https://github.com' }
        ]
    };
}

function createId() {
    return window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return createDefaultState();
        return mergeState(createDefaultState(), JSON.parse(raw));
    } catch (e) {
        console.warn('Error cargando estado local:', e);
        return createDefaultState();
    }
}

let appState = loadState();

function saveState(skipCloud = false) {
    try {
        const serialized = JSON.stringify(appState);
        localStorage.setItem(STORAGE_KEY, serialized);
        updateStorageQuotaBadge(serialized.length);
    } catch (e) {
        showToast('Error guardando en LocalStorage (cuota llena)', 'error');
    }
    if (!skipCloud && !isApplyingRemoteUpdate) {
        syncToFirebaseCloud();
    }
}

/* ----------------------------------------------------------
   FIREBASE AUTH + FIRESTORE REAL-TIME SYNC
   ---------------------------------------------------------- */
async function initFirebaseIfConfigured() {
    if (!FIREBASE_CONFIG || !FIREBASE_CONFIG.apiKey) return;
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, onSnapshot, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firebaseAuth = getAuth(firebaseApp);
        firebaseDb = getFirestore(firebaseApp);

        onAuthStateChanged(firebaseAuth, (user) => {
            currentUser = user;
            const profWidget = document.getElementById('user-profile-widget');
            const loginBtn = document.getElementById('btn-cloud-login');

            if (unsubscribeFirestore) {
                unsubscribeFirestore();
                unsubscribeFirestore = null;
            }

            if (user) {
                if (profWidget) profWidget.style.display = 'flex';
                if (loginBtn) loginBtn.style.display = 'none';
                const userNameEl = document.getElementById('user-name');
                if (userNameEl) userNameEl.textContent = user.email || 'Usuario';

                const userDocRef = doc(firebaseDb, 'workspaces', user.uid);
                let firstSnap = true;

                unsubscribeFirestore = onSnapshot(userDocRef, async (snap) => {
                    const ind = document.getElementById('cloud-sync-indicator');
                    if (snap.exists()) {
                        if (!snap.metadata.hasPendingWrites) {
                            isApplyingRemoteUpdate = true;
                            appState = mergeState(createDefaultState(), snap.data());
                            saveState(true);
                            applyAllAppearance();
                            renderAll();
                            isApplyingRemoteUpdate = false;
                            if (ind) {
                                ind.textContent = 'Cloud OK';
                                ind.className = 'sync-badge';
                            }
                            if (firstSnap) {
                                showToast('Datos sincronizados desde la nube', 'success');
                            }
                        }
                    } else if (firstSnap) {
                        // Primera vez de este usuario: subir su estado local actual
                        await setDoc(userDocRef, appState);
                        if (ind) {
                            ind.textContent = 'Cloud OK';
                            ind.className = 'sync-badge';
                        }
                    }
                    firstSnap = false;
                }, (err) => {
                    console.error('Error Firestore onSnapshot:', err);
                    const ind = document.getElementById('cloud-sync-indicator');
                    if (ind) {
                        ind.textContent = 'Sync Error';
                        ind.className = 'sync-badge sync-error';
                    }
                    showToast('Error de permisos o red en Firestore', 'error');
                });
            } else {
                if (profWidget) profWidget.style.display = 'none';
                if (loginBtn) loginBtn.style.display = 'inline-flex';
            }
        });
    } catch (e) {
        console.warn('No se pudo iniciar Firebase:', e);
    }
}

function syncToFirebaseCloud() {
    if (!currentUser || !firebaseDb || isApplyingRemoteUpdate) return;
    const ind = document.getElementById('cloud-sync-indicator');
    if (ind) {
        ind.textContent = 'Guardando...';
        ind.className = 'sync-badge sync-saving';
    }

    clearTimeout(cloudSyncTimer);
    cloudSyncTimer = setTimeout(async () => {
        try {
            const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
            await setDoc(doc(firebaseDb, 'workspaces', currentUser.uid), appState);
            if (ind) {
                ind.textContent = 'Cloud OK';
                ind.className = 'sync-badge';
            }
        } catch (err) {
            console.error('Error guardando en Firestore:', err);
            if (ind) {
                ind.textContent = 'Sync Error';
                ind.className = 'sync-badge sync-error';
            }
        }
    }, 1100);
}

window.openAuthModal = function () {
    document.getElementById('auth-modal').style.display = 'flex';
    document.getElementById('auth-email')?.focus();
};

window.closeAuthModal = function () {
    document.getElementById('auth-modal').style.display = 'none';
};

window.continueAsGuest = function () {
    closeAuthModal();
    showToast('Trabajando en modo local', 'info');
};

window.toggleAuthMode = function () {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').textContent = isRegisterMode ? 'Crear Cuenta Cloud' : 'DevWorkspace Cloud';
    document.getElementById('auth-main-btn').textContent = isRegisterMode ? '✨ Registrarse' : '🔑 Iniciar Sesión';
    document.querySelector('.btn-link-action').textContent = isRegisterMode
        ? '¿Ya tienes cuenta? Inicia sesión aquí'
        : '¿No tienes cuenta? Regístrate aquí';
};

window.handleEmailAuth = async function () {
    if (!firebaseAuth) {
        showToast('Firebase no está configurado aún', 'error');
        return;
    }
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    if (!email || !pass) {
        showToast('Introduce correo y contraseña', 'error');
        return;
    }
    try {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(firebaseAuth, email, pass);
            showToast('Cuenta creada y vinculada', 'success');
        } else {
            await signInWithEmailAndPassword(firebaseAuth, email, pass);
            showToast('Sesión iniciada correctamente', 'success');
        }
        closeAuthModal();
    } catch (e) {
        showToast('Error Auth: ' + (e.code || e.message), 'error');
    }
};

window.logoutUser = async function () {
    if (!firebaseAuth) return;
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await signOut(firebaseAuth);
    showToast('Sesión cerrada', 'info');
};

/* ----------------------------------------------------------
   NAVEGACIÓN DE WORKSPACES, MODOS Y UTILIDADES UI
   ---------------------------------------------------------- */
window.switchWorkspace = function (wsName) {
    appState.activeWorkspace = wsName;
    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ws === wsName);
    });
    document.querySelectorAll('.workspace-view').forEach(view => {
        view.classList.toggle('active', view.id === 'ws-' + wsName);
    });
    if (wsName === 'studio') {
        runStudioPreview();
    }
    saveState();
};

window.toggleForm = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

window.togglePresentationMode = function () {
    document.body.classList.toggle('presentation-mode-active');
    document.getElementById('btn-present-mode')?.classList.toggle('active');
};

window.toggleZenMode = function () {
    document.body.classList.toggle('zen-mode-active');
    document.getElementById('btn-zen-mode')?.classList.toggle('active');
};

window.toggleDensityMode = function () {
    appState.densityCompact = !appState.densityCompact;
    applyAllAppearance();
    saveState();
};

window.applyWorkspacePreset = function (preset) {
    const cards = ['card-schedule', 'card-deliveries', 'card-tasks', 'card-pomodoro', 'card-notes'];
    cards.forEach(id => document.getElementById(id)?.classList.remove('hidden-card'));

    if (preset === 'today') {
        switchWorkspace('cockpit');
        document.getElementById('card-notes')?.classList.add('hidden-card');
    } else if (preset === 'exam') {
        switchWorkspace('academy');
    } else if (preset === 'dev') {
        switchWorkspace('studio');
    } else if (preset === 'sysadmin') {
        switchWorkspace('devlab');
    } else {
        switchWorkspace('cockpit');
    }
};

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function escapeCssString(value) {
    return `"${String(value).replace(/[\0-\x1f\x7f"\\]/g, character =>
        `\\${character.codePointAt(0).toString(16)} `
    ).replace(/</g, '\\3c ')}"`;
}

function inlineJsArg(value) {
    const literal = JSON.stringify(String(value))
        .replace(/\u2028/g, '\\u2028')
        .replace(/\u2029/g, '\\u2029');
    return escapeHtml(literal);
}

function getSafeExternalUrl(value) {
    try {
        const url = new URL(String(value));
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : '';
    } catch (_) {
        return '';
    }
}

window.copyElementValue = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    const val = el.value !== undefined ? el.value : el.textContent;
    navigator.clipboard.writeText(val).then(() => showToast('Copiado al portapapeles', 'success'));
};

/* ----------------------------------------------------------
   RELOJ REAL (MADRID) Y CLIMA
   ---------------------------------------------------------- */
window.syncRealTimeNetwork = async function () {
    const statusEl = document.getElementById('net-status');
    try {
        const t0 = Date.now();
        const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid');
        if (!res.ok) throw new Error('HTTP');
        const data = await res.json();
        const serverMs = new Date(data.datetime).getTime();
        netTimeOffsetMs = serverMs - (t0 + Date.now()) / 2;
        if (statusEl) statusEl.textContent = '🟢 Hora Madrid OK';
    } catch (_) {
        netTimeOffsetMs = 0;
        if (statusEl) statusEl.textContent = '🟡 Reloj Local';
    }
};

function getNow() {
    return new Date(Date.now() + netTimeOffsetMs);
}

function updateClockLoop() {
    const now = getNow();
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid' });
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-ES', {
            weekday: 'short', day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Europe/Madrid'
        });
    }
}

window.toggleWeatherWidget = async function () {
    appState.weatherEnabled = !appState.weatherEnabled;
    saveState();
    await updateWeatherBadge();
};

async function updateWeatherBadge() {
    const txt = document.getElementById('weather-text');
    if (!txt) return;
    if (!appState.weatherEnabled) {
        txt.textContent = 'Clima: OFF';
        return;
    }
    txt.textContent = 'Cargando...';
    try {
        // Coordenadas Fuente de Cantos / Badajoz por defecto si no se concede geolocalización
        let lat = 38.246, lon = -6.309;
        const res = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        txt.textContent = `${temp}°C`;
    } catch (_) {
        txt.textContent = 'Clima N/D';
    }
}

/* ----------------------------------------------------------
   HORARIO Y CLASE ACTUAL
   ---------------------------------------------------------- */
window.openScheduleModal = function () {
    renderScheduleEditor();
    document.getElementById('schedule-modal').style.display = 'flex';
};

window.closeScheduleModal = function () {
    document.getElementById('schedule-modal').style.display = 'none';
    renderScheduleWidget();
};

window.toggleScheduleViewMode = function () {
    scheduleViewMode = scheduleViewMode === 'current' ? 'table' : 'current';
    renderScheduleWidget();
};

window.addScheduleClass = function () {
    const day = Number(document.getElementById('sch-add-day').value);
    const start = document.getElementById('sch-add-start').value;
    const end = document.getElementById('sch-add-end').value;
    const subject = document.getElementById('sch-add-subject').value.trim();
    const room = document.getElementById('sch-add-room').value.trim();
    if (!subject || !start || !end) {
        showToast('Completa asignatura y horario', 'error');
        return;
    }
    if (end <= start) {
        showToast('La hora de fin debe ser posterior a la de inicio', 'error');
        return;
    }

    appState.schedule.push({ id: Date.now().toString(), day, start, end, subject, room });
    document.getElementById('sch-add-subject').value = '';
    saveState();
    renderScheduleEditor();
    renderScheduleWidget();
};

window.deleteScheduleClass = function (id) {
    appState.schedule = appState.schedule.filter(c => c.id !== id);
    saveState();
    renderScheduleEditor();
    renderScheduleWidget();
};

window.clearSchedule = function () {
    appState.schedule = [];
    saveState();
    renderScheduleEditor();
    renderScheduleWidget();
};

function renderScheduleEditor() {
    const container = document.getElementById('schedule-list-editor');
    if (!container) return;
    const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes'];
    const sorted = [...appState.schedule].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
    container.innerHTML = sorted.length
        ? sorted.map(c => `
            <div class="deadline-card-item">
                <div class="deadline-card-top">
                    <span><strong>${escapeHtml(days[c.day] || '')}</strong> ${escapeHtml(c.start)}-${escapeHtml(c.end)} — ${escapeHtml(c.subject)} ${c.room ? `(${escapeHtml(c.room)})` : ''}</span>
                    <button type="button" class="btn-icon" onclick="deleteScheduleClass(${inlineJsArg(c.id)})">🗑️</button>
                </div>
            </div>`).join('')
        : '<p class="mono-muted">No hay clases configuradas.</p>';
}

function renderScheduleWidget() {
    const container = document.getElementById('schedule-widget');
    if (!container) return;
    const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const now = getNow();
    const { day: todayDay, minutes: nowMins } = getMadridClock(now);

    if (scheduleViewMode === 'table') {
        const sorted = [...appState.schedule].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
        if (!sorted.length) {
            container.innerHTML = '<div class="sch-detail">Sin horario cargado. Pulsa Configurar.</div>';
            return;
        }
        container.innerHTML = `<table class="sch-table">
            <thead><tr><th>Día</th><th>Hora</th><th>Módulo</th><th>Aula</th></tr></thead>
            <tbody>${sorted.map(c => `<tr><td>${days[c.day]}</td><td>${c.start}-${c.end}</td><td>${escapeHtml(c.subject)}</td><td>${escapeHtml(c.room || '-')}</td></tr>`).join('')}</tbody>
        </table>`;
        return;
    }

    const todayClasses = appState.schedule
        .filter(c => c.day === todayDay)
        .sort((a, b) => a.start.localeCompare(b.start));

    if (!todayClasses.length) {
        container.innerHTML = `<div class="sch-status">📅 ${days[todayDay]} — Sin clases programadas</div>`;
        return;
    }

    const toMins = t => {
        const [h, m] = t.split(':').map(Number);
        return h * 60 + m;
    };

    const active = todayClasses.find(c => nowMins >= toMins(c.start) && nowMins < toMins(c.end));
    const next = todayClasses.find(c => toMins(c.start) > nowMins);

    if (active) {
        const s = toMins(active.start), e = toMins(active.end);
        const pct = Math.min(100, Math.max(0, Math.round(((nowMins - s) / (e - s)) * 100)));
        container.innerHTML = `
            <div class="sch-status">🟢 En clase: <strong>${escapeHtml(active.subject)}</strong> ${active.room ? `[${escapeHtml(active.room)}]` : ''}</div>
            <div class="sch-detail">${escapeHtml(active.start)} - ${escapeHtml(active.end)} (${e - nowMins} min restantes)${next ? ` • Siguiente: ${escapeHtml(next.subject)}` : ''}</div>
            <div class="sch-progress-track"><div class="sch-progress-fill" style="width:${pct}%"></div></div>`;
    } else if (next) {
        container.innerHTML = `
            <div class="sch-status">⏳ Próxima: <strong>${escapeHtml(next.subject)}</strong> a las ${escapeHtml(next.start)}</div>
            <div class="sch-detail">Faltan ${toMins(next.start) - nowMins} min ${next.room ? `• Aula ${escapeHtml(next.room)}` : ''}</div>`;
    } else {
        container.innerHTML = `<div class="sch-status">✅ Clases de hoy finalizadas</div>`;
    }
}

/* ----------------------------------------------------------
   ENTREGAS & EXÁMENES
   ---------------------------------------------------------- */
window.setDeliveriesFilter = function (f) {
    deliveriesFilter = f;
    document.querySelectorAll('#card-deliveries .pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('deliv-filter-' + f)?.classList.add('active');
    renderDeliveries();
};

window.addDelivery = function () {
    const title = document.getElementById('deliv-title').value.trim();
    const subject = document.getElementById('deliv-subject').value.trim();
    const type = document.getElementById('deliv-type').value;
    const datetime = document.getElementById('deliv-datetime').value;
    if (!title || !datetime) {
        showToast('Completa título y fecha', 'error');
        return;
    }
    appState.deliveries.push({
        id: Date.now().toString(),
        title,
        subject: subject || 'General',
        type,
        datetime,
        alertMins: Number(document.getElementById('deliv-alert-mins').value) || 0,
        alertSent: false,
        done: false
    });
    const item = appState.deliveries[appState.deliveries.length - 1];
    document.getElementById('deliv-title').value = '';
    saveState();
    renderDeliveries();
    if (item.alertMins > 0) {
        if (window.Notification?.permission === 'granted') scheduleDeliveryReminder(item);
        else showToast('Entrega guardada. Activa los avisos con el botón 🔔.', 'info');
    }
};

window.enableDeadlineNotifications = async function () {
    if (!('Notification' in window)) {
        showToast('Este navegador no admite notificaciones', 'error');
        return;
    }
    if (Notification.permission === 'denied') {
        showToast('Las notificaciones están bloqueadas en los ajustes del navegador', 'error');
        updateNotificationControls();
        return;
    }
    let permission;
    try {
        permission = Notification.permission === 'granted'
            ? 'granted'
            : await Notification.requestPermission();
    } catch (error) {
        console.error('No se pudo solicitar permiso para notificaciones:', error);
        showToast('No se pudo solicitar permiso para notificaciones', 'error');
        return;
    }
    if (permission !== 'granted') {
        showToast('No se han permitido las notificaciones', 'error');
        updateNotificationControls();
        return;
    }
    updateNotificationControls();
    scheduleAllDeliveryReminders();
    showToast('Avisos de entregas activados mientras la app esté abierta', 'success');
};

function updateNotificationControls() {
    const button = document.getElementById('btn-enable-notifications');
    if (!button) return;
    if (!('Notification' in window)) {
        button.textContent = '🔔 No disponible';
        button.disabled = true;
    } else if (Notification.permission === 'granted') {
        button.textContent = '🔔 Avisos activos';
        button.disabled = true;
    } else if (Notification.permission === 'denied') {
        button.textContent = '🔕 Avisos bloqueados';
        button.disabled = false;
        button.title = 'Cambia los permisos de notificación en el navegador';
    } else {
        button.textContent = '🔔 Activar avisos';
        button.disabled = false;
    }
}

function clearDeliveryReminder(id) {
    const timer = deliveryReminderTimers.get(id);
    if (timer) clearTimeout(timer);
    deliveryReminderTimers.delete(id);
}

function scheduleDeliveryReminder(item) {
    clearDeliveryReminder(item.id);
    const alertMins = Number(item.alertMins);
    if (item.done || item.alertSent || !Number.isFinite(alertMins) || alertMins <= 0 ||
        !('Notification' in window) || Notification.permission !== 'granted') return;

    const deadline = new Date(item.datetime).getTime();
    const reminderAt = deadline - alertMins * 60000;
    if (!Number.isFinite(deadline) || deadline <= Date.now()) return;

    const scheduleNext = () => {
        const remaining = reminderAt - Date.now();
        const delay = Math.min(remaining, 2147483647);
        const timer = setTimeout(async () => {
            if (reminderAt > Date.now()) {
                scheduleNext();
                return;
            }
            deliveryReminderTimers.delete(item.id);
            const current = appState.deliveries.find(delivery => delivery.id === item.id);
            if (!current || current.done || current.alertSent || new Date(current.datetime).getTime() <= Date.now()) return;
            try {
                const title = `Entrega próxima: ${current.title}`;
                const options = {
                    body: `${current.subject || 'General'} · vence ${new Date(current.datetime).toLocaleString('es-ES')}`,
                    icon: './icon.svg',
                    tag: `delivery-${current.id}`
                };
                if (serviceWorkerRegistration) {
                    await serviceWorkerRegistration.showNotification(title, options);
                } else {
                    const notification = new Notification(title, options);
                    notification.onclick = () => {
                        window.focus();
                        switchWorkspace('cockpit');
                        notification.close();
                    };
                }
                current.alertSent = true;
                saveState();
                showToast(title, 'info');
            } catch (error) {
                console.error('No se pudo mostrar el aviso de entrega:', error);
                showToast('No se pudo mostrar el aviso de entrega', 'error');
            }
        }, Math.max(0, delay));
        deliveryReminderTimers.set(item.id, timer);
    };
    scheduleNext();
}

function scheduleAllDeliveryReminders() {
    appState.deliveries.forEach(scheduleDeliveryReminder);
}

window.toggleDeliveryDone = function (id) {
    const item = appState.deliveries.find(d => d.id === id);
    if (item) item.done = !item.done;
    if (item) scheduleDeliveryReminder(item);
    saveState();
    renderDeliveries();
};

window.deleteDelivery = function (id) {
    clearDeliveryReminder(id);
    appState.deliveries = appState.deliveries.filter(d => d.id !== id);
    saveState();
    renderDeliveries();
};

function renderDeliveries() {
    const container = document.getElementById('deliveries-list');
    if (!container) return;
    const now = getNow().getTime();

    let list = [...appState.deliveries].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    list = list.filter(d => {
        const diffHours = (new Date(d.datetime).getTime() - now) / 3600000;
        if (deliveriesFilter === 'pending') return !d.done;
        if (deliveriesFilter === 'soon') return !d.done && diffHours <= 48 && diffHours >= -24;
        if (deliveriesFilter === 'exam') return d.type === 'Examen';
        if (deliveriesFilter === 'practice') return d.type === 'Práctica';
        return true;
    });

    if (!list.length) {
        container.innerHTML = '<p class="mono-muted">Sin entregas en este filtro.</p>';
        return;
    }

    container.innerHTML = list.map(d => {
        const diffMs = new Date(d.datetime).getTime() - now;
        const diffHrs = Math.round(diffMs / 3600000);
        let badgeClass = 'cd-ok';
        let badgeTxt = diffHrs >= 24 ? `${Math.round(diffHrs / 24)}d` : `${diffHrs}h`;
        if (d.done) { badgeClass = 'cd-done'; badgeTxt = 'Entregado'; }
        else if (diffHrs < 0) { badgeClass = 'cd-urgent'; badgeTxt = 'Vencido'; }
        else if (diffHrs <= 48) { badgeClass = 'cd-warn'; }

        return `<div class="deadline-card-item">
            <div class="deadline-card-top">
                <div>
                    <div class="deadline-title" style="${d.done ? 'text-decoration:line-through;opacity:0.6;' : ''}">${escapeHtml(d.title)}</div>
                    <div class="deadline-meta"><span>${escapeHtml(d.subject)}</span> • <span>${escapeHtml(d.type)}</span> • <span>${new Date(d.datetime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span></div>
                </div>
                <div class="card-actions">
                    <span class="countdown-badge ${badgeClass}">${badgeTxt}</span>
                    <button type="button" class="btn-icon" onclick="toggleDeliveryDone(${inlineJsArg(d.id)})">✅</button>
                    <button type="button" class="btn-icon" onclick="deleteDelivery(${inlineJsArg(d.id)})">🗑️</button>
                </div>
            </div>
        </div>`;
    }).join('');
}

/* ----------------------------------------------------------
   TAREAS DEL DÍA
   ---------------------------------------------------------- */
window.setTaskFilter = function (f) {
    if (!['all', 'pending', 'done', 'today', 'overdue'].includes(f)) return;
    taskFilter = f;
    document.querySelectorAll('#card-tasks .pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('filter-' + f)?.classList.add('active');
    renderTasks();
};

window.setTaskSort = function (s) {
    taskSort = s;
    renderTasks();
};

window.addTask = function () {
    const text = document.getElementById('task-text').value.trim();
    if (!text) return;
    const block = document.getElementById('task-block').value;
    const priority = document.getElementById('task-priority').value;
    const date = document.getElementById('task-date').value;
    const repeat = document.getElementById('task-repeat').value;

    appState.tasks.unshift({
        id: createId(),
        text,
        block,
        priority,
        date,
        repeat,
        subtasks: [],
        done: false
    });
    document.getElementById('task-text').value = '';
    document.getElementById('task-repeat').value = '';
    saveState();
    renderTasks();
    updateStats();
};

window.toggleTask = function (id) {
    const t = appState.tasks.find(x => x.id === id);
    if (!t) return;
    if (!t.done && ['daily', 'weekly', 'monthly'].includes(t.repeat)) {
        const today = getMadridDateKey();
        let nextDate;
        try {
            nextDate = getNextRepeatDate(t.date && t.date > today ? t.date : today, t.repeat);
        } catch (error) {
            if (!(error instanceof TypeError)) throw error;
            showToast(error.message, 'error');
            return;
        }
        t.done = true;
        const subtasks = (Array.isArray(t.subtasks) ? t.subtasks : []).map(subtask => ({
            ...subtask,
            id: createId(),
            done: false
        }));
        appState.tasks.unshift({ ...t, id: createId(), date: nextDate, done: false, subtasks });
        showToast(`Siguiente tarea programada para ${nextDate}`, 'success');
    } else {
        t.done = !t.done;
    }
    saveState();
    renderTasks();
    updateStats();
};

window.toggleTaskSubtasks = function (id) {
    if (expandedTaskIds.has(id)) expandedTaskIds.delete(id);
    else expandedTaskIds.add(id);
    renderTasks();
};

window.addTaskSubtask = function (id) {
    const task = appState.tasks.find(item => item.id === id);
    const input = document.getElementById(`subtask-input-${id}`);
    const text = input?.value.trim();
    if (!task || !text) return;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    task.subtasks.push({ id: createId(), text, done: false });
    saveState();
    renderTasks();
    document.getElementById(`subtask-input-${id}`)?.focus();
};

window.toggleTaskSubtask = function (taskId, subtaskId) {
    const task = appState.tasks.find(item => item.id === taskId);
    const subtask = task?.subtasks?.find(item => item.id === subtaskId);
    if (!subtask) return;
    subtask.done = !subtask.done;
    saveState();
    renderTasks();
};

window.deleteTaskSubtask = function (taskId, subtaskId) {
    const task = appState.tasks.find(item => item.id === taskId);
    if (!task || !Array.isArray(task.subtasks)) return;
    task.subtasks = task.subtasks.filter(item => item.id !== subtaskId);
    saveState();
    renderTasks();
};

window.deleteTask = function (id) {
    expandedTaskIds.delete(id);
    appState.tasks = appState.tasks.filter(x => x.id !== id);
    saveState();
    renderTasks();
    updateStats();
};

window.exportTasksMarkdown = function () {
    const md = appState.tasks.map(t => {
        const taskLine = `- [${t.done ? 'x' : ' '}] (${String(t.priority || 'medium').toUpperCase()}) ${t.text}`;
        const subtaskLines = (Array.isArray(t.subtasks) ? t.subtasks : [])
            .map(subtask => `  - [${subtask.done ? 'x' : ' '}] ${subtask.text}`);
        return [taskLine, ...subtaskLines].join('\n');
    }).join('\n');
    navigator.clipboard.writeText(md || '- Sin tareas').then(() => showToast('Tareas copiadas en Markdown', 'success'));
};

function renderTasks() {
    const ul = document.getElementById('tasks-list');
    if (!ul) return;
    const prioWeight = { high: 1, medium: 2, low: 3 };
    const blockIcon = { morning: '🌅', afternoon: '☀️', night: '🌙' };

    const today = getMadridDateKey();
    let list = appState.tasks.filter(t => {
        if (taskFilter === 'pending') return !t.done;
        if (taskFilter === 'done') return t.done;
        if (taskFilter === 'today') return t.date === today;
        if (taskFilter === 'overdue') return !t.done && !!t.date && t.date < today;
        return true;
    });

    if (taskSort === 'priority') list.sort((a, b) => prioWeight[a.priority] - prioWeight[b.priority]);
    else if (taskSort === 'block') list.sort((a, b) => a.block.localeCompare(b.block));
    else if (taskSort === 'date') list.sort((a, b) => (a.date || '9999').localeCompare(b.date || '9999'));

    ul.innerHTML = list.length
        ? list.map(t => {
            const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
            const expanded = expandedTaskIds.has(t.id);
            const repeatLabel = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' }[t.repeat];
            return `
            <li class="${t.done ? 'task-done' : ''}">
                <div class="task-main-row">
                    <label class="task-label">
                        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTask(${inlineJsArg(t.id)})">
                        <span>${blockIcon[t.block] || ''} ${escapeHtml(t.text)} ${t.date ? `<small class="mono-muted">(${escapeHtml(t.date)})</small>` : ''} ${repeatLabel ? `<small class="task-repeat-badge">↻ ${repeatLabel}</small>` : ''}</span>
                    </label>
                    <div class="task-actions">
                        <button type="button" class="btn-ghost btn-sm" aria-expanded="${expanded}" onclick="toggleTaskSubtasks(${inlineJsArg(t.id)})">Subtareas (${subtasks.length})</button>
                        <button type="button" class="btn-icon" onclick="deleteTask(${inlineJsArg(t.id)})" aria-label="Eliminar tarea">🗑️</button>
                    </div>
                </div>
                ${expanded ? `<div class="task-subtasks">
                    ${subtasks.map(subtask => `<div class="task-subtask-row ${subtask.done ? 'subtask-done' : ''}">
                        <label><input type="checkbox" ${subtask.done ? 'checked' : ''} onchange="toggleTaskSubtask(${inlineJsArg(t.id)},${inlineJsArg(subtask.id)})"> ${escapeHtml(subtask.text)}</label>
                        <button type="button" class="btn-icon" onclick="deleteTaskSubtask(${inlineJsArg(t.id)},${inlineJsArg(subtask.id)})" aria-label="Eliminar subtarea">×</button>
                    </div>`).join('')}
                    <div class="task-subtask-add">
                        <input type="text" id="subtask-input-${escapeHtml(t.id)}" placeholder="Añadir subtarea" aria-label="Nueva subtarea" onkeydown="if(event.key==='Enter'){event.preventDefault();addTaskSubtask(${inlineJsArg(t.id)})}">
                        <button type="button" class="btn-cyan btn-sm" onclick="addTaskSubtask(${inlineJsArg(t.id)})">Añadir</button>
                    </div>
                </div>` : ''}
            </li>`;
        }).join('')
        : '<li class="mono-muted">No hay tareas en esta vista.</li>';
}

/* ----------------------------------------------------------
   POMODORO, AUDIO AMBIENTE & MÉTRICAS
   ---------------------------------------------------------- */
function updatePomodoroDisplay() {
    const m = String(Math.floor(pomoSecondsLeft / 60)).padStart(2, '0');
    const s = String(pomoSecondsLeft % 60).padStart(2, '0');
    const el = document.getElementById('pomodoro-display');
    if (el) el.textContent = `${m}:${s}`;
}

window.startCustomPomodoro = function (mode) {
    clearInterval(pomoInterval);
    pomoMode = mode;
    const focusMins = Math.min(180, Math.max(1, Number(document.getElementById('pomo-focus-time').value) || 25));
    const breakMins = Math.min(60, Math.max(1, Number(document.getElementById('pomo-break-time').value) || 5));
    appState.pomodoro.focusMins = focusMins;
    appState.pomodoro.breakMins = breakMins;

    if (mode === 'focus') pomoSecondsLeft = focusMins * 60;
    else if (mode === 'break') pomoSecondsLeft = breakMins * 60;
    else if (mode === 'exam') pomoSecondsLeft = 60 * 60;
    else return;

    pomoRunning = true;
    pomoEndsAt = Date.now() + pomoSecondsLeft * 1000;
    updatePomodoroDisplay();
    saveState();

    pomoInterval = setInterval(() => {
        pomoSecondsLeft = Math.max(0, Math.ceil((pomoEndsAt - Date.now()) / 1000));
        updatePomodoroDisplay();
        if (pomoSecondsLeft <= 0) {
            clearInterval(pomoInterval);
            pomoRunning = false;
            pomoEndsAt = 0;
            if (mode === 'focus' || mode === 'exam') {
                const earned = mode === 'exam' ? 60 : focusMins;
                recordStudyMinutes(earned);
            }
            showToast('¡Tiempo completado!', 'success');
        }
    }, 1000);
};

window.stopPomodoro = function () {
    clearInterval(pomoInterval);
    pomoRunning = false;
    pomoEndsAt = 0;
    const focusMins = Math.min(180, Math.max(1, Number(document.getElementById('pomo-focus-time').value) || 25));
    pomoSecondsLeft = focusMins * 60;
    updatePomodoroDisplay();
};

function recordStudyMinutes(mins) {
    const todayStr = getMadridDateKey();
    if (appState.pomodoro.lastStudyDate !== todayStr) {
        appState.pomodoro.todayMinutes = 0;
        const yesterday = new Date(`${todayStr}T00:00:00Z`);
        yesterday.setUTCDate(yesterday.getUTCDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        appState.pomodoro.streakDays = appState.pomodoro.lastStudyDate === yesterdayStr
            ? (appState.pomodoro.streakDays || 0) + 1
            : 1;
        appState.pomodoro.lastStudyDate = todayStr;
    }
    appState.pomodoro.todayMinutes += mins;
    appState.pomodoro.totalMinutes += mins;
    appState.pomodoro.historyByDate[todayStr] = (appState.pomodoro.historyByDate[todayStr] || 0) + mins;
    saveState();
    updateStats();
}

function updateStats() {
    const todayStr = getMadridDateKey();
    const todayMins = appState.pomodoro.lastStudyDate === todayStr ? appState.pomodoro.todayMinutes : 0;
    document.getElementById('stat-focus-today').textContent = `${todayMins}m`;
    document.getElementById('stat-focus-total').textContent = `${(appState.pomodoro.totalMinutes / 60).toFixed(1)}h`;
    document.getElementById('stat-streak').textContent = `🔥 ${appState.pomodoro.streakDays || 0}d`;

    const totalT = appState.tasks.length;
    const doneT = appState.tasks.filter(t => t.done).length;
    document.getElementById('stat-ratio').textContent = totalT ? `${Math.round((doneT / totalT) * 100)}%` : '0%';

    // Gráfico últimos 7 días
    const barsEl = document.getElementById('study-bars-container');
    if (!barsEl) return;
    let weekSum = 0;
    const daysData = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(`${todayStr}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - i);
        const key = d.toISOString().slice(0, 10);
        const mins = appState.pomodoro.historyByDate[key] || 0;
        weekSum += mins;
        daysData.push({ label: d.toLocaleDateString('es-ES', { weekday: 'narrow', timeZone: 'UTC' }), mins });
    }
    const maxMins = Math.max(60, ...daysData.map(x => x.mins));
    document.getElementById('chart-week-sum').textContent = `${weekSum} min`;
    barsEl.innerHTML = daysData.map(d => {
        const hPct = Math.max(6, Math.round((d.mins / maxMins) * 100));
        return `<div class="chart-bar-col" title="${d.mins} min">
            <div class="chart-bar-fill" style="height:${hPct}%"></div>
            <span class="chart-bar-day">${d.label}</span>
        </div>`;
    }).join('');
}

window.toggleNoiseGenerator = function () {
    if (isAudioPlaying) {
        stopNoiseGenerator();
    } else {
        startNoiseGenerator();
    }
};

function stopNoiseGenerator() {
    audioNodes.forEach(n => { try { n.stop?.(); n.disconnect?.(); } catch (_) {} });
    audioNodes = [];
    isAudioPlaying = false;
    document.getElementById('btn-audio-toggle').textContent = '▶ Audio';
    document.getElementById('audio-visualizer')?.classList.remove('audio-playing');
}

function startNoiseGenerator() {
    stopNoiseGenerator();
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const type = document.getElementById('audio-sound-type').value;
    const vol = (Number(document.getElementById('audio-volume').value) || 40) / 100;
    const gain = audioCtx.createGain();
    gain.gain.value = vol * 0.25;
    gain.connect(audioCtx.destination);

    if (type.startsWith('binaural')) {
        const freqDiff = type === 'binaural-alpha' ? 10 : 6;
        const oscL = audioCtx.createOscillator();
        const oscR = audioCtx.createOscillator();
        oscL.frequency.value = 200;
        oscR.frequency.value = 200 + freqDiff;
        oscL.connect(gain);
        oscR.connect(gain);
        oscL.start();
        oscR.start();
        audioNodes.push(oscL, oscR, gain);
    } else {
        const bufferSize = 2 * audioCtx.sampleRate;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            output[i] = type === 'pink' ? (lastOut + 0.05 * white) / 1.05 : (lastOut + 0.02 * white) / 1.02;
            lastOut = output[i];
            output[i] *= 3.0;
        }
        const src = audioCtx.createBufferSource();
        src.buffer = buffer;
        src.loop = true;
        src.connect(gain);
        src.start();
        audioNodes.push(src, gain);
    }

    isAudioPlaying = true;
    document.getElementById('btn-audio-toggle').textContent = '⏹ Audio';
    document.getElementById('audio-visualizer')?.classList.add('audio-playing');
}

window.handleAudioTypeChange = function () {
    if (isAudioPlaying) startNoiseGenerator();
};

window.updateAudioVolume = function (val) {
    document.getElementById('audio-vol-text').textContent = `${val}%`;
    if (isAudioPlaying) startNoiseGenerator();
};

/* ----------------------------------------------------------
   SCRATCHPAD MARKDOWN & STICKY NOTE
   ---------------------------------------------------------- */
window.setNotesTab = function (tab) {
    activeNotesTab = tab;
    document.querySelectorAll('#card-notes .scratchpad-toolbar .pill-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + tab)?.classList.add('active');
    const pad = document.getElementById('scratchpad');
    if (pad) pad.value = appState.notes[tab] || '';
    updateScratchpadMetrics();
    if (isNotesPreview) renderScratchpadPreview();
};

function updateScratchpadMetrics() {
    const pad = document.getElementById('scratchpad');
    const m = document.getElementById('scratchpad-metrics');
    if (!pad || !m) return;
    const txt = pad.value;
    const lines = txt ? txt.split('\n').length : 0;
    m.textContent = `${lines} líneas • ${txt.length} caracteres`;
}

window.toggleScratchpadPreview = function () {
    isNotesPreview = !isNotesPreview;
    const pad = document.getElementById('scratchpad');
    const prev = document.getElementById('scratchpad-preview');
    if (!pad || !prev) return;
    pad.style.display = isNotesPreview ? 'none' : 'block';
    prev.style.display = isNotesPreview ? 'block' : 'none';
    if (isNotesPreview) renderScratchpadPreview();
};

function renderScratchpadPreview() {
    const raw = escapeHtml(document.getElementById('scratchpad').value);
    const html = raw
        .replace(/^### (.*)$/gm, '<h3>$1</h3>')
        .replace(/^## (.*)$/gm, '<h2>$1</h2>')
        .replace(/^# (.*)$/gm, '<h1>$1</h1>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    document.getElementById('scratchpad-preview').innerHTML = html;
}

window.toggleScratchpadFind = function () {
    toggleForm('scratchpad-find-bar');
};

window.replaceInScratchpad = function (all) {
    const find = document.getElementById('sp-find-text').value;
    const rep = document.getElementById('sp-replace-text').value;
    const pad = document.getElementById('scratchpad');
    if (!find || !pad) return;
    pad.value = all ? pad.value.split(find).join(rep) : pad.value.replace(find, rep);
    appState.notes[activeNotesTab] = pad.value;
    saveState();
    updateScratchpadMetrics();
};

window.insertNoteTemplate = function (tpl) {
    const pad = document.getElementById('scratchpad');
    if (!pad || !tpl) return;
    const templates = {
        clase: `\n## Clase - ${getNow().toLocaleDateString('es-ES')}\n- **Tema:** \n- **Puntos clave:** \n- **Dudas:** \n`,
        comando: `\n### Comando: \`nombre\`\n- **Uso:** \`comando --flag\`\n- **Descripción:** \n`,
        practica: `\n## Práctica\n- **Requisitos:** \n- **Solución:** \n`,
        readme: `\n# Nombre del Proyecto\n## Instalación\n\`\`\`bash\ngit clone ...\n\`\`\`\n`
    };
    pad.value += templates[tpl] || '';
    appState.notes[activeNotesTab] = pad.value;
    saveState();
    updateScratchpadMetrics();
};

window.insertNoteTimestamp = function () {
    const pad = document.getElementById('scratchpad');
    pad.value += `\n[${getNow().toLocaleString('es-ES')}] `;
    appState.notes[activeNotesTab] = pad.value;
    saveState();
};

window.insertNoteCodeBlock = function () {
    const pad = document.getElementById('scratchpad');
    pad.value += `\n\`\`\`bash\n\n\`\`\`\n`;
    appState.notes[activeNotesTab] = pad.value;
    saveState();
};

window.toolCopy = function () {
    copyElementValue('scratchpad');
};

window.toolDownload = function () {
    const content = document.getElementById('scratchpad').value;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `notas-${activeNotesTab}.md`;
    a.click();
};

window.openNoteHistoryModal = function () {
    showToast('Usa Snapshots en la barra superior para restaurar versiones', 'info');
};

window.copyStickyNote = function () {
    copyElementValue('sticky-note-input');
};

window.clearStickyNote = function () {
    document.getElementById('sticky-note-input').value = '';
    appState.stickyNote = '';
    saveState();
};

/* ----------------------------------------------------------
   WORKSPACE 2: LIVE CODE STUDIO
   ---------------------------------------------------------- */
window.switchStudioEditorTab = function (tab) {
    activeStudioTab = tab;
    ['html', 'css', 'js', 'saved'].forEach(t => {
        document.getElementById('ed-tab-' + t)?.classList.toggle('active', t === tab);
        document.getElementById('ed-pane-' + t)?.classList.toggle('active', t === tab);
    });
    if (tab === 'saved') renderStudioSavedProjects();
};

window.runStudioPreview = function () {
    const html = document.getElementById('code-html')?.value || '';
    const css = document.getElementById('code-css')?.value || '';
    const js = document.getElementById('code-js')?.value || '';
    const font = appState.studio.previewFont;
    const fontLink = font ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}:wght@400;600;700&display=swap"><style>body{font-family:${escapeCssString(font)},sans-serif;}</style>` : '';

    studioConsoleToken = crypto.randomUUID();
    const consoleBridge = `<script>
      (function(){
        const token = ${JSON.stringify(studioConsoleToken)};
        const send = (level, args) => parent.postMessage({ source: 'studio-console', token, level, msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
        console.log = (...a) => send('log', a);
        console.warn = (...a) => send('warn', a);
        console.error = (...a) => send('error', a);
        window.onerror = (m, s, l) => send('error', [m + ' (L' + l + ')']);
      })();
    <\/script>`;

    const doc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${fontLink}<style>${css}</style>${consoleBridge}</head><body>${html}<script>${js}<\/script></body></html>`;
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.srcdoc = doc;
};

window.loadStudioTemplate = function (tpl) {
    if (!tpl) return;
    const templates = {
        blank: { html: '<h1>Hola Mundo</h1>', css: 'body { font-family: sans-serif; padding: 20px; }', js: '' },
        cybercard: {
            html: '<div class="cyber-box"><h2>SYSTEM ONLINE</h2><p>Terminal lista.</p></div>',
            css: 'body{background:#060813;color:#38bdf8;font-family:monospace;display:grid;place-items:center;height:100vh}.cyber-box{border:1px solid #38bdf8;padding:24px;box-shadow:0 0 20px rgba(56,189,248,.3)}',
            js: 'console.log("Cybercard iniciada");'
        },
        flexgrid: {
            html: '<div class="grid"><div>1</div><div>2</div><div>3</div></div>',
            css: '.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;padding:20px}.grid div{background:#1e293b;color:#fff;padding:30px;text-align:center;border-radius:8px}',
            js: ''
        },
        domlab: {
            html: '<input id="inp" placeholder="Escribe algo"><ul id="out"></ul>',
            css: 'body{font-family:sans-serif;padding:20px;background:#0f172a;color:#fff}',
            js: 'document.getElementById("inp").addEventListener("keydown", e => { if(e.key==="Enter"){ const li=document.createElement("li"); li.textContent=e.target.value; document.getElementById("out").appendChild(li); e.target.value=""; } });'
        }
    };
    const chosen = templates[tpl];
    if (!chosen) return;
    document.getElementById('code-html').value = chosen.html;
    document.getElementById('code-css').value = chosen.css;
    document.getElementById('code-js').value = chosen.js;
    syncStudioStateFromInputs();
    runStudioPreview();
};

window.injectStudioCdn = function (cdn) {
    const cdns = {
        tailwind: '<script src="https://cdn.tailwindcss.com"><\/script>\n',
        bootstrap: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n',
        alpine: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"><\/script>\n',
        chartjs: '<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\n'
    };
    if (!cdns[cdn]) return;
    const htmlEl = document.getElementById('code-html');
    htmlEl.value = cdns[cdn] + htmlEl.value;
    syncStudioStateFromInputs();
    runStudioPreview();
    showToast('CDN inyectado en HTML', 'success');
};

window.applyFontToStudioPreview = function (fontName) {
    appState.studio.previewFont = fontName;
    saveState();
    runStudioPreview();
};

window.setStudioViewport = function (width) {
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.style.width = width;
    ['vp-desktop', 'vp-tablet', 'vp-mobile'].forEach(id => document.getElementById(id)?.classList.remove('active'));
    if (width === '100%') document.getElementById('vp-desktop')?.classList.add('active');
    else if (width === '768px') document.getElementById('vp-tablet')?.classList.add('active');
    else document.getElementById('vp-mobile')?.classList.add('active');
};

window.toggleStudioFullscreen = function () {
    document.getElementById('studio-workbench')?.classList.toggle('studio-fullscreen');
};

window.clearStudioConsole = function () {
    studioConsoleLogs = [];
    renderStudioConsole();
};

function renderStudioConsole() {
    const out = document.getElementById('studio-console-output');
    const cnt = document.getElementById('studio-console-count');
    if (cnt) cnt.textContent = `${studioConsoleLogs.length} logs`;
    if (out) {
        out.innerHTML = studioConsoleLogs.map(l => `<div class="console-line-${l.level}">[${l.level.toUpperCase()}] ${escapeHtml(l.msg)}</div>`).join('');
        out.scrollTop = out.scrollHeight;
    }
}

window.inspectStudioDomStructure = function () {
    const html = document.getElementById('code-html').value;
    const ids = [...html.matchAll(/id=["']([^"']+)["']/g)].map(m => '#' + m[1]);
    showToast(ids.length ? `IDs detectados: ${ids.join(', ')}` : 'Sin atributos id en HTML', 'info');
};

function syncStudioStateFromInputs() {
    appState.studio.currentTitle = document.getElementById('studio-project-title').value;
    appState.studio.html = document.getElementById('code-html').value;
    appState.studio.css = document.getElementById('code-css').value;
    appState.studio.js = document.getElementById('code-js').value;
    saveState();
}

window.saveStudioProject = function () {
    syncStudioStateFromInputs();
    const title = appState.studio.currentTitle.trim() || 'Sin título';
    const existing = appState.studio.savedProjects.find(p => p.title === title);
    const payload = {
        id: existing ? existing.id : Date.now().toString(),
        title,
        html: appState.studio.html,
        css: appState.studio.css,
        js: appState.studio.js,
        updatedAt: getNow().toLocaleString('es-ES')
    };
    if (existing) Object.assign(existing, payload);
    else appState.studio.savedProjects.unshift(payload);
    saveState();
    renderStudioSavedProjects();
    showToast(`Proyecto "${title}" guardado`, 'success');
};

window.loadSavedStudioProject = function (id) {
    const p = appState.studio.savedProjects.find(x => x.id === id);
    if (!p) return;
    document.getElementById('studio-project-title').value = p.title;
    document.getElementById('code-html').value = p.html;
    document.getElementById('code-css').value = p.css;
    document.getElementById('code-js').value = p.js;
    syncStudioStateFromInputs();
    switchStudioEditorTab('html');
    runStudioPreview();
};

window.deleteSavedStudioProject = function (id) {
    appState.studio.savedProjects = appState.studio.savedProjects.filter(x => x.id !== id);
    saveState();
    renderStudioSavedProjects();
};

function renderStudioSavedProjects() {
    const container = document.getElementById('studio-saved-projects-list');
    if (!container) return;
    container.innerHTML = appState.studio.savedProjects.length
        ? appState.studio.savedProjects.map(p => `
            <div class="deadline-card-item">
                <div class="deadline-card-top">
                    <div>
                        <div class="deadline-title">${escapeHtml(p.title)}</div>
                        <div class="deadline-meta">${escapeHtml(p.updatedAt)}</div>
                    </div>
                    <div class="card-actions">
                        <button type="button" class="btn-cyan btn-sm" onclick="loadSavedStudioProject(${inlineJsArg(p.id)})">Abrir</button>
                        <button type="button" class="btn-icon" onclick="deleteSavedStudioProject(${inlineJsArg(p.id)})">🗑️</button>
                    </div>
                </div>
            </div>`).join('')
        : '<p class="mono-muted">Aún no has guardado proyectos en Live Code Studio.</p>';
}

window.exportStudioSingleHtml = function () {
    syncStudioStateFromInputs();
    const full = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>${escapeHtml(appState.studio.currentTitle)}</title>\n<style>\n${appState.studio.css}\n</style>\n</head>\n<body>\n${appState.studio.html}\n<script>\n${appState.studio.js}\n<\/script>\n</body>\n</html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(appState.studio.currentTitle || 'proyecto').toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
};

window.importStudioHtmlFile = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        document.getElementById('studio-project-title').value = file.name.replace(/\.html?$/i, '');
        document.getElementById('code-html').value = e.target.result;
        document.getElementById('code-css').value = '';
        document.getElementById('code-js').value = '';
        syncStudioStateFromInputs();
        runStudioPreview();
        showToast('HTML importado', 'success');
    };
    reader.readAsText(file);
};

/* ----------------------------------------------------------
   ACADEMIA: KANBAN, NOTAS, STUDY HUB & PLANIFICADOR
   ---------------------------------------------------------- */
window.toggleExamCramFilter = function () {
    examCramOnly = !examCramOnly;
    document.getElementById('btn-exam-cram-mode')?.classList.toggle('active', examCramOnly);
    renderKanban();
};

window.addKanbanTask = function () {
    const title = document.getElementById('kanban-new-title').value.trim();
    const subject = document.getElementById('kanban-new-subject').value.trim() || 'DAM';
    const pomos = Number(document.getElementById('kanban-new-pomos').value) || 2;
    const prio = document.getElementById('kanban-new-prio').value;
    if (!title) return;

    appState.kanban.push({ id: Date.now().toString(), title, subject, pomos, prio, status: 'todo' });
    document.getElementById('kanban-new-title').value = '';
    saveState();
    renderKanban();
};

window.moveKanbanTask = function (id, newStatus) {
    const item = appState.kanban.find(k => k.id === id);
    if (item) item.status = newStatus;
    saveState();
    renderKanban();
};

window.deleteKanbanTask = function (id) {
    appState.kanban = appState.kanban.filter(k => k.id !== id);
    saveState();
    renderKanban();
};

function renderKanban() {
    ['todo', 'doing', 'done'].forEach(col => {
        const items = appState.kanban.filter(k => k.status === col && (!examCramOnly || k.prio === 'high'));
        document.getElementById('kanban-count-' + col).textContent = items.length;
        document.getElementById('kanban-list-' + col).innerHTML = items.map(k => `
            <div class="kanban-card">
                <div class="kanban-card-header">
                    <span class="kanban-subject-tag">${escapeHtml(k.subject)}</span>
                    <button type="button" class="btn-icon" onclick="deleteKanbanTask(${inlineJsArg(k.id)})">✖</button>
                </div>
                <div>${escapeHtml(k.title)}</div>
                <div class="kanban-card-footer">
                    <span>🍅 ${escapeHtml(k.pomos)}</span>
                    <div>
                        ${col !== 'todo' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask(${inlineJsArg(k.id)},'todo')">⬅️</button>` : ''}
                        ${col !== 'doing' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask(${inlineJsArg(k.id)},'doing')">🔄</button>` : ''}
                        ${col !== 'done' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask(${inlineJsArg(k.id)},'done')">✅</button>` : ''}
                    </div>
                </div>
            </div>`).join('');
    });
}

window.addGradeSubject = function () {
    const name = document.getElementById('new-grade-subj-name').value.trim();
    const target = Number(document.getElementById('new-grade-subj-target').value) || 5;
    const credits = Number(document.getElementById('new-grade-subj-credits').value) || 6;
    if (!name) return;

    appState.grades.push({ id: Date.now().toString(), name, target, credits, items: [] });
    document.getElementById('new-grade-subj-name').value = '';
    saveState();
    renderGrades();
};

window.addGradeItem = function (subjId) {
    const titleEl = document.getElementById(`gi-title-${subjId}`);
    const weightEl = document.getElementById(`gi-weight-${subjId}`);
    const scoreEl = document.getElementById(`gi-score-${subjId}`);
    const title = titleEl?.value.trim() || 'Examen';
    const weight = Number(weightEl?.value) || 0;
    const score = Number(scoreEl?.value) || 0;
    if (weight <= 0) return;

    const subj = appState.grades.find(s => s.id === subjId);
    if (subj) subj.items.push({ id: Date.now().toString(), title, weight, score });
    saveState();
    renderGrades();
};

window.deleteGradeSubject = function (subjId) {
    appState.grades = appState.grades.filter(s => s.id !== subjId);
    saveState();
    renderGrades();
};

function renderGrades() {
    const container = document.getElementById('grades-subjects-container');
    if (!container) return;
    let totalWeighted = 0, totalCredits = 0;

    container.innerHTML = appState.grades.map(s => {
        const evalWeight = s.items.reduce((acc, i) => acc + i.weight, 0);
        const currentPoints = s.items.reduce((acc, i) => acc + (i.score * i.weight) / 100, 0);
        const avg = evalWeight > 0 ? (currentPoints / (evalWeight / 100)) : 0;
        if (evalWeight > 0) {
            totalWeighted += avg * s.credits;
            totalCredits += s.credits;
        }
        const remWeight = Math.max(0, 100 - evalWeight);
        const needed = remWeight > 0 ? Math.max(0, ((s.target - currentPoints) / (remWeight / 100))).toFixed(2) : null;

        return `<div class="grade-subject-card">
            <div class="grade-subj-header">
                <strong>${escapeHtml(s.name)} (${evalWeight}% eval.)</strong>
                <div class="card-actions">
                    <span class="grade-subj-score ${avg >= s.target ? 'score-pass' : 'score-fail'}">${avg.toFixed(2)}</span>
                    <button type="button" class="btn-icon" onclick="deleteGradeSubject(${inlineJsArg(s.id)})">🗑️</button>
                </div>
            </div>
            <div class="grade-progress-bar-bg"><div class="grade-progress-bar-fill" style="width:${Math.min(100, evalWeight)}%"></div></div>
            ${remWeight > 0 ? `<div class="grade-needed-banner">Necesitas un <strong>${needed}</strong> en el ${remWeight}% restante para llegar a ${escapeHtml(s.target)}</div>` : ''}
            <div class="form-inline-row">
                <input type="text" id="gi-title-${escapeHtml(s.id)}" placeholder="Prueba">
                <input type="number" id="gi-weight-${escapeHtml(s.id)}" placeholder="%" style="max-width:65px;">
                <input type="number" id="gi-score-${escapeHtml(s.id)}" placeholder="Nota" step="0.1" style="max-width:75px;">
                <button type="button" class="btn-green btn-sm" onclick="addGradeItem(${inlineJsArg(s.id)})">✚</button>
            </div>
        </div>`;
    }).join('');

    const globalAvg = totalCredits > 0 ? (totalWeighted / totalCredits).toFixed(2) : '--';
    document.getElementById('global-course-avg-badge').textContent = `Media: ${globalAvg}`;
}

window.setStudyHubTab = function (tab) {
    activeStudyHubTab = tab;
    ['flashcards', 'bugs', 'doubts'].forEach(t => {
        document.getElementById('hub-tab-' + t)?.classList.toggle('active', t === tab);
        document.getElementById('hub-view-' + t).style.display = t === tab ? 'block' : 'none';
    });
};

window.addFlashcard = function () {
    const subj = document.getElementById('fc-new-subj').value.trim() || 'General';
    const q = document.getElementById('fc-new-q').value.trim();
    const a = document.getElementById('fc-new-a').value.trim();
    if (!q || !a) return;
    appState.flashcards.push({ id: Date.now().toString(), subj, q, a, mastered: false });
    document.getElementById('fc-new-q').value = '';
    document.getElementById('fc-new-a').value = '';
    saveState();
    renderFlashcards();
};

window.flipCurrentFlashcard = function () {
    isFlashcardFlipped = !isFlashcardFlipped;
    renderFlashcards();
};

window.nextFlashcard = function () {
    isFlashcardFlipped = false;
    currentFlashcardIdx++;
    renderFlashcards();
};

window.markFlashcardStatus = function (mastered) {
    const deck = getFilteredFlashcards();
    if (!deck.length) return;
    const card = deck[currentFlashcardIdx % deck.length];
    card.mastered = mastered;
    saveState();
    nextFlashcard();
};

window.deleteCurrentFlashcard = function () {
    const deck = getFilteredFlashcards();
    if (!deck.length) return;
    const card = deck[currentFlashcardIdx % deck.length];
    appState.flashcards = appState.flashcards.filter(c => c.id !== card.id);
    saveState();
    renderFlashcards();
};

function getFilteredFlashcards() {
    const sel = document.getElementById('fc-filter-subject')?.value || 'all';
    return appState.flashcards.filter(c => sel === 'all' || c.subj === sel);
}

function renderFlashcards() {
    const select = document.getElementById('fc-filter-subject');
    if (select) {
        const current = select.value;
        const subjs = [...new Set(appState.flashcards.map(c => c.subj))];
        select.innerHTML = '<option value="all">Todas las asignaturas</option>' +
            subjs.map(s => `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    }
    const stage = document.getElementById('flashcard-stage');
    if (!stage) return;
    const deck = getFilteredFlashcards();
    if (!deck.length) {
        stage.innerHTML = '<span class="fc-hint">Sin tarjetas. Añade una con ✚ Tarjeta.</span>';
        return;
    }
    const card = deck[currentFlashcardIdx % deck.length];
    stage.innerHTML = isFlashcardFlipped
        ? `<div class="fc-answer-text">${escapeHtml(card.a)}</div><div class="fc-hint" style="margin-top:8px;">(Clic para volver a pregunta)</div>`
        : `<div class="kanban-subject-tag" style="margin-bottom:8px;">${escapeHtml(card.subj)} ${card.mastered ? '✅' : ''}</div><div class="fc-question-text">${escapeHtml(card.q)}</div><div class="fc-hint" style="margin-top:8px;">(Clic para voltear)</div>`;
}

window.addBugLog = function () {
    const subj = document.getElementById('bug-new-subj').value.trim() || 'Código';
    const error = document.getElementById('bug-new-error').value.trim();
    const cause = document.getElementById('bug-new-cause').value.trim();
    const fix = document.getElementById('bug-new-fix').value.trim();
    if (!error) return;
    appState.bugLogs.unshift({ id: Date.now().toString(), subj, error, cause, fix });
    document.getElementById('bug-new-error').value = '';
    saveState();
    renderBugLogs();
};

function renderBugLogs() {
    const q = (document.getElementById('bug-search-input')?.value || '').toLowerCase();
    const list = appState.bugLogs.filter(b => `${b.subj} ${b.error} ${b.fix}`.toLowerCase().includes(q));
    document.getElementById('bug-log-list').innerHTML = list.map(b => `
        <div class="hub-item-card">
            <strong>[${escapeHtml(b.subj)}] ${escapeHtml(b.error)}</strong>
            <div class="mono-muted">Causa: ${escapeHtml(b.cause || '-')} • Solución: ${escapeHtml(b.fix || '-')}</div>
        </div>`).join('') || '<p class="mono-muted">Sin bugs registrados.</p>';
}

window.addClassDoubt = function () {
    const subj = document.getElementById('doubt-new-subj').value.trim() || 'Clase';
    const text = document.getElementById('doubt-new-text').value.trim();
    if (!text) return;
    appState.doubts.unshift({ id: Date.now().toString(), subj, text, resolved: false });
    document.getElementById('doubt-new-text').value = '';
    saveState();
    renderDoubts();
};

window.toggleDoubt = function (id) {
    const d = appState.doubts.find(x => x.id === id);
    if (d) d.resolved = !d.resolved;
    saveState();
    renderDoubts();
};

function renderDoubts() {
    document.getElementById('doubts-list').innerHTML = appState.doubts.map(d => `
        <div class="hub-item-card" style="flex-direction:row;justify-content:space-between;align-items:center;">
            <span style="${d.resolved ? 'text-decoration:line-through;opacity:0.6;' : ''}"><strong>[${escapeHtml(d.subj)}]</strong> ${escapeHtml(d.text)}</span>
            <button type="button" class="btn-icon" onclick="toggleDoubt(${inlineJsArg(d.id)})">✅</button>
        </div>`).join('') || '<p class="mono-muted">Sin dudas pendientes.</p>';
}

window.exportStudyHubMarkdown = function () {
    const md = '# Study Hub\n\n## Bugs\n' + appState.bugLogs.map(b => `- **${b.error}**: ${b.fix}`).join('\n');
    navigator.clipboard.writeText(md).then(() => showToast('Study Hub copiado en MD', 'success'));
};

window.calculateStudyPlan = function () {
    const dateVal = document.getElementById('planner-exam-date').value;
    const topics = Number(document.getElementById('planner-topics-count').value) || 1;
    const minsPerTopic = Number(document.getElementById('planner-mins-topic').value) || 45;
    if (!dateVal) return;
    const today = new Date(`${getMadridDateKey()}T00:00:00Z`);
    const examDate = new Date(`${dateVal}T00:00:00Z`);
    const days = Math.max(1, Math.ceil((examDate - today) / 86400000));
    const totalMins = topics * minsPerTopic;
    document.getElementById('study-planner-result').textContent =
        `Quedan ${days} días → ${(topics / days).toFixed(1)} temas/día (${Math.ceil(totalMins / days)} min/día).`;
};

window.addTeamProject = function () {
    const name = document.getElementById('proj-new-name').value.trim();
    const repo = document.getElementById('proj-new-repo').value.trim();
    const working = document.getElementById('proj-new-working').value.trim();
    const pending = document.getElementById('proj-new-pending').value.trim();
    if (!name) return;
    appState.projects.unshift({ id: Date.now().toString(), name, repo, working, pending });
    document.getElementById('proj-new-name').value = '';
    saveState();
    renderProjects();
};

function renderProjects() {
    document.getElementById('team-projects-list').innerHTML = appState.projects.map(p => `
        <div class="hub-item-card">
            <div class="deadline-card-top">
                <strong>${escapeHtml(p.name)}</strong>
                ${getSafeExternalUrl(p.repo) ? `<a href="${escapeHtml(getSafeExternalUrl(p.repo))}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">Repo ↗</a>` : ''}
            </div>
            <div class="mono-muted">✅ ${escapeHtml(p.working || '-')} | ⏳ ${escapeHtml(p.pending || '-')}</div>
        </div>`).join('') || '<p class="mono-muted">Sin proyectos activos.</p>';
}

/* ----------------------------------------------------------
   DEV & SYSADMIN TOOLBOX + SERVIDORES + SNIPPETS
   ---------------------------------------------------------- */
window.setToolboxTab = function (tab) {
    activeToolboxTab = tab;
    ['format', 'encode', 'regex', 'net', 'sys', 'gen'].forEach(t => {
        document.getElementById('tb-tab-' + t)?.classList.toggle('active', t === tab);
        document.getElementById('tb-view-' + t).style.display = t === tab ? 'flex' : 'none';
    });
};

window.tbFormatJson = function (minify) {
    const el = document.getElementById('tb-json-input');
    const st = document.getElementById('tb-json-status');
    try {
        const obj = JSON.parse(el.value);
        el.value = JSON.stringify(obj, null, minify ? 0 : 2);
        st.textContent = '✅ JSON válido';
    } catch (e) {
        st.textContent = '❌ Error JSON: ' + e.message;
    }
};

window.tbJsonToCsv = function () {
    const el = document.getElementById('tb-json-input');
    try {
        const arr = JSON.parse(el.value);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Debe ser un array JSON');
        const keys = Object.keys(arr[0]);
        el.value = [keys.join(','), ...arr.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
    } catch (e) {
        document.getElementById('tb-json-status').textContent = '❌ ' + e.message;
    }
};

window.tbCsvToJson = function () {
    const el = document.getElementById('tb-json-input');
    const lines = el.value.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim());
    const data = lines.slice(1).map(l => {
        const vals = l.split(',');
        return Object.fromEntries(headers.map((h, i) => [h, vals[i]?.trim() ?? '']));
    });
    el.value = JSON.stringify(data, null, 2);
};

window.tbFormatSql = function () {
    const el = document.getElementById('tb-json-input');
    el.value = el.value.replace(/\b(SELECT|FROM|WHERE|AND|OR|ORDER BY|GROUP BY|JOIN|LEFT JOIN|INSERT INTO|VALUES|UPDATE|SET)\b/gi, '\n$1').trim();
};

window.tbEncodeAction = function (act) {
    const val = document.getElementById('tb-encode-input').value;
    const out = document.getElementById('tb-encode-output');
    try {
        if (act === 'b64e') out.textContent = btoa(unescape(encodeURIComponent(val)));
        else if (act === 'b64d') out.textContent = decodeURIComponent(escape(atob(val)));
        else if (act === 'urle') out.textContent = encodeURIComponent(val);
        else if (act === 'urld') out.textContent = decodeURIComponent(val);
    } catch (e) {
        out.textContent = 'Error: ' + e.message;
    }
};

window.tbDecodeJwt = function () {
    const token = document.getElementById('tb-encode-input').value.trim();
    const out = document.getElementById('tb-encode-output');
    try {
        const parts = token.split('.');
        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        out.textContent = JSON.stringify({ header, payload }, null, 2);
    } catch (_) {
        out.textContent = 'Token JWT inválido';
    }
};

window.tbComputeHashes = async function () {
    const txt = document.getElementById('tb-encode-input').value;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    document.getElementById('tb-encode-output').textContent = `SHA-256:\n${hex}`;
};

window.runRegexTester = function () {
    const pat = document.getElementById('tb-regex-pattern').value;
    const flags = document.getElementById('tb-regex-flags').value;
    const txt = document.getElementById('tb-regex-text').value;
    try {
        const rx = new RegExp(pat, flags);
        const matches = txt.match(rx) || [];
        document.getElementById('tb-regex-result').textContent = `Coincidencias (${matches.length}): ${matches.join(' | ')}`;
    } catch (e) {
        document.getElementById('tb-regex-result').textContent = 'Regex inválida: ' + e.message;
    }
};

window.runSimpleDiff = function () {
    const a = document.getElementById('tb-regex-text').value.split('\n');
    const b = document.getElementById('tb-diff-b').value.split('\n');
    const max = Math.max(a.length, b.length);
    const diffs = [];
    for (let i = 0; i < max; i++) {
        if (a[i] !== b[i]) diffs.push(`L${i + 1}: - "${a[i] || ''}" | + "${b[i] || ''}"`);
    }
    document.getElementById('tb-diff-output').textContent = diffs.length ? diffs.join('\n') : 'Sin diferencias.';
};

window.calculateSubnet = function () {
    const raw = document.getElementById('tb-ip-input').value.trim();
    const out = document.getElementById('tb-subnet-output');
    try {
        const subnet = calculateSubnet(raw);
        out.textContent = `Red: ${subnet.network}/${subnet.cidr}\nMáscara: ${subnet.mask}\nBroadcast: ${subnet.broadcast}\nRango útil: ${subnet.firstHost} - ${subnet.lastHost}\nHosts útiles: ${subnet.hosts}`;
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        out.textContent = error.message;
        return;
    }
};

window.convertNumberBase = function (from, val) {
    const radices = { dec: 10, bin: 2, hex: 16, oct: 8 };
    const num = parseInt(val.trim(), radices[from]);
    if (isNaN(num)) return;
    if (from !== 'dec') document.getElementById('base-dec').value = num.toString(10);
    if (from !== 'bin') document.getElementById('base-bin').value = num.toString(2);
    if (from !== 'hex') document.getElementById('base-hex').value = num.toString(16).toUpperCase();
    if (from !== 'oct') document.getElementById('base-oct').value = num.toString(8);
};

window.updateChmodCalc = function () {
    const calc = p => (document.getElementById(`ch-${p}r`).checked ? 4 : 0) +
        (document.getElementById(`ch-${p}w`).checked ? 2 : 0) +
        (document.getElementById(`ch-${p}x`).checked ? 1 : 0);
    const sym = p => (document.getElementById(`ch-${p}r`).checked ? 'r' : '-') +
        (document.getElementById(`ch-${p}w`).checked ? 'w' : '-') +
        (document.getElementById(`ch-${p}x`).checked ? 'x' : '-');
    document.getElementById('chmod-octal').textContent = `${calc('u')}${calc('g')}${calc('o')}`;
    document.getElementById('chmod-symbolic').textContent = `${sym('u')}${sym('g')}${sym('o')}`;
};

window.copyChmodCmd = function () {
    const oct = document.getElementById('chmod-octal').textContent;
    navigator.clipboard.writeText(`chmod ${oct} archivo`).then(() => showToast(`Copiado: chmod ${oct} archivo`, 'success'));
};

window.explainCronExpr = function () {
    const parts = document.getElementById('cron-expr-input').value.trim().split(/\s+/);
    if (parts.length !== 5) {
        document.getElementById('cron-explanation').textContent = 'Formato cron estándar: min hora día mes día_sem';
        return;
    }
    document.getElementById('cron-explanation').textContent =
        `Minuto: ${parts[0]} | Hora: ${parts[1]} | Día mes: ${parts[2]} | Mes: ${parts[3]} | Día semana: ${parts[4]}`;
};

window.generateMockUsers = function (count) {
    const users = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        username: `dev_user_${i + 1}`,
        email: `user${i + 1}@example.com`,
        active: true
    }));
    document.getElementById('tb-gen-output').value = JSON.stringify(users, null, 2);
};

window.generateUuidsAndDni = function () {
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const num = Math.floor(10000000 + Math.random() * 89999999);
    const dni = `${num}${letters[num % 23]}`;
    document.getElementById('tb-gen-output').value = `UUID: ${crypto.randomUUID()}\nDNI Prueba: ${dni}`;
};

window.generateSecurePassword = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-';
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    document.getElementById('tb-gen-output').value = [...arr].map(x => chars[x % chars.length]).join('');
};

window.loadBoilerplate = function (type) {
    const bp = {
        dockerfile: 'FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "index.js"]',
        compose: 'services:\n  app:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8080:80"\n    volumes:\n      - ./html:/usr/share/nginx/html:ro'
    };
    document.getElementById('tb-gen-output').value = bp[type] || '';
};

window.addServer = function () {
    const name = document.getElementById('srv-name').value.trim();
    const ip = document.getElementById('srv-ip').value.trim();
    const port = document.getElementById('srv-port').value.trim() || '22';
    const creds = document.getElementById('srv-creds').value.trim() || 'root';
    const logs = document.getElementById('srv-logs').value.trim();
    if (!name || !ip) return;
    appState.servers.push({ id: Date.now().toString(), name, ip, port, creds, logs });
    document.getElementById('srv-name').value = '';
    saveState();
    renderServers();
};

window.deleteServer = function (id) {
    appState.servers = appState.servers.filter(s => s.id !== id);
    saveState();
    renderServers();
};

window.copySshCmd = function (user, ip, port) {
    navigator.clipboard.writeText(`ssh ${user}@${ip} -p ${port}`).then(() => showToast('Comando SSH copiado', 'success'));
};

function renderServers() {
    const q = (document.getElementById('srv-search-filter')?.value || '').toLowerCase();
    const list = appState.servers.filter(s => `${s.name} ${s.ip} ${s.port} ${s.logs}`.toLowerCase().includes(q));
    document.getElementById('servers-list').innerHTML = list.map(s => `
        <li>
            <div>
                <strong>${escapeHtml(s.name)}</strong> <span class="mono-muted">(${escapeHtml(s.creds)}@${escapeHtml(s.ip)}:${escapeHtml(s.port)})</span>
                ${s.logs ? `<div class="mono-muted">Logs: ${escapeHtml(s.logs)}</div>` : ''}
            </div>
            <div class="card-actions">
                <button type="button" class="btn-cyan btn-sm" onclick="copySshCmd(${inlineJsArg(s.creds)},${inlineJsArg(s.ip)},${inlineJsArg(s.port)})">SSH</button>
                <button type="button" class="btn-icon" onclick="deleteServer(${inlineJsArg(s.id)})">🗑️</button>
            </div>
        </li>`).join('') || '<li class="mono-muted">Sin servidores registrados.</li>';
}

window.addInfraChangelog = function () {
    const input = document.getElementById('infra-changelog-input');
    const text = input.value.trim();
    if (!text) return;
    appState.infraChangelog.unshift({ id: Date.now().toString(), date: getNow().toLocaleString('es-ES'), text });
    input.value = '';
    saveState();
    renderInfraChangelog();
};

function renderInfraChangelog() {
    document.getElementById('infra-changelog-list').innerHTML = appState.infraChangelog.map(c =>
        `<div class="mono-muted">• [${escapeHtml(c.date)}] ${escapeHtml(c.text)}</div>`).join('');
}

window.addCustomSnippet = function () {
    const title = document.getElementById('snip-new-title').value.trim();
    const cat = document.getElementById('snip-new-cat').value.trim() || 'General';
    const cmd = document.getElementById('snip-new-cmd').value.trim();
    if (!title || !cmd) return;
    appState.snippets.unshift({ id: Date.now().toString(), title, cat, cmd });
    document.getElementById('snip-new-title').value = '';
    document.getElementById('snip-new-cmd').value = '';
    saveState();
    renderSnippets();
};

window.copyResolvedSnippet = function (cmd) {
    navigator.clipboard.writeText(cmd).then(() => showToast('Comando copiado', 'success'));
};

function renderSnippets() {
    const user = document.getElementById('cli-var-user')?.value || 'root';
    const ip = document.getElementById('cli-var-ip')?.value || '192.168.1.10';
    const port = document.getElementById('cli-var-port')?.value || '22';
    const q = (document.getElementById('snippet-search')?.value || '').toLowerCase();

    const list = appState.snippets.filter(s => `${s.title} ${s.cat} ${s.cmd}`.toLowerCase().includes(q));
    document.getElementById('snippet-list-container').innerHTML = list.map(s => {
        const resolved = s.cmd.replace(/\{\{USER\}\}/g, user).replace(/\{\{IP\}\}/g, ip).replace(/\{\{PORT\}\}/g, port);
        return `<div class="snippet-box">
            <div>
                <div class="mono-muted">[${escapeHtml(s.cat)}] ${escapeHtml(s.title)}</div>
                <div class="snippet-cmd-text">${escapeHtml(resolved)}</div>
            </div>
            <button type="button" class="btn-cyan btn-sm" onclick="copyResolvedSnippet(${inlineJsArg(resolved)})">📋</button>
        </div>`;
    }).join('');
}

window.addBookmark = function () {
    const name = document.getElementById('bm-name').value.trim();
    const url = document.getElementById('bm-url').value.trim();
    if (!name || !url) return;
    const safeUrl = getSafeExternalUrl(url);
    if (!safeUrl) {
        showToast('Introduce una URL que empiece por http:// o https://', 'error');
        return;
    }
    appState.bookmarks.push({ id: Date.now().toString(), name, url: safeUrl });
    document.getElementById('bm-name').value = '';
    document.getElementById('bm-url').value = '';
    saveState();
    renderBookmarks();
};

window.deleteBookmark = function (id) {
    appState.bookmarks = appState.bookmarks.filter(b => b.id !== id);
    saveState();
    renderBookmarks();
};

function renderBookmarks() {
    document.getElementById('bookmarks-list').innerHTML = appState.bookmarks.map(b => {
        const url = getSafeExternalUrl(b.url);
        const link = url
            ? `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">${escapeHtml(b.name)} ↗</a>`
            : `<span>${escapeHtml(b.name)} (URL no válida)</span>`;
        return `<li>
            ${link}
            <button type="button" class="btn-icon" onclick="deleteBookmark(${inlineJsArg(b.id)})">🗑️</button>
        </li>`;
    }).join('');
}

/* ----------------------------------------------------------
   GOOGLE FONTS & THEME STUDIO
   ---------------------------------------------------------- */
function injectGoogleFontStylesheet(fontName) {
    if (!fontName) return;
    const link = document.getElementById('dynamic-google-fonts');
    const families = new Set([
        appState.appearance.fontSans,
        appState.appearance.fontMono,
        fontName,
        ...appState.favoriteFonts
    ].filter(Boolean));
    const query = [...families].map(f => `family=${encodeURIComponent(f)}:wght@400;600;700`).join('&');
    if (link) link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
}

window.loadGoogleFontByName = function () {
    const name = document.getElementById('gf-input-name').value.trim();
    if (!name) return;
    quickLoadGoogleFont(name);
};

window.quickLoadGoogleFont = function (name) {
    lastLoadedGoogleFont = name;
    document.getElementById('gf-input-name').value = name;
    injectGoogleFontStylesheet(name);
    document.getElementById('gf-active-preview-label').textContent = `Vista previa: ${name}`;
    const sample = document.getElementById('gf-preview-sample');
    if (sample) sample.style.fontFamily = `'${name}', monospace`;
};

window.updateFontPlaygroundStyle = function () {
    const size = document.getElementById('gf-preview-size').value;
    const sample = document.getElementById('gf-preview-sample');
    if (sample) sample.style.fontSize = `${size}px`;
};

window.saveGoogleFontFavorite = function () {
    if (!lastLoadedGoogleFont) return;
    if (!appState.favoriteFonts.includes(lastLoadedGoogleFont)) {
        appState.favoriteFonts.push(lastLoadedGoogleFont);
        saveState();
        renderFavoriteFonts();
        showToast(`Fuente "${lastLoadedGoogleFont}" guardada`, 'success');
    }
};

window.applyLoadedFontToUi = function (target) {
    if (target === 'sans') appState.appearance.fontSans = lastLoadedGoogleFont;
    else appState.appearance.fontMono = lastLoadedGoogleFont;
    applyAllAppearance();
    saveState();
    showToast(`Fuente aplicada a ${target.toUpperCase()}`, 'success');
};

window.applyLoadedFontToStudio = function () {
    appState.studio.previewFont = lastLoadedGoogleFont;
    saveState();
    renderStudioFontSelector();
    showToast(`Fuente "${lastLoadedGoogleFont}" asignada a Live Code Studio`, 'success');
};

function renderFavoriteFonts() {
    const box = document.getElementById('gf-favorites-list');
    if (!box) return;
    box.innerHTML = appState.favoriteFonts.map(f =>
        `<button type="button" class="pill-btn" onclick="quickLoadGoogleFont(${inlineJsArg(f)})">${escapeHtml(f)}</button>`
    ).join('');
    renderStudioFontSelector();
}

function renderStudioFontSelector() {
    const sel = document.getElementById('studio-font-select');
    if (!sel) return;
    sel.innerHTML = '<option value="">🔤 Fuente Preview (Por defecto)</option>' +
        appState.favoriteFonts.map(f => `<option value="${escapeHtml(f)}" ${appState.studio.previewFont === f ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
}

window.updateAppearanceSettings = function () {
    appState.appearance.scale = document.getElementById('ui-scale-select').value;
    applyAllAppearance();
    saveState();
};

window.activateCustomTheme = function () {
    appState.theme = 'custom';
    appState.appearance.customName = document.getElementById('custom-theme-name').value || 'Mi Tema';
    appState.appearance.colors = {
        bg: document.getElementById('cp-bg').value,
        card: document.getElementById('cp-card').value,
        border: document.getElementById('cp-border').value,
        text: document.getElementById('cp-text').value,
        cyan: document.getElementById('cp-cyan').value,
        violet: document.getElementById('cp-violet').value
    };
    document.getElementById('theme-select').value = 'custom';
    applyAllAppearance();
    saveState();
};

window.resetAppearanceDefaults = function () {
    appState.appearance.fontSans = 'Inter';
    appState.appearance.fontMono = 'JetBrains Mono';
    appState.appearance.scale = '1';
    applyAllAppearance();
    saveState();
};

function applyAllAppearance() {
    document.documentElement.setAttribute('data-theme', appState.theme);
    document.body.classList.toggle('density-compact', !!appState.densityCompact);
    const dBtn = document.getElementById('btn-density-mode');
    if (dBtn) dBtn.textContent = appState.densityCompact ? '📐 Compacto' : '📐 Aireado';

    const root = document.documentElement.style;
    root.setProperty('--ui-scale', appState.appearance.scale || '1');
    root.setProperty('--font-sans', `'${appState.appearance.fontSans}', system-ui, sans-serif`);
    root.setProperty('--font-mono', `'${appState.appearance.fontMono}', monospace`);
    injectGoogleFontStylesheet(appState.appearance.fontSans);

    if (appState.theme === 'custom') {
        const c = appState.appearance.colors;
        root.setProperty('--bg-color', c.bg);
        root.setProperty('--card-bg', c.card);
        root.setProperty('--card-border', c.border);
        root.setProperty('--text-main', c.text);
        root.setProperty('--accent-cyan', c.cyan);
        root.setProperty('--accent-violet', c.violet);
    } else {
        ['--bg-color', '--card-bg', '--card-border', '--text-main', '--accent-cyan', '--accent-violet'].forEach(v => root.removeProperty(v));
    }

    const themeSel = document.getElementById('theme-select');
    if (themeSel) themeSel.value = appState.theme;
}

/* ----------------------------------------------------------
   BUSCADOR GLOBAL, SNAPSHOTS, RESUMEN Y BACKUPS
   ---------------------------------------------------------- */
window.openGlobalSearch = function () {
    document.getElementById('global-search-modal').style.display = 'flex';
    const inp = document.getElementById('global-search-input');
    inp.value = '';
    globalSearchQuery = '';
    globalSearchSelectedIdx = 0;
    filterGlobalSearch();
    inp.focus();
};

window.closeGlobalSearch = function () {
    document.getElementById('global-search-modal').style.display = 'none';
};

window.filterGlobalSearch = function () {
    const q = (document.getElementById('global-search-input').value || '').trim().toLocaleLowerCase('es-ES');
    if (q !== globalSearchQuery) {
        globalSearchQuery = q;
        globalSearchSelectedIdx = 0;
    }

    const results = [];
    const add = (items, type, ws, getLabel, getSearchText = getLabel) => {
        if (!Array.isArray(items)) return;
        items.forEach(item => {
            const label = String(getLabel(item) || '');
            const searchable = String(getSearchText(item) || label).toLocaleLowerCase('es-ES');
            if (searchable.includes(q)) results.push({ type, label, ws });
        });
    };

    add(appState.tasks, 'Tarea', 'cockpit', t => t.text, t =>
        `${t.text} ${t.date || ''} ${t.repeat || ''} ${(Array.isArray(t.subtasks) ? t.subtasks : []).map(subtask => subtask.text).join(' ')}`);
    add(appState.deliveries, 'Entrega', 'cockpit', d => d.title, d => `${d.title} ${d.subject} ${d.type}`);
    add(appState.schedule, 'Horario', 'cockpit', c => `${c.subject} · ${c.start}`, c => `${c.subject} ${c.room} ${c.start} ${c.end}`);
    add(appState.studio.savedProjects, 'Proyecto web', 'studio', p => p.title);
    add(appState.snippets, 'Snippet', 'devlab', s => `${s.title}: ${s.cmd}`, s => `${s.title} ${s.cmd} ${s.cat}`);
    add(appState.servers, 'Servidor', 'devlab', s => `${s.name} (${s.ip})`, s => `${s.name} ${s.ip} ${s.port} ${s.logs}`);
    add(appState.kanban, 'Kanban', 'academy', k => k.title, k => `${k.title} ${k.subject} ${k.status}`);
    add(appState.flashcards, 'Flashcard', 'academy', c => c.q, c => `${c.q} ${c.a} ${c.subj}`);
    add(appState.bugLogs, 'Bug', 'academy', b => b.error, b => `${b.subj} ${b.error} ${b.cause} ${b.fix}`);
    add(appState.doubts, 'Duda', 'academy', d => d.text, d => `${d.subj} ${d.text}`);
    add(appState.projects, 'Proyecto', 'academy', p => p.name, p => `${p.name} ${p.repo} ${p.working} ${p.pending}`);
    add(appState.bookmarks, 'Enlace', 'devlab', b => b.name, b => `${b.name} ${b.url}`);
    Object.entries(appState.notes || {}).forEach(([tab, note]) => {
        if (typeof note !== 'string' || !note.trim() || !note.toLocaleLowerCase('es-ES').includes(q)) return;
        results.push({ type: 'Nota', label: `${tab}: ${note.slice(0, 120)}`, ws: 'cockpit' });
    });

    globalSearchResults = results.slice(0, 30);
    globalSearchSelectedIdx = Math.min(globalSearchSelectedIdx, Math.max(0, globalSearchResults.length - 1));
    renderGlobalSearchResults();
};

function renderGlobalSearchResults() {
    const ul = document.getElementById('global-search-results');
    ul.innerHTML = globalSearchResults.slice(0, 15).map((result, index) => `
        <li class="search-result-item ${index === globalSearchSelectedIdx ? 'selected' : ''}" onclick="switchWorkspace(${inlineJsArg(result.ws)});closeGlobalSearch();">
            <span>${escapeHtml(result.label)}</span>
            <span class="badge-version">${escapeHtml(result.type)}</span>
        </li>`).join('') || '<li class="mono-muted">Sin coincidencias.</li>';
    ul.querySelector('.selected')?.scrollIntoView({ block: 'nearest' });
};

window.handleGlobalSearchKeydown = function (e) {
    if (e.key === 'Escape') {
        closeGlobalSearch();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const lastIndex = Math.min(globalSearchResults.length, 15) - 1;
        if (lastIndex < 0) return;
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        globalSearchSelectedIdx = (globalSearchSelectedIdx + delta + lastIndex + 1) % (lastIndex + 1);
        renderGlobalSearchResults();
    } else if (e.key === 'Enter' && globalSearchResults[globalSearchSelectedIdx]) {
        const result = globalSearchResults[globalSearchSelectedIdx];
        switchWorkspace(result.ws);
        closeGlobalSearch();
    }
};

window.openSnapshotsModal = function () {
    renderSnapshotsList();
    document.getElementById('snapshots-modal').style.display = 'flex';
};

window.closeSnapshotsModal = function () {
    document.getElementById('snapshots-modal').style.display = 'none';
};

window.createManualSnapshot = function () {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    snaps.unshift({ id: Date.now().toString(), date: getNow().toLocaleString('es-ES'), data: appState });
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(0, 10)));
    renderSnapshotsList();
    showToast('Snapshot guardado', 'success');
};

window.restoreSnapshot = function (id) {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    const found = snaps.find(s => s.id === id);
    if (!found) return;
    appState = mergeState(createDefaultState(), found.data);
    saveState();
    applyAllAppearance();
    renderAll();
    closeSnapshotsModal();
    showToast('Snapshot restaurado', 'success');
};

function renderSnapshotsList() {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    document.getElementById('snapshots-list-container').innerHTML = snaps.map(s => `
        <div class="deadline-card-item">
            <div class="deadline-card-top">
                <span>📸 ${escapeHtml(s.date)}</span>
                <button type="button" class="btn-cyan btn-sm" onclick="restoreSnapshot(${inlineJsArg(s.id)})">Restaurar</button>
            </div>
        </div>`).join('') || '<p class="mono-muted">No hay snapshots guardados.</p>';
}

window.generateDailySummaryModal = function () {
    const todayStr = getMadridDateKey();
    const doneTasks = appState.tasks.filter(t => t.done).map(t => `- [x] ${t.text}`).join('\n') || '- Ninguna';
    const pendingTasks = appState.tasks.filter(t => !t.done).map(t => `- [ ] ${t.text}`).join('\n') || '- Ninguna';
    const mins = appState.pomodoro.lastStudyDate === todayStr ? appState.pomodoro.todayMinutes : 0;

    document.getElementById('daily-summary-output').value =
        `# Resumen DevWorkspace (${todayStr})\n- **Tiempo Focus:** ${mins} min\n\n## Completadas\n${doneTasks}\n\n## Pendientes\n${pendingTasks}`;
    document.getElementById('daily-summary-modal').style.display = 'flex';
};

window.closeDailySummaryModal = function () {
    document.getElementById('daily-summary-modal').style.display = 'none';
};

window.openShortcutsModal = function () {
    document.getElementById('shortcuts-modal').style.display = 'flex';
};

window.closeShortcutsModal = function () {
    document.getElementById('shortcuts-modal').style.display = 'none';
};

window.exportData = function () {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devworkspace-backup-${getMadridDateKey()}.json`;
    a.click();
};

window.importData = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const imported = JSON.parse(e.target.result);
            if (!imported || typeof imported !== 'object' || Array.isArray(imported)) {
                throw new Error('El backup debe ser un objeto JSON');
            }
            appState = mergeState(createDefaultState(), imported);
            saveState();
            applyAllAppearance();
            renderAll();
            showToast('Backup importado correctamente', 'success');
        } catch (_) {
            showToast('Archivo JSON inválido', 'error');
        }
    };
    reader.readAsText(file);
};

window.resetWorkspacePrompt = function () {
    if (!confirm('¿Vaciar todos los datos locales de DevWorkspace?')) return;
    appState = createDefaultState();
    saveState();
    applyAllAppearance();
    renderAll();
};

function updateStorageQuotaBadge(bytes) {
    const badge = document.getElementById('storage-quota-badge');
    if (badge) badge.textContent = `Storage: ${(bytes / 1024).toFixed(1)} KB`;
}

function updateConnectionStatus() {
    const status = document.getElementById('connection-status');
    if (!status) return;
    const online = navigator.onLine;
    status.textContent = online ? '🟢 Online' : '🟠 Offline · cambios locales';
    status.classList.toggle('connection-online', online);
    status.classList.toggle('connection-offline', !online);
}

function initializePwaSupport() {
    updateConnectionStatus();
    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    window.addEventListener('beforeinstallprompt', event => {
        event.preventDefault();
        deferredInstallPrompt = event;
        const button = document.getElementById('app-install-button');
        if (button) button.style.display = 'inline-flex';
    });
    window.addEventListener('appinstalled', () => {
        deferredInstallPrompt = null;
        const button = document.getElementById('app-install-button');
        if (button) button.style.display = 'none';
        showToast('DevWorkspace se ha instalado', 'success');
    });

    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js')
        .then(() => navigator.serviceWorker.ready)
        .then(registration => {
            serviceWorkerRegistration = registration;
            scheduleAllDeliveryReminders();
        })
        .catch(error => {
            console.error('No se pudo registrar el service worker:', error);
            showToast('No se pudo activar el modo offline', 'error');
        });
}

window.installApp = async function () {
    if (!deferredInstallPrompt) {
        showToast('La instalación no está disponible en este navegador', 'info');
        return;
    }
    const prompt = deferredInstallPrompt;
    deferredInstallPrompt = null;
    const button = document.getElementById('app-install-button');
    if (button) button.style.display = 'none';
    try {
        await prompt.prompt();
        const choice = await prompt.userChoice;
        if (choice.outcome === 'accepted') showToast('Instalación iniciada', 'success');
        else if (choice.outcome === 'dismissed') showToast('Instalación cancelada', 'info');
    } catch (error) {
        console.error('No se pudo iniciar la instalación:', error);
        showToast('No se pudo iniciar la instalación', 'error');
    }
};

/* ----------------------------------------------------------
   RENDERIZADO GLOBAL Y EVENTOS DE INICIO
   ---------------------------------------------------------- */
function renderAll() {
    renderScheduleWidget();
    renderDeliveries();
    renderTasks();
    updateStats();
    renderKanban();
    renderGrades();
    renderFlashcards();
    renderBugLogs();
    renderDoubts();
    renderProjects();
    renderServers();
    renderInfraChangelog();
    renderSnippets();
    renderBookmarks();
    renderFavoriteFonts();
    updateNotificationControls();
    if (window.Notification?.permission === 'granted') scheduleAllDeliveryReminders();

    const pad = document.getElementById('scratchpad');
    if (pad) pad.value = appState.notes[activeNotesTab] || '';
    updateScratchpadMetrics();

    const sticky = document.getElementById('sticky-note-input');
    if (sticky) sticky.value = appState.stickyNote || '';

    const stTitle = document.getElementById('studio-project-title');
    if (stTitle) stTitle.value = appState.studio.currentTitle || 'Mi Proyecto Web';
    const cHtml = document.getElementById('code-html');
    const cCss = document.getElementById('code-css');
    const cJs = document.getElementById('code-js');
    if (cHtml) cHtml.value = appState.studio.html || '';
    if (cCss) cCss.value = appState.studio.css || '';
    if (cJs) cJs.value = appState.studio.js || '';

    document.getElementById('pomo-focus-time').value = appState.pomodoro.focusMins || 25;
    document.getElementById('pomo-break-time').value = appState.pomodoro.breakMins || 5;
    if (!pomoRunning) {
        pomoSecondsLeft = (appState.pomodoro.focusMins || 25) * 60;
        updatePomodoroDisplay();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    applyAllAppearance();
    initializePwaSupport();
    switchWorkspace(appState.activeWorkspace || 'cockpit');
    renderAll();
    updateWeatherBadge();
    explainCronExpr();
    syncRealTimeNetwork();
    updateClockLoop();
    setInterval(updateClockLoop, 1000);
    setInterval(renderScheduleWidget, 30000);

    // Listeners de auto-guardado en notas
    document.getElementById('scratchpad')?.addEventListener('input', (e) => {
        appState.notes[activeNotesTab] = e.target.value;
        updateScratchpadMetrics();
        saveState();
    });

    document.getElementById('sticky-note-input')?.addEventListener('input', (e) => {
        appState.stickyNote = e.target.value;
        saveState();
    });

    // Listeners Live Code Studio
    ['code-html', 'code-css', 'code-js', 'studio-project-title'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            syncStudioStateFromInputs();
            if (document.getElementById('studio-autorun')?.checked) {
                clearTimeout(studioAutoRunTimer);
                studioAutoRunTimer = setTimeout(runStudioPreview, 350);
            }
        });
    });

    window.addEventListener('message', (ev) => {
        const iframe = document.getElementById('studio-preview-iframe');
        const { data } = ev;
        if (ev.source !== iframe?.contentWindow || !data || data.source !== 'studio-console' || data.token !== studioConsoleToken) return;

        const levels = ['log', 'warn', 'error'];
        if (!levels.includes(data.level) || typeof data.msg !== 'string') return;
        studioConsoleLogs.push({ level: data.level, msg: data.msg.slice(0, 4000) });
        if (studioConsoleLogs.length > 200) studioConsoleLogs.shift();
        renderStudioConsole();
    });

    document.getElementById('theme-select')?.addEventListener('change', (e) => {
        appState.theme = e.target.value;
        applyAllAppearance();
        saveState();
    });

    // Atajos de teclado globales
    document.addEventListener('keydown', (e) => {
        const target = e.target;
        const isEditing = target instanceof HTMLElement &&
            (target.isContentEditable || target.matches('input, textarea, select'));

        if (e.ctrlKey && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if (e.altKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            toggleZenMode();
        } else if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            const map = ['cockpit', 'studio', 'academy', 'devlab', 'fonts'];
            switchWorkspace(map[Number(e.key) - 1]);
        } else if (!isEditing && e.ctrlKey && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            switchWorkspace('cockpit');
            document.getElementById('task-text')?.focus();
        } else if (!isEditing && e.ctrlKey && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            if (pomoRunning) stopPomodoro();
            else startCustomPomodoro('focus');
        } else if (!isEditing && e.key === '?') {
            e.preventDefault();
            openShortcutsModal();
        }
    });

    updateStorageQuotaBadge((localStorage.getItem(STORAGE_KEY) || '').length);
    initFirebaseIfConfigured();
});