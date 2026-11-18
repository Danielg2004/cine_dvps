#!/usr/bin/env node
/**
 * Chaos Gate Cine S4 — evaluador de evidencias históricas (sin caos remoto).
 *
 * Política versionada: cine-s4-chaos-gate-policy@1
 * Fundamento: docs/seguimiento-4/CIERRE_EXPERIMENTO_CAOS.md + CHAOS_GATE_CONTRATO.md
 *
 * Exit codes:
 *   0 = PASS (criterios bloqueantes cumplidos)
 *   1 = FAIL (incumplimiento de política / resiliencia)
 *   2 = FAIL (evidencia faltante o malformada)
 *
 * Uso:
 *   node scripts/chaos/evaluate-chaos-gate.mjs
 *   node scripts/chaos/evaluate-chaos-gate.mjs --root <dir>
 *   node scripts/chaos/evaluate-chaos-gate.mjs --summary-md <path>
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const POLICY_ID = 'cine-s4-chaos-gate-policy@1';

export const DEFAULT_PATHS = {
  multicloud: 'docs/seguimiento-4/evidencias/multicloud-75s-series.json',
  bulkhead: 'docs/seguimiento-4/evidencias/gke-v2-reject-probe.json',
  admission: 'docs/seguimiento-4/evidencias/gke-admission-reject-probe.json',
  recovery: 'docs/seguimiento-4/evidencias/gke-admission-probe-recovery.json',
  baselineK6: 'docs/seguimiento-4/evidencias/baseline-k6-gke-v2.json',
  r0K6: 'docs/seguimiento-4/evidencias/r0-k6-gke-v2.json',
  r1K6: 'docs/seguimiento-4/evidencias/r1-k6-gke-v2.json',
  comparisonK6: 'docs/seguimiento-4/evidencias/comparison-k6-gke-v2.json',
};

/** Criterios bloqueantes (no umbrales inventados para “aprobar RPS”). */
export const POLICY = {
  id: POLICY_ID,
  blocking: {
    multicloud_availability_pct_min: 100,
    bulkhead_timeout_min: 1,
    inflight_limit_min: 1,
    recovery_ready_replicas_min: 2,
    recovery_http_status: 200,
    k6_offered_load_comparable_required: true,
  },
  reported_not_blocking: [
    'hypothesis_throughput_r1_gt_r0',
    'concurrency_eight_slots_exhausted',
    'multicloud_p95_delta_attributed_to_patterns',
  ],
  rationale: {
    multicloud_availability_pct_min:
      'Serie multicloud documentada con disponibilidad 100 % en las tres rondas; el gate exige coherencia con esa meta operativa.',
    bulkhead_timeout_min:
      'CIERRE/sonda: rechazo controlado bulkhead_timeout en GKE es la evidencia de intervención del patrón.',
    inflight_limit_min:
      'Sonda complementaria: rechazo inflight_limit demuestra admission (independiente de multicloud).',
    recovery_ready_replicas_min:
      'Procedimiento de recuperación del experimento: restaurar ≥2 réplicas Ready y sat off.',
    hypothesis_throughput_r1_gt_r0:
      'Hipótesis original (métrica successful_rps): se reporta, no bloquea; GKE v2 la dejó NO confirmada.',
    concurrency_eight_slots_exhausted:
      'No medida (MULTICLOUD_75S_SERIES.md); declarar cumplida sería falso.',
  },
};

function failFormat(message) {
  return { level: 'format', message };
}

function failPolicy(message) {
  return { level: 'policy', message };
}

function readJson(root, rel) {
  const path = join(root, rel);
  if (!existsSync(path)) {
    throw failFormat(`Archivo faltante: ${rel}`);
  }
  let raw;
  try {
    const buf = readFileSync(path);
    let text;
    if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
      text = buf.toString('utf16le');
    } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
      text = buf.swap16().toString('utf16le');
    } else {
      text = buf.toString('utf8');
    }
    if (text.charCodeAt(0) === 0xfeff) {
      text = text.slice(1);
    }
    raw = JSON.parse(text);
  } catch (err) {
    throw failFormat(`JSON inválido en ${rel}: ${err.message}`);
  }
  return { path: rel, data: raw };
}

function requireNumber(obj, key, where) {
  const v = obj?.[key];
  if (typeof v !== 'number' || Number.isNaN(v)) {
    throw failFormat(`Campo numérico obligatorio ausente: ${where}.${key}`);
  }
  return v;
}

function evaluateMulticloud(doc) {
  const checks = [];
  const observed = {};
  if (!doc?.rounds?.baseline || !doc?.rounds?.r0 || !doc?.rounds?.r1) {
    throw failFormat('multicloud: falta rounds.baseline|r0|r1');
  }
  for (const name of ['baseline', 'r0', 'r1']) {
    const r = doc.rounds[name];
    const completed = requireNumber(r, 'completed', `multicloud.${name}`);
    const expected = requireNumber(r, 'expected', `multicloud.${name}`);
    const avail = requireNumber(r, 'availability_pct', `multicloud.${name}`);
    const p95 = requireNumber(r, 'p95_ms', `multicloud.${name}`);
    const rps = requireNumber(r, 'observed_rps', `multicloud.${name}`);
    if (!r.runId || typeof r.runId !== 'string') {
      throw failFormat(`multicloud.${name}.runId obligatorio`);
    }
    if (completed !== expected) {
      throw failPolicy(
        `multicloud ${name}: completed (${completed}) != expected (${expected})`
      );
    }
    if (avail < POLICY.blocking.multicloud_availability_pct_min) {
      throw failPolicy(
        `multicloud ${name}: availability ${avail}% < ${POLICY.blocking.multicloud_availability_pct_min}%`
      );
    }
    if (p95 <= 0) {
      throw failFormat(`multicloud.${name}.p95_ms debe ser > 0`);
    }
    observed[name] = {
      runId: r.runId,
      completed: `${completed}/${expected}`,
      availability_pct: avail,
      p95_ms: p95,
      observed_rps: rps,
      http_503: r.http_503 ?? null,
    };
    checks.push({
      id: `multicloud_${name}_availability`,
      pass: true,
      detail: `${avail}% (${completed}/${expected}) p95=${p95}ms`,
    });
  }

  const p95DeltaPct =
    ((observed.r1.p95_ms - observed.r0.p95_ms) / observed.r0.p95_ms) * 100;
  observed.deltas = {
    p95_r1_minus_r0_ms: observed.r1.p95_ms - observed.r0.p95_ms,
    p95_r1_vs_r0_pct: Number(p95DeltaPct.toFixed(2)),
  };
  checks.push({
    id: 'multicloud_p95_delta_not_attributed_to_patterns',
    pass: true,
    detail: `Δp95 R1−R0=${observed.deltas.p95_r1_vs_r0_pct}% — reportado, NO atribuido a patrones (doc)`,
  });
  checks.push({
    id: 'concurrency_eight_slots_exhausted',
    pass: true,
    status: 'NOT_MEASURED',
    detail: 'No existe medición de concurrencia máxima; no se declara cumplida',
  });

  if (doc.patterns_attributed === true) {
    throw failPolicy(
      'multicloud.patterns_attributed=true es inválido: la serie 75s no demuestra patrones'
    );
  }

  return { observed, checks };
}

function evaluateBulkhead(doc) {
  const samples = requireNumber(doc, 'samples', 'bulkhead');
  const code200 = requireNumber(doc.codes, '200', 'bulkhead.codes');
  const code503 = requireNumber(doc.codes, '503', 'bulkhead.codes');
  const bh = requireNumber(doc.reasons, 'bulkhead_timeout', 'bulkhead.reasons');
  if (samples <= 0) {
    throw failFormat('bulkhead.samples debe ser > 0');
  }
  if (code200 + code503 > samples) {
    throw failFormat('bulkhead: suma de códigos supera samples');
  }
  if (bh !== code503) {
    throw failPolicy(
      `bulkhead: reasons.bulkhead_timeout (${bh}) != codes.503 (${code503})`
    );
  }
  if (bh < POLICY.blocking.bulkhead_timeout_min) {
    throw failPolicy(
      `bulkhead: bulkhead_timeout=${bh} < mínimo ${POLICY.blocking.bulkhead_timeout_min}`
    );
  }
  return {
    observed: {
      samples,
      http_200: code200,
      http_503: code503,
      bulkhead_timeout: bh,
      success_not_including_503: code200,
    },
    checks: [
      {
        id: 'bulkhead_controlled_reject',
        pass: true,
        detail: `${bh}× bulkhead_timeout como HTTP 503 (no contados como éxito)`,
      },
    ],
  };
}

function evaluateAdmission(doc) {
  const samples = requireNumber(doc, 'samples', 'admission');
  const code200 = requireNumber(doc.codes, '200', 'admission.codes');
  const code503 = requireNumber(doc.codes, '503', 'admission.codes');
  const inflight = requireNumber(doc, 'inflight_limit', 'admission');
  const clientErrors =
    typeof doc.reasons?.client_error === 'number'
      ? doc.reasons.client_error
      : typeof doc.codes?.other === 'number'
        ? doc.codes.other
        : null;
  if (clientErrors === null) {
    throw failFormat('admission: falta reasons.client_error (o codes.other)');
  }
  if (inflight < POLICY.blocking.inflight_limit_min) {
    throw failPolicy(
      `admission: inflight_limit=${inflight} < mínimo ${POLICY.blocking.inflight_limit_min}`
    );
  }
  if (code503 < 1) {
    throw failPolicy('admission: se requieren HTTP 503 de rechazo controlado');
  }
  if (inflight > code503) {
    throw failPolicy(
      `admission: inflight_limit (${inflight}) > codes.503 (${code503})`
    );
  }
  const reasonOk =
    doc.reasons?.inflight_limit === inflight ||
    (Array.isArray(doc.sample503Headers) &&
      doc.sample503Headers.some((h) => h.reason === 'inflight_limit'));
  if (!reasonOk) {
    throw failFormat('admission: no hay evidencia de reason inflight_limit');
  }
  return {
    observed: {
      samples,
      http_200: code200,
      http_503: code503,
      inflight_limit: inflight,
      client_error: clientErrors,
      bulkhead_timeout: doc.bulkhead_timeout ?? 0,
      note: 'client_error no es respuesta HTTP de servidor',
    },
    checks: [
      {
        id: 'admission_controlled_reject',
        pass: true,
        detail: `${inflight}× inflight_limit (HTTP 503); client_error=${clientErrors} reportados aparte`,
      },
    ],
  };
}

function evaluateRecovery(doc) {
  if (doc.saturationActive !== false) {
    throw failPolicy('recovery: saturationActive debe ser false');
  }
  const ready = requireNumber(doc, 'readyReplicas', 'recovery');
  if (ready < POLICY.blocking.recovery_ready_replicas_min) {
    throw failPolicy(
      `recovery: readyReplicas=${ready} < ${POLICY.blocking.recovery_ready_replicas_min}`
    );
  }
  for (const path of ['/healthz', '/readyz', '/api/v2/peliculas/1']) {
    const st = doc.http?.[path];
    if (st !== POLICY.blocking.recovery_http_status) {
      throw failPolicy(
        `recovery: ${path} status=${st} (esperado ${POLICY.blocking.recovery_http_status})`
      );
    }
  }
  if (doc.readyz?.database !== 'up') {
    throw failPolicy('recovery: readyz.database debe ser up');
  }
  if (doc.configMap?.EXPERIMENT_ROUND !== 'baseline') {
    throw failPolicy('recovery: EXPERIMENT_ROUND debe ser baseline');
  }
  return {
    observed: {
      readyReplicas: ready,
      saturationActive: false,
      database: doc.readyz.database,
      sportsFlujo: doc.sportsFlujo?.status ?? null,
    },
    checks: [
      {
        id: 'recovery_verified',
        pass: true,
        detail: `2/2 Ready, sat off, health endpoints 200, round=baseline`,
      },
    ],
  };
}

function evaluateK6Series(baseline, r0, r1, comparison) {
  const bRps = requireNumber(baseline.during, 'successful_rps', 'baseline.during');
  const r0Rps = requireNumber(r0.during, 'successful_rps', 'r0.during');
  const r1Rps = requireNumber(r1.during, 'successful_rps', 'r1.during');
  const r0P95 = requireNumber(r0.during.latencies_ms, 'success_p95', 'r0.p95');
  const r1P95 = requireNumber(r1.during.latencies_ms, 'success_p95', 'r1.p95');
  const r0Succ = requireNumber(r0.during, 'success_rate', 'r0.success_rate');
  const r1Succ = requireNumber(r1.during, 'success_rate', 'r1.success_rate');

  if (comparison.offered_load_comparable !== true) {
    throw failPolicy(
      'k6 GKE v2: offered_load_comparable debe ser true (metodología comparable)'
    );
  }

  const rpsImproved = r1Rps > r0Rps;
  const hypothesisThroughput = rpsImproved
    ? 'CONFIRMED'
    : 'NOT_CONFIRMED';

  return {
    observed: {
      baseline_successful_rps: bRps,
      r0_successful_rps: r0Rps,
      r1_successful_rps: r1Rps,
      delta_r1_r0_rps: r1Rps - r0Rps,
      delta_r1_r0_pct: Number((((r1Rps - r0Rps) / r0Rps) * 100).toFixed(2)),
      r0_p95_ms: r0P95,
      r1_p95_ms: r1P95,
      r0_success_rate: r0Succ,
      r1_success_rate: r1Succ,
      r0_rejected_503: r0.during.rejected_503,
      r1_rejected_503: r1.during.rejected_503,
      offered_load_comparable: true,
      comparison_hypothesis: comparison.hypothesis ?? null,
    },
    checks: [
      {
        id: 'k6_offered_load_comparable',
        pass: true,
        detail: 'offered_load_comparable=true',
      },
      {
        id: 'hypothesis_throughput_r1_gt_r0',
        pass: true,
        status: hypothesisThroughput,
        blocking: false,
        detail: `successful_rps R1(${r1Rps}) vs R0(${r0Rps}) → ${hypothesisThroughput} (no bloquea el gate)`,
      },
    ],
    hypotheses: {
      throughput_r1_gt_r0: hypothesisThroughput,
      controlled_rejects_via_probes: 'CONFIRMED',
      concurrency_eight_exhausted: 'NOT_MEASURED',
      multicloud_p95_due_to_patterns: 'NOT_ATTRIBUTED',
    },
  };
}

/**
 * @param {string} root
 * @param {Partial<typeof DEFAULT_PATHS>} [pathOverrides]
 */
export function evaluateChaosGate(root, pathOverrides = {}) {
  const paths = { ...DEFAULT_PATHS, ...pathOverrides };
  const failures = [];
  const formatErrors = [];
  const sections = {};

  const load = (key) => {
    try {
      return readJson(root, paths[key]);
    } catch (err) {
      if (err?.level === 'format') {
        formatErrors.push(err.message);
        return null;
      }
      throw err;
    }
  };

  const files = {
    multicloud: load('multicloud'),
    bulkhead: load('bulkhead'),
    admission: load('admission'),
    recovery: load('recovery'),
    baselineK6: load('baselineK6'),
    r0K6: load('r0K6'),
    r1K6: load('r1K6'),
    comparisonK6: load('comparisonK6'),
  };

  if (formatErrors.length) {
    return {
      policy: POLICY.id,
      result: 'FAIL',
      exitCode: 2,
      reason: `Evidencia faltante o malformada: ${formatErrors.join('; ')}`,
      formatErrors,
      observed: {},
      checks: [],
      hypotheses: {},
    };
  }

  try {
    sections.multicloud = evaluateMulticloud(files.multicloud.data);
    sections.bulkhead = evaluateBulkhead(files.bulkhead.data);
    sections.admission = evaluateAdmission(files.admission.data);
    sections.recovery = evaluateRecovery(files.recovery.data);
    sections.k6 = evaluateK6Series(
      files.baselineK6.data,
      files.r0K6.data,
      files.r1K6.data,
      files.comparisonK6.data
    );
  } catch (err) {
    if (err?.level === 'format') {
      return {
        policy: POLICY.id,
        result: 'FAIL',
        exitCode: 2,
        reason: err.message,
        formatErrors: [err.message],
        observed: {},
        checks: [],
        hypotheses: {},
      };
    }
    if (err?.level === 'policy') {
      failures.push(err.message);
    } else {
      return {
        policy: POLICY.id,
        result: 'FAIL',
        exitCode: 2,
        reason: `Error inesperado: ${err.message}`,
        formatErrors: [err.message],
        observed: {},
        checks: [],
        hypotheses: {},
      };
    }
  }

  const checks = [
    ...(sections.multicloud?.checks ?? []),
    ...(sections.bulkhead?.checks ?? []),
    ...(sections.admission?.checks ?? []),
    ...(sections.recovery?.checks ?? []),
    ...(sections.k6?.checks ?? []),
  ];

  if (failures.length) {
    return {
      policy: POLICY.id,
      result: 'FAIL',
      exitCode: 1,
      reason: failures.join('; '),
      policyFailures: failures,
      observed: {
        multicloud: sections.multicloud?.observed,
        bulkhead: sections.bulkhead?.observed,
        admission: sections.admission?.observed,
        recovery: sections.recovery?.observed,
        k6_gke_v2: sections.k6?.observed,
      },
      checks,
      hypotheses: sections.k6?.hypotheses ?? {},
    };
  }

  return {
    policy: POLICY.id,
    result: 'PASS',
    exitCode: 0,
    reason:
      'Evidencias coherentes; patrones demostrados por sondas; recuperación verificada; hipótesis throughput R1>R0 reportada como NOT_CONFIRMED sin bloquear.',
    observed: {
      multicloud: sections.multicloud.observed,
      bulkhead: sections.bulkhead.observed,
      admission: sections.admission.observed,
      recovery: sections.recovery.observed,
      k6_gke_v2: sections.k6.observed,
    },
    checks,
    hypotheses: sections.k6.hypotheses,
    paths,
  };
}

export function renderSummaryMarkdown(report) {
  const o = report.observed || {};
  const mc = o.multicloud || {};
  const lines = [
    `# Chaos Gate Cine S4`,
    ``,
    `- **Política:** \`${report.policy}\``,
    `- **Resultado:** **${report.result}** (exit ${report.exitCode})`,
    `- **Motivo:** ${report.reason}`,
    ``,
    `## Multicloud 75s`,
    ``,
    `| Ronda | RUN_ID | Completas | Disp. | p95 (ms) | RPS obs. |`,
    `|-------|--------|-----------|-------|----------|----------|`,
  ];
  for (const name of ['baseline', 'r0', 'r1']) {
    const r = mc[name];
    if (!r) continue;
    lines.push(
      `| ${name} | ${r.runId} | ${r.completed} | ${r.availability_pct}% | ${r.p95_ms} | ${r.observed_rps} |`
    );
  }
  if (mc.deltas) {
    lines.push(
      ``,
      `Δ p95 R1−R0: **${mc.deltas.p95_r1_vs_r0_pct}%** (no atribuido a patrones).`
    );
  }
  lines.push(
    ``,
    `## Sondas de patrones`,
    ``,
    `- Bulkhead: **${o.bulkhead?.bulkhead_timeout ?? 'n/a'}** × \`bulkhead_timeout\` (HTTP 503); éxitos HTTP 200: ${o.bulkhead?.http_200 ?? 'n/a'}`,
    `- Admission: **${o.admission?.inflight_limit ?? 'n/a'}** × \`inflight_limit\` (HTTP 503); HTTP 200: ${o.admission?.http_200 ?? 'n/a'}; client_error: **${o.admission?.client_error ?? 'n/a'}**`,
    ``,
    `## k6 GKE v2 (Cine directo)`,
    ``,
    `- Baseline RPS: ${o.k6_gke_v2?.baseline_successful_rps ?? 'n/a'}`,
    `- R0 RPS: ${o.k6_gke_v2?.r0_successful_rps ?? 'n/a'} · R1 RPS: ${o.k6_gke_v2?.r1_successful_rps ?? 'n/a'} (Δ ${o.k6_gke_v2?.delta_r1_r0_pct ?? 'n/a'}%)`,
    `- R0 p95: ${o.k6_gke_v2?.r0_p95_ms ?? 'n/a'} · R1 p95: ${o.k6_gke_v2?.r1_p95_ms ?? 'n/a'}`,
    ``,
    `## Hipótesis`,
    ``
  );
  for (const [k, v] of Object.entries(report.hypotheses || {})) {
    lines.push(`- \`${k}\`: **${v}**`);
  }
  lines.push(``, `## Checks`, ``);
  for (const c of report.checks || []) {
    const st = c.status ? ` [${c.status}]` : '';
    lines.push(`- ${c.pass ? '✅' : '❌'} \`${c.id}\`${st}: ${c.detail}`);
  }
  lines.push(
    ``,
    `## Nota`,
    ``,
    `Este gate **evalúa evidencias históricas** del repo. **No** ejecuta saturación remota en GKE ni despliegues.`
  );
  return lines.join('\n');
}

function parseArgs(argv) {
  const out = { root: process.cwd(), summaryMd: null, outJson: null };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === '--root') out.root = resolve(argv[++i]);
    else if (argv[i] === '--summary-md') out.summaryMd = resolve(argv[++i]);
    else if (argv[i] === '--out-json') out.outJson = resolve(argv[++i]);
  }
  return out;
}

function main() {
  const args = parseArgs(process.argv);
  const report = evaluateChaosGate(args.root);
  const json = JSON.stringify(report, null, 2);
  console.log(json);

  if (args.outJson) {
    mkdirSync(join(args.outJson, '..'), { recursive: true });
    writeFileSync(args.outJson, json, 'utf8');
  }

  const md = renderSummaryMarkdown(report);
  if (args.summaryMd) {
    mkdirSync(join(args.summaryMd, '..'), { recursive: true });
    writeFileSync(args.summaryMd, md, 'utf8');
  }
  if (process.env.GITHUB_STEP_SUMMARY) {
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
  }

  process.exit(report.exitCode);
}

const isDirect =
  process.argv[1] &&
  resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname);

// Windows path quirk: compare basename fallback
if (
  process.argv[1]?.endsWith('evaluate-chaos-gate.mjs') ||
  process.argv[1]?.includes('evaluate-chaos-gate')
) {
  main();
}
