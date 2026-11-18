#!/usr/bin/env node
/**
 * Lab local: heartbeat → OTLP HTTP JSON → receptor → adaptador externo → detector.
 * La recepción se verifica por POST /v1/metrics (no por listeners internos).
 * No toca GCP/OCI.
 *
 *   node seguridad-caos-exp3/otlp-local/run-otlp-chain-lab.mjs
 */

import { spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-http';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
} from '@opentelemetry/sdk-metrics';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { createOtlpHttpMetricsReceiver } from './otlp-http-receiver.mjs';

const ROOT = resolve(process.cwd());
const OUT = resolve(ROOT, 'seguridad-caos-exp3/otlp-local/out');
const EVIDENCE = resolve(ROOT, 'seguridad-caos-exp3/evidencias-locales');
const ADAPTER = resolve(ROOT, 'seguridad-caos-exp3/otlp-local/otlp-external-adapter.mjs');
const HEARTBEAT = 'cine.telemetry.heartbeat';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function createExportingProvider(otlpUrl) {
  const exporter = new OTLPMetricExporter({ url: otlpUrl });
  const reader = new PeriodicExportingMetricReader({
    exporter,
    exportIntervalMillis: 200,
  });
  const provider = new MeterProvider({
    resource: resourceFromAttributes({
      'service.name': 'cine-api',
      'deployment.environment': 'lab-local',
    }),
    readers: [reader],
  });
  return provider;
}

function emitHeartbeat(provider, instanceId) {
  const meter = provider.getMeter('cine-api-lab');
  const counter = meter.createCounter(HEARTBEAT, { unit: '{heartbeat}' });
  counter.add(1, {
    'service.name': 'cine-api',
    'service.instance.id': instanceId,
    'deployment.environment': 'lab-local',
  });
}

async function flushHeartbeats(provider, times) {
  for (let i = 0; i < times; i += 1) {
    emitHeartbeat(provider, 'pod-lab-a');
    emitHeartbeat(provider, 'pod-lab-b');
    await provider.forceFlush();
    await sleep(250);
  }
}

function runAdapter({ samplesJsonl, policy, nowUtc, reportOut, maxAgeSec, byInstance }) {
  const args = [
    ADAPTER,
    '--samples-jsonl', samplesJsonl,
    '--policy', policy,
    '--now', nowUtc,
    '--max-age-sec', String(maxAgeSec),
    '--report-out', reportOut,
  ];
  if (byInstance) args.push('--by-instance');
  return spawnSync(process.execPath, args, { encoding: 'utf8', cwd: ROOT });
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  mkdirSync(EVIDENCE, { recursive: true });
  const samplesPath = join(OUT, 'heartbeat-samples.jsonl');
  rmSync(samplesPath, { force: true });

  const shortPolicyPath = join(OUT, 'policy-short.json');
  writeFileSync(shortPolicyPath, `${JSON.stringify({
    id: 'cine-telemetry-silence-policy@lab',
    serviceName: 'cine-api',
    signal: HEARTBEAT,
    silenceThresholdSec: 2,
    armAfterSuccessfulHeartbeats: 2,
    requireServiceMatch: true,
  }, null, 2)}\n`);

  /** @type {Record<string, string>} */
  const timeline = {};
  const receiver = createOtlpHttpMetricsReceiver({
    host: '127.0.0.1',
    port: 0,
    maxAgeSec: 60,
    outDir: OUT,
  });
  const info = await receiver.start();
  timeline.receiverStartedAtUtc = new Date().toISOString();

  // --- Negativa: telemetría sana vía OTLP ---
  let provider = createExportingProvider(info.url);
  await flushHeartbeats(provider, 3);
  timeline.healthyFlushAtUtc = new Date().toISOString();

  const otlpAfterHealthy = receiver.store.getOtlpRequestCount();
  if (otlpAfterHealthy < 1) {
    throw new Error('FALLO: cero POST OTLP recibidos (recepción real requerida)');
  }

  const negReportPath = join(EVIDENCE, 'otlp-chain-negative-report.json');
  const neg = runAdapter({
    samplesJsonl: samplesPath,
    policy: shortPolicyPath,
    nowUtc: new Date().toISOString(),
    reportOut: negReportPath,
    maxAgeSec: 60,
    byInstance: true,
  });
  if (neg.status !== 0) {
    throw new Error(`FALLO negativa: exit=${neg.status} stderr=${neg.stderr} stdout=${neg.stdout}`);
  }

  // --- Positiva: cortar export OTLP ---
  timeline.faultInjectedAtUtc = new Date().toISOString();
  await provider.shutdown();
  await sleep(3000);
  timeline.detectedAtUtc = new Date().toISOString();

  const posReportPath = join(EVIDENCE, 'otlp-chain-positive-report.json');
  const pos = runAdapter({
    samplesJsonl: samplesPath,
    policy: shortPolicyPath,
    nowUtc: timeline.detectedAtUtc,
    reportOut: posReportPath,
    maxAgeSec: 60,
    byInstance: true,
  });
  if (pos.status !== 1) {
    throw new Error(`FALLO positiva: se esperaba ALERT exit=1, got ${pos.status} stdout=${pos.stdout}`);
  }

  timeline.containedAtUtc = new Date().toISOString();

  // --- Restore ---
  provider = createExportingProvider(info.url);
  await flushHeartbeats(provider, 2);
  timeline.telemetryRestoredAtUtc = new Date().toISOString();

  const restoreReportPath = join(EVIDENCE, 'otlp-chain-restore-report.json');
  const restore = runAdapter({
    samplesJsonl: samplesPath,
    policy: shortPolicyPath,
    nowUtc: timeline.telemetryRestoredAtUtc,
    reportOut: restoreReportPath,
    maxAgeSec: 15,
    byInstance: true,
  });
  if (restore.status !== 0) {
    throw new Error(`FALLO restore: exit=${restore.status} stdout=${restore.stdout}`);
  }

  await provider.shutdown();
  await receiver.stop();

  const mttdSec = (Date.parse(timeline.detectedAtUtc) - Date.parse(timeline.faultInjectedAtUtc)) / 1000;
  const mttcSec = (Date.parse(timeline.containedAtUtc) - Date.parse(timeline.faultInjectedAtUtc)) / 1000;
  const restoreSec = (Date.parse(timeline.telemetryRestoredAtUtc) - Date.parse(timeline.containedAtUtc)) / 1000;

  const evidence = {
    lab: 'otlp-chain-local@1',
    branchHint: 'feature/seguridad-caos-cine',
    otlp: {
      protocol: 'http/json',
      receiverUrl: info.url,
      requestsObserved: otlpAfterHealthy,
      note: 'Verificado por contador de POST /v1/metrics al receptor local',
    },
    timelineUtc: timeline,
    metrics: {
      MTTD_sec: Number(mttdSec.toFixed(3)),
      // Lab: containedAtUtc es ack post-ALERT, NO contención operativa (kill switch).
      lab_ack_after_detect_sec: Number(mttcSec.toFixed(3)),
      restore_sec: Number(restoreSec.toFixed(3)),
      MTTC_sec_validated_containment: null,
    },
    metricsCaveat: {
      MTTD: 'Validado en lab: detectedAtUtc - faultInjectedAtUtc',
      MTTC: 'NO validado como contención operativa en este lab. containedAtUtc es marca de ack post-detección; ver METRICAS.md',
      restore_sec: 'Validado en lab: telemetryRestoredAtUtc - containedAtUtc (restore de señal OTLP)',
    },
    negative: { exitCode: neg.status, report: 'seguridad-caos-exp3/evidencias-locales/otlp-chain-negative-report.json' },
    positive: { exitCode: pos.status, report: 'seguridad-caos-exp3/evidencias-locales/otlp-chain-positive-report.json' },
    restore: { exitCode: restore.status, report: 'seguridad-caos-exp3/evidencias-locales/otlp-chain-restore-report.json' },
    passed: true,
  };

  const evidencePath = join(EVIDENCE, 'otlp-chain-lab-result.json');
  writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({
    ok: true,
    evidencePath,
    otlpRequests: evidence.otlp.requestsObserved,
    metrics: evidence.metrics,
    metricsCaveat: evidence.metricsCaveat,
  }, null, 2));
}

main().catch((err) => {
  console.error(JSON.stringify({ ok: false, error: err instanceof Error ? err.message : String(err) }));
  process.exit(1);
});
