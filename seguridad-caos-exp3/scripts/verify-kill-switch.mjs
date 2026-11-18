#!/usr/bin/env node
/**
 * Verificación LOCAL del kill switch y del plan de reversión (sin tocar GCP).
 *
 * Comprueba:
 * 1. Política y detector cargan.
 * 2. Flag ABORT / env CINE_TELEMETRY_CHAOS_ABORT se interpretan.
 * 3. Documentos de reversión y diseño existen.
 *
 * Exit 0 = listo para (futura) ejecución autorizada a nivel de controles locales.
 * Exit 2 = falta artefacto.
 */

import { existsSync, writeFileSync, unlinkSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  evaluateTelemetrySilence,
  DEFAULT_POLICY,
} from '../detections/telemetry-silence-detector.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

function mustExist(rel) {
  const p = join(root, rel);
  if (!existsSync(p)) {
    throw new Error(`Falta artefacto requerido: ${rel}`);
  }
  return p;
}

function isAbortRequested() {
  if (process.env.CINE_TELEMETRY_CHAOS_ABORT === '1'
    || process.env.CINE_TELEMETRY_CHAOS_ABORT === 'true') {
    return { abort: true, source: 'env:CINE_TELEMETRY_CHAOS_ABORT' };
  }
  const abortFile = join(root, 'controls', 'ABORT');
  if (existsSync(abortFile)) {
    return { abort: true, source: 'file:controls/ABORT' };
  }
  return { abort: false, source: null };
}

function main() {
  const checkedAtUtc = new Date().toISOString();
  mustExist('detections/telemetry-silence-policy.json');
  mustExist('detections/telemetry-silence-detector.mjs');
  mustExist('experiments/cine-telemetry-loss.design.json');
  mustExist('REVERSION.md');
  mustExist('controls/ABORT.example');

  const policy = JSON.parse(
    readFileSync(join(root, 'detections/telemetry-silence-policy.json'), 'utf8'),
  );

  // Smoke: detector responde OK con un par de heartbeats sintéticos.
  const smoke = evaluateTelemetrySilence(
    [
      {
        observedAtUtc: '2026-11-18T03:00:00.000Z',
        serviceName: 'cine-api',
        signal: 'cine.telemetry.heartbeat',
        heartbeatOk: true,
      },
      {
        observedAtUtc: '2026-11-18T03:00:30.000Z',
        serviceName: 'cine-api',
        signal: 'cine.telemetry.heartbeat',
        heartbeatOk: true,
      },
    ],
    policy,
    { nowUtc: '2026-11-18T03:01:00.000Z' },
  );
  if (smoke.alert || smoke.status !== 'OK') {
    throw new Error(`Smoke detector inesperado: ${JSON.stringify(smoke)}`);
  }

  // Probar que crear ABORT se detecta, luego limpiar (solo test local del flag).
  const abortPath = join(root, 'controls', 'ABORT');
  const hadAbort = existsSync(abortPath);
  if (!hadAbort) {
    writeFileSync(abortPath, `test-abort ${checkedAtUtc}\n`, 'utf8');
  }
  const withFlag = isAbortRequested();
  if (!hadAbort) {
    unlinkSync(abortPath);
  }
  if (!withFlag.abort) {
    throw new Error('Kill switch file no detectado tras crear controls/ABORT');
  }

  const envPrev = process.env.CINE_TELEMETRY_CHAOS_ABORT;
  process.env.CINE_TELEMETRY_CHAOS_ABORT = '1';
  const withEnv = isAbortRequested();
  if (envPrev === undefined) delete process.env.CINE_TELEMETRY_CHAOS_ABORT;
  else process.env.CINE_TELEMETRY_CHAOS_ABORT = envPrev;
  if (!withEnv.abort) {
    throw new Error('Kill switch env no detectado');
  }

  const report = {
    ok: true,
    checkedAtUtc,
    detectorPolicy: policy.id || DEFAULT_POLICY.id,
    smokeStatus: smoke.status,
    killSwitch: {
      fileDetected: true,
      envDetected: true,
      abortActiveNow: isAbortRequested(),
    },
    note: 'Verificación local OK. No se ejecutó kubectl ni cambios GCP. Reversión documentada en REVERSION.md.',
  };
  console.log(JSON.stringify(report, null, 2));
}

try {
  main();
} catch (err) {
  console.error(JSON.stringify({
    ok: false,
    error: err instanceof Error ? err.message : String(err),
  }));
  process.exit(2);
}
