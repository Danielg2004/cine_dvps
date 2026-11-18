#!/usr/bin/env node
/**
 * Runner LOCAL Exp. 3 — misma inyección parcial (B silent / A OK) en R0 y R1.
 * R0 = detector agregado; R1 = por instancia. Total A+B = prueba complementaria.
 * Simula identidad estable (mismos instanceId A/B; setEmit sin “restart”).
 * No despliega GKE.
 */
import { writeFileSync, mkdirSync, unlinkSync, existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTelemetrySilence,
  evaluateTelemetrySilenceByInstance,
  computeMttdSeconds,
  computeMttcSeconds,
  computeRestoreSeconds,
} from '../detections/telemetry-silence-detector.mjs';
import { activateLocalContainment, clearLocalContainment } from './exp3-containment.mjs';
import { ALLOWED_NAMESPACE } from './exp3-guardrails.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'evidencias-locales/exp3-lab-runner-report.json');
const abortPath = join(root, 'controls/ABORT');
const basePolicy = JSON.parse(
  readFileSync(join(root, 'detections/telemetry-silence-policy.exp3-lab.json'), 'utf8'),
);

/** Umbral corto solo para simulación local (no GKE). */
const LAB_POLICY = {
  ...basePolicy,
  silenceThresholdSec: 2,
  armAfterSuccessfulHeartbeats: 2,
};

const SERVICE = 'cine-exp3-telemetry';
const SIGNAL = 'cine.telemetry.heartbeat';
const MAX_DURATION_MS = 45 * 60 * 1000;

function sample(instanceId, atUtc) {
  return {
    observedAtUtc: atUtc,
    serviceName: SERVICE,
    signal: SIGNAL,
    heartbeatOk: true,
    instanceId,
  };
}

function createLabBus() {
  const samples = [];
  let emitA = true;
  let emitB = true;
  let containment = false;
  return {
    samples,
    setEmit(a, b) { emitA = a; emitB = b; },
    setContainment(v) { containment = v; },
    tick(atUtc) {
      if (containment || emitA) samples.push(sample('emitter-a', atUtc));
      if (containment || emitB) samples.push(sample('emitter-b', atUtc));
    },
  };
}

function ensureMaxDuration(startedMs) {
  if (Date.now() - startedMs > MAX_DURATION_MS) {
    throw Object.assign(new Error('MAX_DURATION exceeded'), { code: 'EXP3_TIMEOUT' });
  }
}

function setAbort() {
  writeFileSync(abortPath, `ABORT runner ${new Date().toISOString()}\n`, 'utf8');
}
function clearAbort() {
  if (existsSync(abortPath)) unlinkSync(abortPath);
}

/**
 * @param {'aggregate' | 'by-instance'} mode
 * @param {string} label
 * @param {string} baseIso
 */
function runRound(mode, label, baseIso, wallStart) {
  ensureMaxDuration(wallStart);
  const bus = createLabBus();
  const t0 = Date.parse(baseIso);

  bus.setContainment(false);
  bus.setEmit(true, true);
  for (let i = 0; i < 3; i += 1) bus.tick(new Date(t0 + i * 1000).toISOString());

  const preNow = new Date(t0 + 3_000).toISOString();
  const pre = mode === 'by-instance'
    ? evaluateTelemetrySilenceByInstance(bus.samples, LAB_POLICY, { nowUtc: preNow })
    : evaluateTelemetrySilence(bus.samples, LAB_POLICY, { nowUtc: preNow });
  if (pre.alert) throw new Error(`${label}: FP pre-inyección`);

  // Misma inyección adversa: B silencioso, A OK
  const faultInjectedAtUtc = new Date(t0 + 4_000).toISOString();
  bus.setEmit(true, false);
  for (let i = 0; i < 5; i += 1) bus.tick(new Date(t0 + 4_000 + i * 1000).toISOString());

  const detectNow = new Date(t0 + 9_000).toISOString();
  const detection = mode === 'by-instance'
    ? evaluateTelemetrySilenceByInstance(bus.samples, LAB_POLICY, { nowUtc: detectNow })
    : evaluateTelemetrySilence(bus.samples, LAB_POLICY, { nowUtc: detectNow });

  const detectedAtUtc = mode === 'by-instance'
    ? (detection.instances?.find((i) => i.alert)?.detectedAtUtc || null)
    : (detection.detectedAtUtc || null);

  setAbort();
  // Línea temporal sintética coherente con fault/detect (no wall-clock).
  const abortRequestedAtUtc = new Date(Date.parse(detectNow) + 500).toISOString();
  const containedAtUtc = new Date(Date.parse(detectNow) + 1_000).toISOString();
  activateLocalContainment({ containedAtUtc, abortRequestedAtUtc });
  bus.setContainment(true);

  const afterContain = Date.parse(containedAtUtc) + 1_000;
  for (let i = 0; i < 3; i += 1) bus.tick(new Date(afterContain + i * 1000).toISOString());

  clearLocalContainment();
  clearAbort();
  bus.setContainment(false);
  bus.setEmit(true, true);
  const formalRestore = afterContain + 4_000;
  for (let i = 0; i < 3; i += 1) bus.tick(new Date(formalRestore + i * 1000).toISOString());
  const restoredEvalAt = new Date(formalRestore + 3_000).toISOString();
  const post = mode === 'by-instance'
    ? evaluateTelemetrySilenceByInstance(bus.samples, LAB_POLICY, { nowUtc: restoredEvalAt })
    : evaluateTelemetrySilence(bus.samples, LAB_POLICY, { nowUtc: restoredEvalAt });

  const telemetryRestoredAtUtc = post.alert ? null : restoredEvalAt;

  return {
    round: label,
    mode,
    injection: 'partial-b-silent-a-ok',
    namespace: ALLOWED_NAMESPACE,
    preInject: mode === 'by-instance'
      ? { alert: pre.alert, lossKind: pre.lossKind }
      : { alert: pre.alert, status: pre.status },
    detection: mode === 'by-instance'
      ? {
          alert: detection.alert,
          lossKind: detection.lossKind,
          alertingInstanceIds: detection.alertingInstanceIds,
          evaluatedAtUtc: detection.evaluatedAtUtc,
        }
      : {
          alert: detection.alert,
          status: detection.status,
          detectedAtUtc: detection.detectedAtUtc,
          silenceSec: detection.silenceSec,
        },
    events: {
      faultInjectedAtUtc,
      detectedAtUtc,
      abortRequestedAtUtc,
      containedAtUtc,
      telemetryRestoredAtUtc,
    },
    metrics: {
      MTTD_sec: detection.alert && detectedAtUtc
        ? computeMttdSeconds({ faultInjectedAtUtc, detectedAtUtc })
        : null,
      MTTC_sec: computeMttcSeconds({ faultInjectedAtUtc, containedAtUtc }),
      restore_sec: telemetryRestoredAtUtc
        ? computeRestoreSeconds({ containedAtUtc, telemetryRestoredAtUtc })
        : null,
      false_positives_pre_inject: 0,
    },
    postRestoreOk: post.alert === false,
  };
}

function complementaryTotal(wallStart) {
  ensureMaxDuration(wallStart);
  const bus = createLabBus();
  const t0 = Date.parse('2026-11-18T18:00:00.000Z');
  bus.setEmit(true, true);
  for (let i = 0; i < 3; i += 1) bus.tick(new Date(t0 + i * 1000).toISOString());
  bus.setEmit(false, false);
  const faultInjectedAtUtc = new Date(t0 + 4_000).toISOString();
  const detectNow = new Date(t0 + 9_000).toISOString();
  const agg = evaluateTelemetrySilence(bus.samples, LAB_POLICY, { nowUtc: detectNow });
  const byI = evaluateTelemetrySilenceByInstance(bus.samples, LAB_POLICY, { nowUtc: detectNow });
  return {
    name: 'complementary-total-a-and-b',
    injection: 'total-a-and-b-silent',
    note: 'Complementaria; fuera de la comparación principal R0/R1',
    faultInjectedAtUtc,
    aggregateAlert: agg.alert,
    byInstance: { alert: byI.alert, lossKind: byI.lossKind },
  };
}

function main() {
  const wallStart = Date.now();
  mkdirSync(dirname(outPath), { recursive: true });
  clearAbort();
  clearLocalContainment();

  try {
    const r0 = runRound('aggregate', 'R0', '2026-11-18T17:00:00.000Z', wallStart);
    const r1 = runRound('by-instance', 'R1', '2026-11-18T17:20:00.000Z', wallStart);
    const complementary = complementaryTotal(wallStart);

    const comparison = {
      sameInjection: 'partial-b-silent-a-ok',
      hypothesis:
        'Con B silencioso y A OK: R0 agregado no alerta; R1 por instancia alerta lossKind=partial',
      r0Alert: r0.detection.alert,
      r1Alert: r1.detection.alert,
      r1LossKind: r1.detection.lossKind ?? null,
      improvementConfirmed:
        r0.detection.alert === false
        && r1.detection.alert === true
        && r1.detection.lossKind === 'partial',
    };

    const report = {
      ok: comparison.improvementConfirmed
        && r0.postRestoreOk
        && r1.postRestoreOk
        && complementary.aggregateAlert === true
        && complementary.byInstance.lossKind === 'total',
      executedAtUtc: new Date().toISOString(),
      cloudTouched: false,
      namespace: ALLOWED_NAMESPACE,
      maxDurationMin: 45,
      policyId: LAB_POLICY.id,
      silenceThresholdSecLabSim: LAB_POLICY.silenceThresholdSec,
      R0: r0,
      R1: r1,
      complementaryTotal: complementary,
      comparison,
      note: 'Simulación local; no es medición GKE.',
    };

    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.ok ? 0 : 1);
  } catch (err) {
    clearAbort();
    clearLocalContainment();
    const report = {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      executedAtUtc: new Date().toISOString(),
    };
    writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.error(JSON.stringify(report, null, 2));
    process.exit(1);
  }
}

main();
