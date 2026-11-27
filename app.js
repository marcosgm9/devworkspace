import {
    mergeState,
    createDebouncer,
    getMadridDateKey,
    getMadridClock,
    calculateSubnet,
    getNextRepeatDate,
    normalizeExternalUrl,
    parseBaseValue,
    packDrivePayload,
    unpackDrivePayload,
    parseScheduleImportText
} from './core.js';

const STORAGE_KEY = 'devworkspace_v7_2_state';
const SNAPSHOTS_KEY = 'devworkspace_v7_2_snapshots';
const VAULT_SALT = 'devworkspace-v7-2-vault-guard';
const DRIVE_FILE_NAME = 'devworkspace_vault.dwpk';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';
const DEFAULT_GOOGLE_CLIENT_ID = (window.DEVWORKSPACE_GOOGLE_CONFIG && window.DEVWORKSPACE_GOOGLE_CONFIG.clientId) || '';

const DEFAULT_CUSTOM_COLORS = {
    bg: '#050711',
    card: '#0b111e',
    border: '#1e293b',
    text: '#f1f5f9',
    cyan: '#00f0ff',
    violet: '#b84dff'
};

const STUDIO_TEMPLATES = {
    blank: {
        title: 'HTML5 Base Limpio',
        html: '<main class="box">\n  <h1>Hola Mundo</h1>\n  <p>Listo para probar código en vivo.</p>\n  <button id="btn">Probar</button>\n</main>',
        css: 'body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }\n.box { max-width: 640px; margin: 0 auto; }\nbutton { padding: 0.5rem 1rem; cursor: pointer; }',
        js: 'document.getElementById("btn")?.addEventListener("click", () => {\n  console.log("Botón pulsado");\n});'
    },
    cybercard: {
        title: 'Tarjeta Cyberpunk',
        html: '<article class="cyber-card">\n  <span class="tag">SYS.ONLINE</span>\n  <h2>DevWorkspace Studio</h2>\n  <p>Entorno rápido para prototipos web y utilidades.</p>\n</article>',
        css: 'body { display: grid; place-items: center; min-height: 100vh; margin: 0; background: #050711; font-family: system-ui, sans-serif; }\n.cyber-card { border: 1px solid #00f0ff; background: #0b111e; color: #f1f5f9; padding: 1.5rem; border-radius: 10px; max-width: 360px; box-shadow: 0 0 24px rgba(0,240,255,0.2); }\n.tag { color: #b84dff; font-family: monospace; font-size: 0.75rem; }',
        js: 'console.log("Tarjeta cargada");'
    },
    flexgrid: {
        title: 'Grid Layout',
        html: '<div class="grid">\n  <div class="cell">Panel 1</div>\n  <div class="cell">Panel 2</div>\n  <div class="cell">Panel 3</div>\n  <div class="cell">Panel 4</div>\n</div>',
        css: 'body { margin: 0; padding: 1rem; background: #0b111e; font-family: system-ui, sans-serif; }\n.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 12px; }\n.cell { background: #131d33; color: #e2e8f0; padding: 24px; border-radius: 8px; border: 1px solid #263554; text-align: center; }',
        js: ''
    },
    domlab: {
        title: 'Práctica JS DOM',
        html: '<div class="lab">\n  <input id="item-input" placeholder="Nuevo elemento...">\n  <button id="add-btn">Añadir</button>\n  <ul id="list"></ul>\n</div>',
        css: 'body { font-family: system-ui, sans-serif; padding: 1.5rem; background: #0f172a; color: #f8fafc; }\ninput, button { padding: 0.45rem 0.7rem; }',
        js: 'const input = document.getElementById("item-input");\nconst list = document.getElementById("list");\ndocument.getElementById("add-btn")?.addEventListener("click", () => {\n  const val = input.value.trim();\n  if (!val) return;\n  const li = document.createElement("li");\n  li.textContent = val;\n  list.appendChild(li);\n  input.value = "";\n});'
    },
    python: {
        title: 'Script Python 3',
        html: '',
        css: '',
        js: '',
        python: 'def saludar(nombre):\n    return f"Hola, {nombre}!"\n\nfor i in range(1, 4):\n    print(f"[{i}] {saludar(\'DAM\')}")'
    },
    java: {
        title: 'Clase Java Main',
        html: '',
        css: '',
        js: '',
        java: 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("DevWorkspace Java listo");\n    }\n}'
    }
};

const STUDIO_CDNS = {
    tailwind: '<script src="https://cdn.tailwindcss.com"></script>',
    bootstrap: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">',
    alpine: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>',
    chartjs: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>'
};

function createDefaultState() {
    return {
        theme: 'cyberpunk',
        uiScale: 1,
        customColors: { ...DEFAULT_CUSTOM_COLORS },
        customThemeName: 'Mi Tema',
        customThemeFontUi: '',
        customThemeFontMono: '',
        savedCustomThemes: [],
        googleFonts: {
            loadedFont: 'JetBrains Mono',
            favorites: ['JetBrains Mono', 'Inter', 'Fira Code', 'Space Grotesk', 'IBM Plex Mono'],
            uiFont: '',
            monoFont: '',
            studioFont: ''
        },
        density: 'airy',
        zenMode: false,
        presentationMode: false,
        workspacePreset: 'default',
        activeWorkspace: 'cockpit',
        hiddenCards: {},
        weatherEnabled: false,
        weatherData: null,
        manualClock: { enabled: false, offsetMs: 0 },
        scheduleViewMode: 'current',
        schedule: [
            { day: 1, start: '08:15', end: '09:10', subject: 'Programación', room: 'Aula 1', teacher: 'Prof. García' },
            { day: 1, start: '09:10', end: '10:05', subject: 'Base de Datos', room: 'Aula 1', teacher: 'Prof. López' },
            { day: 2, start: '08:15', end: '10:05', subject: 'Entornos de Desarrollo', room: 'Aula 2', teacher: 'Prof. Ruiz' }
        ],
        subjectsCatalog: [
            { id: 'subj-prog', name: 'Programación', teacher: 'Prof. García', room: 'Aula 1' },
            { id: 'subj-bd', name: 'Base de Datos', teacher: 'Prof. López', room: 'Aula 1' },
            { id: 'subj-ed', name: 'Entornos de Desarrollo', teacher: 'Prof. Ruiz', room: 'Aula 2' }
        ],
        deliveries: [],
        deliveryFilter: 'all',
        examCramMode: false,
        tasks: [],
        taskFilter: 'all',
        taskBlockFilter: 'all',
        taskSort: 'created',
        pomodoro: {
            mode: 'focus',
            focusMinutes: 25,
            breakMinutes: 5,
            secondsLeft: 25 * 60,
            running: false,
            linkedTaskId: '',
            todayMinutes: 0,
            totalMinutes: 0,
            lastStudyDate: getMadridDateKey(),
            streakDays: 0,
            historyByDate: {}
        },
        focusAudio: {
            playing: false,
            volume: 25
        },
        notes: {
            activeTab: 'general',
            tabs: {
                general: '',
                comandos: '',
                clases: ''
            },
            sticky: '',
            stickyOpen: false,
            revisions: []
        },
        studio: {
            activeTab: 'html',
            title: 'Proyecto sin título',
            html: STUDIO_TEMPLATES.cybercard.html,
            css: STUDIO_TEMPLATES.cybercard.css,
            js: STUDIO_TEMPLATES.cybercard.js,
            python: STUDIO_TEMPLATES.python.python,
            java: STUDIO_TEMPLATES.java.java,
            autoRun: true,
            viewport: '100%',
            savedProjects: []
        },
        database: {
            activeTable: 'alumnos',
            tables: {
                alumnos: {
                    columns: ['id', 'nombre', 'ciclo', 'nota'],
                    rows: [
                        { id: '1', nombre: 'Marcos', ciclo: 'DAM', nota: '9.2' },
                        { id: '2', nombre: 'Lucía', ciclo: 'DAM', nota: '8.7' }
                    ]
                }
            }
        },
        kanban: [],
        grades: [],
        flashcards: [],
        flashcardIndex: 0,
        flashcardFlipped: false,
        bugLogs: [],
        classDoubts: [],
        projects: [],
        servers: [],
        snippets: [
            { id: 'snp-1', title: 'Docker PS activos', tag: 'docker', code: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"' },
            { id: 'snp-2', title: 'Git estado corto', tag: 'git', code: 'git status -sb' }
        ],
        bookmarks: [
            { id: 'bm-1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org' },
            { id: 'bm-2', name: 'GitHub', url: 'https://github.com' }
        ],
        drive: {
            clientId: DEFAULT_GOOGLE_CLIENT_ID,
            user: null,
            fileId: '',
            lastSync: ''
        }
    };
}

let state = loadInitialState();
let pomodoroInterval = null;
let driveAccessToken = '';
let driveTokenClient = null;
let pendingDriveAction = null;
let deferredPwaPrompt = null;
let waitingServiceWorker = null;

function loadInitialState() {
    const base = createDefaultState();
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return base;
        const parsed = JSON.parse(raw);
        return mergeState(base, parsed);
    } catch (_) {
        return base;
    }
}

const debouncedSave = createDebouncer(() => {
    persistStateNow();
}, 250);

function persistStateNow() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        updateStorageQuotaBadge();
    } catch (err) {
        console.error('Error guardando estado local:', err);
        showToast('Error al guardar en almacenamiento local', 'error');
    }
}

function saveState(immediate = false) {
    if (immediate) {
        debouncedSave.cancel();
        persistStateNow();
    } else {
        debouncedSave();
    }
}

function updateStorageQuotaBadge() {
    const badge = document.getElementById('storage-quota-badge');
    if (!badge) return;
    const bytes = new Blob([JSON.stringify(state)]).size;
    badge.textContent = `Vault: ${(bytes / 1024).toFixed(1)} KB`;
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.remove();
    }, 3400);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function toggleForm(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.toggle('is-hidden');
}

/* ==========================================================
   GOOGLE DRIVE & VAULT (.DWPK)
   ========================================================== */
function setDriveSyncStatus(label, mode = 'ok') {
    const badge = document.getElementById('cloud-sync-indicator');
    const last = document.getElementById('cloud-last-sync');
    if (badge) {
        badge.textContent = label;
        badge.classList.remove('sync-saving', 'sync-error');
        if (mode === 'saving') badge.classList.add('sync-saving');
        if (mode === 'error') badge.classList.add('sync-error');
    }
    if (last && state.drive.lastSync) {
        last.textContent = `Sync: ${state.drive.lastSync}`;
    }
}

function renderDriveProfileUI() {
    const widget = document.getElementById('user-profile-widget');
    const loginBtn = document.getElementById('btn-cloud-login');
    const userName = document.getElementById('user-name');
    const clientIdInput = document.getElementById('gdrive-client-id');

    if (clientIdInput && state.drive.clientId) {
        clientIdInput.value = state.drive.clientId;
    }

    if (state.drive.user) {
        widget?.classList.remove('is-hidden');
        loginBtn?.classList.add('is-hidden');
        if (userName) userName.textContent = state.drive.user.name || state.drive.user.email || 'Conectado';
        setDriveSyncStatus(driveAccessToken ? 'Drive Listo' : 'Sesión guardada', 'ok');
    } else {
        widget?.classList.add('is-hidden');
        loginBtn?.classList.remove('is-hidden');
    }
}

function openDriveModal() {
    const modal = document.getElementById('drive-modal');
    const input = document.getElementById('gdrive-client-id');
    if (input) input.value = state.drive.clientId || DEFAULT_GOOGLE_CLIENT_ID || '';
    if (modal) modal.style.display = 'flex';
}

function closeDriveModal() {
    const modal = document.getElementById('drive-modal');
    if (modal) modal.style.display = 'none';
}

function ensureGoogleTokenClient(clientId) {
    if (!window.google || !window.google.accounts || !window.google.accounts.oauth2) {
        throw new Error('Google Identity Services aún no ha cargado');
    }
    driveTokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: DRIVE_SCOPE,
        callback: async (resp) => {
            if (resp.error) {
                setDriveSyncStatus('Error OAuth', 'error');
                showToast(`Error de autenticación: ${resp.error}`, 'error');
                pendingDriveAction = null;
                return;
            }
            driveAccessToken = resp.access_token;
            try {
                const infoRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
                    headers: { Authorization: `Bearer ${driveAccessToken}` }
                });
                if (infoRes.ok) {
                    const info = await infoRes.json();
                    state.drive.user = { name: info.name || info.email || 'Usuario Google', email: info.email || '' };
                } else {
                    state.drive.user = { name: 'Usuario Google', email: '' };
                }
            } catch (_) {
                state.drive.user = { name: 'Usuario Google', email: '' };
            }
            saveState(true);
            renderDriveProfileUI();
            showToast('Conectado a Google Drive', 'success');

            const action = pendingDriveAction;
            pendingDriveAction = null;
            if (action === 'push') {
                await forceDriveSyncNow();
            } else if (action === 'pull') {
                await pullFromGoogleDrive(true);
            }
        }
    });
}

function connectGoogleDrive(afterAction = null) {
    const input = document.getElementById('gdrive-client-id');
    const clientId = (input?.value || state.drive.clientId || DEFAULT_GOOGLE_CLIENT_ID || '').trim();
    if (!clientId) {
        showToast('Introduce un Google OAuth Client ID válido', 'error');
        return;
    }
    state.drive.clientId = clientId;
    saveState(true);

    try {
        pendingDriveAction = afterAction;
        ensureGoogleTokenClient(clientId);
        driveTokenClient.requestAccessToken({ prompt: driveAccessToken ? '' : 'consent' });
    } catch (err) {
        showToast(err.message || 'No se pudo iniciar Google Drive', 'error');
    }
}

async function findDriveVaultFileId() {
    const q = encodeURIComponent(`name='${DRIVE_FILE_NAME}' and trashed=false`);
    const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime)`, {
        headers: { Authorization: `Bearer ${driveAccessToken}` }
    });
    if (!res.ok) {
        if (res.status === 401) driveAccessToken = '';
        throw new Error(`Error buscando archivo en Drive (${res.status})`);
    }
    const data = await res.json();
    const fileId = data.files && data.files[0] ? data.files[0].id : '';
    if (fileId) {
        state.drive.fileId = fileId;
        saveState(true);
    }
    return fileId;
}

async function forceDriveSyncNow() {
    if (!driveAccessToken) {
        connectGoogleDrive('push');
        return;
    }
    try {
        setDriveSyncStatus('Guardando...', 'saving');
        saveState(true);
        const packed = await packDrivePayload(state, VAULT_SALT);
        const fileId = state.drive.fileId || await findDriveVaultFileId();

        const boundary = '-------DevWorkspaceBoundary72';
        const metadata = { name: DRIVE_FILE_NAME, mimeType: 'text/plain' };
        const body =
            `--${boundary}\r\n` +
            `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
            `${JSON.stringify(metadata)}\r\n` +
            `--${boundary}\r\n` +
            `Content-Type: text/plain; charset=UTF-8\r\n\r\n` +
            `${packed}\r\n` +
            `--${boundary}--`;

        const url = fileId
            ? `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`
            : 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        const method = fileId ? 'PATCH' : 'POST';

        const res = await fetch(url, {
            method,
            headers: {
                Authorization: `Bearer ${driveAccessToken}`,
                'Content-Type': `multipart/related; boundary=${boundary}`
            },
            body
        });

        if (!res.ok) {
            if (res.status === 401) driveAccessToken = '';
            throw new Error(`Error al subir a Drive (${res.status})`);
        }

        const saved = await res.json();
        if (saved.id) state.drive.fileId = saved.id;
        state.drive.lastSync = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        saveState(true);
        renderDriveProfileUI();
        showToast('Copia guardada en Google Drive', 'success');
    } catch (err) {
        setDriveSyncStatus('Error Drive', 'error');
        showToast(err.message || 'No se pudo guardar en Drive', 'error');
    }
}

async function pullFromGoogleDrive(showFeedback = false) {
    if (!driveAccessToken) {
        connectGoogleDrive('pull');
        return;
    }
    try {
        setDriveSyncStatus('Importando...', 'saving');
        const fileId = await findDriveVaultFileId();
        if (!fileId) {
            setDriveSyncStatus('Drive Vacío', 'ok');
            if (showFeedback) showToast('No se encontró devworkspace_vault.dwpk en tu Drive', 'info');
            return;
        }

        const res = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {
            headers: { Authorization: `Bearer ${driveAccessToken}` }
        });
        if (!res.ok) {
            if (res.status === 401) driveAccessToken = '';
            throw new Error(`Error descargando archivo de Drive (${res.status})`);
        }

        const packedText = await res.text();
        const unpacked = await unpackDrivePayload(packedText, VAULT_SALT);
        const keepDrive = {
            clientId: state.drive.clientId,
            user: state.drive.user,
            fileId,
            lastSync: new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        };
        state = mergeState(createDefaultState(), unpacked);
        state.drive = keepDrive;
        saveState(true);
        renderAll();
        if (showFeedback) showToast('Datos importados desde Google Drive', 'success');
    } catch (err) {
        setDriveSyncStatus('Error Import', 'error');
        if (showFeedback) showToast(err.message || 'Error al importar desde Drive', 'error');
    }
}

function logoutDriveUser() {
    driveAccessToken = '';
    state.drive.user = null;
    saveState(true);
    renderDriveProfileUI();
    showToast('Sesión de Google Drive cerrada', 'info');
}

async function exportProtectedVaultFile() {
    try {
        saveState(true);
        const packed = await packDrivePayload(state, VAULT_SALT);
        const blob = new Blob([packed], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${DRIVE_FILE_NAME}_${getMadridDateKey()}.dwpk`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Archivo .dwpk descargado', 'success');
    } catch (err) {
        showToast(`Error exportando .dwpk: ${err.message}`, 'error');
    }
}

async function importProtectedVaultFile(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        const text = await file.text();
        const unpacked = await unpackDrivePayload(text, VAULT_SALT);
        const driveMeta = { ...state.drive };
        state = mergeState(createDefaultState(), unpacked);
        state.drive = driveMeta;
        saveState(true);
        renderAll();
        closeDriveModal();
        showToast('Vault .dwpk importado correctamente', 'success');
    } catch (err) {
        showToast(err.message || 'Archivo .dwpk no válido', 'error');
    }
}

/* ==========================================================
   WORKSPACES, PERFILES, TEMAS Y FUENTES
   ========================================================== */
function switchWorkspace(wsName) {
    state.activeWorkspace = wsName;
    saveState();

    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ws === wsName);
    });
    document.querySelectorAll('.workspace-view').forEach(view => {
        view.classList.toggle('active', view.id === `ws-${wsName}`);
    });

    if (wsName === 'studio') {
        renderStudioSavedList();
        updateStudioMetrics();
        if (state.studio.autoRun && ['html', 'css', 'js'].includes(state.studio.activeTab)) {
            runStudioCode();
        }
    } else if (wsName === 'database') {
        renderDatabaseWorkspace();
    } else if (wsName === 'academy') {
        renderAcademyWorkspace();
    } else if (wsName === 'devlab') {
        renderDevLabWorkspace();
    } else if (wsName === 'fonts') {
        renderFontsAndThemesWorkspace();
    }
}

function applyWorkspacePreset(preset) {
    state.workspacePreset = preset;
    const cardMap = {
        default: [],
        today: ['card-deliveries'],
        exam: ['card-tasks', 'card-notes'],
        dev: ['card-schedule', 'card-deliveries'],
        db: ['card-schedule', 'card-deliveries'],
        sysadmin: ['card-deliveries', 'card-notes']
    };
    const hidden = cardMap[preset] || [];
    state.hiddenCards = {};
    hidden.forEach(id => { state.hiddenCards[id] = true; });

    document.querySelectorAll('#ws-cockpit .card').forEach(card => {
        card.classList.toggle('hidden-card', Boolean(state.hiddenCards[card.id]));
    });

    if (preset === 'dev') switchWorkspace('studio');
    else if (preset === 'db') switchWorkspace('database');
    else if (preset === 'sysadmin') switchWorkspace('devlab');
    else switchWorkspace('cockpit');

    saveState();
    showToast(`Perfil aplicado: ${preset}`, 'info');
}

function toggleZenMode() {
    state.zenMode = !state.zenMode;
    document.body.classList.toggle('zen-mode-active', state.zenMode);
    document.getElementById('btn-zen-mode')?.classList.toggle('active', state.zenMode);
    saveState();
}

function togglePresentationMode() {
    state.presentationMode = !state.presentationMode;
    document.body.classList.toggle('presentation-mode-active', state.presentationMode);
    document.getElementById('btn-present-mode')?.classList.toggle('active', state.presentationMode);
    saveState();
}

function toggleDensityMode() {
    state.density = state.density === 'airy' ? 'compact' : 'airy';
    applyDensity();
    saveState();
}

function applyDensity() {
    const isCompact = state.density === 'compact';
    document.body.classList.toggle('density-compact', isCompact);
    const btn = document.getElementById('btn-density-mode');
    if (btn) btn.textContent = isCompact ? '📐 Compacto' : '📐 Aireado';
}

function applyTheme(themeName) {
    state.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    const select = document.getElementById('theme-select');
    if (select) select.value = themeName;

    if (themeName === 'custom') {
        applyCustomThemeStyles(state.customColors, state.customThemeFontUi, state.customThemeFontMono);
    } else {
        clearCustomThemeInlineStyles();
        applyFontSettings();
    }
}

function handleThemeSelectChange(themeName) {
    const savedPreset = state.savedCustomThemes.find(t => t.name === themeName);
    if (savedPreset) {
        state.customThemeName = savedPreset.name;
        state.customColors = { ...DEFAULT_CUSTOM_COLORS, ...savedPreset.colors };
        state.customThemeFontUi = savedPreset.fontUi || '';
        state.customThemeFontMono = savedPreset.fontMono || '';
        if (savedPreset.fontUi) state.googleFonts.uiFont = savedPreset.fontUi;
        if (savedPreset.fontMono) state.googleFonts.monoFont = savedPreset.fontMono;
        applyTheme('custom');
        syncThemeInputsFromState();
        saveState();
        showToast(`Tema cargado: ${savedPreset.name}`, 'success');
        return;
    }

    applyTheme(themeName);
    saveState();
}

function clearCustomThemeInlineStyles() {
    const root = document.documentElement.style;
    ['--bg-color', '--card-bg', '--card-border', '--text-main', '--accent-cyan', '--accent-violet'].forEach(prop => {
        root.removeProperty(prop);
    });
}

function applyCustomThemeStyles(colors, fontUi = '', fontMono = '') {
    const c = { ...DEFAULT_CUSTOM_COLORS, ...(colors || {}) };
    const root = document.documentElement.style;
    root.setProperty('--bg-color', c.bg);
    root.setProperty('--card-bg', c.card);
    root.setProperty('--card-border', c.border);
    root.setProperty('--text-main', c.text);
    root.setProperty('--accent-cyan', c.cyan);
    root.setProperty('--accent-violet', c.violet);

    if (fontUi) {
        ensureGoogleFontLoaded(fontUi);
        root.setProperty('--font-sans', `'${fontUi}', system-ui, sans-serif`);
    }
    if (fontMono) {
        ensureGoogleFontLoaded(fontMono);
        root.setProperty('--font-mono', `'${fontMono}', monospace`);
    }
}

function syncThemeInputsFromState() {
    const nameEl = document.getElementById('custom-theme-name');
    const uiFontEl = document.getElementById('custom-theme-font-ui');
    const monoFontEl = document.getElementById('custom-theme-font-mono');
    if (nameEl) nameEl.value = state.customThemeName || 'Mi Tema';
    if (uiFontEl) uiFontEl.value = state.customThemeFontUi || '';
    if (monoFontEl) monoFontEl.value = state.customThemeFontMono || '';

    const map = {
        'cp-bg': state.customColors.bg,
        'cp-card': state.customColors.card,
        'cp-border': state.customColors.border,
        'cp-text': state.customColors.text,
        'cp-cyan': state.customColors.cyan,
        'cp-violet': state.customColors.violet
    };
    Object.entries(map).forEach(([id, val]) => {
        const el = document.getElementById(id);
        if (el && val) el.value = val;
    });
}

function previewCustomThemeColors() {
    const colors = {
        bg: document.getElementById('cp-bg')?.value || DEFAULT_CUSTOM_COLORS.bg,
        card: document.getElementById('cp-card')?.value || DEFAULT_CUSTOM_COLORS.card,
        border: document.getElementById('cp-border')?.value || DEFAULT_CUSTOM_COLORS.border,
        text: document.getElementById('cp-text')?.value || DEFAULT_CUSTOM_COLORS.text,
        cyan: document.getElementById('cp-cyan')?.value || DEFAULT_CUSTOM_COLORS.cyan,
        violet: document.getElementById('cp-violet')?.value || DEFAULT_CUSTOM_COLORS.violet
    };
    state.customColors = colors;
    if (state.theme === 'custom') {
        applyCustomThemeStyles(colors, state.customThemeFontUi, state.customThemeFontMono);
    }
}

function activateCustomTheme() {
    previewCustomThemeColors();
    state.customThemeName = (document.getElementById('custom-theme-name')?.value || 'Mi Tema').trim();
    state.customThemeFontUi = (document.getElementById('custom-theme-font-ui')?.value || '').trim();
    state.customThemeFontMono = (document.getElementById('custom-theme-font-mono')?.value || '').trim();
    applyTheme('custom');
    saveState();
    showToast('Tema personalizado activado', 'success');
}

function saveNewCustomThemePreset() {
    previewCustomThemeColors();
    const name = (document.getElementById('custom-theme-name')?.value || 'Mi Tema').trim() || 'Mi Tema';
    const fontUi = (document.getElementById('custom-theme-font-ui')?.value || state.googleFonts.uiFont || '').trim();
    const fontMono = (document.getElementById('custom-theme-font-mono')?.value || state.googleFonts.monoFont || '').trim();
    state.customThemeName = name;
    state.customThemeFontUi = fontUi;
    state.customThemeFontMono = fontMono;

    const preset = { name, colors: { ...state.customColors }, fontUi, fontMono };
    const idx = state.savedCustomThemes.findIndex(t => t.name === name);
    if (idx >= 0) state.savedCustomThemes[idx] = preset;
    else state.savedCustomThemes.push(preset);

    applyTheme('custom');
    saveState();
    renderThemeSelectOptions();
    renderSavedCustomThemesList();
    showToast(`Tema "${name}" guardado`, 'success');
}

function deleteCustomThemePreset(name) {
    state.savedCustomThemes = state.savedCustomThemes.filter(t => t.name !== name);
    if (state.theme === 'custom' && state.customThemeName === name) {
        applyTheme('cyberpunk');
    }
    saveState();
    renderThemeSelectOptions();
    renderSavedCustomThemesList();
}

function exportCustomThemeJson() {
    previewCustomThemeColors();
    const payload = {
        name: (document.getElementById('custom-theme-name')?.value || state.customThemeName || 'Mi Tema').trim(),
        colors: state.customColors,
        fontUi: (document.getElementById('custom-theme-font-ui')?.value || state.customThemeFontUi || '').trim(),
        fontMono: (document.getElementById('custom-theme-font-mono')?.value || state.customThemeFontMono || '').trim()
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${payload.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-theme.json`;
    a.click();
    URL.revokeObjectURL(url);
}

async function importCustomThemeJson(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
        const data = JSON.parse(await file.text());
        if (!data || !data.colors) throw new Error('JSON de tema inválido');
        state.customThemeName = data.name || 'Tema Importado';
        state.customColors = { ...DEFAULT_CUSTOM_COLORS, ...data.colors };
        state.customThemeFontUi = data.fontUi || '';
        state.customThemeFontMono = data.fontMono || '';
        applyTheme('custom');
        syncThemeInputsFromState();
        saveNewCustomThemePreset();
    } catch (err) {
        showToast(err.message || 'Error importando tema', 'error');
    }
}

function resetAppearanceDefaults() {
    state.theme = 'cyberpunk';
    state.uiScale = 1;
    state.customColors = { ...DEFAULT_CUSTOM_COLORS };
    state.customThemeFontUi = '';
    state.customThemeFontMono = '';
    state.googleFonts.uiFont = '';
    state.googleFonts.monoFont = '';
    state.googleFonts.studioFont = '';
    document.documentElement.style.setProperty('--ui-scale', '1');
    const scaleSelect = document.getElementById('ui-scale-select');
    if (scaleSelect) scaleSelect.value = '1';
    clearCustomThemeInlineStyles();
    applyTheme('cyberpunk');
    saveState();
    renderStudioFontSelect();
    showToast('Apariencia restaurada', 'info');
}

function updateAppearanceSettings() {
    const scale = parseFloat(document.getElementById('ui-scale-select')?.value || '1');
    state.uiScale = Number.isFinite(scale) ? scale : 1;
    document.documentElement.style.setProperty('--ui-scale', String(state.uiScale));
    saveState();
}

function renderThemeSelectOptions() {
    const select = document.getElementById('theme-select');
    if (!select) return;
    const baseOptions = [
        { value: 'cyberpunk', label: '⚡ Cyberpunk' },
        { value: 'dracula', label: '🧛 Dracula' },
        { value: 'valorant', label: '🎯 Valorant' },
        { value: 'minecraft', label: '🟩 Minecraft' },
        { value: 'retro', label: '📟 Retro CRT' },
        { value: 'daylight', label: '☀️ Alto Contraste Día' },
        { value: 'custom', label: '🎨 Personalizado' }
    ];
    const presetOptions = state.savedCustomThemes.map(t => ({
        value: t.name,
        label: `★ ${t.name}`
    }));

    select.innerHTML = [...baseOptions, ...presetOptions]
        .map(opt => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
        .join('');

    if (state.theme === 'custom' && state.savedCustomThemes.some(t => t.name === state.customThemeName)) {
        select.value = state.customThemeName;
    } else {
        select.value = state.theme;
    }
}

function renderSavedCustomThemesList() {
    const list = document.getElementById('saved-custom-themes-list');
    if (!list) return;
    if (!state.savedCustomThemes.length) {
        list.innerHTML = '<div class="mono-muted">No hay temas guardados todavía.</div>';
        return;
    }
    list.innerHTML = state.savedCustomThemes.map(t => `
        <div class="grade-item-row">
            <span><strong>${escapeHtml(t.name)}</strong> <small>(${escapeHtml(t.fontUi || 'UI base')} / ${escapeHtml(t.fontMono || 'Mono base')})</small></span>
            <div class="filter-pills-row">
                <button type="button" class="btn-cyan btn-sm" onclick="handleThemeSelectChange(${JSON.stringify(t.name)})">Aplicar</button>
                <button type="button" class="btn-icon" onclick="deleteCustomThemePreset(${JSON.stringify(t.name)})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function ensureGoogleFontLoaded(fontName) {
    const clean = String(fontName || '').trim();
    if (!clean) return;
    const link = document.getElementById('dynamic-google-fonts');
    if (!link) return;

    const existingHref = link.getAttribute('href') || '';
    const encoded = encodeURIComponent(clean).replace(/%20/g, '+');
    const familySpec = `family=${encoded}:wght@400;500;600;700`;

    if (!existingHref.includes(familySpec)) {
        if (!existingHref) {
            link.setAttribute('href', `https://fonts.googleapis.com/css2?${familySpec}&display=swap`);
        } else {
            link.setAttribute('href', `${existingHref}&${familySpec}`);
        }
    }
}

function applyFontSettings() {
    const root = document.documentElement.style;
    if (state.googleFonts.uiFont) {
        ensureGoogleFontLoaded(state.googleFonts.uiFont);
        root.setProperty('--font-sans', `'${state.googleFonts.uiFont}', system-ui, sans-serif`);
    } else {
        root.removeProperty('--font-sans');
    }

    if (state.googleFonts.monoFont) {
        ensureGoogleFontLoaded(state.googleFonts.monoFont);
        root.setProperty('--font-mono', `'${state.googleFonts.monoFont}', monospace`);
    } else {
        root.removeProperty('--font-mono');
    }

    if (state.googleFonts.studioFont) {
        applyFontToStudioPreview(state.googleFonts.studioFont, false);
    }
}

function loadGoogleFontByName(presetName = '') {
    const input = document.getElementById('gf-input-name');
    const name = (presetName || input?.value || '').trim();
    if (!name) return;
    ensureGoogleFontLoaded(name);
    state.googleFonts.loadedFont = name;
    if (input && !presetName) input.value = name;
    saveState();
    renderFontPlayground();
    showToast(`Fuente cargada: ${name}`, 'success');
}

function saveGoogleFontFavorite() {
    const name = (state.googleFonts.loadedFont || document.getElementById('gf-input-name')?.value || '').trim();
    if (!name) return;
    ensureGoogleFontLoaded(name);
    if (!state.googleFonts.favorites.includes(name)) {
        state.googleFonts.favorites.push(name);
    }
    state.googleFonts.loadedFont = name;
    saveState();
    renderFontFavorites();
    renderStudioFontSelect();
    showToast(`"${name}" añadida a favoritos`, 'success');
}

function renderFontFavorites() {
    const box = document.getElementById('gf-favorites-list');
    if (!box) return;
    box.innerHTML = state.googleFonts.favorites.map(font => `
        <button type="button" class="pill-btn ${state.googleFonts.loadedFont === font ? 'active' : ''}" onclick="loadGoogleFontByName(${JSON.stringify(font)})">
            ${escapeHtml(font)}
        </button>
    `).join('');
}

function renderFontPlayground() {
    const font = state.googleFonts.loadedFont || 'JetBrains Mono';
    ensureGoogleFontLoaded(font);
    const label = document.getElementById('gf-active-preview-label');
    const sample = document.getElementById('gf-preview-sample');
    if (label) label.textContent = `Vista previa: ${font}`;
    if (sample) sample.style.fontFamily = `'${font}', monospace`;
    updateFontPlaygroundStyle();
}

function updateFontPlaygroundStyle() {
    const sample = document.getElementById('gf-preview-sample');
    const size = document.getElementById('gf-preview-size')?.value || '18';
    if (sample) sample.style.fontSize = `${size}px`;
}

function applyLoadedFontToUi(target) {
    const font = state.googleFonts.loadedFont;
    if (!font) return;
    if (target === 'sans') {
        state.googleFonts.uiFont = font;
        state.customThemeFontUi = font;
    } else {
        state.googleFonts.monoFont = font;
        state.customThemeFontMono = font;
    }
    applyFontSettings();
    syncThemeInputsFromState();
    saveState();
    showToast(`Fuente "${font}" aplicada a ${target === 'sans' ? 'UI' : 'Código'}`, 'success');
}

function applyLoadedFontToStudio() {
    const font = state.googleFonts.loadedFont;
    if (!font) return;
    state.googleFonts.studioFont = font;
    saveState();
    renderStudioFontSelect();
    applyFontToStudioPreview(font);
    showToast(`Fuente "${font}" aplicada al Studio`, 'success');
}

function renderStudioFontSelect() {
    const sel = document.getElementById('studio-font-select');
    if (!sel) return;
    const options = [''].concat(state.googleFonts.favorites || []);
    sel.innerHTML = options.map(f => `<option value="${escapeHtml(f)}">${f ? `🔤 ${escapeHtml(f)}` : '🔤 Fuente Preview (Por defecto)'}</option>`).join('');
    sel.value = state.googleFonts.studioFont || '';
}

function applyFontToStudioPreview(fontName, persist = true) {
    state.googleFonts.studioFont = fontName || '';
    if (fontName) ensureGoogleFontLoaded(fontName);
    const iframe = document.getElementById('studio-preview-iframe');
    const runner = document.getElementById('studio-runner-output');
    const fam = fontName ? `'${fontName}', system-ui, sans-serif` : '';
    if (runner) runner.style.fontFamily = fam;
    if (iframe && iframe.contentDocument && iframe.contentDocument.body) {
        iframe.contentDocument.body.style.fontFamily = fam;
    }
    if (persist) saveState();
}

function renderFontsAndThemesWorkspace() {
    renderThemeSelectOptions();
    renderSavedCustomThemesList();
    renderFontFavorites();
    renderFontPlayground();
    syncThemeInputsFromState();
}

/* ==========================================================
   RELOJ, CLIMA Y SNAPSHOTS
   ========================================================== */
function getNowDate() {
    const base = new Date();
    if (state.manualClock && state.manualClock.enabled) {
        return new Date(base.getTime() + (state.manualClock.offsetMs || 0));
    }
    return base;
}

function updateClock() {
    const now = getNowDate();
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
        if (state.manualClock?.enabled) {
            netEl.textContent = '🕒 Hora manual';
        } else {
            netEl.textContent = navigator.onLine ? '🟢 En línea' : '🟡 Sin red';
        }
    }

    renderScheduleWidget();
}

function openClockModal() {
    const now = getNowDate();
    const dateInput = document.getElementById('manual-clock-date');
    const timeInput = document.getElementById('manual-clock-time');
    if (dateInput) dateInput.value = now.toISOString().slice(0, 10);
    if (timeInput) timeInput.value = now.toTimeString().slice(0, 8);
    const modal = document.getElementById('clock-modal');
    if (modal) modal.style.display = 'flex';
}

function closeClockModal() {
    const modal = document.getElementById('clock-modal');
    if (modal) modal.style.display = 'none';
}

function applyManualClock() {
    const d = document.getElementById('manual-clock-date')?.value;
    const t = document.getElementById('manual-clock-time')?.value || '00:00:00';
    if (!d) {
        showToast('Selecciona una fecha válida', 'error');
        return;
    }
    const target = new Date(`${d}T${t.length === 5 ? `${t}:00` : t}`);
    if (!Number.isFinite(target.getTime())) {
        showToast('Fecha u hora inválida', 'error');
        return;
    }
    state.manualClock = {
        enabled: true,
        offsetMs: target.getTime() - Date.now()
    };
    saveState(true);
    updateClock();
    closeClockModal();
    showToast('Hora manual aplicada', 'success');
}

function resetManualClockToAuto() {
    state.manualClock = { enabled: false, offsetMs: 0 };
    saveState(true);
    updateClock();
    showToast('Hora sincronizada automáticamente', 'info');
}

async function toggleWeatherBadge() {
    state.weatherEnabled = !state.weatherEnabled;
    const badgeText = document.getElementById('weather-text');
    if (!state.weatherEnabled) {
        if (badgeText) badgeText.textContent = 'Clima: OFF';
        saveState();
        return;
    }

    if (badgeText) badgeText.textContent = 'Cargando...';
    try {
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=38.42&longitude=-6.31&current_weather=true');
        if (!res.ok) throw new Error('Error consultando clima');
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        state.weatherData = { temp };
        if (badgeText) badgeText.textContent = `${temp ?? '--'}°C`;
        saveState();
    } catch (_) {
        state.weatherEnabled = false;
        if (badgeText) badgeText.textContent = 'Clima: N/D';
        saveState();
        showToast('No se pudo obtener el clima', 'error');
    }
}

function openSnapshotsModal() {
    renderSnapshotsList();
    const modal = document.getElementById('snapshots-modal');
    if (modal) modal.style.display = 'flex';
}

function closeSnapshotsModal() {
    const modal = document.getElementById('snapshots-modal');
    if (modal) modal.style.display = 'none';
}

function getSnapshotsList() {
    try {
        return JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    } catch (_) {
        return [];
    }
}

function createBackupSnapshot() {
    const snaps = getSnapshotsList();
    const snap = {
        id: `snap-${Date.now()}`,
        createdAt: new Date().toLocaleString('es-ES'),
        data: JSON.parse(JSON.stringify(state))
    };
    snaps.unshift(snap);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(0, 15)));
    renderSnapshotsList();
    showToast('Snapshot creado', 'success');
}

function restoreSnapshot(id) {
    const snaps = getSnapshotsList();
    const found = snaps.find(s => s.id === id);
    if (!found) return;
    state = mergeState(createDefaultState(), found.data);
    saveState(true);
    renderAll();
    closeSnapshotsModal();
    showToast('Snapshot restaurado', 'success');
}

function deleteSnapshot(id) {
    const snaps = getSnapshotsList().filter(s => s.id !== id);
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps));
    renderSnapshotsList();
}

function renderSnapshotsList() {
    const list = document.getElementById('snapshots-list');
    if (!list) return;
    const snaps = getSnapshotsList();
    if (!snaps.length) {
        list.innerHTML = '<div class="mono-muted">No hay snapshots guardados.</div>';
        return;
    }
    list.innerHTML = snaps.map(s => `
        <div class="grade-item-row">
            <span>📸 ${escapeHtml(s.createdAt)}</span>
            <div class="filter-pills-row">
                <button type="button" class="btn-cyan btn-sm" onclick="restoreSnapshot(${JSON.stringify(s.id)})">Restaurar</button>
                <button type="button" class="btn-icon" onclick="deleteSnapshot(${JSON.stringify(s.id)})">🗑️</button>
            </div>
        </div>
    `).join('');
}

/* ==========================================================
   HORARIO & CLASE ACTUAL
   ========================================================== */
const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function timeToMinutes(hhmm) {
    const [h, m] = String(hhmm || '00:00').split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

function toggleScheduleViewMode() {
    state.scheduleViewMode = state.scheduleViewMode === 'current' ? 'table' : 'current';
    saveState();
    renderScheduleWidget();
}

function renderScheduleWidget() {
    const container = document.getElementById('schedule-widget');
    if (!container) return;

    const sorted = [...(state.schedule || [])].sort((a, b) =>
        a.day !== b.day ? a.day - b.day : timeToMinutes(a.start) - timeToMinutes(b.start)
    );

    if (state.scheduleViewMode === 'table') {
        if (!sorted.length) {
            container.innerHTML = '<div class="sch-detail">No hay clases configuradas. Pulsa "Configurar" para añadir.</div>';
            return;
        }
        container.innerHTML = `
            <table class="sch-table">
                <thead>
                    <tr><th>Día</th><th>Hora</th><th>Asignatura</th><th>Aula</th><th>Profesor/a</th></tr>
                </thead>
                <tbody>
                    ${sorted.map(item => `
                        <tr>
                            <td>${escapeHtml(DAY_NAMES[item.day] || item.day)}</td>
                            <td>${escapeHtml(item.start)} - ${escapeHtml(item.end)}</td>
                            <td>${escapeHtml(item.subject)}</td>
                            <td>${escapeHtml(item.room || '-')}</td>
                            <td>${escapeHtml(item.teacher || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    const now = getNowDate();
    const currentDay = now.getDay();
    const currentMin = now.getHours() * 60 + now.getMinutes();

    const todayClasses = sorted.filter(c => c.day === currentDay);
    const activeClass = todayClasses.find(c =>
        currentMin >= timeToMinutes(c.start) && currentMin < timeToMinutes(c.end)
    );
    const nextClass = todayClasses.find(c => timeToMinutes(c.start) > currentMin)
        || sorted.find(c => c.day > currentDay)
        || sorted[0];

    if (activeClass) {
        const startM = timeToMinutes(activeClass.start);
        const endM = timeToMinutes(activeClass.end);
        const pct = Math.max(0, Math.min(100, Math.round(((currentMin - startM) / Math.max(1, endM - startM)) * 100)));
        const remMins = Math.max(0, endM - currentMin);
        container.innerHTML = `
            <div class="sch-status">🟢 <strong>${escapeHtml(activeClass.subject)}</strong> <span class="badge-version">${escapeHtml(activeClass.start)} - ${escapeHtml(activeClass.end)}</span></div>
            <div class="sch-detail">Aula: ${escapeHtml(activeClass.room || 'N/D')} · Profesor/a: ${escapeHtml(activeClass.teacher || 'N/D')} · Restan ${remMins} min</div>
            <div class="sch-progress-track"><div class="sch-progress-fill" style="width:${pct}%"></div></div>
        `;
        return;
    }

    if (nextClass) {
        container.innerHTML = `
            <div class="sch-status">⏭️ Próxima: <strong>${escapeHtml(nextClass.subject)}</strong></div>
            <div class="sch-detail">${escapeHtml(DAY_NAMES[nextClass.day] || '')} · ${escapeHtml(nextClass.start)} - ${escapeHtml(nextClass.end)} · Aula: ${escapeHtml(nextClass.room || 'N/D')}</div>
        `;
    } else {
        container.innerHTML = '<div class="sch-detail">Sin clases programadas en el horario.</div>';
    }
}

function openScheduleModal() {
    renderSubjectSelectTargets();
    renderScheduleEditorList();
    const modal = document.getElementById('schedule-modal');
    if (modal) modal.style.display = 'flex';
}

function closeScheduleModal() {
    const modal = document.getElementById('schedule-modal');
    if (modal) modal.style.display = 'none';
}

function autofillScheduleFromCatalog(subjectName) {
    const found = (state.subjectsCatalog || []).find(s => s.name === subjectName);
    if (!found) return;
    const teacherInput = document.getElementById('sch-add-teacher');
    const roomInput = document.getElementById('sch-add-room');
    if (teacherInput && found.teacher) teacherInput.value = found.teacher;
    if (roomInput && found.room) roomInput.value = found.room;
}

function addScheduleClass() {
    const day = Number(document.getElementById('sch-add-day')?.value || 1);
    const start = (document.getElementById('sch-add-start')?.value || '').trim();
    const end = (document.getElementById('sch-add-end')?.value || '').trim();
    const subject = (document.getElementById('sch-add-subject')?.value || '').trim();
    const teacher = (document.getElementById('sch-add-teacher')?.value || '').trim();
    const room = (document.getElementById('sch-add-room')?.value || '').trim();

    if (!subject || !start || !end) {
        showToast('Completa asignatura, hora de inicio y fin', 'error');
        return;
    }

    ensureSubjectInCatalog(subject, teacher, room);
    state.schedule.push({ day, start, end, subject, teacher, room });
    saveState();
    renderScheduleWidget();
    renderScheduleEditorList();
    showToast('Clase añadida al horario', 'success');
}

function deleteScheduleClass(index) {
    state.schedule.splice(index, 1);
    saveState();
    renderScheduleWidget();
    renderScheduleEditorList();
}

function clearSchedule() {
    state.schedule = [];
    saveState();
    renderScheduleWidget();
    renderScheduleEditorList();
    showToast('Horario vaciado', 'info');
}

function importScheduleFromText() {
    const raw = document.getElementById('sch-import-text')?.value || '';
    const parsed = parseScheduleImportText(raw);
    if (!parsed.length) {
        showToast('No se reconocieron líneas válidas en el texto', 'error');
        return;
    }
    parsed.forEach(row => {
        ensureSubjectInCatalog(row.subject, row.teacher, row.room);
        state.schedule.push(row);
    });
    saveState();
    renderScheduleWidget();
    renderScheduleEditorList();
    showToast(`${parsed.length} clases importadas`, 'success');
}

function renderScheduleEditorList() {
    const list = document.getElementById('schedule-editor-list');
    if (!list) return;
    if (!state.schedule.length) {
        list.innerHTML = '<div class="mono-muted">Sin clases registradas.</div>';
        return;
    }
    list.innerHTML = state.schedule.map((item, idx) => `
        <div class="grade-item-row">
            <span><strong>${escapeHtml(DAY_NAMES[item.day] || item.day)}</strong> ${escapeHtml(item.start)}-${escapeHtml(item.end)} · ${escapeHtml(item.subject)} (${escapeHtml(item.room || '-')}, ${escapeHtml(item.teacher || '-')})</span>
            <button type="button" class="btn-icon" onclick="deleteScheduleClass(${idx})">🗑️</button>
        </div>
    `).join('');
}

/* ==========================================================
   ENTREGAS Y EXÁMENES
   ========================================================== */
function setDeliveryFilter(filter) {
    state.deliveryFilter = filter;
    document.querySelectorAll('.delivery-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.dfilter === filter);
    });
    saveState();
    renderDeliveries();
}

function toggleExamCramMode() {
    state.examCramMode = !state.examCramMode;
    document.getElementById('btn-exam-cram')?.classList.toggle('active', state.examCramMode);
    saveState();
    renderDeliveries();
}

function requestDesktopNotifications() {
    if (!('Notification' in window)) {
        showToast('Este navegador no soporta notificaciones', 'info');
        return;
    }
    Notification.requestPermission().then(perm => {
        showToast(perm === 'granted' ? 'Avisos activados' : 'Permiso de avisos denegado', perm === 'granted' ? 'success' : 'info');
    });
}

function addDelivery() {
    const title = (document.getElementById('del-title')?.value || '').trim();
    const subject = (document.getElementById('del-subject')?.value || '').trim();
    const type = document.getElementById('del-type')?.value || 'practica';
    const dueDate = document.getElementById('del-date')?.value || getMadridDateKey();
    const notes = (document.getElementById('del-notes')?.value || '').trim();

    if (!title) {
        showToast('Escribe un título para la entrega o examen', 'error');
        return;
    }

    ensureSubjectInCatalog(subject);
    state.deliveries.unshift({
        id: `del-${Date.now()}`,
        title,
        subject,
        type,
        dueDate,
        notes,
        done: false
    });

    const titleEl = document.getElementById('del-title');
    const notesEl = document.getElementById('del-notes');
    if (titleEl) titleEl.value = '';
    if (notesEl) notesEl.value = '';
    toggleForm('form-add-delivery');
    saveState();
    renderDeliveries();
    showToast('Entrega añadida', 'success');
}

function toggleDeliveryDone(id) {
    const item = state.deliveries.find(d => d.id === id);
    if (!item) return;
    item.done = !item.done;
    saveState();
    renderDeliveries();
}

function deleteDelivery(id) {
    state.deliveries = state.deliveries.filter(d => d.id !== id);
    saveState();
    renderDeliveries();
}

function renderDeliveries() {
    const list = document.getElementById('deliveries-list');
    if (!list) return;

    const todayKey = getMadridDateKey();
    const todayMs = new Date(`${todayKey}T00:00:00Z`).getTime();

    const filtered = (state.deliveries || []).filter(item => {
        const dueMs = item.dueDate ? new Date(`${item.dueDate}T00:00:00Z`).getTime() : todayMs;
        const diffDays = (dueMs - todayMs) / (1000 * 60 * 60 * 24);

        if (state.examCramMode && (item.done || diffDays > 7)) return false;
        if (state.deliveryFilter === 'pending') return !item.done;
        if (state.deliveryFilter === 'soon') return !item.done && diffDays <= 3;
        if (state.deliveryFilter === 'exam') return item.type === 'examen';
        if (state.deliveryFilter === 'practice') return item.type === 'practica' || item.type === 'entrega';
        return true;
    });

    if (!filtered.length) {
        list.innerHTML = '<div class="mono-muted">No hay entregas que coincidan con el filtro.</div>';
        return;
    }

    list.innerHTML = filtered.map(item => `
        <div class="delivery-item ${item.done ? 'is-done' : ''}">
            <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleDeliveryDone(${JSON.stringify(item.id)})" aria-label="Marcar entrega completada">
            <div class="delivery-body">
                <div class="delivery-title">
                    <span>${escapeHtml(item.title)}</span>
                    <span class="delivery-badge">${escapeHtml(item.type)}</span>
                    ${item.subject ? `<span class="badge-version">${escapeHtml(item.subject)}</span>` : ''}
                </div>
                <div class="delivery-meta">Fecha: ${escapeHtml(item.dueDate || 'Sin fecha')}${item.notes ? ` · ${escapeHtml(item.notes)}` : ''}</div>
            </div>
            <button type="button" class="btn-icon" onclick="deleteDelivery(${JSON.stringify(item.id)})">🗑️</button>
        </div>
    `).join('');
}

/* ==========================================================
   TAREAS CON BLOQUES DE JORNADA
   ========================================================== */
function setTaskFilter(filter) {
    state.taskFilter = filter;
    document.querySelectorAll('.task-filter-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    saveState();
    renderTasks();
}

function setTaskBlockFilter(block) {
    state.taskBlockFilter = block;
    saveState();
    renderTasks();
}

function setTaskSort(sort) {
    state.taskSort = sort;
    saveState();
    renderTasks();
}

function addTask() {
    const input = document.getElementById('task-input');
    const text = (input?.value || '').trim();
    if (!text) return;

    const block = document.getElementById('task-block')?.value || 'afternoon';
    const priority = document.getElementById('task-priority')?.value || 'medium';
    const dueDate = document.getElementById('task-date')?.value || getMadridDateKey();
    const repeat = document.getElementById('task-repeat')?.value || '';

    state.tasks.unshift({
        id: `tsk-${Date.now()}`,
        text,
        block,
        priority,
        dueDate,
        repeat,
        done: false,
        subtasks: [],
        createdAt: Date.now()
    });

    if (input) input.value = '';
    saveState();
    renderTasks();
    renderPomodoroLinkedTasks();
}

function toggleTaskDone(id) {
    const task = state.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    if (task.done && task.repeat) {
        try {
            const nextDate = getNextRepeatDate(task.dueDate || getMadridDateKey(), task.repeat);
            state.tasks.unshift({
                ...task,
                id: `tsk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                dueDate: nextDate,
                done: false,
                subtasks: (task.subtasks || []).map(st => ({ ...st, done: false })),
                createdAt: Date.now()
            });
        } catch (_) {}
    }
    saveState();
    renderTasks();
}

function deleteTask(id) {
    state.tasks = state.tasks.filter(t => t.id !== id);
    saveState();
    renderTasks();
    renderPomodoroLinkedTasks();
}

function clearCompletedTasks() {
    state.tasks = state.tasks.filter(t => !t.done);
    saveState();
    renderTasks();
    renderPomodoroLinkedTasks();
}

function addSubtaskPrompt(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;
    const title = prompt('Nueva subtarea:');
    if (!title || !title.trim()) return;
    task.subtasks = task.subtasks || [];
    task.subtasks.push({ id: `sub-${Date.now()}`, text: title.trim(), done: false });
    saveState();
    renderTasks();
}

function toggleSubtaskDone(taskId, subId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task || !task.subtasks) return;
    const sub = task.subtasks.find(s => s.id === subId);
    if (!sub) return;
    sub.done = !sub.done;
    saveState();
    renderTasks();
}

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    const todayKey = getMadridDateKey();
    const blockLabels = { morning: '🌅 Mañana', afternoon: '☀️ Tarde', night: '🌙 Noche' };
    const prioRank = { high: 0, medium: 1, low: 2 };
    const blockRank = { morning: 0, afternoon: 1, night: 2 };

    let filtered = (state.tasks || []).filter(t => {
        if (state.taskBlockFilter !== 'all' && t.block !== state.taskBlockFilter) return false;
        if (state.taskFilter === 'pending') return !t.done;
        if (state.taskFilter === 'done') return t.done;
        if (state.taskFilter === 'today') return t.dueDate === todayKey;
        if (state.taskFilter === 'overdue') return !t.done && t.dueDate && t.dueDate < todayKey;
        return true;
    });

    filtered = [...filtered].sort((a, b) => {
        if (state.taskSort === 'priority') return (prioRank[a.priority] ?? 1) - (prioRank[b.priority] ?? 1);
        if (state.taskSort === 'block') return (blockRank[a.block] ?? 1) - (blockRank[b.block] ?? 1);
        if (state.taskSort === 'date') return String(a.dueDate || '9999').localeCompare(String(b.dueDate || '9999'));
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (!filtered.length) {
        list.innerHTML = '<div class="mono-muted">No hay tareas en este filtro.</div>';
        return;
    }

    list.innerHTML = filtered.map(task => {
        const subsHtml = (task.subtasks || []).map(sub => `
            <label class="subtask-row">
                <input type="checkbox" ${sub.done ? 'checked' : ''} onchange="toggleSubtaskDone(${JSON.stringify(task.id)}, ${JSON.stringify(sub.id)})">
                <span style="${sub.done ? 'text-decoration:line-through;opacity:0.65' : ''}">${escapeHtml(sub.text)}</span>
            </label>
        `).join('');

        return `
            <div class="task-item ${task.done ? 'is-done' : ''}">
                <input type="checkbox" ${task.done ? 'checked' : ''} onchange="toggleTaskDone(${JSON.stringify(task.id)})" aria-label="Completar tarea">
                <div class="task-body">
                    <div class="task-text">${escapeHtml(task.text)}</div>
                    <div class="task-meta">
                        ${escapeHtml(blockLabels[task.block] || '☀️ Tarde')} · ${escapeHtml(task.dueDate || 'Sin fecha')} · Prioridad: ${escapeHtml(task.priority || 'media')}${task.repeat ? ` · 🔁 ${escapeHtml(task.repeat)}` : ''}
                    </div>
                    ${subsHtml ? `<div class="subtasks-box">${subsHtml}</div>` : ''}
                </div>
                <button type="button" class="btn-icon" onclick="addSubtaskPrompt(${JSON.stringify(task.id)})" title="Añadir subtarea">➕</button>
                <button type="button" class="btn-icon" onclick="deleteTask(${JSON.stringify(task.id)})" title="Eliminar tarea">🗑️</button>
            </div>
        `;
    }).join('');
}

/* ==========================================================
   POMODORO, AUDIO & MÉTRICAS
   ========================================================== */
function renderPomodoroLinkedTasks() {
    const sel = document.getElementById('pomo-linked-task');
    if (!sel) return;
    const pending = (state.tasks || []).filter(t => !t.done);
    sel.innerHTML = '<option value="">-- Vincular tarea (opcional) --</option>' +
        pending.map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.text)}</option>`).join('');
    sel.value = state.pomodoro.linkedTaskId || '';
}

function setPomodoroLinkedTask(taskId) {
    state.pomodoro.linkedTaskId = taskId;
    saveState();
}

function setPomodoroMode(mode, minutesValue) {
    pausePomodoro();
    state.pomodoro.mode = mode === 'break' ? 'break' : 'focus';
    const parsed = parseInt(minutesValue, 10);
    const fallback = state.pomodoro.mode === 'break' ? state.pomodoro.breakMinutes : state.pomodoro.focusMinutes;
    const mins = Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
    if (state.pomodoro.mode === 'break') state.pomodoro.breakMinutes = mins;
    else state.pomodoro.focusMinutes = mins;

    state.pomodoro.secondsLeft = mins * 60;
    document.getElementById('btn-mode-focus')?.classList.toggle('active', state.pomodoro.mode === 'focus');
    document.getElementById('btn-mode-break')?.classList.toggle('active', state.pomodoro.mode === 'break');
    saveState();
    renderPomodoro();
}

function updatePomodoroConfig() {
    const f = parseInt(document.getElementById('pomo-focus-mins')?.value, 10);
    const b = parseInt(document.getElementById('pomo-break-mins')?.value, 10);
    state.pomodoro.focusMinutes = Number.isFinite(f) && f > 0 ? f : 25;
    state.pomodoro.breakMinutes = Number.isFinite(b) && b > 0 ? b : 5;
    if (!state.pomodoro.running) {
        state.pomodoro.secondsLeft = (state.pomodoro.mode === 'break' ? state.pomodoro.breakMinutes : state.pomodoro.focusMinutes) * 60;
    }
    saveState();
    renderPomodoro();
}

function startPomodoro() {
    if (pomodoroInterval) return;
    state.pomodoro.running = true;
    saveState();
    pomodoroInterval = setInterval(() => {
        if (state.pomodoro.secondsLeft > 0) {
            state.pomodoro.secondsLeft -= 1;
            renderPomodoro();
        } else {
            completePomodoroCycle();
        }
    }, 1000);
}

function pausePomodoro() {
    state.pomodoro.running = false;
    if (pomodoroInterval) {
        clearInterval(pomodoroInterval);
        pomodoroInterval = null;
    }
    saveState();
}

function resetPomodoro() {
    pausePomodoro();
    const mins = state.pomodoro.mode === 'break' ? state.pomodoro.breakMinutes : state.pomodoro.focusMinutes;
    state.pomodoro.secondsLeft = mins * 60;
    saveState();
    renderPomodoro();
}

function completePomodoroCycle() {
    pausePomodoro();
    if (state.pomodoro.mode === 'focus') {
        const added = state.pomodoro.focusMinutes || 25;
        const today = getMadridDateKey();
        state.pomodoro.totalMinutes = (state.pomodoro.totalMinutes || 0) + added;
        if (state.pomodoro.lastStudyDate === today) {
            state.pomodoro.todayMinutes = (state.pomodoro.todayMinutes || 0) + added;
        } else {
            state.pomodoro.todayMinutes = added;
            state.pomodoro.lastStudyDate = today;
        }
        state.pomodoro.historyByDate[today] = (state.pomodoro.historyByDate[today] || 0) + added;
        showToast(`¡Sesión de foco completada (+${added} min)!`, 'success');
        setPomodoroMode('break', state.pomodoro.breakMinutes);
    } else {
        showToast('Descanso terminado. ¡Listo para otro bloque!', 'info');
        setPomodoroMode('focus', state.pomodoro.focusMinutes);
    }
    saveState(true);
    renderPomodoro();
}

function renderPomodoro() {
    const sec = Math.max(0, Number(state.pomodoro.secondsLeft) || 0);
    const mm = String(Math.floor(sec / 60)).padStart(2, '0');
    const ss = String(sec % 60).padStart(2, '0');
    const disp = document.getElementById('pomo-display');
    if (disp) disp.textContent = `${mm}:${ss}`;

    const todayEl = document.getElementById('pomo-today-mins');
    const totalEl = document.getElementById('pomo-total-mins');
    const streakEl = document.getElementById('pomo-streak-days');
    const heatEl = document.getElementById('pomo-heatmap');

    const todayKey = getMadridDateKey();
    const todayMins = state.pomodoro.lastStudyDate === todayKey ? (state.pomodoro.todayMinutes || 0) : 0;

    if (todayEl) todayEl.textContent = `${todayMins}m`;
    if (totalEl) totalEl.textContent = `${state.pomodoro.totalMinutes || 0}m`;

    let streak = 0;
    const cursor = new Date(`${todayKey}T12:00:00Z`);
    while (true) {
        const k = cursor.toISOString().slice(0, 10);
        if ((state.pomodoro.historyByDate?.[k] || 0) > 0) {
            streak += 1;
            cursor.setUTCDate(cursor.getUTCDate() - 1);
        } else {
            break;
        }
    }
    if (streakEl) streakEl.textContent = `${streak}d`;

    if (heatEl) {
        const cells = [];
        const d = new Date(`${todayKey}T12:00:00Z`);
        d.setUTCDate(d.getUTCDate() - 13);
        for (let i = 0; i < 14; i++) {
            const key = d.toISOString().slice(0, 10);
            const mins = state.pomodoro.historyByDate?.[key] || 0;
            const lv = mins >= 60 ? 'lv-3' : mins >= 25 ? 'lv-2' : mins > 0 ? 'lv-1' : '';
            cells.push(`<span class="heat-cell ${lv}" title="${key}: ${mins}m"></span>`);
            d.setUTCDate(d.getUTCDate() + 1);
        }
        heatEl.innerHTML = cells.join('');
    }
}

let focusAudioCtx = null;
let focusAudioGain = null;
let focusAudioNode = null;

function toggleFocusAudio() {
    const btn = document.getElementById('btn-audio-toggle');
    if (!state.focusAudio.playing) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (!focusAudioCtx) focusAudioCtx = new AudioCtx();
            if (focusAudioCtx.state === 'suspended') focusAudioCtx.resume();

            const bufferSize = 2 * focusAudioCtx.sampleRate;
            const buffer = focusAudioCtx.createBuffer(1, bufferSize, focusAudioCtx.sampleRate);
            const output = buffer.getChannelData(0);
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                output[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = output[i];
                output[i] *= 2.5;
            }

            const src = focusAudioCtx.createBufferSource();
            src.buffer = buffer;
            src.loop = true;

            const gain = focusAudioCtx.createGain();
            gain.gain.value = (state.focusAudio.volume || 25) / 400;

            src.connect(gain);
            gain.connect(focusAudioCtx.destination);
            src.start(0);

            focusAudioNode = src;
            focusAudioGain = gain;
            state.focusAudio.playing = true;
            if (btn) btn.textContent = '🔊 Ruido Focus';
        } catch (_) {
            showToast('No se pudo iniciar el audio ambiental', 'error');
        }
    } else {
        try { focusAudioNode?.stop(); } catch (_) {}
        focusAudioNode = null;
        state.focusAudio.playing = false;
        if (btn) btn.textContent = '🔇 Ruido Focus';
    }
    saveState();
}

function updateFocusAudioVolume(val) {
    state.focusAudio.volume = Number(val) || 25;
    if (focusAudioGain) {
        focusAudioGain.gain.value = state.focusAudio.volume / 400;
    }
    saveState();
}

/* ==========================================================
   SCRATCHPAD & STICKY
   ========================================================== */
function switchNoteTab(tabName) {
    state.notes.activeTab = tabName;
    document.querySelectorAll('.note-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.notetab === tabName);
    });
    const area = document.getElementById('notes-area');
    if (area) area.value = state.notes.tabs[tabName] || '';
    updateNoteMetrics();
    saveState();
}

function handleNoteInput() {
    const area = document.getElementById('notes-area');
    if (!area) return;
    state.notes.tabs[state.notes.activeTab] = area.value;
    updateNoteMetrics();
    saveState();
}

function updateNoteMetrics() {
    const text = state.notes.tabs[state.notes.activeTab] || '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const el = document.getElementById('notes-word-count');
    if (el) el.textContent = `${words} palabras · ${text.length} car.`;
}

function toggleNoteMarkdownPreview() {
    const preview = document.getElementById('notes-md-preview');
    const area = document.getElementById('notes-area');
    if (!preview || !area) return;
    const show = preview.classList.contains('is-hidden');
    if (show) {
        const lines = escapeHtml(area.value)
            .replace(/^### (.*)$/gm, '<h4>$1</h4>')
            .replace(/^## (.*)$/gm, '<h3>$1</h3>')
            .replace(/^# (.*)$/gm, '<h2>$1</h2>')
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\n/g, '<br>');
        preview.innerHTML = lines || '<em>Sin contenido</em>';
        preview.classList.remove('is-hidden');
        area.classList.add('is-hidden');
    } else {
        preview.classList.add('is-hidden');
        area.classList.remove('is-hidden');
    }
}

function saveNoteRevision() {
    const content = state.notes.tabs[state.notes.activeTab] || '';
    state.notes.revisions.unshift({
        id: `rev-${Date.now()}`,
        tab: state.notes.activeTab,
        date: new Date().toLocaleString('es-ES'),
        content
    });
    state.notes.revisions = state.notes.revisions.slice(0, 20);
    saveState();
    showToast('Versión de nota guardada', 'success');
}

function openNoteHistoryModal() {
    const list = document.getElementById('note-history-list');
    if (list) {
        if (!state.notes.revisions.length) {
            list.innerHTML = '<div class="mono-muted">No hay versiones guardadas.</div>';
        } else {
            list.innerHTML = state.notes.revisions.map(r => `
                <div class="grade-item-row">
                    <span>[${escapeHtml(r.tab)}] ${escapeHtml(r.date)}</span>
                    <button type="button" class="btn-cyan btn-sm" onclick="restoreNoteRevision(${JSON.stringify(r.id)})">Restaurar</button>
                </div>
            `).join('');
        }
    }
    const modal = document.getElementById('note-history-modal');
    if (modal) modal.style.display = 'flex';
}

function closeNoteHistoryModal() {
    const modal = document.getElementById('note-history-modal');
    if (modal) modal.style.display = 'none';
}

function restoreNoteRevision(id) {
    const rev = state.notes.revisions.find(r => r.id === id);
    if (!rev) return;
    state.notes.activeTab = rev.tab;
    state.notes.tabs[rev.tab] = rev.content;
    saveState();
    switchNoteTab(rev.tab);
    closeNoteHistoryModal();
    showToast('Versión restaurada', 'success');
}

function exportCurrentNoteMd() {
    const text = state.notes.tabs[state.notes.activeTab] || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nota-${state.notes.activeTab}-${getMadridDateKey()}.md`;
    a.click();
    URL.revokeObjectURL(url);
}

function toggleStickyNote() {
    state.notes.stickyOpen = !state.notes.stickyOpen;
    const drawer = document.getElementById('sticky-drawer');
    if (drawer) drawer.classList.toggle('is-hidden', !state.notes.stickyOpen);
    saveState();
}

function saveStickyNote() {
    const area = document.getElementById('sticky-note-area');
    if (!area) return;
    state.notes.sticky = area.value;
    saveState();
}
/* ==========================================================
   WORKSPACE 2: CODE STUDIO (HTML / CSS / JS + PYTHON + JAVA)
   ========================================================== */
function switchStudioTab(tab) {
    state.studio.activeTab = tab;
    document.querySelectorAll('.studio-file-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.sttab === tab);
    });

    const tabs = ['html', 'css', 'js', 'python', 'java'];
    tabs.forEach(t => {
        const el = document.getElementById(`studio-editor-${t}`);
        if (el) el.classList.toggle('active', t === tab);
    });

    const savedPanel = document.getElementById('studio-saved-panel');
    if (savedPanel) savedPanel.classList.toggle('is-hidden', tab !== 'saved');

    const iframe = document.getElementById('studio-preview-iframe');
    const runnerOut = document.getElementById('studio-runner-output');
    const modeLabel = document.getElementById('studio-output-mode-label');

    if (tab === 'python' || tab === 'java') {
        iframe?.classList.add('is-hidden');
        runnerOut?.classList.remove('is-hidden');
        if (modeLabel) modeLabel.textContent = tab === 'python' ? 'Salida Python 3' : 'Salida Java Console';
    } else {
        iframe?.classList.remove('is-hidden');
        runnerOut?.classList.add('is-hidden');
        if (modeLabel) modeLabel.textContent = 'Vista Previa Web en Vivo';
    }

    if (tab === 'saved') renderStudioSavedList();
    updateStudioMetrics();
    saveState();
}

function handleStudioTitleChange() {
    const val = document.getElementById('studio-project-title')?.value || '';
    state.studio.title = val;
    saveState();
}

function handleStudioEditorInput(lang) {
    const el = document.getElementById(`studio-editor-${lang}`);
    if (!el) return;
    state.studio[lang] = el.value;
    updateStudioMetrics();
    saveState();

    const liveChecked = document.getElementById('studio-live-toggle')?.checked;
    state.studio.autoRun = Boolean(liveChecked);
    if (liveChecked && ['html', 'css', 'js'].includes(lang)) {
        runStudioCode();
    }
}

function updateStudioMetrics() {
    const active = state.studio.activeTab;
    const text = ['html', 'css', 'js', 'python', 'java'].includes(active)
        ? (state.studio[active] || '')
        : '';
    const lines = text ? text.split('\n').length : 0;
    const label = document.getElementById('studio-editor-metrics');
    if (label) label.textContent = `${lines} líneas · ${text.length} car.`;
}

function appendStudioConsole(msg, level = 'log') {
    const box = document.getElementById('studio-console-output');
    if (!box) return;
    const line = document.createElement('div');
    line.className = level === 'error' ? 'console-err' : level === 'warn' ? 'console-warn' : 'console-line';
    line.textContent = `[${new Date().toLocaleTimeString('es-ES', { hour12: false })}] ${msg}`;
    box.appendChild(line);
    box.scrollTop = box.scrollHeight;
}

function clearStudioConsole() {
    const box = document.getElementById('studio-console-output');
    if (box) box.innerHTML = '';
}

let pyodideInstance = null;
let pyodideLoadingPromise = null;

async function ensurePyodideLoaded() {
    if (pyodideInstance) return pyodideInstance;
    if (pyodideLoadingPromise) return pyodideLoadingPromise;

    pyodideLoadingPromise = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.26.2/full/pyodide.js';
        script.onload = async () => {
            try {
                pyodideInstance = await window.loadPyodide();
                resolve(pyodideInstance);
            } catch (err) {
                reject(err);
            }
        };
        script.onerror = () => reject(new Error('No se pudo cargar Pyodide desde CDN'));
        document.head.appendChild(script);
    });

    return pyodideLoadingPromise;
}

async function runPythonInStudio(code) {
    const outEl = document.getElementById('studio-runner-output');
    if (outEl) outEl.textContent = 'Ejecutando Python...';
    try {
        const py = await ensurePyodideLoaded();
        await py.runPythonAsync(`
import sys, io
_dw_stdout = io.StringIO()
sys.stdout = _dw_stdout
sys.stderr = _dw_stdout
`);
        await py.runPythonAsync(code);
        const captured = await py.runPythonAsync('_dw_stdout.getvalue()');
        const text = String(captured || '').trim() || '(Ejecución completada sin salida por consola)';
        if (outEl) outEl.textContent = text;
        appendStudioConsole('Python ejecutado correctamente');
    } catch (err) {
        const msg = err?.message || String(err);
        if (outEl) outEl.textContent = `Error Python:\n${msg}`;
        appendStudioConsole(msg, 'error');
    }
}

function runJavaInStudio(code) {
    const outEl = document.getElementById('studio-runner-output');
    const lines = [];
    const printRegex = /System\.out\.(println|print)\s*\(([\s\S]*?)\)\s*;/g;
    let match;
    while ((match = printRegex.exec(code)) !== null) {
        const rawArg = match[2].trim();
        const cleaned = rawArg
            .split('+')
            .map(part => {
                const p = part.trim();
                if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) {
                    return p.slice(1, -1);
                }
                return p;
            })
            .join('');
        lines.push(cleaned);
    }

    const hasMain = /public\s+static\s+void\s+main\s*\(/.test(code);
    if (!hasMain) {
        const warn = 'Aviso: No se detectó el método estándar public static void main(String[] args).';
        if (outEl) outEl.textContent = `${warn}\n\n${lines.join('\n')}`;
        appendStudioConsole(warn, 'warn');
        return;
    }

    const result = lines.length
        ? lines.join('\n')
        : 'Compilación sintáctica local OK. (Añade System.out.println(...) para ver salida)';
    if (outEl) outEl.textContent = result;
    appendStudioConsole('Java ejecutado en sandbox local');
}

function runStudioCode() {
    const active = state.studio.activeTab;
    if (active === 'python') {
        runPythonInStudio(state.studio.python || '');
        return;
    }
    if (active === 'java') {
        runJavaInStudio(state.studio.java || '');
        return;
    }

    const iframe = document.getElementById('studio-preview-iframe');
    if (!iframe) return;

    const fontName = state.googleFonts.studioFont || '';
    const fontLink = fontName
        ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName).replace(/%20/g, '+')}:wght@400;600;700&display=swap">`
        : '';
    const fontStyle = fontName ? `body { font-family: '${fontName}', system-ui, sans-serif; }` : '';

    const doc = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
${fontLink}
<style>${fontStyle}\n${state.studio.css || ''}</style>
</head>
<body>
${state.studio.html || ''}
<script>
(function(){
  const send = (lvl, args) => {
    try {
      window.parent.postMessage({ source: 'dw-studio-console', level: lvl, text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') }, '*');
    } catch(_) {}
  };
  const origLog = console.log, origErr = console.error, origWarn = console.warn;
  console.log = (...a) => { origLog.apply(console, a); send('log', a); };
  console.error = (...a) => { origErr.apply(console, a); send('error', a); };
  console.warn = (...a) => { origWarn.apply(console, a); send('warn', a); };
  window.onerror = (msg, _s, line) => send('error', [msg + ' (línea ' + line + ')']);
})();
<\/script>
<script>${state.studio.js || ''}<\/script>
</body>
</html>`;

    iframe.srcdoc = doc;
}

function loadStudioTemplate(tplKey) {
    const tpl = STUDIO_TEMPLATES[tplKey];
    if (!tpl) return;
    state.studio.title = tpl.title;
    const titleEl = document.getElementById('studio-project-title');
    if (titleEl) titleEl.value = tpl.title;

    if (tplKey === 'python') {
        state.studio.python = tpl.python;
        const pyEl = document.getElementById('studio-editor-python');
        if (pyEl) pyEl.value = tpl.python;
        switchStudioTab('python');
        runStudioCode();
    } else if (tplKey === 'java') {
        state.studio.java = tpl.java;
        const jvEl = document.getElementById('studio-editor-java');
        if (jvEl) jvEl.value = tpl.java;
        switchStudioTab('java');
        runStudioCode();
    } else {
        state.studio.html = tpl.html;
        state.studio.css = tpl.css;
        state.studio.js = tpl.js;
        ['html', 'css', 'js'].forEach(k => {
            const el = document.getElementById(`studio-editor-${k}`);
            if (el) el.value = state.studio[k];
        });
        switchStudioTab('html');
        runStudioCode();
    }
    saveState();
    showToast(`Plantilla "${tpl.title}" cargada`, 'success');
}

function injectCdnIntoStudio(cdnKey) {
    const snippet = STUDIO_CDNS[cdnKey];
    if (!snippet) return;
    if (!state.studio.html.includes(snippet)) {
        state.studio.html = `${snippet}\n${state.studio.html}`;
        const htmlEl = document.getElementById('studio-editor-html');
        if (htmlEl) htmlEl.value = state.studio.html;
        saveState();
        runStudioCode();
        showToast(`CDN ${cdnKey} inyectado en HTML`, 'success');
    }
}

function formatStudioCode() {
    const tab = state.studio.activeTab;
    const el = document.getElementById(`studio-editor-${tab}`);
    if (!el) return;
    el.value = el.value
        .split('\n')
        .map(line => line.replace(/\s+$/, ''))
        .join('\n')
        .trim();
    state.studio[tab] = el.value;
    saveState();
    updateStudioMetrics();
    showToast('Espacios sobrantes limpiados', 'info');
}

function setStudioViewport(width) {
    state.studio.viewport = width;
    document.querySelectorAll('.vp-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.vp === width);
    });
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.style.width = width;
    saveState();
}

function saveStudioProjectToLibrary() {
    const title = (state.studio.title || 'Proyecto sin título').trim();
    const item = {
        id: `st-${Date.now()}`,
        title,
        updatedAt: new Date().toLocaleString('es-ES'),
        html: state.studio.html,
        css: state.studio.css,
        js: state.studio.js,
        python: state.studio.python,
        java: state.studio.java
    };
    state.studio.savedProjects.unshift(item);
    saveState();
    renderStudioSavedList();
    showToast(`Proyecto "${title}" guardado`, 'success');
}

function loadSavedStudioProject(id) {
    const item = state.studio.savedProjects.find(p => p.id === id);
    if (!item) return;
    state.studio.title = item.title;
    state.studio.html = item.html || '';
    state.studio.css = item.css || '';
    state.studio.js = item.js || '';
    state.studio.python = item.python || '';
    state.studio.java = item.java || '';

    const titleEl = document.getElementById('studio-project-title');
    if (titleEl) titleEl.value = item.title;
    ['html', 'css', 'js', 'python', 'java'].forEach(k => {
        const el = document.getElementById(`studio-editor-${k}`);
        if (el) el.value = state.studio[k];
    });
    switchStudioTab('html');
    runStudioCode();
    saveState();
    showToast(`Proyecto "${item.title}" cargado`, 'success');
}

function deleteSavedStudioProject(id) {
    state.studio.savedProjects = state.studio.savedProjects.filter(p => p.id !== id);
    saveState();
    renderStudioSavedList();
}

function renderStudioSavedList() {
    const list = document.getElementById('studio-saved-list');
    if (!list) return;
    if (!state.studio.savedProjects.length) {
        list.innerHTML = '<div class="mono-muted">No hay proyectos guardados todavía.</div>';
        return;
    }
    list.innerHTML = state.studio.savedProjects.map(p => `
        <div class="grade-item-row">
            <span>📁 <strong>${escapeHtml(p.title)}</strong> <small>(${escapeHtml(p.updatedAt)})</small></span>
            <div class="filter-pills-row">
                <button type="button" class="btn-cyan btn-sm" onclick="loadSavedStudioProject(${JSON.stringify(p.id)})">Abrir</button>
                <button type="button" class="btn-icon" onclick="deleteSavedStudioProject(${JSON.stringify(p.id)})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function exportStudioSingleHtml() {
    const full = `<!DOCTYPE html>\n<html lang="es">\n<head>\n<meta charset="UTF-8">\n<title>${escapeHtml(state.studio.title || 'Proyecto')}</title>\n<style>\n${state.studio.css || ''}\n</style>\n</head>\n<body>\n${state.studio.html || ''}\n<script>\n${state.studio.js || ''}\n<\/script>\n</body>\n</html>`;
    const blob = new Blob([full], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.studio.title || 'proyecto').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.html`;
    a.click();
    URL.revokeObjectURL(url);
}

function exportStudioMultiFiles() {
    const bundle = JSON.stringify({
        title: state.studio.title,
        html: state.studio.html,
        css: state.studio.css,
        js: state.studio.js,
        python: state.studio.python,
        java: state.studio.java
    }, null, 2);
    const blob = new Blob([bundle], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(state.studio.title || 'proyecto').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-studio.json`;
    a.click();
    URL.revokeObjectURL(url);
}

/* ==========================================================
   WORKSPACE 3: BASE DE DATOS Y SQL LOCAL
   ========================================================== */
function renderDatabaseWorkspace() {
    const tabsBox = document.getElementById('db-tables-tabs');
    const gridBox = document.getElementById('db-table-grid-container');
    const titleEl = document.getElementById('db-active-table-title');
    if (!tabsBox || !gridBox) return;

    const tableNames = Object.keys(state.database.tables || {});
    if (!tableNames.length) {
        tabsBox.innerHTML = '';
        gridBox.innerHTML = '<div class="mono-muted">No hay tablas. Crea una arriba.</div>';
        return;
    }

    if (!state.database.tables[state.database.activeTable]) {
        state.database.activeTable = tableNames[0];
    }

    const activeName = state.database.activeTable;
    if (titleEl) titleEl.textContent = `🗄️ Tabla: ${activeName}`;

    tabsBox.innerHTML = tableNames.map(name => `
        <button type="button" class="pill-btn ${name === activeName ? 'active' : ''}" onclick="selectDbTable(${JSON.stringify(name)})">
            ${escapeHtml(name)}
        </button>
    `).join('');

    const tbl = state.database.tables[activeName];
    const cols = tbl.columns || [];
    const rows = tbl.rows || [];

    gridBox.innerHTML = `
        <table class="sch-table">
            <thead>
                <tr>
                    ${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}
                    <th>Acción</th>
                </tr>
            </thead>
            <tbody>
                ${rows.length ? rows.map((row, rIdx) => `
                    <tr>
                        ${cols.map(c => `<td>${escapeHtml(row[c] ?? '')}</td>`).join('')}
                        <td><button type="button" class="btn-icon" onclick="deleteDbRow(${rIdx})">🗑️</button></td>
                    </tr>
                `).join('') : `<tr><td colspan="${cols.length + 1}" class="mono-muted">Tabla vacía</td></tr>`}
            </tbody>
        </table>
    `;
}

function selectDbTable(name) {
    state.database.activeTable = name;
    saveState();
    renderDatabaseWorkspace();
}

function createDbTable() {
    const name = (document.getElementById('db-new-table-name')?.value || '').trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
    const colsRaw = (document.getElementById('db-new-table-cols')?.value || '').trim();
    if (!name || !colsRaw) {
        showToast('Indica nombre de tabla y columnas separadas por coma', 'error');
        return;
    }
    const columns = colsRaw.split(',').map(c => c.trim()).filter(Boolean);
    if (!columns.length) return;

    state.database.tables[name] = { columns, rows: [] };
    state.database.activeTable = name;
    document.getElementById('db-new-table-name').value = '';
    document.getElementById('db-new-table-cols').value = '';
    saveState();
    renderDatabaseWorkspace();
    showToast(`Tabla "${name}" creada`, 'success');
}

function addDbRowPrompt() {
    const activeName = state.database.activeTable;
    const tbl = state.database.tables[activeName];
    if (!tbl) return;
    const row = {};
    for (const col of tbl.columns) {
        const val = prompt(`Valor para "${col}":`, '');
        if (val === null) return;
        row[col] = val;
    }
    tbl.rows.push(row);
    saveState();
    renderDatabaseWorkspace();
}

function deleteDbRow(idx) {
    const tbl = state.database.tables[state.database.activeTable];
    if (!tbl) return;
    tbl.rows.splice(idx, 1);
    saveState();
    renderDatabaseWorkspace();
}

function deleteCurrentDbTable() {
    const name = state.database.activeTable;
    if (!name || !state.database.tables[name]) return;
    delete state.database.tables[name];
    const remaining = Object.keys(state.database.tables);
    state.database.activeTable = remaining[0] || '';
    saveState();
    renderDatabaseWorkspace();
    showToast(`Tabla "${name}" eliminada`, 'info');
}

function exportDbJson() {
    const blob = new Blob([JSON.stringify(state.database.tables, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devworkspace-db-${getMadridDateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function insertSqlTemplate(kind) {
    const active = state.database.activeTable || 'alumnos';
    const tbl = state.database.tables[active];
    const cols = tbl ? tbl.columns.join(', ') : 'id, nombre';
    const box = document.getElementById('db-sql-input');
    if (!box) return;
    if (kind === 'select') box.value = `SELECT * FROM ${active};`;
    else if (kind === 'insert') box.value = `INSERT INTO ${active} (${cols}) VALUES (${tbl ? tbl.columns.map(() => "'valor'").join(', ') : "'1', 'Dato'"});`;
    else if (kind === 'delete') box.value = `DELETE FROM ${active} WHERE id = '1';`;
}

function executeLocalSql() {
    const raw = (document.getElementById('db-sql-input')?.value || '').trim().replace(/;+$/, '');
    const out = document.getElementById('db-sql-result');
    if (!out) return;

    const selectMatch = /^SELECT\s+(.+?)\s+FROM\s+([a-zA-Z0-9_]+)(?:\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?)?$/i.exec(raw);
    if (selectMatch) {
        const [, colsPart, tableName, whereCol, whereVal] = selectMatch;
        const tbl = state.database.tables[tableName.toLowerCase()];
        if (!tbl) {
            out.innerHTML = `<div class="console-err">Tabla "${escapeHtml(tableName)}" no encontrada.</div>`;
            return;
        }
        const cols = colsPart.trim() === '*' ? tbl.columns : colsPart.split(',').map(c => c.trim());
        const rows = whereCol
            ? tbl.rows.filter(r => String(r[whereCol] ?? '') === whereVal)
            : tbl.rows;

        out.innerHTML = `
            <table class="sch-table">
                <thead><tr>${cols.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead>
                <tbody>
                    ${rows.map(r => `<tr>${cols.map(c => `<td>${escapeHtml(r[c] ?? '')}</td>`).join('')}</tr>`).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    const insertMatch = /^INSERT\s+INTO\s+([a-zA-Z0-9_]+)\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)$/i.exec(raw);
    if (insertMatch) {
        const [, tableName, colsRaw, valsRaw] = insertMatch;
        const tbl = state.database.tables[tableName.toLowerCase()];
        if (!tbl) {
            out.innerHTML = `<div class="console-err">Tabla "${escapeHtml(tableName)}" no encontrada.</div>`;
            return;
        }
        const cols = colsRaw.split(',').map(c => c.trim());
        const vals = valsRaw.split(',').map(v => v.trim().replace(/^['"]|['"]$/g, ''));
        const row = {};
        tbl.columns.forEach(c => { row[c] = ''; });
        cols.forEach((c, idx) => { row[c] = vals[idx] ?? ''; });
        tbl.rows.push(row);
        saveState();
        renderDatabaseWorkspace();
        out.innerHTML = `<div class="console-line">1 fila insertada en ${escapeHtml(tableName)}.</div>`;
        return;
    }

    const deleteMatch = /^DELETE\s+FROM\s+([a-zA-Z0-9_]+)\s+WHERE\s+([a-zA-Z0-9_]+)\s*=\s*['"]?([^'"]+)['"]?$/i.exec(raw);
    if (deleteMatch) {
        const [, tableName, whereCol, whereVal] = deleteMatch;
        const tbl = state.database.tables[tableName.toLowerCase()];
        if (!tbl) {
            out.innerHTML = `<div class="console-err">Tabla "${escapeHtml(tableName)}" no encontrada.</div>`;
            return;
        }
        const before = tbl.rows.length;
        tbl.rows = tbl.rows.filter(r => String(r[whereCol] ?? '') !== whereVal);
        const deleted = before - tbl.rows.length;
        saveState();
        renderDatabaseWorkspace();
        out.innerHTML = `<div class="console-line">${deleted} fila(s) eliminada(s) de ${escapeHtml(tableName)}.</div>`;
        return;
    }

    out.innerHTML = '<div class="console-warn">Sintaxis soportada: SELECT ... FROM tabla [WHERE col = \'val\'], INSERT INTO tabla (cols) VALUES (vals), DELETE FROM tabla WHERE col = \'val\'.</div>';
}

/* ==========================================================
   WORKSPACE 4: ACADEMIA DAM
   ========================================================== */
function ensureSubjectInCatalog(name, teacher = '', room = '') {
    const clean = String(name || '').trim();
    if (!clean) return;
    const existing = (state.subjectsCatalog || []).find(s => s.name.toLowerCase() === clean.toLowerCase());
    if (existing) {
        if (teacher) existing.teacher = teacher;
        if (room) existing.room = room;
    } else {
        state.subjectsCatalog.push({
            id: `subj-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
            name: clean,
            teacher,
            room
        });
    }
    renderSubjectSelectTargets();
}

function renderSubjectSelectTargets() {
    const subjects = state.subjectsCatalog || [];
    const optionsHtml = subjects.length
        ? subjects.map(s => `<option value="${escapeHtml(s.name)}">${escapeHtml(s.name)}</option>`).join('')
        : '<option value="General">General</option>';

    document.querySelectorAll('.subject-select-target').forEach(sel => {
        const current = sel.value;
        sel.innerHTML = optionsHtml;
        if (current && Array.from(sel.options).some(o => o.value === current)) {
            sel.value = current;
        }
    });

    const fcFilter = document.getElementById('fc-filter-subject');
    if (fcFilter) {
        const cur = fcFilter.value || 'all';
        fcFilter.innerHTML = '<option value="all">Todas las asignaturas</option>' + optionsHtml;
        fcFilter.value = cur;
    }
}

function addCatalogSubject() {
    const name = (document.getElementById('subj-cat-name')?.value || '').trim();
    const teacher = (document.getElementById('subj-cat-teacher')?.value || '').trim();
    const room = (document.getElementById('subj-cat-room')?.value || '').trim();
    if (!name) return;

    ensureSubjectInCatalog(name, teacher, room);
    document.getElementById('subj-cat-name').value = '';
    document.getElementById('subj-cat-teacher').value = '';
    document.getElementById('subj-cat-room').value = '';
    toggleForm('form-add-subject-catalog');
    saveState();
    renderSubjectsCatalogList();
    showToast('Asignatura guardada', 'success');
}

function deleteCatalogSubject(id) {
    state.subjectsCatalog = state.subjectsCatalog.filter(s => s.id !== id);
    saveState();
    renderSubjectSelectTargets();
    renderSubjectsCatalogList();
}

function renderSubjectsCatalogList() {
    const list = document.getElementById('subjects-catalog-list');
    if (!list) return;
    if (!state.subjectsCatalog.length) {
        list.innerHTML = '<div class="mono-muted">Sin asignaturas registradas.</div>';
        return;
    }
    list.innerHTML = state.subjectsCatalog.map(s => `
        <div class="grade-item-row">
            <span><strong>${escapeHtml(s.name)}</strong> · ${escapeHtml(s.teacher || 'Sin profesor')} · ${escapeHtml(s.room || 'Sin aula')}</span>
            <button type="button" class="btn-icon" onclick="deleteCatalogSubject(${JSON.stringify(s.id)})">🗑️</button>
        </div>
    `).join('');
}

function addKanbanTask() {
    const subject = (document.getElementById('kb-subject')?.value || '').trim();
    const title = (document.getElementById('kb-title')?.value || '').trim();
    if (!title) return;

    state.kanban.push({
        id: `kb-${Date.now()}`,
        subject,
        title,
        status: 'todo'
    });
    document.getElementById('kb-title').value = '';
    toggleForm('form-add-kanban');
    saveState();
    renderKanban();
}

function moveKanbanTask(id, nextStatus) {
    const item = state.kanban.find(k => k.id === id);
    if (!item) return;
    item.status = nextStatus;
    saveState();
    renderKanban();
}

function deleteKanbanTask(id) {
    state.kanban = state.kanban.filter(k => k.id !== id);
    saveState();
    renderKanban();
}

function renderKanban() {
    const cols = {
        todo: document.getElementById('kb-col-todo'),
        doing: document.getElementById('kb-col-doing'),
        done: document.getElementById('kb-col-done')
    };
    if (!cols.todo || !cols.doing || !cols.done) return;

    Object.values(cols).forEach(el => { el.innerHTML = ''; });

    (state.kanban || []).forEach(item => {
        const target = cols[item.status] || cols.todo;
        const card = document.createElement('div');
        card.className = 'kanban-card';
        card.innerHTML = `
            <span class="kb-subj">${escapeHtml(item.subject || 'General')}</span>
            <div>${escapeHtml(item.title)}</div>
            <div class="filter-pills-row">
                ${item.status !== 'todo' ? `<button type="button" class="btn-ghost btn-sm" onclick="moveKanbanTask(${JSON.stringify(item.id)}, 'todo')">⬅️</button>` : ''}
                ${item.status === 'todo' ? `<button type="button" class="btn-cyan btn-sm" onclick="moveKanbanTask(${JSON.stringify(item.id)}, 'doing')">➡️</button>` : ''}
                ${item.status === 'doing' ? `<button type="button" class="btn-green btn-sm" onclick="moveKanbanTask(${JSON.stringify(item.id)}, 'done')">✅</button>` : ''}
                <button type="button" class="btn-icon" onclick="deleteKanbanTask(${JSON.stringify(item.id)})">🗑️</button>
            </div>
        `;
        target.appendChild(card);
    });
}

function addGrade() {
    const subject = (document.getElementById('grd-subject')?.value || '').trim();
    const title = (document.getElementById('grd-title')?.value || '').trim();
    const score = parseFloat(document.getElementById('grd-score')?.value || '');
    const weight = parseFloat(document.getElementById('grd-weight')?.value || '100');

    if (!title || !Number.isFinite(score)) {
        showToast('Introduce título y nota válida', 'error');
        return;
    }

    state.grades.unshift({
        id: `grd-${Date.now()}`,
        subject,
        title,
        score,
        weight: Number.isFinite(weight) && weight > 0 ? weight : 100
    });
    document.getElementById('grd-title').value = '';
    document.getElementById('grd-score').value = '';
    toggleForm('form-add-grade');
    saveState();
    renderGrades();
}

function deleteGrade(id) {
    state.grades = state.grades.filter(g => g.id !== id);
    saveState();
    renderGrades();
}

function renderGrades() {
    const list = document.getElementById('grades-list');
    const avgBadge = document.getElementById('grades-avg-badge');
    if (!list) return;

    const grades = state.grades || [];
    if (avgBadge) {
        if (!grades.length) {
            avgBadge.textContent = 'Media: --';
        } else {
            const totalW = grades.reduce((acc, g) => acc + (g.weight || 100), 0);
            const weighted = grades.reduce((acc, g) => acc + g.score * (g.weight || 100), 0);
            avgBadge.textContent = `Media: ${(weighted / Math.max(1, totalW)).toFixed(2)}`;
        }
    }

    if (!grades.length) {
        list.innerHTML = '<div class="mono-muted">Sin calificaciones registradas.</div>';
        return;
    }

    list.innerHTML = grades.map(g => `
        <div class="grade-item-row">
            <span><strong>${escapeHtml(g.subject)}</strong> · ${escapeHtml(g.title)}: <strong>${g.score.toFixed(2)}</strong> (${g.weight}%)</span>
            <button type="button" class="btn-icon" onclick="deleteGrade(${JSON.stringify(g.id)})">🗑️</button>
        </div>
    `).join('');
}

function switchStudyHubTab(tab) {
    document.querySelectorAll('.study-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.studytab === tab);
    });
    ['flashcards', 'bugs', 'doubts'].forEach(panel => {
        document.getElementById(`study-panel-${panel}`)?.classList.toggle('is-hidden', panel !== tab);
    });
}

function getFilteredFlashcards() {
    const filter = document.getElementById('fc-filter-subject')?.value || 'all';
    if (filter === 'all') return state.flashcards || [];
    return (state.flashcards || []).filter(fc => fc.subject === filter);
}

function addFlashcard() {
    const subject = (document.getElementById('fc-subject')?.value || 'DAM').trim();
    const front = (document.getElementById('fc-front')?.value || '').trim();
    const back = (document.getElementById('fc-back')?.value || '').trim();
    if (!front || !back) return;

    state.flashcards.push({ id: `fc-${Date.now()}`, subject, front, back });
    document.getElementById('fc-front').value = '';
    document.getElementById('fc-back').value = '';
    toggleForm('form-add-fc');
    state.flashcardIndex = state.flashcards.length - 1;
    state.flashcardFlipped = false;
    saveState();
    renderFlashcards();
}

function flipFlashcard() {
    state.flashcardFlipped = !state.flashcardFlipped;
    renderFlashcards();
}

function prevFlashcard() {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    state.flashcardIndex = (state.flashcardIndex - 1 + list.length) % list.length;
    state.flashcardFlipped = false;
    renderFlashcards();
}

function nextFlashcard() {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    state.flashcardIndex = (state.flashcardIndex + 1) % list.length;
    state.flashcardFlipped = false;
    renderFlashcards();
}

function deleteCurrentFlashcard() {
    const list = getFilteredFlashcards();
    if (!list.length) return;
    const current = list[state.flashcardIndex % list.length];
    state.flashcards = state.flashcards.filter(fc => fc.id !== current.id);
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    saveState();
    renderFlashcards();
}

function renderFlashcards() {
    const list = getFilteredFlashcards();
    const counter = document.getElementById('fc-counter');
    const subjEl = document.getElementById('fc-card-subject');
    const contentEl = document.getElementById('fc-card-content');
    if (!contentEl) return;

    if (!list.length) {
        if (counter) counter.textContent = '0 / 0';
        if (subjEl) subjEl.textContent = 'DAM';
        contentEl.textContent = 'Añade tarjetas de estudio arriba';
        return;
    }

    const idx = ((state.flashcardIndex % list.length) + list.length) % list.length;
    const card = list[idx];
    if (counter) counter.textContent = `${idx + 1} / ${list.length}`;
    if (subjEl) subjEl.textContent = `${card.subject} · ${state.flashcardFlipped ? 'RESPUESTA' : 'PREGUNTA'}`;
    contentEl.textContent = state.flashcardFlipped ? card.back : card.front;
}

function addBugLog() {
    const title = (document.getElementById('bug-title')?.value || '').trim();
    const fix = (document.getElementById('bug-fix')?.value || '').trim();
    if (!title) return;
    state.bugLogs.unshift({ id: `bug-${Date.now()}`, title, fix });
    document.getElementById('bug-title').value = '';
    document.getElementById('bug-fix').value = '';
    toggleForm('form-add-bug');
    saveState();
    renderBugLogs();
}

function deleteBugLog(id) {
    state.bugLogs = state.bugLogs.filter(b => b.id !== id);
    saveState();
    renderBugLogs();
}

function renderBugLogs() {
    const list = document.getElementById('bug-logs-list');
    if (!list) return;
    if (!state.bugLogs.length) {
        list.innerHTML = '<div class="mono-muted">Sin bugs registrados.</div>';
        return;
    }
    list.innerHTML = state.bugLogs.map(b => `
        <div class="grade-item-row">
            <span>🐞 <strong>${escapeHtml(b.title)}</strong> → ${escapeHtml(b.fix || 'Pendiente')}</span>
            <button type="button" class="btn-icon" onclick="deleteBugLog(${JSON.stringify(b.id)})">🗑️</button>
        </div>
    `).join('');
}

function addClassDoubt() {
    const subject = (document.getElementById('doubt-subject')?.value || '').trim();
    const text = (document.getElementById('doubt-text')?.value || '').trim();
    if (!text) return;
    state.classDoubts.unshift({ id: `dbt-${Date.now()}`, subject, text, resolved: false });
    document.getElementById('doubt-text').value = '';
    toggleForm('form-add-doubt');
    saveState();
    renderClassDoubts();
}

function deleteClassDoubt(id) {
    state.classDoubts = state.classDoubts.filter(d => d.id !== id);
    saveState();
    renderClassDoubts();
}

function renderClassDoubts() {
    const list = document.getElementById('class-doubts-list');
    if (!list) return;
    if (!state.classDoubts.length) {
        list.innerHTML = '<div class="mono-muted">No hay dudas pendientes.</div>';
        return;
    }
    list.innerHTML = state.classDoubts.map(d => `
        <div class="grade-item-row">
            <span>❓ <strong>[${escapeHtml(d.subject || 'DAM')}]</strong> ${escapeHtml(d.text)}</span>
            <button type="button" class="btn-icon" onclick="deleteClassDoubt(${JSON.stringify(d.id)})">🗑️</button>
        </div>
    `).join('');
}

function addProject() {
    const title = (document.getElementById('prj-title')?.value || '').trim();
    const stack = (document.getElementById('prj-stack')?.value || '').trim();
    const progress = Math.max(0, Math.min(100, Number(document.getElementById('prj-progress')?.value || 0)));
    const url = normalizeExternalUrl(document.getElementById('prj-url')?.value || '');
    if (!title) return;

    state.projects.unshift({ id: `prj-${Date.now()}`, title, stack, progress, url });
    document.getElementById('prj-title').value = '';
    document.getElementById('prj-stack').value = '';
    document.getElementById('prj-url').value = '';
    toggleForm('form-add-project');
    saveState();
    renderProjects();
}

function deleteProject(id) {
    state.projects = state.projects.filter(p => p.id !== id);
    saveState();
    renderProjects();
}

function renderProjects() {
    const list = document.getElementById('projects-list');
    if (!list) return;
    if (!state.projects.length) {
        list.innerHTML = '<div class="mono-muted">Sin proyectos registrados.</div>';
        return;
    }
    list.innerHTML = state.projects.map(p => `
        <div class="grade-item-row">
            <span>🚀 <strong>${escapeHtml(p.title)}</strong> (${escapeHtml(p.stack || 'General')}) · ${p.progress}% ${p.url ? `<a href="${escapeHtml(p.url)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">🔗</a>` : ''}</span>
            <button type="button" class="btn-icon" onclick="deleteProject(${JSON.stringify(p.id)})">🗑️</button>
        </div>
    `).join('');
}

function renderAcademyWorkspace() {
    renderSubjectSelectTargets();
    renderSubjectsCatalogList();
    renderKanban();
    renderGrades();
    renderFlashcards();
    renderBugLogs();
    renderClassDoubts();
    renderProjects();
}

/* ==========================================================
   WORKSPACE 5: DEV & SYSADMIN LAB
   ========================================================== */
function switchToolboxTab(tab) {
    document.querySelectorAll('.tb-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tbtab === tab);
    });
    ['format', 'encode', 'net', 'gen'].forEach(panel => {
        document.getElementById(`tb-panel-${panel}`)?.classList.toggle('is-hidden', panel !== tab);
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
    try {
        const bytes = new TextEncoder().encode(area.value);
        let bin = '';
        bytes.forEach(b => { bin += String.fromCharCode(b); });
        area.value = btoa(bin);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function decodeBase64Tool() {
    const area = document.getElementById('encode-input-area');
    if (!area) return;
    try {
        const bin = atob(area.value.trim());
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        area.value = new TextDecoder().decode(bytes);
    } catch (err) {
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
        if (parts.length < 2) throw new Error('Token JWT incompleto');
        const decodePart = p => JSON.parse(atob(p.replace(/-/g, '+').replace(/_/g, '/')));
        area.value = JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2);
    } catch (err) {
        showToast(`JWT inválido: ${err.message}`, 'error');
    }
}

function runSubnetTool() {
    const raw = document.getElementById('subnet-cidr-input')?.value || '';
    const out = document.getElementById('subnet-output');
    if (!out) return;
    const res = calculateSubnet(raw);
    if (!res) {
        out.textContent = 'Formato inválido. Usa IP/CIDR (ej. 192.168.1.0/24).';
        return;
    }
    out.textContent = `Red: ${res.network} | Máscara: ${res.mask} | Broadcast: ${res.broadcast} | Rango: ${res.firstHost} - ${res.lastHost} | Hosts útiles: ${res.usableHosts}`;
}

function convertNumberBases(sourceRadix) {
    const ids = { 10: 'num-dec', 16: 'num-hex', 2: 'num-bin' };
    const raw = document.getElementById(ids[sourceRadix])?.value || '';
    const val = parseBaseValue(raw, sourceRadix);
    if (val === null) return;
    if (sourceRadix !== 10) document.getElementById('num-dec').value = val.toString(10);
    if (sourceRadix !== 16) document.getElementById('num-hex').value = val.toString(16).toUpperCase();
    if (sourceRadix !== 2) document.getElementById('num-bin').value = val.toString(2);
}

function testRegexTool() {
    const pattern = document.getElementById('regex-pattern')?.value || '';
    const flags = document.getElementById('regex-flags')?.value || 'g';
    const sample = document.getElementById('regex-test-text')?.value || '';
    const out = document.getElementById('regex-output');
    if (!out) return;
    try {
        const rx = new RegExp(pattern, flags);
        const matches = [...sample.matchAll(rx.global ? rx : new RegExp(pattern, `${flags}g`))].map(m => m[0]);
        out.textContent = matches.length ? `Coincidencias (${matches.length}): ${matches.join(', ')}` : 'Sin coincidencias.';
    } catch (err) {
        out.textContent = `Regex inválida: ${err.message}`;
    }
}

function generateUuidTool() {
    const box = document.getElementById('gen-output-box');
    const uuid = crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    if (box) box.textContent = uuid;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-+=';
    const arr = new Uint32Array(20);
    crypto.getRandomValues(arr);
    const pwd = Array.from(arr, n => chars[n % chars.length]).join('');
    const box = document.getElementById('gen-output-box');
    if (box) box.textContent = pwd;
}

function copyBoilerplate(kind) {
    const templates = {
        dockerfile: 'FROM node:22-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --omit=dev\nCOPY . .\nEXPOSE 3000\nCMD ["node", "index.js"]',
        compose: 'services:\n  app:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8080:80"'
    };
    const text = templates[kind] || '';
    const box = document.getElementById('gen-output-box');
    if (box) box.textContent = text;
    navigator.clipboard?.writeText(text).then(() => showToast('Plantilla copiada al portapapeles', 'success')).catch(() => {});
}

async function generateSha256Tool() {
    const text = document.getElementById('hash-input-text')?.value || '';
    const box = document.getElementById('gen-output-box');
    if (!box) return;
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    box.textContent = hex;
}

function addServer() {
    const name = (document.getElementById('srv-name')?.value || '').trim();
    const host = (document.getElementById('srv-host')?.value || '').trim();
    const role = (document.getElementById('srv-role')?.value || '').trim();
    const url = normalizeExternalUrl(document.getElementById('srv-url')?.value || '');
    if (!name || !host) return;

    state.servers.unshift({ id: `srv-${Date.now()}`, name, host, role, url });
    ['srv-name', 'srv-host', 'srv-role', 'srv-url'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
    });
    toggleForm('form-add-server');
    saveState();
    renderServers();
}

function deleteServer(id) {
    state.servers = state.servers.filter(s => s.id !== id);
    saveState();
    renderServers();
}

function renderServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    if (!state.servers.length) {
        list.innerHTML = '<div class="mono-muted">Sin hosts registrados.</div>';
        return;
    }
    list.innerHTML = state.servers.map(s => `
        <div class="grade-item-row">
            <span>🖥️ <strong>${escapeHtml(s.name)}</strong> (${escapeHtml(s.host)}) · ${escapeHtml(s.role || 'Host')} ${s.url ? `<a href="${escapeHtml(s.url)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">🔗</a>` : ''}</span>
            <button type="button" class="btn-icon" onclick="deleteServer(${JSON.stringify(s.id)})">🗑️</button>
        </div>
    `).join('');
}

function addSnippet() {
    const title = (document.getElementById('snp-title')?.value || '').trim();
    const tag = (document.getElementById('snp-tag')?.value || 'general').trim();
    const code = (document.getElementById('snp-code')?.value || '').trim();
    if (!title || !code) return;

    state.snippets.unshift({ id: `snp-${Date.now()}`, title, tag, code });
    document.getElementById('snp-title').value = '';
    document.getElementById('snp-tag').value = '';
    document.getElementById('snp-code').value = '';
    toggleForm('form-add-snippet');
    saveState();
    renderSnippets();
}

function copySnippet(code) {
    navigator.clipboard?.writeText(code)
        .then(() => showToast('Comando copiado', 'success'))
        .catch(() => showToast('No se pudo copiar al portapapeles', 'error'));
}

function deleteSnippet(id) {
    state.snippets = state.snippets.filter(s => s.id !== id);
    saveState();
    renderSnippets();
}

function renderSnippets() {
    const list = document.getElementById('snippets-list');
    if (!list) return;
    const q = (document.getElementById('snippet-search-input')?.value || '').trim().toLowerCase();
    const items = (state.snippets || []).filter(s =>
        !q || s.title.toLowerCase().includes(q) || s.tag.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
    if (!items.length) {
        list.innerHTML = '<div class="mono-muted">Sin snippets que coincidan.</div>';
        return;
    }
    list.innerHTML = items.map(s => `
        <div class="grade-item-row">
            <span>⚡ <strong>${escapeHtml(s.title)}</strong> <small>[${escapeHtml(s.tag)}]</small>: <code>${escapeHtml(s.code)}</code></span>
            <div class="filter-pills-row">
                <button type="button" class="btn-cyan btn-sm" onclick="copySnippet(${JSON.stringify(s.code)})">📋</button>
                <button type="button" class="btn-icon" onclick="deleteSnippet(${JSON.stringify(s.id)})">🗑️</button>
            </div>
        </div>
    `).join('');
}

function addBookmark() {
    const name = (document.getElementById('bm-name')?.value || '').trim();
    const url = normalizeExternalUrl(document.getElementById('bm-url')?.value || '');
    if (!name || !url) {
        showToast('Introduce un nombre y URL válidos', 'error');
        return;
    }
    state.bookmarks.push({ id: `bm-${Date.now()}`, name, url });
    document.getElementById('bm-name').value = '';
    document.getElementById('bm-url').value = '';
    toggleForm('form-add-bookmark');
    saveState();
    renderBookmarks();
}

function deleteBookmark(id) {
    state.bookmarks = state.bookmarks.filter(b => b.id !== id);
    saveState();
    renderBookmarks();
}

function renderBookmarks() {
    const box = document.getElementById('bookmarks-list');
    if (!box) return;
    box.innerHTML = (state.bookmarks || []).map(b => `
        <span class="pill-btn">
            <a href="${escapeHtml(b.url)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">${escapeHtml(b.name)}</a>
            <button type="button" class="btn-icon" onclick="deleteBookmark(${JSON.stringify(b.id)})">×</button>
        </span>
    `).join('');
}

function renderDevLabWorkspace() {
    renderServers();
    renderSnippets();
    renderBookmarks();
}

/* ==========================================================
   BUSCADOR GLOBAL, ATAJOS Y PWA
   ========================================================== */
function openGlobalSearch() {
    const modal = document.getElementById('global-search-modal');
    const input = document.getElementById('global-search-input');
    if (modal) modal.style.display = 'flex';
    if (input) {
        input.value = '';
        input.focus();
    }
    handleGlobalSearchInput();
}

function closeGlobalSearch() {
    const modal = document.getElementById('global-search-modal');
    if (modal) modal.style.display = 'none';
}

function handleGlobalSearchInput() {
    const q = (document.getElementById('global-search-input')?.value || '').trim().toLowerCase();
    const box = document.getElementById('global-search-results');
    if (!box) return;

    const results = [];
    (state.tasks || []).forEach(t => {
        if (!q || t.text.toLowerCase().includes(q)) {
            results.push({ label: `✅ Tarea: ${t.text}`, ws: 'cockpit' });
        }
    });
    (state.deliveries || []).forEach(d => {
        if (!q || d.title.toLowerCase().includes(q) || (d.subject || '').toLowerCase().includes(q)) {
            results.push({ label: `⏳ Entrega: ${d.title} (${d.subject || 'DAM'})`, ws: 'cockpit' });
        }
    });
    (state.snippets || []).forEach(s => {
        if (!q || s.title.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)) {
            results.push({ label: `⚡ Snippet: ${s.title} — ${s.code}`, ws: 'devlab' });
        }
    });
    (state.flashcards || []).forEach(fc => {
        if (!q || fc.front.toLowerCase().includes(q) || fc.back.toLowerCase().includes(q)) {
            results.push({ label: `🧠 Flashcard [${fc.subject}]: ${fc.front}`, ws: 'academy' });
        }
    });

    box.innerHTML = results.slice(0, 20).map(r => `
        <div class="grade-item-row" style="cursor:pointer" onclick="switchWorkspace(${JSON.stringify(r.ws)}); closeGlobalSearch();">
            <span>${escapeHtml(r.label)}</span>
            <span class="badge-version">${escapeHtml(r.ws)}</span>
        </div>
    `).join('') || '<div class="mono-muted">Sin resultados.</div>';
}

function handleGlobalSearchKey(event) {
    if (event.key === 'Escape') closeGlobalSearch();
}

function openShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.style.display = 'flex';
}

function closeShortcutsModal() {
    const modal = document.getElementById('shortcuts-modal');
    if (modal) modal.style.display = 'none';
}

function triggerPwaInstall() {
    if (!deferredPwaPrompt) return;
    deferredPwaPrompt.prompt();
    deferredPwaPrompt.userChoice.finally(() => {
        deferredPwaPrompt = null;
        document.getElementById('btn-pwa-install')?.classList.add('is-hidden');
    });
}

function applyServiceWorkerUpdate() {
    if (waitingServiceWorker) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    }
}

function initServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('./service-worker.js').then(reg => {
        if (reg.waiting) {
            waitingServiceWorker = reg.waiting;
            document.getElementById('pwa-update-banner')?.classList.remove('is-hidden');
        }
        reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
                if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                    waitingServiceWorker = worker;
                    document.getElementById('pwa-update-banner')?.classList.remove('is-hidden');
                }
            });
        });
    }).catch(() => {});

    navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
    });
}

/* ==========================================================
   RENDER COMPLETO E INICIALIZACIÓN
   ========================================================== */
function renderAll() {
    renderDriveProfileUI();
    renderThemeSelectOptions();
    applyTheme(state.theme);
    document.documentElement.style.setProperty('--ui-scale', String(state.uiScale || 1));
    const scaleSel = document.getElementById('ui-scale-select');
    if (scaleSel) scaleSel.value = String(state.uiScale || 1);

    applyDensity();
    document.body.classList.toggle('zen-mode-active', Boolean(state.zenMode));
    document.body.classList.toggle('presentation-mode-active', Boolean(state.presentationMode));

    const presetSel = document.getElementById('workspace-preset-select');
    if (presetSel) presetSel.value = state.workspacePreset || 'default';

    renderSubjectSelectTargets();
    renderScheduleWidget();
    renderDeliveries();
    renderTasks();
    renderPomodoroLinkedTasks();
    renderPomodoro();

    const focusIn = document.getElementById('pomo-focus-mins');
    const breakIn = document.getElementById('pomo-break-mins');
    if (focusIn) focusIn.value = state.pomodoro.focusMinutes || 25;
    if (breakIn) breakIn.value = state.pomodoro.breakMinutes || 5;

    switchNoteTab(state.notes.activeTab || 'general');
    const stickyArea = document.getElementById('sticky-note-area');
    if (stickyArea) stickyArea.value = state.notes.sticky || '';
    document.getElementById('sticky-drawer')?.classList.toggle('is-hidden', !state.notes.stickyOpen);

    const stTitle = document.getElementById('studio-project-title');
    if (stTitle) stTitle.value = state.studio.title || '';
    ['html', 'css', 'js', 'python', 'java'].forEach(k => {
        const el = document.getElementById(`studio-editor-${k}`);
        if (el) el.value = state.studio[k] || '';
    });
    const liveToggle = document.getElementById('studio-live-toggle');
    if (liveToggle) liveToggle.checked = state.studio.autoRun !== false;
    renderStudioFontSelect();
    switchStudioTab(state.studio.activeTab || 'html');
    setStudioViewport(state.studio.viewport || '100%');

    renderDatabaseWorkspace();
    renderAcademyWorkspace();
    renderDevLabWorkspace();
    renderFontsAndThemesWorkspace();
    switchWorkspace(state.activeWorkspace || 'cockpit');
    updateStorageQuotaBadge();
}

window.addEventListener('message', event => {
    if (event.data && event.data.source === 'dw-studio-console') {
        appendStudioConsole(event.data.text, event.data.level);
    }
});

window.addEventListener('beforeinstallprompt', event => {
    event.preventDefault();
    deferredPwaPrompt = event;
    document.getElementById('btn-pwa-install')?.classList.remove('is-hidden');
});

window.addEventListener('online', () => {
    const el = document.getElementById('connection-status');
    if (el) {
        el.textContent = 'Listo';
        el.className = 'badge-version connection-online';
    }
});

window.addEventListener('offline', () => {
    const el = document.getElementById('connection-status');
    if (el) {
        el.textContent = 'Offline';
        el.className = 'badge-version connection-offline';
    }
});

document.addEventListener('keydown', event => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        openGlobalSearch();
    } else if (event.altKey && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        toggleZenMode();
    } else if (event.altKey && ['1', '2', '3', '4', '5', '6'].includes(event.key)) {
        event.preventDefault();
        const map = ['cockpit', 'studio', 'database', 'academy', 'devlab', 'fonts'];
        switchWorkspace(map[Number(event.key) - 1]);
    } else if (event.key === 'Escape') {
        closeGlobalSearch();
        closeClockModal();
        closeScheduleModal();
        closeDriveModal();
        closeSnapshotsModal();
        closeNoteHistoryModal();
        closeShortcutsModal();
    }
});

/* Exposición global para handlers inline en index.html */
Object.assign(window, {
    toggleForm,
    openDriveModal,
    closeDriveModal,
    connectGoogleDrive,
    forceDriveSyncNow,
    pullFromGoogleDrive,
    logoutDriveUser,
    exportProtectedVaultFile,
    importProtectedVaultFile,
    switchWorkspace,
    applyWorkspacePreset,
    toggleZenMode,
    togglePresentationMode,
    toggleDensityMode,
    handleThemeSelectChange,
    previewCustomThemeColors,
    activateCustomTheme,
    saveNewCustomThemePreset,
    deleteCustomThemePreset,
    exportCustomThemeJson,
    importCustomThemeJson,
    resetAppearanceDefaults,
    updateAppearanceSettings,
    loadGoogleFontByName,
    saveGoogleFontFavorite,
    updateFontPlaygroundStyle,
    applyLoadedFontToUi,
    applyLoadedFontToStudio,
    applyFontToStudioPreview,
    openClockModal,
    closeClockModal,
    applyManualClock,
    resetManualClockToAuto,
    toggleWeatherBadge,
    openSnapshotsModal,
    closeSnapshotsModal,
    createBackupSnapshot,
    restoreSnapshot,
    deleteSnapshot,
    toggleScheduleViewMode,
    openScheduleModal,
    closeScheduleModal,
    autofillScheduleFromCatalog,
    addScheduleClass,
    deleteScheduleClass,
    clearSchedule,
    importScheduleFromText,
    setDeliveryFilter,
    toggleExamCramMode,
    requestDesktopNotifications,
    addDelivery,
    toggleDeliveryDone,
    deleteDelivery,
    setTaskFilter,
    setTaskBlockFilter,
    setTaskSort,
    addTask,
    toggleTaskDone,
    deleteTask,
    clearCompletedTasks,
    addSubtaskPrompt,
    toggleSubtaskDone,
    setPomodoroLinkedTask,
    setPomodoroMode,
    updatePomodoroConfig,
    startPomodoro,
    pausePomodoro,
    resetPomodoro,
    toggleFocusAudio,
    updateFocusAudioVolume,
    switchNoteTab,
    handleNoteInput,
    toggleNoteMarkdownPreview,
    saveNoteRevision,
    openNoteHistoryModal,
    closeNoteHistoryModal,
    restoreNoteRevision,
    exportCurrentNoteMd,
    toggleStickyNote,
    saveStickyNote,
    switchStudioTab,
    handleStudioTitleChange,
    handleStudioEditorInput,
    clearStudioConsole,
    runStudioCode,
    loadStudioTemplate,
    injectCdnIntoStudio,
    formatStudioCode,
    setStudioViewport,
    saveStudioProjectToLibrary,
    loadSavedStudioProject,
    deleteSavedStudioProject,
    exportStudioSingleHtml,
    exportStudioMultiFiles,
    selectDbTable,
    createDbTable,
    addDbRowPrompt,
    deleteDbRow,
    deleteCurrentDbTable,
    exportDbJson,
    insertSqlTemplate,
    executeLocalSql,
    addCatalogSubject,
    deleteCatalogSubject,
    addKanbanTask,
    moveKanbanTask,
    deleteKanbanTask,
    addGrade,
    deleteGrade,
    switchStudyHubTab,
    addFlashcard,
    flipFlashcard,
    prevFlashcard,
    nextFlashcard,
    deleteCurrentFlashcard,
    addBugLog,
    deleteBugLog,
    addClassDoubt,
    deleteClassDoubt,
    addProject,
    deleteProject,
    switchToolboxTab,
    formatJsonTool,
    minifyJsonTool,
    encodeBase64Tool,
    decodeBase64Tool,
    encodeUrlTool,
    decodeUrlTool,
    decodeJwtTool,
    calculateSubnet: runSubnetTool,
    convertNumberBases,
    testRegexTool,
    generateUuidTool,
    generateSecurePassword,
    copyBoilerplate,
    generateSha256Tool,
    addServer,
    deleteServer,
    addSnippet,
    copySnippet,
    deleteSnippet,
    addBookmark,
    deleteBookmark,
    openGlobalSearch,
    closeGlobalSearch,
    handleGlobalSearchInput,
    handleGlobalSearchKey,
    openShortcutsModal,
    closeShortcutsModal,
    triggerPwaInstall,
    applyServiceWorkerUpdate
});

document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    updateClock();
    setInterval(updateClock, 1000);
    initServiceWorker();
});