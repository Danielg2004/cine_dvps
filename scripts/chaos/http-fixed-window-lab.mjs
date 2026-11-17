#!/usr/bin/env node
/**
 * Serie v2 HTTP: ventana fija + concurrencia sostenida contra API real.
 * Evita el artefacto in-process (503 rápidos que ahogan el event loop del servidor).
 *
 * Requisitos: API en CINE_BASE_URL con película CINE_PELICULA_ID.
 * Misma intensidad de fallo y mismos límites en R0/R1 (solo cambia EXPERIMENT_ROUND en el servidor).
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const baseUrl = (process.env.CINE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const peliculaId = process.env.CINE_PELICULA_ID || '1';
const token = process.env.CHAOS_FAULT_TOKEN || '';
const RESULTS = join(process.cwd(), 'chaos', 'results');

const PROFILE = {
  series: 'v2-http-fixed-window',
  concurrency: Number(process.env.LAB_CONCURRENCY || 20),
  windowSec: Number(process.env.LAB_WINDOW_SEC || 6),
  holdMs: Number(process.env.CHAOS_HOLD_MS || 250),
  maxInflight: Number(process.env.CHAOS_MAX_INFLIGHT || 8),
  durationSec: Number(process.env.CHAOS_DURATION_SEC || 30),
  maxQueueWaitMs: Number(process.env.CHAOS_MAX_QUEUE_WAIT_MS || 200),
};

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.max(0, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

async function req(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-chaos-token': token,
      'x-trace-id': `http-lab-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(15000),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function loadWindow() {
  const samples = [];
  const deadline = performance.now() + PROFILE.windowSec * 1000;

  async function worker() {
    while (performance.now() < deadline) {
      const t0 = performance.now();
      try {
        const result = await req(`/api/v2/peliculas/${peliculaId}`);
        samples.push({ status: result.status, latencyMs: performance.now() - t0 });
      } catch {
        samples.push({ status: 0, latencyMs: performance.now() - t0 });
      }
    }
  }

  await Promise.all(Array.from({ length: PROFILE.concurrency }, () => worker()));

  const success = samples.filter((s) => s.status >= 200 && s.status < 400);
  const rejected503 = samples.filter((s) => s.status === 503);
  const rejected429 = samples.filter((s) => s.status === 429);
  const successLatencies = success.map((s) => s.latencyMs);

  return {
    samples: samples.length,
    success: success.length,
    failed: samples.length - success.length,
    rejected_503: rejected503.length,
    rejected_429: rejected429.length,
    rejected_429_503: rejected503.length + rejected429.length,
    success_rate: Number((success.length / (samples.length || 1)).toFixed(4)),
    successful_rps: Number((success.length / PROFILE.windowSec).toFixed(4)),
    latencies_ms: {
      success_p95: Number(percentile(successLatencies, 0.95).toFixed(2)),
      all_p95: Number(percentile(samples.map((s) => s.latencyMs), 0.95).toFixed(2)),
    },
  };
}

function write(name, payload) {
  mkdirSync(RESULTS, { recursive: true });
  const path = join(RESULTS, name);
  writeFileSync(path, JSON.stringify(payload, null, 2));
  return path;
}

async function measureRound(round) {
  const health = await req('/healthz');
  if (health.status !== 200) {
    throw new Error(`healthz=${health.status} antes de ${round}`);
  }

  let saturation = null;
  if (round !== 'baseline') {
    const start = await req('/api/v3/__test/saturation/start', {
      method: 'POST',
      body: JSON.stringify({
        holdMs: PROFILE.holdMs,
        maxInflight: PROFILE.maxInflight,
        durationSec: PROFILE.durationSec,
        maxQueueWaitMs: PROFILE.maxQueueWaitMs,
      }),
    });
    if (start.status !== 202) {
      throw new Error(`no se activo saturacion en ${round}: HTTP ${start.status}`);
    }
    saturation = start.body;
  }

  try {
    const during = await loadWindow();
    return {
      ok: true,
      experiment_id: 'cine-resource-exhaustion-concurrency-v1',
      series: PROFILE.series,
      round,
      profile: PROFILE,
      baseUrl,
      started_at: new Date().toISOString(),
      steady_state_healthz: health.status,
      saturation_start: saturation,
      during: {
        ...during,
        measurement: 'fixed_window_http',
        window_sec: PROFILE.windowSec,
        with_fault: round !== 'baseline',
      },
      successful_rps: during.successful_rps,
      finished_at: new Date().toISOString(),
    };
  } finally {
    if (round !== 'baseline') {
      await req('/api/v3/__test/saturation/stop', { method: 'POST' });
      await req('/healthz');
    }
  }
}

function compare(baseline, r0, r1) {
  const absolute = r1.successful_rps - r0.successful_rps;
  const pct = r0.successful_rps === 0 ? null : (absolute / r0.successful_rps) * 100;
  const rpsImproved = pct !== null && pct > 0;
  const rpsSimilar = pct !== null && Math.abs(pct) <= 15;
  const controlledRejects = (r1.during.rejected_429_503 || 0) > 0;
  const r0AlsoDegraded = r0.during.success_rate < 0.999 || (r0.during.rejected_429_503 || 0) > 0;
  const p95SuccessImproved =
    r1.during.latencies_ms.success_p95 > 0 &&
    r0.during.latencies_ms.success_p95 > 0 &&
    r1.during.latencies_ms.success_p95 <= r0.during.latencies_ms.success_p95 * 1.1;

  let hypothesis = 'NO_CONFIRMADA_CON_ESTOS_DATOS';
  if (rpsImproved) {
    hypothesis = 'SOPORTADA: R1 mejoró throughput exitoso bajo el mismo fallo';
  } else if (rpsSimilar && controlledRejects && p95SuccessImproved) {
    hypothesis = 'SOPORTADA_PARCIALMENTE: R1 sostiene RPS similar con 503 controlados y p95 de éxitos acotado';
  } else if (controlledRejects && r0AlsoDegraded) {
    hypothesis = 'SOPORTADA_PARCIALMENTE: ambos degradan; R1 convierte exceso en 503 controlados';
  }

  return {
    series: PROFILE.series,
    metric_primary: 'successful_requests_per_second',
    measurement: 'fixed_window_http',
    window_sec: PROFILE.windowSec,
    baseline: baseline.successful_rps,
    r0: r0.successful_rps,
    r1: r1.successful_rps,
    absolute_diff_r1_minus_r0: absolute,
    percent_change_r1_vs_r0: pct,
    r0_success_rate: r0.during.success_rate,
    r1_success_rate: r1.during.success_rate,
    r0_rejected_429_503: r0.during.rejected_429_503,
    r1_rejected_429_503: r1.during.rejected_429_503,
    r0_success_p95_ms: r0.during.latencies_ms.success_p95,
    r1_success_p95_ms: r1.during.latencies_ms.success_p95,
    signals: { rpsImproved, rpsSimilar, p95SuccessImproved, controlledRejects, r0AlsoDegraded },
    hypothesis,
    caution: 'No mezclar con serie v1 ni con in-process flooded.',
    profile: PROFILE,
    generated_at: new Date().toISOString(),
  };
}

const round = process.argv[2];
if (!['baseline', 'r0', 'r1', 'all'].includes(round)) {
  console.error('Uso: node scripts/chaos/http-fixed-window-lab.mjs <baseline|r0|r1|all>');
  console.error('El servidor debe iniciarse con EXPERIMENT_ROUND acorde (r0/r1/baseline).');
  process.exit(2);
}

if ((round === 'r0' || round === 'r1' || round === 'all') && token.length < 16) {
  console.error(JSON.stringify({ ok: false, error: 'CHAOS_FAULT_TOKEN >= 16 requerido' }));
  process.exit(2);
}

if (round !== 'all') {
  const evidence = await measureRound(round);
  const path = write(`${round}-http-v2.json`, evidence);
  // alias para comparador
  write(`${round}.json`, evidence);
  console.log(JSON.stringify({ ok: true, path, successful_rps: evidence.successful_rps, during: evidence.during }, null, 2));
  process.exit(0);
}

console.error(JSON.stringify({
  ok: false,
  error: 'all requiere reinicios de servidor por EXPERIMENT_ROUND; ejecute baseline, r0 y r1 por separado y luego compare-rounds',
}));
process.exit(2);
