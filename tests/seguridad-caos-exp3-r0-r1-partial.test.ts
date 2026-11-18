import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
    evaluateTelemetrySilence,
    evaluateTelemetrySilenceByInstance,
} from '../seguridad-caos-exp3/detections/telemetry-silence-detector.mjs';
import { assertNoCineCaosMutation } from '../seguridad-caos-exp3/scripts/exp3-guardrails.mjs';

const policy = JSON.parse(
    readFileSync(resolve('seguridad-caos-exp3/detections/telemetry-silence-policy.exp3-lab.json'), 'utf8'),
);
const samples = JSON.parse(
    readFileSync(resolve('seguridad-caos-exp3/fixtures/samples-partial-b-silent.json'), 'utf8'),
).samples;

const nowUtc = '2026-11-18T17:02:00.000Z'; // B last OK 17:00:15 → silencio > 60s; A last 17:01:30 OK

describe('Exp3 R0/R1 — misma inyección parcial (B silent, A OK)', () => {
    it('R0 agregado: NO alerta (A mantiene lastOk)', () => {
        const report = evaluateTelemetrySilence(samples, policy, { nowUtc });
        expect(report.armed).toBe(true);
        expect(report.alert).toBe(false);
        expect(report.status).toBe('OK');
    });

    it('R1 por instancia: ALERT partial en emitter-b', () => {
        const report = evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc });
        expect(report.alert).toBe(true);
        expect(report.lossKind).toBe('partial');
        expect(report.alertingInstanceIds).toContain('emitter-b');
        expect(report.alertingInstanceIds).not.toContain('emitter-a');
    });

    it('mejora R1 vs R0 confirmada sobre el mismo fixture', () => {
        const r0 = evaluateTelemetrySilence(samples, policy, { nowUtc });
        const r1 = evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc });
        expect(r0.alert).toBe(false);
        expect(r1.alert).toBe(true);
        expect(r1.lossKind).toBe('partial');
    });

    it('guardrail bloquea mutaciones a cine-caos', () => {
        const bad = assertNoCineCaosMutation('kubectl -n cine-caos apply -f x.yaml');
        expect(bad.ok).toBe(false);
        const good = assertNoCineCaosMutation('kubectl -n cine-seguridad-exp3 apply -k overlays/contain');
        expect(good.ok).toBe(true);
    });
});
