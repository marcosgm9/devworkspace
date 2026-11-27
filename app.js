import {
    mergeState,
    createDebouncer,
    getMadridDateKey,
    getMadridClock,
    calculateSubnet as computeSubnetInfo,
    getNextRepeatDate,
    normalizeExternalUrl,
    parseBaseValue
} from './core.js';

/* ==========================================================================
   DEVWORKSPACE v7.1 - STUDIO EDITION ENGINE
   Arquitectura modular, limpia y compatible con LocalStorage + Firebase
   ========================================================================== */

const STORAGE_KEY = 'devworkspace_v7_state';
const SNAPSHOTS_KEY = 'devworkspace_v7_snapshots';
const CUSTOM_THEME_VARS = ['--bg-color', '--card-bg', '--card-border', '--text-main', '--accent-cyan', '--accent-violet'];
const STUDIO_IFRAME_ORIGIN = 'null';
const SYNC_DEBOUNCE_MS = 1200;
const FIREBASE_SDK_BASE = 'https://www.gstatic.com/firebasejs/10.12.2';

/* --------------------------------------------------------------------------
   ESTADO GLOBAL INICIAL
   -------------------------------------------------------------------------- */
const defaultState = {
    meta: {
        updatedAt: 0
    },
    activeWorkspace: 'cockpit',
    density: 'airy',
    theme: 'cyberpunk',
    customTheme: {
        name: 'Mi Tema',
        bg: '#060813',
        card: '#0d131f',
        border: '#1e293b',
        text: '#f1f5f9',
        cyan: '#38bdf8',
        violet: '#a855f7'
    },
    appearance: {
        fontSans: 'Inter',
        fontMono: 'JetBrains Mono',
        studioFont: '',
        uiScale: '1',
        favoriteFonts: ['Inter', 'JetBrains Mono', 'Fira Code', 'Space Grotesk', 'Orbitron']
    },
    weather: {
        enabled: false,
        lat: 38.68,
        lon: -6.41,
        label: 'Almendralejo'
    },
    schedule: [],
    deliveries: [],
    tasks: [],
    kanban: [
        { id: 'kb-1', title: 'Configurar entornos y SDK', subject: 'DAM', status: 'done', priority: 'low', pomos: 1 },
        { id: 'kb-2', title: 'Repasar Consultas SQL y Joins', subject: 'Bases de Datos', status: 'doing', priority: 'high', pomos: 3 },
        { id: 'kb-3', title: 'Arquitectura REST & JSON', subject: 'Acceso a Datos', status: 'todo', priority: 'medium', pomos: 2 }
    ],
    grades: [
        {
            id: 'gr-1',
            name: 'Acceso a Datos',
            target: 5.0,
            credits: 6,
            items: [
                { id: 'gi-1', title: 'Práctica Ficheros XML/JSON', score: 8.5, weight: 30 },
                { id: 'gi-2', title: 'Examen Parcial 1', score: 7.0, weight: 40 }
            ]
        }
    ],
    flashcards: [
        { id: 'fc-1', subject: 'Redes', question: '¿Qué puerto usa SSH por defecto y qué protocolo de transporte emplea?', answer: 'Puerto 22 sobre TCP.', mastered: false },
        { id: 'fc-2', subject: 'Bases de Datos', question: '¿Qué significan las siglas ACID en transacciones?', answer: 'Atomicidad, Consistencia, Aislamiento y Durabilidad.', mastered: false }
    ],
    bugLogs: [],
    doubts: [],
    teamProjects: [],
    notes: {
        general: '# Bienvenido a DevWorkspace v7.1 Studio\n\n- Usa **Live Code Studio** para probar HTML, CSS y JS en vivo.\n- Personaliza fuentes desde **Fonts & Temas**.',
        comandos: '# Comandos frecuentes\n\n```bash\ndocker ps -a\nsystemctl status nginx\n```',
        clases: '# Apuntes de clase\n\n> Usa el botón **Preview MD** para visualizar tus notas formateadas.'
    },
    noteRevisions: {
        general: [],
        comandos: [],
        clases: []
    },
    stickyNote: '',
    servers: [],
    infraChangelog: [],
    customSnippets: [],
    bookmarks: [
        { id: 'bm-1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/es/' },
        { id: 'bm-2', name: 'Google Fonts', url: 'https://fonts.google.com/' },
        { id: 'bm-3', name: 'DevDocs', url: 'https://devdocs.io/' }
    ],
    studioCurrent: {
        title: 'Mi Proyecto Web',
        html: '<div class="hero-card">\n  <span class="tag">LIVE STUDIO v7.1</span>\n  <h1>Hola, DevWorkspace</h1>\n  <p>Edita el código HTML, CSS o JS a la izquierda y mira el resultado al instante.</p>\n  <button id="demo-btn">Probar Interacción</button>\n</div>',
        css: '* { box-sizing: border-box; margin: 0; padding: 0; }\nbody {\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #060813;\n  color: #f1f5f9;\n  font-family: system-ui, sans-serif;\n  padding: 20px;\n}\n.hero-card {\n  background: #0d131f;\n  border: 1px solid #38bdf8;\n  border-radius: 14px;\n  padding: 28px;\n  max-width: 440px;\n  text-align: center;\n  box-shadow: 0 0 28px rgba(56, 189, 248, 0.22);\n}\n.tag {\n  display: inline-block;\n  font-size: 11px;\n  letter-spacing: 1px;\n  color: #38bdf8;\n  border: 1px solid rgba(56, 189, 248, 0.4);\n  padding: 3px 8px;\n  border-radius: 6px;\n  margin-bottom: 12px;\n}\nh1 { margin-bottom: 10px; font-size: 1.6rem; }\np { color: #94a3b8; line-height: 1.5; margin-bottom: 18px; }\nbutton {\n  background: #38bdf8;\n  color: #040711;\n  border: none;\n  padding: 10px 18px;\n  border-radius: 8px;\n  font-weight: 700;\n  cursor: pointer;\n}\nbutton:hover { opacity: 0.9; }',
        js: 'const btn = document.getElementById("demo-btn");\nlet clicks = 0;\nbtn?.addEventListener("click", () => {\n  clicks++;\n  console.log(`Botón pulsado ${clicks} veces`);\n  btn.textContent = `Pulsado (${clicks})`;\n});'
    },
    studioProjects: [],
    studyStats: {
        totalMinutes: 0,
        dailyLog: {}
    }
};

let appState = cloneState(defaultState);

/* Variables de runtime (no persistentes) */
let currentTaskFilter = 'all';
let currentTaskBlockFilter = 'all';
let currentTaskSort = 'created';
let currentDeliveriesFilter = 'all';
let currentNotesTab = 'general';
let isNotesPreviewMode = false;
let scheduleShowTable = false;
let examCramOnly = false;
let currentFlashcardIndex = 0;
let currentFlashcardFlipped = false;
let linkedPomodoroTaskId = '';

/* Reloj real y Pomodoro */
let clockOffsetMs = 0;
let pomoInterval = null;
let pomoRemainingSec = 25 * 60;
let pomoMode = 'focus';
let pomoInitialMins = 25;

/* Web Audio */
let audioCtx = null;
let audioMasterGain = null;
let audioActiveNodes = [];
let isAudioPlaying = false;

/* Live Code Studio */
let studioConsoleLogs = [];
let currentStudioEditorTab = 'html';
let lastPreviewedGoogleFont = 'JetBrains Mono';
let draggedKanbanId = null;

/* Firebase & PWA */
let firebaseModulesPromise = null;
let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentCloudUser = null;
let isRegisterMode = false;
let deferredInstallPrompt = null;
let waitingServiceWorker = null;
let pendingCloudUpload = false;
let lastCloudSyncTimestamp = 0;
let isApplyingRemoteState = false;

/* Undo y Edición */
let lastUndoAction = null;
let activeEditContext = null;

/* --------------------------------------------------------------------------
   UTILIDADES BASE, CODIFICACIÓN Y ALMACENAMIENTO
   -------------------------------------------------------------------------- */
function cloneState(obj) {
    if (typeof structuredClone === 'function') {
        return structuredClone(obj);
    }
    return JSON.parse(JSON.stringify(obj));
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
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function utf8ToBase64(text) {
    const bytes = new TextEncoder().encode(String(text));
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function base64ToUtf8(b64) {
    const binary = atob(String(b64).trim());
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
}

function copyTextToClipboard(text, okMsg = 'Copiado al portapapeles') {
    if (!navigator.clipboard) {
        showToast('Portapapeles no disponible en este contexto', 'error');
        return;
    }
    navigator.clipboard.writeText(String(text))
        .then(() => showToast(okMsg, 'success'))
        .catch(() => showToast('No se pudo copiar al portapapeles', 'error'));
}

function copyElementValue(elId) {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = 'value' in el ? el.value : el.textContent;
    copyTextToClipboard(val);
}

function showToast(message, type = 'info', actionLabel = '', onAction = null) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;

    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    toast.appendChild(textSpan);

    if (actionLabel && typeof onAction === 'function') {
        const actionBtn = document.createElement('button');
        actionBtn.type = 'button';
        actionBtn.className = 'btn-cyan btn-sm';
        actionBtn.textContent = actionLabel;
        actionBtn.onclick = () => {
            onAction();
            toast.remove();
        };
        toast.appendChild(actionBtn);
    }

    container.appendChild(toast);

    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(8px)';
        setTimeout(() => toast.remove(), 250);
    }, actionLabel ? 5500 : 3200);
}

function registerUndo(label, restoreFn) {
    lastUndoAction = { label, restoreFn };
    showToast(label, 'info', '↩️ Deshacer', () => {
        if (!lastUndoAction) return;
        const fn = lastUndoAction.restoreFn;
        lastUndoAction = null;
        fn();
        saveState();
        renderAll();
        showToast('Acción deshecha', 'success');
    });
}

function toggleForm(formId) {
    const el = document.getElementById(formId);
    if (!el) return;
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    if (!isVisible) {
        const firstInput = el.querySelector('input, select, textarea');
        if (firstInput) firstInput.focus();
    }
}

function saveState(options = {}) {
    const { skipTimestamp = false, skipCloud = false } = options;
    try {
        if (!skipTimestamp && !isApplyingRemoteState) {
            appState.meta = appState.meta || {};
            appState.meta.updatedAt = Date.now();
        }
        const serialized = JSON.stringify(appState);
        localStorage.setItem(STORAGE_KEY, serialized);
        updateStorageQuotaBadge(serialized.length);
        if (currentCloudUser && !skipCloud && !isApplyingRemoteState) {
            pendingCloudUpload = true;
            updateSyncStatus('saving');
            scheduleCloudSync();
        }
    } catch (_) {
        showToast('Error al guardar estado local (cuota llena)', 'error');
    }
}

function loadLocalState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const parsed = JSON.parse(raw);
        appState = mergeState(cloneState(defaultState), parsed);
        updateStorageQuotaBadge(raw.length);
    } catch (_) {
        appState = cloneState(defaultState);
    }
}

function updateStorageQuotaBadge(bytesLen) {
    const badge = document.getElementById('storage-quota-badge');
    if (!badge) return;
    const kb = (bytesLen / 1024).toFixed(1);
    badge.textContent = `Storage: ${kb} KB`;
}

/* --------------------------------------------------------------------------
   NAVEGACIÓN DE WORKSPACES Y PERFILES
   -------------------------------------------------------------------------- */
function switchWorkspace(wsName) {
    appState.activeWorkspace = wsName;
    document.querySelectorAll('.workspace-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ws-tab').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.ws === wsName);
    });
    const target = document.getElementById(`ws-${wsName}`);
    if (target) target.classList.add('active');

    if (wsName === 'studio') {
        runStudioPreview();
        updateStudioEditorMetrics();
    }
    saveState({ skipTimestamp: true, skipCloud: true });
}

function applyWorkspacePreset(preset) {
    const allCardIds = [
        'card-schedule', 'card-deliveries', 'card-tasks', 'card-pomodoro',
        'card-notes', 'card-kanban', 'card-grades', 'card-study-hub',
        'card-projects', 'card-dev-toolbox', 'card-servers', 'card-snippets', 'card-bookmarks'
    ];

    allCardIds.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.remove('hidden-card');
    });

    if (preset === 'today') {
        switchWorkspace('cockpit');
        ['card-notes'].forEach(id => document.getElementById(id)?.classList.add('hidden-card'));
    } else if (preset === 'exam') {
        switchWorkspace('academy');
        ['card-projects'].forEach(id => document.getElementById(id)?.classList.add('hidden-card'));
        examCramOnly = true;
        renderKanban();
    } else if (preset === 'dev') {
        switchWorkspace('studio');
    } else if (preset === 'sysadmin') {
        switchWorkspace('devlab');
    } else {
        examCramOnly = false;
        renderKanban();
    }
    showToast(`Perfil aplicado: ${preset.toUpperCase()}`, 'info');
}

function toggleZenMode() {
    document.body.classList.toggle('zen-mode-active');
    const active = document.body.classList.contains('zen-mode-active');
    document.getElementById('btn-zen-mode')?.classList.toggle('active', active);
    if (active) switchWorkspace('cockpit');
}

function togglePresentationMode() {
    document.body.classList.toggle('presentation-mode-active');
    const active = document.body.classList.contains('presentation-mode-active');
    document.getElementById('btn-present-mode')?.classList.toggle('active', active);
    showToast(active ? 'Modo Clase activado: datos sensibles difuminados' : 'Modo Clase desactivado');
}

function toggleDensityMode() {
    appState.density = appState.density === 'compact' ? 'airy' : 'compact';
    applyDensityMode();
    saveState();
}

function applyDensityMode() {
    const isCompact = appState.density === 'compact';
    document.body.classList.toggle('density-compact', isCompact);
    const btn = document.getElementById('btn-density-mode');
    if (btn) btn.textContent = isCompact ? '📐 Compacto' : '📐 Aireado';
}

/* --------------------------------------------------------------------------
   TEMAS Y GOOGLE FONTS DINÁMICOS
   -------------------------------------------------------------------------- */
function applyTheme(themeName) {
    appState.theme = themeName;
    document.documentElement.setAttribute('data-theme', themeName);
    const select = document.getElementById('theme-select');
    if (select) select.value = themeName;

    if (themeName === 'custom') {
        applyCustomThemeVariables(appState.customTheme);
    } else {
        CUSTOM_THEME_VARS.forEach(v => document.documentElement.style.removeProperty(v));
    }
    saveState();
}

function syncCustomThemeInputs() {
    const c = appState.customTheme || defaultState.customTheme;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.value = val;
    };
    setVal('custom-theme-name', c.name || 'Mi Tema');
    setVal('cp-bg', c.bg || '#060813');
    setVal('cp-card', c.card || '#0d131f');
    setVal('cp-border', c.border || '#1e293b');
    setVal('cp-text', c.text || '#f1f5f9');
    setVal('cp-cyan', c.cyan || '#38bdf8');
    setVal('cp-violet', c.violet || '#a855f7');
}

function applyCustomThemeVariables(c) {
    if (!c) return;
    const root = document.documentElement.style;
    root.setProperty('--bg-color', c.bg);
    root.setProperty('--card-bg', c.card);
    root.setProperty('--card-border', c.border);
    root.setProperty('--text-main', c.text);
    root.setProperty('--accent-cyan', c.cyan);
    root.setProperty('--accent-violet', c.violet);
}

function previewCustomThemeColors() {
    appState.customTheme = {
        name: document.getElementById('custom-theme-name')?.value || 'Mi Tema',
        bg: document.getElementById('cp-bg')?.value || '#060813',
        card: document.getElementById('cp-card')?.value || '#0d131f',
        border: document.getElementById('cp-border')?.value || '#1e293b',
        text: document.getElementById('cp-text')?.value || '#f1f5f9',
        cyan: document.getElementById('cp-cyan')?.value || '#38bdf8',
        violet: document.getElementById('cp-violet')?.value || '#a855f7'
    };
    if (appState.theme === 'custom') {
        applyCustomThemeVariables(appState.customTheme);
    }
}

function activateCustomTheme() {
    previewCustomThemeColors();
    applyTheme('custom');
    showToast(`Tema personalizado "${appState.customTheme.name}" activado`, 'success');
}

function exportCustomThemeJson() {
    previewCustomThemeColors();
    const blob = new Blob([JSON.stringify(appState.customTheme, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${(appState.customTheme.name || 'tema-devworkspace').toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importCustomThemeJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(String(e.target?.result || '{}'));
            appState.customTheme = mergeState(cloneState(defaultState.customTheme), parsed);
            syncCustomThemeInputs();
            applyTheme('custom');
            showToast(`Tema "${appState.customTheme.name}" importado`, 'success');
        } catch (_) {
            showToast('Archivo de tema JSON inválido', 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function buildGoogleFontUrl(fontFamily) {
    const encoded = encodeURIComponent(fontFamily.trim()).replace(/%20/g, '+');
    return `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;500;600;700&display=swap`;
}

function injectGoogleFontStylesheet(fontFamily) {
    if (!fontFamily) return;
    const id = `gf-link-${fontFamily.toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = buildGoogleFontUrl(fontFamily);
    document.head.appendChild(link);
}

function loadGoogleFontByName() {
    const input = document.getElementById('gf-input-name');
    const name = input?.value.trim();
    if (!name) return showToast('Escribe el nombre de una fuente de Google Fonts', 'error');
    quickLoadGoogleFont(name);
}

function quickLoadGoogleFont(fontName) {
    injectGoogleFontStylesheet(fontName);
    lastPreviewedGoogleFont = fontName;
    const input = document.getElementById('gf-input-name');
    if (input) input.value = fontName;

    const label = document.getElementById('gf-active-preview-label');
    if (label) label.textContent = `Vista previa: ${fontName}`;

    const sample = document.getElementById('gf-preview-sample');
    if (sample) sample.style.fontFamily = `'${fontName}', monospace`;

    updateFontPlaygroundStyle();
    showToast(`Fuente "${fontName}" cargada`, 'success');
}

function updateFontPlaygroundStyle() {
    const sample = document.getElementById('gf-preview-sample');
    const size = document.getElementById('gf-preview-size')?.value || '18';
    if (sample) sample.style.fontSize = `${size}px`;
}

function saveGoogleFontFavorite() {
    const name = (document.getElementById('gf-input-name')?.value || lastPreviewedGoogleFont).trim();
    if (!name) return;
    if (!appState.appearance.favoriteFonts.includes(name)) {
        appState.appearance.favoriteFonts.push(name);
        saveState();
        renderFavoriteFonts();
        showToast(`"${name}" guardada en favoritas`, 'success');
    } else {
        showToast('Esa fuente ya está en favoritas');
    }
}

function removeGoogleFontFavorite(fontName) {
    appState.appearance.favoriteFonts = appState.appearance.favoriteFonts.filter(f => f !== fontName);
    saveState();
    renderFavoriteFonts();
}

function renderFavoriteFonts() {
    const container = document.getElementById('gf-favorites-list');
    if (!container) return;
    container.innerHTML = appState.appearance.favoriteFonts.map(font => `
        <span class="pill-btn">
            <span onclick="quickLoadGoogleFont('${escapeHtml(font)}')">${escapeHtml(font)}</span>
            <button type="button" class="btn-icon" onclick="removeGoogleFontFavorite('${escapeHtml(font)}')" title="Quitar">×</button>
        </span>
    `).join('');

    const studioSelect = document.getElementById('studio-font-select');
    if (studioSelect) {
        const current = appState.appearance.studioFont || '';
        studioSelect.innerHTML = `<option value="">🔤 Fuente Preview (Por defecto)</option>` +
            appState.appearance.favoriteFonts.map(f => `<option value="${escapeHtml(f)}" ${f === current ? 'selected' : ''}>${escapeHtml(f)}</option>`).join('');
    }
}

function applyLoadedFontToUi(targetType) {
    const font = lastPreviewedGoogleFont;
    if (!font) return;
    injectGoogleFontStylesheet(font);
    if (targetType === 'sans') {
        appState.appearance.fontSans = font;
        document.documentElement.style.setProperty('--font-sans', `'${font}', system-ui, sans-serif`);
        showToast(`Fuente UI cambiada a "${font}"`, 'success');
    } else {
        appState.appearance.fontMono = font;
        document.documentElement.style.setProperty('--font-mono', `'${font}', monospace`);
        showToast(`Fuente Código/Terminal cambiada a "${font}"`, 'success');
    }
    saveState();
}

function applyLoadedFontToStudio() {
    const font = lastPreviewedGoogleFont;
    if (!font) return;
    appState.appearance.studioFont = font;
    renderFavoriteFonts();
    saveState();
    runStudioPreview();
    showToast(`Fuente "${font}" aplicada en Live Code Studio`, 'success');
}

function applyFontToStudioPreview(fontName) {
    appState.appearance.studioFont = fontName;
    saveState();
    runStudioPreview();
}

function updateAppearanceSettings() {
    const scale = document.getElementById('ui-scale-select')?.value || '1';
    appState.appearance.uiScale = scale;
    document.documentElement.style.setProperty('--ui-scale', scale);
    saveState();
}

function applyAllAppearance() {
    const { fontSans, fontMono, uiScale } = appState.appearance;
    [fontSans, fontMono].forEach(font => {
        if (font && font !== 'Inter' && font !== 'JetBrains Mono') {
            injectGoogleFontStylesheet(font);
        }
    });
    document.documentElement.style.setProperty('--font-sans', `'${fontSans}', system-ui, sans-serif`);
    document.documentElement.style.setProperty('--font-mono', `'${fontMono}', monospace`);
    document.documentElement.style.setProperty('--ui-scale', uiScale || '1');
    const scaleSelect = document.getElementById('ui-scale-select');
    if (scaleSelect) scaleSelect.value = uiScale || '1';
    syncCustomThemeInputs();
    renderFavoriteFonts();
}

function resetAppearanceDefaults() {
    appState.appearance.fontSans = 'Inter';
    appState.appearance.fontMono = 'JetBrains Mono';
    appState.appearance.studioFont = '';
    appState.appearance.uiScale = '1';
    applyAllAppearance();
    saveState();
    showToast('Tipografía y escala base restauradas', 'info');
}

/* --------------------------------------------------------------------------
   RELOJ EN TIEMPO REAL (MADRID) Y CLIMA OPCIONAL
   -------------------------------------------------------------------------- */
async function syncRealTimeNetwork() {
    const statusEl = document.getElementById('net-status');
    if (statusEl) {
        statusEl.textContent = '🔄 Sincronizando...';
        statusEl.style.color = '';
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3500);
    try {
        const res = await fetch('https://gateway.timeapi.world/timezone/Europe/Madrid', {
            cache: 'no-store',
            signal: controller.signal
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const serverMs = typeof data.unixtime === 'number'
            ? data.unixtime * 1000
            : new Date(data.datetime).getTime();

        if (!Number.isFinite(serverMs)) throw new Error('Fecha inválida');

        clockOffsetMs = serverMs - Date.now();
        if (statusEl) {
            statusEl.textContent = '🟢 Hora Madrid Sync';
            statusEl.style.color = 'var(--accent-green)';
        }
    } catch (_) {
        clockOffsetMs = 0;
        if (statusEl) {
            statusEl.textContent = '🟡 Hora Sistema (Madrid)';
            statusEl.style.color = 'var(--accent-yellow)';
        }
    } finally {
        clearTimeout(timeoutId);
    }
    updateClockDisplay();
}

function updateClockDisplay() {
    const now = new Date(Date.now() + clockOffsetMs);
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');

    if (timeEl) {
        timeEl.textContent = new Intl.DateTimeFormat('es-ES', {
            timeZone: 'Europe/Madrid',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        }).format(now);
    }
    if (dateEl) {
        dateEl.textContent = new Intl.DateTimeFormat('es-ES', {
            timeZone: 'Europe/Madrid',
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        }).format(now);
    }
}

function toggleWeatherWidget() {
    appState.weather.enabled = !appState.weather.enabled;
    if (appState.weather.enabled && navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            pos => {
                appState.weather.lat = Number(pos.coords.latitude.toFixed(3));
                appState.weather.lon = Number(pos.coords.longitude.toFixed(3));
                appState.weather.label = 'Ubicación actual';
                saveState();
                fetchLocalWeather();
            },
            () => {
                saveState();
                fetchLocalWeather();
            },
            { timeout: 4000 }
        );
    } else {
        saveState();
        fetchLocalWeather();
    }
}

async function fetchLocalWeather() {
    const textEl = document.getElementById('weather-text');
    const btnEl = document.getElementById('weather-badge');
    if (!textEl || !btnEl) return;

    if (!appState.weather.enabled) {
        textEl.textContent = 'Clima: OFF';
        btnEl.classList.remove('active');
        return;
    }

    btnEl.classList.add('active');
    textEl.textContent = 'Cargando...';
    try {
        const { lat, lon, label } = appState.weather;
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true`;
        const res = await fetch(url);
        const data = await res.json();
        const temp = Math.round(data.current_weather.temperature);
        const wind = Math.round(data.current_weather.windspeed);
        textEl.textContent = `${label}: ${temp}°C · ${wind} km/h`;
    } catch (_) {
        textEl.textContent = 'Clima: Sin red';
    }
}

/* --------------------------------------------------------------------------
   HORARIO & CLASE ACTUAL
   -------------------------------------------------------------------------- */
const DAYS_MAP = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function parseMinutes(hhmm) {
    const [h, m] = String(hhmm).split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
}

function toggleScheduleViewMode() {
    scheduleShowTable = !scheduleShowTable;
    renderScheduleWidget();
}

function renderScheduleWidget() {
    const container = document.getElementById('schedule-widget');
    if (!container) return;

    const now = new Date(Date.now() + clockOffsetMs);
    const madridClock = getMadridClock(now);
    const currentDay = madridClock.day;
    const currentMins = madridClock.minutes;

    if (scheduleShowTable) {
        if (!appState.schedule.length) {
            container.innerHTML = `<div class="mono-muted">No hay clases configuradas. Pulsa "Configurar" para añadir tu horario.</div>`;
            return;
        }
        const sorted = [...appState.schedule].sort((a, b) => a.day - b.day || parseMinutes(a.start) - parseMinutes(b.start));
        container.innerHTML = `
            <table class="sch-table">
                <thead><tr><th>Día</th><th>Hora</th><th>Asignatura</th><th>Aula</th></tr></thead>
                <tbody>
                    ${sorted.map(c => `
                        <tr>
                            <td>${DAYS_MAP[c.day] || ''}</td>
                            <td>${escapeHtml(c.start)} - ${escapeHtml(c.end)}</td>
                            <td><strong>${escapeHtml(c.subject)}</strong></td>
                            <td>${escapeHtml(c.room || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    const todayClasses = appState.schedule
        .filter(c => Number(c.day) === currentDay)
        .sort((a, b) => parseMinutes(a.start) - parseMinutes(b.start));

    if (!todayClasses.length) {
        container.innerHTML = `
            <div class="sch-status">🎉 Hoy (${DAYS_MAP[currentDay]}) no tienes clases programadas</div>
            <div class="sch-detail">Puedes cambiar a vista "Tabla / Actual" o añadir asignaturas en Configurar.</div>
        `;
        return;
    }

    const activeClass = todayClasses.find(c => currentMins >= parseMinutes(c.start) && currentMins < parseMinutes(c.end));
    const nextClass = todayClasses.find(c => parseMinutes(c.start) > currentMins);

    if (activeClass) {
        const s = parseMinutes(activeClass.start);
        const e = parseMinutes(activeClass.end);
        const pct = Math.min(100, Math.max(0, Math.round(((currentMins - s) / Math.max(1, e - s)) * 100)));
        const left = e - currentMins;
        container.innerHTML = `
            <div class="sch-status">🟢 En clase: <strong>${escapeHtml(activeClass.subject)}</strong> <span class="badge-version">${escapeHtml(activeClass.room || 'Aula')}</span></div>
            <div class="sch-detail">${escapeHtml(activeClass.start)} - ${escapeHtml(activeClass.end)} · Quedan ${left} min (${pct}%) ${nextClass ? `· Siguiente: ${escapeHtml(nextClass.subject)} (${escapeHtml(nextClass.start)})` : ''}</div>
            <div class="sch-progress-track"><div class="sch-progress-fill" style="width:${pct}%"></div></div>
        `;
    } else if (nextClass) {
        const wait = parseMinutes(nextClass.start) - currentMins;
        container.innerHTML = `
            <div class="sch-status">⏳ Próxima clase: <strong>${escapeHtml(nextClass.subject)}</strong> a las ${escapeHtml(nextClass.start)}</div>
            <div class="sch-detail">Empieza en ${wait} min · Aula: ${escapeHtml(nextClass.room || '-')}</div>
        `;
    } else {
        container.innerHTML = `
            <div class="sch-status">✅ Jornada lectiva de hoy completada</div>
            <div class="sch-detail">Todas las clases del ${DAYS_MAP[currentDay]} han finalizado.</div>
        `;
    }
}

function openScheduleModal() {
    document.getElementById('schedule-modal').style.display = 'flex';
    renderScheduleEditorList();
}

function closeScheduleModal() {
    document.getElementById('schedule-modal').style.display = 'none';
}

function addScheduleClass() {
    const day = Number(document.getElementById('sch-add-day')?.value || 1);
    const start = document.getElementById('sch-add-start')?.value || '';
    const end = document.getElementById('sch-add-end')?.value || '';
    const subject = document.getElementById('sch-add-subject')?.value.trim() || '';
    const room = document.getElementById('sch-add-room')?.value.trim() || '';

    if (!subject || !start || !end) return showToast('Completa asignatura y horas', 'error');
    if (parseMinutes(end) <= parseMinutes(start)) {
        return showToast('La hora de fin debe ser posterior a la de inicio', 'error');
    }

    appState.schedule.push({ id: generateId('sch'), day, start, end, subject, room });
    document.getElementById('sch-add-subject').value = '';
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
}

function deleteScheduleClass(id) {
    appState.schedule = appState.schedule.filter(c => c.id !== id);
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
}

function clearSchedule() {
    const backup = [...appState.schedule];
    appState.schedule = [];
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
    registerUndo('Horario vaciado', () => {
        appState.schedule = backup;
    });
}

function exportScheduleJson() {
    const blob = new Blob([JSON.stringify(appState.schedule, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'devworkspace-horario.json';
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importScheduleJson(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(String(e.target?.result || '[]'));
            if (!Array.isArray(parsed)) throw new Error('Formato inválido');
            appState.schedule = parsed.map(c => ({
                id: c.id || generateId('sch'),
                day: Number(c.day) || 1,
                start: String(c.start || '08:30'),
                end: String(c.end || '09:25'),
                subject: String(c.subject || 'Asignatura'),
                room: String(c.room || '')
            }));
            saveState();
            renderScheduleEditorList();
            renderScheduleWidget();
            showToast('Horario importado correctamente', 'success');
        } catch (_) {
            showToast('Archivo de horario inválido', 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function renderScheduleEditorList() {
    const container = document.getElementById('schedule-list-editor');
    if (!container) return;
    if (!appState.schedule.length) {
        container.innerHTML = `<div class="mono-muted">Aún no has añadido clases.</div>`;
        return;
    }
    const sorted = [...appState.schedule].sort((a, b) => a.day - b.day || parseMinutes(a.start) - parseMinutes(b.start));
    container.innerHTML = sorted.map(c => `
        <div class="deadline-card-item">
            <div class="deadline-card-top">
                <span><strong>${DAYS_MAP[c.day]}</strong> · ${escapeHtml(c.start)}-${escapeHtml(c.end)} · <strong>${escapeHtml(c.subject)}</strong> (${escapeHtml(c.room || '-')})</span>
                <button type="button" class="btn-icon" onclick="deleteScheduleClass('${c.id}')" title="Eliminar">🗑️</button>
            </div>
        </div>
    `).join('');
}

/* --------------------------------------------------------------------------
   ENTREGAS & EXÁMENES + NOTIFICACIONES FIABLES
   -------------------------------------------------------------------------- */
function setDeliveriesFilter(filter) {
    currentDeliveriesFilter = filter;
    ['all', 'pending', 'soon', 'exam', 'practice'].forEach(f => {
        document.getElementById(`deliv-filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderDeliveries();
}

function addDelivery() {
    const title = document.getElementById('deliv-title')?.value.trim();
    const subject = document.getElementById('deliv-subject')?.value.trim() || 'General';
    const type = document.getElementById('deliv-type')?.value || 'Práctica';
    const datetime = document.getElementById('deliv-datetime')?.value;
    const alertMins = Number(document.getElementById('deliv-alert-mins')?.value || 0);

    if (!title || !datetime) return showToast('Introduce título y fecha límite', 'error');

    const item = {
        id: generateId('deliv'),
        title,
        subject,
        type,
        datetime,
        alertMins,
        notified: false,
        done: false
    };
    appState.deliveries.push(item);

    document.getElementById('deliv-title').value = '';
    saveState();
    renderDeliveries();
    checkDueDeliveryNotifications();
    showToast('Entrega añadida', 'success');
}

function toggleDeliveryDone(id) {
    const item = appState.deliveries.find(d => d.id === id);
    if (!item) return;
    item.done = !item.done;
    saveState();
    renderDeliveries();
}

function deleteDelivery(id) {
    const index = appState.deliveries.findIndex(d => d.id === id);
    if (index === -1) return;
    const [removed] = appState.deliveries.splice(index, 1);
    saveState();
    renderDeliveries();
    registerUndo(`Entrega "${removed.title}" eliminada`, () => {
        appState.deliveries.splice(index, 0, removed);
    });
}

function editDeliveryPrompt(id) {
    const d = appState.deliveries.find(item => item.id === id);
    if (!d) return;
    openEditItemModal('Editar Entrega / Examen', [
        { key: 'title', label: 'Título', type: 'text', value: d.title },
        { key: 'subject', label: 'Módulo', type: 'text', value: d.subject },
        {
            key: 'type',
            label: 'Tipo',
            type: 'select',
            value: d.type,
            options: [
                { value: 'Práctica', label: 'Práctica' },
                { value: 'Examen', label: 'Examen' },
                { value: 'Proyecto', label: 'Proyecto' }
            ]
        },
        { key: 'datetime', label: 'Fecha y hora', type: 'datetime-local', value: d.datetime }
    ], updated => {
        if (!updated.title.trim() || !updated.datetime) {
            showToast('Título y fecha son obligatorios', 'error');
            return false;
        }
        d.title = updated.title.trim();
        d.subject = updated.subject.trim() || 'General';
        d.type = updated.type;
        if (d.datetime !== updated.datetime) {
            d.datetime = updated.datetime;
            d.notified = false;
        }
        return true;
    });
}

function enableDeadlineNotifications() {
    if (!('Notification' in window)) return showToast('Tu navegador no soporta notificaciones', 'error');
    Notification.requestPermission().then(perm => {
        if (perm === 'granted') {
            showToast('Notificaciones de entregas activadas', 'success');
            checkDueDeliveryNotifications();
        } else {
            showToast('Permiso de notificaciones denegado', 'error');
        }
    });
}

function checkDueDeliveryNotifications() {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const now = Date.now() + clockOffsetMs;
    let changed = false;

    appState.deliveries.forEach(d => {
        if (d.done || d.notified || !d.alertMins) return;
        const target = new Date(d.datetime).getTime();
        const triggerTime = target - d.alertMins * 60000;
        if (now >= triggerTime && now <= target + 3600000) {
            d.notified = true;
            changed = true;
            new Notification(`⏳ ${d.type}: ${d.title}`, {
                body: `Módulo: ${d.subject} · Fecha límite próxima`
            });
        }
    });

    if (changed) saveState();
}

function renderDeliveries() {
    const container = document.getElementById('deliveries-list');
    if (!container) return;

    const now = Date.now() + clockOffsetMs;
    let list = [...appState.deliveries].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (currentDeliveriesFilter === 'pending') list = list.filter(d => !d.done);
    if (currentDeliveriesFilter === 'soon') list = list.filter(d => !d.done && (new Date(d.datetime) - now) <= 48 * 3600000);
    if (currentDeliveriesFilter === 'exam') list = list.filter(d => d.type === 'Examen');
    if (currentDeliveriesFilter === 'practice') list = list.filter(d => d.type === 'Práctica');

    if (!list.length) {
        container.innerHTML = `<div class="mono-muted">No hay entregas en esta vista.</div>`;
        return;
    }

    container.innerHTML = list.map(d => {
        const diffMs = new Date(d.datetime).getTime() - now;
        const hours = Math.round(diffMs / 3600000);
        let badgeClass = 'cd-ok';
        let badgeText = hours >= 24 ? `${Math.floor(hours / 24)}d ${hours % 24}h` : `${hours}h`;

        if (d.done) {
            badgeClass = 'cd-done';
            badgeText = 'Entregada';
        } else if (diffMs < 0) {
            badgeClass = 'cd-urgent';
            badgeText = 'Vencida';
        } else if (hours <= 48) {
            badgeClass = 'cd-warn';
        }

        return `
            <div class="deadline-card-item">
                <div class="deadline-card-top">
                    <div>
                        <span class="deadline-title">${escapeHtml(d.title)}</span>
                        <div class="deadline-meta">
                            <span>[${escapeHtml(d.type)}]</span>
                            <span>${escapeHtml(d.subject)}</span>
                            <span>· ${escapeHtml(d.datetime.replace('T', ' '))}</span>
                        </div>
                    </div>
                    <div class="filter-pills-row">
                        <span class="countdown-badge ${badgeClass}">${badgeText}</span>
                        <button type="button" class="btn-icon" onclick="editDeliveryPrompt('${d.id}')" title="Editar">✏️</button>
                        <button type="button" class="btn-icon" onclick="toggleDeliveryDone('${d.id}')" title="Completar">${d.done ? '↩️' : '✅'}</button>
                        <button type="button" class="btn-icon" onclick="deleteDelivery('${d.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/* --------------------------------------------------------------------------
   TAREAS, SUBTAREAS Y BLOQUES DE JORNADA
   -------------------------------------------------------------------------- */
function setTaskFilter(filter) {
    currentTaskFilter = filter;
    ['all', 'pending', 'done', 'today', 'overdue'].forEach(f => {
        document.getElementById(`filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderTasks();
}

function setTaskBlockFilter(block) {
    currentTaskBlockFilter = block || 'all';
    renderTasks();
}

function setTaskSort(sort) {
    currentTaskSort = sort;
    renderTasks();
}

function addTask() {
    const textEl = document.getElementById('task-text');
    const text = textEl?.value.trim();
    if (!text) return;

    const block = document.getElementById('task-block')?.value || 'afternoon';
    const priority = document.getElementById('task-priority')?.value || 'medium';
    const date = document.getElementById('task-date')?.value || '';
    const repeat = document.getElementById('task-repeat')?.value || '';

    appState.tasks.unshift({
        id: generateId('task'),
        text,
        block,
        priority,
        date,
        repeat,
        done: false,
        pomosSpent: 0,
        subtasks: [],
        createdAt: Date.now()
    });

    textEl.value = '';
    saveState();
    renderTasks();
    renderPomodoroTaskSelect();
    updateStudyStats();
}

function toggleTaskDone(id) {
    const t = appState.tasks.find(item => item.id === id);
    if (!t) return;
    t.done = !t.done;

    if (t.done && t.repeat) {
        const baseDate = t.date || getMadridDateKey(new Date(Date.now() + clockOffsetMs));
        let nextDate = '';
        try {
            nextDate = getNextRepeatDate(baseDate, t.repeat);
        } catch (error) {
            if (!(error instanceof TypeError)) throw error;
        }
        if (nextDate) {
            appState.tasks.unshift({
                ...t,
                id: generateId('task'),
                done: false,
                pomosSpent: 0,
                date: nextDate,
                subtasks: (t.subtasks || []).map(st => ({ ...st, done: false })),
                createdAt: Date.now()
            });
            showToast(`Siguiente repetición programada para ${nextDate}`, 'info');
        }
    }
    saveState();
    renderTasks();
    renderPomodoroTaskSelect();
    updateStudyStats();
}

function deleteTask(id) {
    const index = appState.tasks.findIndex(t => t.id === id);
    if (index === -1) return;
    const [removed] = appState.tasks.splice(index, 1);
    if (linkedPomodoroTaskId === id) linkedPomodoroTaskId = '';
    saveState();
    renderTasks();
    renderPomodoroTaskSelect();
    updateStudyStats();
    registerUndo(`Tarea "${removed.text}" eliminada`, () => {
        appState.tasks.splice(index, 0, removed);
    });
}

function editTaskPrompt(id) {
    const t = appState.tasks.find(item => item.id === id);
    if (!t) return;
    openEditItemModal('Editar Tarea', [
        { key: 'text', label: 'Descripción', type: 'text', value: t.text },
        {
            key: 'block',
            label: 'Bloque horario',
            type: 'select',
            value: t.block || 'afternoon',
            options: [
                { value: 'morning', label: '🌅 Mañana' },
                { value: 'afternoon', label: '☀️ Tarde' },
                { value: 'night', label: '🌙 Noche' }
            ]
        },
        {
            key: 'priority',
            label: 'Prioridad',
            type: 'select',
            value: t.priority || 'medium',
            options: [
                { value: 'high', label: '🔴 Alta' },
                { value: 'medium', label: '🟠 Media' },
                { value: 'low', label: '🔵 Baja' }
            ]
        },
        { key: 'date', label: 'Fecha límite', type: 'date', value: t.date || '' },
        {
            key: 'repeat',
            label: 'Repetición',
            type: 'select',
            value: t.repeat || '',
            options: [
                { value: '', label: 'Sin repetición' },
                { value: 'daily', label: 'Cada día' },
                { value: 'weekly', label: 'Cada semana' },
                { value: 'monthly', label: 'Cada mes' }
            ]
        }
    ], updated => {
        if (!updated.text.trim()) {
            showToast('La descripción no puede estar vacía', 'error');
            return false;
        }
        t.text = updated.text.trim();
        t.block = updated.block;
        t.priority = updated.priority;
        t.date = updated.date;
        t.repeat = updated.repeat;
        return true;
    });
}

function addTaskSubtask(taskId) {
    const task = appState.tasks.find(item => item.id === taskId);
    const input = document.getElementById(`subtask-input-${taskId}`);
    const text = input?.value.trim();
    if (!task || !text) return;

    task.subtasks = task.subtasks || [];
    task.subtasks.push({ id: generateId('sub'), text, done: false });
    saveState();
    renderTasks();
}

function toggleTaskSubtask(taskId, subtaskId) {
    const task = appState.tasks.find(item => item.id === taskId);
    const subtask = task?.subtasks?.find(item => item.id === subtaskId);
    if (!subtask) return;

    subtask.done = !subtask.done;
    saveState();
    renderTasks();
}

function deleteTaskSubtask(taskId, subtaskId) {
    const task = appState.tasks.find(item => item.id === taskId);
    if (!task?.subtasks) return;

    task.subtasks = task.subtasks.filter(item => item.id !== subtaskId);
    saveState();
    renderTasks();
}

function renderTasks() {
    const listEl = document.getElementById('tasks-list');
    if (!listEl) return;

    const todayStr = getMadridDateKey(new Date(Date.now() + clockOffsetMs));
    let tasks = [...appState.tasks];

    if (currentTaskFilter === 'pending') tasks = tasks.filter(t => !t.done);
    if (currentTaskFilter === 'done') tasks = tasks.filter(t => t.done);
    if (currentTaskFilter === 'today') tasks = tasks.filter(t => t.date === todayStr);
    if (currentTaskFilter === 'overdue') tasks = tasks.filter(t => !t.done && t.date && t.date < todayStr);

    if (currentTaskBlockFilter !== 'all') {
        tasks = tasks.filter(t => (t.block || 'afternoon') === currentTaskBlockFilter);
    }

    const prioWeight = { high: 1, medium: 2, low: 3 };
    const blockWeight = { morning: 1, afternoon: 2, night: 3 };

    tasks.sort((a, b) => {
        if (currentTaskSort === 'priority') return (prioWeight[a.priority] || 9) - (prioWeight[b.priority] || 9);
        if (currentTaskSort === 'block') return (blockWeight[a.block] || 9) - (blockWeight[b.block] || 9);
        if (currentTaskSort === 'date') return (a.date || '9999').localeCompare(b.date || '9999');
        return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (!tasks.length) {
        listEl.innerHTML = `<li class="mono-muted">No hay tareas en este filtro.</li>`;
        return;
    }

    const blockIcon = { morning: '🌅', afternoon: '☀️', night: '🌙' };
    const prioIcon = { high: '🔴', medium: '🟠', low: '🔵' };
    const repeatLabels = { daily: 'Diaria', weekly: 'Semanal', monthly: 'Mensual' };

    listEl.innerHTML = tasks.map(t => {
        const subtasks = Array.isArray(t.subtasks) ? t.subtasks : [];
        const doneSubCount = subtasks.filter(st => st.done).length;
        const subtaskProgressHtml = subtasks.length
            ? `<span class="subtask-progress-pill">${doneSubCount}/${subtasks.length}</span>`
            : '';
        const subtasksHtml = subtasks.map(st => `
            <div class="task-subtask-row ${st.done ? 'subtask-done' : ''}">
                <label>
                    <input type="checkbox" ${st.done ? 'checked' : ''} onchange="toggleTaskSubtask('${t.id}', '${st.id}')">
                    <span>${escapeHtml(st.text)}</span>
                </label>
                <button type="button" class="btn-icon" onclick="deleteTaskSubtask('${t.id}', '${st.id}')" title="Eliminar subtarea">✕</button>
            </div>
        `).join('');

        return `
            <li class="${t.done ? 'task-done' : ''}">
                <div class="task-main-row">
                    <label class="task-label">
                        <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskDone('${t.id}')">
                        <span>${blockIcon[t.block] || '☀️'} ${prioIcon[t.priority] || '🟠'} ${escapeHtml(t.text)}</span>
                    </label>
                    <div class="task-actions">
                        ${subtaskProgressHtml}
                        ${t.pomosSpent ? `<span class="mono-muted task-pomo-badge">🍅 ${t.pomosSpent}</span>` : ''}
                        ${t.repeat ? `<span class="mono-muted task-repeat-badge">🔁 ${repeatLabels[t.repeat] || escapeHtml(t.repeat)}</span>` : ''}
                        ${t.date ? `<span class="mono-muted">${escapeHtml(t.date)}</span>` : ''}
                        <button type="button" class="btn-icon" onclick="editTaskPrompt('${t.id}')" title="Editar tarea">✏️</button>
                        <button type="button" class="btn-icon" onclick="deleteTask('${t.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <div class="task-subtasks">
                    ${subtasksHtml}
                    <div class="task-subtask-add">
                        <input type="text" id="subtask-input-${t.id}" placeholder="Añadir subtarea..." onkeydown="if(event.key==='Enter') addTaskSubtask('${t.id}')">
                        <button type="button" class="btn-ghost btn-sm" onclick="addTaskSubtask('${t.id}')" title="Añadir subtarea">+</button>
                    </div>
                </div>
            </li>
        `;
    }).join('');
}

function exportTasksMarkdown() {
    const md = appState.tasks.map(t => `- [${t.done ? 'x' : ' '}] (${t.block}) ${t.text} ${t.date ? `[${t.date}]` : ''}`).join('\n');
    copyTextToClipboard(md || 'Sin tareas', 'Lista de tareas copiada en Markdown');
}

/* --------------------------------------------------------------------------
   POMODORO, AUDIO AMBIENTE Y MÉTRICAS
   -------------------------------------------------------------------------- */
function renderPomodoroTaskSelect() {
    const select = document.getElementById('pomo-linked-task');
    if (!select) return;
    const pendingTasks = appState.tasks.filter(t => !t.done);
    select.innerHTML = `<option value="">🎯 Sesión libre</option>` +
        pendingTasks.map(t => `<option value="${t.id}" ${t.id === linkedPomodoroTaskId ? 'selected' : ''}>🎯 ${escapeHtml(t.text.slice(0, 32))}</option>`).join('');
}

function setPomodoroLinkedTask(taskId) {
    linkedPomodoroTaskId = taskId;
}

function startCustomPomodoro(mode) {
    clearInterval(pomoInterval);
    pomoMode = mode;
    const focusMins = Math.max(1, Number(document.getElementById('pomo-focus-time')?.value || 25));
    const breakMins = Math.max(1, Number(document.getElementById('pomo-break-time')?.value || 5));

    pomoInitialMins = mode === 'break' ? breakMins : mode === 'exam' ? 60 : focusMins;
    pomoRemainingSec = pomoInitialMins * 60;
    updatePomodoroDisplay();

    pomoInterval = setInterval(() => {
        pomoRemainingSec--;
        updatePomodoroDisplay();
        if (pomoRemainingSec <= 0) {
            clearInterval(pomoInterval);
            pomoInterval = null;
            if (pomoMode !== 'break') {
                recordStudyMinutes(pomoInitialMins);
                if (linkedPomodoroTaskId) {
                    const linked = appState.tasks.find(t => t.id === linkedPomodoroTaskId);
                    if (linked) {
                        linked.pomosSpent = (linked.pomosSpent || 0) + 1;
                        saveState();
                        renderTasks();
                    }
                }
            }
            playBellChime();
            showToast(`¡Sesión ${pomoMode.toUpperCase()} completada!`, 'success');
        }
    }, 1000);
}

function stopPomodoro() {
    clearInterval(pomoInterval);
    pomoInterval = null;
    const focusMins = Math.max(1, Number(document.getElementById('pomo-focus-time')?.value || 25));
    pomoRemainingSec = focusMins * 60;
    updatePomodoroDisplay();
}

function updatePomodoroDisplay() {
    const disp = document.getElementById('pomodoro-display');
    if (!disp) return;
    const m = String(Math.floor(pomoRemainingSec / 60)).padStart(2, '0');
    const s = String(pomoRemainingSec % 60).padStart(2, '0');
    disp.textContent = `${m}:${s}`;
}

function recordStudyMinutes(mins) {
    const todayKey = getMadridDateKey(new Date(Date.now() + clockOffsetMs));
    appState.studyStats.totalMinutes += mins;
    appState.studyStats.dailyLog[todayKey] = (appState.studyStats.dailyLog[todayKey] || 0) + mins;
    saveState();
    updateStudyStats();
}

function updateStudyStats() {
    const todayKey = getMadridDateKey(new Date(Date.now() + clockOffsetMs));
    const todayMins = appState.studyStats.dailyLog[todayKey] || 0;
    const totalHours = (appState.studyStats.totalMinutes / 60).toFixed(1);

    let streak = 0;
    for (let i = 0; i < 365; i++) {
        const d = new Date(Date.now() + clockOffsetMs - i * 86400000);
        const key = getMadridDateKey(d);
        if ((appState.studyStats.dailyLog[key] || 0) > 0) streak++;
        else if (i > 0) break;
    }

    const totalTasks = appState.tasks.length;
    const doneTasks = appState.tasks.filter(t => t.done).length;
    const ratio = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

    document.getElementById('stat-focus-today').textContent = `${todayMins}m`;
    document.getElementById('stat-focus-total').textContent = `${totalHours}h`;
    document.getElementById('stat-streak').textContent = `🔥 ${streak}d`;
    document.getElementById('stat-ratio').textContent = `${ratio}%`;

    const barsContainer = document.getElementById('study-bars-container');
    if (!barsContainer) return;
    const last7 = [];
    let weekSum = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() + clockOffsetMs - i * 86400000);
        const key = getMadridDateKey(d);
        const mins = appState.studyStats.dailyLog[key] || 0;
        weekSum += mins;
        last7.push({ day: DAYS_MAP[getMadridClock(d).day].slice(0, 2), mins });
    }
    const maxMins = Math.max(30, ...last7.map(x => x.mins));
    document.getElementById('chart-week-sum').textContent = `${weekSum} min`;

    barsContainer.innerHTML = last7.map(item => {
        const hPct = Math.max(8, Math.round((item.mins / maxMins) * 100));
        return `
            <div class="chart-bar-col" title="${item.mins} min">
                <div class="chart-bar-fill" style="height:${hPct}%"></div>
                <span class="chart-bar-day">${item.day}</span>
            </div>
        `;
    }).join('');
}

/* Generador Web Audio (Ruido Rosa, Marrón, Lluvia y Binaural) */
function toggleNoiseGenerator() {
    if (isAudioPlaying) {
        stopNoiseGenerator();
    } else {
        startNoiseGenerator();
    }
}

function handleAudioTypeChange() {
    if (isAudioPlaying) {
        stopNoiseGenerator();
        startNoiseGenerator();
    }
}

function startNoiseGenerator() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return showToast('Web Audio API no soportada', 'error');

    audioCtx = audioCtx || new AudioContextClass();
    if (audioCtx.state === 'suspended') audioCtx.resume();

    const type = document.getElementById('audio-sound-type')?.value || 'brown';
    const vol = Number(document.getElementById('audio-volume')?.value || 40) / 100;

    audioMasterGain = audioCtx.createGain();
    audioMasterGain.gain.value = vol * 0.35;
    audioMasterGain.connect(audioCtx.destination);

    audioActiveNodes = [];

    if (type.startsWith('binaural')) {
        const beat = type === 'binaural-alpha' ? 10 : 6;
        const oscL = audioCtx.createOscillator();
        const oscR = audioCtx.createOscillator();
        const merger = audioCtx.createChannelMerger(2);
        oscL.frequency.value = 200;
        oscR.frequency.value = 200 + beat;
        oscL.connect(merger, 0, 0);
        oscR.connect(merger, 0, 1);
        merger.connect(audioMasterGain);
        oscL.start();
        oscR.start();
        audioActiveNodes.push(oscL, oscR);
    } else {
        const bufferSize = audioCtx.sampleRate * 3;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        let lastOut = 0;

        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            if (type === 'brown') {
                output[i] = (lastOut + 0.02 * white) / 1.02;
                lastOut = output[i];
                output[i] *= 3.2;
            } else if (type === 'rain') {
                const drop = Math.random() < 0.0025 ? (Math.random() * 0.9 - 0.45) : 0;
                output[i] = (lastOut * 0.72 + white * 0.28) * 0.55 + drop;
                lastOut = output[i];
            } else {
                output[i] = (lastOut + 0.12 * white) / 1.12;
                lastOut = output[i];
                output[i] *= 1.8;
            }
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        if (type === 'rain') {
            const filter = audioCtx.createBiquadFilter();
            filter.type = 'bandpass';
            filter.frequency.value = 950;
            filter.Q.value = 0.7;
            noiseSource.connect(filter);
            filter.connect(audioMasterGain);
        } else {
            noiseSource.connect(audioMasterGain);
        }

        noiseSource.start();
        audioActiveNodes.push(noiseSource);
    }

    isAudioPlaying = true;
    document.getElementById('btn-audio-toggle').textContent = '⏸ Pausar';
    document.getElementById('audio-visualizer')?.classList.add('audio-playing');
}

function stopNoiseGenerator() {
    audioActiveNodes.forEach(node => {
        try {
            node.stop();
            node.disconnect();
        } catch (_) {}
    });
    audioActiveNodes = [];
    if (audioMasterGain) {
        try {
            audioMasterGain.disconnect();
        } catch (_) {}
        audioMasterGain = null;
    }
    isAudioPlaying = false;
    const btn = document.getElementById('btn-audio-toggle');
    if (btn) btn.textContent = '▶ Audio';
    document.getElementById('audio-visualizer')?.classList.remove('audio-playing');
}

function updateAudioVolume(val) {
    document.getElementById('audio-vol-text').textContent = `${val}%`;
    if (isAudioPlaying && audioMasterGain && audioCtx) {
        audioMasterGain.gain.setTargetAtTime((Number(val) / 100) * 0.35, audioCtx.currentTime, 0.03);
    }
}

function playBellChime() {
    try {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        const ctx = audioCtx || new AudioContextClass();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.9);
    } catch (_) {}
}

/* --------------------------------------------------------------------------
   SCRATCHPAD MARKDOWN + HISTORIAL + STICKY NOTE
   -------------------------------------------------------------------------- */
function setNotesTab(tab) {
    currentNotesTab = tab;
    ['general', 'comandos', 'clases'].forEach(t => {
        document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
    });
    const area = document.getElementById('scratchpad');
    if (area) area.value = appState.notes[tab] || '';
    updateScratchpadMetrics();
    if (isNotesPreviewMode) renderScratchpadPreview();
}

function updateScratchpadMetrics() {
    const text = document.getElementById('scratchpad')?.value || '';
    const lines = text ? text.split('\n').length : 0;
    const el = document.getElementById('scratchpad-metrics');
    if (el) el.textContent = `${lines} líneas • ${text.length} caracteres`;
}

function toggleScratchpadPreview() {
    isNotesPreviewMode = !isNotesPreviewMode;
    const area = document.getElementById('scratchpad');
    const preview = document.getElementById('scratchpad-preview');
    const btn = document.getElementById('btn-notes-preview');

    if (isNotesPreviewMode) {
        renderScratchpadPreview();
        area?.classList.add('is-hidden');
        preview?.classList.remove('is-hidden');
        btn?.classList.add('active');
    } else {
        area?.classList.remove('is-hidden');
        preview?.classList.add('is-hidden');
        btn?.classList.remove('active');
    }
}

function renderScratchpadPreview() {
    const preview = document.getElementById('scratchpad-preview');
    const raw = document.getElementById('scratchpad')?.value || '';
    if (!preview) return;

    const codeBlocks = [];
    const withPlaceholders = raw.replace(/```([\s\S]*?)```/g, (_, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(`<pre><code>${escapeHtml(code.replace(/^\n+|\n+$/g, ''))}</code></pre>`);
        return `\u0000CODEBLOCK_${idx}\u0000`;
    });

    const lines = withPlaceholders.split('\n');
    const htmlParts = [];
    let inList = false;

    for (const line of lines) {
        if (line.includes('\u0000CODEBLOCK_')) {
            if (inList) {
                htmlParts.push('</ul>');
                inList = false;
            }
            htmlParts.push(line);
            continue;
        }

        const listMatch = /^\s*[-*]\s+(.+)$/.exec(line);
        if (listMatch) {
            if (!inList) {
                htmlParts.push('<ul>');
                inList = true;
            }
            htmlParts.push(`<li>${formatInlineMarkdown(listMatch[1])}</li>`);
            continue;
        }

        if (inList) {
            htmlParts.push('</ul>');
            inList = false;
        }

        if (/^###\s+/.test(line)) {
            htmlParts.push(`<h3>${formatInlineMarkdown(line.replace(/^###\s+/, ''))}</h3>`);
        } else if (/^##\s+/.test(line)) {
            htmlParts.push(`<h2>${formatInlineMarkdown(line.replace(/^##\s+/, ''))}</h2>`);
        } else if (/^#\s+/.test(line)) {
            htmlParts.push(`<h1>${formatInlineMarkdown(line.replace(/^#\s+/, ''))}</h1>`);
        } else if (/^>\s+/.test(line)) {
            htmlParts.push(`<blockquote>${formatInlineMarkdown(line.replace(/^>\s+/, ''))}</blockquote>`);
        } else if (line.trim() === '') {
            htmlParts.push('<br>');
        } else {
            htmlParts.push(`<div>${formatInlineMarkdown(line)}</div>`);
        }
    }

    if (inList) htmlParts.push('</ul>');

    let finalHtml = htmlParts.join('');
    codeBlocks.forEach((block, idx) => {
        finalHtml = finalHtml.replace(`\u0000CODEBLOCK_${idx}\u0000`, block);
    });

    preview.innerHTML = finalHtml;
}

function formatInlineMarkdown(text) {
    let escaped = escapeHtml(text);
    escaped = escaped.replace(/`([^`]+)`/g, '<code>$1</code>');
    escaped = escaped.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    escaped = escaped.replace(/\*(.+?)\*/g, '<em>$1</em>');
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        const safeUrl = normalizeExternalUrl(url);
        return safeUrl
            ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
            : label;
    });
    return escaped;
}

function wrapScratchpadSelection(prefix, suffix) {
    const area = document.getElementById('scratchpad');
    if (!area) return;
    const start = area.selectionStart;
    const end = area.selectionEnd;
    const selected = area.value.slice(start, end) || 'texto';
    const replacement = `${prefix}${selected}${suffix}`;
    area.setRangeText(replacement, start, end, 'select');
    appState.notes[currentNotesTab] = area.value;
    updateScratchpadMetrics();
    saveState();
    area.focus();
}

function toggleScratchpadFind() {
    toggleForm('scratchpad-find-bar');
}

function replaceInScratchpad(replaceAll) {
    const findVal = document.getElementById('sp-find-text')?.value;
    const repVal = document.getElementById('sp-replace-text')?.value ?? '';
    const area = document.getElementById('scratchpad');
    if (!findVal || !area) return;

    area.value = replaceAll
        ? area.value.split(findVal).join(repVal)
        : area.value.replace(findVal, repVal);

    appState.notes[currentNotesTab] = area.value;
    updateScratchpadMetrics();
    saveState();
    showToast('Reemplazo aplicado', 'success');
}

function insertNoteTemplate(tpl) {
    const templates = {
        clase: `\n## Clase - ${getMadridDateKey()}\n- **Concepto clave:** \n- **Dudas:** \n`,
        comando: `\n### Comando\n\`\`\`bash\n# Descripción\ncomando --opcion\n\`\`\`\n`,
        practica: `\n## Análisis de Práctica\n- **Objetivo:** \n- **Requisitos:** \n- **Edge cases:** \n`,
        readme: `# Nombre del Proyecto\n\n## Instalación\n\`\`\`bash\ngit clone ...\n\`\`\`\n`
    };
    if (!templates[tpl]) return;
    const area = document.getElementById('scratchpad');
    area.value += templates[tpl];
    appState.notes[currentNotesTab] = area.value;
    updateScratchpadMetrics();
    saveState();
}

function insertNoteTimestamp() {
    const area = document.getElementById('scratchpad');
    const time = document.getElementById('time')?.textContent || '';
    area.value += `\n[${getMadridDateKey()} ${time}] `;
    appState.notes[currentNotesTab] = area.value;
    saveState();
}

function insertNoteCodeBlock() {
    const area = document.getElementById('scratchpad');
    area.value += `\n\`\`\`js\n\n\`\`\`\n`;
    appState.notes[currentNotesTab] = area.value;
    saveState();
}

function openNoteHistoryModal() {
    document.getElementById('note-history-modal').style.display = 'flex';
    renderNoteHistoryList();
}

function closeNoteHistoryModal() {
    document.getElementById('note-history-modal').style.display = 'none';
}

function saveNoteRevisionManual() {
    appState.noteRevisions = appState.noteRevisions || { general: [], comandos: [], clases: [] };
    const list = appState.noteRevisions[currentNotesTab] || [];
    const content = appState.notes[currentNotesTab] || '';
    list.unshift({
        id: generateId('rev'),
        date: new Date().toLocaleString('es-ES'),
        content
    });
    appState.noteRevisions[currentNotesTab] = list.slice(0, 15);
    saveState();
    renderNoteHistoryList();
    showToast(`Versión guardada en pestaña "${currentNotesTab}"`, 'success');
}

function restoreNoteRevision(revId) {
    const list = appState.noteRevisions?.[currentNotesTab] || [];
    const rev = list.find(r => r.id === revId);
    if (!rev) return;
    appState.notes[currentNotesTab] = rev.content;
    const area = document.getElementById('scratchpad');
    if (area) area.value = rev.content;
    updateScratchpadMetrics();
    if (isNotesPreviewMode) renderScratchpadPreview();
    saveState();
    closeNoteHistoryModal();
    showToast('Versión restaurada', 'success');
}

function renderNoteHistoryList() {
    const container = document.getElementById('note-history-list');
    if (!container) return;
    const list = appState.noteRevisions?.[currentNotesTab] || [];
    if (!list.length) {
        container.innerHTML = `<div class="mono-muted">No hay versiones guardadas aún para "${escapeHtml(currentNotesTab)}".</div>`;
        return;
    }
    container.innerHTML = list.map(r => `
        <div class="deadline-card-item">
            <div class="deadline-card-top">
                <span><strong>${escapeHtml(r.date)}</strong> · ${r.content.length} chars</span>
                <button type="button" class="btn-cyan btn-sm" onclick="restoreNoteRevision('${r.id}')">Restaurar</button>
            </div>
            <div class="mono-muted">${escapeHtml(r.content.slice(0, 110))}...</div>
        </div>
    `).join('');
}

function toolCopy() {
    copyElementValue('scratchpad');
}

function toolDownload() {
    const text = document.getElementById('scratchpad')?.value || '';
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devworkspace-${currentNotesTab}-${getMadridDateKey()}.md`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyStickyNote() {
    copyElementValue('sticky-note-input');
}

function clearStickyNote() {
    appState.stickyNote = '';
    const el = document.getElementById('sticky-note-input');
    if (el) el.value = '';
    saveState();
}
/* --------------------------------------------------------------------------
   WORKSPACE 2: LIVE CODE STUDIO (HTML / CSS / JS EN VIVO)
   -------------------------------------------------------------------------- */
function switchStudioEditorTab(tab) {
    currentStudioEditorTab = tab;
    ['html', 'css', 'js', 'saved'].forEach(t => {
        document.getElementById(`ed-tab-${t}`)?.classList.toggle('active', t === tab);
        document.getElementById(`ed-pane-${t}`)?.classList.toggle('active', t === tab);
    });
    if (tab === 'saved') renderStudioSavedProjects();
    updateStudioEditorMetrics();
}

function updateStudioEditorMetrics() {
    const el = document.getElementById('studio-editor-metrics');
    if (!el) return;
    if (currentStudioEditorTab === 'saved') {
        el.textContent = `${appState.studioProjects.length} proyectos`;
        return;
    }
    const text = document.getElementById(`code-${currentStudioEditorTab}`)?.value || '';
    const lines = text ? text.split('\n').length : 0;
    el.textContent = `${lines} líneas · ${text.length} chars`;
}

function formatStudioCode() {
    if (currentStudioEditorTab === 'saved') return;
    const area = document.getElementById(`code-${currentStudioEditorTab}`);
    if (!area) return;
    const lines = area.value.split('\n');
    let indent = 0;
    const formatted = lines.map(rawLine => {
        const line = rawLine.trim();
        if (!line) return '';
        if (/^(\}|<\/|\]|\))/.test(line)) {
            indent = Math.max(0, indent - 1);
        }
        const out = '  '.repeat(indent) + line;
        if (/(\{|\[|\()\s*$/.test(line) || (/^<[a-zA-Z][^/]*>$/.test(line) && !/^<(meta|link|img|br|hr|input)\b/i.test(line))) {
            indent++;
        }
        return out;
    }).join('\n');

    area.value = formatted;
    syncStudioStateFromInputs();
    updateStudioEditorMetrics();
    if (document.getElementById('studio-autorun')?.checked) runStudioPreview();
    showToast('Código formateado', 'success');
}

function buildStudioSrcdoc(forExport = false) {
    const title = appState.studioCurrent.title || 'Proyecto DevWorkspace';
    const html = appState.studioCurrent.html || '';
    const css = appState.studioCurrent.css || '';
    const js = appState.studioCurrent.js || '';
    const studioFont = appState.appearance.studioFont || '';

    const fontTag = studioFont
        ? `<link rel="stylesheet" href="${buildGoogleFontUrl(studioFont)}">\n<style>body { font-family: '${escapeHtml(studioFont)}', sans-serif; }</style>`
        : '';

    const consoleBridge = forExport ? '' : `
<script>
(function(){
  const send = (level, args) => {
    try {
      parent.postMessage({
        source: 'devworkspace-studio',
        level,
        msg: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')
      }, '*');
    } catch(e) {}
  };
  ['log','warn','error'].forEach(fn => {
    const orig = console[fn];
    console[fn] = function(...args) {
      send(fn, args);
      orig.apply(console, args);
    };
  });
  window.onerror = function(msg, src, line) {
    send('error', [msg + ' (línea ' + line + ')']);
  };
})();
</script>`;

    return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escapeHtml(title)}</title>
${fontTag}
<style>
${css}
</style>
</head>
<body>
${html}
${consoleBridge}
<script>
${js}
<\/script>
</body>
</html>`;
}

function runStudioPreview() {
    syncStudioStateFromInputs();
    const iframe = document.getElementById('studio-preview-iframe');
    if (!iframe) return;
    studioConsoleLogs = [];
    renderStudioConsole();
    iframe.srcdoc = buildStudioSrcdoc(false);
}

function syncStudioStateFromInputs() {
    appState.studioCurrent.title = document.getElementById('studio-project-title')?.value || 'Mi Proyecto Web';
    appState.studioCurrent.html = document.getElementById('code-html')?.value || '';
    appState.studioCurrent.css = document.getElementById('code-css')?.value || '';
    appState.studioCurrent.js = document.getElementById('code-js')?.value || '';
}

function setStudioViewport(widthVal) {
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.style.width = widthVal;

    document.getElementById('vp-desktop')?.classList.toggle('active', widthVal === '100%');
    document.getElementById('vp-tablet')?.classList.toggle('active', widthVal === '768px');
    document.getElementById('vp-mobile')?.classList.toggle('active', widthVal === '375px');
}

function toggleStudioFullscreen() {
    document.getElementById('studio-workbench')?.classList.toggle('studio-fullscreen');
}

function clearStudioConsole() {
    studioConsoleLogs = [];
    renderStudioConsole();
}

function renderStudioConsole() {
    const out = document.getElementById('studio-console-output');
    const count = document.getElementById('studio-console-count');
    const filter = document.getElementById('studio-console-filter')?.value || 'all';

    const filtered = filter === 'all'
        ? studioConsoleLogs
        : studioConsoleLogs.filter(item => item.level === filter);

    if (count) count.textContent = `${filtered.length} logs`;
    if (!out) return;
    out.innerHTML = filtered.map(item => `
        <div class="console-line-${item.level}">[${item.time}] [${item.level.toUpperCase()}] ${escapeHtml(item.msg)}</div>
    `).join('');
    out.scrollTop = out.scrollHeight;
}

function loadStudioTemplate(tpl) {
    const templates = {
        blank: {
            title: 'HTML5 Base',
            html: '<main class="container">\n  <h1>Nuevo Proyecto HTML5</h1>\n  <p>Empieza a construir aquí.</p>\n</main>',
            css: 'body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }',
            js: 'console.log("Plantilla cargada");'
        },
        cybercard: {
            title: 'Tarjeta Cyberpunk Neon',
            html: '<div class="cyber-card">\n  <h2>SYSTEM ONLINE</h2>\n  <p>Interfaz HUD lista para producción.</p>\n</div>',
            css: 'body { background:#05070e; color:#e2e8f0; display:grid; place-items:center; min-height:100vh; font-family:monospace; }\n.cyber-card { border:1px solid #38bdf8; padding:24px; border-radius:10px; box-shadow:0 0 24px rgba(56,189,248,.3); }',
            js: ''
        },
        flexgrid: {
            title: 'Flexbox & Grid Demo',
            html: '<section class="grid">\n  <div class="box">01</div>\n  <div class="box">02</div>\n  <div class="box">03</div>\n</section>',
            css: 'body { background:#0b1120; color:#fff; font-family:sans-serif; padding:20px; }\n.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(120px,1fr)); gap:12px; }\n.box { background:#1e293b; border:1px solid #38bdf8; padding:30px; text-align:center; border-radius:8px; font-weight:bold; }',
            js: ''
        },
        domlab: {
            title: 'Laboratorio DOM JS',
            html: '<input id="item-in" placeholder="Escribe algo...">\n<button id="add-btn">Añadir</button>\n<ul id="list"></ul>',
            css: 'body { font-family:sans-serif; background:#090d16; color:#f1f5f9; padding:20px; }\ninput, button { padding:8px; margin-right:6px; }',
            js: 'document.getElementById("add-btn").onclick = () => {\n  const val = document.getElementById("item-in").value;\n  if(!val) return;\n  const li = document.createElement("li");\n  li.textContent = val;\n  document.getElementById("list").appendChild(li);\n  console.log("Añadido:", val);\n};'
        }
    };
    const chosen = templates[tpl];
    if (!chosen) return;
    document.getElementById('studio-project-title').value = chosen.title;
    document.getElementById('code-html').value = chosen.html;
    document.getElementById('code-css').value = chosen.css;
    document.getElementById('code-js').value = chosen.js;
    syncStudioStateFromInputs();
    saveState();
    runStudioPreview();
    updateStudioEditorMetrics();
}

function injectStudioCdn(cdn) {
    const snippets = {
        tailwind: '<script src="https://cdn.tailwindcss.com"><\/script>\n',
        bootstrap: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n',
        alpine: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"><\/script>\n',
        chartjs: '<script src="https://cdn.jsdelivr.net/npm/chart.js"><\/script>\n'
    };
    if (!snippets[cdn]) return;
    const htmlArea = document.getElementById('code-html');
    htmlArea.value = snippets[cdn] + htmlArea.value;
    syncStudioStateFromInputs();
    saveState();
    runStudioPreview();
    showToast(`CDN ${cdn} inyectado en HTML`, 'success');
}

function inspectStudioDomStructure() {
    const html = document.getElementById('code-html')?.value || '';
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const ids = [...doc.querySelectorAll('[id]')].map(el => `#${el.id}`);
    const classes = [...new Set([...doc.querySelectorAll('[class]')].flatMap(el => [...el.classList]).map(c => `.${c}`))];
    showToast(`IDs: ${ids.join(', ') || 'ninguno'} | Clases: ${classes.slice(0, 8).join(', ') || 'ninguna'}`, 'info');
}

function saveStudioProject() {
    syncStudioStateFromInputs();
    const proj = {
        id: generateId('stp'),
        title: appState.studioCurrent.title,
        html: appState.studioCurrent.html,
        css: appState.studioCurrent.css,
        js: appState.studioCurrent.js,
        updatedAt: new Date().toLocaleString('es-ES')
    };
    appState.studioProjects.unshift(proj);
    saveState();
    renderStudioSavedProjects();
    showToast(`Proyecto "${proj.title}" guardado`, 'success');
}

function loadSavedStudioProject(id) {
    const proj = appState.studioProjects.find(p => p.id === id);
    if (!proj) return;
    document.getElementById('studio-project-title').value = proj.title;
    document.getElementById('code-html').value = proj.html;
    document.getElementById('code-css').value = proj.css;
    document.getElementById('code-js').value = proj.js;
    syncStudioStateFromInputs();
    saveState();
    switchStudioEditorTab('html');
    runStudioPreview();
    showToast(`Proyecto "${proj.title}" cargado`, 'success');
}

function deleteSavedStudioProject(id) {
    const index = appState.studioProjects.findIndex(p => p.id === id);
    if (index === -1) return;
    const [removed] = appState.studioProjects.splice(index, 1);
    saveState();
    renderStudioSavedProjects();
    registerUndo(`Proyecto "${removed.title}" eliminado`, () => {
        appState.studioProjects.splice(index, 0, removed);
    });
}

function renderStudioSavedProjects() {
    const container = document.getElementById('studio-saved-projects-list');
    if (!container) return;
    if (!appState.studioProjects.length) {
        container.innerHTML = `<div class="mono-muted">No tienes proyectos guardados todavía. Pulsa "Guardar" en la barra superior.</div>`;
        return;
    }
    container.innerHTML = appState.studioProjects.map(p => `
        <div class="deadline-card-item">
            <div class="deadline-card-top">
                <div>
                    <strong>${escapeHtml(p.title)}</strong>
                    <div class="mono-muted">Guardado: ${escapeHtml(p.updatedAt)}</div>
                </div>
                <div class="filter-pills-row">
                    <button type="button" class="btn-cyan btn-sm" onclick="loadSavedStudioProject('${p.id}')">Abrir</button>
                    <button type="button" class="btn-icon" onclick="deleteSavedStudioProject('${p.id}')">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

function exportStudioSingleHtml() {
    syncStudioStateFromInputs();
    const fullHtml = buildStudioSrcdoc(true);
    const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const slug = (appState.studioCurrent.title || 'proyecto').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    a.download = `${slug}.html`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    showToast('Archivo .html autocontenido descargado', 'success');
}

function importStudioHtmlFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        const content = String(e.target?.result || '');
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const styles = [...doc.querySelectorAll('style')].map(s => s.textContent).join('\n');
        const scripts = [...doc.querySelectorAll('script:not([src])')].map(s => s.textContent).join('\n');
        doc.querySelectorAll('style, script:not([src])').forEach(el => el.remove());

        document.getElementById('studio-project-title').value = file.name.replace(/\.html?$/i, '');
        document.getElementById('code-html').value = doc.body.innerHTML.trim();
        document.getElementById('code-css').value = styles.trim();
        document.getElementById('code-js').value = scripts.trim();
        syncStudioStateFromInputs();
        saveState();
        runStudioPreview();
        updateStudioEditorMetrics();
        showToast(`Archivo "${file.name}" importado`, 'success');
        event.target.value = '';
    };
    reader.readAsText(file);
}

/* --------------------------------------------------------------------------
   ACADEMIA: KANBAN (CON DRAG & DROP), NOTAS PONDERADAS Y STUDY HUB
   -------------------------------------------------------------------------- */
function toggleExamCramFilter() {
    examCramOnly = !examCramOnly;
    document.getElementById('btn-exam-cram-mode')?.classList.toggle('active', examCramOnly);
    renderKanban();
}

function addKanbanTask() {
    const title = document.getElementById('kanban-new-title')?.value.trim();
    const subject = document.getElementById('kanban-new-subject')?.value.trim() || 'DAM';
    const pomos = Number(document.getElementById('kanban-new-pomos')?.value || 2);
    const priority = document.getElementById('kanban-new-prio')?.value || 'medium';

    if (!title) return showToast('Escribe el nombre del tema', 'error');

    appState.kanban.push({ id: generateId('kb'), title, subject, status: 'todo', priority, pomos });
    document.getElementById('kanban-new-title').value = '';
    saveState();
    renderKanban();
}

function moveKanbanTask(id, nextStatus) {
    const item = appState.kanban.find(k => k.id === id);
    if (!item || item.status === nextStatus) return;
    item.status = nextStatus;
    saveState();
    renderKanban();
}

function deleteKanbanTask(id) {
    const index = appState.kanban.findIndex(k => k.id === id);
    if (index === -1) return;
    const [removed] = appState.kanban.splice(index, 1);
    saveState();
    renderKanban();
    registerUndo(`Tema "${removed.title}" eliminado`, () => {
        appState.kanban.splice(index, 0, removed);
    });
}

function initKanbanDragAndDrop() {
    document.querySelectorAll('.kanban-col[data-kanban-col]').forEach(col => {
        col.addEventListener('dragover', e => {
            e.preventDefault();
            col.classList.add('kanban-drop-hover');
        });
        col.addEventListener('dragleave', () => {
            col.classList.remove('kanban-drop-hover');
        });
        col.addEventListener('drop', e => {
            e.preventDefault();
            col.classList.remove('kanban-drop-hover');
            const targetStatus = col.dataset.kanbanCol;
            const id = e.dataTransfer?.getData('text/plain') || draggedKanbanId;
            if (id && targetStatus) {
                moveKanbanTask(id, targetStatus);
            }
            draggedKanbanId = null;
        });
    });
}

function handleKanbanDragStart(event, id) {
    draggedKanbanId = id;
    event.currentTarget?.classList.add('dragging');
    if (event.dataTransfer) {
        event.dataTransfer.setData('text/plain', id);
        event.dataTransfer.effectAllowed = 'move';
    }
}

function handleKanbanDragEnd(event) {
    event.currentTarget?.classList.remove('dragging');
    document.querySelectorAll('.kanban-col').forEach(c => c.classList.remove('kanban-drop-hover'));
}

function renderKanban() {
    const cols = { todo: [], doing: [], done: [] };
    appState.kanban.forEach(item => {
        if (examCramOnly && item.priority !== 'high') return;
        if (cols[item.status]) cols[item.status].push(item);
    });

    ['todo', 'doing', 'done'].forEach(status => {
        const listEl = document.getElementById(`kanban-list-${status}`);
        const countEl = document.getElementById(`kanban-count-${status}`);
        if (countEl) countEl.textContent = cols[status].length;
        if (!listEl) return;

        listEl.innerHTML = cols[status].map(k => `
            <div class="kanban-card" draggable="true" ondragstart="handleKanbanDragStart(event, '${k.id}')" ondragend="handleKanbanDragEnd(event)">
                <div class="kanban-card-header">
                    <span class="kanban-subject-tag">${escapeHtml(k.subject)}</span>
                    <span>${k.priority === 'high' ? '🔴' : k.priority === 'medium' ? '🟠' : '🔵'}</span>
                </div>
                <div>${escapeHtml(k.title)}</div>
                <div class="kanban-card-footer">
                    <span>🍅 ${k.pomos}</span>
                    <div>
                        ${status !== 'todo' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask('${k.id}','todo')" title="Por estudiar">⬅️</button>` : ''}
                        ${status !== 'doing' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask('${k.id}','doing')" title="En curso">▶️</button>` : ''}
                        ${status !== 'done' ? `<button type="button" class="btn-icon" onclick="moveKanbanTask('${k.id}','done')" title="Dominado">✅</button>` : ''}
                        <button type="button" class="btn-icon" onclick="deleteKanbanTask('${k.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

/* Calculadora de Calificaciones */
function addGradeSubject() {
    const name = document.getElementById('new-grade-subj-name')?.value.trim();
    const target = Number(document.getElementById('new-grade-subj-target')?.value || 5);
    const credits = Number(document.getElementById('new-grade-subj-credits')?.value || 6);
    if (!name) return showToast('Escribe el nombre de la asignatura', 'error');

    appState.grades.push({ id: generateId('gr'), name, target, credits, items: [] });
    document.getElementById('new-grade-subj-name').value = '';
    saveState();
    renderGrades();
}

function addGradeItem(subjId) {
    const subj = appState.grades.find(g => g.id === subjId);
    if (!subj) return;
    const title = document.getElementById(`gi-title-${subjId}`)?.value.trim() || 'Prueba';
    const score = Number(document.getElementById(`gi-score-${subjId}`)?.value);
    const weight = Number(document.getElementById(`gi-weight-${subjId}`)?.value);

    if (isNaN(score) || score < 0 || score > 10 || isNaN(weight) || weight <= 0) {
        return showToast('Nota (0-10) y peso (%) válidos requeridos', 'error');
    }
    subj.items.push({ id: generateId('gi'), title, score, weight });
    saveState();
    renderGrades();
}

function deleteGradeItem(subjId, itemId) {
    const subj = appState.grades.find(g => g.id === subjId);
    if (!subj) return;
    subj.items = subj.items.filter(it => it.id !== itemId);
    saveState();
    renderGrades();
}

function deleteGradeSubject(subjId) {
    const index = appState.grades.findIndex(g => g.id === subjId);
    if (index === -1) return;
    const [removed] = appState.grades.splice(index, 1);
    saveState();
    renderGrades();
    registerUndo(`Asignatura "${removed.name}" eliminada`, () => {
        appState.grades.splice(index, 0, removed);
    });
}

function renderGrades() {
    const container = document.getElementById('grades-subjects-container');
    if (!container) return;

    let weightedCourseSum = 0;
    let totalCredits = 0;

    container.innerHTML = appState.grades.map(subj => {
        const totalWeight = subj.items.reduce((acc, it) => acc + it.weight, 0);
        const earnedPoints = subj.items.reduce((acc, it) => acc + (it.score * (it.weight / 100)), 0);
        const currentAvg = totalWeight > 0 ? (earnedPoints / (totalWeight / 100)) : 0;

        if (totalWeight > 0) {
            weightedCourseSum += currentAvg * subj.credits;
            totalCredits += subj.credits;
        }

        const remainingWeight = Math.max(0, 100 - totalWeight);
        let simulatorText = `100% evaluado · Nota final: ${earnedPoints.toFixed(2)}`;
        if (remainingWeight > 0) {
            const needed = ((subj.target - earnedPoints) / (remainingWeight / 100));
            simulatorText = needed <= 0
                ? `🎉 Objetivo (${subj.target}) ya asegurado con el ${totalWeight}% evaluado`
                : `🎯 Necesitas un ${needed.toFixed(2)} en el ${remainingWeight}% restante para llegar a ${subj.target}`;
        }

        return `
            <div class="grade-subject-card">
                <div class="grade-subj-header">
                    <span><strong>${escapeHtml(subj.name)}</strong> (${subj.credits}h · Obj: ${subj.target})</span>
                    <div class="filter-pills-row">
                        <span class="grade-subj-score ${currentAvg >= subj.target ? 'score-pass' : 'score-fail'}">${currentAvg.toFixed(2)}</span>
                        <button type="button" class="btn-icon" onclick="deleteGradeSubject('${subj.id}')">🗑️</button>
                    </div>
                </div>
                <div class="grade-progress-bar-bg"><div class="grade-progress-bar-fill" style="width:${Math.min(100, totalWeight)}%"></div></div>
                <div class="grade-needed-banner">${simulatorText}</div>
                <div class="grade-items-list">
                    ${subj.items.map(it => `
                        <div class="grade-item-row">
                            <span>${escapeHtml(it.title)}: <strong>${it.score}</strong> (${it.weight}%)</span>
                            <button type="button" class="btn-icon" onclick="deleteGradeItem('${subj.id}', '${it.id}')" title="Eliminar prueba">✕</button>
                        </div>
                    `).join('')}
                </div>
                <div class="form-inline-row">
                    <input type="text" id="gi-title-${subj.id}" placeholder="Examen / Práctica">
                    <input type="number" id="gi-score-${subj.id}" placeholder="Nota" step="0.1" min="0" max="10" class="w-75">
                    <input type="number" id="gi-weight-${subj.id}" placeholder="%" min="1" max="100" class="w-65">
                    <button type="button" class="btn-green btn-sm" onclick="addGradeItem('${subj.id}')">+</button>
                </div>
            </div>
        `;
    }).join('');

    const badge = document.getElementById('global-course-avg-badge');
    if (badge) {
        badge.textContent = totalCredits > 0 ? `Media: ${(weightedCourseSum / totalCredits).toFixed(2)}` : 'Media: --';
    }
}

/* Study Hub: Flashcards, Bug Log y Dudas */
function setStudyHubTab(tab) {
    ['flashcards', 'bugs', 'doubts'].forEach(t => {
        document.getElementById(`hub-tab-${t}`)?.classList.toggle('active', t === tab);
        document.getElementById(`hub-view-${t}`)?.classList.toggle('is-hidden', t !== tab);
    });
}

function addFlashcard() {
    const subject = document.getElementById('fc-new-subj')?.value.trim() || 'General';
    const question = document.getElementById('fc-new-q')?.value.trim();
    const answer = document.getElementById('fc-new-a')?.value.trim();
    if (!question || !answer) return showToast('Completa pregunta y respuesta', 'error');

    appState.flashcards.push({ id: generateId('fc'), subject, question, answer, mastered: false });
    document.getElementById('fc-new-q').value = '';
    document.getElementById('fc-new-a').value = '';
    saveState();
    renderFlashcards();
}

function getFilteredFlashcards() {
    const subjFilter = document.getElementById('fc-filter-subject')?.value || 'all';
    const unmasteredOnly = Boolean(document.getElementById('fc-unmastered-only')?.checked);
    return appState.flashcards.filter(c => {
        if (subjFilter !== 'all' && c.subject !== subjFilter) return false;
        if (unmasteredOnly && c.mastered) return false;
        return true;
    });
}

function renderFlashcards() {
    const select = document.getElementById('fc-filter-subject');
    if (select) {
        const current = select.value;
        const subjects = [...new Set(appState.flashcards.map(f => f.subject))];
        select.innerHTML = `<option value="all">Todas las asignaturas</option>` +
            subjects.map(s => `<option value="${escapeHtml(s)}" ${s === current ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('');
    }

    const deck = getFilteredFlashcards();
    const statsEl = document.getElementById('fc-deck-stats');
    const stage = document.getElementById('flashcard-stage');
    if (!stage) return;

    if (!deck.length) {
        if (statsEl) statsEl.textContent = '0/0';
        stage.innerHTML = `<div class="mono-muted">No hay tarjetas en este filtro.</div>`;
        return;
    }

    currentFlashcardIndex = currentFlashcardIndex % deck.length;
    const card = deck[currentFlashcardIndex];
    const masteredCount = deck.filter(c => c.mastered).length;
    if (statsEl) statsEl.textContent = `${currentFlashcardIndex + 1}/${deck.length} (✅ ${masteredCount})`;

    stage.innerHTML = currentFlashcardFlipped
        ? `<div class="fc-hint">[${escapeHtml(card.subject)}] Respuesta:</div><div class="fc-answer-text">${escapeHtml(card.answer)}</div>`
        : `<div class="fc-hint">[${escapeHtml(card.subject)}] ${card.mastered ? '✅ Dominada' : '🔄 Pendiente'} · Clic para voltear</div><div class="fc-question-text">${escapeHtml(card.question)}</div>`;
}

function flipCurrentFlashcard() {
    currentFlashcardFlipped = !currentFlashcardFlipped;
    renderFlashcards();
}

function nextFlashcard() {
    currentFlashcardIndex++;
    currentFlashcardFlipped = false;
    renderFlashcards();
}

function markFlashcardStatus(mastered) {
    const deck = getFilteredFlashcards();
    if (!deck.length) return;
    const card = deck[currentFlashcardIndex % deck.length];
    card.mastered = mastered;
    saveState();
    nextFlashcard();
}

function deleteCurrentFlashcard() {
    const deck = getFilteredFlashcards();
    if (!deck.length) return;
    const card = deck[currentFlashcardIndex % deck.length];
    const index = appState.flashcards.findIndex(f => f.id === card.id);
    if (index === -1) return;
    const [removed] = appState.flashcards.splice(index, 1);
    currentFlashcardFlipped = false;
    saveState();
    renderFlashcards();
    registerUndo('Flashcard eliminada', () => {
        appState.flashcards.splice(index, 0, removed);
    });
}

function addBugLog() {
    const subject = document.getElementById('bug-new-subj')?.value.trim() || 'Dev';
    const error = document.getElementById('bug-new-error')?.value.trim();
    const cause = document.getElementById('bug-new-cause')?.value.trim() || '-';
    const fix = document.getElementById('bug-new-fix')?.value.trim() || '-';
    if (!error) return showToast('Describe el error encontrado', 'error');

    appState.bugLogs.unshift({ id: generateId('bug'), subject, error, cause, fix, date: getMadridDateKey() });
    document.getElementById('bug-new-error').value = '';
    document.getElementById('bug-new-cause').value = '';
    document.getElementById('bug-new-fix').value = '';
    saveState();
    renderBugLogs();
}

function deleteBugLog(id) {
    appState.bugLogs = appState.bugLogs.filter(b => b.id !== id);
    saveState();
    renderBugLogs();
}

function renderBugLogs() {
    const container = document.getElementById('bug-log-list');
    if (!container) return;
    const query = (document.getElementById('bug-search-input')?.value || '').toLowerCase();
    const filtered = appState.bugLogs.filter(b =>
        b.error.toLowerCase().includes(query) || b.fix.toLowerCase().includes(query) || b.subject.toLowerCase().includes(query)
    );
    if (!filtered.length) {
        container.innerHTML = `<div class="mono-muted">Sin registros de errores.</div>`;
        return;
    }
    container.innerHTML = filtered.map(b => `
        <div class="hub-item-card">
            <div class="deadline-card-top">
                <span><strong>[${escapeHtml(b.subject)}]</strong> ${escapeHtml(b.error)}</span>
                <button type="button" class="btn-icon" onclick="deleteBugLog('${b.id}')" title="Eliminar">🗑️</button>
            </div>
            <div class="mono-muted">Causa: ${escapeHtml(b.cause)} · Solución: <span style="color:var(--accent-green)">${escapeHtml(b.fix)}</span></div>
        </div>
    `).join('');
}

function addClassDoubt() {
    const subj = document.getElementById('doubt-new-subj')?.value.trim() || 'Clase';
    const text = document.getElementById('doubt-new-text')?.value.trim();
    if (!text) return;

    appState.doubts.unshift({ id: generateId('dbt'), subj, text, resolved: false });
    document.getElementById('doubt-new-text').value = '';
    saveState();
    renderDoubts();
}

function toggleDoubtResolved(id) {
    const d = appState.doubts.find(x => x.id === id);
    if (!d) return;
    d.resolved = !d.resolved;
    saveState();
    renderDoubts();
}

function deleteClassDoubt(id) {
    appState.doubts = appState.doubts.filter(x => x.id !== id);
    saveState();
    renderDoubts();
}

function renderDoubts() {
    const container = document.getElementById('doubts-list');
    if (!container) return;
    if (!appState.doubts.length) {
        container.innerHTML = `<div class="mono-muted">No hay dudas pendientes.</div>`;
        return;
    }
    container.innerHTML = appState.doubts.map(d => `
        <div class="hub-item-card">
            <div class="deadline-card-top">
                <span style="${d.resolved ? 'text-decoration:line-through;opacity:0.6' : ''}"><strong>[${escapeHtml(d.subj)}]</strong> ${escapeHtml(d.text)}</span>
                <div class="filter-pills-row">
                    <button type="button" class="btn-icon" onclick="toggleDoubtResolved('${d.id}')" title="Marcar resuelta">${d.resolved ? '↩️' : '✅'}</button>
                    <button type="button" class="btn-icon" onclick="deleteClassDoubt('${d.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
        </div>
    `).join('');
}

function exportStudyHubMarkdown() {
    const md = [
        '# Study Hub Export',
        '## Flashcards',
        ...appState.flashcards.map(f => `- **${f.subject}**: ${f.question} -> *${f.answer}*`),
        '\n## Bug Log',
        ...appState.bugLogs.map(b => `- [${b.subject}] **${b.error}** -> ${b.fix}`)
    ].join('\n');
    copyTextToClipboard(md, 'Study Hub copiado en Markdown');
}

/* Planificador hasta Examen y Proyectos */
function calculateStudyPlan() {
    const examDateStr = document.getElementById('planner-exam-date')?.value;
    const topics = Number(document.getElementById('planner-topics-count')?.value || 1);
    const minsPerTopic = Number(document.getElementById('planner-mins-topic')?.value || 45);
    const out = document.getElementById('study-planner-result');
    if (!examDateStr || !out) return showToast('Selecciona la fecha del examen', 'error');

    const diffDays = Math.max(1, Math.ceil((new Date(examDateStr) - Date.now()) / 86400000));
    const totalMins = topics * minsPerTopic;
    const minsPerDay = Math.ceil(totalMins / diffDays);
    const pomosPerDay = Math.ceil(minsPerDay / 25);

    out.textContent = `📅 Quedan ${diffDays} días · Total: ${(totalMins / 60).toFixed(1)}h · Ritmo recomendado: ${minsPerDay} min/día (~${pomosPerDay} pomodoros/día).`;
}

function addTeamProject() {
    const name = document.getElementById('proj-new-name')?.value.trim();
    const rawRepo = document.getElementById('proj-new-repo')?.value.trim() || '';
    const repo = rawRepo ? normalizeExternalUrl(rawRepo) : '';
    const working = document.getElementById('proj-new-working')?.value.trim() || '-';
    const pending = document.getElementById('proj-new-pending')?.value.trim() || '-';

    if (!name) return showToast('Escribe el nombre del proyecto', 'error');
    if (rawRepo && !repo) return showToast('URL de repositorio inválida', 'error');

    appState.teamProjects.unshift({ id: generateId('prj'), name, repo, working, pending });
    document.getElementById('proj-new-name').value = '';
    document.getElementById('proj-new-repo').value = '';
    document.getElementById('proj-new-working').value = '';
    document.getElementById('proj-new-pending').value = '';
    saveState();
    renderTeamProjects();
}

function deleteTeamProject(id) {
    const index = appState.teamProjects.findIndex(p => p.id === id);
    if (index === -1) return;
    const [removed] = appState.teamProjects.splice(index, 1);
    saveState();
    renderTeamProjects();
    registerUndo(`Proyecto "${removed.name}" eliminado`, () => {
        appState.teamProjects.splice(index, 0, removed);
    });
}

function renderTeamProjects() {
    const container = document.getElementById('team-projects-list');
    if (!container) return;
    if (!appState.teamProjects.length) {
        container.innerHTML = `<div class="mono-muted">Sin proyectos registrados.</div>`;
        return;
    }
    container.innerHTML = appState.teamProjects.map(p => {
        const safeRepo = normalizeExternalUrl(p.repo);
        return `
            <div class="hub-item-card">
                <div class="deadline-card-top">
                    <strong>${escapeHtml(p.name)}</strong>
                    <div class="filter-pills-row">
                        ${safeRepo ? `<a href="${escapeHtml(safeRepo)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">Repo ↗</a>` : ''}
                        <button type="button" class="btn-icon" onclick="deleteTeamProject('${p.id}')">🗑️</button>
                    </div>
                </div>
                <div class="mono-muted">✅ Funciona: ${escapeHtml(p.working)}</div>
                <div class="mono-muted">🚧 Pendiente: ${escapeHtml(p.pending)}</div>
            </div>
        `;
    }).join('');
}

/* --------------------------------------------------------------------------
   WORKSPACE 4: DEV & SYSADMIN TOOLBOX + SERVIDORES + SNIPPETS
   -------------------------------------------------------------------------- */
function setToolboxTab(tab) {
    ['format', 'encode', 'regex', 'net', 'sys', 'gen'].forEach(t => {
        document.getElementById(`tb-tab-${t}`)?.classList.toggle('active', t === tab);
        document.getElementById(`tb-view-${t}`)?.classList.toggle('is-hidden', t !== tab);
    });
}

function tbFormatJson(minify) {
    const input = document.getElementById('tb-json-input');
    const status = document.getElementById('tb-json-status');
    try {
        const parsed = JSON.parse(input.value);
        input.value = JSON.stringify(parsed, null, minify ? 0 : 2);
        status.textContent = minify ? '✅ JSON minificado correctamente' : '✅ JSON válido formateado';
    } catch (err) {
        status.textContent = `❌ Error JSON: ${err.message}`;
    }
}

function tbJsonToCsv() {
    const input = document.getElementById('tb-json-input');
    const status = document.getElementById('tb-json-status');
    try {
        const arr = JSON.parse(input.value);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Se requiere un array de objetos JSON');
        const headers = Object.keys(arr[0]);
        const rows = arr.map(obj => headers.map(h => JSON.stringify(obj[h] ?? '')).join(','));
        input.value = [headers.join(','), ...rows].join('\n');
        status.textContent = '✅ Convertido a CSV';
    } catch (err) {
        status.textContent = `❌ ${err.message}`;
    }
}

function tbCsvToJson() {
    const input = document.getElementById('tb-json-input');
    const status = document.getElementById('tb-json-status');
    try {
        const lines = input.value.trim().split('\n');
        if (lines.length < 2) throw new Error('CSV insuficiente');
        const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
        const result = lines.slice(1).map(line => {
            const cols = line.split(',');
            return Object.fromEntries(headers.map((h, i) => [h, (cols[i] || '').trim().replace(/^"|"$/g, '')]));
        });
        input.value = JSON.stringify(result, null, 2);
        status.textContent = '✅ Convertido a JSON';
    } catch (err) {
        status.textContent = `❌ ${err.message}`;
    }
}

function tbFormatSql() {
    const input = document.getElementById('tb-json-input');
    const keywords = ['SELECT', 'FROM', 'WHERE', 'INNER JOIN', 'LEFT JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'INSERT INTO', 'VALUES', 'UPDATE', 'SET', 'DELETE FROM'];
    let sql = input.value.replace(/\s+/g, ' ').trim();
    keywords.forEach(kw => {
        const rx = new RegExp(`\\b${kw}\\b`, 'gi');
        sql = sql.replace(rx, `\n${kw}`);
    });
    input.value = sql.trim();
    document.getElementById('tb-json-status').textContent = '✅ SQL formateado';
}

function tbEncodeAction(action) {
    const val = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    try {
        if (action === 'b64e') out.textContent = utf8ToBase64(val);
        if (action === 'b64d') out.textContent = base64ToUtf8(val);
        if (action === 'urle') out.textContent = encodeURIComponent(val);
        if (action === 'urld') out.textContent = decodeURIComponent(val);
    } catch (err) {
        out.textContent = `Error: ${err.message}`;
    }
}

function tbDecodeJwt() {
    const token = (document.getElementById('tb-encode-input')?.value || '').trim();
    const out = document.getElementById('tb-encode-output');
    try {
        const parts = token.split('.');
        if (parts.length < 2) throw new Error('Token JWT inválido');
        const decodePart = p => JSON.parse(base64ToUtf8(p.replace(/-/g, '+').replace(/_/g, '/')));
        out.textContent = JSON.stringify({ header: decodePart(parts[0]), payload: decodePart(parts[1]) }, null, 2);
    } catch (err) {
        out.textContent = `❌ JWT inválido: ${err.message}`;
    }
}

async function tbComputeHashes() {
    const text = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    if (!crypto?.subtle) {
        out.textContent = '❌ Web Crypto API no disponible';
        return;
    }
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = `SHA-256:\n${hex}`;
}

function runRegexTester() {
    const pattern = document.getElementById('tb-regex-pattern')?.value || '';
    const flags = document.getElementById('tb-regex-flags')?.value || 'g';
    const text = document.getElementById('tb-regex-text')?.value || '';
    const resEl = document.getElementById('tb-regex-result');
    try {
        const rx = new RegExp(pattern, flags);
        const matches = [...text.matchAll(rx)].map(m => m[0]);
        resEl.textContent = matches.length ? `✅ ${matches.length} coincidencias: ${matches.join(' | ')}` : '⚠️ 0 coincidencias';
    } catch (err) {
        resEl.textContent = `❌ Regex inválida: ${err.message}`;
    }
}

function runSimpleDiff() {
    const a = (document.getElementById('tb-regex-text')?.value || '').split('\n');
    const b = (document.getElementById('tb-diff-b')?.value || '').split('\n');
    const out = document.getElementById('tb-diff-output');
    const max = Math.max(a.length, b.length);
    const diffs = [];
    for (let i = 0; i < max; i++) {
        if ((a[i] || '') !== (b[i] || '')) {
            diffs.push(`@@ Línea ${i + 1} @@\n- ${a[i] ?? '(vacío)'}\n+ ${b[i] ?? '(vacío)'}`);
        }
    }
    out.textContent = diffs.length ? diffs.join('\n\n') : '✅ Ambos bloques son idénticos';
}

function calculateSubnet() {
    const raw = (document.getElementById('tb-ip-input')?.value || '').trim();
    const out = document.getElementById('tb-subnet-output');
    if (!out) return;
    try {
        const info = computeSubnetInfo(raw);
        out.textContent = [
            `Red:        ${info.network}/${info.cidr}`,
            `Máscara:    ${info.mask}`,
            `Broadcast:  ${info.broadcast}`,
            `Rango Host: ${info.firstHost} - ${info.lastHost}`,
            `Hosts Út.:  ${info.hosts}`
        ].join('\n');
    } catch (error) {
        if (!(error instanceof TypeError)) throw error;
        out.textContent = error.message;
    }
}

function convertNumberBase(fromBase, rawVal) {
    const parsed = parseBaseValue(fromBase, rawVal);
    const ids = ['dec', 'bin', 'hex', 'oct'];
    if (!parsed.valid || parsed.value === null) {
        ids.filter(b => b !== fromBase).forEach(b => {
            const el = document.getElementById(`base-${b}`);
            if (el) el.value = '';
        });
        return;
    }
    const num = parsed.value;
    document.getElementById('base-dec').value = num.toString(10);
    document.getElementById('base-bin').value = num.toString(2);
    document.getElementById('base-hex').value = num.toString(16).toUpperCase();
    document.getElementById('base-oct').value = num.toString(8);
}

function updateChmodCalc() {
    const calc = p => (document.getElementById(`ch-${p}r`)?.checked ? 4 : 0) +
        (document.getElementById(`ch-${p}w`)?.checked ? 2 : 0) +
        (document.getElementById(`ch-${p}x`)?.checked ? 1 : 0);
    const sym = p => (document.getElementById(`ch-${p}r`)?.checked ? 'r' : '-') +
        (document.getElementById(`ch-${p}w`)?.checked ? 'w' : '-') +
        (document.getElementById(`ch-${p}x`)?.checked ? 'x' : '-');

    const oct = `${calc('u')}${calc('g')}${calc('o')}`;
    document.getElementById('chmod-octal').textContent = oct;
    document.getElementById('chmod-symbolic').textContent = `${sym('u')}${sym('g')}${sym('o')}`;
}

function copyChmodCmd() {
    const oct = document.getElementById('chmod-octal')?.textContent || '755';
    copyTextToClipboard(`chmod ${oct} archivo`, `Copiado: chmod ${oct} archivo`);
}

function explainCronExpr() {
    const raw = (document.getElementById('cron-expr-input')?.value || '').trim();
    const out = document.getElementById('cron-explanation');
    const presets = {
        '@yearly': 'Una vez al año (1 de enero a las 00:00)',
        '@monthly': 'El día 1 de cada mes a las 00:00',
        '@weekly': 'Cada domingo a las 00:00',
        '@daily': 'Todos los días a las 00:00',
        '@hourly': 'Al minuto 0 de cada hora'
    };
    if (presets[raw]) {
        out.textContent = `⏱️ ${presets[raw]}`;
        return;
    }
    const parts = raw.split(/\s+/);
    if (parts.length !== 5) {
        out.textContent = '⚠️ Formato cron estándar: minuto hora día_mes mes día_semana';
        return;
    }
    const describeField = (val, unit) => {
        if (val === '*') return `cada ${unit}`;
        if (val.startsWith('*/')) return `cada ${val.slice(2)} ${unit}s`;
        return `${unit} ${val}`;
    };
    out.textContent = `⏱️ Ejecutar en ${describeField(parts[0], 'minuto')}, ${describeField(parts[1], 'hora')}, día del mes (${parts[2]}), mes (${parts[3]}), día semana (${parts[4]}).`;
}

function generateMockUsers(count) {
    const names = ['Marcos', 'Elena', 'Carlos', 'Lucía', 'Javier', 'Sofía', 'Diego'];
    const users = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        username: `${names[i % names.length].toLowerCase()}_${100 + i}`,
        email: `user${i + 1}@devworkspace.local`,
        role: i === 0 ? 'admin' : 'developer',
        active: true
    }));
    document.getElementById('tb-gen-output').value = JSON.stringify(users, null, 2);
}

function generateUuidsAndDni() {
    const uuid = crypto.randomUUID ? crypto.randomUUID() : generateId('uuid');
    const num = Math.floor(10000000 + Math.random() * 89999999);
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const dni = `${num}${letters[num % 23]}`;
    document.getElementById('tb-gen-output').value = `UUID v4: ${uuid}\nDNI Prueba: ${dni}`;
}

function generateSecurePassword() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*_-';
    const array = new Uint32Array(16);
    crypto.getRandomValues(array);
    const pwd = [...array].map(n => chars[n % chars.length]).join('');
    document.getElementById('tb-gen-output').value = pwd;
}

function loadBoilerplate(type) {
    const files = {
        dockerfile: `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "server.js"]`,
        compose: `services:\n  app:\n    build: .\n    ports:\n      - "3000:3000"\n    restart: unless-stopped`
    };
    document.getElementById('tb-gen-output').value = files[type] || '';
}

/* Servidores & Homelab */
function addServer() {
    const name = document.getElementById('srv-name')?.value.trim();
    const ip = document.getElementById('srv-ip')?.value.trim();
    const port = document.getElementById('srv-port')?.value.trim() || '22';
    const creds = document.getElementById('srv-creds')?.value.trim() || 'root';
    const logs = document.getElementById('srv-logs')?.value.trim() || '/var/log';

    if (!name || !ip) return showToast('Nombre e IP son obligatorios', 'error');

    appState.servers.push({ id: generateId('srv'), name, ip, port, creds, logs });
    document.getElementById('srv-name').value = '';
    document.getElementById('srv-ip').value = '';
    saveState();
    renderServers();
}

function deleteServer(id) {
    const index = appState.servers.findIndex(s => s.id === id);
    if (index === -1) return;
    const [removed] = appState.servers.splice(index, 1);
    saveState();
    renderServers();
    registerUndo(`Servidor "${removed.name}" eliminado`, () => {
        appState.servers.splice(index, 0, removed);
    });
}

function exportServersJson() {
    copyTextToClipboard(JSON.stringify(appState.servers, null, 2), 'Inventario de servidores copiado en JSON');
}

function renderServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    const q = (document.getElementById('srv-search-filter')?.value || '').toLowerCase();
    const filtered = appState.servers.filter(s =>
        s.name.toLowerCase().includes(q) || s.ip.toLowerCase().includes(q) || s.logs.toLowerCase().includes(q)
    );
    if (!filtered.length) {
        list.innerHTML = `<li class="mono-muted">Sin hosts registrados.</li>`;
        return;
    }
    list.innerHTML = filtered.map(s => {
        const sshCmd = `ssh ${s.creds}@${s.ip} -p ${s.port}`;
        return `
            <li>
                <div>
                    <strong>${escapeHtml(s.name)}</strong> · <span class="snippet-cmd-text">${escapeHtml(s.creds)}@${escapeHtml(s.ip)}:${escapeHtml(s.port)}</span>
                    <div class="mono-muted">Logs: ${escapeHtml(s.logs)}</div>
                </div>
                <div class="filter-pills-row">
                    <button type="button" class="btn-cyan btn-sm" onclick="copyTextToClipboard('${escapeHtml(sshCmd)}', 'SSH copiado')" title="Copiar comando SSH">SSH</button>
                    <button type="button" class="btn-ghost btn-sm" onclick="copyTextToClipboard('${escapeHtml(s.logs)}', 'Ruta de logs copiada')" title="Copiar ruta logs">📂</button>
                    <button type="button" class="btn-icon" onclick="deleteServer('${s.id}')" title="Eliminar">🗑️</button>
                </div>
            </li>
        `;
    }).join('');
}

function addInfraChangelog() {
    const input = document.getElementById('infra-changelog-input');
    const text = input?.value.trim();
    if (!text) return;
    appState.infraChangelog.unshift({ id: generateId('chg'), date: getMadridDateKey(), text });
    input.value = '';
    saveState();
    renderInfraChangelog();
}

function renderInfraChangelog() {
    const list = document.getElementById('infra-changelog-list');
    if (!list) return;
    list.innerHTML = appState.infraChangelog.map(item => `
        <div class="mono-muted">[${escapeHtml(item.date)}] ${escapeHtml(item.text)}</div>
    `).join('');
}

/* Snippets & Bookmarks */
const BUILTIN_SNIPPETS = [
    { title: 'Conectar por SSH', cat: 'Linux', cmd: 'ssh {{USER}}@{{IP}} -p {{PORT}}' },
    { title: 'Copiar archivo vía SCP', cat: 'Linux', cmd: 'scp -P {{PORT}} archivo.tar.gz {{USER}}@{{IP}}:/tmp/' },
    { title: 'Ver contenedores activos', cat: 'Docker', cmd: 'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"' },
    { title: 'Logs en vivo de contenedor', cat: 'Docker', cmd: 'docker logs -f --tail 100 nombre_contenedor' },
    { title: 'Actualizar y levantar Compose', cat: 'Docker', cmd: 'docker compose pull && docker compose up -d' },
    { title: 'Comprobar puertos abiertos', cat: 'Redes', cmd: 'ss -tulpn' }
];

function addCustomSnippet() {
    const title = document.getElementById('snip-new-title')?.value.trim();
    const cat = document.getElementById('snip-new-cat')?.value.trim() || 'Custom';
    const cmd = document.getElementById('snip-new-cmd')?.value.trim();
    if (!title || !cmd) return showToast('Completa descripción y comando', 'error');

    appState.customSnippets.unshift({ id: generateId('snip'), title, cat, cmd });
    document.getElementById('snip-new-title').value = '';
    document.getElementById('snip-new-cmd').value = '';
    saveState();
    renderSnippets();
}

function deleteCustomSnippet(id) {
    const index = appState.customSnippets.findIndex(s => s.id === id);
    if (index === -1) return;
    const [removed] = appState.customSnippets.splice(index, 1);
    saveState();
    renderSnippets();
    registerUndo(`Snippet "${removed.title}" eliminado`, () => {
        appState.customSnippets.splice(index, 0, removed);
    });
}

function renderSnippets() {
    const container = document.getElementById('snippet-list-container');
    if (!container) return;
    const user = document.getElementById('cli-var-user')?.value || 'root';
    const ip = document.getElementById('cli-var-ip')?.value || '192.168.1.10';
    const port = document.getElementById('cli-var-port')?.value || '22';
    const query = (document.getElementById('snippet-search')?.value || '').toLowerCase();

    const all = [...appState.customSnippets, ...BUILTIN_SNIPPETS].filter(s =>
        s.title.toLowerCase().includes(query) || s.cat.toLowerCase().includes(query) || s.cmd.toLowerCase().includes(query)
    );

    container.innerHTML = all.map(s => {
        const resolved = s.cmd
            .replace(/\{\{USER\}\}/g, user)
            .replace(/\{\{IP\}\}/g, ip)
            .replace(/\{\{PORT\}\}/g, port);
        return `
            <div class="snippet-box">
                <div>
                    <div class="mono-muted">[${escapeHtml(s.cat)}] ${escapeHtml(s.title)}</div>
                    <div class="snippet-cmd-text">${escapeHtml(resolved)}</div>
                </div>
                <div class="filter-pills-row">
                    <button type="button" class="btn-cyan btn-sm" onclick="copyTextToClipboard('${escapeHtml(resolved)}', 'Comando copiado')">Copiar</button>
                    ${s.id ? `<button type="button" class="btn-icon" onclick="deleteCustomSnippet('${s.id}')" title="Eliminar snippet">🗑️</button>` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function addBookmark() {
    const name = document.getElementById('bm-name')?.value.trim();
    const rawUrl = document.getElementById('bm-url')?.value.trim();
    const url = normalizeExternalUrl(rawUrl);
    if (!name || !url) return showToast('Introduce nombre y URL válida (http/https)', 'error');

    appState.bookmarks.push({ id: generateId('bm'), name, url });
    document.getElementById('bm-name').value = '';
    document.getElementById('bm-url').value = '';
    saveState();
    renderBookmarks();
}

function deleteBookmark(id) {
    appState.bookmarks = appState.bookmarks.filter(b => b.id !== id);
    saveState();
    renderBookmarks();
}

function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;
    list.innerHTML = appState.bookmarks.map(b => {
        const safeUrl = normalizeExternalUrl(b.url);
        if (!safeUrl) return '';
        return `
            <li>
                <a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer" class="footer-link-cyan">🔗 ${escapeHtml(b.name)}</a>
                <button type="button" class="btn-icon" onclick="deleteBookmark('${b.id}')">🗑️</button>
            </li>
        `;
    }).join('');
}

/* --------------------------------------------------------------------------
   MODALES: BUSCADOR GLOBAL, EDICIÓN RÁPIDA, SNAPSHOTS, RESUMEN Y ATAJOS
   -------------------------------------------------------------------------- */
function openGlobalSearch() {
    const modal = document.getElementById('global-search-modal');
    modal.style.display = 'flex';
    const input = document.getElementById('global-search-input');
    input.value = '';
    input.focus();
    filterGlobalSearch();
}

function closeGlobalSearch() {
    document.getElementById('global-search-modal').style.display = 'none';
}

function filterGlobalSearch() {
    const q = (document.getElementById('global-search-input')?.value || '').toLowerCase();
    const resultsEl = document.getElementById('global-search-results');
    if (!resultsEl) return;

    const items = [];
    appState.tasks.forEach(t => items.push({ type: 'Tarea', title: t.text, ws: 'cockpit' }));
    appState.deliveries.forEach(d => items.push({ type: 'Entrega', title: `${d.title} (${d.subject})`, ws: 'cockpit' }));
    appState.kanban.forEach(k => items.push({ type: 'Kanban', title: `${k.title} (${k.subject})`, ws: 'academy' }));
    appState.flashcards.forEach(f => items.push({ type: 'Flashcard', title: f.question, ws: 'academy' }));
    appState.studioProjects.forEach(p => items.push({ type: 'Studio', title: p.title, ws: 'studio' }));
    appState.servers.forEach(s => items.push({ type: 'Servidor', title: `${s.name} (${s.ip})`, ws: 'devlab' }));

    const matches = items.filter(it => it.title.toLowerCase().includes(q) || it.type.toLowerCase().includes(q)).slice(0, 15);
    resultsEl.innerHTML = matches.map((m, idx) => `
        <li class="search-result-item ${idx === 0 ? 'selected' : ''}" onclick="switchWorkspace('${m.ws}'); closeGlobalSearch();">
            <span><strong>[${m.type}]</strong> ${escapeHtml(m.title)}</span>
            <span class="badge-version">${m.ws.toUpperCase()}</span>
        </li>
    `).join('');
}

function handleGlobalSearchKeydown(event) {
    if (event.key === 'Escape') closeGlobalSearch();
    if (event.key === 'Enter') {
        document.querySelector('#global-search-results .search-result-item')?.click();
    }
}

/* Modal genérico de edición */
function openEditItemModal(title, fields, onSave) {
    activeEditContext = { fields, onSave };
    document.getElementById('edit-item-title').textContent = `✏️ ${title}`;
    const container = document.getElementById('edit-item-fields');
    container.innerHTML = fields.map(f => {
        if (f.type === 'select') {
            return `
                <label class="mono-muted" style="text-align:left">${escapeHtml(f.label)}
                    <select id="edit-field-${f.key}" class="w-full mt-4">
                        ${f.options.map(opt => `<option value="${escapeHtml(opt.value)}" ${opt.value === f.value ? 'selected' : ''}>${escapeHtml(opt.label)}</option>`).join('')}
                    </select>
                </label>
            `;
        }
        return `
            <label class="mono-muted" style="text-align:left">${escapeHtml(f.label)}
                <input type="${escapeHtml(f.type || 'text')}" id="edit-field-${f.key}" value="${escapeHtml(f.value || '')}" class="w-full mt-4">
            </label>
        `;
    }).join('');
    document.getElementById('edit-item-modal').style.display = 'flex';
}

function closeEditItemModal() {
    document.getElementById('edit-item-modal').style.display = 'none';
    activeEditContext = null;
}

function saveEditItemModal() {
    if (!activeEditContext) return;
    const values = {};
    activeEditContext.fields.forEach(f => {
        values[f.key] = document.getElementById(`edit-field-${f.key}`)?.value ?? '';
    });
    const ok = activeEditContext.onSave(values);
    if (ok === false) return;
    saveState();
    renderAll();
    closeEditItemModal();
    showToast('Cambios guardados', 'success');
}

function openSnapshotsModal() {
    document.getElementById('snapshots-modal').style.display = 'flex';
    renderSnapshotsList();
}

function closeSnapshotsModal() {
    document.getElementById('snapshots-modal').style.display = 'none';
}

function createManualSnapshot(labelPrefix = 'Snapshot') {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    snaps.unshift({
        id: generateId('snap'),
        date: `${labelPrefix} · ${new Date().toLocaleString('es-ES')}`,
        data: JSON.stringify(appState)
    });
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(0, 12)));
    renderSnapshotsList();
    showToast('Snapshot local creado', 'success');
}

function restoreSnapshot(id) {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    const found = snaps.find(s => s.id === id);
    if (!found) return;
    createManualSnapshot('Auto antes de restaurar');
    appState = mergeState(cloneState(defaultState), JSON.parse(found.data));
    saveState();
    renderAll();
    closeSnapshotsModal();
    showToast('Snapshot restaurado', 'success');
}

function renderSnapshotsList() {
    const container = document.getElementById('snapshots-list-container');
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    if (!snaps.length) {
        container.innerHTML = `<div class="mono-muted">No hay snapshots guardados aún.</div>`;
        return;
    }
    container.innerHTML = snaps.map(s => `
        <div class="deadline-card-item">
            <div class="deadline-card-top">
                <span>📸 ${escapeHtml(s.date)}</span>
                <button type="button" class="btn-cyan btn-sm" onclick="restoreSnapshot('${s.id}')">Restaurar</button>
            </div>
        </div>
    `).join('');
}

function generateDailySummaryModal() {
    const todayKey = getMadridDateKey(new Date(Date.now() + clockOffsetMs));
    const focusMins = appState.studyStats.dailyLog[todayKey] || 0;
    const doneTasks = appState.tasks.filter(t => t.done).map(t => `- [x] ${t.text}`);
    const pendingTasks = appState.tasks.filter(t => !t.done).map(t => `- [ ] ${t.text}`);

    const summary = [
        `# Resumen de Jornada — ${todayKey}`,
        `- **Tiempo de foco hoy:** ${focusMins} min`,
        `- **Tareas completadas:** ${doneTasks.length}`,
        `- **Tareas pendientes:** ${pendingTasks.length}`,
        `\n## Completadas`,
        ...(doneTasks.length ? doneTasks : ['- Ninguna todavía']),
        `\n## Pendientes`,
        ...(pendingTasks.length ? pendingTasks : ['- ¡Todo al día!'])
    ].join('\n');

    document.getElementById('daily-summary-output').value = summary;
    document.getElementById('daily-summary-modal').style.display = 'flex';
}

function closeDailySummaryModal() {
    document.getElementById('daily-summary-modal').style.display = 'none';
}

function openShortcutsModal() {
    document.getElementById('shortcuts-modal').style.display = 'flex';
}

function closeShortcutsModal() {
    document.getElementById('shortcuts-modal').style.display = 'none';
}

function closeAllOpenModals() {
    [
        'global-search-modal',
        'schedule-modal',
        'auth-modal',
        'snapshots-modal',
        'note-history-modal',
        'edit-item-modal',
        'daily-summary-modal',
        'shortcuts-modal'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = 'none';
    });
}

/* Exportar / Importar / Vaciar */
function exportData() {
    const blob = new Blob([JSON.stringify(appState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `devworkspace-backup-${getMadridDateKey()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function importData(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const parsed = JSON.parse(String(e.target?.result || '{}'));
            createManualSnapshot('Auto antes de importar');
            appState = mergeState(cloneState(defaultState), parsed);
            saveState();
            renderAll();
            showToast('Backup importado correctamente', 'success');
        } catch (_) {
            showToast('Archivo JSON inválido', 'error');
        } finally {
            event.target.value = '';
        }
    };
    reader.readAsText(file);
}

function resetWorkspacePrompt() {
    if (!confirm('¿Seguro que quieres vaciar todo el workspace local?')) return;
    createManualSnapshot('Auto antes de vaciar');
    appState = cloneState(defaultState);
    saveState();
    renderAll();
    showToast('Workspace restaurado a valores iniciales', 'info');
}

/* --------------------------------------------------------------------------
   FIREBASE CLOUD SYNC OPCIONAL (INICIALIZACIÓN ÚNICA Y TIMESTAMPS)
   -------------------------------------------------------------------------- */
async function getFirebaseModules() {
    if (!firebaseModulesPromise) {
        firebaseModulesPromise = Promise.all([
            import(`${FIREBASE_SDK_BASE}/firebase-app.js`),
            import(`${FIREBASE_SDK_BASE}/firebase-auth.js`),
            import(`${FIREBASE_SDK_BASE}/firebase-firestore.js`)
        ]).then(([appMod, authMod, fsMod]) => ({
            ...appMod,
            ...authMod,
            ...fsMod
        }));
    }
    return firebaseModulesPromise;
}

async function initFirebaseIfConfigured() {
    const cfg = window.DEVWORKSPACE_FIREBASE_CONFIG;
    if (!cfg || !cfg.apiKey || cfg.apiKey.includes('TU_API_KEY')) return;
    try {
        const fb = await getFirebaseModules();
        firebaseApp = fb.initializeApp(cfg);
        firebaseAuth = fb.getAuth(firebaseApp);
        firebaseDb = fb.getFirestore(firebaseApp);

        fb.onAuthStateChanged(firebaseAuth, async user => {
            currentCloudUser = user;
            const loginBtn = document.getElementById('btn-cloud-login');
            const widget = document.getElementById('user-profile-widget');

            if (user) {
                loginBtn?.classList.add('is-hidden');
                widget?.classList.remove('is-hidden');
                document.getElementById('user-name').textContent = user.email.split('@')[0];
                await pullCloudState(user.uid);
            } else {
                loginBtn?.classList.remove('is-hidden');
                widget?.classList.add('is-hidden');
                pendingCloudUpload = false;
            }
        });
    } catch (_) {
        updateSyncStatus('error');
    }
}

const scheduleCloudSync = createDebouncer(() => {
    if (currentCloudUser) pushCloudState(currentCloudUser.uid);
}, SYNC_DEBOUNCE_MS);

function forceCloudSyncNow() {
    if (!currentCloudUser) {
        openAuthModal();
        return;
    }
    scheduleCloudSync.cancel();
    pushCloudState(currentCloudUser.uid);
}

async function pushCloudState(uid) {
    if (!firebaseDb) return;
    updateSyncStatus('saving');
    try {
        const { doc, setDoc } = await getFirebaseModules();
        appState.meta = appState.meta || {};
        if (!appState.meta.updatedAt) appState.meta.updatedAt = Date.now();
        await setDoc(doc(firebaseDb, 'workspaces', uid), {
            state: appState,
            updatedAt: appState.meta.updatedAt
        });
        pendingCloudUpload = false;
        lastCloudSyncTimestamp = Date.now();
        updateSyncStatus('ok');
    } catch (_) {
        updateSyncStatus('error');
    }
}

async function pullCloudState(uid) {
    if (!firebaseDb) return;
    updateSyncStatus('saving');
    try {
        const { doc, getDoc } = await getFirebaseModules();
        const snap = await getDoc(doc(firebaseDb, 'workspaces', uid));
        if (snap.exists() && snap.data().state) {
            const remoteData = snap.data();
            const remoteUpdatedAt = Number(remoteData.updatedAt || remoteData.state?.meta?.updatedAt || 0);
            const localUpdatedAt = Number(appState.meta?.updatedAt || 0);

            if (remoteUpdatedAt >= localUpdatedAt) {
                isApplyingRemoteState = true;
                try {
                    appState = mergeState(cloneState(defaultState), remoteData.state);
                    saveState({ skipTimestamp: true, skipCloud: true });
                    renderAll();
                } finally {
                    isApplyingRemoteState = false;
                }
            } else {
                await pushCloudState(uid);
                return;
            }
        } else {
            await pushCloudState(uid);
            return;
        }
        pendingCloudUpload = false;
        lastCloudSyncTimestamp = Date.now();
        updateSyncStatus('ok');
    } catch (_) {
        updateSyncStatus('error');
    }
}

function updateSyncStatus(status) {
    const badge = document.getElementById('cloud-sync-indicator');
    const lastEl = document.getElementById('cloud-last-sync');
    if (badge) {
        badge.className = 'sync-badge';
        if (status === 'saving') {
            badge.classList.add('sync-saving');
            badge.textContent = 'Sincronizando...';
        } else if (status === 'error') {
            badge.classList.add('sync-error');
            badge.textContent = 'Error Sync';
        } else {
            badge.textContent = 'Cloud OK';
        }
    }
    if (lastEl) {
        if (!navigator.onLine) {
            lastEl.textContent = 'Sin conexión (cola local)';
        } else if (status === 'saving' || pendingCloudUpload) {
            lastEl.textContent = 'Pendiente de subir...';
        } else if (lastCloudSyncTimestamp > 0) {
            const timeStr = new Date(lastCloudSyncTimestamp).toLocaleTimeString('es-ES', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            lastEl.textContent = `Sync ${timeStr}`;
        }
    }
}

function openAuthModal() {
    document.getElementById('auth-modal').style.display = 'flex';
}

function closeAuthModal() {
    document.getElementById('auth-modal').style.display = 'none';
}

function continueAsGuest() {
    closeAuthModal();
    showToast('Trabajando en modo local', 'info');
}

function toggleAuthMode() {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-main-btn').textContent = isRegisterMode ? '📝 Crear Cuenta' : '🔑 Iniciar Sesión';
}

async function handleEmailAuth() {
    if (!firebaseAuth) return showToast('Configura tu firebaseConfig primero', 'error');
    const email = document.getElementById('auth-email')?.value.trim();
    const pass = document.getElementById('auth-password')?.value;
    if (!email || !pass) return showToast('Introduce correo y contraseña', 'error');
    try {
        const { createUserWithEmailAndPassword, signInWithEmailAndPassword } = await getFirebaseModules();
        if (isRegisterMode) {
            await createUserWithEmailAndPassword(firebaseAuth, email, pass);
            showToast('Cuenta creada y conectada', 'success');
        } else {
            await signInWithEmailAndPassword(firebaseAuth, email, pass);
            showToast('Sesión iniciada', 'success');
        }
        closeAuthModal();
    } catch (err) {
        showToast(`Error Auth: ${err.message}`, 'error');
    }
}

async function sendPasswordReset() {
    if (!firebaseAuth) return showToast('Firebase no configurado', 'error');
    const email = document.getElementById('auth-email')?.value.trim();
    if (!email) return showToast('Escribe tu correo electrónico arriba primero', 'error');
    try {
        const { sendPasswordResetEmail } = await getFirebaseModules();
        await sendPasswordResetEmail(firebaseAuth, email);
        showToast('Enlace de restablecimiento enviado a tu correo', 'success');
    } catch (err) {
        showToast(`Error: ${err.message}`, 'error');
    }
}

async function logoutUser() {
    if (!firebaseAuth) return;
    const { signOut } = await getFirebaseModules();
    await signOut(firebaseAuth);
    showToast('Sesión cerrada', 'info');
}

/* PWA Install Prompt & Service Worker Update */
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredInstallPrompt = e;
    document.getElementById('app-install-button')?.classList.remove('is-hidden');
});

async function installApp() {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    document.getElementById('app-install-button')?.classList.add('is-hidden');
}

function applyServiceWorkerUpdate() {
    if (waitingServiceWorker) {
        waitingServiceWorker.postMessage({ type: 'SKIP_WAITING' });
    }
}

/* --------------------------------------------------------------------------
   RENDERIZADO GLOBAL E INICIALIZACIÓN
   -------------------------------------------------------------------------- */
function renderAll() {
    applyTheme(appState.theme);
    applyDensityMode();
    applyAllAppearance();
    renderScheduleWidget();
    renderDeliveries();
    renderTasks();
    renderPomodoroTaskSelect();
    updateStudyStats();
    setNotesTab(currentNotesTab);

    const stickyEl = document.getElementById('sticky-note-input');
    if (stickyEl && document.activeElement !== stickyEl) {
        stickyEl.value = appState.stickyNote || '';
    }

    const titleEl = document.getElementById('studio-project-title');
    const htmlEl = document.getElementById('code-html');
    const cssEl = document.getElementById('code-css');
    const jsEl = document.getElementById('code-js');

    if (titleEl && document.activeElement !== titleEl) titleEl.value = appState.studioCurrent.title || 'Mi Proyecto Web';
    if (htmlEl && document.activeElement !== htmlEl) htmlEl.value = appState.studioCurrent.html || '';
    if (cssEl && document.activeElement !== cssEl) cssEl.value = appState.studioCurrent.css || '';
    if (jsEl && document.activeElement !== jsEl) jsEl.value = appState.studioCurrent.js || '';

    renderStudioSavedProjects();
    renderKanban();
    renderGrades();
    renderFlashcards();
    renderBugLogs();
    renderDoubts();
    renderTeamProjects();
    renderServers();
    renderInfraChangelog();
    renderSnippets();
    renderBookmarks();
    updateChmodCalc();
    explainCronExpr();
    fetchLocalWeather();
    switchWorkspace(appState.activeWorkspace || 'cockpit');
}

function updateConnectionStatus() {
    const badge = document.getElementById('connection-status');
    if (!badge) return;
    const online = navigator.onLine;
    badge.textContent = online ? '🟢 En línea' : '🟡 Sin conexión (Offline)';
    badge.classList.toggle('connection-online', online);
    badge.classList.toggle('connection-offline', !online);
    if (online && currentCloudUser && pendingCloudUpload) {
        pushCloudState(currentCloudUser.uid);
    } else if (!online && currentCloudUser) {
        updateSyncStatus('ok');
    }
}

/* --------------------------------------------------------------------------
   EVENT LISTENERS GLOBALES
   -------------------------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    loadLocalState();
    renderAll();
    initKanbanDragAndDrop();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('./service-worker.js')
            .then(reg => {
                if (reg.waiting) {
                    waitingServiceWorker = reg.waiting;
                    document.getElementById('sw-update-banner')?.classList.remove('is-hidden');
                }
                reg.addEventListener('updatefound', () => {
                    const newWorker = reg.installing;
                    if (!newWorker) return;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            waitingServiceWorker = newWorker;
                            document.getElementById('sw-update-banner')?.classList.remove('is-hidden');
                        }
                    });
                });
            })
            .catch(() => {});

        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (refreshing) return;
            refreshing = true;
            window.location.reload();
        });
    }

    syncRealTimeNetwork();
    setInterval(() => {
        updateClockDisplay();
        renderScheduleWidget();
        checkDueDeliveryNotifications();
    }, 1000);

    /* Listeners en vivo de Scratchpad & Sticky */
    document.getElementById('scratchpad')?.addEventListener('input', e => {
        appState.notes[currentNotesTab] = e.target.value;
        updateScratchpadMetrics();
        saveState();
    });

    document.getElementById('sticky-note-input')?.addEventListener('input', e => {
        appState.stickyNote = e.target.value;
        saveState();
    });

    /* Listeners en vivo de Live Code Studio */
    const scheduleStudioAutoRun = createDebouncer(() => {
        if (document.getElementById('studio-autorun')?.checked) {
            runStudioPreview();
        }
    }, 350);

    ['code-html', 'code-css', 'code-js', 'studio-project-title'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', () => {
            syncStudioStateFromInputs();
            updateStudioEditorMetrics();
            saveState();
            scheduleStudioAutoRun();
        });
    });

    /* Soporte de tecla Tab en editores de código */
    ['code-html', 'code-css', 'code-js'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const el = e.target;
                const start = el.selectionStart;
                const end = el.selectionEnd;
                el.value = el.value.substring(0, start) + '  ' + el.value.substring(end);
                el.selectionStart = el.selectionEnd = start + 2;
                syncStudioStateFromInputs();
                saveState();
            }
        });
    });

    /* Mensajes de consola desde el iframe del Studio */
    window.addEventListener('message', event => {
        const iframe = document.getElementById('studio-preview-iframe');
        if (!iframe || event.source !== iframe.contentWindow) return;
        if (event.origin !== STUDIO_IFRAME_ORIGIN && event.origin !== window.location.origin) return;
        if (event.data && event.data.source === 'devworkspace-studio') {
            const level = ['log', 'warn', 'error'].includes(event.data.level) ? event.data.level : 'log';
            const time = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
            studioConsoleLogs.push({ level, msg: event.data.msg, time });
            renderStudioConsole();
        }
    });

    /* Selector de tema */
    document.getElementById('theme-select')?.addEventListener('change', e => applyTheme(e.target.value));

    /* Atajos de teclado globales */
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            closeAllOpenModals();
            return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
            e.preventDefault();
            switchWorkspace('cockpit');
            document.getElementById('task-text')?.focus();
        } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
            e.preventDefault();
            if (pomoInterval) stopPomodoro();
            else startCustomPomodoro('focus');
        } else if (e.altKey && e.key.toLowerCase() === 'z') {
            e.preventDefault();
            toggleZenMode();
        } else if (e.altKey && ['1', '2', '3', '4', '5'].includes(e.key)) {
            e.preventDefault();
            const map = { '1': 'cockpit', '2': 'studio', '3': 'academy', '4': 'devlab', '5': 'fonts' };
            switchWorkspace(map[e.key]);
        } else if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
            openShortcutsModal();
        }
    });

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);
    updateConnectionStatus();

    initFirebaseIfConfigured();
});

/* Exponer API pública para manejadores inline del HTML */
Object.assign(window, {
    switchWorkspace,
    applyWorkspacePreset,
    toggleZenMode,
    togglePresentationMode,
    toggleDensityMode,
    toggleWeatherWidget,
    generateDailySummaryModal,
    closeDailySummaryModal,
    openGlobalSearch,
    closeGlobalSearch,
    filterGlobalSearch,
    handleGlobalSearchKeydown,
    openShortcutsModal,
    closeShortcutsModal,
    openSnapshotsModal,
    closeSnapshotsModal,
    createManualSnapshot,
    restoreSnapshot,
    syncRealTimeNetwork,
    toggleScheduleViewMode,
    openScheduleModal,
    closeScheduleModal,
    addScheduleClass,
    deleteScheduleClass,
    clearSchedule,
    exportScheduleJson,
    importScheduleJson,
    toggleForm,
    enableDeadlineNotifications,
    setDeliveriesFilter,
    addDelivery,
    toggleDeliveryDone,
    deleteDelivery,
    editDeliveryPrompt,
    exportTasksMarkdown,
    setTaskFilter,
    setTaskBlockFilter,
    setTaskSort,
    addTask,
    toggleTaskDone,
    deleteTask,
    editTaskPrompt,
    addTaskSubtask,
    toggleTaskSubtask,
    deleteTaskSubtask,
    setPomodoroLinkedTask,
    startCustomPomodoro,
    stopPomodoro,
    toggleNoiseGenerator,
    handleAudioTypeChange,
    updateAudioVolume,
    toggleScratchpadPreview,
    toggleScratchpadFind,
    openNoteHistoryModal,
    closeNoteHistoryModal,
    saveNoteRevisionManual,
    restoreNoteRevision,
    setNotesTab,
    wrapScratchpadSelection,
    insertNoteTemplate,
    insertNoteTimestamp,
    insertNoteCodeBlock,
    toolCopy,
    toolDownload,
    replaceInScratchpad,
    copyStickyNote,
    clearStickyNote,
    loadStudioTemplate,
    injectStudioCdn,
    applyFontToStudioPreview,
    runStudioPreview,
    formatStudioCode,
    saveStudioProject,
    exportStudioSingleHtml,
    importStudioHtmlFile,
    toggleStudioFullscreen,
    switchStudioEditorTab,
    inspectStudioDomStructure,
    setStudioViewport,
    clearStudioConsole,
    renderStudioConsole,
    loadSavedStudioProject,
    deleteSavedStudioProject,
    toggleExamCramFilter,
    addKanbanTask,
    moveKanbanTask,
    deleteKanbanTask,
    handleKanbanDragStart,
    handleKanbanDragEnd,
    addGradeSubject,
    addGradeItem,
    deleteGradeItem,
    deleteGradeSubject,
    exportStudyHubMarkdown,
    setStudyHubTab,
    renderFlashcards,
    addFlashcard,
    flipCurrentFlashcard,
    nextFlashcard,
    markFlashcardStatus,
    deleteCurrentFlashcard,
    renderBugLogs,
    addBugLog,
    deleteBugLog,
    addClassDoubt,
    toggleDoubtResolved,
    deleteClassDoubt,
    calculateStudyPlan,
    addTeamProject,
    deleteTeamProject,
    setToolboxTab,
    tbFormatJson,
    tbJsonToCsv,
    tbCsvToJson,
    tbFormatSql,
    copyElementValue,
    tbEncodeAction,
    tbDecodeJwt,
    tbComputeHashes,
    runRegexTester,
    runSimpleDiff,
    calculateSubnet,
    convertNumberBase,
    updateChmodCalc,
    copyChmodCmd,
    explainCronExpr,
    generateMockUsers,
    generateUuidsAndDni,
    generateSecurePassword,
    loadBoilerplate,
    renderServers,
    addServer,
    deleteServer,
    exportServersJson,
    copyTextToClipboard,
    addInfraChangelog,
    renderSnippets,
    addCustomSnippet,
    deleteCustomSnippet,
    addBookmark,
    deleteBookmark,
    loadGoogleFontByName,
    saveGoogleFontFavorite,
    quickLoadGoogleFont,
    removeGoogleFontFavorite,
    updateFontPlaygroundStyle,
    applyLoadedFontToUi,
    applyLoadedFontToStudio,
    updateAppearanceSettings,
    previewCustomThemeColors,
    activateCustomTheme,
    exportCustomThemeJson,
    importCustomThemeJson,
    resetAppearanceDefaults,
    openAuthModal,
    closeAuthModal,
    handleEmailAuth,
    toggleAuthMode,
    sendPasswordReset,
    continueAsGuest,
    logoutUser,
    forceCloudSyncNow,
    closeEditItemModal,
    saveEditItemModal,
    resetWorkspacePrompt,
    exportData,
    importData,
    installApp,
    applyServiceWorkerUpdate
});