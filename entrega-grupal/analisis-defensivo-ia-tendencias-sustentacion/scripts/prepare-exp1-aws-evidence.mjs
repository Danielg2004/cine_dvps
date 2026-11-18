#!/usr/bin/env node
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'evidencias', 'exp1-aws-jarrison');

function readJson(p) {
  let t = readFileSync(p, 'utf8');
  if (t.charCodeAt(0) === 0xfeff) t = t.slice(1);
  return JSON.parse(t);
}

function sha256(p) {
  return createHash('sha256').update(readFileSync(p)).digest('hex');
}

function sanitize(obj) {
  const s = JSON.stringify(obj);
  const cleaned = s
    .replace(/eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g, '[REDACTED_JWT]')
    .replace(/"token"\s*:\s*"[^"]+"/gi, '"token":"[REDACTED]"')
    .replace(/"authorization"\s*:\s*"[^"]+"/gi, '"authorization":"[REDACTED]"')
    .replace(/"signingSecret[^"]*"\s*:\s*"[^"]+"/gi, '"signingSecret":"[REDACTED]"');
  return JSON.parse(cleaned);
}

const min = readJson(join(root, 'extractos/honeytoken-aws.min.json'));
const r0 = readJson(join(root, 'fuentes-aws/r0.json'));
const r1 = readJson(join(root, 'fuentes-aws/r1.json'));
const cmp = readJson(join(root, 'fuentes-aws/comparison-r0-r1.json'));

function honey(j) {
  return j.honeytoken || null;
}

const checks = [];
function eq(name, a, b) {
  checks.push({ name, ok: JSON.stringify(a) === JSON.stringify(b), a, b });
}
eq('R1.honeytoken.httpStatus', min.R1?.honeytoken?.httpStatus, honey(r1)?.httpStatus);
eq('R1.honeytoken.allowed', min.R1?.honeytoken?.allowed, honey(r1)?.allowed);
eq('R1.honeytoken.eventType', min.R1?.honeytoken?.eventType, honey(r1)?.eventType);
eq('R1.startedAt', min.R1?.startedAt, r1.startedAt);
eq('R1.endedAt', min.R1?.endedAt, r1.endedAt);
eq('R1.mode', min.R1?.mode, r1.mode);
eq('R0.honeytoken.httpStatus', min.R0?.honeytoken?.httpStatus, honey(r0)?.httpStatus);
eq('R0.honeytoken.allowed', min.R0?.honeytoken?.allowed, honey(r0)?.allowed);
eq('R0.honeytoken.eventType', min.R0?.honeytoken?.eventType, honey(r0)?.eventType);

writeFileSync(join(root, 'extractos/honeytoken-aws.min.json'), `${JSON.stringify(min, null, 2)}\n`);

const r0s = sanitize(r0);
const r1s = sanitize(r1);
const cmps = sanitize(cmp);
writeFileSync(join(root, 'fuentes-aws/r0.sanitized.json'), `${JSON.stringify(r0s, null, 2)}\n`);
writeFileSync(join(root, 'fuentes-aws/r1.sanitized.json'), `${JSON.stringify(r1s, null, 2)}\n`);
writeFileSync(join(root, 'fuentes-aws/comparison-r0-r1.sanitized.json'), `${JSON.stringify(cmps, null, 2)}\n`);

const extract = {
  sourceRepo: 'JarrisonLopez/defensa-profundidad-caos-2026',
  sourceCommit: '1cad076ffed34e70774c3a7dceba941b83660da7',
  scope: 'AWS lab aislado ClusterIP+tunel (no produccion, no SIEM)',
  sportsCommit: min.sportsCommit,
  branch: min.branch,
  distinction: {
    identity_honeytoken_use: min.contraste?.identity_honeytoken_use,
    identity_reuse_detected: min.contraste?.identity_reuse_detected,
  },
  honeytoken: {
    R0: min.R0,
    R1: min.R1,
    note: min.R1?.nota || null,
  },
  identityExperimentMetrics: {
    R0: {
      mode: r0.mode,
      mttdMs: r0.mttdMs,
      mttcMs: r0.mttcMs,
      detectionCoverage: r0.detectionCoverage,
      falsePositives: r0.falsePositives,
      reuseAllowed: r0.reuseAllowed,
      reuseDenied: r0.reuseDenied,
      detections: r0.detections,
      containmentVerified: r0.containmentVerified ?? null,
    },
    R1: {
      mode: r1.mode,
      mttdMs: r1.mttdMs,
      mttcMs: r1.mttcMs,
      detectionCoverage: r1.detectionCoverage,
      falsePositives: r1.falsePositives,
      reuseAllowed: r1.reuseAllowed,
      reuseDenied: r1.reuseDenied,
      detections: r1.detections,
      containmentVerified: r1.containmentVerified ?? null,
    },
  },
  comparison: cmps,
  limitations: [
    'No SIEM/CloudWatch alert asserted in package',
    'No individual honeytoken invoke timestamp/traceId persisted in events[]',
    'Do not treat identity-round MTTD as honeytoken-specific latency',
  ],
};
writeFileSync(join(root, 'FINAL-EXTRACT.sanitized.json'), `${JSON.stringify(extract, null, 2)}\n`);

const sourceMd = `# Fuente Exp.1 AWS (Jarrison) — consulta lectura

- **Repo:** \`JarrisonLopez/defensa-profundidad-caos-2026\`
- **Commit:** \`1cad076ffed34e70774c3a7dceba941b83660da7\`
- **Cuenta:** Danielg2004 (solo lectura / sin escritura en este paso)
- **Consultado UTC:** ${new Date().toISOString()}

## Archivos (SHA256 del contenido local tras descarga)

| Remoto | Local | SHA256 |
|--------|-------|--------|
| docs/EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md | EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md | \`${sha256(join(root, 'EVIDENCIAS_HONEYTOKEN_PARA_DANIEL.md'))}\` |
| .../extractos/honeytoken-aws.min.json | extractos/honeytoken-aws.min.json | \`${sha256(join(root, 'extractos/honeytoken-aws.min.json'))}\` |
| .../fuentes-aws/r0.json | fuentes-aws/r0.json | \`${sha256(join(root, 'fuentes-aws/r0.json'))}\` |
| .../fuentes-aws/r1.json | fuentes-aws/r1.json | \`${sha256(join(root, 'fuentes-aws/r1.json'))}\` |
| .../fuentes-aws/comparison-r0-r1.json | fuentes-aws/comparison-r0-r1.json | \`${sha256(join(root, 'fuentes-aws/comparison-r0-r1.json'))}\` |

## Contraste min ↔ r1/r0

${checks.map((c) => `- ${c.ok ? 'OK' : 'FAIL'} \`${c.name}\``).join('\n')}

**allMatch:** ${checks.every((c) => c.ok)}

## Sanitización

- \`FINAL-EXTRACT.sanitized.json\` y \`*.sanitized.json\` son la entrada allowlisted del LLM.
- JWT/token strings redactados como \`[REDACTED]\`.
`;
writeFileSync(join(root, 'SOURCE.md'), sourceMd);

console.log(
  JSON.stringify(
    {
      allMatch: checks.every((c) => c.ok),
      checks,
      r1Honey: honey(r1),
      r0Honey: honey(r0),
      metricsR1: extract.identityExperimentMetrics.R1,
      metricsR0: extract.identityExperimentMetrics.R0,
      cmp: cmps,
    },
    null,
    2,
  ),
);
