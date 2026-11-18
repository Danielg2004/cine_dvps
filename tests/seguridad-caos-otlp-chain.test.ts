import { afterEach, describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
    MeterProvider,
    PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { createOtlpHttpMetricsReceiver } from '../seguridad-caos-exp3/otlp-local/otlp-http-receiver.mjs';
import { extractHeartbeatSamplesFromOtlpJson } from '../seguridad-caos-exp3/otlp-local/otlp-metrics-parser.mjs';
import { createOtlpSampleStore } from '../seguridad-caos-exp3/otlp-local/otlp-sample-store.mjs';
import { evaluateExternalSamples } from '../seguridad-caos-exp3/otlp-local/otlp-external-adapter.mjs';

const HEARTBEAT = 'cine.telemetry.heartbeat';

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

describe('Parser / ventana temporal OTLP', () => {
    it('extrae heartbeat desde JSON OTLP', () => {
        const body = {
            resourceMetrics: [{
                resource: {
                    attributes: [
                        { key: 'service.name', value: { stringValue: 'cine-api' } },
                    ],
                },
                scopeMetrics: [{
                    metrics: [{
                        name: HEARTBEAT,
                        sum: {
                            dataPoints: [{
                                timeUnixNano: String(Date.parse('2026-11-18T10:00:00.000Z') * 1e6),
                                asInt: '1',
                                attributes: [
                                    { key: 'service.instance.id', value: { stringValue: 'pod-x' } },
                                    { key: 'deployment.environment', value: { stringValue: 'lab' } },
                                ],
                            }],
                        },
                    }],
                }],
            }],
        };
        const samples = extractHeartbeatSamplesFromOtlpJson(body);
        expect(samples).toHaveLength(1);
        expect(samples[0].instanceId).toBe('pod-x');
        expect(samples[0].signal).toBe(HEARTBEAT);
        expect(samples[0].source).toBe('otlp-http-json');
    });

    it('getRecent descarta series históricas fuera de maxAgeSec', () => {
        const store = createOtlpSampleStore({ maxAgeSec: 10 });
        store.add({
            observedAtUtc: '2026-11-18T10:00:00.000Z',
            serviceName: 'cine-api',
            signal: HEARTBEAT,
            heartbeatOk: true,
            instanceId: 'old',
        });
        store.add({
            observedAtUtc: '2026-11-18T10:00:50.000Z',
            serviceName: 'cine-api',
            signal: HEARTBEAT,
            heartbeatOk: true,
            instanceId: 'new',
        });
        const recent = store.getRecent('2026-11-18T10:00:55.000Z');
        expect(recent).toHaveLength(1);
        expect(recent[0].instanceId).toBe('new');
    });
});

describe('Cadena OTLP real → detector (sin listeners)', () => {
    let stopReceiver: (() => Promise<void>) | null = null;

    afterEach(async () => {
        if (stopReceiver) {
            await stopReceiver();
            stopReceiver = null;
        }
    });

    it('exporta cine.telemetry.heartbeat por OTLP HTTP y no alerta en sano', async () => {
        const receiver = createOtlpHttpMetricsReceiver({
            host: '127.0.0.1',
            port: 0,
            maxAgeSec: 60,
        });
        stopReceiver = () => receiver.stop();
        const info = await receiver.start();

        const provider = new MeterProvider({
            resource: resourceFromAttributes({ 'service.name': 'cine-api' }),
            readers: [
                new PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter({ url: info.url }),
                    exportIntervalMillis: 200,
                }),
            ],
        });

        const meter = provider.getMeter('lab');
        const counter = meter.createCounter(HEARTBEAT);
        for (let i = 0; i < 3; i += 1) {
            counter.add(1, {
                'service.name': 'cine-api',
                'service.instance.id': 'pod-a',
                'deployment.environment': 'test',
            });
            await provider.forceFlush();
            await sleep(200);
        }

        expect(receiver.store.getOtlpRequestCount()).toBeGreaterThanOrEqual(1);
        const recent = receiver.store.getRecent(new Date().toISOString());
        expect(recent.length).toBeGreaterThanOrEqual(1);
        expect(recent.every((s) => s.signal === HEARTBEAT)).toBe(true);

        const report = evaluateExternalSamples(recent, {
            serviceName: 'cine-api',
            signal: HEARTBEAT,
            silenceThresholdSec: 30,
            armAfterSuccessfulHeartbeats: 1,
            requireServiceMatch: true,
        }, { nowUtc: new Date().toISOString() });

        expect(report.alert).toBe(false);
        await provider.shutdown();
    }, 20_000);

    it('positiva: silencio OTLP alerta; pérdida parcial por instancia', async () => {
        const receiver = createOtlpHttpMetricsReceiver({
            host: '127.0.0.1',
            port: 0,
            maxAgeSec: 120,
        });
        stopReceiver = () => receiver.stop();
        const info = await receiver.start();

        const provider = new MeterProvider({
            resource: resourceFromAttributes({ 'service.name': 'cine-api' }),
            readers: [
                new PeriodicExportingMetricReader({
                    exporter: new OTLPMetricExporter({ url: info.url }),
                    exportIntervalMillis: 200,
                }),
            ],
        });
        const meter = provider.getMeter('lab');
        const counter = meter.createCounter(HEARTBEAT);

        for (let i = 0; i < 2; i += 1) {
            for (const id of ['pod-a', 'pod-b']) {
                counter.add(1, {
                    'service.name': 'cine-api',
                    'service.instance.id': id,
                    'deployment.environment': 'test',
                });
            }
            await provider.forceFlush();
            await sleep(200);
        }
        expect(receiver.store.getOtlpRequestCount()).toBeGreaterThanOrEqual(1);

        // pod-b deja de emitir; solo pod-a continúa tras una pausa > umbral
        await sleep(2500);
        counter.add(1, {
            'service.name': 'cine-api',
            'service.instance.id': 'pod-a',
            'deployment.environment': 'test',
        });
        await provider.forceFlush();
        await sleep(200);
        await provider.shutdown();

        const nowUtc = new Date().toISOString();
        const recent = receiver.store.getRecent(nowUtc);
        const report = evaluateExternalSamples(recent, {
            serviceName: 'cine-api',
            signal: HEARTBEAT,
            silenceThresholdSec: 2,
            armAfterSuccessfulHeartbeats: 2,
            requireServiceMatch: true,
        }, { nowUtc, byInstance: true });

        expect(report.alert).toBe(true);
        expect(report.lossKind).toBe('partial');
        expect(report.alertingInstanceIds).toContain('pod-b');
        expect(report.alertingInstanceIds).not.toContain('pod-a');
    }, 20_000);
});

describe('Evidencia lab (si existe)', () => {
    it('documento de resultados locales es coherente cuando el lab se ha ejecutado', () => {
        const path = resolve('seguridad-caos-exp3/evidencias-locales/otlp-chain-lab-result.json');
        if (!existsSync(path)) {
            // El lab se ejecuta aparte; no inventamos el archivo aquí.
            expect(existsSync(path)).toBe(false);
            return;
        }
        const doc = JSON.parse(readFileSync(path, 'utf8'));
        expect(doc.passed).toBe(true);
        expect(doc.otlp.requestsObserved).toBeGreaterThanOrEqual(1);
        expect(doc.timelineUtc.faultInjectedAtUtc).toBeTruthy();
        expect(doc.timelineUtc.detectedAtUtc).toBeTruthy();
        expect(doc.timelineUtc.telemetryRestoredAtUtc).toBeTruthy();
    });
});
