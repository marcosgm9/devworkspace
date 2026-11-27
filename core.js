export function mergeState(target, source) {
    if (!source || typeof source !== 'object') return target;
    const output = Array.isArray(target) ? [...target] : { ...target };
    for (const key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        const srcVal = source[key];
        const tgtVal = target ? target[key] : undefined;
        if (srcVal && typeof srcVal === 'object' && !Array.isArray(srcVal)) {
            output[key] = mergeState(tgtVal && typeof tgtVal === 'object' && !Array.isArray(tgtVal) ? tgtVal : {}, srcVal);
        } else if (srcVal !== undefined) {
            output[key] = Array.isArray(srcVal) ? [...srcVal] : srcVal;
        }
    }
    return output;
}

export function createDebouncer(callback, delay) {
    if (typeof callback !== 'function' || !Number.isFinite(delay) || delay < 0) {
        throw new TypeError('Se requiere una función y un retraso válido');
    }

    let timer = null;
    const cancel = () => {
        if (timer !== null) clearTimeout(timer);
        timer = null;
    };
    const debounced = () => {
        cancel();
        timer = setTimeout(() => {
            timer = null;
            callback();
        }, delay);
    };
    debounced.cancel = cancel;
    debounced.flush = () => {
        if (timer === null) return false;
        cancel();
        callback();
        return true;
    };
    return debounced;
}

export function getMadridDateKey(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return `${values.year}-${values.month}-${values.day}`;
}

export function getMadridClock(date = new Date()) {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Europe/Madrid',
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hourCycle: 'h23'
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const day = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[values.weekday];
    return { day, minutes: Number(values.hour) * 60 + Number(values.minute) };
}

export function calculateSubnet(raw) {
    const value = String(raw ?? '').trim();
    const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(value);
    if (!match) return null;

    const octets = match[1].split('.').map(Number);
    const cidr = Number(match[2]);
    if (octets.some(octet => octet < 0 || octet > 255) || cidr < 0 || cidr > 32) {
        return null;
    }

    const ip = ((octets[0] << 24) | (octets[1] << 16) | (octets[2] << 8) | octets[3]) >>> 0;
    const mask = cidr === 0 ? 0 : (0xffffffff << (32 - cidr)) >>> 0;
    const network = (ip & mask) >>> 0;
    const broadcast = (network | (~mask >>> 0)) >>> 0;
    const toIp = number => [
        (number >>> 24) & 255,
        (number >>> 16) & 255,
        (number >>> 8) & 255,
        number & 255
    ].join('.');
    const firstHost = cidr >= 31 ? network : network + 1;
    const lastHost = cidr >= 31 ? broadcast : broadcast - 1;
    const hosts = cidr === 32 ? 1 : cidr === 31 ? 2 : Math.pow(2, 32 - cidr) - 2;
    const usableHosts = cidr >= 31 ? hosts : Math.max(0, Math.pow(2, 32 - cidr) - 2);

    return {
        cidr,
        network: toIp(network),
        mask: toIp(mask),
        broadcast: toIp(broadcast),
        firstHost: toIp(firstHost),
        lastHost: toIp(lastHost),
        hosts,
        usableHosts
    };
}

export function getNextRepeatDate(dateValue, repeat) {
    const date = new Date(`${dateValue}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue) ||
        !Number.isFinite(date.getTime()) ||
        date.toISOString().slice(0, 10) !== dateValue) {
        throw new TypeError('Fecha de tarea inválida');
    }

    if (repeat === 'daily') {
        date.setUTCDate(date.getUTCDate() + 1);
    } else if (repeat === 'weekly') {
        date.setUTCDate(date.getUTCDate() + 7);
    } else if (repeat === 'monthly') {
        const day = date.getUTCDate();
        date.setUTCDate(1);
        date.setUTCMonth(date.getUTCMonth() + 1);
        const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
        date.setUTCDate(Math.min(day, lastDay));
    } else {
        throw new TypeError('Frecuencia de repetición inválida');
    }

    return date.toISOString().slice(0, 10);
}

export function normalizeExternalUrl(rawUrl) {
    const trimmed = String(rawUrl ?? '').trim();
    if (!trimmed) return '';
    if (/^(javascript|data|vbscript|file):/i.test(trimmed)) return '';

    const withScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed)
        ? trimmed
        : `https://${trimmed}`;

    try {
        const parsed = new URL(withScheme);
        if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
            return parsed.href;
        }
        return '';
    } catch (_) {
        return '';
    }
}

export function parseBaseValue(arg1, arg2) {
    const radixMap = {
        10: { radix: 10, regex: /^[+-]?\d+$/ },
        2: { radix: 2, regex: /^[+-]?[01]+$/ },
        16: { radix: 16, regex: /^[+-]?[0-9a-fA-F]+$/ },
        8: { radix: 8, regex: /^[+-]?[0-7]+$/ },
        dec: { radix: 10, regex: /^[+-]?\d+$/ },
        bin: { radix: 2, regex: /^[+-]?[01]+$/ },
        hex: { radix: 16, regex: /^[+-]?[0-9a-fA-F]+$/ },
        oct: { radix: 8, regex: /^[+-]?[0-7]+$/ }
    };

    if (typeof arg2 === 'number') {
        const clean = String(arg1 ?? '').trim();
        const spec = radixMap[arg2];
        if (!clean || !spec || !spec.regex.test(clean)) return null;
        const parsed = parseInt(clean, spec.radix);
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    const clean = String(arg2 ?? '').trim();
    if (!clean) return { valid: true, value: null };
    const spec = radixMap[arg1];
    if (!spec || !spec.regex.test(clean)) return { valid: false, value: null };
    const parsed = parseInt(clean, spec.radix);
    if (!Number.isSafeInteger(parsed)) return { valid: false, value: null };
    return { valid: true, value: parsed };
}

/* --------------------------------------------------------------------------
   COMPACTACIÓN LIGERA, FIRMA DE INTEGRIDAD Y PARSEO DE HORARIOS
   -------------------------------------------------------------------------- */
const PACK_MAGIC = 'DWPK1.';

function fnv1aHash(str) {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        hash ^= str.charCodeAt(i);
        hash = Math.imul(hash, 0x01000193);
    }
    return (hash >>> 0).toString(36);
}

export async function packDrivePayload(stateObj, salt = 'devworkspace-drive-guard') {
    const rawJson = JSON.stringify(stateObj);
    const sig = fnv1aHash(`${salt}::${rawJson.length}::${rawJson}`);
    const envelope = JSON.stringify({ v: 1, s: sig, d: stateObj });

    if (typeof CompressionStream === 'function') {
        const stream = new Blob([envelope]).stream().pipeThrough(new CompressionStream('deflate'));
        const buf = await new Response(stream).arrayBuffer();
        const bytes = new Uint8Array(buf);
        let bin = '';
        for (let i = 0; i < bytes.length; i++) {
            bin += String.fromCharCode(bytes[i]);
        }
        return `${PACK_MAGIC}z.${btoa(bin)}`;
    }

    const bytes = new TextEncoder().encode(envelope);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) {
        bin += String.fromCharCode(bytes[i]);
    }
    return `${PACK_MAGIC}r.${btoa(bin)}`;
}

export async function unpackDrivePayload(packedText, salt = 'devworkspace-drive-guard') {
    const clean = String(packedText ?? '').trim();
    if (!clean.startsWith(PACK_MAGIC)) {
        throw new Error('Formato de archivo de Drive no reconocido o alterado');
    }

    const rest = clean.slice(PACK_MAGIC.length);
    const dotIdx = rest.indexOf('.');
    if (dotIdx === -1) throw new Error('Cabecera de paquete inválida');

    const mode = rest.slice(0, dotIdx);
    const b64 = rest.slice(dotIdx + 1);
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) {
        bytes[i] = bin.charCodeAt(i);
    }

    let jsonText = '';
    if (mode === 'z') {
        if (typeof DecompressionStream !== 'function') {
            throw new Error('Este navegador no soporta descompresión Deflate');
        }
        const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
        jsonText = await new Response(stream).text();
    } else if (mode === 'r') {
        jsonText = new TextDecoder().decode(bytes);
    } else {
        throw new Error('Modo de empaquetado desconocido');
    }

    const envelope = JSON.parse(jsonText);
    if (!envelope || envelope.v !== 1 || !envelope.d || typeof envelope.s !== 'string') {
        throw new Error('Estructura interna de archivo corrupta');
    }

    const rawJson = JSON.stringify(envelope.d);
    const expectedSig = fnv1aHash(`${salt}::${rawJson.length}::${rawJson}`);
    if (envelope.s !== expectedSig) {
        throw new Error('El archivo ha sido modificado manualmente o está corrupto');
    }

    return envelope.d;
}

export function parseScheduleImportText(rawContent) {
    const text = String(rawContent ?? '').trim();
    if (!text) return [];

    const dayAliases = {
        dom: 0, domingo: 0, sun: 0, sunday: 0,
        lun: 1, lunes: 1, mon: 1, monday: 1,
        mar: 2, martes: 2, tue: 2, tuesday: 2,
        mie: 3, mié: 3, miercoles: 3, miércoles: 3, wed: 3, wednesday: 3,
        jue: 4, jueves: 4, thu: 4, thursday: 4,
        vie: 5, viernes: 5, fri: 5, friday: 5,
        sab: 6, sáb: 6, sabado: 6, sábado: 6, sat: 6, saturday: 6
    };

    const rows = [];
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    for (const line of lines) {
        if (/^(d[ií]a|day)[,;|]/i.test(line)) continue;
        const sep = line.includes('|') ? '|' : line.includes(';') ? ';' : line.includes(',') ? ',' : null;
        const cols = sep ? line.split(sep).map(c => c.trim()) : line.split(/\s+/);
        if (cols.length < 3) continue;

        const dayKey = cols[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        let day = dayAliases[dayKey];
        if (day === undefined && /^[0-6]$/.test(cols[0])) day = Number(cols[0]);
        if (day === undefined) continue;

        let start = '';
        let end = '';
        let subject = '';
        let room = '';
        let teacher = '';

        const rangeMatch = /^(\d{1,2}:\d{2})\s*[-–]+\s*(\d{1,2}:\d{2})$/.exec(cols[1]);
        if (rangeMatch) {
            start = rangeMatch[1].padStart(5, '0');
            end = rangeMatch[2].padStart(5, '0');
            subject = sep ? (cols[2] || '') : cols.slice(2).join(' ');
            room = sep ? (cols[3] || '') : '';
            teacher = sep ? (cols[4] || '') : '';
        } else if (/^\d{1,2}:\d{2}$/.test(cols[1]) && /^\d{1,2}:\d{2}$/.test(cols[2] || '')) {
            start = cols[1].padStart(5, '0');
            end = cols[2].padStart(5, '0');
            subject = sep ? (cols[3] || '') : cols.slice(3).join(' ');
            room = sep ? (cols[4] || '') : '';
            teacher = sep ? (cols[5] || '') : '';
        }

        if (start && end && subject) {
            rows.push({ day, start, end, subject, room, teacher });
        }
    }

    return rows;
}