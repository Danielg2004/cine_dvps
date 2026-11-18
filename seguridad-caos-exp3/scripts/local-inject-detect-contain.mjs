#!/usr/bin/env node
/**
 * Laboratorio LOCAL reproducible: armar → inyectar silencio → detectar → contener (kill switch) → restaurar.
 * NO toca GKE/GCP. Mide MTTD y MTTC con contención observable (archivo ABORT).
 *
 * Uso:
 *   node seguridad-caos-exp3/scripts/local-inject-detect-contain.mjs
 */
import { writeFileSync, unlinkSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTelemetrySilence,
} from '../detections/telemetry-silence-detector.mjs';
import { readFileSync } from 'node:fs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const policy = JSON.parse(
  readFileSync(join(root, 'detections/telemetry-silence-policy.json'), 'utf8'),
);
const outDir = join(root, 'evidencias-locales');
mkdirSync(outDir, { recursive: true });
const abortPath = join(root, 'controls', 'ABORT');

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isAbortRequested() {
  if (process.env.CINE_TELEMETRY_CHAOS_ABORT === '1'
    || process.env.CINE_TELEMETRY_CHAOS_ABORT === 'true') {
    return { abort: true, source: 'env:CINE_TELEMETRY_CHAOS_ABORT' };
  }
  if (existsSync(abortPath)) {
    return { abort: true, source: 'file:controls/ABORT' };
  }
  return { abort: false, source: null };
}

/**
 * Contención observable: crear ABORT (efecto real en FS) y marcar containedAtUtc
 * en la misma línea temporal sintética del experimento (coherente con MTTD/MTTC).
 * @param {string} containedAtUtc
 */
function activateContainment(containedAtUtc) {
  writeFileSync(
    abortPath,
    `# ABORT activado por local-inject-detect-contain @ ${containedAtUtc}\n`,
    'utf8',
  );
  const check = isAbortRequested();
  if (!check.abort) {
    throw new Error('Kill switch no detectable tras crear ABORT');
  }
  return { containedAtUtc, killSwitch: check };
}

async function main() {
  const samples = [];
  // Línea temporal sintética fija (reproducible); wall-clock solo para side-effects FS.
  const base = new Date('2026-11-18T16:00:00.000Z');

  // 1) Estado estable: armar detector con heartbeats OK
  for (let i = 0; i < 3; i += 1) {
    const at = new Date(base.getTime() + i * 15_000).toISOString();
    samples.push({
      observedAtUtc: at,
      serviceName: 'cine-api',
      signal: 'cine.telemetry.heartbeat',
      heartbeatOk: true,
      instanceId: 'lab-local-1',
    });
  }

  const preInjectNow = new Date(base.getTime() + 45_000).toISOString();
  const pre = evaluateTelemetrySilence(samples, policy, { nowUtc: preInjectNow });
  if (pre.alert || pre.status !== 'OK') {
    throw new Error(`Pre-inyección inesperada: ${JSON.stringify(pre)}`);
  }

  // 2) Inyección: dejar de añadir heartbeats (silencio de export)
  const faultInjectedAtUtc = new Date(base.getTime() + 46_000).toISOString();

  // 3) Detección: avanzar reloj más allá de silenceThresholdSec
  const detectedClock = new Date(base.getTime() + 46_000 + (policy.silenceThresholdSec + 5) * 1000);
  const detectedAtUtc = detectedClock.toISOString();
  const detection = evaluateTelemetrySilence(samples, policy, { nowUtc: detectedAtUtc });
  if (!detection.alert) {
    throw new Error(`Se esperaba ALERT: ${JSON.stringify(detection)}`);
  }

  // 4) Contención observable (kill switch) — MTTC = +2s tras detección en la misma línea
  const containedClock = new Date(detectedClock.getTime() + 2_000);
  const { containedAtUtc, killSwitch } = activateContainment(containedClock.toISOString());

  // 5) Restauración de señal (post-contención; ≠ MTTC)
  await sleep(10);
  const restoreAt = new Date(containedClock.getTime() + 500).toISOString();
  samples.push({
    observedAtUtc: restoreAt,
    serviceName: 'cine-api',
    signal: 'cine.telemetry.heartbeat',
    heartbeatOk: true,
    instanceId: 'lab-local-1',
  });
  const post = evaluateTelemetrySilence(samples, policy, { nowUtc: restoreAt });
  const telemetryRestoredAtUtc = post.alert ? null : restoreAt;

  // Limpiar ABORT para no dejar el lab abortado
  if (existsSync(abortPath)) unlinkSync(abortPath);

  const mttdSec = (Date.parse(detectedAtUtc) - Date.parse(faultInjectedAtUtc)) / 1000;
  const mttcSec = (Date.parse(containedAtUtc) - Date.parse(faultInjectedAtUtc)) / 1000;
  const restoreSec = telemetryRestoredAtUtc
    ? (Date.parse(telemetryRestoredAtUtc) - Date.parse(containedAtUtc)) / 1000
    : null;

  const report = {
    ok: true,
    lab: 'local-inject-detect-contain',
    cloudTouched: false,
    timelineMode: 'synthetic_coherent_utc',
    wallClockExecutedAtUtc: new Date().toISOString(),
    events: {
      faultInjectedAtUtc,
      detectedAtUtc,
      containedAtUtc,
      telemetryRestoredAtUtc,
    },
    metrics: {
      MTTD_sec: mttdSec,
      MTTC_sec: mttcSec,
      restore_sec: restoreSec,
      false_positives_pre_inject: pre.alert ? 1 : 0,
    },
    definitions: {
      MTTD: 'detectedAtUtc - faultInjectedAtUtc',
      MTTC: 'containedAtUtc - faultInjectedAtUtc (kill switch ABORT verificable en FS)',
      restore_sec: 'telemetryRestoredAtUtc - containedAtUtc (NO es MTTC)',
    },
    killSwitch,
    preInjectStatus: pre.status,
    detectionStatus: detection.status,
    postRestoreAlert: post.alert,
    audit: {
      abortAction: 'create controls/ABORT file (runner-detectable kill switch)',
      adverseCondition: 'stop appending heartbeatOk samples (synthetic export silence)',
      adverseStoppedByAbortAlone: false,
      restoreSeparateFromContainment: true,
      mttcJustification: 'synthetic_timeline: silenceThresholdSec+5 (MTTD) + 2s post-ALERT before ABORT',
      notGkeMeasurement: true,
    },
  };

  const outPath = join(outDir, 'local-inject-detect-contain-report.json');
  writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ ...report, evidencePath: outPath }, null, 2));
}

main().catch((err) => {
  if (existsSync(abortPath)) {
    try { unlinkSync(abortPath); } catch { /* ignore */ }
  }
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(2);
});
