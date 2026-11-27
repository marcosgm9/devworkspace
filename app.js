import {
    mergeState,
    createDebouncer,
    getMadridDateKey,
    getMadridClock,
    calculateSubnet as calcSubnetCore,
    getNextRepeatDate,
    normalizeExternalUrl,
    parseBaseValue,
    packDrivePayload,
    unpackDrivePayload,
    parseScheduleImportText
} from './core.js';

const STORAGE_KEY = 'devworkspace_v7_state';
const MAX_SNAPSHOTS = 12;
const MAX_NOTE_REVISIONS = 25;
const MAX_SERVER_LOGS = 40;
const MAX_STUDIO_PROJECTS = 25;
const DEFAULT_DRIVE_SALT = 'dw-v72-drive-guard-9be90';
const DRIVE_VAULT_FILENAME = 'devworkspace_vault.dwpk';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

const ALLOWED_WORKSPACES = ['cockpit', 'studio', 'database', 'academy', 'devlab', 'fonts'];
const ALLOWED_THEMES = ['cyberpunk', 'dracula', 'valorant', 'minecraft', 'retro', 'daylight', 'custom'];
const ALLOWED_PRESETS = ['default', 'today', 'exam', 'dev', 'db', 'sysadmin'];
const ALLOWED_TASK_FILTERS = ['all', 'pending', 'done', 'today', 'overdue'];
const ALLOWED_TASK_BLOCKS = ['all', 'morning', 'afternoon', 'night'];
const ALLOWED_TASK_SORTS = ['created', 'priority', 'block', 'date'];
const ALLOWED_PRIORITIES = ['high', 'medium', 'low'];
const ALLOWED_REPEATS = ['', 'daily', 'weekly', 'monthly'];
const ALLOWED_DELIVERY_FILTERS = ['all', 'pending', 'soon', 'exam', 'practice'];
const ALLOWED_NOTE_TABS = ['general', 'comandos', 'clases'];
const ALLOWED_STUDIO_TABS = ['html', 'css', 'js', 'python', 'java', 'saved'];
const ALLOWED_VIEWPORTS = ['100%', '768px', '375px'];
const ALLOWED_KANBAN_COLS = ['todo', 'doing', 'done'];

const PRESET_CARDS = {
    default: null,
    today: ['card-schedule', 'card-tasks', 'card-pomodoro'],
    exam: ['card-kanban', 'card-study-hub', 'card-grades', 'card-pomodoro'],
    dev: ['card-dev-toolbox', 'card-snippets', 'card-projects'],
    db: ['card-db-manager', 'card-db-sql'],
    sysadmin: ['card-servers', 'card-snippets', 'card-dev-toolbox']
};

const STUDIO_TEMPLATES = {
    blank: {
        html: '<main class="box">\n  <h1>Hola DevWorkspace</h1>\n  <p>Listo para programar.</p>\n</main>',
        css: 'body { font-family: system-ui, sans-serif; background: #090d16; color: #f1f5f9; padding: 2rem; }\n.box { border: 1px solid #00f0ff; border-radius: 10px; padding: 1.5rem; }',
        js: 'console.log("HTML5 base cargado");'
    },
    cybercard: {
        html: '<div class="cyber-card">\n  <span class="tag">SYS.ONLINE</span>\n  <h2>Módulo DAM</h2>\n  <p id="status">Estado: activo</p>\n  <button id="btn-ping">Ping</button>\n</div>',
        css: 'body { display: grid; place-items: center; min-height: 100vh; background: #050711; color: #e2e8f0; }\n.cyber-card { background: #0c1322; border: 1px solid #00f0ff; padding: 24px; border-radius: 12px; box-shadow: 0 0 24px rgba(0,240,255,.2); }\n.tag { color: #b84dff; font-family: monospace; font-size: 12px; }\nbutton { margin-top: 12px; padding: 8px 14px; background: #00f0ff; color: #050711; border: 0; border-radius: 6px; font-weight: 700; cursor: pointer; }',
        js: 'document.getElementById("btn-ping")?.addEventListener("click", () => {\n  document.getElementById("status").textContent = "Estado: ping OK (" + new Date().toLocaleTimeString() + ")";\n});'
    },
    flexgrid: {
        html: '<div class="layout">\n  <header class="hd">Cabecera</header>\n  <aside class="sb">Lateral</aside>\n  <section class="cnt">Contenido principal</section>\n</div>',
        css: '.layout { display: grid; grid-template-columns: 220px 1fr; grid-template-rows: auto 1fr; gap: 12px; min-height: 85vh; font-family: sans-serif; }\n.hd { grid-column: 1 / -1; background: #1e293b; color: #fff; padding: 14px; border-radius: 8px; }\n.sb, .cnt { background: #0f172a; color: #e2e8f0; padding: 14px; border-radius: 8px; }',
        js: 'console.log("Grid layout listo");'
    },
    domlab: {
        html: '<h2>Contador DOM</h2>\n<button id="inc">+1</button>\n<span id="val">0</span>',
        css: 'body { font-family: sans-serif; padding: 20px; background: #0b1020; color: #f8fafc; }\nbutton { padding: 6px 12px; cursor: pointer; }',
        js: 'let n = 0;\ndocument.getElementById("inc")?.addEventListener("click", () => {\n  n++;\n  document.getElementById("val").textContent = String(n);\n});'
    },
    python: {
        python: '# Script Python 3 de prueba\nnombre = "Marcos"\nnotas = [8.5, 9.0, 7.5]\nmedia = sum(notas) / len(notas)\nprint(f"Alumno: {nombre} | Media: {media:.2f}")'
    },
    java: {
        java: 'public class Main {\n    public static void main(String[] args) {\n        String curso = "1º DAM";\n        int modulos = 6;\n        System.out.println("Curso: " + curso + " - Modulos: " + modulos);\n    }\n}'
    }
};

const CDN_SNIPPETS = {
    tailwind: '<script src="https://cdn.tailwindcss.com"></script>',
    bootstrap: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">',
    alpine: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>',
    chartjs: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
};

const BOILERPLATES = {
    dockerfile: 'FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]',
    compose: 'services:\n  app:\n    image: nginx:alpine\n    ports:\n      - "8080:80"\n    restart: unless-stopped'
};
let state = createDefaultState();
let currentTaskFilter = 'all';
let currentTaskBlockFilter = 'all';
let currentTaskSort = 'created';
let currentDeliveryFilter = 'all';
let currentFlashcardIndex = 0;
let isFlashcardFlipped = false;
let pomodoroInterval = null;
let pomodoroRemainingSeconds = 25 * 60;
let pomodoroSessionTotalSeconds = 25 * 60;
let pomodoroCurrentMode = 'focus';
let isAudioPlaying = false;
let audioCtx = null;
let audioGain = null;
let noiseNode = null;
let clockTickInterval = null;
let realNetworkTimeOffset = 0;
let hasRealNetworkTime = false;
let manualClockOffsetMs = null;
let deferredInstallPrompt = null;
let pendingServiceWorker = null;
let globalSearchMatches = [];
let globalSearchSelectedIndex = -1;
let studioConsoleLogs = [];
let notifiedDeliveryAlerts = new Set();
let googleTokenClient = null;
let pendingDriveAction = null;

function createDefaultState() {
    return {
        ui: {
            workspace: 'cockpit',
            theme: 'cyberpunk',
            preset: 'default',
            density: 'airy',
            zenMode: false,
            presentationMode: false,
            noteTab: 'general',
            deliveryFilter: 'all',
            examCramMode: false,
            studyHubTab: 'flashcards',
            toolboxTab: 'format',
            studioActiveTab: 'html',
            studioViewport: '100%',
            scheduleViewMode: 'current',
            activeDbTable: 'alumnos',
            uiScale: 1,
            fontSans: 'Inter',
            fontMono: 'JetBrains Mono',
            studioFont: '',
            previewFontSize: 18,
            weatherEnabled: false,
            customTheme: {
                name: 'Mi Tema',
                fontUi: '',
                fontMono: '',
                bg: '#050711',
                card: '#0b111e',
                border: '#1e293b',
                text: '#f1f5f9',
                cyan: '#00f0ff',
                violet: '#b84dff'
            }
        },
        drive: {
            connected: false,
            userName: '',
            userEmail: '',
            accessToken: '',
            clientId: '',
            fileId: '',
            lastSync: null,
            dirty: false
        },
        catalogSubjects: [
            { id: 'sub-prog', name: 'Programación', teacher: '', room: '' },
            { id: 'sub-bd', name: 'Bases de Datos', teacher: '', room: '' },
            { id: 'sub-ed', name: 'Entornos de Desarrollo', teacher: '', room: '' },
            { id: 'sub-lm', name: 'Lenguajes de Marcas', teacher: '', room: '' },
            { id: 'sub-si', name: 'Sistemas Informáticos', teacher: '', room: '' }
        ],
        schedule: [],
        deliveries: [],
        tasks: [],
        pomodoro: {
            focusMinutes: 25,
            breakMinutes: 5,
            todayMinutes: 0,
            totalMinutes: 0,
            streak: 0,
            lastStudyDay: null,
            linkedTaskId: '',
            history: {}
        },
        notes: { general: '', comandos: '', clases: '' },
        noteRevisions: [],
        stickyNote: '',
        studio: {
            projectTitle: 'Proyecto Web Base',
            html: STUDIO_TEMPLATES.blank.html,
            css: STUDIO_TEMPLATES.blank.css,
            js: STUDIO_TEMPLATES.blank.js,
            python: STUDIO_TEMPLATES.python.python,
            java: STUDIO_TEMPLATES.java.java,
            savedProjects: []
        },
        database: {
            tables: {
                alumnos: {
                    columns: ['id', 'nombre', 'curso'],
                    rows: []
                }
            }
        },
        kanban: [],
        grades: [],
        flashcards: [],
        bugs: [],
        doubts: [],
        projects: [],
        servers: [],
        infraLogs: [],
        snippets: [],
        bookmarks: [],
        customFonts: ['JetBrains Mono', 'Fira Code', 'Space Grotesk', 'Outfit', 'Orbitron', 'IBM Plex Mono'],
        customThemePresets: [],
        snapshots: []
    };
}
function normalizeStateShape(raw) {
    const def = createDefaultState();
    const merged = mergeState(def, raw && typeof raw === 'object' ? raw : {});

    merged.ui.workspace = ALLOWED_WORKSPACES.includes(merged.ui.workspace) ? merged.ui.workspace : 'cockpit';
    merged.ui.theme = ALLOWED_THEMES.includes(merged.ui.theme) ? merged.ui.theme : 'cyberpunk';
    merged.ui.preset = ALLOWED_PRESETS.includes(merged.ui.preset) ? merged.ui.preset : 'default';
    merged.ui.density = merged.ui.density === 'compact' ? 'compact' : 'airy';
    merged.ui.noteTab = ALLOWED_NOTE_TABS.includes(merged.ui.noteTab) ? merged.ui.noteTab : 'general';
    merged.ui.deliveryFilter = ALLOWED_DELIVERY_FILTERS.includes(merged.ui.deliveryFilter) ? merged.ui.deliveryFilter : 'all';
    merged.ui.studioActiveTab = ALLOWED_STUDIO_TABS.includes(merged.ui.studioActiveTab) ? merged.ui.studioActiveTab : 'html';
    merged.ui.studioViewport = ALLOWED_VIEWPORTS.includes(merged.ui.studioViewport) ? merged.ui.studioViewport : '100%';
    merged.ui.scheduleViewMode = merged.ui.scheduleViewMode === 'table' ? 'table' : 'current';
    merged.ui.uiScale = Number.isFinite(Number(merged.ui.uiScale)) ? Math.min(1.25, Math.max(0.8, Number(merged.ui.uiScale))) : 1;
    merged.ui.previewFontSize = Number.isFinite(Number(merged.ui.previewFontSize)) ? Math.min(48, Math.max(10, Number(merged.ui.previewFontSize))) : 18;

    if (!merged.ui.customTheme || typeof merged.ui.customTheme !== 'object') {
        merged.ui.customTheme = { ...def.ui.customTheme };
    }
    if (!merged.drive || typeof merged.drive !== 'object') {
        merged.drive = { ...def.drive };
    }
    if (!Array.isArray(merged.catalogSubjects) || !merged.catalogSubjects.length) {
        merged.catalogSubjects = [...def.catalogSubjects];
    }
    if (!merged.database || typeof merged.database !== 'object' || typeof merged.database.tables !== 'object') {
        merged.database = { ...def.database };
    }

    ['schedule', 'deliveries', 'tasks', 'noteRevisions', 'kanban', 'grades', 'flashcards', 'bugs', 'doubts', 'projects', 'servers', 'infraLogs', 'snippets', 'bookmarks', 'customFonts', 'customThemePresets', 'snapshots']
        .forEach(key => {
            if (!Array.isArray(merged[key])) merged[key] = [];
        });

    if (!merged.notes || typeof merged.notes !== 'object') {
        merged.notes = { general: '', comandos: '', clases: '' };
    }
    ['general', 'comandos', 'clases'].forEach(k => {
        if (typeof merged.notes[k] !== 'string') merged.notes[k] = '';
    });

    if (!merged.studio || typeof merged.studio !== 'object') {
        merged.studio = { ...def.studio };
    } else {
        ['html', 'css', 'js', 'python', 'java'].forEach(k => {
            if (typeof merged.studio[k] !== 'string') merged.studio[k] = def.studio[k] || '';
        });
        if (!Array.isArray(merged.studio.savedProjects)) merged.studio.savedProjects = [];
    }

    if (!merged.pomodoro || typeof merged.pomodoro !== 'object') {
        merged.pomodoro = { ...def.pomodoro };
    } else if (!merged.pomodoro.history || typeof merged.pomodoro.history !== 'object') {
        merged.pomodoro.history = {};
    }

    return merged;
}

function buildCompactVaultSnapshot() {
    const cleanTasks = (state.tasks || []).map(t => {
        const obj = {
            id: t.id,
            text: t.text,
            done: Boolean(t.done),
            priority: t.priority || 'medium',
            block: t.block || 'afternoon',
            createdAt: t.createdAt || 0
        };
        if (t.date) obj.date = t.date;
        if (t.repeat) obj.repeat = t.repeat;
        if (t.pomos) obj.pomos = t.pomos;
        if (Array.isArray(t.subtasks) && t.subtasks.length) obj.subtasks = t.subtasks;
        return obj;
    });

    return {
        ui: state.ui,
        catalogSubjects: state.catalogSubjects,
        schedule: state.schedule,
        deliveries: state.deliveries,
        tasks: cleanTasks,
        pomodoro: state.pomodoro,
        notes: state.notes,
        noteRevisions: state.noteRevisions.slice(0, MAX_NOTE_REVISIONS),
        stickyNote: state.stickyNote,
        studio: {
            projectTitle: state.studio.projectTitle,
            html: state.studio.html,
            css: state.studio.css,
            js: state.studio.js,
            python: state.studio.python,
            java: state.studio.java,
            savedProjects: state.studio.savedProjects.slice(0, MAX_STUDIO_PROJECTS)
        },
        database: state.database,
        kanban: state.kanban,
        grades: state.grades,
        flashcards: state.flashcards,
        bugs: state.bugs,
        doubts: state.doubts,
        projects: state.projects,
        servers: state.servers,
        infraLogs: state.infraLogs.slice(0, MAX_SERVER_LOGS),
        snippets: state.snippets,
        bookmarks: state.bookmarks,
        customFonts: state.customFonts,
        customThemePresets: state.customThemePresets
    };
}
function saveState(forceDrivePush = false) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateStorageQuotaBadge();
    } catch (_) {
        showToast('Aviso: límite de almacenamiento local alcanzado', 'error');
    }

    if (!state.drive) {
        state.drive = { connected: false, dirty: false };
    }
    state.drive.dirty = true;
    updateDriveSyncIndicator('pending');

    if (state.drive.connected && state.drive.accessToken) {
        if (forceDrivePush) {
            debouncedDriveSync.cancel();
            pushToGoogleDrive();
        } else {
            debouncedDriveSync();
        }
    }
}

const debouncedDriveSync = createDebouncer(() => {
    if (state.drive?.connected && state.drive?.accessToken) {
        pushToGoogleDrive();
    }
}, 2500);

function updateStorageQuotaBadge() {
    const badge = document.getElementById('storage-quota-badge');
    if (!badge) return;
    try {
        const raw = localStorage.getItem(STORAGE_KEY) || '';
        const kb = (new Blob([raw]).size / 1024).toFixed(1);
        badge.textContent = `Vault: ${kb} KB`;
    } catch (_) {
        badge.textContent = 'Vault: -- KB';
    }
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3400);
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function generateId(prefix = 'id') {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
    }
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function sanitizeUrl(rawUrl) {
    return normalizeExternalUrl(rawUrl);
}
/* ==========================================================
   SINCRONIZACIÓN CON GOOGLE DRIVE Y ARCHIVO PROTEGIDO (.DWPK)
   ========================================================== */
function openDriveModal() {
    const cidInput = document.getElementById('gdrive-client-id');
    if (cidInput) {
        cidInput.value = state.drive?.clientId || window.DEVWORKSPACE_GOOGLE_CONFIG?.clientId || '';
    }
    document.getElementById('drive-modal').style.display = 'flex';
}

function closeDriveModal() {
    document.getElementById('drive-modal').style.display = 'none';
}

function getEffectiveGoogleClientId() {
    const fromInput = (document.getElementById('gdrive-client-id')?.value || '').trim();
    const fromState = (state.drive?.clientId || '').trim();
    const fromGlobal = (window.DEVWORKSPACE_GOOGLE_CONFIG?.clientId || '').trim();
    return fromInput || fromState || fromGlobal;
}

function connectGoogleDrive() {
    const clientId = getEffectiveGoogleClientId();
    if (!clientId) {
        showToast('Introduce tu Google OAuth Client ID (o configúralo en index.html)', 'error');
        return;
    }
    state.drive.clientId = clientId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (!window.google?.accounts?.oauth2) {
        showToast('Cargando Google Identity Services... inténtalo de nuevo en 2s', 'error');
        return;
    }

    googleTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: async (tokenResponse) => {
            if (!tokenResponse || tokenResponse.error || !tokenResponse.access_token) {
                showToast(`Error de autenticación Google: ${tokenResponse?.error || 'sin token'}`, 'error');
                return;
            }
            state.drive.accessToken = tokenResponse.access_token;
            state.drive.connected = true;
            await fetchGoogleDriveUserInfo();
            renderDriveProfileUi();
            closeDriveModal();

            if (typeof pendingDriveAction === 'function') {
                const action = pendingDriveAction;
                pendingDriveAction = null;
                action();
            } else {
                await pullFromGoogleDrive(false);
            }
        }
    });

    googleTokenClient.requestAccessToken({ prompt: state.drive.connected ? '' : 'consent' });
}

async function fetchGoogleDriveUserInfo() {
    if (!state.drive?.accessToken) return;
    try {
        const res = await fetch('https://www.googleapis.com/drive/v3/about?fields=user(displayName,emailAddress)', {
            headers: { Authorization: `Bearer ${state.drive.accessToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            state.drive.userName = data.user?.displayName || 'Cuenta Google';
            state.drive.userEmail = data.user?.emailAddress || '';
        }
    } catch (_) {}
}

function ensureDriveToken(onReady) {
    if (state.drive?.connected && state.drive?.accessToken) {
        onReady();
        return;
    }
    pendingDriveAction = onReady;
    openDriveModal();
    showToast('Conecta primero con Google Drive para continuar');
}

function logoutDriveUser() {
    if (state.drive?.accessToken && window.google?.accounts?.oauth2?.revoke) {
        try { window.google.accounts.oauth2.revoke(state.drive.accessToken); } catch (_) {}
    }
    state.drive = {
        connected: false,
        userName: '',
        userEmail: '',
        accessToken: '',
        clientId: state.drive?.clientId || '',
        fileId: state.drive?.fileId || '',
        lastSync: state.drive?.lastSync || null,
        dirty: false
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    renderDriveProfileUi();
    showToast('Sesión de Google Drive cerrada');
}

function renderDriveProfileUi() {
    const widget = document.getElementById('user-profile-widget');
    const loginBtn = document.getElementById('btn-cloud-login');
    const nameEl = document.getElementById('user-name');

    if (state.drive?.connected) {
        widget?.classList.remove('is-hidden');
        loginBtn?.classList.add('is-hidden');
        if (nameEl) nameEl.textContent = state.drive.userEmail || state.drive.userName || 'Drive Conectado';
        updateDriveSyncIndicator(state.drive.dirty ? 'pending' : 'ok');
    } else {
        widget?.classList.add('is-hidden');
        loginBtn?.classList.remove('is-hidden');
    }
}

function updateDriveSyncIndicator(mode) {
    const badge = document.getElementById('cloud-sync-indicator');
    const lastEl = document.getElementById('cloud-last-sync');
    if (badge) {
        badge.classList.remove('sync-saving', 'sync-error');
        if (mode === 'saving') {
            badge.textContent = 'Subiendo...';
            badge.classList.add('sync-saving');
        } else if (mode === 'error') {
            badge.textContent = 'Error Drive';
            badge.classList.add('sync-error');
        } else if (mode === 'pending') {
            badge.textContent = 'Pendiente';
            badge.classList.add('sync-saving');
        } else {
            badge.textContent = 'Drive OK';
        }
    }
    if (lastEl && state.drive?.lastSync) {
        lastEl.textContent = `Sync: ${new Date(state.drive.lastSync).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
    }
}

async function findDriveVaultFileId() {
    if (!state.drive?.accessToken) return '';
    if (state.drive.fileId) return state.drive.fileId;

    const q = encodeURIComponent(`name='${DRIVE_VAULT_FILENAME}' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&spaces=drive&fields=files(id,name)`, {
        headers: { Authorization: `Bearer ${state.drive.accessToken}` }
    });
    if (!res.ok) throw new Error('No se pudo consultar Google Drive');
    const data = await res.json();
    const id = data.files?.[0]?.id || '';
    if (id) state.drive.fileId = id;
    return id;
}

async function pushToGoogleDrive() {
    if (!state.drive?.connected || !state.drive?.accessToken) return;
    updateDriveSyncIndicator('saving');

    try {
        const snapshot = buildCompactVaultSnapshot();
        const packedBody = await packDrivePayload(snapshot, DEFAULT_DRIVE_SALT);
        const fileId = await findDriveVaultFileId();

        let res;
        if (fileId) {
            res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(fileId)}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${state.drive.accessToken}`,
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: packedBody
            });
        } else {
            const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${state.drive.accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: DRIVE_VAULT_FILENAME, mimeType: 'text/plain' })
            });
            if (!createRes.ok) throw new Error('Error creando archivo en Drive');
            const created = await createRes.json();
            state.drive.fileId = created.id;

            res = await fetch(`https://www.googleapis.com/upload/drive/v3/files/${encodeURIComponent(created.id)}?uploadType=media`, {
                method: 'PATCH',
                headers: {
                    Authorization: `Bearer ${state.drive.accessToken}`,
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: packedBody
            });
        }

        if (!res.ok) throw new Error('Error subiendo datos a Drive');
        state.drive.dirty = false;
        state.drive.lastSync = getEffectiveNowMs();
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateDriveSyncIndicator('ok');
    } catch (err) {
        updateDriveSyncIndicator('error');
        showToast(`Fallo al guardar en Drive: ${err.message}`, 'error');
    }
}

async function forceDriveSyncNow() {
    ensureDriveToken(async () => {
        await pushToGoogleDrive();
        if (!state.drive.dirty) {
            showToast('Guardado en Google Drive correctamente', 'success');
        }
    });
}

async function pullFromGoogleDrive(showFeedback = true) {
    ensureDriveToken(async () => {
        updateDriveSyncIndicator('saving');
        try {
            const fileId = await findDriveVaultFileId();
            if (!fileId) {
                updateDriveSyncIndicator('ok');
                if (showFeedback) showToast('Aún no existe ningún archivo guardado en tu Google Drive');
                return;
            }
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
                headers: { Authorization: `Bearer ${state.drive.accessToken}` }
            });
            if (!res.ok) throw new Error('No se pudo descargar el archivo de Drive');
            const packedText = await res.text();
            const unpacked = await unpackDrivePayload(packedText, DEFAULT_DRIVE_SALT);

            const preservedDrive = {
                ...state.drive,
                dirty: false,
                lastSync: getEffectiveNowMs()
            };
            state = normalizeStateShape(unpacked);
            state.drive = preservedDrive;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
            applyAllVisualSettings();
            renderAll();
            updateDriveSyncIndicator('ok');
            if (showFeedback) showToast('Datos importados desde Google Drive', 'success');
        } catch (err) {
            updateDriveSyncIndicator('error');
            showToast(`Error al importar de Drive: ${err.message}`, 'error');
        }
    });
}

async function exportProtectedVaultFile() {
    try {
        const packed = await packDrivePayload(buildCompactVaultSnapshot(), DEFAULT_DRIVE_SALT);
        const blob = new Blob([packed], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = DRIVE_VAULT_FILENAME;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Respaldo protegido (.dwpk) descargado', 'success');
    } catch (err) {
        showToast(`Error exportando .dwpk: ${err.message}`, 'error');
    }
}

async function importProtectedVaultFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const text = await file.text();
        const unpacked = await unpackDrivePayload(text, DEFAULT_DRIVE_SALT);
        const preservedDrive = { ...state.drive, dirty: true };
        state = normalizeStateShape(unpacked);
        state.drive = preservedDrive;
        saveState(false);
        applyAllVisualSettings();
        renderAll();
        closeDriveModal();
        showToast('Respaldo .dwpk importado y verificado', 'success');
    } catch (err) {
        showToast(`Archivo .dwpk inválido o alterado: ${err.message}`, 'error');
    } finally {
        event.target.value = '';
    }
}
/* ==========================================================
   RELOJ SINCRONIZADO + AJUSTE MANUAL DE HORA
   ========================================================== */
function getEffectiveNowMs() {
    if (typeof manualClockOffsetMs === 'number' && Number.isFinite(manualClockOffsetMs)) {
        return Date.now() + manualClockOffsetMs;
    }
    return Date.now() + (hasRealNetworkTime ? realNetworkTimeOffset : 0);
}

function getEffectiveNow() {
    return new Date(getEffectiveNowMs());
}

function formatDateInputValue(d) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatTimeInputValue(d) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
}

function openClockModal() {
    const now = getEffectiveNow();
    const dInp = document.getElementById('manual-clock-date');
    const tInp = document.getElementById('manual-clock-time');
    if (dInp) dInp.value = formatDateInputValue(now);
    if (tInp) tInp.value = formatTimeInputValue(now);
    document.getElementById('clock-modal').style.display = 'flex';
}

function closeClockModal() {
    document.getElementById('clock-modal').style.display = 'none';
}

function applyManualClock() {
    const dVal = document.getElementById('manual-clock-date')?.value || '';
    const tVal = document.getElementById('manual-clock-time')?.value || '';
    if (!dVal || !tVal) {
        showToast('Indica fecha y hora válidas', 'error');
        return;
    }
    const normalizedTime = /^\d{2}:\d{2}$/.test(tVal) ? `${tVal}:00` : tVal;
    const targetDate = new Date(`${dVal}T${normalizedTime}`);
    if (!Number.isFinite(targetDate.getTime())) {
        showToast('Fecha u hora inválida', 'error');
        return;
    }
    manualClockOffsetMs = targetDate.getTime() - Date.now();
    updateClockDisplay();
    renderSchedule();
    renderDeliveries();
    closeClockModal();
    showToast('Hora manual aplicada', 'success');
}

function resetManualClockToAuto() {
    manualClockOffsetMs = null;
    syncRealTimeNetwork();
    updateClockDisplay();
    renderSchedule();
    renderDeliveries();
}

function updateClockDisplay() {
    const now = getEffectiveNow();
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    const netEl = document.getElementById('net-status');

    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('es-ES', { hour12: false });
    }
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
    if (netEl) {
        if (typeof manualClockOffsetMs === 'number' && Number.isFinite(manualClockOffsetMs)) {
            netEl.textContent = '✋ Hora manual';
        } else if (hasRealNetworkTime) {
            netEl.textContent = '🌐 Hora sincronizada';
        } else {
            netEl.textContent = '🕒 Hora local';
        }
    }

    checkDeliveryNotifications();
}

async function syncRealTimeNetwork() {
    const netEl = document.getElementById('net-status');
    if (netEl && !(typeof manualClockOffsetMs === 'number' && Number.isFinite(manualClockOffsetMs))) {
        netEl.textContent = '🔄 Sincronizando...';
    }
    try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid', { signal: controller.signal });
        clearTimeout(timer);
        if (res.ok) {
            const data = await res.json();
            if (data && typeof data.unixtime === 'number') {
                realNetworkTimeOffset = data.unixtime * 1000 - Date.now();
                hasRealNetworkTime = true;
            }
        }
    } catch (_) {
        hasRealNetworkTime = false;
    }
    updateClockDisplay();
}
/* ==========================================================
   WORKSPACES, PERFILES, DENSIDAD, ZEN, CLASE Y TEMAS/FUENTES
   ========================================================== */
function switchWorkspace(ws) {
    if (!ALLOWED_WORKSPACES.includes(ws)) return;
    state.ui.workspace = ws;

    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ws === ws);
    });
    document.querySelectorAll('.workspace-view').forEach(view => {
        view.classList.toggle('active', view.id === `ws-${ws}`);
    });

    if (ws === 'studio') {
        updateStudioEditorMetrics();
        updateStudioOutputModeLabel();
        if (state.ui.studioActiveTab !== 'saved') renderStudioPreview();
    } else if (ws === 'database') {
        renderDbWorkspace();
    } else if (ws === 'academy') {
        populateSubjectSelects();
        renderCatalogSubjects();
        renderKanban();
        renderGrades();
        renderFlashcards();
        renderBugLogs();
        renderClassDoubts();
        renderProjects();
    } else if (ws === 'fonts') {
        renderGoogleFontFavorites();
        renderCustomThemesList();
    }

    saveState(false);
}

function applyWorkspacePreset(presetName) {
    const chosen = ALLOWED_PRESETS.includes(presetName) ? presetName : 'default';
    state.ui.preset = chosen;
    const sel = document.getElementById('workspace-preset-select');
    if (sel) sel.value = chosen;

    const allowedIds = PRESET_CARDS[chosen];
    document.querySelectorAll('.card').forEach(card => {
        if (!card.id) return;
        if (!allowedIds) {
            card.classList.remove('hidden-card');
        } else {
            card.classList.toggle('hidden-card', !allowedIds.includes(card.id));
        }
    });

    saveState(false);
}

function toggleDensityMode() {
    state.ui.density = state.ui.density === 'compact' ? 'airy' : 'compact';
    applyDensityMode();
    saveState(false);
}

function applyDensityMode() {
    const isCompact = state.ui.density === 'compact';
    document.body.classList.toggle('density-compact', isCompact);
    const btn = document.getElementById('btn-density-mode');
    if (btn) btn.textContent = isCompact ? '📐 Compacto' : '📐 Aireado';
}

function toggleZenMode() {
    state.ui.zenMode = !state.ui.zenMode;
    document.body.classList.toggle('zen-mode-active', state.ui.zenMode);
    document.getElementById('btn-zen-mode')?.classList.toggle('active', state.ui.zenMode);
    saveState(false);
}

function togglePresentationMode() {
    state.ui.presentationMode = !state.ui.presentationMode;
    document.body.classList.toggle('presentation-mode-active', state.ui.presentationMode);
    document.getElementById('btn-present-mode')?.classList.toggle('active', state.ui.presentationMode);
    saveState(false);
}

function ensureGoogleFontLoaded(fontName) {
    const clean = String(fontName || '').trim();
    if (!clean) return;
    const linkEl = document.getElementById('dynamic-google-fonts');
    if (!linkEl) return;

    const currentHref = linkEl.getAttribute('href') || '';
    const encoded = encodeURIComponent(clean).replace(/%20/g, '+');
    const familySpec = `family=${encoded}:wght@400;500;600;700`;

    if (currentHref.includes(familySpec)) return;
    if (!currentHref || !currentHref.includes('fonts.googleapis.com/css2')) {
        linkEl.setAttribute('href', `https://fonts.googleapis.com/css2?${familySpec}&display=swap`);
    } else {
        linkEl.setAttribute('href', `${currentHref}&${familySpec}`);
    }
}

function applyFontVariables() {
    const sans = state.ui.fontSans || 'Inter';
    const mono = state.ui.fontMono || 'JetBrains Mono';
    ensureGoogleFontLoaded(sans);
    ensureGoogleFontLoaded(mono);
    document.documentElement.style.setProperty('--font-sans', `'${sans}', system-ui, sans-serif`);
    document.documentElement.style.setProperty('--font-mono', `'${mono}', monospace`);
}

function applyTheme(themeKey) {
    const valid = ALLOWED_THEMES.includes(themeKey) ? themeKey : 'cyberpunk';
    state.ui.theme = valid;

    const sel = document.getElementById('theme-select');
    if (sel) sel.value = valid;

    if (valid === 'custom') {
        document.documentElement.removeAttribute('data-theme');
        applyCustomThemeObject(state.ui.customTheme);
    } else {
        document.documentElement.setAttribute('data-theme', valid);
        clearInlineCustomThemeVars();
        applyFontVariables();
    }

    saveState(false);
}

function clearInlineCustomThemeVars() {
    ['--bg-color', '--card-bg', '--card-border', '--text-main', '--accent-cyan', '--accent-violet'].forEach(v => {
        document.documentElement.style.removeProperty(v);
    });
}

function applyCustomThemeObject(ct) {
    if (!ct || typeof ct !== 'object') return;
    if (ct.bg) document.documentElement.style.setProperty('--bg-color', ct.bg);
    if (ct.card) document.documentElement.style.setProperty('--card-bg', ct.card);
    if (ct.border) document.documentElement.style.setProperty('--card-border', ct.border);
    if (ct.text) document.documentElement.style.setProperty('--text-main', ct.text);
    if (ct.cyan) document.documentElement.style.setProperty('--accent-cyan', ct.cyan);
    if (ct.violet) document.documentElement.style.setProperty('--accent-violet', ct.violet);

    if (ct.fontUi) state.ui.fontSans = ct.fontUi;
    if (ct.fontMono) state.ui.fontMono = ct.fontMono;
    applyFontVariables();
}

function previewCustomThemeColors() {
    const ct = {
        name: (document.getElementById('custom-theme-name')?.value || '').trim() || 'Mi Tema',
        fontUi: (document.getElementById('custom-theme-font-ui')?.value || '').trim(),
        fontMono: (document.getElementById('custom-theme-font-mono')?.value || '').trim(),
        bg: document.getElementById('cp-bg')?.value || '#050711',
        card: document.getElementById('cp-card')?.value || '#0b111e',
        border: document.getElementById('cp-border')?.value || '#1e293b',
        text: document.getElementById('cp-text')?.value || '#f1f5f9',
        cyan: document.getElementById('cp-cyan')?.value || '#00f0ff',
        violet: document.getElementById('cp-violet')?.value || '#b84dff'
    };
    state.ui.customTheme = ct;
    state.ui.theme = 'custom';
    document.documentElement.removeAttribute('data-theme');
    if (document.getElementById('theme-select')) document.getElementById('theme-select').value = 'custom';
    applyCustomThemeObject(ct);
}

function activateCustomTheme() {
    previewCustomThemeColors();
    saveState(false);
    showToast('Tema personalizado aplicado');
}

function saveNewCustomThemePreset() {
    const name = (document.getElementById('custom-theme-name')?.value || '').trim();
    if (!name) {
        showToast('Escribe un nombre para el tema', 'error');
        return;
    }
    const preset = {
        id: generateId('thm'),
        name,
        fontUi: (document.getElementById('custom-theme-font-ui')?.value || '').trim(),
        fontMono: (document.getElementById('custom-theme-font-mono')?.value || '').trim(),
        bg: document.getElementById('cp-bg')?.value || '#050711',
        card: document.getElementById('cp-card')?.value || '#0b111e',
        border: document.getElementById('cp-border')?.value || '#1e293b',
        text: document.getElementById('cp-text')?.value || '#f1f5f9',
        cyan: document.getElementById('cp-cyan')?.value || '#00f0ff',
        violet: document.getElementById('cp-violet')?.value || '#b84dff'
    };

    const existingIdx = state.customThemePresets.findIndex(p => p.name.toLowerCase() === name.toLowerCase());
    if (existingIdx >= 0) state.customThemePresets[existingIdx] = preset;
    else state.customThemePresets.push(preset);

    state.ui.customTheme = { ...preset };
    state.ui.theme = 'custom';
    saveState(false);
    renderCustomThemesList();
    applyTheme('custom');
    showToast(`Tema "${name}" guardado con su fuente vinculada`, 'success');
}

function applySavedThemePreset(presetId) {
    const preset = (state.customThemePresets || []).find(p => p.id === presetId);
    if (!preset) return;
    state.ui.customTheme = { ...preset };
    state.ui.theme = 'custom';
    syncCustomThemeInputsFromState();
    saveState(false);
    applyTheme('custom');
    showToast(`Tema "${preset.name}" activado`, 'success');
}

function deleteSavedThemePreset(presetId) {
    state.customThemePresets = (state.customThemePresets || []).filter(p => p.id !== presetId);
    saveState(false);
    renderCustomThemesList();
}

function renderCustomThemesList() {
    const sel = document.getElementById('theme-select');
    const listBox = document.getElementById('saved-custom-themes-list');

    if (sel) {
        [...sel.querySelectorAll('option[data-custom-preset="1"]')].forEach(o => o.remove());
        (state.customThemePresets || []).forEach(p => {
            const opt = document.createElement('option');
            opt.value = `preset:${p.id}`;
            opt.dataset.customPreset = '1';
            opt.textContent = `🎨 ${p.name}`;
            sel.appendChild(opt);
        });
    }

    if (!listBox) return;
    listBox.innerHTML = '';
    const presets = state.customThemePresets || [];
    if (!presets.length) {
        listBox.innerHTML = '<div class="mono-muted">Aún no has guardado temas propios.</div>';
        return;
    }

    presets.forEach(p => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `${p.name} · UI: ${p.fontUi || state.ui.fontSans} · Code: ${p.fontMono || state.ui.fontMono}`;

        const acts = document.createElement('div');
        acts.className = 'filter-pills-row';
        const useBtn = document.createElement('button');
        useBtn.type = 'button';
        useBtn.className = 'btn-cyan btn-sm';
        useBtn.textContent = 'Usar';
        useBtn.addEventListener('click', () => applySavedThemePreset(p.id));

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-icon';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => deleteSavedThemePreset(p.id));

        acts.append(useBtn, delBtn);
        row.append(info, acts);
        listBox.appendChild(row);
    });
}

function syncCustomThemeInputsFromState() {
    const ct = state.ui.customTheme || {};
    if (document.getElementById('custom-theme-name')) document.getElementById('custom-theme-name').value = ct.name || 'Mi Tema';
    if (document.getElementById('custom-theme-font-ui')) document.getElementById('custom-theme-font-ui').value = ct.fontUi || '';
    if (document.getElementById('custom-theme-font-mono')) document.getElementById('custom-theme-font-mono').value = ct.fontMono || '';
    if (document.getElementById('cp-bg')) document.getElementById('cp-bg').value = ct.bg || '#050711';
    if (document.getElementById('cp-card')) document.getElementById('cp-card').value = ct.card || '#0b111e';
    if (document.getElementById('cp-border')) document.getElementById('cp-border').value = ct.border || '#1e293b';
    if (document.getElementById('cp-text')) document.getElementById('cp-text').value = ct.text || '#f1f5f9';
    if (document.getElementById('cp-cyan')) document.getElementById('cp-cyan').value = ct.cyan || '#00f0ff';
    if (document.getElementById('cp-violet')) document.getElementById('cp-violet').value = ct.violet || '#b84dff';
}

function updateAppearanceSettings() {
    const scale = Number(document.getElementById('ui-scale-select')?.value) || 1;
    state.ui.uiScale = scale;
    document.documentElement.style.setProperty('--ui-scale', String(scale));
    saveState(false);
}

function exportCustomThemeJson() {
    const blob = new Blob([JSON.stringify(state.ui.customTheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'tema-devworkspace.json';
    a.click();
    URL.revokeObjectURL(url);
}

async function importCustomThemeJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
        const parsed = JSON.parse(await file.text());
        state.ui.customTheme = { ...state.ui.customTheme, ...parsed };
        syncCustomThemeInputsFromState();
        applyTheme('custom');
        saveState(false);
        showToast('Tema importado', 'success');
    } catch (_) {
        showToast('JSON de tema inválido', 'error');
    } finally {
        event.target.value = '';
    }
}

function resetAppearanceDefaults() {
    const def = createDefaultState();
    state.ui.theme = 'cyberpunk';
    state.ui.uiScale = 1;
    state.ui.fontSans = def.ui.fontSans;
    state.ui.fontMono = def.ui.fontMono;
    state.ui.studioFont = '';
    state.ui.customTheme = { ...def.ui.customTheme };
    saveState(false);
    applyAllVisualSettings();
    showToast('Apariencia restaurada a valores base');
}

function loadGoogleFontByName() {
    const name = (document.getElementById('gf-input-name')?.value || '').trim();
    if (!name) return;
    quickLoadGoogleFont(name);
}

function quickLoadGoogleFont(fontName) {
    const clean = String(fontName || '').trim();
    if (!clean) return;
    ensureGoogleFontLoaded(clean);
    if (document.getElementById('gf-input-name')) document.getElementById('gf-input-name').value = clean;
    if (document.getElementById('gf-active-preview-label')) document.getElementById('gf-active-preview-label').textContent = `Vista previa: ${clean}`;
    const sample = document.getElementById('gf-preview-sample');
    if (sample) sample.style.fontFamily = `'${clean}', sans-serif`;
    updateFontPlaygroundStyle();
    showToast(`Fuente "${clean}" cargada`, 'success');
}

function updateFontPlaygroundStyle() {
    const size = Number(document.getElementById('gf-preview-size')?.value) || state.ui.previewFontSize || 18;
    state.ui.previewFontSize = size;
    const sample = document.getElementById('gf-preview-sample');
    if (sample) sample.style.fontSize = `${size}px`;
}

function saveGoogleFontFavorite() {
    const name = (document.getElementById('gf-input-name')?.value || '').trim();
    if (!name) return;
    if (!state.customFonts.includes(name)) {
        state.customFonts.push(name);
        saveState(false);
        renderGoogleFontFavorites();
        showToast(`Fuente "${name}" guardada en favoritos`, 'success');
    }
}

function renderGoogleFontFavorites() {
    const box = document.getElementById('gf-favorites-list');
    const studioSel = document.getElementById('studio-font-select');
    const fonts = state.customFonts || [];

    if (studioSel) {
        const currentVal = state.ui.studioFont || '';
        studioSel.innerHTML = '<option value="">🔤 Fuente Preview (Por defecto)</option>';
        fonts.forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            studioSel.appendChild(opt);
        });
        studioSel.value = currentVal;
    }

    if (!box) return;
    box.innerHTML = '';
    fonts.forEach(f => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'pill-btn';
        btn.textContent = f;
        btn.addEventListener('click', () => quickLoadGoogleFont(f));
        box.appendChild(btn);
    });
}

function applyLoadedFontToUi(target) {
    const name = (document.getElementById('gf-input-name')?.value || '').trim();
    if (!name) return;
    ensureGoogleFontLoaded(name);
    if (target === 'mono') state.ui.fontMono = name;
    else state.ui.fontSans = name;
    applyFontVariables();
    saveState(false);
    showToast(`Fuente "${name}" aplicada a ${target === 'mono' ? 'Código' : 'Interfaz'}`, 'success');
}

function applyLoadedFontToStudio() {
    const name = (document.getElementById('gf-input-name')?.value || '').trim();
    if (!name) return;
    ensureGoogleFontLoaded(name);
    state.ui.studioFont = name;
    renderGoogleFontFavorites();
    renderStudioPreview();
    saveState(false);
    showToast(`Fuente "${name}" aplicada en Code Studio`, 'success');
}

function applyFontToStudioPreview(fontName) {
    state.ui.studioFont = fontName || '';
    if (fontName) ensureGoogleFontLoaded(fontName);
    renderStudioPreview();
    saveState(false);
}

function applyAllVisualSettings() {
    switchWorkspace(state.ui.workspace || 'cockpit');
    applyWorkspacePreset(state.ui.preset || 'default');
    applyDensityMode();
    document.body.classList.toggle('zen-mode-active', Boolean(state.ui.zenMode));
    document.getElementById('btn-zen-mode')?.classList.toggle('active', Boolean(state.ui.zenMode));
    document.body.classList.toggle('presentation-mode-active', Boolean(state.ui.presentationMode));
    document.getElementById('btn-present-mode')?.classList.toggle('active', Boolean(state.ui.presentationMode));
    document.documentElement.style.setProperty('--ui-scale', String(state.ui.uiScale || 1));
    if (document.getElementById('ui-scale-select')) document.getElementById('ui-scale-select').value = String(state.ui.uiScale || 1);
    if (document.getElementById('gf-preview-size')) document.getElementById('gf-preview-size').value = String(state.ui.previewFontSize || 18);
    if (document.getElementById('weather-text')) document.getElementById('weather-text').textContent = state.ui.weatherEnabled ? 'Clima: Activo' : 'Clima: OFF';

    syncCustomThemeInputsFromState();
    renderCustomThemesList();
    applyTheme(state.ui.theme || 'cyberpunk');
    renderDriveProfileUi();
}
/* ==========================================================
   CATÁLOGO GLOBAL DE ASIGNATURAS Y HORARIO
   ========================================================== */
function populateSubjectSelects() {
    const subjects = state.catalogSubjects || [];
    const targets = document.querySelectorAll('.subject-select-target');

    targets.forEach(sel => {
        const prevVal = sel.value;
        sel.innerHTML = '';
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            sel.appendChild(opt);
        });
        if (prevVal && [...sel.options].some(o => o.value === prevVal)) {
            sel.value = prevVal;
        }
    });

    const fcFilter = document.getElementById('fc-filter-subject');
    if (fcFilter) {
        const prevFilter = fcFilter.value || 'all';
        fcFilter.innerHTML = '<option value="all">Todas las asignaturas</option>';
        subjects.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.name;
            opt.textContent = s.name;
            fcFilter.appendChild(opt);
        });
        fcFilter.value = [...fcFilter.options].some(o => o.value === prevFilter) ? prevFilter : 'all';
    }
}

function addCatalogSubject() {
    const name = (document.getElementById('subj-cat-name')?.value || '').trim();
    const teacher = (document.getElementById('subj-cat-teacher')?.value || '').trim();
    const room = (document.getElementById('subj-cat-room')?.value || '').trim();
    if (!name) {
        showToast('Escribe el nombre de la asignatura', 'error');
        return;
    }

    const exists = (state.catalogSubjects || []).some(s => s.name.toLowerCase() === name.toLowerCase());
    if (exists) {
        showToast('Esa asignatura ya está en el catálogo', 'error');
        return;
    }

    state.catalogSubjects.push({
        id: generateId('subj'),
        name,
        teacher,
        room
    });

    document.getElementById('subj-cat-name').value = '';
    document.getElementById('subj-cat-teacher').value = '';
    document.getElementById('subj-cat-room').value = '';
    toggleForm('form-add-subject-catalog');
    saveState(false);
    populateSubjectSelects();
    renderCatalogSubjects();
    showToast(`Asignatura "${name}" añadida`, 'success');
}

function deleteCatalogSubject(id) {
    state.catalogSubjects = (state.catalogSubjects || []).filter(s => s.id !== id);
    saveState(false);
    populateSubjectSelects();
    renderCatalogSubjects();
}

function renderCatalogSubjects() {
    const list = document.getElementById('subjects-catalog-list');
    if (!list) return;
    list.innerHTML = '';

    const items = state.catalogSubjects || [];
    if (!items.length) {
        list.innerHTML = '<div class="mono-muted">No hay asignaturas registradas.</div>';
        return;
    }

    items.forEach(s => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        const meta = [s.teacher, s.room].filter(Boolean).join(' · ');
        info.textContent = meta ? `${s.name} (${meta})` : s.name;

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => deleteCatalogSubject(s.id));

        row.append(info, del);
        list.appendChild(row);
    });
}

function autofillScheduleFromCatalog(subjectName) {
    const found = (state.catalogSubjects || []).find(s => s.name === subjectName);
    if (!found) return;
    const tInp = document.getElementById('sch-add-teacher');
    const rInp = document.getElementById('sch-add-room');
    if (tInp && found.teacher && !tInp.value) tInp.value = found.teacher;
    if (rInp && found.room && !rInp.value) rInp.value = found.room;
}

function toggleScheduleViewMode() {
    state.ui.scheduleViewMode = state.ui.scheduleViewMode === 'table' ? 'current' : 'table';
    saveState(false);
    renderSchedule();
}

function parseMinutes(hhmm) {
    const [h, m] = String(hhmm || '0:0').split(':').map(Number);
    if (!Number.isFinite(h) || !Number.isFinite(m)) return -1;
    return h * 60 + m;
}

function renderSchedule() {
    const box = document.getElementById('schedule-widget');
    if (!box) return;

    const schedule = state.schedule || [];
    if (!schedule.length) {
        box.innerHTML = '<div class="mono-muted">Sin clases configuradas. Usa <strong>⚙️ Configurar</strong> o <strong>☁️ Subir de Drive</strong>.</div>';
        return;
    }

    if (state.ui.scheduleViewMode === 'table') {
        const dayNames = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie' };
        const rowsHtml = [...schedule]
            .sort((a, b) => (a.day - b.day) || a.start.localeCompare(b.start))
            .map(c => `<tr>
                <td>${escapeHtml(dayNames[c.day] || String(c.day))}</td>
                <td>${escapeHtml(c.start)} - ${escapeHtml(c.end)}</td>
                <td><strong>${escapeHtml(c.subject)}</strong></td>
                <td>${escapeHtml(c.teacher || '-')}</td>
                <td>${escapeHtml(c.room || '-')}</td>
            </tr>`).join('');

        box.innerHTML = `<table class="sch-table"><thead><tr><th>Día</th><th>Hora</th><th>Asignatura</th><th>Profesor/a</th><th>Aula</th></tr></thead><tbody>${rowsHtml}</tbody></table>`;
        return;
    }

    const { day, minutes: nowMins } = getMadridClock(getEffectiveNow());
    const todayClasses = schedule
        .filter(c => Number(c.day) === Number(day))
        .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));

    const activeClass = todayClasses.find(c => {
        const s = parseMinutes(c.start);
        const e = parseMinutes(c.end);
        return nowMins >= s && nowMins < e;
    });

    if (activeClass) {
        const s = parseMinutes(activeClass.start);
        const e = parseMinutes(activeClass.end);
        const pct = Math.min(100, Math.max(0, Math.round(((nowMins - s) / Math.max(1, e - s)) * 100)));
        const remMins = Math.max(0, e - nowMins);
        const extraInfo = [activeClass.teacher ? `Prof. ${activeClass.teacher}` : '', activeClass.room ? `Aula ${activeClass.room}` : ''].filter(Boolean).join(' · ');

        box.innerHTML = `
            <div class="sch-status">🟢 <strong>En curso:</strong> ${escapeHtml(activeClass.subject)} (${escapeHtml(activeClass.start)} - ${escapeHtml(activeClass.end)})</div>
            <div class="sch-detail">${escapeHtml(extraInfo || 'Clase activa')} · Quedan ${remMins} min (${pct}%)</div>
            <div class="sch-progress-track"><div class="sch-progress-fill" style="width:${pct}%"></div></div>
        `;
        return;
    }

    const nextClass = todayClasses.find(c => parseMinutes(c.start) > nowMins);
    if (nextClass) {
        const waitMins = Math.max(0, parseMinutes(nextClass.start) - nowMins);
        const extraInfo = [nextClass.teacher ? `Prof. ${nextClass.teacher}` : '', nextClass.room ? `Aula ${nextClass.room}` : ''].filter(Boolean).join(' · ');
        box.innerHTML = `
            <div class="sch-status">⏳ <strong>Siguiente clase:</strong> ${escapeHtml(nextClass.subject)} a las ${escapeHtml(nextClass.start)}</div>
            <div class="sch-detail">${escapeHtml(extraInfo || 'En espera')} · Empieza en ${waitMins} min</div>
        `;
        return;
    }

    box.innerHTML = `
        <div class="sch-status">🌙 Sin más clases hoy en el horario</div>
        <div class="sch-detail">Total de bloques registrados para hoy: ${todayClasses.length}</div>
    `;
}

function openScheduleModal() {
    populateSubjectSelects();
    const subjSel = document.getElementById('sch-add-subject');
    if (subjSel && subjSel.value) autofillScheduleFromCatalog(subjSel.value);
    renderScheduleEditorList();
    document.getElementById('schedule-modal').style.display = 'flex';
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').style.display = 'none';
}

function addScheduleClass() {
    const day = Number(document.getElementById('sch-add-day')?.value) || 1;
    const start = (document.getElementById('sch-add-start')?.value || '').trim();
    const end = (document.getElementById('sch-add-end')?.value || '').trim();
    const subject = (document.getElementById('sch-add-subject')?.value || '').trim();
    const teacher = (document.getElementById('sch-add-teacher')?.value || '').trim();
    const room = (document.getElementById('sch-add-room')?.value || '').trim();

    if (!start || !end || !subject) {
        showToast('Completa hora de inicio, fin y asignatura', 'error');
        return;
    }

    state.schedule.push({
        id: generateId('sch'),
        day,
        start,
        end,
        subject,
        teacher,
        room
    });

    document.getElementById('sch-add-teacher').value = '';
    document.getElementById('sch-add-room').value = '';
    saveState(false);
    renderSchedule();
    renderScheduleEditorList();
    showToast('Clase añadida al horario', 'success');
}

function deleteScheduleClass(id) {
    state.schedule = (state.schedule || []).filter(c => c.id !== id);
    saveState(false);
    renderSchedule();
    renderScheduleEditorList();
}

function clearSchedule() {
    state.schedule = [];
    saveState(false);
    renderSchedule();
    renderScheduleEditorList();
    showToast('Horario vaciado');
}
function renderScheduleEditorList() {
    const list = document.getElementById('schedule-editor-list');
    if (!list) return;
    list.innerHTML = '';
    const dayNames = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie' };

    const sorted = [...(state.schedule || [])].sort((a, b) => (a.day - b.day) || a.start.localeCompare(b.start));
    if (!sorted.length) {
        list.innerHTML = '<div class="mono-muted">No hay clases en el horario.</div>';
        return;
    }

    sorted.forEach(c => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        const extra = [c.teacher, c.room].filter(Boolean).join(' · ');
        info.textContent = `${dayNames[c.day] || c.day} ${c.start}-${c.end} · ${c.subject}${extra ? ` (${extra})` : ''}`;

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => deleteScheduleClass(c.id));

        row.append(info, del);
        list.appendChild(row);
    });
}

function importScheduleFromText() {
    const raw = (document.getElementById('sch-import-text')?.value || '').trim();
    if (!raw) {
        showToast('Pega primero el texto del horario', 'error');
        return;
    }
    const parsed = parseScheduleImportText(raw);
    if (!parsed.length) {
        showToast('No se detectaron líneas válidas (formato: Lun 08:15-09:15 Programación)', 'error');
        return;
    }

    parsed.forEach(item => {
        state.schedule.push({
            id: generateId('sch'),
            day: item.day,
            start: item.start,
            end: item.end,
            subject: item.subject,
            teacher: item.teacher || '',
            room: item.room || ''
        });
    });

    document.getElementById('sch-import-text').value = '';
    saveState(false);
    renderSchedule();
    renderScheduleEditorList();
    showToast(`Importadas ${parsed.length} clases al horario`, 'success');
}

/* ==========================================================
   ENTREGAS, EXÁMENES Y PRÁCTICAS
   ========================================================== */
function setDeliveryFilter(filterKey) {
    currentDeliveryFilter = ALLOWED_DELIVERY_FILTERS.includes(filterKey) ? filterKey : 'all';
    state.ui.deliveryFilter = currentDeliveryFilter;
    document.querySelectorAll('.delivery-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dfilter === currentDeliveryFilter);
    });
    saveState(false);
    renderDeliveries();
}

function toggleExamCramMode() {
    state.ui.examCramMode = !state.ui.examCramMode;
    document.getElementById('btn-exam-cram')?.classList.toggle('active', state.ui.examCramMode);
    saveState(false);
    renderDeliveries();
}

function addDelivery() {
    const subject = (document.getElementById('del-subject')?.value || '').trim();
    const title = (document.getElementById('del-title')?.value || '').trim();
    const date = (document.getElementById('del-date')?.value || '').trim();
    const type = document.getElementById('del-type')?.value || 'entrega';
    const notes = (document.getElementById('del-notes')?.value || '').trim();

    if (!subject || !title || !date) {
        showToast('Completa asignatura, título y fecha límite', 'error');
        return;
    }

    state.deliveries.push({
        id: generateId('del'),
        subject,
        title,
        date,
        type,
        notes,
        done: false
    });

    document.getElementById('del-title').value = '';
    document.getElementById('del-date').value = '';
    document.getElementById('del-notes').value = '';
    toggleForm('form-add-delivery');
    saveState(false);
    renderDeliveries();
    showToast('Entrega añadida', 'success');
}

function toggleDeliveryDone(id) {
    const item = (state.deliveries || []).find(d => d.id === id);
    if (!item) return;
    item.done = !item.done;
    saveState(false);
    renderDeliveries();
}

function deleteDelivery(id) {
    state.deliveries = (state.deliveries || []).filter(d => d.id !== id);
    saveState(false);
    renderDeliveries();
}

function getDaysUntil(dateStr) {
    if (!dateStr) return 9999;
    const todayKey = getMadridDateKey(getEffectiveNow());
    const [ty, tm, td] = todayKey.split('-').map(Number);
    const [dy, dm, dd] = String(dateStr).split('-').map(Number);
    if (!dy || !dm || !dd) return 9999;
    const utcToday = Date.UTC(ty, tm - 1, td);
    const utcDue = Date.UTC(dy, dm - 1, dd);
    return Math.round((utcDue - utcToday) / 86400000);
}

function renderDeliveries() {
    const list = document.getElementById('deliveries-list');
    if (!list) return;
    list.innerHTML = '';

    const activeFilter = ALLOWED_DELIVERY_FILTERS.includes(currentDeliveryFilter) ? currentDeliveryFilter : 'all';
    const items = (state.deliveries || [])
        .map(d => ({ ...d, daysLeft: getDaysUntil(d.date) }))
        .filter(d => {
            if (state.ui.examCramMode && (d.done || d.daysLeft > 7)) return false;
            if (activeFilter === 'pending') return !d.done;
            if (activeFilter === 'soon') return !d.done && d.daysLeft >= 0 && d.daysLeft <= 3;
            if (activeFilter === 'exam') return d.type === 'examen';
            if (activeFilter === 'practice') return d.type === 'practica';
            return true;
        })
        .sort((a, b) => Number(a.done) - Number(b.done) || a.daysLeft - b.daysLeft);

    if (!items.length) {
        list.innerHTML = '<div class="mono-muted">No hay entregas o exámenes para este filtro.</div>';
        return;
    }

    items.forEach(item => {
        const row = document.createElement('div');
        row.className = `delivery-item ${item.done ? 'is-done' : ''}`;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = Boolean(item.done);
        chk.addEventListener('change', () => toggleDeliveryDone(item.id));

        const body = document.createElement('div');
        body.className = 'delivery-body';
        const badgeText = item.type === 'examen' ? '📝 Examen' : item.type === 'practica' ? '🧪 Práctica' : '📦 Entrega';
        const dueLabel = item.done
            ? 'Completado'
            : item.daysLeft < 0
                ? `Vencido (${Math.abs(item.daysLeft)}d)`
                : item.daysLeft === 0
                    ? 'Hoy'
                    : `En ${item.daysLeft}d`;

        body.innerHTML = `
            <div class="delivery-title">${escapeHtml(item.title)} <span class="delivery-badge">${badgeText}</span></div>
            <div class="delivery-meta">${escapeHtml(item.subject)} · ${escapeHtml(item.date)} · <strong>${dueLabel}</strong>${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</div>
        `;

        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => deleteDelivery(item.id));

        row.append(chk, body, del);
        list.appendChild(row);
    });
}

function checkDeliveryNotifications() {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const todayKey = getMadridDateKey(getEffectiveNow());
    (state.deliveries || []).forEach(d => {
        if (d.done) return;
        const days = getDaysUntil(d.date);
        if (days === 0 || days === 1) {
            const alertKey = `${todayKey}:${d.id}:${days}`;
            if (!notifiedDeliveryAlerts.has(alertKey)) {
                notifiedDeliveryAlerts.add(alertKey);
                try {
                    new Notification('DevWorkspace · Recordatorio académico', {
                        body: `${d.subject}: ${d.title} (${days === 0 ? 'vence hoy' : 'vence mañana'})`
                    });
                } catch (_) {}
            }
        }
    });
}
/* ==========================================================
   TAREAS, SUBTAREAS, POMODORO, NOTAS, STUDIO, BD, DEVLAB Y ARRANQUE
   ========================================================== */
function addTask() {
    const text = (document.getElementById('task-input')?.value || '').trim();
    if (!text) return;

    state.tasks.unshift({
        id: generateId('tsk'),
        text,
        done: false,
        priority: document.getElementById('task-priority')?.value || 'medium',
        block: document.getElementById('task-block')?.value || 'afternoon',
        date: document.getElementById('task-date')?.value || '',
        repeat: document.getElementById('task-repeat')?.value || '',
        pomos: 0,
        subtasks: [],
        createdAt: getEffectiveNowMs()
    });

    document.getElementById('task-input').value = '';
    saveState(false);
    renderTasks();
    refreshPomodoroTaskSelector();
}

function toggleTaskDone(id) {
    const task = (state.tasks || []).find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;

    if (task.done && task.repeat && task.date) {
        const nextDate = getNextRepeatDate(task.date, task.repeat);
        if (nextDate) {
            state.tasks.unshift({
                ...task,
                id: generateId('tsk'),
                done: false,
                date: nextDate,
                pomos: 0,
                subtasks: (task.subtasks || []).map(st => ({ ...st, done: false })),
                createdAt: getEffectiveNowMs()
            });
            showToast(`Siguiente repetición programada para ${nextDate}`, 'success');
        }
    }

    saveState(false);
    renderTasks();
    refreshPomodoroTaskSelector();
}

function deleteTask(id) {
    state.tasks = (state.tasks || []).filter(t => t.id !== id);
    saveState(false);
    renderTasks();
    refreshPomodoroTaskSelector();
}

function addSubtask(taskId) {
    const label = prompt('Texto de la subtarea:');
    if (!label || !label.trim()) return;
    const task = (state.tasks || []).find(t => t.id === taskId);
    if (!task) return;
    if (!Array.isArray(task.subtasks)) task.subtasks = [];
    task.subtasks.push({ id: generateId('subt'), text: label.trim(), done: false });
    saveState(false);
    renderTasks();
}

function setTaskFilter(filterKey) {
    currentTaskFilter = ALLOWED_TASK_FILTERS.includes(filterKey) ? filterKey : 'all';
    document.querySelectorAll('.task-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === currentTaskFilter);
    });
    renderTasks();
}

function setTaskBlockFilter(blockKey) {
    currentTaskBlockFilter = ALLOWED_TASK_BLOCKS.includes(blockKey) ? blockKey : 'all';
    document.querySelectorAll('.task-block-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.block === currentTaskBlockFilter);
    });
    renderTasks();
}

function setTaskSort(sortKey) {
    currentTaskSort = ALLOWED_TASK_SORTS.includes(sortKey) ? sortKey : 'created';
    renderTasks();
}

function clearCompletedTasks() {
    state.tasks = (state.tasks || []).filter(t => !t.done);
    saveState(false);
    renderTasks();
    refreshPomodoroTaskSelector();
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '';

    const todayKey = getMadridDateKey(getEffectiveNow());
    const prioWeight = { high: 1, medium: 2, low: 3 };
    const blockWeight = { morning: 1, afternoon: 2, night: 3 };

    const filtered = (state.tasks || [])
        .filter(t => {
            if (currentTaskBlockFilter !== 'all' && t.block !== currentTaskBlockFilter) return false;
            if (currentTaskFilter === 'pending') return !t.done;
            if (currentTaskFilter === 'done') return Boolean(t.done);
            if (currentTaskFilter === 'today') return t.date === todayKey;
            if (currentTaskFilter === 'overdue') return !t.done && t.date && t.date < todayKey;
            return true;
        })
        .sort((a, b) => {
            if (currentTaskSort === 'priority') return (prioWeight[a.priority] || 9) - (prioWeight[b.priority] || 9);
            if (currentTaskSort === 'block') return (blockWeight[a.block] || 9) - (blockWeight[b.block] || 9);
            if (currentTaskSort === 'date') return (a.date || '9999-12-31').localeCompare(b.date || '9999-12-31');
            return (b.createdAt || 0) - (a.createdAt || 0);
        });

    if (!filtered.length) {
        list.innerHTML = '<div class="mono-muted">No hay tareas para mostrar con este filtro.</div>';
        return;
    }

    filtered.forEach(task => {
        const row = document.createElement('div');
        row.className = `task-item ${task.done ? 'is-done' : ''}`;

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.checked = Boolean(task.done);
        chk.addEventListener('change', () => toggleTaskDone(task.id));

        const body = document.createElement('div');
        body.className = 'task-body';
        const prioBadge = task.priority === 'high' ? '🔴 Alta' : task.priority === 'low' ? '🟢 Baja' : '🟡 Media';
        const blockBadge = task.block === 'morning' ? '🌅 Mañana' : task.block === 'night' ? '🌙 Noche' : '☀️ Tarde';

        body.innerHTML = `
            <div class="task-text">${escapeHtml(task.text)}</div>
            <div class="task-meta">${prioBadge} · ${blockBadge}${task.date ? ` · 📅 ${escapeHtml(task.date)}` : ''}${task.repeat ? ` · 🔁 ${escapeHtml(task.repeat)}` : ''}${task.pomos ? ` · 🍅 ${task.pomos}` : ''}</div>
        `;

        if (Array.isArray(task.subtasks) && task.subtasks.length) {
            const subBox = document.createElement('div');
            subBox.className = 'subtasks-box';
            task.subtasks.forEach(st => {
                const subRow = document.createElement('label');
                subRow.className = 'subtask-row';
                const sChk = document.createElement('input');
                sChk.type = 'checkbox';
                sChk.checked = Boolean(st.done);
                sChk.addEventListener('change', () => {
                    st.done = !st.done;
                    saveState(false);
                    renderTasks();
                });
                const sTxt = document.createElement('span');
                sTxt.textContent = st.text;
                if (st.done) sTxt.style.textDecoration = 'line-through';
                subRow.append(sChk, sTxt);
                subBox.appendChild(subRow);
            });
            body.appendChild(subBox);
        }

        const actions = document.createElement('div');
        actions.className = 'filter-pills-row';
        const subBtn = document.createElement('button');
        subBtn.type = 'button';
        subBtn.className = 'btn-icon';
        subBtn.title = 'Añadir subtarea';
        subBtn.textContent = '+Sub';
        subBtn.addEventListener('click', () => addSubtask(task.id));

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-icon';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => deleteTask(task.id));

        actions.append(subBtn, delBtn);
        row.append(chk, body, actions);
        list.appendChild(row);
    });
}

/* ==========================================================
   POMODORO + RUIDO DE ENFOQUE
   ========================================================== */
function updatePomodoroDisplay() {
    const mins = String(Math.floor(pomodoroRemainingSeconds / 60)).padStart(2, '0');
    const secs = String(pomodoroRemainingSeconds % 60).padStart(2, '0');
    const disp = document.getElementById('pomo-display');
    if (disp) disp.textContent = `${mins}:${secs}`;

    const ring = document.getElementById('pomo-ring-progress');
    if (ring) {
        const circumference = 439.82;
        const ratio = pomodoroSessionTotalSeconds > 0 ? pomodoroRemainingSeconds / pomodoroSessionTotalSeconds : 1;
        ring.style.strokeDashoffset = String(circumference * (1 - ratio));
    }
}

function startPomodoro() {
    if (pomodoroInterval) return;
    pomodoroInterval = setInterval(() => {
        if (pomodoroRemainingSeconds > 0) {
            pomodoroRemainingSeconds--;
            updatePomodoroDisplay();
            return;
        }
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
        completePomodoroCycle();
    }, 1000);
}

function pausePomodoro() {
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
}

function resetPomodoro() {
    pausePomodoro();
    const mins = pomodoroCurrentMode === 'focus'
        ? (Number(state.pomodoro.focusMinutes) || 25)
        : (Number(state.pomodoro.breakMinutes) || 5);
    pomodoroSessionTotalSeconds = mins * 60;
    pomodoroRemainingSeconds = pomodoroSessionTotalSeconds;
    updatePomodoroDisplay();
}

function setPomodoroMode(mode, minutes) {
    pausePomodoro();
    pomodoroCurrentMode = mode === 'break' ? 'break' : 'focus';
    document.getElementById('btn-mode-focus')?.classList.toggle('active', pomodoroCurrentMode === 'focus');
    document.getElementById('btn-mode-break')?.classList.toggle('active', pomodoroCurrentMode === 'break');
    pomodoroSessionTotalSeconds = (Number(minutes) || 25) * 60;
    pomodoroRemainingSeconds = pomodoroSessionTotalSeconds;
    updatePomodoroDisplay();
}

function updatePomodoroConfig() {
    const f = Math.min(180, Math.max(1, Number(document.getElementById('pomo-focus-mins')?.value) || 25));
    const b = Math.min(60, Math.max(1, Number(document.getElementById('pomo-break-mins')?.value) || 5));
    state.pomodoro.focusMinutes = f;
    state.pomodoro.breakMinutes = b;
    saveState(false);
    resetPomodoro();
}

function completePomodoroCycle() {
    if (pomodoroCurrentMode === 'focus') {
        const focusedMins = Number(state.pomodoro.focusMinutes) || 25;
        const todayKey = getMadridDateKey(getEffectiveNow());
        if (state.pomodoro.lastStudyDay !== todayKey) {
            state.pomodoro.todayMinutes = 0;
            state.pomodoro.streak = (state.pomodoro.streak || 0) + 1;
            state.pomodoro.lastStudyDay = todayKey;
        }
        state.pomodoro.todayMinutes = (state.pomodoro.todayMinutes || 0) + focusedMins;
        state.pomodoro.totalMinutes = (state.pomodoro.totalMinutes || 0) + focusedMins;
        state.pomodoro.history[todayKey] = (state.pomodoro.history[todayKey] || 0) + focusedMins;

        if (state.pomodoro.linkedTaskId) {
            const linked = (state.tasks || []).find(t => t.id === state.pomodoro.linkedTaskId);
            if (linked) linked.pomos = (linked.pomos || 0) + 1;
        }

        saveState(false);
        renderPomodoroStats();
        renderTasks();
        showToast(`¡Pomodoro completado! +${focusedMins} min de estudio`, 'success');
        setPomodoroMode('break', state.pomodoro.breakMinutes || 5);
    } else {
        showToast('Descanso terminado. ¡Vuelta al enfoque!');
        setPomodoroMode('focus', state.pomodoro.focusMinutes || 25);
    }
}

function refreshPomodoroTaskSelector() {
    const sel = document.getElementById('pomo-linked-task');
    if (!sel) return;
    const current = state.pomodoro.linkedTaskId || '';
    sel.innerHTML = '<option value="">-- Vincular tarea (opcional) --</option>';
    (state.tasks || []).filter(t => !t.done).forEach(t => {
        const opt = document.createElement('option');
        opt.value = t.id;
        opt.textContent = t.text;
        sel.appendChild(opt);
    });
    sel.value = [...sel.options].some(o => o.value === current) ? current : '';
}

function setPomodoroLinkedTask(taskId) {
    state.pomodoro.linkedTaskId = taskId || '';
    saveState(false);
}

function renderPomodoroStats() {
    const todayEl = document.getElementById('pomo-today-mins');
    const streakEl = document.getElementById('pomo-streak-days');
    const totalEl = document.getElementById('pomo-total-mins');
    const heatEl = document.getElementById('pomo-heatmap');

    if (todayEl) todayEl.textContent = `${state.pomodoro.todayMinutes || 0}m`;
    if (streakEl) streakEl.textContent = `${state.pomodoro.streak || 0}d`;
    if (totalEl) totalEl.textContent = `${state.pomodoro.totalMinutes || 0}m`;

    if (heatEl) {
        heatEl.innerHTML = '';
        const nowMs = getEffectiveNowMs();
        for (let i = 13; i >= 0; i--) {
            const dKey = getMadridDateKey(new Date(nowMs - i * 86400000));
            const mins = state.pomodoro.history?.[dKey] || 0;
            const cell = document.createElement('div');
            cell.className = 'heat-cell';
            if (mins >= 90) cell.classList.add('lv-3');
            else if (mins >= 45) cell.classList.add('lv-2');
            else if (mins > 0) cell.classList.add('lv-1');
            cell.title = `${dKey}: ${mins} min`;
            heatEl.appendChild(cell);
        }
    }
}

function toggleFocusAudio() {
    const btn = document.getElementById('btn-audio-toggle');
    if (isAudioPlaying) {
        try { noiseNode?.stop(); } catch (_) {}
        noiseNode = null;
        isAudioPlaying = false;
        if (btn) btn.textContent = '🔇 Ruido Focus';
        return;
    }

    try {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            data[i] = (lastOut + 0.02 * white) / 1.02;
            lastOut = data[i];
            data[i] *= 2.5;
        }
        noiseNode = audioCtx.createBufferSource();
        noiseNode.buffer = buffer;
        noiseNode.loop = true;

        audioGain = audioCtx.createGain();
        audioGain.gain.value = (Number(document.getElementById('audio-volume')?.value) || 25) / 300;
        noiseNode.connect(audioGain);
        audioGain.connect(audioCtx.destination);
        noiseNode.start();
        isAudioPlaying = true;
        if (btn) btn.textContent = '🔊 Ruido Activo';
    } catch (_) {
        showToast('No se pudo iniciar el audio en este navegador', 'error');
    }
}

function updateFocusAudioVolume(val) {
    if (audioGain) {
        audioGain.gain.value = (Number(val) || 25) / 300;
    }
}

/* ==========================================================
   BLOC DE NOTAS, STICKY, CODE STUDIO, SQL, ACADEMY, DEVLAB Y BOOT
   ========================================================== */
function switchNoteTab(tabKey) {
    const tab = ALLOWED_NOTE_TABS.includes(tabKey) ? tabKey : 'general';
    state.ui.noteTab = tab;
    document.querySelectorAll('.note-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.notetab === tab);
    });
    const area = document.getElementById('notes-area');
    if (area) area.value = state.notes[tab] || '';
    updateNoteWordCount();
    saveState(false);
}

function handleNoteInput() {
    const tab = state.ui.noteTab || 'general';
    const area = document.getElementById('notes-area');
    if (!area) return;
    state.notes[tab] = area.value;
    updateNoteWordCount();
    saveState(false);
}

function updateNoteWordCount() {
    const area = document.getElementById('notes-area');
    const counter = document.getElementById('notes-word-count');
    if (!area || !counter) return;
    const text = area.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    counter.textContent = `${words} palabras · ${area.value.length} car.`;
}

function saveNoteRevision() {
    const tab = state.ui.noteTab || 'general';
    const content = state.notes[tab] || '';
    if (!content.trim()) return;
    state.noteRevisions.unshift({
        id: generateId('rev'),
        tab,
        content,
        createdAt: getEffectiveNowMs()
    });
    state.noteRevisions = state.noteRevisions.slice(0, MAX_NOTE_REVISIONS);
    saveState(false);
    showToast('Versión de nota guardada', 'success');
}

function openNoteHistoryModal() {
    const list = document.getElementById('note-history-list');
    if (list) {
        list.innerHTML = '';
        if (!state.noteRevisions.length) {
            list.innerHTML = '<div class="mono-muted">No hay versiones guardadas.</div>';
        } else {
            state.noteRevisions.forEach(rev => {
                const row = document.createElement('div');
                row.className = 'grade-item-row';
                const info = document.createElement('span');
                info.textContent = `[${rev.tab}] ${new Date(rev.createdAt).toLocaleString('es-ES')} · ${rev.content.slice(0, 45)}...`;
                const btn = document.createElement('button');
                btn.type = 'button';
                btn.className = 'btn-cyan btn-sm';
                btn.textContent = 'Restaurar';
                btn.addEventListener('click', () => {
                    switchNoteTab(rev.tab);
                    state.notes[rev.tab] = rev.content;
                    const area = document.getElementById('notes-area');
                    if (area) area.value = rev.content;
                    saveState(false);
                    closeNoteHistoryModal();
                    showToast('Nota restaurada', 'success');
                });
                row.append(info, btn);
                list.appendChild(row);
            });
        }
    }
    document.getElementById('note-history-modal').style.display = 'flex';
}

function closeNoteHistoryModal() {
    document.getElementById('note-history-modal').style.display = 'none';
}

function toggleNoteMarkdownPreview() {
    const area = document.getElementById('notes-area');
    const prev = document.getElementById('notes-md-preview');
    if (!area || !prev) return;
    const showing = !prev.classList.contains('is-hidden');
    if (showing) {
        prev.classList.add('is-hidden');
        area.classList.remove('is-hidden');
    } else {
        prev.innerHTML = escapeHtml(area.value).replace(/\n/g, '<br>');
        area.classList.add('is-hidden');
        prev.classList.remove('is-hidden');
    }
}

function exportCurrentNoteMd() {
    const tab = state.ui.noteTab || 'general';
    const blob = new Blob([state.notes[tab] || ''], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-${tab}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleStickyNote() {
    const drawer = document.getElementById('sticky-drawer');
    if (!drawer) return;
    drawer.classList.toggle('is-hidden');
    const area = document.getElementById('sticky-note-area');
    if (area) area.value = state.stickyNote || '';
}

function saveStickyNote() {
    const area = document.getElementById('sticky-note-area');
    if (!area) return;
    state.stickyNote = area.value;
    saveState(false);
}

function toggleForm(formId) {
    const el = document.getElementById(formId);
    if (el) el.classList.toggle('is-hidden');
}

function switchStudioTab(tabKey) {
    const tab = ALLOWED_STUDIO_TABS.includes(tabKey) ? tabKey : 'html';
    state.ui.studioActiveTab = tab;

    document.querySelectorAll('.studio-file-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sttab === tab);
    });

    ['html', 'css', 'js', 'python', 'java'].forEach(lang => {
        const ed = document.getElementById(`studio-editor-${lang}`);
        if (ed) ed.classList.toggle('active', tab === lang);
    });

    const savedPanel = document.getElementById('studio-saved-panel');
    if (savedPanel) savedPanel.classList.toggle('is-hidden', tab !== 'saved');

    updateStudioEditorMetrics();
    updateStudioOutputModeLabel();
    if (tab !== 'saved') renderStudioPreview();
    saveState(false);
}

function handleStudioEditorInput(lang) {
    const ed = document.getElementById(`studio-editor-${lang}`);
    if (!ed) return;
    state.studio[lang] = ed.value;
    updateStudioEditorMetrics();
    saveState(false);
    if (document.getElementById('studio-live-toggle')?.checked) {
        renderStudioPreview();
    }
}

function handleStudioTitleChange() {
    const inp = document.getElementById('studio-project-title');
    if (!inp) return;
    state.studio.projectTitle = inp.value;
    saveState(false);
}

function updateStudioEditorMetrics() {
    const tab = state.ui.studioActiveTab || 'html';
    const metricsEl = document.getElementById('studio-editor-metrics');
    if (!metricsEl) return;
    if (tab === 'saved') {
        metricsEl.textContent = `${state.studio.savedProjects.length} proyectos`;
        return;
    }
    const text = state.studio[tab] || '';
    const lines = text ? text.split('\n').length : 0;
    metricsEl.textContent = `${lines} líneas · ${text.length} car.`;
}

function updateStudioOutputModeLabel() {
    const lbl = document.getElementById('studio-output-mode-label');
    if (!lbl) return;
    const tab = state.ui.studioActiveTab || 'html';
    if (tab === 'python') lbl.textContent = 'Salida Python 3 (Ejecución Real)';
    else if (tab === 'java') lbl.textContent = 'Salida Java 17 (Compilación y Ejecución Real)';
    else lbl.textContent = 'Vista Previa Web en Vivo';
}

function setStudioViewport(widthStr) {
    state.ui.studioViewport = ALLOWED_VIEWPORTS.includes(widthStr) ? widthStr : '100%';
    document.querySelectorAll('.vp-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vp === state.ui.studioViewport);
    });
    const frame = document.getElementById('studio-preview-frame');
    if (frame) frame.style.width = state.ui.studioViewport;
    saveState(false);
}

function clearStudioConsole() {
    studioConsoleLogs = [];
    const box = document.getElementById('studio-console-output');
    if (box) box.innerHTML = '';
}

function appendStudioConsoleLine(level, msg) {
    const box = document.getElementById('studio-console-output');
    if (!box) return;
    const line = document.createElement('div');
    line.className = `console-line ${level === 'error' ? 'console-err' : level === 'warn' ? 'console-warn' : ''}`;
    line.textContent = `[${level.toUpperCase()}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function renderStudioPreview() {
    const tab = state.ui.studioActiveTab || 'html';
    const frame = document.getElementById('studio-preview-frame');
    const runnerOut = document.getElementById('studio-runner-output');
    if (!frame || !runnerOut) return;

    if (tab === 'python' || tab === 'java') {
        frame.classList.add('is-hidden');
        runnerOut.classList.remove('is-hidden');
        return;
    }

    runnerOut.classList.add('is-hidden');
    frame.classList.remove('is-hidden');

    const fontName = state.ui.studioFont || '';
    const fontHead = fontName
        ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, '+')}:wght@400;600;700&display=swap"><style>body{font-family:'${fontName}',sans-serif;}</style>`
        : '';

    const bridgeScript = `<script>
        ['log','warn','error'].forEach(fn => {
            const orig = console[fn];
            console[fn] = (...args) => {
                orig.apply(console, args);
                parent.postMessage({ source: 'dw-studio-console', level: fn, message: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
            };
        });
        window.onerror = (msg, _, line) => parent.postMessage({ source: 'dw-studio-console', level: 'error', message: msg + ' (línea ' + line + ')' }, '*');
    <\/script>`;

    frame.srcdoc = `<!DOCTYPE html><html><head><meta charset="UTF-8">${fontHead}<style>${state.studio.css || ''}</style>${bridgeScript}</head><body>${state.studio.html || ''}<script>${state.studio.js || ''}<\/script></body></html>`;
}

async function runStudioCode() {
    const tab = state.ui.studioActiveTab || 'html';
    if (tab !== 'python' && tab !== 'java') {
        renderStudioPreview();
        showToast('Vista previa web actualizada');
        return;
    }

    const runnerOut = document.getElementById('studio-runner-output');
    const frame = document.getElementById('studio-preview-frame');
    if (!runnerOut) return;
    frame?.classList.add('is-hidden');
    runnerOut.classList.remove('is-hidden');

    const isPython = tab === 'python';
    const language = isPython ? 'python' : 'java';
    const version = isPython ? '3.10.0' : '15.0.2';
    const fileName = isPython ? 'main.py' : 'Main.java';
    const code = state.studio[tab] || '';

    runnerOut.textContent = `⏳ Ejecutando ${isPython ? 'Python 3' : 'Java'} en entorno aislado...\n`;
    appendStudioConsoleLine('log', `Enviando ${fileName} al motor de ejecución...`);

    try {
        const res = await fetch('https://emkc.org/api/v2/piston/execute', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language,
                version,
                files: [{ name: fileName, content: code }]
            })
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const compileOut = data.compile?.output || '';
        const runOut = data.run?.output || '';
        const exitCode = data.run?.code ?? data.compile?.code ?? 0;

        runnerOut.textContent = `${compileOut ? `[COMPILACIÓN]\n${compileOut}\n` : ''}${runOut || '(Sin salida por consola)'}\n\n--- Exit code: ${exitCode} ---`;
        appendStudioConsoleLine(exitCode === 0 ? 'log' : 'error', `${fileName} finalizado con código ${exitCode}`);
    } catch (err) {
        runnerOut.textContent = `❌ No se pudo conectar con el servidor de ejecución remota (${err.message}).\nVerifica tu conexión a Internet para ejecutar Python/Java en vivo.`;
        appendStudioConsoleLine('error', `Error de ejecución ${language}: ${err.message}`);
    }
}

function loadStudioTemplate(tplKey) {
    const tpl = STUDIO_TEMPLATES[tplKey];
    if (!tpl) return;
    if (tpl.python) {
        state.studio.python = tpl.python;
        const ed = document.getElementById('studio-editor-python');
        if (ed) ed.value = tpl.python;
        switchStudioTab('python');
    } else if (tpl.java) {
        state.studio.java = tpl.java;
        const ed = document.getElementById('studio-editor-java');
        if (ed) ed.value = tpl.java;
        switchStudioTab('java');
    } else {
        state.studio.html = tpl.html || '';
        state.studio.css = tpl.css || '';
        state.studio.js = tpl.js || '';
        if (document.getElementById('studio-editor-html')) document.getElementById('studio-editor-html').value = state.studio.html;
        if (document.getElementById('studio-editor-css')) document.getElementById('studio-editor-css').value = state.studio.css;
        if (document.getElementById('studio-editor-js')) document.getElementById('studio-editor-js').value = state.studio.js;
        renderStudioPreview();
    }
    saveState(false);
    showToast(`Plantilla "${tplKey}" cargada`, 'success');
}

function injectCdnIntoStudio(cdnKey) {
    const snippet = CDN_SNIPPETS[cdnKey];
    if (!snippet) return;
    state.studio.html = `${snippet}\n${state.studio.html || ''}`;
    const ed = document.getElementById('studio-editor-html');
    if (ed) ed.value = state.studio.html;
    renderStudioPreview();
    saveState(false);
    showToast(`CDN ${cdnKey} inyectado en HTML`, 'success');
}

function formatStudioCode() {
    const tab = state.ui.studioActiveTab || 'html';
    const ed = document.getElementById(`studio-editor-${tab}`);
    if (!ed) return;
    ed.value = ed.value
        .split('\n')
        .map(line => line.replace(/\s+$/, ''))
        .join('\n')
        .trim() + '\n';
    state.studio[tab] = ed.value;
    saveState(false);
    showToast('Espacios limpiados');
}

function saveStudioProjectToLibrary() {
    const title = (state.studio.projectTitle || 'Proyecto sin título').trim();
    state.studio.savedProjects.unshift({
        id: generateId('prj'),
        title,
        html: state.studio.html,
        css: state.studio.css,
        js: state.studio.js,
        python: state.studio.python,
        java: state.studio.java,
        savedAt: getEffectiveNowMs()
    });
    state.studio.savedProjects = state.studio.savedProjects.slice(0, MAX_STUDIO_PROJECTS);
    saveState(false);
    renderSavedStudioProjects();
    showToast(`Proyecto "${title}" guardado en biblioteca`, 'success');
}

function renderSavedStudioProjects() {
    const list = document.getElementById('studio-saved-list');
    if (!list) return;
    list.innerHTML = '';
    const items = state.studio.savedProjects || [];
    if (!items.length) {
        list.innerHTML = '<div class="mono-muted">Aún no hay proyectos guardados en la biblioteca.</div>';
        return;
    }
    items.forEach(p => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `${p.title} (${new Date(p.savedAt).toLocaleDateString('es-ES')})`;

        const acts = document.createElement('div');
        acts.className = 'filter-pills-row';
        const loadBtn = document.createElement('button');
        loadBtn.type = 'button';
        loadBtn.className = 'btn-cyan btn-sm';
        loadBtn.textContent = 'Abrir';
        loadBtn.addEventListener('click', () => {
            state.studio.projectTitle = p.title;
            state.studio.html = p.html || '';
            state.studio.css = p.css || '';
            state.studio.js = p.js || '';
            state.studio.python = p.python || STUDIO_TEMPLATES.python.python;
            state.studio.java = p.java || STUDIO_TEMPLATES.java.java;
            syncStudioEditorsFromState();
            switchStudioTab('html');
            showToast(`Proyecto "${p.title}" cargado`, 'success');
        });

        const delBtn = document.createElement('button');
        delBtn.type = 'button';
        delBtn.className = 'btn-icon';
        delBtn.textContent = '🗑️';
        delBtn.addEventListener('click', () => {
            state.studio.savedProjects = state.studio.savedProjects.filter(x => x.id !== p.id);
            saveState(false);
            renderSavedStudioProjects();
        });

        acts.append(loadBtn, delBtn);
        row.append(info, acts);
        list.appendChild(row);
    });
}

function exportStudioSingleHtml() {
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>${escapeHtml(state.studio.projectTitle || 'Export')}</title><style>${state.studio.css || ''}</style></head><body>${state.studio.html || ''}<script>${state.studio.js || ''}<\/script></body></html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.studio.projectTitle || 'proyecto').toLowerCase().replace(/\s+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportStudioMultiFiles() {
    const tab = state.ui.studioActiveTab || 'html';
    if (tab === 'python' || tab === 'java') {
        const ext = tab === 'python' ? 'py' : 'java';
        const fname = tab === 'python' ? 'main.py' : 'Main.java';
        const blob = new Blob([state.studio[tab] || ''], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fname || `codigo.${ext}`;
        a.click();
        URL.revokeObjectURL(url);
        return;
    }
    const bundle = `/* === index.html === */\n${state.studio.html}\n\n/* === styles.css === */\n${state.studio.css}\n\n/* === app.js === */\n${state.studio.js}`;
    const blob = new Blob([bundle], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'proyecto-web-bundle.txt';
    a.click();
    URL.revokeObjectURL(url);
}

function syncStudioEditorsFromState() {
    if (document.getElementById('studio-project-title')) document.getElementById('studio-project-title').value = state.studio.projectTitle || '';
    if (document.getElementById('studio-editor-html')) document.getElementById('studio-editor-html').value = state.studio.html || '';
    if (document.getElementById('studio-editor-css')) document.getElementById('studio-editor-css').value = state.studio.css || '';
    if (document.getElementById('studio-editor-js')) document.getElementById('studio-editor-js').value = state.studio.js || '';
    if (document.getElementById('studio-editor-python')) document.getElementById('studio-editor-python').value = state.studio.python || '';
    if (document.getElementById('studio-editor-java')) document.getElementById('studio-editor-java').value = state.studio.java || '';
}

/* ==========================================================
   BASE DE DATOS LOCAL & SQL
   ========================================================== */
function renderDbWorkspace() {
    const tables = state.database?.tables || {};
    const names = Object.keys(tables);
    const tabsBox = document.getElementById('db-tables-tabs');
    if (tabsBox) {
        tabsBox.innerHTML = '';
        names.forEach(name => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `pill-btn ${state.ui.activeDbTable === name ? 'active' : ''}`;
            btn.textContent = name;
            btn.addEventListener('click', () => {
                state.ui.activeDbTable = name;
                saveState(false);
                renderDbWorkspace();
            });
            tabsBox.appendChild(btn);
        });
    }

    const active = tables[state.ui.activeDbTable] ? state.ui.activeDbTable : names[0];
    state.ui.activeDbTable = active || '';
    const titleEl = document.getElementById('db-active-table-title');
    if (titleEl) titleEl.textContent = active ? `Tabla: ${active}` : 'Sin tabla seleccionada';

    const grid = document.getElementById('db-table-grid-container');
    if (!grid) return;
    if (!active || !tables[active]) {
        grid.innerHTML = '<div class="mono-muted">Crea una tabla para empezar.</div>';
        return;
    }

    const tbl = tables[active];
    const ths = tbl.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
    const trs = (tbl.rows || []).map((r, rIdx) => {
        const tds = tbl.columns.map(c => `<td>${escapeHtml(r[c] ?? '')}</td>`).join('');
        return `<tr>${tds}<td><button type="button" class="btn-icon" data-db-del="${rIdx}">🗑️</button></td></tr>`;
    }).join('');

    grid.innerHTML = `<table class="sch-table"><thead><tr>${ths}<th>Acción</th></tr></thead><tbody>${trs || `<tr><td colspan="${tbl.columns.length + 1}" class="mono-muted">Tabla vacía</td></tr>`}</tbody></table>`;
    grid.querySelectorAll('[data-db-del]').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.dbDel);
            tbl.rows.splice(idx, 1);
            saveState(false);
            renderDbWorkspace();
        });
    });
}

function createDbTable() {
    const name = (document.getElementById('db-new-table-name')?.value || '').trim().replace(/\s+/g, '_');
    const colsRaw = (document.getElementById('db-new-table-cols')?.value || '').trim();
    if (!name || !colsRaw) {
        showToast('Indica nombre de tabla y columnas', 'error');
        return;
    }
    const columns = colsRaw.split(',').map(c => c.trim()).filter(Boolean);
    if (!columns.length) return;
    state.database.tables[name] = { columns, rows: [] };
    state.ui.activeDbTable = name;
    document.getElementById('db-new-table-name').value = '';
    document.getElementById('db-new-table-cols').value = '';
    saveState(false);
    renderDbWorkspace();
    showToast(`Tabla "${name}" creada`, 'success');
}

function addDbRowPrompt() {
    const active = state.ui.activeDbTable;
    const tbl = state.database?.tables?.[active];
    if (!tbl) return;
    const row = {};
    for (const col of tbl.columns) {
        const val = prompt(`Valor para "${col}":`, '');
        if (val === null) return;
        row[col] = val;
    }
    tbl.rows.push(row);
    saveState(false);
    renderDbWorkspace();
}

function deleteCurrentDbTable() {
    const active = state.ui.activeDbTable;
    if (!active || !state.database?.tables?.[active]) return;
    delete state.database.tables[active];
    state.ui.activeDbTable = Object.keys(state.database.tables)[0] || '';
    saveState(false);
    renderDbWorkspace();
}

function insertSqlTemplate(kind) {
    const box = document.getElementById('db-sql-input');
    const tbl = state.ui.activeDbTable || 'alumnos';
    if (!box) return;
    if (kind === 'select') box.value = `SELECT * FROM ${tbl};`;
    else if (kind === 'insert') box.value = `INSERT INTO ${tbl} (id, nombre, curso) VALUES (1, 'Marcos', '1DAM');`;
    else if (kind === 'update') box.value = `UPDATE ${tbl} SET curso = '2DAM' WHERE id = 1;`;
    else if (kind === 'delete') box.value = `DELETE FROM ${tbl} WHERE id = 1;`;
}

function executeLocalSql() {
    const sql = (document.getElementById('db-sql-input')?.value || '').trim().replace(/;$/, '');
    const out = document.getElementById('db-sql-result');
    if (!sql || !out) return;

    const selectMatch = sql.match(/^SELECT\s+\*\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*'?([^']*)'?)?$/i);
    if (selectMatch) {
        const [, tblName, whereCol, whereVal] = selectMatch;
        const tbl = state.database?.tables?.[tblName];
        if (!tbl) {
            out.innerHTML = `<div class="mono-muted">Error: tabla "${escapeHtml(tblName)}" no existe.</div>`;
            return;
        }
        const rows = whereCol ? tbl.rows.filter(r => String(r[whereCol]) === whereVal) : tbl.rows;
        const ths = tbl.columns.map(c => `<th>${escapeHtml(c)}</th>`).join('');
        const trs = rows.map(r => `<tr>${tbl.columns.map(c => `<td>${escapeHtml(r[c] ?? '')}</td>`).join('')}</tr>`).join('');
        out.innerHTML = `<table class="sch-table"><thead><tr>${ths}</tr></thead><tbody>${trs || `<tr><td colspan="${tbl.columns.length}" class="mono-muted">0 filas</td></tr>`}</tbody></table>`;
        return;
    }

    const insertMatch = sql.match(/^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i);
    if (insertMatch) {
        const [, tblName, colsStr, valsStr] = insertMatch;
        const tbl = state.database?.tables?.[tblName];
        if (!tbl) {
            out.innerHTML = `<div class="mono-muted">Error: tabla "${escapeHtml(tblName)}" no existe.</div>`;
            return;
        }
        const cols = colsStr.split(',').map(s => s.trim());
        const vals = valsStr.split(',').map(s => s.trim().replace(/^'|'$/g, ''));
        const row = {};
        cols.forEach((c, i) => { row[c] = vals[i] ?? ''; });
        tbl.rows.push(row);
        saveState(false);
        renderDbWorkspace();
        out.innerHTML = '<div class="mono-muted">✅ 1 fila insertada correctamente.</div>';
        return;
    }

    const delMatch = sql.match(/^DELETE\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*'?([^']*)'?)?$/i);
    if (delMatch) {
        const [, tblName, whereCol, whereVal] = delMatch;
        const tbl = state.database?.tables?.[tblName];
        if (!tbl) {
            out.innerHTML = `<div class="mono-muted">Error: tabla "${escapeHtml(tblName)}" no existe.</div>`;
            return;
        }
        const before = tbl.rows.length;
        tbl.rows = whereCol ? tbl.rows.filter(r => String(r[whereCol]) !== whereVal) : [];
        saveState(false);
        renderDbWorkspace();
        out.innerHTML = `<div class="mono-muted">✅ ${before - tbl.rows.length} fila(s) eliminada(s).</div>`;
        return;
    }

    out.innerHTML = '<div class="mono-muted">Sintaxis soportada: SELECT * FROM tabla [WHERE col=val], INSERT INTO tabla (cols) VALUES (vals), DELETE FROM tabla [WHERE col=val].</div>';
}

function exportDbJson() {
    const blob = new Blob([JSON.stringify(state.database, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devworkspace-db.json';
    a.click();
    URL.revokeObjectURL(url);
}

/* ==========================================================
   ACADEMIA DAM (KANBAN, NOTAS, FLASHCARDS, BUGS, DUDAS, PROYECTOS)
   ========================================================== */
function addKanbanTask() {
    const subject = (document.getElementById('kb-subject')?.value || '').trim();
    const title = (document.getElementById('kb-title')?.value || '').trim();
    if (!title) return;
    state.kanban.push({ id: generateId('kb'), subject, title, status: 'todo' });
    document.getElementById('kb-title').value = '';
    toggleForm('form-add-kanban');
    saveState(false);
    renderKanban();
}

function renderKanban() {
    ALLOWED_KANBAN_COLS.forEach(col => {
        const box = document.getElementById(`kb-col-${col}`);
        if (!box) return;
        box.innerHTML = '';
        (state.kanban || []).filter(item => item.status === col).forEach(item => {
            const card = document.createElement('div');
            card.className = 'kanban-card';
            card.innerHTML = `<div class="kb-subj">${escapeHtml(item.subject || 'DAM')}</div><div>${escapeHtml(item.title)}</div>`;
            const bar = document.createElement('div');
            bar.className = 'filter-pills-row';
            if (col !== 'todo') {
                const prev = document.createElement('button');
                prev.type = 'button';
                prev.className = 'btn-icon';
                prev.textContent = '⬅️';
                prev.addEventListener('click', () => { item.status = col === 'done' ? 'doing' : 'todo'; saveState(false); renderKanban(); });
                bar.appendChild(prev);
            }
            if (col !== 'done') {
                const next = document.createElement('button');
                next.type = 'button';
                next.className = 'btn-icon';
                next.textContent = '➡️';
                next.addEventListener('click', () => { item.status = col === 'todo' ? 'doing' : 'done'; saveState(false); renderKanban(); });
                bar.appendChild(next);
            }
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-icon';
            del.textContent = '🗑️';
            del.addEventListener('click', () => { state.kanban = state.kanban.filter(x => x.id !== item.id); saveState(false); renderKanban(); });
            bar.appendChild(del);
            card.appendChild(bar);
            box.appendChild(card);
        });
    });
}

function addGrade() {
    const subject = (document.getElementById('grd-subject')?.value || '').trim();
    const title = (document.getElementById('grd-title')?.value || '').trim();
    const score = Number(document.getElementById('grd-score')?.value);
    const weight = Number(document.getElementById('grd-weight')?.value) || 100;
    if (!subject || !title || !Number.isFinite(score)) return;
    state.grades.push({ id: generateId('grd'), subject, title, score, weight });
    document.getElementById('grd-title').value = '';
    document.getElementById('grd-score').value = '';
    toggleForm('form-add-grade');
    saveState(false);
    renderGrades();
}

function renderGrades() {
    const list = document.getElementById('grades-list');
    const avgBadge = document.getElementById('grades-avg-badge');
    if (!list) return;
    list.innerHTML = '';

    const items = state.grades || [];
    if (!items.length) {
        if (avgBadge) avgBadge.textContent = 'Media: --';
        list.innerHTML = '<div class="mono-muted">Sin calificaciones registradas.</div>';
        return;
    }

    let weightedSum = 0;
    let totalWeight = 0;
    items.forEach(g => {
        weightedSum += g.score * (g.weight || 1);
        totalWeight += (g.weight || 1);

        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `${g.subject} · ${g.title}: ${g.score.toFixed(2)} (${g.weight}%)`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => { state.grades = state.grades.filter(x => x.id !== g.id); saveState(false); renderGrades(); });
        row.append(info, del);
        list.appendChild(row);
    });

    if (avgBadge) {
        avgBadge.textContent = `Media: ${(weightedSum / Math.max(1, totalWeight)).toFixed(2)}`;
    }
}

function switchStudyHubTab(tabKey) {
    state.ui.studyHubTab = tabKey;
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.studytab === tabKey);
    });
    document.getElementById('study-panel-flashcards')?.classList.toggle('is-hidden', tabKey !== 'flashcards');
    document.getElementById('study-panel-bugs')?.classList.toggle('is-hidden', tabKey !== 'bugs');
    document.getElementById('study-panel-doubts')?.classList.toggle('is-hidden', tabKey !== 'doubts');
    saveState(false);
}

function addFlashcard() {
    const subject = (document.getElementById('fc-subject')?.value || '').trim();
    const front = (document.getElementById('fc-front')?.value || '').trim();
    const back = (document.getElementById('fc-back')?.value || '').trim();
    if (!front || !back) return;
    state.flashcards.push({ id: generateId('fc'), subject, front, back });
    document.getElementById('fc-front').value = '';
    document.getElementById('fc-back').value = '';
    toggleForm('form-add-fc');
    saveState(false);
    renderFlashcards();
}

function renderFlashcards() {
    const filterSubj = document.getElementById('fc-filter-subject')?.value || 'all';
    const deck = (state.flashcards || []).filter(f => filterSubj === 'all' || f.subject === filterSubj);
    const subjBadge = document.getElementById('fc-card-subject');
    const counter = document.getElementById('fc-counter');
    const content = document.getElementById('fc-card-content');

    if (!deck.length) {
        if (subjBadge) subjBadge.textContent = 'Sin tarjetas';
        if (counter) counter.textContent = '0 / 0';
        if (content) content.textContent = 'Añade tarjetas de estudio arriba';
        return;
    }

    if (currentFlashcardIndex >= deck.length) currentFlashcardIndex = 0;
    if (currentFlashcardIndex < 0) currentFlashcardIndex = deck.length - 1;
    const card = deck[currentFlashcardIndex];

    if (subjBadge) subjBadge.textContent = card.subject || 'DAM';
    if (counter) counter.textContent = `${currentFlashcardIndex + 1} / ${deck.length}`;
    if (content) content.textContent = isFlashcardFlipped ? card.back : card.front;
}

function flipFlashcard() {
    isFlashcardFlipped = !isFlashcardFlipped;
    renderFlashcards();
}

function nextFlashcard() {
    isFlashcardFlipped = false;
    currentFlashcardIndex++;
    renderFlashcards();
}

function prevFlashcard() {
    isFlashcardFlipped = false;
    currentFlashcardIndex--;
    renderFlashcards();
}

function deleteCurrentFlashcard() {
    const filterSubj = document.getElementById('fc-filter-subject')?.value || 'all';
    const deck = (state.flashcards || []).filter(f => filterSubj === 'all' || f.subject === filterSubj);
    const current = deck[currentFlashcardIndex];
    if (!current) return;
    state.flashcards = state.flashcards.filter(f => f.id !== current.id);
    isFlashcardFlipped = false;
    saveState(false);
    renderFlashcards();
}

function addBugLog() {
    const title = (document.getElementById('bug-title')?.value || '').trim();
    const fix = (document.getElementById('bug-fix')?.value || '').trim();
    if (!title) return;
    state.bugs.unshift({ id: generateId('bug'), title, fix });
    document.getElementById('bug-title').value = '';
    document.getElementById('bug-fix').value = '';
    toggleForm('form-add-bug');
    saveState(false);
    renderBugLogs();
}

function renderBugLogs() {
    const list = document.getElementById('bug-logs-list');
    if (!list) return;
    list.innerHTML = '';
    (state.bugs || []).forEach(b => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `🐞 ${b.title}${b.fix ? ` → ✅ ${b.fix}` : ''}`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => { state.bugs = state.bugs.filter(x => x.id !== b.id); saveState(false); renderBugLogs(); });
        row.append(info, del);
        list.appendChild(row);
    });
}

function addClassDoubt() {
    const subject = (document.getElementById('doubt-subject')?.value || '').trim();
    const text = (document.getElementById('doubt-text')?.value || '').trim();
    if (!text) return;
    state.doubts.unshift({ id: generateId('dbt'), subject, text, resolved: false });
    document.getElementById('doubt-text').value = '';
    toggleForm('form-add-doubt');
    saveState(false);
    renderClassDoubts();
}

function renderClassDoubts() {
    const list = document.getElementById('class-doubts-list');
    if (!list) return;
    list.innerHTML = '';
    (state.doubts || []).forEach(d => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `[${d.subject || 'DAM'}] ${d.text}`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => { state.doubts = state.doubts.filter(x => x.id !== d.id); saveState(false); renderClassDoubts(); });
        row.append(info, del);
        list.appendChild(row);
    });
}

function addProject() {
    const title = (document.getElementById('prj-title')?.value || '').trim();
    const stack = (document.getElementById('prj-stack')?.value || '').trim();
    const progress = Math.min(100, Math.max(0, Number(document.getElementById('prj-progress')?.value) || 0));
    const url = sanitizeUrl(document.getElementById('prj-url')?.value || '');
    if (!title) return;
    state.projects.unshift({ id: generateId('p'), title, stack, progress, url });
    document.getElementById('prj-title').value = '';
    document.getElementById('prj-stack').value = '';
    document.getElementById('prj-url').value = '';
    toggleForm('form-add-project');
    saveState(false);
    renderProjects();
}

function renderProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    list.innerHTML = '';
    (state.projects || []).forEach(p => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `🚀 ${p.title} (${p.stack || 'Stack'}) · ${p.progress}%`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => { state.projects = state.projects.filter(x => x.id !== p.id); saveState(false); renderProjects(); });
        row.append(info, del);
        list.appendChild(row);
    });
}

/* ==========================================================
   DEVLAB (TOOLBOX, SERVIDORES, SNIPPETS, BOOKMARKS) Y MODALES
   ========================================================== */
function switchToolboxTab(tabKey) {
    state.ui.toolboxTab = tabKey;
    document.querySelectorAll('.tb-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tbtab === tabKey);
    });
    ['format', 'encode', 'net', 'gen'].forEach(t => {
        document.getElementById(`tb-panel-${t}`)?.classList.toggle('is-hidden', t !== tabKey);
    });
}

function formatJsonTool() {
    const area = document.getElementById('json-input-area');
    if (!area) return;
    try {
        area.value = JSON.stringify(JSON.parse(area.value), null, 2);
    } catch (err) {
        showToast(`JSON inválido: ${err.message}`, 'error');
    }
}

function minifyJsonTool() {
    const area = document.getElementById('json-input-area');
    if (!area) return;
    try {
        area.value = JSON.stringify(JSON.parse(area.value));
    } catch (err) {
        showToast(`JSON inválido: ${err.message}`, 'error');
    }
}

function encodeBase64Tool() {
    const area = document.getElementById('encode-input-area');
    if (!area) return;
    area.value = btoa(unescape(encodeURIComponent(area.value)));
}

function decodeBase64Tool() {
    const area = document.getElementById('encode-input-area');
    if (!area) return;
    try {
        area.value = decodeURIComponent(escape(atob(area.value.trim())));
    } catch (_) {
        showToast('Base64 inválido', 'error');
    }
}

function encodeUrlTool() {
    const area = document.getElementById('encode-input-area');
    if (area) area.value = encodeURIComponent(area.value);
}

function decodeUrlTool() {
    const area = document.getElementById('encode-input-area');
    if (!area) return;
    try {
        area.value = decodeURIComponent(area.value);
    } catch (_) {
        showToast('URL codificada inválida', 'error');
    }
}

function decodeJwtTool() {
    const area = document.getElementById('encode-input-area');
    if (!area) return;
    try {
        const parts = area.value.trim().split('.');
        if (parts.length < 2) throw new Error('Formato JWT incorrecto');
        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        area.value = JSON.stringify({ header, payload }, null, 2);
    } catch (err) {
        showToast(`Error JWT: ${err.message}`, 'error');
    }
}

function convertNumberBases(sourceBase) {
    const dec = document.getElementById('num-dec');
    const hex = document.getElementById('num-hex');
    const bin = document.getElementById('num-bin');
    const raw = sourceBase === 10 ? dec?.value : sourceBase === 16 ? hex?.value : bin?.value;
    const val = parseBaseValue(raw, sourceBase);
    if (val === null) return;
    if (sourceBase !== 10 && dec) dec.value = val.toString(10);
    if (sourceBase !== 16 && hex) hex.value = val.toString(16).toUpperCase();
    if (sourceBase !== 2 && bin) bin.value = val.toString(2);
}

function calculateSubnet() {
    const cidr = document.getElementById('subnet-cidr-input')?.value || '';
    const out = document.getElementById('subnet-output');
    if (!out) return;
    const res = calcSubnetCore(cidr);
    if (!res) {
        out.textContent = 'CIDR inválido (ej. 192.168.1.0/24)';
        return;
    }
    out.textContent = `Red: ${res.network} | Broadcast: ${res.broadcast} | Máscara: ${res.mask} | Hosts útiles: ${res.usableHosts}`;
}

function copyBoilerplate(key) {
    const txt = BOILERPLATES[key];
    if (!txt) return;
    navigator.clipboard?.writeText(txt);
    showToast(`Plantilla ${key} copiada`, 'success');
}

function testRegexTool() {
    const pat = document.getElementById('regex-pattern')?.value || '';
    const flags = document.getElementById('regex-flags')?.value || 'g';
    const text = document.getElementById('regex-test-text')?.value || '';
    const out = document.getElementById('regex-output');
    if (!out) return;
    try {
        const rx = new RegExp(pat, flags);
        const matches = [...text.matchAll(rx)].map(m => m[0]);
        out.textContent = matches.length ? `Coincidencias (${matches.length}): ${matches.join(', ')}` : 'Sin coincidencias';
    } catch (err) {
        out.textContent = `Regex inválida: ${err.message}`;
    }
}

function generateUuidTool() {
    const out = document.getElementById('gen-output-box');
    if (!out) return;
    const val = crypto.randomUUID();
    out.textContent = val;
    navigator.clipboard?.writeText(val);
    showToast('UUID v4 generado y copiado', 'success');
}

function generateSecurePassword() {
    const out = document.getElementById('gen-output-box');
    if (!out) return;
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-';
    const arr = new Uint32Array(20);
    crypto.getRandomValues(arr);
    const pwd = [...arr].map(x => chars[x % chars.length]).join('');
    out.textContent = pwd;
    navigator.clipboard?.writeText(pwd);
    showToast('Contraseña de 20 caracteres copiada', 'success');
}

async function generateSha256Tool() {
    const inp = document.getElementById('hash-input-text')?.value || '';
    const out = document.getElementById('gen-output-box');
    if (!out) return;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inp));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = hex;
}

function addServer() {
    const name = (document.getElementById('srv-name')?.value || '').trim();
    const host = (document.getElementById('srv-host')?.value || '').trim();
    const role = (document.getElementById('srv-role')?.value || '').trim();
    const url = sanitizeUrl(document.getElementById('srv-url')?.value || '');
    if (!name || !host) return;
    state.servers.push({ id: generateId('srv'), name, host, role, url });
    document.getElementById('srv-name').value = '';
    document.getElementById('srv-host').value = '';
    document.getElementById('srv-role').value = '';
    document.getElementById('srv-url').value = '';
    toggleForm('form-add-server');
    saveState(false);
    renderServers();
}

function renderServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    list.innerHTML = '';
    (state.servers || []).forEach(s => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `🖥️ ${s.name} (${s.host})${s.role ? ` · ${s.role}` : ''}`;
        const acts = document.createElement('div');
        acts.className = 'filter-pills-row';
        if (s.url) {
            const link = document.createElement('a');
            link.href = s.url;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            link.className = 'btn-cyan btn-sm';
            link.textContent = 'Abrir';
            acts.appendChild(link);
        }
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '🗑️';
        del.addEventListener('click', () => { state.servers = state.servers.filter(x => x.id !== s.id); saveState(false); renderServers(); });
        acts.appendChild(del);
        row.append(info, acts);
        list.appendChild(row);
    });
}

function addSnippet() {
    const title = (document.getElementById('snp-title')?.value || '').trim();
    const tag = (document.getElementById('snp-tag')?.value || '').trim();
    const code = (document.getElementById('snp-code')?.value || '').trim();
    if (!title || !code) return;
    state.snippets.unshift({ id: generateId('snp'), title, tag, code });
    document.getElementById('snp-title').value = '';
    document.getElementById('snp-tag').value = '';
    document.getElementById('snp-code').value = '';
    toggleForm('form-add-snippet');
    saveState(false);
    renderSnippets();
}

function renderSnippets() {
    const list = document.getElementById('snippets-list');
    const q = (document.getElementById('snippet-search-input')?.value || '').toLowerCase();
    if (!list) return;
    list.innerHTML = '';
    (state.snippets || [])
        .filter(s => !q || s.title.toLowerCase().includes(q) || (s.tag || '').toLowerCase().includes(q) || s.code.toLowerCase().includes(q))
        .forEach(s => {
            const row = document.createElement('div');
            row.className = 'grade-item-row';
            const info = document.createElement('span');
            info.textContent = `⚡ ${s.title}${s.tag ? ` [${s.tag}]` : ''}: ${s.code}`;
            const acts = document.createElement('div');
            acts.className = 'filter-pills-row';
            const cp = document.createElement('button');
            cp.type = 'button';
            cp.className = 'btn-cyan btn-sm';
            cp.textContent = 'Copiar';
            cp.addEventListener('click', () => { navigator.clipboard?.writeText(s.code); showToast('Comando copiado', 'success'); });
            const del = document.createElement('button');
            del.type = 'button';
            del.className = 'btn-icon';
            del.textContent = '🗑️';
            del.addEventListener('click', () => { state.snippets = state.snippets.filter(x => x.id !== s.id); saveState(false); renderSnippets(); });
            acts.append(cp, del);
            row.append(info, acts);
            list.appendChild(row);
        });
}

function addBookmark() {
    const name = (document.getElementById('bm-name')?.value || '').trim();
    const url = sanitizeUrl(document.getElementById('bm-url')?.value || '');
    if (!name || !url) {
        showToast('Nombre o URL inválida', 'error');
        return;
    }
    state.bookmarks.push({ id: generateId('bm'), name, url });
    document.getElementById('bm-name').value = '';
    document.getElementById('bm-url').value = '';
    toggleForm('form-add-bookmark');
    saveState(false);
    renderBookmarks();
}

function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;
    list.innerHTML = '';
    (state.bookmarks || []).forEach(b => {
        const chip = document.createElement('div');
        chip.className = 'pill-btn';
        const link = document.createElement('a');
        link.href = b.url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = `🔗 ${b.name}`;
        const del = document.createElement('button');
        del.type = 'button';
        del.className = 'btn-icon';
        del.textContent = '×';
        del.addEventListener('click', () => { state.bookmarks = state.bookmarks.filter(x => x.id !== b.id); saveState(false); renderBookmarks(); });
        chip.append(link, del);
        list.appendChild(chip);
    });
}

function createBackupSnapshot() {
    state.snapshots.unshift({
        id: generateId('snap'),
        createdAt: getEffectiveNowMs(),
        data: JSON.stringify(buildCompactVaultSnapshot())
    });
    state.snapshots = state.snapshots.slice(0, MAX_SNAPSHOTS);
    saveState(false);
    renderSnapshotsList();
    showToast('Snapshot local creado', 'success');
}

function renderSnapshotsList() {
    const list = document.getElementById('snapshots-list');
    if (!list) return;
    list.innerHTML = '';
    (state.snapshots || []).forEach(snap => {
        const row = document.createElement('div');
        row.className = 'grade-item-row';
        const info = document.createElement('span');
        info.textContent = `📸 ${new Date(snap.createdAt).toLocaleString('es-ES')}`;
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn-cyan btn-sm';
        btn.textContent = 'Restaurar';
        btn.addEventListener('click', () => {
            const parsed = JSON.parse(snap.data);
            const drv = { ...state.drive };
            state = normalizeStateShape(parsed);
            state.drive = drv;
            saveState(false);
            applyAllVisualSettings();
            renderAll();
            showToast('Snapshot restaurado', 'success');
        });
        row.append(info, btn);
        list.appendChild(row);
    });
}

function openGlobalSearch() {
    document.getElementById('global-search-modal').style.display = 'flex';
    const inp = document.getElementById('global-search-input');
    if (inp) {
        inp.value = '';
        inp.focus();
    }
    handleGlobalSearchInput();
}

function closeGlobalSearch() {
    document.getElementById('global-search-modal').style.display = 'none';
}

function handleGlobalSearchInput() {
    const q = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
    const box = document.getElementById('global-search-results');
    if (!box) return;
    box.innerHTML = '';

    const items = [];
    (state.tasks || []).forEach(t => items.push({ label: `✅ Tarea: ${t.text}`, action: () => switchWorkspace('cockpit') }));
    (state.deliveries || []).forEach(d => items.push({ label: `📅 Entrega: ${d.subject} - ${d.title}`, action: () => switchWorkspace('cockpit') }));
    (state.snippets || []).forEach(s => items.push({ label: `⚡ Snippet: ${s.title}`, action: () => switchWorkspace('devlab') }));
    (state.catalogSubjects || []).forEach(s => items.push({ label: `📚 Asignatura: ${s.name}`, action: () => switchWorkspace('academy') }));

    globalSearchMatches = items.filter(it => !q || it.label.toLowerCase().includes(q)).slice(0, 15);
    globalSearchMatches.forEach(m => {
        const div = document.createElement('div');
        div.className = 'grade-item-row';
        div.style.cursor = 'pointer';
        div.textContent = m.label;
        div.addEventListener('click', () => { m.action(); closeGlobalSearch(); });
        box.appendChild(div);
    });
}

function handleGlobalSearchKey(e) {
    if (e.key === 'Escape') closeGlobalSearch();
    if (e.key === 'Enter' && globalSearchMatches[0]) {
        globalSearchMatches[0].action();
        closeGlobalSearch();
    }
}

function openShortcutsModal() {
    document.getElementById('shortcuts-modal').style.display = 'flex';
}

function closeShortcutsModal() {
    document.getElementById('shortcuts-modal').style.display = 'none';
}

function toggleWeatherBadge() {
    state.ui.weatherEnabled = !state.ui.weatherEnabled;
    const lbl = document.getElementById('weather-text');
    if (lbl) lbl.textContent = state.ui.weatherEnabled ? 'Clima: Activo' : 'Clima: OFF';
    saveState(false);
}

function requestDesktopNotifications() {
    if (typeof Notification === 'undefined') {
        showToast('Notificaciones no soportadas en este navegador', 'error');
        return;
    }
    Notification.requestPermission().then(perm => {
        showToast(perm === 'granted' ? 'Alertas activadas' : 'Permiso de alertas denegado');
    });
}

function triggerPwaInstall() {
    if (deferredInstallPrompt) {
        deferredInstallPrompt.prompt();
        deferredInstallPrompt = null;
    } else {
        showToast('Usa "Instalar aplicación" en el menú de tu navegador');
    }
}

function applyServiceWorkerUpdate() {
    if (pendingServiceWorker) {
        pendingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
    }
}

function renderAll() {
    populateSubjectSelects();
    renderCatalogSubjects();
    renderSchedule();
    renderDeliveries();
    renderTasks();
    refreshPomodoroTaskSelector();
    renderPomodoroStats();
    updatePomodoroDisplay();
    switchNoteTab(state.ui.noteTab || 'general');
    syncStudioEditorsFromState();
    renderSavedStudioProjects();
    switchStudioTab(state.ui.studioActiveTab || 'html');
    renderDbWorkspace();
    renderKanban();
    renderGrades();
    renderFlashcards();
    renderBugLogs();
    renderClassDoubts();
    renderProjects();
    renderServers();
    renderSnippets();
    renderBookmarks();
    renderSnapshotsList();
    renderGoogleFontFavorites();
    renderCustomThemesList();
    updateStorageQuotaBadge();
}

function initApp() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            state = normalizeStateShape(JSON.parse(raw));
        }
    } catch (_) {
        state = createDefaultState();
    }

    currentDeliveryFilter = state.ui.deliveryFilter || 'all';
    applyAllVisualSettings();
    renderAll();

    updateClockDisplay();
    syncRealTimeNetwork();
    if (clockTickInterval) clearInterval(clockTickInterval);
    clockTickInterval = setInterval(updateClockDisplay, 1000);

    window.addEventListener('message', ev => {
        if (ev.data?.source === 'dw-studio-console') {
            appendStudioConsoleLine(ev.data.level || 'log', ev.data.message || '');
        }
    });

    window.addEventListener('keydown', e => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if (e.altKey && ['1', '2', '3', '4', '5', '6'].includes(e.key)) {
            e.preventDefault();
            switchWorkspace(ALLOWED_WORKSPACES[Number(e.key) - 1]);
        }
    });

    window.addEventListener('beforeinstallprompt', e => {
        e.preventDefault();
        deferredInstallPrompt = e;
        document.getElementById('btn-pwa-install')?.classList.remove('is-hidden');
    });

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./sw.js').then(reg => {
            reg.addEventListener('updatefound', () => {
                const nw = reg.installing;
                nw?.addEventListener('statechange', () => {
                    if (nw.state === 'installed' && navigator.serviceWorker.controller) {
                        pendingServiceWorker = nw;
                        document.getElementById('pwa-update-banner')?.classList.remove('is-hidden');
                    }
                });
            });
        }).catch(() => {});
    }
}

window.addEventListener('DOMContentLoaded', initApp);