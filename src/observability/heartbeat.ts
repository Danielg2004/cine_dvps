import { hostname as osHostname } from 'node:os';
import { metrics } from '@opentelemetry/api';
import type { Counter } from '@opentelemetry/api';
import { isOtelMetricsExportEnabled } from './otel-export-state.js';

/** Nombre canónico alineado con el detector Exp. 3. */
export const TELEMETRY_HEARTBEAT_METRIC = 'cine.telemetry.heartbeat';

export type HeartbeatSample = {
    observedAtUtc: string;
    serviceName: string;
    signal: string;
    heartbeatOk: boolean;
    instanceId: string;
    environment: string;
    /** True si el tick también se reflejó al puente local (export métricas activo). */
    mirroredToLocalCollector: boolean;
};

type HeartbeatListener = (sample: HeartbeatSample) => void;

const GLOBAL_STARTED = '__cineApiTelemetryHeartbeatStarted';
const GLOBAL_HOOKS = '__cineApiTelemetryHeartbeatHooks';

let intervalHandle: NodeJS.Timeout | null = null;
let counter: Counter | undefined;
const listeners = new Set<HeartbeatListener>();

function envFlagTrue(name: string): boolean {
    const v = process.env[name]?.trim().toLowerCase();
    return v === 'true' || v === '1';
}

function envInt(name: string, fallback: number): number {
    const raw = process.env[name]?.trim();
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function resolveHeartbeatServiceName(): string {
    return process.env.OTEL_SERVICE_NAME?.trim() || 'cine-api';
}

export function resolveHeartbeatEnvironment(): string {
    return process.env.DEPLOYMENT_ENVIRONMENT?.trim()
        || process.env.APP_TRACK?.trim()
        || process.env.NODE_ENV?.trim()
        || 'unknown';
}

/**
 * Distingue réplicas GKE: Autopilot/Kubernetes suele poner HOSTNAME = nombre del Pod.
 * POD_NAME / K8S_POD_NAME permiten override explícito en manifiestos futuros.
 */
export function resolveHeartbeatInstanceId(): string {
    return process.env.POD_NAME?.trim()
        || process.env.K8S_POD_NAME?.trim()
        || process.env.HOSTNAME?.trim()
        || osHostname()
        || 'unknown-instance';
}

export function isTelemetryHeartbeatEnabled(): boolean {
    return envFlagTrue('CINE_TELEMETRY_HEARTBEAT_ENABLED');
}

export function getTelemetryHeartbeatIntervalMs(): number {
    return envInt('CINE_TELEMETRY_HEARTBEAT_INTERVAL_MS', 15_000);
}

export function subscribeTelemetryHeartbeat(listener: HeartbeatListener): () => void {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}

export function isTelemetryHeartbeatRunning(): boolean {
    return intervalHandle !== null;
}

function getCounter(): Counter {
    if (!counter) {
        counter = metrics.getMeter('cine-api').createCounter(TELEMETRY_HEARTBEAT_METRIC, {
            description: 'Periodic telemetry heartbeat independent of HTTP traffic',
            unit: '{heartbeat}',
        });
    }
    return counter;
}

/** Emite un tick (usable en tests sin esperar al intervalo). */
export function emitTelemetryHeartbeatTick(now: Date = new Date()): HeartbeatSample {
    const serviceName = resolveHeartbeatServiceName();
    const environment = resolveHeartbeatEnvironment();
    const instanceId = resolveHeartbeatInstanceId();
    const exportLive = isOtelMetricsExportEnabled();

    const attributes = {
        'service.name': serviceName,
        'deployment.environment': environment,
        'service.instance.id': instanceId,
    };

    // Siempre intenta la API de métricas (noop si no hay MeterProvider / export off).
    getCounter().add(1, attributes);

    const sample: HeartbeatSample = {
        observedAtUtc: now.toISOString(),
        serviceName,
        signal: TELEMETRY_HEARTBEAT_METRIC,
        heartbeatOk: true,
        instanceId,
        environment,
        // El puente local solo recibe ticks cuando el export OTEL de métricas está activo.
        // Así, deshabilitar export ⇒ silencio en el collector local ⇒ detector externo alerta,
        // sin apagar el proceso detector.
        mirroredToLocalCollector: exportLive,
    };

    if (exportLive) {
        for (const listener of listeners) {
            listener(sample);
        }
    }

    return sample;
}

function registerSignalHooks(): void {
    const g = globalThis as typeof globalThis & Record<string, boolean | undefined>;
    if (g[GLOBAL_HOOKS]) {
        return;
    }
    g[GLOBAL_HOOKS] = true;

    const shutdown = () => {
        stopTelemetryHeartbeat();
    };
    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
    process.once('beforeExit', shutdown);
}

/**
 * Inicia el intervalo de heartbeat (idempotente).
 * No afecta endpoints de negocio; solo métrica + puente local condicionado al export.
 */
export function startTelemetryHeartbeat(): boolean {
    if (!isTelemetryHeartbeatEnabled()) {
        return false;
    }

    const g = globalThis as typeof globalThis & Record<string, boolean | undefined>;
    if (intervalHandle || g[GLOBAL_STARTED]) {
        return intervalHandle !== null;
    }

    g[GLOBAL_STARTED] = true;
    registerSignalHooks();

    const intervalMs = getTelemetryHeartbeatIntervalMs();
    // Primer tick inmediato para armar detectores sin esperar un periodo completo.
    emitTelemetryHeartbeatTick();
    intervalHandle = setInterval(() => {
        emitTelemetryHeartbeatTick();
    }, intervalMs);
    // Evita mantener el event loop vivo solo por el heartbeat en tests/shutdown.
    intervalHandle.unref?.();

    console.log(JSON.stringify({
        msg: 'telemetry heartbeat iniciado',
        service: resolveHeartbeatServiceName(),
        signal: TELEMETRY_HEARTBEAT_METRIC,
        intervalMs,
        instanceId: resolveHeartbeatInstanceId(),
        environment: resolveHeartbeatEnvironment(),
        mirrorRequiresOtelMetricsExport: true,
        otelMetricsExportEnabled: isOtelMetricsExportEnabled(),
    }));

    return true;
}

export function stopTelemetryHeartbeat(): void {
    if (intervalHandle) {
        clearInterval(intervalHandle);
        intervalHandle = null;
    }
    const g = globalThis as typeof globalThis & Record<string, boolean | undefined>;
    g[GLOBAL_STARTED] = false;
    counter = undefined;
}

/** Solo tests: limpia listeners y estado global. */
export function resetTelemetryHeartbeatForTests(): void {
    stopTelemetryHeartbeat();
    listeners.clear();
    const g = globalThis as typeof globalThis & Record<string, boolean | undefined>;
    g[GLOBAL_STARTED] = false;
    g[GLOBAL_HOOKS] = false;
}
