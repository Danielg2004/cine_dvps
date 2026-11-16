#!/usr/bin/env node
/**
 * Compara evidencias reales R0 vs R1.
 * No inventa valores: requiere archivos JSON de mediciones.
 *
 * Uso:
 *   node scripts/chaos/compare-rounds.mjs chaos/results/r0.json chaos/results/r1.json
 */

import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

function load(path) {
  const raw = JSON.parse(readFileSync(path, 'utf8'));
  const rps = raw?.during?.successful_rps ?? raw?.successful_rps;
  if (typeof rps !== 'number' || Number.isNaN(rps)) {
    throw new Error(`Archivo sin successful_rps medido: ${path}`);
  }
  const during = raw.during || {};
  const p95 =
    during?.latencies_ms?.success_p95 ??
    during?.latencies_ms?.p95 ??
    null;
  return {
    path,
    rps,
    p95,
    rejected: during?.rejected_429_503 ?? during?.rejected_503 ?? 0,
    successRate: during?.success_rate ?? null,
    raw,
  };
}

const r0Path = process.argv[2];
const r1Path = process.argv[3];

if (!r0Path || !r1Path) {
  console.error('Uso: node scripts/chaos/compare-rounds.mjs <r0.json> <r1.json>');
  process.exit(2);
}

try {
  const r0 = load(r0Path);
  const r1 = load(r1Path);
  const absolute = r1.rps - r0.rps;
  const pct = r0.rps === 0 ? null : (absolute / r0.rps) * 100;
  const rpsImproved = pct !== null && pct > 0;
  const p95Improved = r0.p95 !== null && r1.p95 !== null && r1.p95 < r0.p95;
  const controlledRejects = r1.rejected > 0;

  let hypothesis = 'NO_CONFIRMADA_CON_ESTOS_DATOS';
  if (rpsImproved && controlledRejects) {
    hypothesis = 'SOPORTADA: R1 mejoró RPS exitoso y convirtió sobrecarga en 503';
  } else if (p95Improved && controlledRejects) {
    hypothesis = 'SOPORTADA_PARCIALMENTE: R1 bajó p95 y rechazó sobrecarga con 503';
  } else if (controlledRejects) {
    hypothesis = 'SOPORTADA_PARCIALMENTE: R1 aplicó admission/bulkhead con 503';
  }

  const report = {
    metric_primary: 'successful_requests_per_second',
    metric_secondary: ['latency_p95_ms', 'rejected_429_503', 'success_rate'],
    r0: r0.rps,
    r1: r1.rps,
    absolute_diff: absolute,
    percent_change: pct,
    r0_p95_ms: r0.p95,
    r1_p95_ms: r1.p95,
    r0_rejected_429_503: r0.rejected,
    r1_rejected_429_503: r1.rejected,
    r0_success_rate: r0.successRate,
    r1_success_rate: r1.successRate,
    signals: { rpsImproved, p95Improved, controlledRejects },
    hypothesis,
    caution: '503/429 no son éxitos. Admission puede bajar RPS del load ofrecido.',
    sources: { r0: r0Path, r1: r1Path },
    generated_at: new Date().toISOString(),
  };

  console.log(JSON.stringify(report, null, 2));

  const out = process.env.COMPARE_OUT || 'chaos/results/comparison.json';
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(report, null, 2));
  process.exit(0);
} catch (error) {
  console.error(JSON.stringify({
    ok: false,
    error: error instanceof Error ? error.message : String(error),
  }));
  process.exit(1);
}
