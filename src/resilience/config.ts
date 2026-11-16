export type ExperimentRound = 'baseline' | 'r0' | 'r1';

function envInt(name: string, fallback: number): number {
    const raw = process.env[name];
    if (raw === undefined || raw.trim() === '') {
        return fallback;
    }
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
}

function envFlag(name: string, fallback = false): boolean {
    const raw = process.env[name]?.trim().toLowerCase();
    if (raw === undefined || raw === '') {
        return fallback;
    }
    return raw === '1' || raw === 'true' || raw === 'on' || raw === 'yes';
}

/**
 * R0: resiliencia desactivada (aunque exista el código).
 * R1: bulkhead + admission activos.
 * baseline: sin inyección de caos; resiliencia según flag.
 */
export function getExperimentRound(): ExperimentRound {
    const raw = (process.env.EXPERIMENT_ROUND ?? 'baseline').trim().toLowerCase();
    if (raw === 'r0' || raw === '0') {
        return 'r0';
    }
    if (raw === 'r1' || raw === '1') {
        return 'r1';
    }
    return 'baseline';
}

export function isResilienceEnabled(): boolean {
    const round = getExperimentRound();
    if (round === 'r0') {
        return false;
    }
    if (round === 'r1') {
        return true;
    }
    return envFlag('RESILIENCE_ENABLED', false);
}

export function bulkheadMaxConcurrent(): number {
    return Math.max(1, Math.min(envInt('BULKHEAD_MAX_CONCURRENT', 8), 64));
}

export function admissionMaxInflight(): number {
    return Math.max(1, Math.min(envInt('ADMISSION_MAX_INFLIGHT', 16), 128));
}

/** Rutas protegidas por bulkhead/admission (superficie experimental). */
export function isProtectedExperimentalPath(method: string, url: string): boolean {
    if (method.toUpperCase() !== 'GET') {
        return false;
    }
    return /^\/api\/v2\/peliculas\/[^/]+\/?(\?.*)?$/.test(url);
}
