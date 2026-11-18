#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidencias', 'exp4-samuel');

function readJson(p) {
  let t = readFileSync(p, 'utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return JSON.parse(t);
}

function sha256(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

function mttdSec(m) {
  const a = Date.parse(m.t_fallo_utc);
  const b = Date.parse(m.t_deteccion_utc);
  return Number(((b - a) / 1000).toFixed(3));
}

const r0 = readJson(join(root, 'r0/metrics.json'));
const r1 = readJson(join(root, 'r1/metrics.json'));

const checks = [];
function eq(name, a, b, tol = 0) {
  const ok = Math.abs(Number(a) - Number(b)) <= tol;
  checks.push({ name, ok, a, b });
}

eq('R0.rpo_ms', r0.rpo_observed_from_backup_age_ms, 3629);
eq('R1.rpo_ms', r1.rpo_observed_from_backup_age_ms, 2209);
eq('R0.rto_ms', r0.rto_observed_ms, 13056);
eq('R1.rto_ms', r1.rto_observed_ms, 1792);
eq('R0.mttd_s', mttdSec(r0), 0.3, 0.001);
eq('R1.mttd_s', mttdSec(r1), 0.109, 0.001);
eq('R0.commits_restored', r0.commits_restored, 10);
eq('R1.commits_restored', r1.commits_restored, 13);
eq('R0.commits_lost', r0.confirmed_commits_lost, 6);
eq('R1.commits_lost', r1.confirmed_commits_lost, 3);
eq('R0.commits_before', r0.commits_before_fault, 16);
eq('R1.commits_before', r1.commits_before_fault, 16);

const rpoRed = ((r0.rpo_observed_from_backup_age_ms - r1.rpo_observed_from_backup_age_ms) / r0.rpo_observed_from_backup_age_ms) * 100;
const rtoRed = ((r0.rto_observed_ms - r1.rto_observed_ms) / r0.rto_observed_ms) * 100;
const rpoRedRound = Number(rpoRed.toFixed(1));
const rtoRedRound = Number(rtoRed.toFixed(1));
checks.push({ name: 'RPO_reduction_pct_1decimal', ok: rpoRedRound === 39.1, a: rpoRedRound, b: 39.1 });
checks.push({ name: 'RTO_reduction_pct_1decimal', ok: rtoRedRound === 86.3, a: rtoRedRound, b: 86.3 });

function integrityPass(m) {
  const i = m.integrity || {};
  return !!(
    i.service_ok &&
    i.db_available &&
    i.functional_query_ok &&
    i.corruption_suspected === false &&
    i.commit_count === i.expected_commit_count_from_backup
  );
}

const extract = {
  sourceRepo: 'sgiraldor/hotel-fastify',
  sourceBranch: 'feat/defensa-profundidad-oci',
  sourceCommit: 'd5e72f6e4a5043008091fe80559f0f1952bcad43',
  packagePath: 'entrega-grupal/experimento-4-resiliencia-datos/',
  evidenceClass: 'public_sanitized_only',
  n: 1,
  methodology: {
    rpo_observed: 't_fallo - t_backup of restored backup (ms) — NOT the objective backup interval',
    rto_observed: 't_servicio_ok - t_fallo (ms); R0 includes manual operator wait',
    mttd: 't_deteccion - t_fallo from alerts (lab_event_observed)',
    integrity: 'post-restore functional checks; post-backup loss is RPO not corruption',
    note_decimal_comma:
      'Samuel docs use European decimal comma: 3,629 s = 3.629 s = 3629 ms (NOT 3629 seconds)',
  },
  R0: {
    run_id: r0.run_id,
    scenario: 'r0_manual_restore',
    rpo_observed_ms: r0.rpo_observed_from_backup_age_ms,
    rpo_observed_sec: r0.rpo_observed_from_backup_age_ms / 1000,
    rto_observed_ms: r0.rto_observed_ms,
    rto_observed_sec: r0.rto_observed_ms / 1000,
    mttd_sec: mttdSec(r0),
    commits_before_fault: r0.commits_before_fault,
    commits_restored: r0.commits_restored,
    confirmed_commits_lost: r0.confirmed_commits_lost,
    integrity_pass: integrityPass(r0),
    recovery_pass: !!r0.t_servicio_ok_utc,
    rpo_objective_backup_interval_sec: r0.rpo_objective_backup_interval_sec,
  },
  R1: {
    run_id: r1.run_id,
    scenario: 'r1_g1_extra_backup_g2_automated_restore',
    rpo_observed_ms: r1.rpo_observed_from_backup_age_ms,
    rpo_observed_sec: r1.rpo_observed_from_backup_age_ms / 1000,
    rto_observed_ms: r1.rto_observed_ms,
    rto_observed_sec: r1.rto_observed_ms / 1000,
    mttd_sec: mttdSec(r1),
    commits_before_fault: r1.commits_before_fault,
    commits_restored: r1.commits_restored,
    confirmed_commits_lost: r1.confirmed_commits_lost,
    integrity_pass: integrityPass(r1),
    recovery_pass: !!r1.t_servicio_ok_utc,
    rpo_objective_backup_interval_sec: r1.rpo_objective_backup_interval_sec,
  },
  improvements: {
    G1: 'Additional mid-point backup (same mysqldump+SHA256 mechanics)',
    G2: 'Automated restore + integrity + probe (eliminates manual wait in RTO)',
  },
  deltas: {
    rpo_reduction_pct: rpoRedRound,
    rto_reduction_pct: rtoRedRound,
    commits_lost_reduction_pct: Number(
      (((r0.confirmed_commits_lost - r1.confirmed_commits_lost) / r0.confirmed_commits_lost) * 100).toFixed(1),
    ),
    single_pair_only: true,
  },
  limitations: [
    'n=1 pair — not statistical guarantee',
    'Public sanitized evidences only; private originals not available',
    'Integrity PASS ≠ zero data loss (RPO commits lost remain)',
    'R0 RTO includes human wait; R1 does not',
  ],
};

writeFileSync(join(root, 'FINAL-EXTRACT.sanitized.json'), `${JSON.stringify(extract, null, 2)}\n`);

// Strip BOM from metrics copies for allowlist
for (const rel of ['r0/metrics.json', 'r1/metrics.json']) {
  let t = readFileSync(join(root, rel), 'utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  writeFileSync(join(root, rel), t.endsWith('\n') ? t : `${t}\n`);
}

const source = `# Fuente Exp.4 — Samuel (Hotel OCI)

| Campo | Valor |
|-------|--------|
| Repo | \`sgiraldor/hotel-fastify\` |
| Rama | \`feat/defensa-profundidad-oci\` |
| Commit | \`d5e72f6e4a5043008091fe80559f0f1952bcad43\` |
| Paquete | \`entrega-grupal/experimento-4-resiliencia-datos/\` |
| Clase | Evidencias **públicas sanitizadas** (sin dumps/SQL/claves) |
| Consulta UTC | ${new Date().toISOString()} |

## Hashes SHA256 (copia local)

| Archivo | SHA256 |
|---------|--------|
| r0/metrics.json | \`${sha256(join(root, 'r0/metrics.json'))}\` |
| r1/metrics.json | \`${sha256(join(root, 'r1/metrics.json'))}\` |
| RESULTADOS-OCI-20261118.md | \`${sha256(join(root, 'RESULTADOS-OCI-20261118.md'))}\` |
| docs/06-metricas-rpo-rto.md | \`${sha256(join(root, 'docs/06-metricas-rpo-rto.md'))}\` |

## Validación independiente

${checks.map((c) => `- ${c.ok ? 'OK' : 'FAIL'} \`${c.name}\` (a=${c.a}, b=${c.b})`).join('\n')}

**allMatch:** ${checks.every((c) => c.ok)}

## Nota de unidades

En docs de Samuel, la coma es **decimal** (ES): \`3,629 s\` = **3.629 s** = **3629 ms** del JSON. No interpretar como 3629 segundos.
`;
writeFileSync(join(root, 'SOURCE.md'), source);

console.log(JSON.stringify({ allMatch: checks.every((c) => c.ok), checks, extract: { R0: extract.R0, R1: extract.R1, deltas: extract.deltas } }, null, 2));
