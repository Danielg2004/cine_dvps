import { describe, expect, it } from 'vitest';
import { resolve } from 'node:path';
import { evaluateChaosGate } from '../scripts/chaos/evaluate-chaos-gate.mjs';

const fixtures = resolve('tests/fixtures/chaos-gate');

describe('Chaos Gate evaluator (fixtures sintéticas)', () => {
    it('PASS: evidencia coherente cumple política bloqueante', () => {
        const report = evaluateChaosGate(resolve(fixtures, 'pass'));
        expect(report.exitCode).toBe(0);
        expect(report.result).toBe('PASS');
        expect(report.hypotheses.throughput_r1_gt_r0).toBe('NOT_CONFIRMED');
        expect(report.observed.bulkhead.bulkhead_timeout).toBeGreaterThanOrEqual(1);
        expect(report.observed.admission.inflight_limit).toBeGreaterThanOrEqual(1);
        expect(report.observed.admission.client_error).toBe(5);
    });

    it('FAIL política: bulkhead sin rechazos controlados', () => {
        const report = evaluateChaosGate(resolve(fixtures, 'fail-policy'));
        expect(report.exitCode).toBe(1);
        expect(report.result).toBe('FAIL');
        expect(report.reason).toMatch(/bulkhead/i);
    });

    it('FAIL formato: evidencia admission faltante', () => {
        const report = evaluateChaosGate(resolve(fixtures, 'fail-format'));
        expect(report.exitCode).toBe(2);
        expect(report.result).toBe('FAIL');
        expect(report.reason).toMatch(/faltante|malformada|admission/i);
    });
});

describe('Chaos Gate evaluator (evidencias reales del repo)', () => {
    it('evalúa main/working tree sin fabricar métricas', () => {
        const report = evaluateChaosGate(process.cwd());
        expect([0, 1, 2]).toContain(report.exitCode);
        expect(report.policy).toBe('cine-s4-chaos-gate-policy@1');
        if (report.exitCode === 0) {
            expect(report.observed.bulkhead.bulkhead_timeout).toBe(108);
            expect(report.observed.admission.inflight_limit).toBe(9);
            expect(report.observed.admission.client_error).toBe(5);
            expect(report.observed.multicloud.baseline.completed).toBe('264/264');
            expect(report.observed.multicloud.r0.completed).toBe('186/186');
            expect(report.observed.multicloud.r1.completed).toBe('186/186');
            expect(report.hypotheses.throughput_r1_gt_r0).toBe('NOT_CONFIRMED');
            expect(report.hypotheses.concurrency_eight_exhausted).toBe('NOT_MEASURED');
        }
    });
});
