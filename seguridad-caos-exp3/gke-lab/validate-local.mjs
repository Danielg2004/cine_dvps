#!/usr/bin/env node
/**
 * Validación LOCAL de manifiestos del lab (sin aplicar al clúster).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const baseDir = join(root, 'base');
const docSkip = new Set([
  'DEPRECATED-cine-caos-overlays.md',
  'ISOLATION_CHECKS.md',
  'README.md',
  'EXPERIMENT_RUNBOOK.md',
  'REVERSION.md',
  'validate-local.mjs',
]);

const forbiddenInManifests = [
  { re: /namespace:\s*cine-caos\b/, name: 'namespace cine-caos' },
  { re: /name:\s*cine-api-config\b/, name: 'cine-api-config' },
  { re: /cine-gke-sa@/, name: 'cine-gke-sa' },
  { re: /cine-mysql-v4/, name: 'cine-mysql-v4' },
  { re: /35\.239\.107\.54/, name: 'devops LB IP' },
  { re: /157\.137\.233\.183/, name: 'OCI collector IP' },
  { re: /type:\s*LoadBalancer\b/, name: 'LoadBalancer' },
  { re: /iam\.gke\.io\/gcp-service-account/, name: 'WI annotation' },
];

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) {
      if (name === 'node_modules') continue;
      walk(p, out);
    } else if (/\.(ya?ml)$/i.test(name)) out.push(p);
  }
  return out;
}

const errors = [];

for (const file of walk(join(root, 'base')).concat(walk(join(root, 'overlays')))) {
  const text = readFileSync(file, 'utf8');
  if (/DEPRECATED-DO-NOT-APPLY/.test(text)) continue;
  for (const { re, name } of forbiddenInManifests) {
    if (re.test(text)) errors.push(`${file}: forbidden ${name}`);
  }
}

// Legacy overlay files at root must not be referenced by active kustomizations
for (const legacy of ['configmap-otel-inject.overlay.yaml', 'configmap-otel-baseline.overlay.yaml']) {
  const text = readFileSync(join(root, legacy), 'utf8');
  if (!/DEPRECATED/.test(text)) errors.push(`${legacy}: missing DEPRECATED marker`);
}

function kustomize(path) {
  const r = spawnSync('kubectl', ['kustomize', path], { encoding: 'utf8' });
  if (r.status !== 0) {
    errors.push(`kustomize ${path}: ${r.stderr || r.stdout}`);
    return '';
  }
  return r.stdout;
}

const rendered = {
  root: kustomize(root),
  base: kustomize(baseDir),
  total: kustomize(join(root, 'overlays/inject-total')),
  partial: kustomize(join(root, 'overlays/inject-partial')),
  contain: kustomize(join(root, 'overlays/contain')),
  restore: kustomize(join(root, 'overlays/restore')),
};

for (const [name, yaml] of Object.entries(rendered)) {
  if (!yaml) continue;
  if (!/cine-seguridad-exp3/.test(yaml)) errors.push(`${name}: missing namespace cine-seguridad-exp3`);
  if (/\bnamespace:\s*cine-caos\b/.test(yaml)) errors.push(`${name}: rendered cine-caos`);
  if (/type:\s*LoadBalancer/.test(yaml)) errors.push(`${name}: LoadBalancer rendered`);
  if (/cine-gke-sa@/.test(yaml)) errors.push(`${name}: DevOps WI SA rendered`);
  if (/157\.137\.233\.183/.test(yaml)) errors.push(`${name}: OCI endpoint rendered`);
  if (!/ClusterIP/.test(yaml)) errors.push(`${name}: expected ClusterIP service`);
}

if (!/TELEMETRY_EMIT_ENABLED:\s*"false"/.test(rendered.total)
  && !/TELEMETRY_EMIT_ENABLED:\s*false/.test(rendered.total)) {
  errors.push('inject-total: expected TELEMETRY_EMIT_ENABLED false');
}
if (!rendered.partial.includes('inject-partial')) {
  errors.push('inject-partial: expected partial round marker');
}
if (!/TELEMETRY_EMIT_ENABLED:\s*"true"/.test(rendered.restore)
  && !/TELEMETRY_EMIT_ENABLED:\s*true/.test(rendered.restore)) {
  errors.push('restore: expected TELEMETRY_EMIT_ENABLED true');
}
if (!/CONTAINMENT_ACTIVE:\s*"true"/.test(rendered.contain)
  && !/CONTAINMENT_ACTIVE:\s*true/.test(rendered.contain)) {
  errors.push('contain: expected CONTAINMENT_ACTIVE true');
}
if (!/CONTAINMENT_ACTIVE:\s*"false"/.test(rendered.restore)
  && !/CONTAINMENT_ACTIVE:\s*false/.test(rendered.restore)) {
  errors.push('restore: expected CONTAINMENT_ACTIVE false');
}

// Inyección estable: emitter-b debe montar /emit-flags y EMIT_FLAGS_DIR (sin env CM keyRef restart)
if (!/mountPath:\s*\/emit-flags/.test(rendered.base) && !/mountPath:\s*"\/emit-flags"/.test(rendered.base)) {
  errors.push('base: emitter-b missing /emit-flags volumeMount');
}
if (!/EMIT_FLAGS_DIR/.test(rendered.base)) {
  errors.push('base: missing EMIT_FLAGS_DIR env for volume-based inject');
}
if (!/name:\s*emit-flags/.test(rendered.partial) && !/name: emit-flags/.test(rendered.base)) {
  errors.push('base/partial: missing emit-flags volume');
}
if (/valueFrom:[\s\S]*cine-exp3-emitter-b-flags[\s\S]*TELEMETRY_EMIT_ENABLED/.test(rendered.base)) {
  // env valueFrom forces restart to pick inject — forbidden for stable identity
  errors.push('base: TELEMETRY_EMIT_ENABLED must not use env valueFrom (use volume)');
}
if (!/EMIT_FLAGS_DIR/.test(rendered.partial)) {
  errors.push('inject-partial render: expected EMIT_FLAGS_DIR preserved');
}

const summary = {
  ok: errors.length === 0,
  errors,
  renderedBytes: Object.fromEntries(
    Object.entries(rendered).map(([k, v]) => [k, v.length]),
  ),
  docsPresent: [...docSkip].filter((d) => {
    try { readFileSync(join(root, d)); return true; } catch { return false; }
  }),
};

console.log(JSON.stringify(summary, null, 2));
process.exit(errors.length === 0 ? 0 : 1);
