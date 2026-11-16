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
  return { path, rps, raw };
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

  const hypothesis =
    pct !== null && pct > 0
      ? 'SOPORTADA_PARCIALMENTE: R1 mejoró throughput exitoso vs R0'
      : 'NO_CONFIRMADA_CON_ESTOS_DATOS';

  const report = {
    metric: 'successful_requests_per_second',
    r0: r0.rps,
    r1: r1.rps,
    absolute_diff: absolute,
    percent_change: pct,
    hypothesis,
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
