#!/usr/bin/env node
/**
 * Detector as-code — pérdida de telemetría OTEL (Experimento 3, seguridad).
 *
 * Señal canónica: heartbeat `cine.telemetry.heartbeat` (independiente del tráfico HTTP).
 * Sin heartbeats previos (pipeline nunca armado) NO se alerta por “silencio de tráfico”.
 *
 * Uso:
 *   node seguridad-caos-exp3/detections/telemetry-silence-detector.mjs \
 *     --samples path/to/samples.json --policy path/to/policy.json
 *
 * Exit codes:
 *   0 = OK (sin alerta)
 *   1 = ALERT (silencio detectado)
 *   2 = error de formato / política
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const DETECTOR_ID = 'cine-telemetry-silence-detector@1';
export const HEARTBEAT_SIGNAL = 'cine.telemetry.heartbeat';

/** Política por defecto (umbrales locales de diseño; no son evidencias GKE). */
export const DEFAULT_POLICY = {
  id: 'cine-telemetry-silence-policy@1',
  serviceName: 'cine-api',
  signal: HEARTBEAT_SIGNAL,
  /** Segundos sin heartbeat tras estar armado → alerta. */
  silenceThresholdSec: 60,
  /** Heartbeats OK consecutivos/únicos requeridos antes de armar el detector. */
  armAfterSuccessfulHeartbeats: 2,
  /** Si true, muestras de otro serviceName se ignoran. */
  requireServiceMatch: true,
};

/**
 * @typedef {{
 *   observedAtUtc: string,
 *   serviceName: string,
 *   signal: string,
 *   heartbeatOk: boolean,
 *   instanceId?: string,
 *   environment?: string,
 *   note?: string
 * }} TelemetrySample
 *
 * @typedef {{
 *   id?: string,
 *   serviceName?: string,
 *   signal?: string,
 *   silenceThresholdSec?: number,
 *   armAfterSuccessfulHeartbeats?: number,
 *   requireServiceMatch?: boolean
 * }} TelemetrySilencePolicy
 */

/**
 * @param {string} iso
 * @returns {number}
 */
export function parseUtcMs(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw Object.assign(new Error(`observedAtUtc inválido: ${iso}`), { code: 'FORMAT' });
  }
  return ms;
}

/**
 * @param {TelemetrySilencePolicy | null | undefined} partial
 * @returns {Required<TelemetrySilencePolicy> & { id: string }}
 */
export function normalizePolicy(partial) {
  const p = { ...DEFAULT_POLICY, ...(partial || {}) };
  if (!(p.silenceThresholdSec > 0)) {
    throw Object.assign(new Error('silenceThresholdSec debe ser > 0'), { code: 'FORMAT' });
  }
  if (!(p.armAfterSuccessfulHeartbeats >= 1)) {
    throw Object.assign(new Error('armAfterSuccessfulHeartbeats debe ser >= 1'), { code: 'FORMAT' });
  }
  return p;
}

/**
 * Evalúa una serie temporal de muestras de heartbeat (ordenadas o no).
 * No consulta GCP; solo lógica pura sobre muestras.
 *
 * @param {TelemetrySample[]} samples
 * @param {TelemetrySilencePolicy} [policyInput]
 * @param {{ nowUtc?: string }} [options] — reloj de evaluación (tests); default = ahora
 */
export function evaluateTelemetrySilence(samples, policyInput, options = {}) {
  const policy = normalizePolicy(policyInput);
  const evaluatedAtUtc = options.nowUtc || new Date().toISOString();
  const nowMs = parseUtcMs(evaluatedAtUtc);

  if (!Array.isArray(samples)) {
    throw Object.assign(new Error('samples debe ser un array'), { code: 'FORMAT' });
  }

  /** @type {TelemetrySample[]} */
  const relevant = samples
    .filter((s) => {
      if (!s || typeof s !== 'object') return false;
      if (policy.requireServiceMatch && s.serviceName !== policy.serviceName) return false;
      if (s.signal !== policy.signal) return false;
      return true;
    })
    .slice()
    .sort((a, b) => parseUtcMs(a.observedAtUtc) - parseUtcMs(b.observedAtUtc));

  let successCount = 0;
  /** @type {string | null} */
  let lastOkAtUtc = null;
  /** @type {number | null} */
  let armedAtMs = null;
  /** @type {string | null} */
  let armedAtUtc = null;

  for (const sample of relevant) {
    const t = parseUtcMs(sample.observedAtUtc);
    if (sample.heartbeatOk === true) {
      successCount += 1;
      lastOkAtUtc = sample.observedAtUtc;
      if (armedAtMs === null && successCount >= policy.armAfterSuccessfulHeartbeats) {
        armedAtMs = t;
        armedAtUtc = sample.observedAtUtc;
      }
    }
  }

  const armed = armedAtMs !== null;
  /** @type {number | null} */
  let silenceSec = null;
  if (lastOkAtUtc) {
    silenceSec = Math.max(0, (nowMs - parseUtcMs(lastOkAtUtc)) / 1000);
  }

  /** @type {'OK' | 'ALERT' | 'NOT_ARMED'} */
  let status = 'NOT_ARMED';
  /** @type {string | null} */
  let detectedAtUtc = null;
  let alert = false;

  if (!armed) {
    status = 'NOT_ARMED';
    alert = false;
  } else if (silenceSec !== null && silenceSec > policy.silenceThresholdSec) {
    status = 'ALERT';
    alert = true;
    // Marca de detección = último OK + umbral (instante en que el silencio supera el umbral)
    detectedAtUtc = new Date(parseUtcMs(lastOkAtUtc) + policy.silenceThresholdSec * 1000).toISOString();
    if (parseUtcMs(detectedAtUtc) > nowMs) {
      detectedAtUtc = evaluatedAtUtc;
    }
  } else {
    status = 'OK';
    alert = false;
  }

  return {
    detector: DETECTOR_ID,
    policy: policy.id,
    serviceName: policy.serviceName,
    signal: policy.signal,
    evaluatedAtUtc,
    armed,
    armedAtUtc,
    lastHeartbeatOkAtUtc: lastOkAtUtc,
    successfulHeartbeats: successCount,
    silenceSec: silenceSec === null ? null : Number(silenceSec.toFixed(3)),
    silenceThresholdSec: policy.silenceThresholdSec,
    status,
    alert,
    detectedAtUtc,
    relevantSampleCount: relevant.length,
    rationale: alert
      ? `Silencio de heartbeat ${silenceSec?.toFixed(1)}s > umbral ${policy.silenceThresholdSec}s tras detector armado.`
      : !armed
        ? `Detector no armado (heartbeats OK=${successCount}, requiere ${policy.armAfterSuccessfulHeartbeats}). Sin alerta por ausencia de tráfico HTTP.`
        : `Heartbeat dentro de umbral (silencio ${silenceSec?.toFixed(1)}s ≤ ${policy.silenceThresholdSec}s).`,
  };
}

/**
 * Evaluación por instancia (pérdida parcial vs total).
 * Mejora verificable entre R0 (agregado) y R1 (por réplica).
 *
 * @param {TelemetrySample[]} samples
 * @param {TelemetrySilencePolicy} [policyInput]
 * @param {{ nowUtc?: string }} [options]
 */
export function evaluateTelemetrySilenceByInstance(samples, policyInput, options = {}) {
  const policy = normalizePolicy(policyInput);
  if (!Array.isArray(samples)) {
    throw Object.assign(new Error('samples debe ser un array'), { code: 'FORMAT' });
  }

  /** @type {Map<string, TelemetrySample[]>} */
  const byInstance = new Map();
  for (const sample of samples) {
    if (!sample || typeof sample !== 'object') continue;
    if (policy.requireServiceMatch && sample.serviceName !== policy.serviceName) continue;
    if (sample.signal !== policy.signal) continue;
    const id = sample.instanceId || 'unknown-instance';
    const list = byInstance.get(id) || [];
    list.push(sample);
    byInstance.set(id, list);
  }

  const instances = [];
  for (const [instanceId, list] of byInstance.entries()) {
    const report = evaluateTelemetrySilence(list, policy, options);
    instances.push({ instanceId, ...report });
  }

  const aggregate = evaluateTelemetrySilence(samples, policy, options);
  const alerting = instances.filter((i) => i.alert);
  const armedInstances = instances.filter((i) => i.armed);
  let lossKind = 'none';
  if (alerting.length > 0 && armedInstances.length > 0) {
    lossKind = alerting.length >= armedInstances.length ? 'total' : 'partial';
  }

  return {
    detector: DETECTOR_ID,
    mode: 'by-instance',
    evaluatedAtUtc: options.nowUtc || new Date().toISOString(),
    aggregate,
    instances,
    alertingInstanceIds: alerting.map((i) => i.instanceId),
    lossKind,
    alert: alerting.length > 0,
  };
}

/**
 * Calcula MTTD a partir de marcas explícitas (no inventa tiempos).
 * @param {{ faultInjectedAtUtc: string, detectedAtUtc: string }} marks
 */
export function computeMttdSeconds(marks) {
  const a = parseUtcMs(marks.faultInjectedAtUtc);
  const b = parseUtcMs(marks.detectedAtUtc);
  if (b < a) {
    throw Object.assign(new Error('detectedAtUtc anterior a faultInjectedAtUtc'), { code: 'FORMAT' });
  }
  return Number(((b - a) / 1000).toFixed(3));
}

/**
 * MTTC = contención (kill switch / fin de inyección), NO restauración de telemetría.
 * @param {{ faultInjectedAtUtc: string, containedAtUtc: string }} marks
 */
export function computeMttcSeconds(marks) {
  const a = parseUtcMs(marks.faultInjectedAtUtc);
  const b = parseUtcMs(marks.containedAtUtc);
  if (b < a) {
    throw Object.assign(new Error('containedAtUtc anterior a faultInjectedAtUtc'), { code: 'FORMAT' });
  }
  return Number(((b - a) / 1000).toFixed(3));
}

/**
 * Tiempo de restauración de telemetría (métrica separada de MTTC).
 * @param {{ containedAtUtc: string, telemetryRestoredAtUtc: string }} marks
 */
export function computeRestoreSeconds(marks) {
  const a = parseUtcMs(marks.containedAtUtc);
  const b = parseUtcMs(marks.telemetryRestoredAtUtc);
  if (b < a) {
    throw Object.assign(new Error('telemetryRestoredAtUtc anterior a containedAtUtc'), { code: 'FORMAT' });
  }
  return Number(((b - a) / 1000).toFixed(3));
}

function readJson(path) {
  if (!existsSync(path)) {
    throw Object.assign(new Error(`Archivo faltante: ${path}`), { code: 'FORMAT' });
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

function parseArgs(argv) {
  /** @type {Record<string, string>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--samples' || a === '--policy' || a === '--now') {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  try {
    const args = parseArgs(argv);
    if (!args.samples) {
      console.error('Uso: --samples <file.json> [--policy <file.json>] [--now <isoUtc>]');
      process.exit(2);
    }
    const samplesDoc = readJson(resolve(args.samples));
    const samples = Array.isArray(samplesDoc) ? samplesDoc : samplesDoc.samples;
    const policy = args.policy ? readJson(resolve(args.policy)) : DEFAULT_POLICY;
    const report = evaluateTelemetrySilence(samples, policy, { nowUtc: args.now });
    console.log(JSON.stringify(report, null, 2));
    process.exit(report.alert ? 1 : 0);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({ detector: DETECTOR_ID, error: message }));
    process.exit(2);
  }
}

const isDirect = process.argv[1] && (
  process.argv[1].endsWith('telemetry-silence-detector.mjs')
  || process.argv[1].includes('telemetry-silence-detector')
);

if (isDirect) {
  main();
}
