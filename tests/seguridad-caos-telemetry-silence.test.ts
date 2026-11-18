import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    evaluateTelemetrySilence,
    computeMttdSeconds,
    computeMttcSeconds,
    computeRestoreSeconds,
    DEFAULT_POLICY,
    HEARTBEAT_SIGNAL,
} from '../seguridad-caos-exp3/detections/telemetry-silence-detector.mjs';

const root = resolve('seguridad-caos-exp3');
const policy = JSON.parse(
    readFileSync(resolve(root, 'detections/telemetry-silence-policy.json'), 'utf8'),
);

function loadSamples(name: string) {
    const doc = JSON.parse(readFileSync(resolve(root, 'fixtures', name), 'utf8'));
    return doc.samples;
}

describe('Detector pérdida telemetría (Exp. 3)', () => {
    it('negativa: heartbeats regulares no alertan', () => {
        const report = evaluateTelemetrySilence(
            loadSamples('samples-negative-healthy.json'),
            policy,
            { nowUtc: '2026-11-18T02:01:45.000Z' },
        );
        expect(report.alert).toBe(false);
        expect(report.status).toBe('OK');
        expect(report.armed).toBe(true);
        expect(report.silenceSec).toBeLessThanOrEqual(policy.silenceThresholdSec);
    });

    it('positiva: silencio sintético tras armar activa ALERT', () => {
        const report = evaluateTelemetrySilence(
            loadSamples('samples-positive-silence.json'),
            policy,
            { nowUtc: '2026-11-18T02:03:00.000Z' },
        );
        expect(report.armed).toBe(true);
        expect(report.alert).toBe(true);
        expect(report.status).toBe('ALERT');
        expect(report.detectedAtUtc).toBeTruthy();
        expect(report.silenceSec).toBeGreaterThan(policy.silenceThresholdSec);
        // last OK 02:01:00 + 60s = 02:02:00
        expect(report.detectedAtUtc).toBe('2026-11-18T02:02:00.000Z');
    });

    it('idle sin heartbeats: NOT_ARMED (no FP por falta de tráfico)', () => {
        const report = evaluateTelemetrySilence(
            loadSamples('samples-idle-no-traffic.json'),
            policy,
            { nowUtc: '2026-11-18T02:10:00.000Z' },
        );
        expect(report.alert).toBe(false);
        expect(report.status).toBe('NOT_ARMED');
        expect(report.armed).toBe(false);
    });

    it('ignora señales HTTP que no son heartbeat', () => {
        const report = evaluateTelemetrySilence(
            [
                {
                    observedAtUtc: '2026-11-18T02:00:00.000Z',
                    serviceName: 'cine-api',
                    signal: 'http.server.requests',
                    heartbeatOk: true,
                },
                {
                    observedAtUtc: '2026-11-18T02:05:00.000Z',
                    serviceName: 'cine-api',
                    signal: HEARTBEAT_SIGNAL,
                    heartbeatOk: true,
                },
            ],
            { ...DEFAULT_POLICY, armAfterSuccessfulHeartbeats: 2 },
            { nowUtc: '2026-11-18T02:05:10.000Z' },
        );
        expect(report.successfulHeartbeats).toBe(1);
        expect(report.status).toBe('NOT_ARMED');
    });
});

describe('MTTD / MTTC / restore (marcas explícitas)', () => {
    it('MTTD usa detección, no restore', () => {
        expect(computeMttdSeconds({
            faultInjectedAtUtc: '2026-11-18T02:01:10.000Z',
            detectedAtUtc: '2026-11-18T02:02:00.000Z',
        })).toBe(50);
    });

    it('MTTC es contención, no restauración', () => {
        expect(computeMttcSeconds({
            faultInjectedAtUtc: '2026-11-18T02:01:10.000Z',
            containedAtUtc: '2026-11-18T02:02:30.000Z',
        })).toBe(80);
        expect(computeRestoreSeconds({
            containedAtUtc: '2026-11-18T02:02:30.000Z',
            telemetryRestoredAtUtc: '2026-11-18T02:04:00.000Z',
        })).toBe(90);
    });
});
