import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    emitTelemetryHeartbeatTick,
    getTelemetryHeartbeatIntervalMs,
    isTelemetryHeartbeatRunning,
    resetTelemetryHeartbeatForTests,
    resolveHeartbeatInstanceId,
    startTelemetryHeartbeat,
    stopTelemetryHeartbeat,
    subscribeTelemetryHeartbeat,
    TELEMETRY_HEARTBEAT_METRIC,
} from '../src/observability/heartbeat.js';
import { installInMemoryMetrics, sumCounter } from './helpers/in-memory-metrics.js';
import { createLocalHeartbeatBridge } from '../seguridad-caos-exp3/adapters/local-heartbeat-bridge.mjs';

const policy = JSON.parse(
    readFileSync(resolve('seguridad-caos-exp3/detections/telemetry-silence-policy.json'), 'utf8'),
);

function setExportOn() {
    process.env.OTEL_SDK_DISABLED = 'false';
    process.env.OTEL_METRICS_EXPORTER = 'otlp';
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = 'http://127.0.0.1:4318';
}

function setExportOff() {
    process.env.OTEL_METRICS_EXPORTER = 'none';
}

describe('Heartbeat OTEL cine.telemetry.heartbeat', () => {
    let collectMetrics: () => Promise<import('@opentelemetry/sdk-metrics').ResourceMetrics[]>;
    let metricsBaseline = 0;

    beforeEach(() => {
        resetTelemetryHeartbeatForTests();
        process.env.CINE_TELEMETRY_HEARTBEAT_ENABLED = 'true';
        process.env.CINE_TELEMETRY_HEARTBEAT_INTERVAL_MS = '50';
        process.env.OTEL_SERVICE_NAME = 'cine-api';
        process.env.APP_TRACK = 'caos';
        process.env.POD_NAME = 'cine-api-replica-a';
        setExportOn();
        // setGlobalMeterProvider solo acepta la primera instalación en el proceso de test.
        if (!collectMetrics) {
            collectMetrics = installInMemoryMetrics().collect;
        }
    });

    afterEach(() => {
        resetTelemetryHeartbeatForTests();
        vi.useRealTimers();
    });

    it('emite métrica periódica sin tráfico HTTP', async () => {
        const before = await collectMetrics();
        metricsBaseline = sumCounter(before, TELEMETRY_HEARTBEAT_METRIC);

        const mirrored: string[] = [];
        subscribeTelemetryHeartbeat((s) => mirrored.push(s.observedAtUtc));

        expect(startTelemetryHeartbeat()).toBe(true);
        expect(isTelemetryHeartbeatRunning()).toBe(true);

        await new Promise((r) => setTimeout(r, 130));
        stopTelemetryHeartbeat();

        // start hace 1 tick inmediato + ≈2 intervalos de 50ms; sin HTTP.
        expect(mirrored.length).toBeGreaterThanOrEqual(2);

        const metrics = await collectMetrics();
        expect(sumCounter(metrics, TELEMETRY_HEARTBEAT_METRIC)).toBeGreaterThanOrEqual(metricsBaseline + 2);
    });

    it('incluye service / environment / instance en el sample', () => {
        const sample = emitTelemetryHeartbeatTick();
        expect(sample.signal).toBe('cine.telemetry.heartbeat');
        expect(sample.serviceName).toBe('cine-api');
        expect(sample.environment).toBe('caos');
        expect(sample.instanceId).toBe('cine-api-replica-a');
        expect(sample.mirroredToLocalCollector).toBe(true);
    });

    it('distingue instancias (réplicas) vía POD_NAME/HOSTNAME', () => {
        process.env.POD_NAME = 'cine-api-6f464d976f-aaaa';
        expect(resolveHeartbeatInstanceId()).toBe('cine-api-6f464d976f-aaaa');
        process.env.POD_NAME = '';
        process.env.HOSTNAME = 'cine-api-6f464d976f-bbbb';
        expect(resolveHeartbeatInstanceId()).toBe('cine-api-6f464d976f-bbbb');
    });

    it('parada limpia detiene el intervalo', async () => {
        startTelemetryHeartbeat();
        expect(isTelemetryHeartbeatRunning()).toBe(true);
        stopTelemetryHeartbeat();
        expect(isTelemetryHeartbeatRunning()).toBe(false);

        let count = 0;
        subscribeTelemetryHeartbeat(() => {
            count += 1;
        });
        await new Promise((r) => setTimeout(r, 120));
        expect(count).toBe(0);
    });

    it('no arranca intervalos duplicados', () => {
        expect(startTelemetryHeartbeat()).toBe(true);
        expect(startTelemetryHeartbeat()).toBe(true);
        expect(isTelemetryHeartbeatRunning()).toBe(true);
        stopTelemetryHeartbeat();
    });

    it('intervalo configurable por env', () => {
        process.env.CINE_TELEMETRY_HEARTBEAT_INTERVAL_MS = '12000';
        expect(getTelemetryHeartbeatIntervalMs()).toBe(12000);
    });
});

describe('Puente local + detector (export ON/OFF)', () => {
    beforeEach(() => {
        resetTelemetryHeartbeatForTests();
        process.env.CINE_TELEMETRY_HEARTBEAT_ENABLED = 'true';
        process.env.OTEL_SERVICE_NAME = 'cine-api';
        process.env.POD_NAME = 'cine-api-replica-a';
        process.env.APP_TRACK = 'caos';
        setExportOn();
        // Reutiliza MeterProvider global si ya existe (suite anterior).
        installInMemoryMetrics();
    });

    afterEach(() => {
        resetTelemetryHeartbeatForTests();
    });

    it('flujo normal: puente alimenta detector sin alerta falsa', () => {
        const bridge = createLocalHeartbeatBridge({
            ...policy,
            silenceThresholdSec: 60,
            armAfterSuccessfulHeartbeats: 2,
        });
        subscribeTelemetryHeartbeat((sample) => {
            if (sample.mirroredToLocalCollector) {
                bridge.push(sample);
            }
        });

        const t0 = new Date('2026-11-18T04:00:00.000Z');
        emitTelemetryHeartbeatTick(t0);
        emitTelemetryHeartbeatTick(new Date(t0.getTime() + 15_000));
        emitTelemetryHeartbeatTick(new Date(t0.getTime() + 30_000));

        const report = bridge.evaluate({ nowUtc: '2026-11-18T04:00:45.000Z' });
        expect(report.alert).toBe(false);
        expect(report.status).toBe('OK');
        expect(report.armed).toBe(true);
    });

    it('export OTEL off: ticks no espejan; detector alerta (detector sigue activo)', () => {
        const bridge = createLocalHeartbeatBridge({
            ...policy,
            silenceThresholdSec: 5,
            armAfterSuccessfulHeartbeats: 2,
        });
        subscribeTelemetryHeartbeat((sample) => {
            if (sample.mirroredToLocalCollector) {
                bridge.push(sample);
            }
        });

        const t0 = new Date('2026-11-18T04:10:00.000Z');
        emitTelemetryHeartbeatTick(t0);
        emitTelemetryHeartbeatTick(new Date(t0.getTime() + 1_000));
        expect(bridge.getSamples().length).toBe(2);

        // Inyección sintética local: deshabilitar export (misma clase de falla que R0/R1).
        setExportOff();
        const silenced = emitTelemetryHeartbeatTick(new Date(t0.getTime() + 2_000));
        expect(silenced.mirroredToLocalCollector).toBe(false);
        expect(bridge.getSamples().length).toBe(2);

        const report = bridge.evaluate({ nowUtc: '2026-11-18T04:10:20.000Z' });
        expect(report.alert).toBe(true);
        expect(report.status).toBe('ALERT');
    });

    it('pérdida parcial vs total por instancia', () => {
        const bridge = createLocalHeartbeatBridge({
            ...policy,
            silenceThresholdSec: 10,
            armAfterSuccessfulHeartbeats: 2,
        });

        // Réplica A sana (último tick reciente)
        process.env.POD_NAME = 'pod-a';
        setExportOn();
        bridge.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T05:00:00.000Z')));
        bridge.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T05:00:05.000Z')));
        bridge.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T05:00:25.000Z')));

        // Réplica B: arma y luego silencio (sin más pushes)
        process.env.POD_NAME = 'pod-b';
        bridge.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T05:00:00.000Z')));
        bridge.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T05:00:05.000Z')));

        const partial = bridge.evaluate({
            nowUtc: '2026-11-18T05:00:31.000Z',
            byInstance: true,
        });
        expect(partial.lossKind).toBe('partial');
        expect(partial.alertingInstanceIds).toContain('pod-b');
        expect(partial.alertingInstanceIds).not.toContain('pod-a');

        // Silencio también en A → total
        const total = createLocalHeartbeatBridge({
            ...policy,
            silenceThresholdSec: 10,
            armAfterSuccessfulHeartbeats: 2,
        });
        process.env.POD_NAME = 'pod-a';
        total.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T06:00:00.000Z')));
        total.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T06:00:05.000Z')));
        process.env.POD_NAME = 'pod-b';
        total.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T06:00:00.000Z')));
        total.push(emitTelemetryHeartbeatTick(new Date('2026-11-18T06:00:05.000Z')));
        const totalReport = total.evaluate({
            nowUtc: '2026-11-18T06:00:30.000Z',
            byInstance: true,
        });
        expect(totalReport.lossKind).toBe('total');
    });
});

