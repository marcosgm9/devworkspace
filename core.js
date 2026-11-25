export function mergeState(target, source) {
    if (!source || typeof source !== 'object') return target;
    const output = Array.isArray(target) ? [...target] : { ...target };
    for (const key of Object.keys(source)) {
        if (key === '__proto__' || key === 'constructor' || key === 'prototype') continue;
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
            output[key] = mergeState(target[key] || {}, source[key]);
        } else {
            output[key] = source[key];
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
    const value = String(raw).trim();
    const match = /^(\d{1,3}(?:\.\d{1,3}){3})\/(\d{1,2})$/.exec(value);
    if (!match) throw new TypeError('Formato inválido. Usa ej: 192.168.1.50/24');

    const octets = match[1].split('.').map(Number);
    const cidr = Number(match[2]);
    if (octets.some(octet => octet < 0 || octet > 255) || cidr < 0 || cidr > 32) {
        throw new TypeError('Formato inválido. Usa ej: 192.168.1.50/24');
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

    return {
        cidr,
        network: toIp(network),
        mask: toIp(mask),
        broadcast: toIp(broadcast),
        firstHost: toIp(firstHost),
        lastHost: toIp(lastHost),
        hosts
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
