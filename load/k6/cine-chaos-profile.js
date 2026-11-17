/**
 * Perfil k6 versionado — Seguimiento #4 / API Cine
 * Ejecutor open-loop: constant-arrival-rate
 *
 * Compatible con coordinación posterior de Jarrison (mismo estilo de rate/duration).
 *
 * Variables de entorno (script; NO usar K6_DURATION/K6_VUS — anulan scenarios):
 *   CINE_BASE_URL, CINE_PELICULA_ID, CINE_ARRIVAL_RATE, CINE_DURATION,
 *   CINE_PRE_VUS, CINE_MAX_VUS, CINE_TIME_UNIT, EXPERIMENT_ROUND, X_TRACE_PREFIX
 */
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate, Trend } from 'k6/metrics';

const BASE_URL = (__ENV.CINE_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const PELICULA_ID = __ENV.CINE_PELICULA_ID || '1';
const RATE = Number(__ENV.CINE_ARRIVAL_RATE || __ENV.K6_RATE || 80);
const DURATION = __ENV.CINE_DURATION || '30s';
const TIME_UNIT = __ENV.CINE_TIME_UNIT || '1s';
const PRE_VUS = Number(__ENV.CINE_PRE_VUS || 40);
const MAX_VUS = Number(__ENV.CINE_MAX_VUS || 120);
const ROUND = __ENV.EXPERIMENT_ROUND || 'unknown';
const TRACE_PREFIX = __ENV.X_TRACE_PREFIX || 'k6-cine';

const successful = new Counter('cine_successful_requests');
const rejected503 = new Counter('cine_rejected_503');
const rejected429 = new Counter('cine_rejected_429');
const failedOther = new Counter('cine_failed_other');
const successRate = new Rate('cine_success_rate');
const successLatency = new Trend('cine_success_latency_ms', true);

export const options = {
  scenarios: {
    cine_fixed_arrival: {
      executor: 'constant-arrival-rate',
      rate: RATE,
      timeUnit: TIME_UNIT,
      duration: DURATION,
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
    },
  },
  thresholds: {
    // Umbrales informativos; no se usan para declarar victoria R1
    http_req_failed: ['rate<1'],
  },
  summaryTrendStats: ['avg', 'p(95)', 'p(99)', 'max'],
  tags: {
    experiment_round: ROUND,
    profile: 'cine-chaos-v3',
  },
};

export function setup() {
  const health = http.get(`${BASE_URL}/healthz`);
  if (health.status !== 200) {
    throw new Error(`healthz no disponible: HTTP ${health.status}`);
  }
  return {
    baseUrl: BASE_URL,
    peliculaId: PELICULA_ID,
    rate: RATE,
    duration: DURATION,
    round: ROUND,
    offered_target: RATE * parseDurationSeconds(DURATION),
  };
}

function parseDurationSeconds(raw) {
  const m = /^(\d+)(s|m|h)?$/.exec(String(raw).trim());
  if (!m) return 30;
  const n = Number(m[1]);
  const u = m[2] || 's';
  if (u === 'm') return n * 60;
  if (u === 'h') return n * 3600;
  return n;
}

export default function () {
  const traceId = `${TRACE_PREFIX}-${ROUND}-${__ITER}-${__VU}`;
  const res = http.get(`${BASE_URL}/api/v2/peliculas/${PELICULA_ID}`, {
    headers: {
      Accept: 'application/json',
      'x-trace-id': traceId,
      traceparent: '00-aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa-bbbbbbbbbbbbbbbb-01',
    },
    tags: { endpoint: 'peliculas_id', round: ROUND },
    timeout: '15s',
  });

  const ok = res.status >= 200 && res.status < 400;
  successRate.add(ok);

  if (ok) {
    successful.add(1);
    successLatency.add(res.timings.duration);
  } else if (res.status === 503) {
    rejected503.add(1);
  } else if (res.status === 429) {
    rejected429.add(1);
  } else {
    failedOther.add(1);
  }

  check(res, {
    'status is 200 or 503/429 under fault': (r) =>
      (r.status >= 200 && r.status < 400) || r.status === 503 || r.status === 429,
  });
}

export function handleSummary(data) {
  const root = __ENV.K6_RESULTS_DIR || 'chaos/results';
  const round = ROUND;
  const httpReqs = data.metrics.http_reqs?.values?.count || 0;
  const dropped = data.metrics.dropped_iterations?.values?.count || 0;
  const succ = data.metrics.cine_successful_requests?.values?.count || 0;
  const r503 = data.metrics.cine_rejected_503?.values?.count || 0;
  const r429 = data.metrics.cine_rejected_429?.values?.count || 0;
  const other = data.metrics.cine_failed_other?.values?.count || 0;
  const durationSec = parseDurationSeconds(DURATION);
  const successP95 = data.metrics.cine_success_latency_ms?.values?.['p(95)'] || null;

  const evidence = {
    ok: true,
    experiment_id: 'cine-resource-exhaustion-concurrency-v1',
    series: 'v3-k6-constant-arrival-rate',
    round,
    generator: 'k6',
    profile: {
      rate: RATE,
      timeUnit: TIME_UNIT,
      duration: DURATION,
      duration_sec: durationSec,
      preAllocatedVUs: PRE_VUS,
      maxVUs: MAX_VUS,
      endpoint: `GET /api/v2/peliculas/${PELICULA_ID}`,
      baseUrl: BASE_URL,
    },
    offered: {
      target_iterations: RATE * durationSec,
      http_reqs: httpReqs,
      dropped_iterations: dropped,
      note: 'dropped_iterations son del scheduler k6, NO respuestas HTTP de la API',
    },
    during: {
      samples: httpReqs,
      success: succ,
      failed: httpReqs - succ,
      rejected_503: r503,
      rejected_429: r429,
      rejected_429_503: r503 + r429,
      failed_other_4xx_5xx: other,
      success_rate: httpReqs ? Number((succ / httpReqs).toFixed(4)) : 0,
      successful_rps: Number((succ / durationSec).toFixed(4)),
      offered_rps: Number((httpReqs / durationSec).toFixed(4)),
      latencies_ms: {
        success_p95: successP95 !== null ? Number(Number(successP95).toFixed(2)) : null,
      },
      measurement: 'k6_constant_arrival_rate',
      window_sec: durationSec,
      with_fault: round !== 'baseline',
    },
    successful_rps: Number((succ / durationSec).toFixed(4)),
    k6_raw_metrics: {
      http_req_duration_p95: data.metrics.http_req_duration?.values?.['p(95)'] ?? null,
      iterations: data.metrics.iterations?.values?.count ?? null,
    },
    finished_at: new Date().toISOString(),
  };

  const path = `${root}/${round}-k6-v3.json`;
  return {
    stdout: JSON.stringify({
      ok: true,
      round,
      successful_rps: evidence.successful_rps,
      offered_http_reqs: httpReqs,
      dropped_iterations: dropped,
      success_rate: evidence.during.success_rate,
      rejected_503: r503,
      path,
    }, null, 2) + '\n',
    [`${path}`]: JSON.stringify(evidence, null, 2),
    [`${root}/${round}.json`]: JSON.stringify(evidence, null, 2),
  };
}

// Evitar warning de import no usado en algunos linters locales
export function teardown() {
  sleep(0.001);
}
