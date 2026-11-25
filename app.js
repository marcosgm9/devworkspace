/* ==========================================================================
   DEVWORKSPACE v7.0 - STUDIO EDITION (CORE ENGINE)
   Modular Workspaces, Live HTML/CSS/JS Sandbox, Dynamic Google Fonts,
   Study Hub, Dev & SysAdmin Lab, Web Audio Focus & Cloud Sync
   ========================================================================== */

const STORAGE_KEY = 'devworkspace_v7_studio_data';
const SNAPSHOTS_KEY = 'devworkspace_v7_snapshots';

// Si tienes tu propia configuración de Firebase, pégala aquí; si no, funciona 100% en Modo Local.
const FIREBASE_CONFIG = window.DEVWORKSPACE_FIREBASE_CONFIG || null;

let firebaseApp = null;
let firebaseAuth = null;
let firebaseDb = null;
let currentUser = null;
let isRegisterMode = false;

let timeOffsetMs = 0;
let activeWorkspace = 'cockpit';
let scheduleViewMode = 'current';
let activeNotesTab = 'general';
let taskFilter = 'all';
let taskSort = 'created';
let deliveriesFilter = 'all';
let studyHubTab = 'flashcards';
let currentFlashcardIndex = 0;
let flashcardFlipped = false;
let examCramOnly = false;
let currentStudioEditorTab = 'html';
let currentPreviewFont = '';
let loadedPreviewFont = 'JetBrains Mono';

// Pomodoro & Audio State
let pomoInterval = null;
let pomoSecondsLeft = 25 * 60;
let pomoRunning = false;
let pomoMode = 'focus';
let pomoLinkedKanbanId = null;

let audioCtx = null;
let audioSourceNode = null;
let audioGainNode = null;
let isAudioPlaying = false;

// Estado Global Persistente
let appState = createDefaultState();

function createDefaultState() {
    return {
        theme: 'cyberpunk',
        densityCompact: false,
        uiScale: '1',
        fontSans: "'Inter', system-ui, sans-serif",
        fontMono: "'JetBrains Mono', monospace",
        googleFontsFavorites: ['JetBrains Mono', 'Fira Code', 'Space Grotesk', 'Outfit', 'Orbitron'],
        customTheme: {
            name: 'Mi Tema',
            bg: '#060813',
            card: '#0d131f',
            border: '#1e293b',
            text: '#f1f5f9',
            cyan: '#38bdf8',
            violet: '#a855f7'
        },
        weatherEnabled: false,
        schedule: [
            { id: 'sch1', day: 1, start: '08:30', end: '10:20', subject: 'Acceso a Datos', room: 'Aula 204' },
            { id: 'sch2', day: 1, start: '10:50', end: '12:40', subject: 'Desarrollo de Interfaces', room: 'Aula 204' },
            { id: 'sch3', day: 2, start: '08:30', end: '11:15', subject: 'Programación de Servicios y Procesos', room: 'Lab 2' },
            { id: 'sch4', day: 3, start: '09:25', end: '12:40', subject: 'Sistemas de Gestión Empresarial', room: 'Aula 204' },
            { id: 'sch5', day: 4, start: '08:30', end: '11:15', subject: 'Programación Multimedia y Móvil', room: 'Lab 2' },
            { id: 'sch6', day: 5, start: '08:30', end: '10:20', subject: 'Empresa e Iniciativa Emprendedora', room: 'Aula 204' }
        ],
        deliveries: [],
        tasks: [],
        notes: {
            general: '# Apuntes Rápidos\n\nBienvenido a **DevWorkspace v7.0 Studio Edition**.\n',
            comandos: '# Comandos Frecuentes\n\n```bash\ndocker ps -a\nsystemctl status nginx\n```\n',
            clases: '# Notas de Clase\n\n- Repasar patrones de diseño y arquitectura MVC.\n'
        },
        noteHistory: [],
        stickyNote: '',
        stats: {
            focusMinutesToday: 0,
            focusMinutesTotal: 0,
            lastStudyDate: '',
            streakDays: 0,
            weeklyHistory: {}
        },
        studioCurrent: {
            title: 'Landing Cyberpunk',
            html: `<div class="hero-card">\n  <span class="badge">LIVE PREVIEW</span>\n  <h1>DevWorkspace Studio</h1>\n  <p>Edita HTML, CSS y JS en tiempo real y visualiza los resultados al instante.</p>\n  <button id="btn-ping">Probar Consola JS</button>\n</div>`,
            css: `body {\n  margin: 0;\n  min-height: 100vh;\n  display: grid;\n  place-items: center;\n  background: #070b14;\n  color: #f1f5f9;\n  font-family: system-ui, sans-serif;\n}\n.hero-card {\n  background: #0f172a;\n  border: 1px solid #38bdf8;\n  border-radius: 12px;\n  padding: 28px;\n  max-width: 420px;\n  box-shadow: 0 0 25px rgba(56, 189, 248, 0.25);\n}\n.badge {\n  font-size: 11px;\n  color: #38bdf8;\n  border: 1px solid #38bdf8;\n  padding: 2px 8px;\n  border-radius: 4px;\n}\nbutton {\n  margin-top: 12px;\n  background: #38bdf8;\n  color: #040711;\n  border: none;\n  padding: 8px 14px;\n  border-radius: 6px;\n  font-weight: 700;\n  cursor: pointer;\n}`,
            js: `console.log("Sandbox inicializado correctamente");\ndocument.getElementById("btn-ping")?.addEventListener("click", () => {\n  console.log("Botón pulsado a las " + new Date().toLocaleTimeString());\n});`
        },
        studioProjects: [],
        kanban: [
            { id: 'kb1', title: 'Sockets TCP/UDP en Java', subject: 'PSP', pomosEst: 3, pomosDone: 1, prio: 'high', status: 'doing' },
            { id: 'kb2', title: 'Consultas JPQL e Hibernate', subject: 'Acceso a Datos', pomosEst: 4, pomosDone: 0, prio: 'medium', status: 'todo' }
        ],
        gradeSubjects: [
            {
                id: 'gs1',
                name: 'Acceso a Datos',
                target: 6.0,
                credits: 6,
                items: [
                    { id: 'gi1', name: 'Examen T1-T2', weight: 40, score: 7.2 },
                    { id: 'gi2', name: 'Práctica JDBC/ORM', weight: 30, score: 8.5 }
                ]
            }
        ],
        flashcards: [
            { id: 'fc1', subject: 'PSP', q: '¿Diferencia principal entre TCP y UDP?', a: 'TCP es orientado a conexión y garantiza entrega ordenada; UDP no tiene conexión y prioriza velocidad.', mastered: false },
            { id: 'fc2', subject: 'Redes', q: '¿Qué máscara corresponde a un prefijo /26?', a: '255.255.255.192 (64 direcciones totales, 62 hosts útiles).', mastered: false }
        ],
        bugLogs: [],
        doubts: [],
        teamProjects: [],
        servers: [
            { id: 'srv1', name: 'Homelab Debian', ip: '192.168.1.50', port: '22', user: 'root', logs: '/var/log/nginx/error.log' }
        ],
        infraChangelog: [],
        customSnippets: [
            { id: 'sn1', cat: 'SSH', title: 'Conectar por SSH con variables', cmd: 'ssh -p {{PORT}} {{USER}}@{{IP}}' },
            { id: 'sn2', cat: 'Docker', title: 'Ver logs en vivo de contenedor', cmd: 'docker logs -f --tail 100 <contenedor>' },
            { id: 'sn3', cat: 'Linux', title: 'Puertos TCP/UDP en escucha', cmd: 'ss -tulnp' },
            { id: 'sn4', cat: 'Git', title: 'Historial compacto en gráfico', cmd: 'git log --oneline --graph --decorate -n 15' }
        ],
        bookmarks: [
            { id: 'bm1', name: 'MDN Web Docs', url: 'https://developer.mozilla.org/es/' },
            { id: 'bm2', name: 'Google Fonts', url: 'https://fonts.google.com/' },
            { id: 'bm3', name: 'GitHub', url: 'https://github.com/' }
        ]
    };
}

/* ==========================================================================
   INICIALIZACIÓN Y PERSISTENCIA
   ========================================================================== */
document.addEventListener('DOMContentLoaded', () => {
    loadState();
    applyAllAppearance();
    renderAll();
    initClockAndNetwork();
    initStudioListeners();
    initKeyboardShortcuts();
    explainCronExpr();
    updateChmodCalc();
    initFirebaseIfConfigured();
    setTimeout(runStudioPreview, 120);
});

function loadState() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const parsed = JSON.parse(raw);
            appState = deepMerge(createDefaultState(), parsed);
        }
    } catch (err) {
        console.error('Error cargando estado local:', err);
    }
    checkDailyStatsRollover();
}

function saveState(syncCloud = true) {
    try {
        const json = JSON.stringify(appState);
        localStorage.setItem(STORAGE_KEY, json);
        updateStorageQuotaBadge(json.length);
        if (syncCloud && currentUser && firebaseDb) {
            syncToFirebaseCloud();
        }
    } catch (err) {
        showToast('Error guardando datos locales', 'error');
    }
}

function deepMerge(target, source) {
    if (typeof target !== 'object' || target === null) return source;
    if (typeof source !== 'object' || source === null) return target;
    if (Array.isArray(target)) return Array.isArray(source) ? source : target;
    const output = { ...target };
    for (const key of Object.keys(source)) {
        if (key in target) {
            output[key] = deepMerge(target[key], source[key]);
        } else {
            output[key] = source[key];
        }
    }
    return output;
}

function updateStorageQuotaBadge(bytes) {
    const badge = document.getElementById('storage-quota-badge');
    if (badge) {
        badge.textContent = `Storage: ${(bytes / 1024).toFixed(1)} KB`;
    }
}

/* ==========================================================================
   NAVEGACIÓN DE WORKSPACES Y PERFILES
   ========================================================================== */
window.switchWorkspace = function (wsName) {
    activeWorkspace = wsName;
    document.querySelectorAll('.workspace-view').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.ws-tab').forEach(btn => btn.classList.remove('active'));

    const targetView = document.getElementById(`ws-${wsName}`);
    const targetBtn = document.querySelector(`.ws-tab[data-ws="${wsName}"]`);
    if (targetView) targetView.classList.add('active');
    if (targetBtn) targetBtn.classList.add('active');

    if (wsName === 'studio') {
        runStudioPreview();
    }
};

window.applyWorkspacePreset = function (preset) {
    const allCards = ['card-schedule', 'card-deliveries', 'card-tasks', 'card-pomodoro', 'card-notes'];
    allCards.forEach(id => document.getElementById(id)?.classList.remove('hidden-card'));

    if (preset === 'today') {
        switchWorkspace('cockpit');
        document.getElementById('card-notes')?.classList.add('hidden-card');
        setDeliveriesFilter('soon');
        setTaskFilter('pending');
        showToast('Perfil "Solo Hoy" activado');
    } else if (preset === 'exam') {
        switchWorkspace('academy');
        examCramOnly = true;
        renderKanban();
        showToast('Perfil "Modo Examen" activado');
    } else if (preset === 'dev') {
        switchWorkspace('studio');
        showToast('Perfil "Modo Código" activado');
    } else if (preset === 'sysadmin') {
        switchWorkspace('devlab');
        showToast('Perfil "Modo Redes / Lab" activado');
    } else {
        switchWorkspace('cockpit');
        examCramOnly = false;
        renderKanban();
        showToast('Vista Completa restaurada');
    }
};

window.toggleZenMode = function () {
    document.body.classList.toggle('zen-mode-active');
    document.getElementById('btn-zen-mode')?.classList.toggle('active');
};

window.togglePresentationMode = function () {
    document.body.classList.toggle('presentation-mode-active');
    const active = document.body.classList.contains('presentation-mode-active');
    document.getElementById('btn-present-mode')?.classList.toggle('active', active);
    showToast(active ? '🛡️ Modo Clase activado: datos sensibles ocultos' : 'Modo Clase desactivado');
};

window.toggleDensityMode = function () {
    appState.densityCompact = !appState.densityCompact;
    document.body.classList.toggle('density-compact', appState.densityCompact);
    const btn = document.getElementById('btn-density-mode');
    if (btn) btn.textContent = appState.densityCompact ? '📐 Compacto' : '📐 Aireado';
    saveState(false);
};

/* ==========================================================================
   GOOGLE FONTS DYNAMIC STUDIO & TEMAS
   ========================================================================== */
function applyAllAppearance() {
    document.documentElement.setAttribute('data-theme', appState.theme || 'cyberpunk');
    const themeSel = document.getElementById('theme-select');
    if (themeSel) themeSel.value = appState.theme || 'cyberpunk';

    document.body.classList.toggle('density-compact', !!appState.densityCompact);
    const densBtn = document.getElementById('btn-density-mode');
    if (densBtn) densBtn.textContent = appState.densityCompact ? '📐 Compacto' : '📐 Aireado';

    document.documentElement.style.setProperty('--ui-scale', appState.uiScale || '1');
    const scaleSel = document.getElementById('ui-scale-select');
    if (scaleSel) scaleSel.value = appState.uiScale || '1';

    document.documentElement.style.setProperty('--font-sans', appState.fontSans);
    document.documentElement.style.setProperty('--font-mono', appState.fontMono);

    if (appState.theme === 'custom') {
        applyCustomThemeVariables();
    }

    // Cargar todas las fuentes favoritas en <head>
    if (appState.googleFontsFavorites?.length) {
        injectGoogleFontsLink(appState.googleFontsFavorites);
    }
    renderGoogleFontsFavorites();
}

function injectGoogleFontsLink(fontNames) {
    const linkEl = document.getElementById('dynamic-google-fonts');
    if (!linkEl || !fontNames.length) return;
    const families = fontNames
        .map(f => `family=${encodeURIComponent(f.trim()).replace(/%20/g, '+')}:wght@400;500;600;700`)
        .join('&');
    linkEl.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
}

window.loadGoogleFontByName = function () {
    const input = document.getElementById('gf-input-name');
    const name = (input?.value || '').trim();
    if (!name) return showToast('Escribe el nombre de una Google Font', 'error');

    loadedPreviewFont = name;
    const allToLoad = Array.from(new Set([...(appState.googleFontsFavorites || []), name]));
    injectGoogleFontsLink(allToLoad);

    const label = document.getElementById('gf-active-preview-label');
    if (label) label.textContent = `Vista previa: ${name}`;
    updateFontPlaygroundStyle();
    showToast(`Fuente "${name}" cargada desde Google Fonts`, 'success');
};

window.quickLoadGoogleFont = function (name) {
    const input = document.getElementById('gf-input-name');
    if (input) input.value = name;
    loadGoogleFontByName();
};

window.updateFontPlaygroundStyle = function () {
    const sample = document.getElementById('gf-preview-sample');
    const size = document.getElementById('gf-preview-size')?.value || 18;
    if (sample) {
        sample.style.fontFamily = `'${loadedPreviewFont}', monospace, sans-serif`;
        sample.style.fontSize = `${size}px`;
    }
};

window.saveGoogleFontFavorite = function () {
    const name = (document.getElementById('gf-input-name')?.value || loadedPreviewFont).trim();
    if (!name) return;
    if (!appState.googleFontsFavorites.includes(name)) {
        appState.googleFontsFavorites.push(name);
        injectGoogleFontsLink(appState.googleFontsFavorites);
        renderGoogleFontsFavorites();
        saveState();
        showToast(`⭐ "${name}" guardada en favoritos`, 'success');
    } else {
        showToast('Esa fuente ya está en favoritos');
    }
};

window.removeGoogleFontFavorite = function (name) {
    appState.googleFontsFavorites = appState.googleFontsFavorites.filter(f => f !== name);
    renderGoogleFontsFavorites();
    saveState();
};

function renderGoogleFontsFavorites() {
    const container = document.getElementById('gf-favorites-list');
    const studioSel = document.getElementById('studio-font-select');

    if (container) {
        container.innerHTML = appState.googleFontsFavorites.map(font => `
            <span class="rubric-chip" style="font-family:'${escapeHtml(font)}',sans-serif;" onclick="quickLoadGoogleFont('${escapeHtml(font)}')">
                ${escapeHtml(font)}
                <button type="button" class="btn-icon" onclick="event.stopPropagation(); removeGoogleFontFavorite('${escapeHtml(font)}')" title="Quitar">×</button>
            </span>
        `).join('');
    }

    if (studioSel) {
        const currentVal = studioSel.value;
        studioSel.innerHTML = `<option value="">🔤 Fuente Preview (Default)</option>` +
            appState.googleFontsFavorites.map(f => `<option value="${escapeHtml(f)}">${escapeHtml(f)}</option>`).join('');
        studioSel.value = currentVal;
    }
}

window.applyLoadedFontToUi = function (target) {
    const fontValue = `'${loadedPreviewFont}', sans-serif`;
    if (target === 'sans') {
        appState.fontSans = fontValue;
        document.documentElement.style.setProperty('--font-sans', fontValue);
        showToast(`Fuente "${loadedPreviewFont}" aplicada a toda la Interfaz`, 'success');
    } else {
        appState.fontMono = `'${loadedPreviewFont}', monospace`;
        document.documentElement.style.setProperty('--font-mono', appState.fontMono);
        showToast(`Fuente "${loadedPreviewFont}" aplicada a Código y Terminal`, 'success');
    }
    saveState();
};

window.applyLoadedFontToStudio = function () {
    if (!appState.googleFontsFavorites.includes(loadedPreviewFont)) {
        appState.googleFontsFavorites.push(loadedPreviewFont);
        renderGoogleFontsFavorites();
    }
    currentPreviewFont = loadedPreviewFont;
    const studioSel = document.getElementById('studio-font-select');
    if (studioSel) studioSel.value = loadedPreviewFont;
    switchWorkspace('studio');
    runStudioPreview();
    showToast(`Fuente "${loadedPreviewFont}" aplicada en Live Code Studio`, 'success');
};

window.resetAppearanceDefaults = function () {
    appState.fontSans = "'Inter', system-ui, sans-serif";
    appState.fontMono = "'JetBrains Mono', monospace";
    appState.uiScale = '1';
    applyAllAppearance();
    saveState();
    showToast('Tipografía y escala restauradas');
};

document.getElementById('theme-select')?.addEventListener('change', (e) => {
    appState.theme = e.target.value;
    document.documentElement.setAttribute('data-theme', appState.theme);
    if (appState.theme === 'custom') applyCustomThemeVariables();
    saveState();
});

window.updateAppearanceSettings = function () {
    appState.uiScale = document.getElementById('ui-scale-select')?.value || '1';
    document.documentElement.style.setProperty('--ui-scale', appState.uiScale);
    saveState();
};

window.activateCustomTheme = function () {
    appState.customTheme = {
        name: document.getElementById('custom-theme-name')?.value || 'Mi Tema',
        bg: document.getElementById('cp-bg')?.value || '#060813',
        card: document.getElementById('cp-card')?.value || '#0d131f',
        border: document.getElementById('cp-border')?.value || '#1e293b',
        text: document.getElementById('cp-text')?.value || '#f1f5f9',
        cyan: document.getElementById('cp-cyan')?.value || '#38bdf8',
        violet: document.getElementById('cp-violet')?.value || '#a855f7'
    };
    appState.theme = 'custom';
    const sel = document.getElementById('theme-select');
    if (sel) sel.value = 'custom';
    document.documentElement.setAttribute('data-theme', 'custom');
    applyCustomThemeVariables();
    saveState();
    showToast(`Tema "${appState.customTheme.name}" activado`, 'success');
};

function applyCustomThemeVariables() {
    const c = appState.customTheme;
    if (!c) return;
    const root = document.documentElement.style;
    root.setProperty('--bg-color', c.bg);
    root.setProperty('--card-bg', c.card);
    root.setProperty('--card-border', c.border);
    root.setProperty('--text-main', c.text);
    root.setProperty('--accent-cyan', c.cyan);
    root.setProperty('--accent-violet', c.violet);
}

/* ==========================================================================
   WORKSPACE 2: LIVE CODE STUDIO (HTML / CSS / JS SANDBOX)
   ========================================================================== */
let studioAutoRunTimer = null;

function initStudioListeners() {
    const htmlEl = document.getElementById('code-html');
    const cssEl = document.getElementById('code-css');
    const jsEl = document.getElementById('code-js');
    const titleEl = document.getElementById('studio-project-title');

    if (htmlEl) htmlEl.value = appState.studioCurrent.html || '';
    if (cssEl) cssEl.value = appState.studioCurrent.css || '';
    if (jsEl) jsEl.value = appState.studioCurrent.js || '';
    if (titleEl) titleEl.value = appState.studioCurrent.title || 'Mi Proyecto Web';

    [htmlEl, cssEl, jsEl].forEach(el => {
        if (!el) return;
        // Soporte real para tecla Tab (2 espacios)
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Tab') {
                e.preventDefault();
                const start = el.selectionStart;
                const end = el.selectionEnd;
                el.value = el.value.substring(0, start) + '  ' + el.value.substring(end);
                el.selectionStart = el.selectionEnd = start + 2;
            }
        });

        el.addEventListener('input', () => {
            appState.studioCurrent.html = htmlEl.value;
            appState.studioCurrent.css = cssEl.value;
            appState.studioCurrent.js = jsEl.value;
            appState.studioCurrent.title = titleEl?.value || 'Mi Proyecto Web';

            if (document.getElementById('studio-autorun')?.checked) {
                clearTimeout(studioAutoRunTimer);
                studioAutoRunTimer = setTimeout(runStudioPreview, 380);
            }
        });
    });

    // Escuchar mensajes de consola enviados desde el iframe sandbox
    window.addEventListener('message', (event) => {
        if (event.data && event.data.source === 'devworkspace-sandbox') {
            appendStudioConsoleLine(event.data.level, event.data.args.join(' '));
        }
    });

    renderSavedStudioProjects();
}

window.switchStudioEditorTab = function (tab) {
    currentStudioEditorTab = tab;
    ['html', 'css', 'js', 'saved'].forEach(t => {
        document.getElementById(`ed-tab-${t}`)?.classList.toggle('active', t === tab);
        document.getElementById(`ed-pane-${t}`)?.classList.toggle('active', t === tab);
    });
    if (tab === 'saved') renderSavedStudioProjects();
};

window.runStudioPreview = function () {
    const iframe = document.getElementById('studio-preview-iframe');
    if (!iframe) return;

    const html = document.getElementById('code-html')?.value || '';
    const css = document.getElementById('code-css')?.value || '';
    const js = document.getElementById('code-js')?.value || '';

    clearStudioConsole();

    const fontLink = currentPreviewFont
        ? `<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(currentPreviewFont).replace(/%20/g, '+')}:wght@400;600;700&display=swap">
           <style>body, button, input, select, textarea { font-family: '${currentPreviewFont}', sans-serif !important; }</style>`
        : '';

    const consoleHookScript = `
        <script>
        (function() {
            const send = (level, args) => {
                try {
                    window.parent.postMessage({
                        source: 'devworkspace-sandbox',
                        level: level,
                        args: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a))
                    }, '*');
                } catch (e) {}
            };
            const origLog = console.log;
            const origWarn = console.warn;
            const origErr = console.error;
            console.log = (...a) => { origLog.apply(console, a); send('log', a); };
            console.warn = (...a) => { origWarn.apply(console, a); send('warn', a); };
            console.error = (...a) => { origErr.apply(console, a); send('error', a); };
            window.onerror = (msg, src, line) => {
                send('error', ['Error línea ' + line + ': ' + msg]);
            };
        })();
        <\/script>
    `;

    const fullDoc = `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    ${fontLink}
    <style>${css}</style>
    ${consoleHookScript}
</head>
<body>
    ${html}
    <script>
    try {
        ${js}
    } catch (err) {
        console.error(err.message);
    }
    <\/script>
</body>
</html>`;

    iframe.srcdoc = fullDoc;
    saveState(false);
};

function appendStudioConsoleLine(level, text) {
    const out = document.getElementById('studio-console-output');
    const countBadge = document.getElementById('studio-console-count');
    if (!out) return;

    const line = document.createElement('div');
    line.className = `console-line-${level}`;
    const prefix = level === 'error' ? '✖' : level === 'warn' ? '⚠' : '›';
    line.textContent = `[${new Date().toLocaleTimeString()}] ${prefix} ${text}`;
    out.appendChild(line);
    out.scrollTop = out.scrollHeight;

    if (countBadge) {
        countBadge.textContent = `${out.children.length} logs`;
    }
}

window.clearStudioConsole = function () {
    const out = document.getElementById('studio-console-output');
    const countBadge = document.getElementById('studio-console-count');
    if (out) out.innerHTML = '';
    if (countBadge) countBadge.textContent = '0 logs';
};

window.setStudioViewport = function (widthVal) {
    const iframe = document.getElementById('studio-preview-iframe');
    if (iframe) iframe.style.width = widthVal;

    document.getElementById('vp-desktop')?.classList.toggle('active', widthVal === '100%');
    document.getElementById('vp-tablet')?.classList.toggle('active', widthVal === '768px');
    document.getElementById('vp-mobile')?.classList.toggle('active', widthVal === '375px');
};

window.applyFontToStudioPreview = function (fontName) {
    currentPreviewFont = fontName;
    runStudioPreview();
};

window.toggleStudioFullscreen = function () {
    document.getElementById('studio-workbench')?.classList.toggle('studio-fullscreen');
};

window.injectStudioCdn = function (cdnKey) {
    const snippets = {
        tailwind: '<script src="https://cdn.tailwindcss.com"></script>\n',
        bootstrap: '<link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">\n',
        alpine: '<script defer src="https://cdn.jsdelivr.net/npm/alpinejs@3.x.x/dist/cdn.min.js"></script>\n',
        chartjs: '<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>\n'
    };
    const htmlEl = document.getElementById('code-html');
    if (htmlEl && snippets[cdnKey]) {
        htmlEl.value = snippets[cdnKey] + htmlEl.value;
        runStudioPreview();
        showToast(`CDN (${cdnKey}) inyectado en HTML`, 'success');
    }
};

window.loadStudioTemplate = function (tplKey) {
    const templates = {
        blank: {
            title: 'HTML5 Limpio',
            html: '<main class="container">\n  <h1>Hola Mundo</h1>\n  <p>Empieza a construir tu interfaz aquí.</p>\n</main>',
            css: 'body { font-family: system-ui, sans-serif; padding: 2rem; background: #0f172a; color: #f8fafc; }',
            js: 'console.log("Plantilla HTML5 cargada");'
        },
        cybercard: {
            title: 'Tarjeta Cyberpunk',
            html: '<div class="cyber-panel">\n  <h2>SYSTEM_READY // 2026</h2>\n  <p>Estado de nodos: 100% operativos.</p>\n</div>',
            css: 'body { background:#050811; color:#38bdf8; font-family:monospace; display:grid; place-items:center; height:100vh; margin:0; }\n.cyber-panel { border:1px solid #38bdf8; padding:24px; box-shadow:0 0 20px rgba(56,189,248,0.3); }',
            js: ''
        },
        flexgrid: {
            title: 'Layout Grid + Flex',
            html: '<div class="grid">\n  <div class="box">1</div>\n  <div class="box">2</div>\n  <div class="box">3</div>\n</div>',
            css: 'body { background:#111827; color:#fff; font-family:sans-serif; padding:20px; }\n.grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:12px; }\n.box { background:#1e293b; border:1px solid #38bdf8; padding:30px; text-align:center; border-radius:8px; }',
            js: ''
        },
        domlab: {
            title: 'Práctica DOM JS',
            html: '<div class="app">\n  <input id="item-inp" placeholder="Nuevo elemento...">\n  <button id="add-btn">Añadir</button>\n  <ul id="list"></ul>\n</div>',
            css: 'body { font-family:sans-serif; background:#0f172a; color:#fff; padding:20px; }\ninput, button { padding:8px; border-radius:6px; border:1px solid #334155; }',
            js: 'const inp = document.getElementById("item-inp");\nconst list = document.getElementById("list");\ndocument.getElementById("add-btn").onclick = () => {\n  if (!inp.value.trim()) return;\n  const li = document.createElement("li");\n  li.textContent = inp.value;\n  list.appendChild(li);\n  console.log("Añadido:", inp.value);\n  inp.value = "";\n};'
        }
    };

    const t = templates[tplKey];
    if (!t) return;
    document.getElementById('studio-project-title').value = t.title;
    document.getElementById('code-html').value = t.html;
    document.getElementById('code-css').value = t.css;
    document.getElementById('code-js').value = t.js;
    runStudioPreview();
    showToast(`Plantilla "${t.title}" cargada`);
};

window.saveStudioProject = function () {
    const title = (document.getElementById('studio-project-title')?.value || 'Sin título').trim();
    const html = document.getElementById('code-html')?.value || '';
    const css = document.getElementById('code-css')?.value || '';
    const js = document.getElementById('code-js')?.value || '';

    const existingIdx = appState.studioProjects.findIndex(p => p.title.toLowerCase() === title.toLowerCase());
    const projObj = {
        id: existingIdx >= 0 ? appState.studioProjects[existingIdx].id : 'sp_' + Date.now(),
        title,
        html,
        css,
        js,
        updatedAt: new Date().toLocaleString('es-ES')
    };

    if (existingIdx >= 0) {
        appState.studioProjects[existingIdx] = projObj;
    } else {
        appState.studioProjects.unshift(projObj);
    }

    saveState();
    renderSavedStudioProjects();
    showToast(`💾 Proyecto "${title}" guardado`, 'success');
};

function renderSavedStudioProjects() {
    const list = document.getElementById('studio-saved-projects-list');
    if (!list) return;

    if (!appState.studioProjects.length) {
        list.innerHTML = `<p class="mono-muted">No tienes proyectos web guardados aún. Pulsa "💾 Guardar" en la barra superior.</p>`;
        return;
    }

    list.innerHTML = appState.studioProjects.map(p => `
        <div class="hub-item-card">
            <div class="form-inline-between">
                <strong>${escapeHtml(p.title)}</strong>
                <span class="mono-muted">${escapeHtml(p.updatedAt)}</span>
            </div>
            <div class="filter-pills-row">
                <button type="button" class="btn-cyan btn-sm" onclick="loadSavedStudioProject('${p.id}')">📂 Abrir</button>
                <button type="button" class="btn-danger btn-sm" onclick="deleteSavedStudioProject('${p.id}')">🗑️ Eliminar</button>
            </div>
        </div>
    `).join('');
}

window.loadSavedStudioProject = function (id) {
    const proj = appState.studioProjects.find(p => p.id === id);
    if (!proj) return;
    document.getElementById('studio-project-title').value = proj.title;
    document.getElementById('code-html').value = proj.html;
    document.getElementById('code-css').value = proj.css;
    document.getElementById('code-js').value = proj.js;
    switchStudioEditorTab('html');
    runStudioPreview();
    showToast(`Proyecto "${proj.title}" cargado`);
};

window.deleteSavedStudioProject = function (id) {
    appState.studioProjects = appState.studioProjects.filter(p => p.id !== id);
    saveState();
    renderSavedStudioProjects();
};

window.exportStudioSingleHtml = function () {
    const title = (document.getElementById('studio-project-title')?.value || 'proyecto').trim();
    const html = document.getElementById('code-html')?.value || '';
    const css = document.getElementById('code-css')?.value || '';
    const js = document.getElementById('code-js')?.value || '';

    const fullHtml = `<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="UTF-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>${escapeHtml(title)}</title>\n  <style>\n${css}\n  </style>\n</head>\n<body>\n${html}\n  <script>\n${js}\n  <\/script>\n</body>\n</html>`;

    downloadTextFile(`${title.toLowerCase().replace(/\s+/g, '_')}.html`, fullHtml, 'text/html');
    showToast('⬇️ Archivo .html exportado', 'success');
};

window.importStudioHtmlFile = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        const content = String(e.target?.result || '');
        const styleMatch = content.match(/<style[^>]*>([\s\S]*?)<\/style>/i);
        const scriptMatch = content.match(/<script[^>]*>([\s\S]*?)<\/script>/i);
        const bodyMatch = content.match(/<body[^>]*>([\s\S]*?)<\/body>/i);

        document.getElementById('studio-project-title').value = file.name.replace(/\.html?$/i, '');
        document.getElementById('code-css').value = styleMatch ? styleMatch[1].trim() : '';
        document.getElementById('code-js').value = scriptMatch ? scriptMatch[1].trim() : '';

        let cleanBody = bodyMatch ? bodyMatch[1] : content;
        cleanBody = cleanBody.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '').trim();
        document.getElementById('code-html').value = cleanBody;

        runStudioPreview();
        showToast(`📂 "${file.name}" cargado en Live Code Studio`, 'success');
    };
    reader.readAsText(file);
};

window.inspectStudioDomStructure = function () {
    const html = document.getElementById('code-html')?.value || '';
    const temp = document.createElement('div');
    temp.innerHTML = html;
    const ids = Array.from(temp.querySelectorAll('[id]')).map(el => `#${el.id} (<${el.tagName.toLowerCase()}>)`);
    const classes = Array.from(new Set(
        Array.from(temp.querySelectorAll('[class]'))
            .flatMap(el => Array.from(el.classList).map(c => `.${c}`))
    ));
    appendStudioConsoleLine('log', `DOM Inspector -> IDs: [${ids.join(', ') || 'ninguno'}] | Clases: [${classes.join(', ') || 'ninguna'}]`);
};

/* ==========================================================================
   RELOJ EN TIEMPO REAL, HORARIO Y CLIMA
   ========================================================================== */
function initClockAndNetwork() {
    updateClockDisplay();
    setInterval(updateClockDisplay, 1000);
    syncRealTimeNetwork();
}

function getNow() {
    return new Date(Date.now() + timeOffsetMs);
}

function updateClockDisplay() {
    const now = getNow();
    const timeEl = document.getElementById('time');
    const dateEl = document.getElementById('date');
    if (timeEl) timeEl.textContent = now.toLocaleTimeString('es-ES');
    if (dateEl) {
        dateEl.textContent = now.toLocaleDateString('es-ES', {
            weekday: 'short',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    }
    renderScheduleWidget();
}

window.syncRealTimeNetwork = async function () {
    const statusEl = document.getElementById('net-status');
    try {
        const res = await fetch('https://worldtimeapi.org/api/timezone/Europe/Madrid');
        if (res.ok) {
            const data = await res.json();
            timeOffsetMs = new Date(data.datetime).getTime() - Date.now();
            if (statusEl) statusEl.textContent = '🟢 NTP Madrid OK';
            return;
        }
    } catch (_) {}
    if (statusEl) statusEl.textContent = '🟡 Hora Local';
};

window.toggleWeatherWidget = async function () {
    appState.weatherEnabled = !appState.weatherEnabled;
    const label = document.getElementById('weather-text');
    if (!appState.weatherEnabled) {
        if (label) label.textContent = 'Clima: OFF';
        saveState(false);
        return;
    }
    if (label) label.textContent = 'Cargando...';
    try {
        // Coordenadas Fuente de Cantos / Extremadura por defecto si no hay geolocalización
        const res = await fetch('https://api.open-meteo.com/v1/forecast?latitude=38.2467&longitude=-6.3089&current_weather=true');
        const data = await res.json();
        const temp = data?.current_weather?.temperature;
        if (label && temp !== undefined) {
            label.textContent = `${temp}°C Extremadura`;
        }
    } catch (_) {
        if (label) label.textContent = 'Sin conexión';
    }
    saveState(false);
};

/* ==========================================================================
   HORARIO SEMANAL
   ========================================================================== */
window.toggleScheduleViewMode = function () {
    scheduleViewMode = scheduleViewMode === 'current' ? 'table' : 'current';
    renderScheduleWidget();
};

function renderScheduleWidget() {
    const box = document.getElementById('schedule-widget');
    if (!box) return;

    const now = getNow();
    const day = now.getDay();
    const curMins = now.getHours() * 60 + now.getMinutes();

    if (scheduleViewMode === 'table') {
        const daysMap = { 1: 'Lun', 2: 'Mar', 3: 'Mié', 4: 'Jue', 5: 'Vie' };
        const sorted = [...appState.schedule].sort((a, b) => a.day - b.day || a.start.localeCompare(b.start));
        box.innerHTML = `
            <table class="sch-table">
                <thead><tr><th>Día</th><th>Hora</th><th>Módulo</th><th>Aula</th></tr></thead>
                <tbody>
                    ${sorted.map(s => `
                        <tr>
                            <td>${daysMap[s.day] || s.day}</td>
                            <td>${s.start} - ${s.end}</td>
                            <td><strong>${escapeHtml(s.subject)}</strong></td>
                            <td>${escapeHtml(s.room || '-')}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    const todayClasses = appState.schedule
        .filter(s => Number(s.day) === day)
        .sort((a, b) => a.start.localeCompare(b.start));

    let currentClass = null;
    let nextClass = null;

    for (const c of todayClasses) {
        const [sh, sm] = c.start.split(':').map(Number);
        const [eh, em] = c.end.split(':').map(Number);
        const sM = sh * 60 + sm;
        const eM = eh * 60 + em;
        if (curMins >= sM && curMins < eM) {
            currentClass = { ...c, sM, eM };
        } else if (curMins < sM && !nextClass) {
            nextClass = { ...c, sM };
        }
    }

    if (currentClass) {
        const total = currentClass.eM - currentClass.sM;
        const elapsed = curMins - currentClass.sM;
        const pct = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        const rem = currentClass.eM - curMins;
        box.innerHTML = `
            <div class="sch-status">🟢 <strong>En clase: ${escapeHtml(currentClass.subject)}</strong> <span class="badge-version">${escapeHtml(currentClass.room || '')}</span></div>
            <div class="sch-detail">${currentClass.start} - ${currentClass.end} • Quedan ${rem} min (${pct}%)</div>
            <div class="sch-progress-track"><div class="sch-progress-fill" style="width:${pct}%"></div></div>
        `;
    } else if (nextClass) {
        const diff = nextClass.sM - curMins;
        box.innerHTML = `
            <div class="sch-status">⏳ Próxima clase: <strong>${escapeHtml(nextClass.subject)}</strong></div>
            <div class="sch-detail">Empieza a las ${nextClass.start} (en ${diff} min) • ${escapeHtml(nextClass.room || '')}</div>
        `;
    } else {
        box.innerHTML = `
            <div class="sch-status">🌙 Sin clases activas ahora mismo</div>
            <div class="sch-detail">Puedes cambiar a "Tabla / Actual" para revisar toda la semana.</div>
        `;
    }
}

window.openScheduleModal = function () {
    document.getElementById('schedule-modal').style.display = 'flex';
    renderScheduleEditorList();
};

window.closeScheduleModal = function () {
    document.getElementById('schedule-modal').style.display = 'none';
};

function renderScheduleEditorList() {
    const el = document.getElementById('schedule-list-editor');
    if (!el) return;
    const days = { 1: 'Lunes', 2: 'Martes', 3: 'Miércoles', 4: 'Jueves', 5: 'Viernes' };
    el.innerHTML = appState.schedule.map(s => `
        <div class="hub-item-card" style="flex-direction:row; justify-content:space-between; align-items:center;">
            <span><strong>${days[s.day]}</strong> ${s.start}-${s.end} • ${escapeHtml(s.subject)} (${escapeHtml(s.room || '-')})</span>
            <button type="button" class="btn-danger btn-sm" onclick="deleteScheduleClass('${s.id}')">🗑️</button>
        </div>
    `).join('');
}

window.addScheduleClass = function () {
    const day = Number(document.getElementById('sch-add-day').value);
    const start = document.getElementById('sch-add-start').value;
    const end = document.getElementById('sch-add-end').value;
    const subject = document.getElementById('sch-add-subject').value.trim();
    const room = document.getElementById('sch-add-room').value.trim();
    if (!subject) return;

    appState.schedule.push({ id: 'sch_' + Date.now(), day, start, end, subject, room });
    document.getElementById('sch-add-subject').value = '';
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
};

window.deleteScheduleClass = function (id) {
    appState.schedule = appState.schedule.filter(s => s.id !== id);
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
};

window.clearSchedule = function () {
    appState.schedule = [];
    saveState();
    renderScheduleEditorList();
    renderScheduleWidget();
};

/* ==========================================================================
   ENTREGAS, EXÁMENES Y CHECKLIST DE RÚBRICA
   ========================================================================== */
window.setDeliveriesFilter = function (filter) {
    deliveriesFilter = filter;
    ['all', 'pending', 'soon', 'exam', 'practice'].forEach(f => {
        document.getElementById(`deliv-filter-${f}`)?.classList.toggle('active', f === filter);
    });
    renderDeliveries();
};

window.addDelivery = function () {
    const title = document.getElementById('deliv-title')?.value.trim();
    const subject = document.getElementById('deliv-subject')?.value.trim() || 'General';
    const type = document.getElementById('deliv-type')?.value || 'Práctica';
    const datetime = document.getElementById('deliv-datetime')?.value;
    if (!title || !datetime) return showToast('Completa título y fecha', 'error');

    appState.deliveries.push({
        id: 'del_' + Date.now(),
        title,
        subject,
        type,
        datetime,
        done: false,
        rubric: [
            { label: 'Código limpio/comentado', done: false },
            { label: 'Probado sin errores', done: false },
            { label: 'Formato entrega OK', done: false }
        ]
    });

    document.getElementById('deliv-title').value = '';
    toggleForm('form-add-delivery');
    saveState();
    renderDeliveries();
    showToast('Entrega añadida', 'success');
};

function renderDeliveries() {
    const list = document.getElementById('deliveries-list');
    if (!list) return;

    const now = getNow().getTime();
    let items = [...appState.deliveries].sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    items = items.filter(d => {
        const diffHours = (new Date(d.datetime).getTime() - now) / 3600000;
        if (deliveriesFilter === 'pending') return !d.done;
        if (deliveriesFilter === 'soon') return !d.done && diffHours <= 48 && diffHours >= -24;
        if (deliveriesFilter === 'exam') return d.type === 'Examen';
        if (deliveriesFilter === 'practice') return d.type === 'Práctica';
        return true;
    });

    if (!items.length) {
        list.innerHTML = `<p class="mono-muted">No hay entregas en este filtro.</p>`;
        return;
    }

    list.innerHTML = items.map(d => {
        const diffMs = new Date(d.datetime).getTime() - now;
        const diffHours = Math.round(diffMs / 3600000);
        const diffDays = Math.floor(diffHours / 24);
        let badgeClass = 'cd-ok';
        let badgeText = diffDays > 0 ? `En ${diffDays}d ${diffHours % 24}h` : `En ${diffHours}h`;
        if (d.done) {
            badgeClass = 'cd-done';
            badgeText = 'Entregado';
        } else if (diffHours < 0) {
            badgeClass = 'cd-urgent';
            badgeText = 'Vencido';
        } else if (diffHours <= 48) {
            badgeClass = 'cd-warn';
        }

        const rubricHtml = (d.rubric || []).map((r, idx) => `
            <span class="rubric-chip ${r.done ? 'done' : ''}" onclick="toggleDeliveryRubric('${d.id}', ${idx})">
                ${r.done ? '☑' : '☐'} ${escapeHtml(r.label)}
            </span>
        `).join('');

        return `
            <div class="deadline-card-item">
                <div class="deadline-card-top">
                    <div>
                        <div class="deadline-title" style="${d.done ? 'text-decoration:line-through;opacity:0.6;' : ''}">
                            ${escapeHtml(d.title)}
                        </div>
                        <div class="deadline-meta">
                            <span>${escapeHtml(d.subject)}</span> • <span>${escapeHtml(d.type)}</span> • <span>${new Date(d.datetime).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}</span>
                        </div>
                    </div>
                    <div class="filter-pills-row">
                        <span class="countdown-badge ${badgeClass}">${badgeText}</span>
                        <button type="button" class="btn-icon" onclick="toggleDeliveryDone('${d.id}')" title="Marcar completada">✅</button>
                        <button type="button" class="btn-icon" onclick="deleteDelivery('${d.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
                <div class="deliv-rubric-box">${rubricHtml}</div>
            </div>
        `;
    }).join('');
}

window.toggleDeliveryRubric = function (id, idx) {
    const d = appState.deliveries.find(x => x.id === id);
    if (d && d.rubric?.[idx]) {
        d.rubric[idx].done = !d.rubric[idx].done;
        saveState();
        renderDeliveries();
    }
};

window.toggleDeliveryDone = function (id) {
    const d = appState.deliveries.find(x => x.id === id);
    if (d) {
        d.done = !d.done;
        saveState();
        renderDeliveries();
    }
};

window.deleteDelivery = function (id) {
    appState.deliveries = appState.deliveries.filter(x => x.id !== id);
    saveState();
    renderDeliveries();
};

/* ==========================================================================
   TAREAS CON BLOQUES DE JORNADA
   ========================================================================== */
window.setTaskFilter = function (f) {
    taskFilter = f;
    ['all', 'pending', 'done'].forEach(k => document.getElementById(`filter-${k}`)?.classList.toggle('active', k === f));
    renderTasks();
};

window.setTaskSort = function (s) {
    taskSort = s;
    renderTasks();
};

window.addTask = function () {
    const inp = document.getElementById('task-text');
    const text = inp?.value.trim();
    if (!text) return;

    const priority = document.getElementById('task-priority')?.value || 'medium';
    const block = document.getElementById('task-block')?.value || 'afternoon';
    const date = document.getElementById('task-date')?.value || '';

    appState.tasks.unshift({
        id: 'tsk_' + Date.now(),
        text,
        priority,
        block,
        date,
        done: false,
        createdAt: Date.now()
    });

    inp.value = '';
    saveState();
    renderTasks();
    updateStatsDisplay();
};

function renderTasks() {
    const list = document.getElementById('tasks-list');
    if (!list) return;

    const prioRank = { high: 1, medium: 2, low: 3 };
    const blockRank = { morning: 1, afternoon: 2, night: 3 };
    const blockIcons = { morning: '🌅', afternoon: '☀️', night: '🌙' };
    const prioIcons = { high: '🔴', medium: '🟠', low: '🔵' };

    let filtered = appState.tasks.filter(t => {
        if (taskFilter === 'pending') return !t.done;
        if (taskFilter === 'done') return t.done;
        return true;
    });

    filtered.sort((a, b) => {
        if (taskSort === 'priority') return (prioRank[a.priority] || 2) - (prioRank[b.priority] || 2);
        if (taskSort === 'block') return (blockRank[a.block] || 2) - (blockRank[b.block] || 2);
        if (taskSort === 'date') return (a.date || '9999').localeCompare(b.date || '9999');
        return b.createdAt - a.createdAt;
    });

    list.innerHTML = filtered.map(t => `
        <li class="${t.done ? 'task-done' : ''}">
            <div style="display:flex;align-items:center;gap:8px;flex:1;">
                <input type="checkbox" ${t.done ? 'checked' : ''} onchange="toggleTaskDone('${t.id}')">
                <span>${prioIcons[t.priority] || '🟠'} ${blockIcons[t.block] || ''} ${escapeHtml(t.text)}</span>
                ${t.date ? `<small class="mono-muted">(${t.date})</small>` : ''}
            </div>
            <button type="button" class="btn-icon" onclick="deleteTask('${t.id}')">🗑️</button>
        </li>
    `).join('');
}

window.toggleTaskDone = function (id) {
    const t = appState.tasks.find(x => x.id === id);
    if (t) {
        t.done = !t.done;
        saveState();
        renderTasks();
        updateStatsDisplay();
    }
};

window.deleteTask = function (id) {
    appState.tasks = appState.tasks.filter(x => x.id !== id);
    saveState();
    renderTasks();
    updateStatsDisplay();
};

window.exportTasksMarkdown = function () {
    const md = appState.tasks.map(t => `- [${t.done ? 'x' : ' '}] ${t.text}`).join('\n');
    navigator.clipboard.writeText(md);
    showToast('Tareas copiadas en Markdown', 'success');
};

/* ==========================================================================
   POMODORO PRO, GENERADOR DE RUIDO WEB AUDIO Y MÉTRICAS
   ========================================================================== */
window.startCustomPomodoro = function (mode, linkedTitle = null, linkedId = null) {
    pomoMode = mode;
    pomoLinkedKanbanId = linkedId;

    const focusMins = Number(document.getElementById('pomo-focus-time')?.value || 25);
    const breakMins = Number(document.getElementById('pomo-break-time')?.value || 5);

    if (mode === 'focus') pomoSecondsLeft = focusMins * 60;
    else if (mode === 'break') pomoSecondsLeft = breakMins * 60;
    else if (mode === 'exam') pomoSecondsLeft = 60 * 60;

    const targetLabel = document.getElementById('pomodoro-target');
    if (targetLabel) {
        targetLabel.textContent = linkedTitle ? `Objetivo: ${linkedTitle}` : `Modo: ${mode.toUpperCase()}`;
    }

    clearInterval(pomoInterval);
    pomoRunning = true;
    playNotificationBeep(520, 0.12);
    updatePomodoroDisplay();

    pomoInterval = setInterval(() => {
        pomoSecondsLeft--;
        updatePomodoroDisplay();

        if (pomoMode === 'focus' || pomoMode === 'exam') {
            if (pomoSecondsLeft % 60 === 0) {
                recordStudyMinute();
            }
        }

        if (pomoSecondsLeft <= 0) {
            clearInterval(pomoInterval);
            pomoRunning = false;
            playNotificationBeep(780, 0.35);
            showToast(`⏰ Sesión de ${pomoMode} finalizada`, 'success');
            if (pomoLinkedKanbanId) {
                incrementKanbanPomo(pomoLinkedKanbanId);
            }
        }
    }, 1000);
};

window.stopPomodoro = function () {
    clearInterval(pomoInterval);
    pomoRunning = false;
    const focusMins = Number(document.getElementById('pomo-focus-time')?.value || 25);
    pomoSecondsLeft = focusMins * 60;
    updatePomodoroDisplay();
};

function updatePomodoroDisplay() {
    const mins = Math.floor(Math.max(0, pomoSecondsLeft) / 60).toString().padStart(2, '0');
    const secs = (Math.max(0, pomoSecondsLeft) % 60).toString().padStart(2, '0');
    const el = document.getElementById('pomodoro-display');
    if (el) el.textContent = `${mins}:${secs}`;
}

function playNotificationBeep(freq = 600, duration = 0.2) {
    try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.frequency.value = freq;
        gain.gain.value = 0.08;
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (_) {}
}

window.toggleNoiseGenerator = function () {
    const btn = document.getElementById('btn-audio-toggle');
    const vis = document.getElementById('audio-visualizer');
    if (isAudioPlaying) {
        stopNoiseGenerator();
        if (btn) btn.textContent = '▶ Audio';
        vis?.classList.remove('audio-playing');
    } else {
        startNoiseGenerator(document.getElementById('audio-sound-type')?.value || 'brown');
        if (btn) btn.textContent = '⏹ Parar';
        vis?.classList.add('audio-playing');
    }
};

window.handleAudioTypeChange = function (val) {
    if (isAudioPlaying) {
        stopNoiseGenerator();
        startNoiseGenerator(val);
    }
};

window.updateAudioVolume = function (val) {
    const txt = document.getElementById('audio-vol-text');
    if (txt) txt.textContent = `${val}%`;
    if (audioGainNode) {
        audioGainNode.gain.value = (Number(val) / 100) * 0.25;
    }
};

function startNoiseGenerator(type) {
    try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioGainNode = audioCtx.createGain();
        const vol = Number(document.getElementById('audio-volume')?.value || 40);
        audioGainNode.gain.value = (vol / 100) * 0.25;
        audioGainNode.connect(audioCtx.destination);

        if (type.startsWith('binaural')) {
            const oscL = audioCtx.createOscillator();
            const oscR = audioCtx.createOscillator();
            const merger = audioCtx.createChannelMerger(2);
            const diff = type === 'binaural-alpha' ? 10 : 6;
            oscL.frequency.value = 200;
            oscR.frequency.value = 200 + diff;
            oscL.connect(merger, 0, 0);
            oscR.connect(merger, 0, 1);
            merger.connect(audioGainNode);
            oscL.start();
            oscR.start();
            audioSourceNode = { stop: () => { oscL.stop(); oscR.stop(); } };
        } else {
            const bufferSize = 2 * audioCtx.sampleRate;
            const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
            const output = buffer.getChannelData(0);
            let lastOut = 0.0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                if (type === 'brown') {
                    output[i] = (lastOut + (0.02 * white)) / 1.02;
                    lastOut = output[i];
                    output[i] *= 3.5;
                } else {
                    output[i] = white * 0.4;
                }
            }
            const noise = audioCtx.createBufferSource();
            noise.buffer = buffer;
            noise.loop = true;
            noise.connect(audioGainNode);
            noise.start();
            audioSourceNode = noise;
        }
        isAudioPlaying = true;
    } catch (e) {
        console.error(e);
    }
}

function stopNoiseGenerator() {
    try {
        audioSourceNode?.stop();
        audioCtx?.close();
    } catch (_) {}
    isAudioPlaying = false;
}

function getTodayIsoKey() {
    return getNow().toISOString().slice(0, 10);
}

function checkDailyStatsRollover() {
    const today = getTodayIsoKey();
    if (appState.stats.lastStudyDate !== today) {
        appState.stats.focusMinutesToday = 0;
        appState.stats.lastStudyDate = today;
    }
}

function recordStudyMinute() {
    checkDailyStatsRollover();
    const today = getTodayIsoKey();
    appState.stats.focusMinutesToday += 1;
    appState.stats.focusMinutesTotal += 1;
    appState.stats.weeklyHistory[today] = (appState.stats.weeklyHistory[today] || 0) + 1;
    if (appState.stats.streakDays === 0) appState.stats.streakDays = 1;
    saveState(false);
    updateStatsDisplay();
}

function updateStatsDisplay() {
    const todayEl = document.getElementById('stat-focus-today');
    const totalEl = document.getElementById('stat-focus-total');
    const streakEl = document.getElementById('stat-streak');
    const ratioEl = document.getElementById('stat-ratio');

    if (todayEl) todayEl.textContent = `${appState.stats.focusMinutesToday}m`;
    if (totalEl) totalEl.textContent = `${(appState.stats.focusMinutesTotal / 60).toFixed(1)}h`;
    if (streakEl) streakEl.textContent = `🔥 ${appState.stats.streakDays}d`;

    const totalTasks = appState.tasks.length;
    const doneTasks = appState.tasks.filter(t => t.done).length;
    const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;
    if (ratioEl) ratioEl.textContent = `${pct}%`;

    renderWeeklyChart();
}

function renderWeeklyChart() {
    const container = document.getElementById('study-bars-container');
    const weekSumEl = document.getElementById('chart-week-sum');
    if (!container) return;

    const days = [];
    let sum = 0;
    for (let i = 6; i >= 0; i--) {
        const d = new Date(getNow().getTime() - i * 86400000);
        const key = d.toISOString().slice(0, 10);
        const mins = appState.stats.weeklyHistory[key] || 0;
        sum += mins;
        days.push({ label: d.toLocaleDateString('es-ES', { weekday: 'narrow' }), mins });
    }
    const maxMins = Math.max(30, ...days.map(x => x.mins));
    if (weekSumEl) weekSumEl.textContent = `${sum} min`;

    container.innerHTML = days.map(d => {
        const hPct = Math.round((d.mins / maxMins) * 100);
        return `
            <div class="chart-bar-col" title="${d.mins} min">
                <div class="chart-bar-fill" style="height:${Math.max(6, hPct)}%"></div>
                <span class="chart-bar-day">${d.label}</span>
            </div>
        `;
    }).join('');
}

/* ==========================================================================
   SCRATCHPAD MARKDOWN & STICKY
   ========================================================================== */
function initScratchpad() {
    const sp = document.getElementById('scratchpad');
    const sticky = document.getElementById('sticky-note-input');
    if (sp) {
        sp.value = appState.notes[activeNotesTab] || '';
        updateScratchpadMetrics();
        sp.addEventListener('input', () => {
            appState.notes[activeNotesTab] = sp.value;
            updateScratchpadMetrics();
            saveState();
        });
    }
    if (sticky) {
        sticky.value = appState.stickyNote || '';
        sticky.addEventListener('input', () => {
            appState.stickyNote = sticky.value;
            saveState();
        });
    }
}

window.setNotesTab = function (tab) {
    activeNotesTab = tab;
    ['general', 'comandos', 'clases'].forEach(t => document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab));
    const sp = document.getElementById('scratchpad');
    if (sp) sp.value = appState.notes[tab] || '';
    updateScratchpadMetrics();
};

function updateScratchpadMetrics() {
    const text = document.getElementById('scratchpad')?.value || '';
    const lines = text ? text.split('\n').length : 0;
    const el = document.getElementById('scratchpad-metrics');
    if (el) el.textContent = `${lines} líneas • ${text.length} caracteres`;
}

window.toggleScratchpadPreview = function () {
    const sp = document.getElementById('scratchpad');
    const prev = document.getElementById('scratchpad-preview');
    const btn = document.getElementById('btn-notes-preview');
    if (!sp || !prev) return;

    const showPrev = prev.style.display === 'none';
    if (showPrev) {
        prev.innerHTML = simpleMarkdownToHtml(sp.value);
        sp.style.display = 'none';
        prev.style.display = 'block';
        btn?.classList.add('active');
    } else {
        sp.style.display = 'block';
        prev.style.display = 'none';
        btn?.classList.remove('active');
    }
};

function simpleMarkdownToHtml(md) {
    let html = escapeHtml(md);
    html = html.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    html = html.replace(/^### (.*$)/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    return html.replace(/\n/g, '<br>');
}

window.toggleScratchpadFind = function () {
    toggleForm('scratchpad-find-bar');
};

window.replaceInScratchpad = function (all) {
    const sp = document.getElementById('scratchpad');
    const find = document.getElementById('sp-find-text')?.value;
    const rep = document.getElementById('sp-replace-text')?.value || '';
    if (!sp || !find) return;

    sp.value = all ? sp.value.split(find).join(rep) : sp.value.replace(find, rep);
    appState.notes[activeNotesTab] = sp.value;
    saveState();
};

window.insertNoteTemplate = function (key) {
    const tpls = {
        clase: `\n## Clase - ${new Date().toLocaleDateString('es-ES')}\n- **Tema:** \n- **Puntos clave:** \n- **Dudas:** \n`,
        comando: `\n### Comando\n\`\`\`bash\n\n\`\`\`\n`,
        practica: `\n## Análisis Práctica\n- **Requisitos:** \n- **Casos límite:** \n`,
        readme: `\n# Nombre Proyecto\n\n## Instalación\n\`\`\`bash\n\n\`\`\`\n`
    };
    const sp = document.getElementById('scratchpad');
    if (sp && tpls[key]) {
        sp.value += tpls[key];
        appState.notes[activeNotesTab] = sp.value;
        saveState();
    }
};

window.insertNoteTimestamp = function () {
    const sp = document.getElementById('scratchpad');
    if (sp) {
        sp.value += `\n[${new Date().toLocaleString('es-ES')}] `;
        appState.notes[activeNotesTab] = sp.value;
        saveState();
    }
};

window.insertNoteCodeBlock = function () {
    const sp = document.getElementById('scratchpad');
    if (sp) {
        sp.value += `\n\`\`\`\n\n\`\`\`\n`;
        appState.notes[activeNotesTab] = sp.value;
        saveState();
    }
};

window.toolCopy = function () {
    navigator.clipboard.writeText(document.getElementById('scratchpad')?.value || '');
    showToast('Notas copiadas al portapapeles', 'success');
};

window.toolDownload = function () {
    downloadTextFile(`notas_${activeNotesTab}.md`, document.getElementById('scratchpad')?.value || '', 'text/markdown');
};

window.openNoteHistoryModal = function () {
    appState.noteHistory.unshift({
        date: new Date().toLocaleString('es-ES'),
        tab: activeNotesTab,
        content: appState.notes[activeNotesTab]
    });
    appState.noteHistory = appState.noteHistory.slice(0, 10);
    saveState(false);
    showToast('Versión actual guardada en historial de notas', 'success');
};

window.copyStickyNote = function () {
    navigator.clipboard.writeText(document.getElementById('sticky-note-input')?.value || '');
    showToast('Sticky copiado');
};

window.clearStickyNote = function () {
    const el = document.getElementById('sticky-note-input');
    if (el) el.value = '';
    appState.stickyNote = '';
    saveState();
};

/* ==========================================================================
   ACADEMIA: KANBAN, NOTAS PONDERADAS + SIMULADOR, STUDY HUB & PROYECTOS
   ========================================================================== */
window.toggleExamCramFilter = function () {
    examCramOnly = !examCramOnly;
    document.getElementById('btn-exam-cram-mode')?.classList.toggle('active', examCramOnly);
    renderKanban();
    renderFlashcards();
};

window.addKanbanTask = function () {
    const title = document.getElementById('kanban-new-title')?.value.trim();
    const subject = document.getElementById('kanban-new-subject')?.value.trim() || 'DAM';
    const pomosEst = Number(document.getElementById('kanban-new-pomos')?.value || 2);
    const prio = document.getElementById('kanban-new-prio')?.value || 'medium';
    if (!title) return;

    appState.kanban.push({ id: 'kb_' + Date.now(), title, subject, pomosEst, pomosDone: 0, prio, status: 'todo' });
    document.getElementById('kanban-new-title').value = '';
    toggleForm('form-kanban-add');
    saveState();
    renderKanban();
};

function renderKanban() {
    ['todo', 'doing', 'done'].forEach(col => {
        const box = document.getElementById(`kanban-list-${col}`);
        const badge = document.getElementById(`kanban-count-${col}`);
        let items = appState.kanban.filter(k => k.status === col);
        if (examCramOnly) {
            items = items.filter(k => k.status !== 'done');
        }
        if (badge) badge.textContent = items.length;
        if (!box) return;

        box.innerHTML = items.map(k => `
            <div class="kanban-card">
                <div class="kanban-card-header">
                    <span class="kanban-subject-tag">${escapeHtml(k.subject)}</span>
                    <span>${k.prio === 'high' ? '🔴' : k.prio === 'medium' ? '🟠' : '🔵'}</span>
                </div>
                <div style="font-weight:600;font-size:0.78rem;">${escapeHtml(k.title)}</div>
                <div class="kanban-card-footer">
                    <span>🍅 ${k.pomosDone}/${k.pomosEst}</span>
                    <div>
                        <button type="button" class="btn-icon" onclick="startCustomPomodoro('focus', '${escapeHtml(k.title)}', '${k.id}')" title="Iniciar Pomodoro">▶</button>
                        ${col !== 'done' ? `<button type="button" class="btn-icon" onclick="advanceKanban('${k.id}')" title="Avanzar columna">➡</button>` : ''}
                        <button type="button" class="btn-icon" onclick="deleteKanban('${k.id}')">🗑️</button>
                    </div>
                </div>
            </div>
        `).join('');
    });
}

window.advanceKanban = function (id) {
    const k = appState.kanban.find(x => x.id === id);
    if (!k) return;
    k.status = k.status === 'todo' ? 'doing' : 'done';
    saveState();
    renderKanban();
};

window.deleteKanban = function (id) {
    appState.kanban = appState.kanban.filter(x => x.id !== id);
    saveState();
    renderKanban();
};

function incrementKanbanPomo(id) {
    const k = appState.kanban.find(x => x.id === id);
    if (k) {
        k.pomosDone += 1;
        saveState();
        renderKanban();
    }
}

window.addGradeSubject = function () {
    const name = document.getElementById('new-grade-subj-name')?.value.trim();
    const target = Number(document.getElementById('new-grade-subj-target')?.value || 5.0);
    const credits = Number(document.getElementById('new-grade-subj-credits')?.value || 6);
    if (!name) return;

    appState.gradeSubjects.push({ id: 'gs_' + Date.now(), name, target, credits, items: [] });
    document.getElementById('new-grade-subj-name').value = '';
    toggleForm('form-add-grade-subject');
    saveState();
    renderGrades();
};

function renderGrades() {
    const container = document.getElementById('grades-subjects-container');
    const globalBadge = document.getElementById('global-course-avg-badge');
    if (!container) return;

    let weightedSum = 0;
    let totalCredits = 0;

    container.innerHTML = appState.gradeSubjects.map(subj => {
        let evalWeight = 0;
        let currentPoints = 0;
        subj.items.forEach(it => {
            evalWeight += Number(it.weight);
            currentPoints += (Number(it.score) * Number(it.weight)) / 100;
        });
        const currentAvg = evalWeight > 0 ? (currentPoints / (evalWeight / 100)) : 0;
        const remWeight = Math.max(0, 100 - evalWeight);
        const needed = remWeight > 0 ? ((subj.target - currentPoints) / (remWeight / 100)) : 0;

        if (evalWeight > 0) {
            weightedSum += currentAvg * subj.credits;
            totalCredits += subj.credits;
        }

        const passClass = currentAvg >= subj.target ? 'score-pass' : 'score-fail';

        return `
            <div class="grade-subject-card">
                <div class="grade-subj-header">
                    <strong>${escapeHtml(subj.name)} (${subj.credits}h)</strong>
                    <div class="filter-pills-row">
                        <span class="grade-subj-score ${passClass}">Media: ${currentAvg.toFixed(2)} / Obj: ${subj.target}</span>
                        <button type="button" class="btn-icon" onclick="deleteGradeSubject('${subj.id}')">🗑️</button>
                    </div>
                </div>
                <div class="grade-progress-bar-bg">
                    <div class="grade-progress-bar-fill" style="width:${Math.min(100, evalWeight)}%"></div>
                </div>
                <div class="grade-needed-banner">
                    Evaluado: ${evalWeight}% • ${remWeight > 0 ? `Necesitas <strong>${Math.max(0, needed).toFixed(2)}</strong> en el ${remWeight}% restante para llegar a ${subj.target}` : '100% evaluado'}
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;">
                    ${subj.items.map(it => `
                        <div class="form-inline-between" style="font-size:0.74rem;font-family:var(--font-mono);">
                            <span>${escapeHtml(it.name)} (${it.weight}%) → <strong>${it.score}</strong></span>
                            <button type="button" class="btn-icon" onclick="deleteGradeItem('${subj.id}', '${it.id}')">×</button>
                        </div>
                    `).join('')}
                </div>
                <div class="form-inline-row">
                    <input type="text" id="gi-name-${subj.id}" placeholder="Prueba">
                    <input type="number" id="gi-w-${subj.id}" placeholder="%" style="max-width:65px;">
                    <input type="number" id="gi-s-${subj.id}" placeholder="Nota" step="0.1" style="max-width:75px;">
                    <button type="button" class="btn-cyan btn-sm" onclick="addGradeItem('${subj.id}')">✚</button>
                </div>
            </div>
        `;
    }).join('');

    if (globalBadge) {
        const gAvg = totalCredits > 0 ? (weightedSum / totalCredits).toFixed(2) : '--';
        globalBadge.textContent = `Media Global: ${gAvg}`;
    }
}

window.addGradeItem = function (subjId) {
    const subj = appState.gradeSubjects.find(s => s.id === subjId);
    if (!subj) return;
    const name = document.getElementById(`gi-name-${subjId}`)?.value.trim() || 'Prueba';
    const weight = Number(document.getElementById(`gi-w-${subjId}`)?.value || 0);
    const score = Number(document.getElementById(`gi-s-${subjId}`)?.value || 0);
    if (weight <= 0) return;

    subj.items.push({ id: 'gi_' + Date.now(), name, weight, score });
    saveState();
    renderGrades();
};

window.deleteGradeItem = function (subjId, itemId) {
    const subj = appState.gradeSubjects.find(s => s.id === subjId);
    if (subj) {
        subj.items = subj.items.filter(i => i.id !== itemId);
        saveState();
        renderGrades();
    }
};

window.deleteGradeSubject = function (subjId) {
    appState.gradeSubjects = appState.gradeSubjects.filter(s => s.id !== subjId);
    saveState();
    renderGrades();
};

// Study Hub: Flashcards, Bug Log & Dudas
window.setStudyHubTab = function (tab) {
    studyHubTab = tab;
    ['flashcards', 'bugs', 'doubts'].forEach(t => {
        document.getElementById(`hub-tab-${t}`)?.classList.toggle('active', t === tab);
        const view = document.getElementById(`hub-view-${t}`);
        if (view) view.style.display = t === tab ? 'block' : 'none';
    });
};

function getFilteredFlashcards() {
    const subj = document.getElementById('fc-filter-subject')?.value || 'all';
    return appState.flashcards.filter(fc => {
        if (subj !== 'all' && fc.subject !== subj) return false;
        if (examCramOnly && fc.mastered) return false;
        return true;
    });
}

function renderFlashcards() {
    const stage = document.getElementById('flashcard-stage');
    const sel = document.getElementById('fc-filter-subject');
    if (sel) {
        const cur = sel.value;
        const subjects = Array.from(new Set(appState.flashcards.map(f => f.subject)));
        sel.innerHTML = `<option value="all">Todas las asignaturas</option>` +
            subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
        if (subjects.includes(cur)) sel.value = cur;
    }

    if (!stage) return;
    const deck = getFilteredFlashcards();
    if (!deck.length) {
        stage.innerHTML = `<span class="fc-hint">No hay tarjetas pendientes en este filtro. ¡Añade una arriba!</span>`;
        return;
    }

    if (currentFlashcardIndex >= deck.length) currentFlashcardIndex = 0;
    const card = deck[currentFlashcardIndex];

    stage.innerHTML = `
        <span class="badge-version" style="margin-bottom:8px;">${escapeHtml(card.subject)} • ${currentFlashcardIndex + 1}/${deck.length} ${card.mastered ? '✅' : ''}</span>
        <div class="${flashcardFlipped ? 'fc-answer-text' : 'fc-question-text'}">
            ${escapeHtml(flashcardFlipped ? card.a : card.q)}
        </div>
        <span class="fc-hint" style="margin-top:10px;">(Clic para girar)</span>
    `;
}

window.flipCurrentFlashcard = function () {
    flashcardFlipped = !flashcardFlipped;
    renderFlashcards();
};

window.nextFlashcard = function () {
    currentFlashcardIndex++;
    flashcardFlipped = false;
    renderFlashcards();
};

window.markFlashcardStatus = function (mastered) {
    const deck = getFilteredFlashcards();
    const card = deck[currentFlashcardIndex];
    if (card) {
        card.mastered = mastered;
        saveState();
        nextFlashcard();
    }
};

window.addFlashcard = function () {
    const subject = document.getElementById('fc-new-subj')?.value.trim() || 'General';
    const q = document.getElementById('fc-new-q')?.value.trim();
    const a = document.getElementById('fc-new-a')?.value.trim();
    if (!q || !a) return;

    appState.flashcards.push({ id: 'fc_' + Date.now(), subject, q, a, mastered: false });
    document.getElementById('fc-new-q').value = '';
    document.getElementById('fc-new-a').value = '';
    toggleForm('form-add-flashcard');
    saveState();
    renderFlashcards();
};

window.deleteCurrentFlashcard = function () {
    const deck = getFilteredFlashcards();
    const card = deck[currentFlashcardIndex];
    if (card) {
        appState.flashcards = appState.flashcards.filter(f => f.id !== card.id);
        saveState();
        renderFlashcards();
    }
};

window.addBugLog = function () {
    const subj = document.getElementById('bug-new-subj')?.value.trim() || 'Código';
    const error = document.getElementById('bug-new-error')?.value.trim();
    const cause = document.getElementById('bug-new-cause')?.value.trim();
    const fix = document.getElementById('bug-new-fix')?.value.trim();
    if (!error) return;

    appState.bugLogs.unshift({ id: 'bug_' + Date.now(), subj, error, cause, fix, date: new Date().toLocaleDateString('es-ES') });
    toggleForm('form-add-bug');
    saveState();
    renderBugLogs();
};

function renderBugLogs() {
    const list = document.getElementById('bug-log-list');
    if (!list) return;
    const q = (document.getElementById('bug-search-input')?.value || '').toLowerCase();
    const filtered = appState.bugLogs.filter(b => `${b.subj} ${b.error} ${b.cause} ${b.fix}`.toLowerCase().includes(q));

    list.innerHTML = filtered.map(b => `
        <div class="hub-item-card">
            <div class="form-inline-between">
                <span class="kanban-subject-tag">${escapeHtml(b.subj)}</span>
                <button type="button" class="btn-icon" onclick="deleteBugLog('${b.id}')">🗑️</button>
            </div>
            <strong style="color:var(--accent-red);font-size:0.78rem;">${escapeHtml(b.error)}</strong>
            <div class="mono-muted">Causa: ${escapeHtml(b.cause || '-')}</div>
            <div style="color:var(--accent-green);font-size:0.76rem;">Solución: ${escapeHtml(b.fix || '-')}</div>
        </div>
    `).join('');
}

window.deleteBugLog = function (id) {
    appState.bugLogs = appState.bugLogs.filter(b => b.id !== id);
    saveState();
    renderBugLogs();
};

window.addClassDoubt = function () {
    const subj = document.getElementById('doubt-new-subj')?.value.trim() || 'Clase';
    const text = document.getElementById('doubt-new-text')?.value.trim();
    if (!text) return;

    appState.doubts.unshift({ id: 'db_' + Date.now(), subj, text, resolved: false });
    document.getElementById('doubt-new-text').value = '';
    saveState();
    renderDoubts();
};

function renderDoubts() {
    const list = document.getElementById('doubts-list');
    if (!list) return;
    list.innerHTML = appState.doubts.map(d => `
        <div class="hub-item-card" style="flex-direction:row;justify-content:space-between;align-items:center;">
            <span style="${d.resolved ? 'text-decoration:line-through;opacity:0.6;' : ''}">
                <span class="kanban-subject-tag">${escapeHtml(d.subj)}</span> ${escapeHtml(d.text)}
            </span>
            <div>
                <button type="button" class="btn-icon" onclick="toggleDoubtResolved('${d.id}')">✅</button>
                <button type="button" class="btn-icon" onclick="deleteDoubt('${d.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

window.toggleDoubtResolved = function (id) {
    const d = appState.doubts.find(x => x.id === id);
    if (d) { d.resolved = !d.resolved; saveState(); renderDoubts(); }
};

window.deleteDoubt = function (id) {
    appState.doubts = appState.doubts.filter(x => x.id !== id);
    saveState();
    renderDoubts();
};

window.exportStudyHubMarkdown = function () {
    const md = [
        '# Study Hub Export',
        '## Flashcards',
        ...appState.flashcards.map(f => `- **${f.subject}**: ${f.q} -> _${f.a}_`),
        '\n## Bug Log',
        ...appState.bugLogs.map(b => `- [${b.subj}] **${b.error}**: ${b.fix}`),
        '\n## Dudas',
        ...appState.doubts.map(d => `- [${d.resolved ? 'x' : ' '}] (${d.subj}) ${d.text}`)
    ].join('\n');
    navigator.clipboard.writeText(md);
    showToast('Study Hub copiado en Markdown', 'success');
};

window.calculateStudyPlan = function () {
    const examDateVal = document.getElementById('planner-exam-date')?.value;
    const topics = Number(document.getElementById('planner-topics-count')?.value || 8);
    const minsPerTopic = Number(document.getElementById('planner-mins-topic')?.value || 45);
    const out = document.getElementById('study-planner-result');
    if (!out || !examDateVal) return;

    const daysLeft = Math.max(1, Math.ceil((new Date(examDateVal) - getNow()) / 86400000));
    const totalMins = topics * minsPerTopic;
    const minsPerDay = Math.ceil(totalMins / daysLeft);
    const pomosPerDay = Math.ceil(minsPerDay / 25);

    out.textContent = `Quedan ${daysLeft} días → Dedica ${minsPerDay} min/día (~${pomosPerDay} Pomodoros/día) para cubrir los ${topics} temas.`;
};

window.addTeamProject = function () {
    const name = document.getElementById('proj-new-name')?.value.trim();
    const repo = document.getElementById('proj-new-repo')?.value.trim();
    const working = document.getElementById('proj-new-working')?.value.trim();
    const pending = document.getElementById('proj-new-pending')?.value.trim();
    if (!name) return;

    appState.teamProjects.unshift({ id: 'prj_' + Date.now(), name, repo, working, pending });
    toggleForm('form-add-project');
    saveState();
    renderTeamProjects();
};

function renderTeamProjects() {
    const list = document.getElementById('team-projects-list');
    if (!list) return;
    list.innerHTML = appState.teamProjects.map(p => `
        <div class="hub-item-card">
            <div class="form-inline-between">
                <strong>${escapeHtml(p.name)}</strong>
                <div>
                    ${p.repo ? `<a href="${escapeHtml(p.repo)}" target="_blank" class="btn-cyan btn-sm" style="text-decoration:none;">Repo</a>` : ''}
                    <button type="button" class="btn-icon" onclick="deleteTeamProject('${p.id}')">🗑️</button>
                </div>
            </div>
            <div style="color:var(--accent-green);font-size:0.74rem;">✅ OK: ${escapeHtml(p.working || '-')}</div>
            <div style="color:var(--accent-yellow);font-size:0.74rem;">⏳ Pendiente: ${escapeHtml(p.pending || '-')}</div>
        </div>
    `).join('');
}

window.deleteTeamProject = function (id) {
    appState.teamProjects = appState.teamProjects.filter(p => p.id !== id);
    saveState();
    renderTeamProjects();
};

/* ==========================================================================
   DEV & SYSADMIN LAB (TOOLBOX, SERVIDORES, SNIPPETS Y ENLACES)
   ========================================================================== */
window.setToolboxTab = function (tab) {
    ['format', 'encode', 'regex', 'net', 'sys', 'gen'].forEach(t => {
        document.getElementById(`tb-tab-${t}`)?.classList.toggle('active', t === tab);
        const view = document.getElementById(`tb-view-${t}`);
        if (view) view.style.display = t === tab ? 'flex' : 'none';
    });
};

window.tbFormatJson = function (minify) {
    const inp = document.getElementById('tb-json-input');
    const status = document.getElementById('tb-json-status');
    try {
        const obj = JSON.parse(inp.value);
        inp.value = minify ? JSON.stringify(obj) : JSON.stringify(obj, null, 2);
        if (status) status.textContent = '✅ JSON válido';
    } catch (e) {
        if (status) status.textContent = `❌ Error JSON: ${e.message}`;
    }
};

window.tbJsonToCsv = function () {
    const inp = document.getElementById('tb-json-input');
    try {
        const arr = JSON.parse(inp.value);
        if (!Array.isArray(arr) || !arr.length) throw new Error('Debe ser un array de objetos');
        const keys = Object.keys(arr[0]);
        const csv = [keys.join(','), ...arr.map(row => keys.map(k => JSON.stringify(row[k] ?? '')).join(','))].join('\n');
        inp.value = csv;
    } catch (e) {
        document.getElementById('tb-json-status').textContent = `❌ ${e.message}`;
    }
};

window.tbCsvToJson = function () {
    const inp = document.getElementById('tb-json-input');
    const lines = inp.value.trim().split('\n');
    if (lines.length < 2) return;
    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const res = lines.slice(1).map(line => {
        const vals = line.split(',');
        const obj = {};
        headers.forEach((h, i) => { obj[h] = (vals[i] || '').trim().replace(/^"|"$/g, ''); });
        return obj;
    });
    inp.value = JSON.stringify(res, null, 2);
};

window.tbFormatSql = function () {
    const inp = document.getElementById('tb-json-input');
    inp.value = inp.value
        .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT JOIN|INNER JOIN|GROUP BY|ORDER BY|HAVING|INSERT INTO|VALUES|UPDATE|SET|DELETE FROM)\b/gi, '\n$1')
        .trim();
};

window.tbEncodeAction = function (action) {
    const val = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    try {
        if (action === 'b64e') out.textContent = btoa(unescape(encodeURIComponent(val)));
        if (action === 'b64d') out.textContent = decodeURIComponent(escape(atob(val.trim())));
        if (action === 'urle') out.textContent = encodeURIComponent(val);
        if (action === 'urld') out.textContent = decodeURIComponent(val);
    } catch (e) {
        out.textContent = `Error: ${e.message}`;
    }
};

window.tbDecodeJwt = function () {
    const token = (document.getElementById('tb-encode-input')?.value || '').trim();
    const out = document.getElementById('tb-encode-output');
    try {
        const parts = token.split('.');
        if (parts.length < 2) throw new Error('JWT inválido');
        const header = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
        out.textContent = `HEADER:\n${JSON.stringify(header, null, 2)}\n\nPAYLOAD:\n${JSON.stringify(payload, null, 2)}`;
    } catch (e) {
        out.textContent = `Error JWT: ${e.message}`;
    }
};

window.tbComputeHashes = async function () {
    const text = document.getElementById('tb-encode-input')?.value || '';
    const out = document.getElementById('tb-encode-output');
    const data = new TextEncoder().encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashHex = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
    out.textContent = `SHA-256:\n${hashHex}`;
};

window.runRegexTester = function () {
    const pattern = document.getElementById('tb-regex-pattern')?.value || '';
    const flags = document.getElementById('tb-regex-flags')?.value || 'g';
    const text = document.getElementById('tb-regex-text')?.value || '';
    const resEl = document.getElementById('tb-regex-result');
    try {
        const rx = new RegExp(pattern, flags);
        const matches = text.match(rx) || [];
        resEl.textContent = `Coincidencias (${matches.length}): ${matches.join(' | ')}`;
    } catch (e) {
        resEl.textContent = `Regex inválido: ${e.message}`;
    }
};

window.runSimpleDiff = function () {
    const a = (document.getElementById('tb-regex-text')?.value || '').split('\n');
    const b = (document.getElementById('tb-diff-b')?.value || '').split('\n');
    const out = document.getElementById('tb-diff-output');
    const max = Math.max(a.length, b.length);
    const lines = [];
    for (let i = 0; i < max; i++) {
        if (a[i] !== b[i]) {
            lines.push(`Línea ${i + 1}:\n  - A: ${a[i] ?? '(vacío)'}\n  + B: ${b[i] ?? '(vacío)'}`);
        }
    }
    out.textContent = lines.length ? lines.join('\n') : 'Sin diferencias entre Bloque A y Bloque B.';
};

window.calculateSubnet = function () {
    const raw = (document.getElementById('tb-ip-input')?.value || '').trim();
    const out = document.getElementById('tb-subnet-output');
    const match = raw.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/);
    if (!match) {
        out.textContent = 'Formato esperado: 192.168.1.50/24';
        return;
    }
    const octs = match.slice(1, 5).map(Number);
    const cidr = Number(match[5]);
    if (octs.some(o => o > 255) || cidr > 32) {
        out.textContent = 'IP o máscara fuera de rango';
        return;
    }
    const ipInt = ((octs[0] << 24) | (octs[1] << 16) | (octs[2] << 8) | octs[3]) >>> 0;
    const maskInt = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
    const netInt = (ipInt & maskInt) >>> 0;
    const bcastInt = (netInt | (~maskInt >>> 0)) >>> 0;
    const toIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join('.');
    const hosts = cidr >= 31 ? (cidr === 32 ? 1 : 2) : Math.pow(2, 32 - cidr) - 2;

    out.textContent = `Red: ${toIp(netInt)}/${cidr}\nMáscara: ${toIp(maskInt)}\nBroadcast: ${toIp(bcastInt)}\nHosts útiles: ${hosts}`;
};

window.convertNumberBase = function (fromBase, val) {
    const clean = val.trim();
    if (!clean) return;
    const radices = { dec: 10, bin: 2, hex: 16, oct: 8 };
    const num = parseInt(clean, radices[fromBase]);
    if (isNaN(num)) return;
    if (fromBase !== 'dec') document.getElementById('base-dec').value = num.toString(10);
    if (fromBase !== 'bin') document.getElementById('base-bin').value = num.toString(2);
    if (fromBase !== 'hex') document.getElementById('base-hex').value = num.toString(16).toUpperCase();
    if (fromBase !== 'oct') document.getElementById('base-oct').value = num.toString(8);
};

window.updateChmodCalc = function () {
    const calc = p => (document.getElementById(`ch-${p}r`)?.checked ? 4 : 0) +
        (document.getElementById(`ch-${p}w`)?.checked ? 2 : 0) +
        (document.getElementById(`ch-${p}x`)?.checked ? 1 : 0);
    const sym = p => (document.getElementById(`ch-${p}r`)?.checked ? 'r' : '-') +
        (document.getElementById(`ch-${p}w`)?.checked ? 'w' : '-') +
        (document.getElementById(`ch-${p}x`)?.checked ? 'x' : '-');

    const oct = `${calc('u')}${calc('g')}${calc('o')}`;
    document.getElementById('chmod-octal').textContent = oct;
    document.getElementById('chmod-symbolic').textContent = `${sym('u')}${sym('g')}${sym('o')}`;
};

window.copyChmodCmd = function () {
    const oct = document.getElementById('chmod-octal')?.textContent || '755';
    navigator.clipboard.writeText(`chmod ${oct} `);
    showToast(`Copiado: chmod ${oct}`, 'success');
};

window.explainCronExpr = function () {
    const expr = (document.getElementById('cron-expr-input')?.value || '').trim();
    const out = document.getElementById('cron-explanation');
    const parts = expr.split(/\s+/);
    if (parts.length !== 5) {
        out.textContent = 'Formato estándar: minuto hora día_mes mes día_semana (5 campos)';
        return;
    }
    out.textContent = `Minuto: ${parts[0]} | Hora: ${parts[1]} | Día mes: ${parts[2]} | Mes: ${parts[3]} | Día semana: ${parts[4]}`;
};

window.generateMockUsers = function (count) {
    const names = ['Marcos', 'Aitor', 'Rubén', 'Elena', 'Carlos'];
    const arr = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        nombre: names[i % names.length],
        email: `${names[i % names.length].toLowerCase()}${i + 1}@example.com`,
        activo: true
    }));
    document.getElementById('tb-gen-output').value = JSON.stringify(arr, null, 2);
};

window.generateUuidsAndDni = function () {
    const uuid = crypto.randomUUID();
    const num = Math.floor(10000000 + Math.random() * 89999999);
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const dni = `${num}${letters[num % 23]}`;
    document.getElementById('tb-gen-output').value = `UUID v4: ${uuid}\nDNI Test: ${dni}`;
};

window.generateSecurePassword = function () {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
    const arr = new Uint32Array(16);
    crypto.getRandomValues(arr);
    const pass = Array.from(arr, x => chars[x % chars.length]).join('');
    document.getElementById('tb-gen-output').value = pass;
};

window.loadBoilerplate = function (type) {
    const files = {
        dockerfile: `FROM node:20-alpine\nWORKDIR /app\nCOPY package*.json ./\nRUN npm ci --only=production\nCOPY . .\nEXPOSE 3000\nCMD ["node", "index.js"]`,
        compose: `services:\n  app:\n    image: nginx:alpine\n    restart: unless-stopped\n    ports:\n      - "8080:80"\n    volumes:\n      - ./html:/usr/share/nginx/html:ro`
    };
    document.getElementById('tb-gen-output').value = files[type] || '';
};

// Servidores & Changelog
window.addServer = function () {
    const name = document.getElementById('srv-name')?.value.trim();
    const ip = document.getElementById('srv-ip')?.value.trim();
    const port = document.getElementById('srv-port')?.value.trim() || '22';
    const user = document.getElementById('srv-creds')?.value.trim() || 'root';
    const logs = document.getElementById('srv-logs')?.value.trim() || '';
    if (!name || !ip) return;

    appState.servers.push({ id: 'srv_' + Date.now(), name, ip, port, user, logs });
    toggleForm('form-servers');
    saveState();
    renderServers();
};

function renderServers() {
    const list = document.getElementById('servers-list');
    if (!list) return;
    const q = (document.getElementById('srv-search-filter')?.value || '').toLowerCase();
    const items = appState.servers.filter(s => `${s.name} ${s.ip} ${s.port} ${s.logs}`.toLowerCase().includes(q));

    list.innerHTML = items.map(s => {
        const sshCmd = `ssh -p ${s.port || 22} ${s.user || 'root'}@${s.ip}`;
        return `
            <li style="flex-direction:column;align-items:stretch;">
                <div class="form-inline-between">
                    <strong>${escapeHtml(s.name)} <span class="mono-muted">(${escapeHtml(s.ip)}:${escapeHtml(s.port || '22')})</span></strong>
                    <div>
                        <button type="button" class="btn-cyan btn-sm" onclick="copyRawText('${escapeHtml(sshCmd)}')" title="Copiar comando SSH">SSH</button>
                        <button type="button" class="btn-icon" onclick="deleteServer('${s.id}')">🗑️</button>
                    </div>
                </div>
                ${s.logs ? `<small class="mono-muted">Ruta: ${escapeHtml(s.logs)}</small>` : ''}
            </li>
        `;
    }).join('');
}

window.deleteServer = function (id) {
    appState.servers = appState.servers.filter(s => s.id !== id);
    saveState();
    renderServers();
};

window.addInfraChangelog = function () {
    const inp = document.getElementById('infra-changelog-input');
    const text = inp?.value.trim();
    if (!text) return;
    appState.infraChangelog.unshift({ id: 'cl_' + Date.now(), text, date: new Date().toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) });
    inp.value = '';
    saveState();
    renderInfraChangelog();
};

function renderInfraChangelog() {
    const list = document.getElementById('infra-changelog-list');
    if (!list) return;
    list.innerHTML = appState.infraChangelog.map(c => `
        <div class="form-inline-between" style="font-size:0.72rem;font-family:var(--font-mono);padding:3px 0;border-bottom:1px dashed rgba(255,255,255,0.06);">
            <span>[${c.date}] ${escapeHtml(c.text)}</span>
            <button type="button" class="btn-icon" onclick="deleteInfraChangelog('${c.id}')">×</button>
        </div>
    `).join('');
}

window.deleteInfraChangelog = function (id) {
    appState.infraChangelog = appState.infraChangelog.filter(c => c.id !== id);
    saveState();
    renderInfraChangelog();
};

// Snippets & Bookmarks
window.addCustomSnippet = function () {
    const title = document.getElementById('snip-new-title')?.value.trim();
    const cat = document.getElementById('snip-new-cat')?.value.trim() || 'CLI';
    const cmd = document.getElementById('snip-new-cmd')?.value.trim();
    if (!title || !cmd) return;

    appState.customSnippets.unshift({ id: 'sn_' + Date.now(), title, cat, cmd });
    toggleForm('form-add-snippet');
    saveState();
    renderSnippets();
};

function renderSnippets() {
    const box = document.getElementById('snippet-list-container');
    if (!box) return;
    const q = (document.getElementById('snippet-search')?.value || '').toLowerCase();
    const u = document.getElementById('cli-var-user')?.value || 'root';
    const ip = document.getElementById('cli-var-ip')?.value || '192.168.1.10';
    const port = document.getElementById('cli-var-port')?.value || '22';

    const items = appState.customSnippets.filter(s => `${s.title} ${s.cat} ${s.cmd}`.toLowerCase().includes(q));
    box.innerHTML = items.map(s => {
        const resolved = s.cmd.replace(/\{\{USER\}\}/g, u).replace(/\{\{IP\}\}/g, ip).replace(/\{\{PORT\}\}/g, port);
        return `
            <div class="snippet-box">
                <div>
                    <div class="mono-muted">[${escapeHtml(s.cat)}] ${escapeHtml(s.title)}</div>
                    <div class="snippet-cmd-text">${escapeHtml(resolved)}</div>
                </div>
                <div class="filter-pills-row">
                    <button type="button" class="btn-cyan btn-sm" onclick="copyRawText('${escapeHtml(resolved)}')">📋</button>
                    <button type="button" class="btn-icon" onclick="deleteSnippet('${s.id}')">🗑️</button>
                </div>
            </div>
        `;
    }).join('');
}

window.deleteSnippet = function (id) {
    appState.customSnippets = appState.customSnippets.filter(s => s.id !== id);
    saveState();
    renderSnippets();
};

window.addBookmark = function () {
    const name = document.getElementById('bm-name')?.value.trim();
    const url = document.getElementById('bm-url')?.value.trim();
    if (!name || !url) return;
    appState.bookmarks.push({ id: 'bm_' + Date.now(), name, url });
    toggleForm('form-bookmarks');
    saveState();
    renderBookmarks();
};

function renderBookmarks() {
    const list = document.getElementById('bookmarks-list');
    if (!list) return;
    list.innerHTML = appState.bookmarks.map(b => `
        <li>
            <a href="${escapeHtml(b.url)}" target="_blank" style="color:var(--accent-cyan);text-decoration:none;">🔗 ${escapeHtml(b.name)}</a>
            <button type="button" class="btn-icon" onclick="deleteBookmark('${b.id}')">🗑️</button>
        </li>
    `).join('');
}

window.deleteBookmark = function (id) {
    appState.bookmarks = appState.bookmarks.filter(b => b.id !== id);
    saveState();
    renderBookmarks();
};

/* ==========================================================================
   BUSCADOR GLOBAL (CTRL + K), SNAPSHOTS Y UTILIDADES
   ========================================================================== */
window.openGlobalSearch = function () {
    const modal = document.getElementById('global-search-modal');
    if (!modal) return;
    modal.style.display = 'flex';
    const inp = document.getElementById('global-search-input');
    if (inp) { inp.value = ''; inp.focus(); }
    filterGlobalSearch();
};

window.closeGlobalSearch = function () {
    document.getElementById('global-search-modal').style.display = 'none';
};

window.filterGlobalSearch = function () {
    const q = (document.getElementById('global-search-input')?.value || '').toLowerCase();
    const resList = document.getElementById('global-search-results');
    if (!resList) return;

    const results = [];
    appState.tasks.forEach(t => {
        if (t.text.toLowerCase().includes(q)) results.push({ type: 'Tarea', label: t.text, action: () => switchWorkspace('cockpit') });
    });
    appState.studioProjects.forEach(p => {
        if (p.title.toLowerCase().includes(q)) results.push({ type: 'Proyecto HTML', label: p.title, action: () => { switchWorkspace('studio'); loadSavedStudioProject(p.id); } });
    });
    appState.customSnippets.forEach(s => {
        if (`${s.title} ${s.cmd}`.toLowerCase().includes(q)) results.push({ type: 'Snippet', label: `${s.title}: ${s.cmd}`, action: () => { switchWorkspace('devlab'); copyRawText(s.cmd); } });
    });
    appState.servers.forEach(s => {
        if (`${s.name} ${s.ip}`.toLowerCase().includes(q)) results.push({ type: 'Servidor', label: `${s.name} (${s.ip})`, action: () => switchWorkspace('devlab') });
    });
    appState.bugLogs.forEach(b => {
        if (`${b.error} ${b.fix}`.toLowerCase().includes(q)) results.push({ type: 'Bug', label: b.error, action: () => { switchWorkspace('academy'); setStudyHubTab('bugs'); } });
    });

    resList.innerHTML = results.slice(0, 15).map((r, i) => `
        <li class="search-result-item" onclick="window._globalSearchActions[${i}](); closeGlobalSearch();">
            <span><strong>[${r.type}]</strong> ${escapeHtml(r.label)}</span>
            <span class="badge-version">Ir ↵</span>
        </li>
    `).join('');
    window._globalSearchActions = results.slice(0, 15).map(r => r.action);
};

window.handleGlobalSearchKeydown = function (e) {
    if (e.key === 'Escape') closeGlobalSearch();
};

function initKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
            e.preventDefault();
            openGlobalSearch();
        } else if (e.altKey && e.key === '1') switchWorkspace('cockpit');
        else if (e.altKey && e.key === '2') switchWorkspace('studio');
        else if (e.altKey && e.key === '3') switchWorkspace('academy');
        else if (e.altKey && e.key === '4') switchWorkspace('devlab');
        else if (e.altKey && e.key === '5') switchWorkspace('fonts');
        else if (e.altKey && e.key.toLowerCase() === 'z') toggleZenMode();
    });
}

window.openSnapshotsModal = function () {
    document.getElementById('snapshots-modal').style.display = 'flex';
    renderSnapshotsList();
};

window.closeSnapshotsModal = function () {
    document.getElementById('snapshots-modal').style.display = 'none';
};

window.createManualSnapshot = function () {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    snaps.unshift({ id: Date.now(), date: new Date().toLocaleString('es-ES'), data: JSON.stringify(appState) });
    localStorage.setItem(SNAPSHOTS_KEY, JSON.stringify(snaps.slice(0, 8)));
    renderSnapshotsList();
    showToast('📸 Snapshot guardado localmente', 'success');
};

function renderSnapshotsList() {
    const box = document.getElementById('snapshots-list-container');
    if (!box) return;
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    box.innerHTML = snaps.length ? snaps.map(s => `
        <div class="hub-item-card" style="flex-direction:row;justify-content:space-between;align-items:center;">
            <span>📸 ${escapeHtml(s.date)}</span>
            <button type="button" class="btn-cyan btn-sm" onclick="restoreSnapshot(${s.id})">Restaurar</button>
        </div>
    `).join('') : '<p class="mono-muted">No hay snapshots guardados todavía.</p>';
}

window.restoreSnapshot = function (id) {
    const snaps = JSON.parse(localStorage.getItem(SNAPSHOTS_KEY) || '[]');
    const found = snaps.find(s => s.id === id);
    if (found) {
        appState = JSON.parse(found.data);
        saveState();
        applyAllAppearance();
        renderAll();
        closeSnapshotsModal();
        showToast('Snapshot restaurado', 'success');
    }
};

window.generateDailySummaryModal = function () {
    const doneTasks = appState.tasks.filter(t => t.done).map(t => `- [x] ${t.text}`).join('\n') || '- Ninguna';
    const pendingTasks = appState.tasks.filter(t => !t.done).map(t => `- [ ] ${t.text}`).join('\n') || '- Ninguna';
    const md = `# Resumen de Jornada (${new Date().toLocaleDateString('es-ES')})\n\n` +
        `- **Tiempo de Foco Hoy:** ${appState.stats.focusMinutesToday} min\n` +
        `- **Racha Actual:** ${appState.stats.streakDays} días\n\n` +
        `## Tareas Completadas\n${doneTasks}\n\n## Tareas Pendientes\n${pendingTasks}`;
    document.getElementById('daily-summary-output').value = md;
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
    downloadTextFile(`devworkspace_backup_${getTodayIsoKey()}.json`, JSON.stringify(appState, null, 2), 'application/json');
};

window.importData = function (event) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const imported = JSON.parse(String(e.target?.result || '{}'));
            appState = deepMerge(createDefaultState(), imported);
            saveState();
            applyAllAppearance();
            renderAll();
            showToast('Backup JSON importado correctamente', 'success');
        } catch (_) {
            showToast('Archivo JSON inválido', 'error');
        }
    };
    reader.readAsText(file);
};

window.resetWorkspacePrompt = function () {
    if (confirm('¿Seguro que quieres vaciar todos los datos locales de DevWorkspace?')) {
        localStorage.removeItem(STORAGE_KEY);
        appState = createDefaultState();
        applyAllAppearance();
        renderAll();
        showToast('Workspace reiniciado');
    }
};

/* ==========================================================================
   FIREBASE CLOUD SYNC (OPCIONAL SI SE CONFIGURA FIREBASE_CONFIG)
   ========================================================================== */
async function initFirebaseIfConfigured() {
    if (!FIREBASE_CONFIG) return;
    try {
        const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
        const { getAuth, onAuthStateChanged } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

        firebaseApp = initializeApp(FIREBASE_CONFIG);
        firebaseAuth = getAuth(firebaseApp);
        firebaseDb = getFirestore(firebaseApp);

        onAuthStateChanged(firebaseAuth, async (user) => {
            currentUser = user;
            const profWidget = document.getElementById('user-profile-widget');
            const loginBtn = document.getElementById('btn-cloud-login');
            if (user) {
                if (profWidget) profWidget.style.display = 'flex';
                if (loginBtn) loginBtn.style.display = 'none';
                document.getElementById('user-name').textContent = user.email || 'Usuario';
                const snap = await getDoc(doc(firebaseDb, 'workspaces', user.uid));
                if (snap.exists()) {
                    appState = deepMerge(createDefaultState(), snap.data());
                    saveState(false);
                    applyAllAppearance();
                    renderAll();
                }
            } else {
                if (profWidget) profWidget.style.display = 'none';
                if (loginBtn) loginBtn.style.display = 'inline-flex';
            }
        });
    } catch (e) {
        console.warn('Firebase no inicializado:', e);
    }
}

async function syncToFirebaseCloud() {
    if (!currentUser || !firebaseDb) return;
    const ind = document.getElementById('cloud-sync-indicator');
    try {
        if (ind) { ind.textContent = 'Guardando...'; ind.className = 'sync-badge sync-saving'; }
        const { doc, setDoc } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');
        await setDoc(doc(firebaseDb, 'workspaces', currentUser.uid), appState);
        if (ind) { ind.textContent = 'Cloud OK'; ind.className = 'sync-badge'; }
    } catch (_) {
        if (ind) { ind.textContent = 'Sync Error'; ind.className = 'sync-badge sync-error'; }
    }
}

window.openAuthModal = function () { document.getElementById('auth-modal').style.display = 'flex'; };
window.closeAuthModal = function () { document.getElementById('auth-modal').style.display = 'none'; };
window.continueAsGuest = function () { closeAuthModal(); showToast('Trabajando en Modo Local'); };
window.toggleAuthMode = function () {
    isRegisterMode = !isRegisterMode;
    document.getElementById('auth-title').textContent = isRegisterMode ? 'Crear Cuenta Cloud' : 'DevWorkspace Cloud';
    document.getElementById('auth-main-btn').textContent = isRegisterMode ? '✨ Registrarse' : '🔑 Iniciar Sesión';
};

window.handleEmailAuth = async function () {
    if (!firebaseAuth) {
        showToast('Configura window.DEVWORKSPACE_FIREBASE_CONFIG para usar nube', 'error');
        return;
    }
    const email = document.getElementById('auth-email').value.trim();
    const pass = document.getElementById('auth-password').value;
    try {
        const { signInWithEmailAndPassword, createUserWithEmailAndPassword } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
        if (isRegisterMode) await createUserWithEmailAndPassword(firebaseAuth, email, pass);
        else await signInWithEmailAndPassword(firebaseAuth, email, pass);
        closeAuthModal();
    } catch (e) {
        showToast(e.message, 'error');
    }
};

window.logoutUser = async function () {
    if (!firebaseAuth) return;
    const { signOut } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    await signOut(firebaseAuth);
};

/* ==========================================================================
   HELPERS GENERALES Y RENDERIZADO GLOBAL
   ========================================================================== */
function renderAll() {
    renderScheduleWidget();
    renderDeliveries();
    renderTasks();
    updateStatsDisplay();
    initScratchpad();
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
    updateStorageQuotaBadge(JSON.stringify(appState).length);
}

window.toggleForm = function (id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = el.style.display === 'block' ? 'none' : 'block';
};

window.copyElementValue = function (id) {
    const el = document.getElementById(id);
    if (el) {
        navigator.clipboard.writeText(el.value || el.textContent || '');
        showToast('Copiado al portapapeles', 'success');
    }
};

window.copyRawText = function (txt) {
    navigator.clipboard.writeText(txt);
    showToast(`Copiado: ${txt}`, 'success');
};

function downloadTextFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function showToast(msg, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = msg;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 3200);
}