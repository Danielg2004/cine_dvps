/**
 * Almacén de muestras OTLP con ventana temporal.
 * Evita que heartbeats históricos mantengan el detector en OK tras un corte.
 */

import { HEARTBEAT_SIGNAL } from '../detections/telemetry-silence-detector.mjs';

/**
 * @param {string} iso
 */
function parseUtcMs(iso) {
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) {
    throw new Error(`observedAtUtc inválido: ${iso}`);
  }
  return ms;
}

export function createOtlpSampleStore(options = {}) {
  const maxAgeSec = options.maxAgeSec > 0 ? options.maxAgeSec : 120;
  /** @type {import('../detections/telemetry-silence-detector.mjs').TelemetrySample[]} */
  let samples = [];
  let otlpRequestCount = 0;
  let lastOtlpReceivedAtUtc = null;
  /** Evita falsos heartbeats por reexport cumulativo sin incremento. */
  /** @type {Map<string, number>} */
  const lastCounterByInstance = new Map();

  return {
    maxAgeSec,
    recordOtlpRequest() {
      otlpRequestCount += 1;
      lastOtlpReceivedAtUtc = new Date().toISOString();
    },
    getOtlpRequestCount() {
      return otlpRequestCount;
    },
    getLastOtlpReceivedAtUtc() {
      return lastOtlpReceivedAtUtc;
    },
    /**
     * @param {object} sample
     * @param {{ counterValue?: number, requireCounterIncrease?: boolean }} [opts]
     */
    add(sample, opts = {}) {
      if (!sample || sample.signal !== HEARTBEAT_SIGNAL) return false;
      const instanceId = sample.instanceId || 'unknown-instance';
      const requireIncrease = opts.requireCounterIncrease !== false;
      if (requireIncrease && typeof opts.counterValue === 'number') {
        const prev = lastCounterByInstance.get(instanceId);
        if (prev !== undefined) {
          if (opts.counterValue === prev) {
            // Reexport cumulativo sin incremento → no es heartbeat nuevo
            return false;
          }
          // value > prev: incremento real
          // value < prev: reinicio de instrumento (nuevo MeterProvider) → aceptar
        }
        lastCounterByInstance.set(instanceId, opts.counterValue);
      }
      samples.push({
        observedAtUtc: sample.observedAtUtc,
        serviceName: sample.serviceName,
        signal: sample.signal,
        heartbeatOk: sample.heartbeatOk === true,
        instanceId,
        environment: sample.environment,
      });
      return true;
    },
    clearCounters() {
      lastCounterByInstance.clear();
    },
    /**
     * Solo muestras dentro de maxAgeSec respecto a nowUtc.
     * @param {string} [nowUtc]
     */
    getRecent(nowUtc = new Date().toISOString()) {
      const nowMs = parseUtcMs(nowUtc);
      const minMs = nowMs - maxAgeSec * 1000;
      return samples.filter((s) => parseUtcMs(s.observedAtUtc) >= minMs);
    },
    getAll() {
      return samples.slice();
    },
    clear() {
      samples = [];
      lastCounterByInstance.clear();
    },
    /** Descarta todo lo anterior a un instante (p. ej. al iniciar una ronda). */
    dropBefore(isoUtc) {
      const cut = parseUtcMs(isoUtc);
      samples = samples.filter((s) => parseUtcMs(s.observedAtUtc) >= cut);
    },
    stats(nowUtc = new Date().toISOString()) {
      const recent = this.getRecent(nowUtc);
      return {
        totalStored: samples.length,
        recentCount: recent.length,
        maxAgeSec,
        otlpRequestCount,
        lastOtlpReceivedAtUtc,
        nowUtc,
      };
    },
  };
}
