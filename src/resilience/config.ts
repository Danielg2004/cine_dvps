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

/**
 * Capacidad de la sección crítica.
 * Por defecto 8; debe alinearse con CHAOS_MAX_INFLIGHT del experimento.
 */
export function bulkheadMaxConcurrent(): number {
    return Math.max(1, Math.min(envInt('BULKHEAD_MAX_CONCURRENT', 8), 64));
}

/**
 * Cupos de admisión. Nunca supera el bulkhead: evita admitir trabajo
 * que luego muere por bulkhead_timeout (defecto R1 original).
 */
export function admissionMaxInflight(): number {
    const configured = Math.max(1, Math.min(envInt('ADMISSION_MAX_INFLIGHT', 8), 128));
    return Math.min(configured, bulkheadMaxConcurrent());
}

/**
 * Espera máxima por cupo de bulkhead. Default 200 ms: alineado con
 * maxQueueWaitMs típico de saturación, para absorción breve comparable a R0
 * (antes 2000 ms quedaba muerto porque admission rechazaba antes de encolar).
 */
export function bulkheadEnterTimeoutMs(): number {
    return Math.max(50, Math.min(envInt('BULKHEAD_ENTER_TIMEOUT_MS', 200), 10_000));
}

/** Rutas protegidas por bulkhead/admission (superficie experimental). */
export function isProtectedExperimentalPath(method: string, url: string): boolean {
    if (method.toUpperCase() !== 'GET') {
        return false;
    }
    return /^\/api\/v2\/peliculas\/[^/]+\/?(\?.*)?$/.test(url);
}
