#!/usr/bin/env node
/**
 * Ejecutor local del experimento de saturación (compatible con chaos gate).
 * Usa el interruptor HTTP propio. Reversión garantizada antes de salir.
 *
 * Exit codes:
 *  0 = OK
 *  1 = fallo de hipótesis / health
 *  2 = configuración inválida
 *  3 = error de ejecución
 */

const baseUrl = (process.env.CINE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const token = process.env.CHAOS_FAULT_TOKEN || '';
const peliculaId = process.env.CINE_PELICULA_ID || '1';
const holdMs = Number(process.env.CHAOS_HOLD_MS || 200);
const maxInflight = Number(process.env.CHAOS_MAX_INFLIGHT || 4);
const durationSec = Number(process.env.CHAOS_DURATION_SEC || 30);
const samples = Number(process.env.CHAOS_SAMPLES || 20);

if (!token || token.length < 16) {
  console.error(JSON.stringify({ ok: false, error: 'CHAOS_FAULT_TOKEN requerido (>=16 chars)' }));
  process.exit(2);
}

async function req(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      'content-type': 'application/json',
      'x-chaos-token': token,
      'x-trace-id': `chaos-runner-${Date.now()}`,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(10000),
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

async function measureThroughput() {
  const started = performance.now();
  let success = 0;
  let failed = 0;
  for (let i = 0; i < samples; i++) {
    try {
      const result = await req(`/api/v2/peliculas/${peliculaId}`, { method: 'GET' });
      if (result.status >= 200 && result.status < 400) success += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  const elapsedSec = (performance.now() - started) / 1000;
  return {
    samples,
    success,
    failed,
    elapsedSec,
    successful_rps: success / elapsedSec,
  };
}

async function rollback() {
  try {
    await req('/api/v3/__test/saturation/stop', { method: 'POST' });
    const after = await req('/healthz');
    return { ok: after.status === 200, healthz: after.status };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

const evidence = {
  experiment_id: 'cine-resource-exhaustion-concurrency-v1',
  round: process.env.EXPERIMENT_ROUND || 'unknown',
  baseUrl,
  started_at: new Date().toISOString(),
};

let exitCode = 0;

try {
  const health = await req('/healthz');
  if (health.status !== 200) {
    evidence.ok = false;
    evidence.error = 'healthz no disponible antes del experimento';
    exitCode = 1;
  } else {
    evidence.steady_state_healthz = health.status;

    const start = await req('/api/v3/__test/saturation/start', {
      method: 'POST',
      body: JSON.stringify({ holdMs, maxInflight, durationSec }),
    });
    if (start.status !== 202) {
      evidence.ok = false;
      evidence.error = `no se pudo activar saturacion: HTTP ${start.status}`;
      exitCode = 3;
    } else {
      evidence.saturation_start = start.body;
      evidence.during = await measureThroughput();
      evidence.hypothesis_check = {
        note: 'Comparación R0/R1 con scripts/chaos/compare-rounds.mjs sobre evidencias reales',
        measurement_ok: typeof evidence.during.successful_rps === 'number',
      };
      evidence.ok = evidence.hypothesis_check.measurement_ok;
      exitCode = evidence.ok ? 0 : 1;
    }
  }
} catch (error) {
  evidence.ok = false;
  evidence.error = error instanceof Error ? error.message : String(error);
  exitCode = 3;
}

evidence.rollback = await rollback();
evidence.finished_at = new Date().toISOString();

if (!evidence.rollback.ok) {
  exitCode = exitCode === 0 ? 3 : exitCode;
}

if (exitCode === 0) {
  console.log(JSON.stringify(evidence, null, 2));
} else {
  console.error(JSON.stringify(evidence, null, 2));
}

process.exit(exitCode);
