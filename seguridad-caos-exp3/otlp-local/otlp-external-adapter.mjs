#!/usr/bin/env node
/**
 * Adaptador EXTERNO: lee muestras recibidas por OTLP (store/archivo) y evalúa el detector.
 * Puede ejecutarse en un proceso Node distinto al de Cine.
 *
 * Uso:
 *   node seguridad-caos-exp3/otlp-local/otlp-external-adapter.mjs \
 *     --samples-jsonl path/to/heartbeat-samples.jsonl \
 *     --policy ../detections/telemetry-silence-policy.json \
 *     --now 2026-11-18T12:00:00.000Z \
 *     --by-instance
 */

import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  evaluateTelemetrySilence,
  evaluateTelemetrySilenceByInstance,
  DEFAULT_POLICY,
  HEARTBEAT_SIGNAL,
} from '../detections/telemetry-silence-detector.mjs';
import { createOtlpSampleStore } from './otlp-sample-store.mjs';

/**
 * @param {string} filePath
 * @param {string} [nowUtc]
 * @param {number} [maxAgeSec]
 */
export function loadRecentSamplesFromJsonl(filePath, nowUtc, maxAgeSec = 120) {
  const store = createOtlpSampleStore({ maxAgeSec });
  if (!existsSync(filePath)) {
    return { store, samples: [] };
  }
  const lines = readFileSync(filePath, 'utf8').split(/\r?\n/).filter(Boolean);
  for (const line of lines) {
    try {
      const row = JSON.parse(line);
      if (row.signal === HEARTBEAT_SIGNAL) store.add(row);
    } catch {
      // ignora líneas corruptas
    }
  }
  return { store, samples: store.getRecent(nowUtc || new Date().toISOString()) };
}

/**
 * @param {object[]} samples
 * @param {object} [policy]
 * @param {{ nowUtc?: string, byInstance?: boolean }} [options]
 */
export function evaluateExternalSamples(samples, policy = DEFAULT_POLICY, options = {}) {
  if (options.byInstance) {
    return evaluateTelemetrySilenceByInstance(samples, policy, { nowUtc: options.nowUtc });
  }
  return evaluateTelemetrySilence(samples, policy, { nowUtc: options.nowUtc });
}

function parseArgs(argv) {
  /** @type {Record<string, string | boolean>} */
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--by-instance') out.byInstance = true;
    else if (a.startsWith('--')) {
      out[a.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function main(argv = process.argv.slice(2)) {
  const args = parseArgs(argv);
  if (!args['samples-jsonl']) {
    console.error('Uso: --samples-jsonl <file> [--policy file] [--now iso] [--by-instance] [--report-out file]');
    process.exit(2);
  }
  const nowUtc = typeof args.now === 'string' ? args.now : new Date().toISOString();
  const maxAgeSec = args['max-age-sec'] ? Number(args['max-age-sec']) : 120;
  const policy = args.policy
    ? JSON.parse(readFileSync(resolve(String(args.policy)), 'utf8'))
    : DEFAULT_POLICY;

  const { samples, store } = loadRecentSamplesFromJsonl(
    resolve(String(args['samples-jsonl'])),
    nowUtc,
    maxAgeSec,
  );

  const report = evaluateExternalSamples(samples, policy, {
    nowUtc,
    byInstance: Boolean(args.byInstance),
  });

  const envelope = {
    adapter: 'otlp-external-adapter@1',
    independentProcess: true,
    evaluatedAtUtc: nowUtc,
    sampleStats: store.stats(nowUtc),
    recentSampleCount: samples.length,
    report,
  };

  const text = `${JSON.stringify(envelope, null, 2)}\n`;
  if (args['report-out']) {
    writeFileSync(resolve(String(args['report-out'])), text, 'utf8');
  }
  console.log(text);
  process.exit(report.alert ? 1 : 0);
}

const isDirect = process.argv[1] && process.argv[1].includes('otlp-external-adapter');
if (isDirect) {
  main();
}
