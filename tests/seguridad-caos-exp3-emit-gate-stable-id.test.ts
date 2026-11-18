import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { isEmitEnabled, containmentActive } from '../seguridad-caos-exp3/lab/emit-gate.mjs';
import {
  evaluateTelemetrySilence,
  evaluateTelemetrySilenceByInstance,
} from '../seguridad-caos-exp3/detections/telemetry-silence-detector.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const policy = JSON.parse(
  readFileSync(resolve('seguridad-caos-exp3/detections/telemetry-silence-policy.exp3-lab.json'), 'utf8'),
);

describe('emit-gate — inyección por volumen sin restart', () => {
  let dir: string;
  let containDir: string;
  let containFile: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'exp3-emit-'));
    containDir = mkdtempSync(join(tmpdir(), 'exp3-contain-'));
    containFile = join(containDir, 'CONTAINMENT_ACTIVE');
    writeFileSync(containFile, 'false\n');
    writeFileSync(join(dir, 'TELEMETRY_EMIT_ENABLED'), 'true\n');
    writeFileSync(join(dir, 'OTEL_METRICS_EXPORTER'), 'otlp\n');
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    rmSync(containDir, { recursive: true, force: true });
  });

  it('emisión normal A/B (flags true)', () => {
    const g = isEmitEnabled({
      containmentFile: containFile,
      emitFlagsDir: dir,
    });
    expect(g.enabled).toBe(true);
    expect(g.source).toBe('volume');
  });

  it('silencio de B al desactivar flags en volumen (sin reinicio)', () => {
    writeFileSync(join(dir, 'TELEMETRY_EMIT_ENABLED'), 'false\n');
    writeFileSync(join(dir, 'OTEL_METRICS_EXPORTER'), 'none\n');
    const g = isEmitEnabled({
      containmentFile: containFile,
      emitFlagsDir: dir,
    });
    expect(g.enabled).toBe(false);
    expect(g.reason).toContain('emit_disabled');
  });

  it('contención ABORT fuerza emisión pese a flags silent', () => {
    writeFileSync(join(dir, 'TELEMETRY_EMIT_ENABLED'), 'false\n');
    writeFileSync(join(dir, 'OTEL_METRICS_EXPORTER'), 'none\n');
    writeFileSync(containFile, 'true\n');
    expect(containmentActive(containFile)).toBe(true);
    const g = isEmitEnabled({
      containmentFile: containFile,
      emitFlagsDir: dir,
    });
    expect(g.enabled).toBe(true);
    expect(g.reason).toBe('containment');
  });

  it('restauración: flags true + containment false → emit OK', () => {
    writeFileSync(containFile, 'false\n');
    writeFileSync(join(dir, 'TELEMETRY_EMIT_ENABLED'), 'true\n');
    writeFileSync(join(dir, 'OTEL_METRICS_EXPORTER'), 'otlp\n');
    const g = isEmitEnabled({
      containmentFile: containFile,
      emitFlagsDir: dir,
    });
    expect(g.enabled).toBe(true);
  });
});

describe('identidad estable + detectores R0/R1 sobre misma instancia B', () => {
  const INSTANCE_A = 'cine-exp3-emitter-a-stable';
  const INSTANCE_B = 'cine-exp3-emitter-b-stable';

  function sample(instanceId: string, atUtc: string) {
    return {
      observedAtUtc: atUtc,
      serviceName: 'cine-exp3-telemetry',
      signal: 'cine.telemetry.heartbeat',
      heartbeatOk: true,
      instanceId,
    };
  }

  it('misma instanceId B armada → silencio → R0 no alerta, R1 partial', () => {
    const samples = [];
    // baseline: A y B emiten (identidad fija)
    for (let i = 0; i < 4; i += 1) {
      const t = new Date(Date.parse('2026-11-18T18:00:00.000Z') + i * 15_000).toISOString();
      samples.push(sample(INSTANCE_A, t));
      samples.push(sample(INSTANCE_B, t));
    }
    // inject: solo A continúa; B mismo id, sin nuevos heartbeats
    for (let i = 0; i < 6; i += 1) {
      const t = new Date(Date.parse('2026-11-18T18:01:00.000Z') + i * 15_000).toISOString();
      samples.push(sample(INSTANCE_A, t));
    }
    const nowUtc = '2026-11-18T18:03:00.000Z'; // B last ~18:00:45 → silencio > 60s

    const ids = [...new Set(samples.map((s) => s.instanceId))];
    expect(ids).toEqual([INSTANCE_A, INSTANCE_B]);

    const r0 = evaluateTelemetrySilence(samples, policy, { nowUtc });
    const r1 = evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc });

    expect(r0.alert).toBe(false);
    expect(r1.alert).toBe(true);
    expect(r1.lossKind).toBe('partial');
    expect(r1.alertingInstanceIds).toContain(INSTANCE_B);
    expect(r1.alertingInstanceIds).not.toContain(INSTANCE_A);

    const b = r1.instances.find((i) => i.instanceId === INSTANCE_B)!;
    expect(b.armed).toBe(true);
    expect(b.alert).toBe(true);
  });

  it('A continúa emitiendo durante silencio de B', () => {
    const samples = [
      sample(INSTANCE_A, '2026-11-18T18:00:00.000Z'),
      sample(INSTANCE_B, '2026-11-18T18:00:00.000Z'),
      sample(INSTANCE_A, '2026-11-18T18:00:15.000Z'),
      sample(INSTANCE_B, '2026-11-18T18:00:15.000Z'),
      sample(INSTANCE_A, '2026-11-18T18:02:00.000Z'),
      sample(INSTANCE_A, '2026-11-18T18:02:30.000Z'),
    ];
    const nowUtc = '2026-11-18T18:02:45.000Z';
    const r0 = evaluateTelemetrySilence(samples, policy, { nowUtc });
    const r1 = evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc });
    expect(r0.alert).toBe(false);
    expect(r1.lossKind).toBe('partial');
    const a = r1.instances.find((i) => i.instanceId === INSTANCE_A)!;
    expect(a.alert).toBe(false);
  });
});
