#!/usr/bin/env node
/**
 * Puente local emisor → detector (adaptador de pruebas / lab).
 *
 * El detector Exp. 3 NO habla OTLP nativo: consume muestras JSON
 * `{ observedAtUtc, serviceName, signal, heartbeatOk, instanceId? }`.
 *
 * Este adaptador:
 * 1. Acumula muestras espejo del heartbeat de Cine (cuando export métricas OTEL está ON).
 * 2. Puede evaluar inmediatamente con el detector.
 * 3. Puede escribir un snapshot JSON para CLI del detector.
 *
 * No consulta GCP/Tempo/Prometheus. No sustituye un Collector OTLP de producción;
 * simula la cola de muestras que un scraper/collector entregaría al detector.
 */

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import {
  evaluateTelemetrySilence,
  evaluateTelemetrySilenceByInstance,
  DEFAULT_POLICY,
  HEARTBEAT_SIGNAL,
} from '../detections/telemetry-silence-detector.mjs';

/**
 * @typedef {{
 *   observedAtUtc: string,
 *   serviceName: string,
 *   signal: string,
 *   heartbeatOk: boolean,
 *   instanceId?: string,
 *   environment?: string
 * }} TelemetrySample
 */

export function createLocalHeartbeatBridge(policy = DEFAULT_POLICY) {
  /** @type {TelemetrySample[]} */
  const samples = [];

  return {
    policy,
    /** @param {TelemetrySample} sample */
    push(sample) {
      if (!sample || sample.signal !== HEARTBEAT_SIGNAL) {
        return false;
      }
      samples.push({
        observedAtUtc: sample.observedAtUtc,
        serviceName: sample.serviceName,
        signal: sample.signal,
        heartbeatOk: sample.heartbeatOk === true,
        instanceId: sample.instanceId,
        environment: sample.environment,
      });
      return true;
    },
    clear() {
      samples.length = 0;
    },
    getSamples() {
      return samples.slice();
    },
    /**
     * @param {{ nowUtc?: string, byInstance?: boolean }} [options]
     */
    evaluate(options = {}) {
      if (options.byInstance) {
        return evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc: options.nowUtc });
      }
      return evaluateTelemetrySilence(samples, policy, { nowUtc: options.nowUtc });
    },
    /**
     * @param {string} filePath
     */
    writeSnapshot(filePath) {
      const abs = resolve(filePath);
      mkdirSync(dirname(abs), { recursive: true });
      const doc = {
        description: 'Snapshot local heartbeat bridge (no evidencia GKE)',
        writtenAtUtc: new Date().toISOString(),
        samples: samples.slice(),
      };
      writeFileSync(abs, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
      return abs;
    },
  };
}

export function sampleFromHeartbeatEmit(emitResult) {
  return {
    observedAtUtc: emitResult.observedAtUtc,
    serviceName: emitResult.serviceName,
    signal: emitResult.signal,
    heartbeatOk: emitResult.heartbeatOk === true,
    instanceId: emitResult.instanceId,
    environment: emitResult.environment,
  };
}
